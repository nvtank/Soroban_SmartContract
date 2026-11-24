import { ApiError } from "@/lib/api/http";
import type { OnchainSigner } from "./types";

/**
 * Tầng nghiệp vụ chỉ truyền tham số nghiệp vụ (id, số tiền, hash), không biết địa chỉ ví.
 * Hàm này bổ sung các tham số Address mà ABI của contract đòi hỏi, lấy từ ví custody của
 * đúng người (chủ nhà, người thuê hoặc người ký). Địa chỉ ví là dữ liệu được phép lên chain.
 */

/** Số tham số đầy đủ theo ABI cho các hàm có tham số Address. */
export const ABI_ARITY: Readonly<Record<string, number>> = {
  create_contract: 8,
  tenant_confirm: 2,
  propose_deduction: 4,
  respond_deduction: 3,
  request_refund: 2,
  approve_refund: 3,
  open_dispute: 2,
  resolve_dispute: 3,
};

type Party = "landlord" | "tenant" | "signer";

/** Vị trí chèn địa chỉ trong danh sách tham số ABI, theo thứ tự chèn từ trái sang phải. */
const INSERTS: Readonly<Record<string, ReadonlyArray<{ at: number; party: Party }>>> = {
  create_contract: [
    { at: 1, party: "landlord" },
    { at: 2, party: "tenant" },
  ],
  tenant_confirm: [{ at: 1, party: "tenant" }],
  propose_deduction: [{ at: 1, party: "landlord" }],
  respond_deduction: [{ at: 1, party: "tenant" }],
  request_refund: [{ at: 1, party: "signer" }],
  approve_refund: [{ at: 1, party: "signer" }],
  open_dispute: [{ at: 1, party: "signer" }],
  resolve_dispute: [{ at: 1, party: "signer" }],
};

/** Tham số đã đủ theo ABI (hoặc hàm không cần địa chỉ) thì không cần bổ sung. */
export function isAbiComplete(action: string, args: unknown): boolean {
  const arity = ABI_ARITY[action];
  if (arity === undefined) return true;
  return !Array.isArray(args) || args.length === arity;
}

type ClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: Record<string, string | null> | null; error: unknown }>;
      };
    };
  };
};

async function walletOf(db: ClientLike, userId: string | null, label: string): Promise<string> {
  if (!userId) {
    throw new ApiError("NOT_FOUND", { party: label }, `Chưa có ${label} cho hợp đồng này`);
  }
  const { data, error } = await db
    .from("custody_wallets")
    .select("stellar_public_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.stellar_public_key) {
    throw new ApiError("NOT_FOUND", { party: label }, `Chưa có ví on-chain của ${label}`);
  }
  return data.stellar_public_key;
}

export async function completeAbiArgs(
  db: unknown,
  params: { action: string; args: unknown; contractId: string; signer: OnchainSigner },
): Promise<unknown> {
  const { action, args, contractId, signer } = params;
  if (isAbiComplete(action, args) || !Array.isArray(args)) return args;

  const client = db as ClientLike;
  const inserts = INSERTS[action];
  if (!inserts) return args;

  type Parties = { landlord_id: string | null; tenant_id: string | null };
  let parties = null as Parties | null;
  if (inserts.some((i) => i.party !== "signer")) {
    const { data } = await client
      .from("rental_contracts")
      .select("landlord_id, tenant_id")
      .eq("id", contractId)
      .maybeSingle();
    if (!data) throw new ApiError("NOT_FOUND", { contractId }, "Không tìm thấy hợp đồng để ghi on-chain");
    parties = { landlord_id: data.landlord_id ?? null, tenant_id: data.tenant_id ?? null };
  }

  const result = [...args];
  for (const { at, party } of inserts) {
    let address: string;
    if (party === "landlord") address = await walletOf(client, parties?.landlord_id ?? null, "chủ nhà");
    else if (party === "tenant") address = await walletOf(client, parties?.tenant_id ?? null, "người thuê");
    else address = await walletOf(client, signer.kind === "USER" ? signer.userId : null, "người ký");
    result.splice(at, 0, address);
  }
  return result;
}
