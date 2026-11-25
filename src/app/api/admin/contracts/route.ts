import { adminRoute } from "@/lib/admin/server/route";
import { listContracts } from "@/domain/admin/records";
import { parseList } from "@/domain/admin/read";

export const GET = adminRoute(async (db, request) => listContracts(db, parseList(request)));
