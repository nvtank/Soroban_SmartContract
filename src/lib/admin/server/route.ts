import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/domain/dto";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError, ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

function checkOrigin(request: Request) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (source === null) return;
  try {
    const origin = new URL(source);
    if (origin.origin === new URL(request.url).origin) return;
    if (["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.get("host")) return;
  } catch {
    throw new ApiError("FORBIDDEN");
  }
  throw new ApiError("FORBIDDEN");
}

export function adminRoute<Context, Data>(
  handler: (db: SupabaseClient, request: Request, context: Context, user: SessionUser) => Promise<Data>,
) {
  return withApi(async (request: Request, context: Context) => {
    if (request.method === "POST") checkOrigin(request);
    const user = await requireAdmin();
    try {
      const response = ok(await handler(createAdminSupabase(), request, context, user));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw new ApiError(error.code);
      throw error;
    }
  });
}

export type IdContext = { params: Promise<{ id: string }> };
