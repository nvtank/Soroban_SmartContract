import { adminRoute } from "@/lib/admin/server/route";
import { listAudit } from "@/domain/admin/events";
import { parseList } from "@/domain/admin/read";

export const GET = adminRoute(async (db, request) => listAudit(db, parseList(request)));
