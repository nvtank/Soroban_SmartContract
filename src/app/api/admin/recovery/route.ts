import { adminRoute } from "@/lib/admin/server/route";
import { listRecovery } from "@/domain/admin/records";

export const GET = adminRoute(async (db) => listRecovery(db));
