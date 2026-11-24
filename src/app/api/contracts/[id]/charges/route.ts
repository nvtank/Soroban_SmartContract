import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { createCharge } from "@/domain/charges/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

const createChargeSchema = z.object({
  kind: z.enum(["ELECTRICITY", "WATER", "SERVICE", "OTHER"]),
  amount: z.string().regex(/^\d+$/),
  note: z.string().optional().nullable(),
  periodNo: z.number().int().positive().optional().nullable(),
});

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = await parseJson(request, createChargeSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const charge = await createCharge(repo, id, input, user);
  return ok(charge, 201);
});
