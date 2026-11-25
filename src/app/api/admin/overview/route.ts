import { adminRoute } from "@/lib/admin/server/route";
import { overview } from "@/domain/admin/metrics";

export const GET = adminRoute(async (db) => overview(db));
