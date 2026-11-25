import { adminRoute } from "@/lib/admin/server/route";
import { listPayments } from "@/domain/admin/records";
import { parseList } from "@/domain/admin/read";

export const GET = adminRoute(async (db, request) => listPayments(db, parseList(request)));
