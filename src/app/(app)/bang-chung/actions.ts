"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { OnchainTxDto } from "@/domain/dto";
import type { OnchainTxStatus } from "@/domain/states";
import { getExplorerTxUrl } from "@/lib/stellar/explorer";

export async function getPublicOnchainTxsAction(): Promise<OnchainTxDto[]> {
  const admin = createAdminSupabase();

  const { data, error } = await admin
    .from("onchain_txs")
    .select("id, contract_id, action, payload_hash, status, tx_hash, error, retry_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    contractId: item.contract_id,
    action: item.action,
    payloadHash: item.payload_hash,
    status: item.status as OnchainTxStatus,
    txHash: item.tx_hash,
    explorerUrl: item.tx_hash ? getExplorerTxUrl(item.tx_hash) : null,
    error: item.error,
    retryCount: item.retry_count,
    createdAt: item.created_at,
  }));
}
