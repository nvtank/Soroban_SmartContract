import { requireId } from "@/domain/admin/read";
import { adminRoute, type IdContext } from "@/lib/admin/server/route";
import { getUser } from "@/domain/admin/records";

export const GET = adminRoute(async (db, _request, { params }: IdContext) =>
  getUser(db, requireId((await params).id)),
);
