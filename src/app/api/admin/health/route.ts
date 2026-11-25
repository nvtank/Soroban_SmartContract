import { adminRoute } from "@/lib/admin/server/route";
import { health } from "@/domain/admin/metrics";

export const GET = adminRoute(async (db) => health(db));
