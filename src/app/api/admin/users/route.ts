import { adminRoute } from "@/lib/admin/server/route";
import { listUsers } from "@/domain/admin/records";
import { parseList } from "@/domain/admin/read";

export const GET = adminRoute(async (db, request) => listUsers(db, parseList(request)));
