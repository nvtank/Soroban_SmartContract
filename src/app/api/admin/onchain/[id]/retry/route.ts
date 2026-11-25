import { requireId } from "@/domain/admin/read";
import { adminRoute, type IdContext } from "@/lib/admin/server/route";
import { retryTransaction } from "@/domain/admin/operations";

export const POST = adminRoute(async (db, _request, { params }: IdContext, user) =>
  retryTransaction(db, user.id, requireId((await params).id)),
);
