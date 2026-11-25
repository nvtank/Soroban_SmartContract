import { requireId } from "@/domain/admin/read";
import { adminRoute, type IdContext } from "@/lib/admin/server/route";
import { getContract } from "@/domain/admin/records";

export const GET = adminRoute(async (db, _request, { params }: IdContext) =>
  getContract(db, requireId((await params).id)),
);
