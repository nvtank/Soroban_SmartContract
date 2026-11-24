import { withApi, ok } from "@/lib/api/http";
import { getExplorerTxUrl } from "@/lib/stellar";

type FeedRecord = {
  action: string;
  tx_hash: string | null;
  created_at: string;
};

type FeedDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        not: (
          column2: string,
          op: string,
          value2: null,
        ) => {
          order: (
            column3: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: FeedRecord[] | null; error: unknown }>;
          };
        };
      };
    };
  };
};

export const GET = withApi(async (request: Request) => {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : 20;
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

  let db: FeedDb | unknown = null;
  try {
    const adminMod = await import("@/lib/supabase/admin");
    if (typeof adminMod.createAdminSupabase === "function") {
      db = adminMod.createAdminSupabase();
    }
  } catch {
    // Không ném lỗi nếu chưa có kết nối DB
  }

  let txs: FeedRecord[] = [];
  const feedDb = db as FeedDb | null;
  if (feedDb && typeof feedDb.from === "function") {
    const { data } = await feedDb
      .from("onchain_txs")
      .select("action, tx_hash, created_at")
      .eq("status", "CONFIRMED")
      .not("tx_hash", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    txs = data || [];
  }

  // Khử PII: chỉ trả về action, txHash, createdAt, explorerUrl.
  // Tuyệt đối không trả về contract_id nội bộ, args, signer hay thông tin cá nhân.
  const feed = txs.map((t) => ({
    action: t.action,
    txHash: t.tx_hash,
    createdAt: t.created_at,
    explorerUrl: t.tx_hash ? getExplorerTxUrl(t.tx_hash) : null,
  }));

  const res = ok(feed);
  // Cache ngắn (15s) phù hợp với feed giao dịch công khai
  res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
  return res;
});
