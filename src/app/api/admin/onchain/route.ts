import { adminRoute } from "@/lib/admin/server/route";
import { listOnchain } from "@/domain/admin/records";
import { parseList } from "@/domain/admin/read";

export const GET = adminRoute(async (db, request) => listOnchain(db, parseList(request)));
