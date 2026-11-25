import { requireId } from "@/domain/admin/read";
import { adminRoute, type IdContext } from "@/lib/admin/server/route";
import { approveRecovery } from "@/domain/admin/operations";

export const POST = adminRoute(async (db, request, { params }: IdContext, user) =>
  approveRecovery(db, request, user.id, requireId((await params).id)),
);
