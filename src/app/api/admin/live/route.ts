import { adminRoute } from "@/lib/admin/server/route";
import { live, parseSince } from "@/domain/admin/metrics";

export const GET = adminRoute(async (db, request) => live(db, parseSince(request)));
