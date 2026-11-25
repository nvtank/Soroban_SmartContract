import { adminRoute } from "@/lib/admin/server/route";
import { runOverdueScan } from "@/domain/admin/operations";

export const POST = adminRoute(async (db, _request, _context, user) => runOverdueScan(db, user.id));
