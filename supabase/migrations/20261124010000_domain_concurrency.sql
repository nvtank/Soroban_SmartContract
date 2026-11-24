-- Migration: 20261124010000_domain_concurrency.sql
-- Agent C Round 2: Domain Concurrency, Idempotency & Safe State Transitions

-- 1. Add settled_at to payments for settlement idempotency
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS settled_at timestamptz;

-- 2. Atomic settlement RPC
CREATE OR REPLACE FUNCTION public.settle_payment_atomic(
  p_payment_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_contract public.rental_contracts%ROWTYPE;
  v_deposit public.deposits%ROWTYPE;
  v_rent_period public.rent_periods%ROWTYPE;
  v_new_paid bigint;
  v_target_status text;
  v_settle_result text;
BEGIN
  -- Lock payment row
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PAYMENT_NOT_FOUND');
  END IF;

  -- Idempotency check: if already settled, return immediately
  IF v_payment.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'action_taken', 'ALREADY_SETTLED',
      'payment', row_to_json(v_payment)
    );
  END IF;

  SELECT * INTO v_contract FROM public.rental_contracts WHERE id = v_payment.contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CONTRACT_NOT_FOUND');
  END IF;

  IF v_payment.status = 'CONFIRMED' THEN
    IF v_payment.kind = 'DEPOSIT' THEN
      SELECT * INTO v_deposit FROM public.deposits WHERE contract_id = v_payment.contract_id FOR UPDATE;
      IF FOUND AND v_deposit.status = 'UNPAID' THEN
        UPDATE public.deposits
        SET status = 'RECORDED',
            paid_amount = v_payment.business_amount
        WHERE contract_id = v_payment.contract_id
        RETURNING * INTO v_deposit;
        v_settle_result := 'DEPOSIT_RECORDED';
      ELSE
        v_settle_result := 'DEPOSIT_ALREADY_RECORDED';
      END IF;
    ELSIF v_payment.kind = 'RENT' AND v_payment.period_no IS NOT NULL THEN
      SELECT * INTO v_rent_period FROM public.rent_periods
      WHERE contract_id = v_payment.contract_id AND period_no = v_payment.period_no
      FOR UPDATE;

      IF FOUND THEN
        v_new_paid := v_rent_period.amount_paid + v_payment.business_amount;
        IF v_new_paid >= v_rent_period.amount_due THEN
          v_target_status := 'PAID';
        ELSE
          v_target_status := 'PARTIALLY_PAID';
        END IF;

        UPDATE public.rent_periods
        SET amount_paid = v_new_paid,
            status = v_target_status
        WHERE contract_id = v_payment.contract_id AND period_no = v_payment.period_no
        RETURNING * INTO v_rent_period;

        v_settle_result := 'RENT_UPDATED';
      END IF;
    END IF;
  ELSIF v_payment.status = 'UNDERPAID' THEN
    IF v_payment.kind = 'RENT' AND v_payment.period_no IS NOT NULL AND v_payment.paid_amount > 0 THEN
      SELECT * INTO v_rent_period FROM public.rent_periods
      WHERE contract_id = v_payment.contract_id AND period_no = v_payment.period_no
      FOR UPDATE;

      IF FOUND THEN
        v_new_paid := v_rent_period.amount_paid + v_payment.paid_amount;
        UPDATE public.rent_periods
        SET amount_paid = v_new_paid,
            status = 'PARTIALLY_PAID'
        WHERE contract_id = v_payment.contract_id AND period_no = v_payment.period_no
        RETURNING * INTO v_rent_period;

        v_settle_result := 'RENT_PARTIALLY_PAID';
      END IF;
    END IF;
  END IF;

  -- Mark payment as settled
  UPDATE public.payments
  SET settled_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN jsonb_build_object(
    'action_taken', coalesce(v_settle_result, 'SETTLED'),
    'payment', row_to_json(v_payment),
    'deposit', row_to_json(v_deposit),
    'rent_period', row_to_json(v_rent_period)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Atomic refund approval RPC (prevents double release on concurrent approvals)
CREATE OR REPLACE FUNCTION public.approve_refund_atomic(
  p_contract_id uuid,
  p_user_id uuid,
  p_role text,
  p_refund_amount bigint
) RETURNS jsonb AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
  v_contract public.rental_contracts%ROWTYPE;
  v_dispute public.disputes%ROWTYPE;
  v_current_landlord bigint;
  v_current_tenant bigint;
  v_action_taken text;
BEGIN
  -- Lock contract and deposit
  SELECT * INTO v_contract FROM public.rental_contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CONTRACT_NOT_FOUND');
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE contract_id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'DEPOSIT_NOT_FOUND');
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE contract_id = p_contract_id;
  IF FOUND AND v_dispute.status IN ('IN_PROGRESS', 'AWAITING_CONFIRMATION') THEN
    RETURN jsonb_build_object('error', 'DISPUTE_LOCKED');
  END IF;

  -- If deposit already REFUNDED, return idempotently
  IF v_deposit.status = 'REFUNDED' THEN
    RETURN jsonb_build_object(
      'action_taken', 'ALREADY_REFUNDED',
      'deposit', row_to_json(v_deposit)
    );
  END IF;

  -- Validate amount
  IF p_refund_amount < 0 OR p_refund_amount > v_deposit.paid_amount THEN
    RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
  END IF;

  -- Update appropriate party's refund amount
  IF p_role = 'LANDLORD' OR p_role = 'ADMIN_DEMO' THEN
    UPDATE public.deposits
    SET landlord_refund_amount = p_refund_amount
    WHERE contract_id = p_contract_id
    RETURNING * INTO v_deposit;
  END IF;

  IF p_role = 'TENANT' THEN
    UPDATE public.deposits
    SET tenant_refund_amount = p_refund_amount
    WHERE contract_id = p_contract_id
    RETURNING * INTO v_deposit;
  END IF;

  v_current_landlord := v_deposit.landlord_refund_amount;
  v_current_tenant := v_deposit.tenant_refund_amount;

  IF v_current_landlord IS NOT NULL AND v_current_tenant IS NOT NULL THEN
    IF v_current_landlord = v_current_tenant THEN
      -- Both agreed on same amount -> REFUNDED
      UPDATE public.deposits
      SET status = 'REFUNDED',
          refund_amount = v_current_landlord,
          deducted_amount = v_deposit.paid_amount - v_current_landlord
      WHERE contract_id = p_contract_id
      RETURNING * INTO v_deposit;

      IF v_contract.status = 'ACTIVE' THEN
        UPDATE public.rental_contracts
        SET status = 'ENDED'
        WHERE id = p_contract_id;
      END IF;

      v_action_taken := 'COMPLETED';
    ELSE
      -- Disagreement -> PENDING_DISPUTE
      UPDATE public.deposits
      SET status = 'PENDING_DISPUTE'
      WHERE contract_id = p_contract_id
      RETURNING * INTO v_deposit;

      IF FOUND AND v_dispute.contract_id IS NOT NULL THEN
        UPDATE public.disputes
        SET status = 'IN_PROGRESS',
            note = format('Bất đồng số tiền hoàn cọc: Chủ nhà đề xuất %s, Người thuê đề xuất %s', v_current_landlord, v_current_tenant)
        WHERE contract_id = p_contract_id;
      ELSE
        INSERT INTO public.disputes (contract_id, status, opened_by, note)
        VALUES (p_contract_id, 'IN_PROGRESS', p_user_id, format('Bất đồng số tiền hoàn cọc: Chủ nhà đề xuất %s, Người thuê đề xuất %s', v_current_landlord, v_current_tenant));
      END IF;

      v_action_taken := 'DISPUTED';
    END IF;
  ELSE
    -- Only one party submitted so far
    v_action_taken := 'WAITING_OTHER_PARTY';
  END IF;

  RETURN jsonb_build_object(
    'action_taken', v_action_taken,
    'deposit', row_to_json(v_deposit)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Atomic dispute resolution RPC
CREATE OR REPLACE FUNCTION public.resolve_dispute_atomic(
  p_contract_id uuid,
  p_user_id uuid,
  p_role text,
  p_agreed_amount bigint
) RETURNS jsonb AS $$
DECLARE
  v_dispute public.disputes%ROWTYPE;
  v_deposit public.deposits%ROWTYPE;
  v_contract public.rental_contracts%ROWTYPE;
  v_current_landlord bigint;
  v_current_tenant bigint;
  v_action_taken text;
  v_remaining_deducted bigint;
  v_target_deposit_status text;
BEGIN
  SELECT * INTO v_contract FROM public.rental_contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CONTRACT_NOT_FOUND');
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE contract_id = p_contract_id FOR UPDATE;
  IF NOT FOUND OR v_dispute.status NOT IN ('IN_PROGRESS', 'AWAITING_CONFIRMATION') THEN
    RETURN jsonb_build_object('error', 'INVALID_DISPUTE_STATE');
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE contract_id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'DEPOSIT_NOT_FOUND');
  END IF;

  IF p_agreed_amount < 0 OR p_agreed_amount > v_deposit.paid_amount THEN
    RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
  END IF;

  IF p_role = 'LANDLORD' OR p_role = 'ADMIN_DEMO' THEN
    UPDATE public.disputes
    SET landlord_agreed_amount = p_agreed_amount
    WHERE contract_id = p_contract_id
    RETURNING * INTO v_dispute;
  END IF;

  IF p_role = 'TENANT' THEN
    UPDATE public.disputes
    SET tenant_agreed_amount = p_agreed_amount
    WHERE contract_id = p_contract_id
    RETURNING * INTO v_dispute;
  END IF;

  v_current_landlord := v_dispute.landlord_agreed_amount;
  v_current_tenant := v_dispute.tenant_agreed_amount;

  IF v_current_landlord IS NOT NULL AND v_current_tenant IS NOT NULL THEN
    IF v_current_landlord = v_current_tenant THEN
      -- Both agreed!
      UPDATE public.disputes
      SET status = 'RESOLVED'
      WHERE contract_id = p_contract_id
      RETURNING * INTO v_dispute;

      v_remaining_deducted := v_deposit.paid_amount - v_current_landlord;
      IF v_remaining_deducted > 0 THEN
        v_target_deposit_status := 'DEDUCTED';
      ELSE
        v_target_deposit_status := 'REFUNDED';
      END IF;

      UPDATE public.deposits
      SET status = v_target_deposit_status,
          refund_amount = v_current_landlord,
          deducted_amount = v_remaining_deducted
      WHERE contract_id = p_contract_id
      RETURNING * INTO v_deposit;

      IF v_contract.status = 'ACTIVE' THEN
        UPDATE public.rental_contracts
        SET status = 'ENDED'
        WHERE id = p_contract_id;
      END IF;

      v_action_taken := 'RESOLVED';
    ELSE
      -- Mismatch: remain IN_PROGRESS
      UPDATE public.disputes
      SET status = 'IN_PROGRESS'
      WHERE contract_id = p_contract_id
      RETURNING * INTO v_dispute;

      v_action_taken := 'MISMATCH';
    END IF;
  ELSE
    -- One party submitted: AWAITING_CONFIRMATION
    UPDATE public.disputes
    SET status = 'AWAITING_CONFIRMATION'
    WHERE contract_id = p_contract_id
    RETURNING * INTO v_dispute;

    v_action_taken := 'AWAITING_CONFIRMATION';
  END IF;

  RETURN jsonb_build_object(
    'action_taken', v_action_taken,
    'dispute', row_to_json(v_dispute),
    'deposit', row_to_json(v_deposit)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Revoke from public, anon, authenticated & grant only to service_role and postgres
REVOKE ALL ON FUNCTION public.settle_payment_atomic(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_refund_atomic(uuid, uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_dispute_atomic(uuid, uuid, text, bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.settle_payment_atomic(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.approve_refund_atomic(uuid, uuid, text, bigint) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_dispute_atomic(uuid, uuid, text, bigint) TO postgres, service_role;
