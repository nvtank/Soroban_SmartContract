import { adminRoute } from "@/lib/admin/server/route";
import { runFlushOnchain } from "@/domain/admin/operations";

export const POST = adminRoute(async (db, _request, _context, user) => runFlushOnchain(db, user.id));
