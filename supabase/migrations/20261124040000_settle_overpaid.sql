-- Nộp thừa tiền (OVERPAID) vẫn phải ghi nhận đủ khoản phải thu của hợp đồng; phần thừa được lưu để chủ nhà hoặc admin xử lý, không tự hoàn.
-- Định nghĩa lấy từ database hiện tại (giữ SECURITY DEFINER và search_path), chỉ đổi điều kiện trạng thái.
CREATE OR REPLACE FUNCTION public.settle_payment_atomic(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF v_payment.status IN ('CONFIRMED', 'OVERPAID') THEN
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
$function$

;
