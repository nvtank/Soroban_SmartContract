import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /app routes (except public/marketing routes)
  if (pathname.startsWith("/app") && !pathname.startsWith("/app/admin-demo")) {
    const demoCookie = request.cookies.get("rentflow_demo_user_id");
    const supabaseCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

    if (!demoCookie && !supabaseCookie) {
      const loginUrl = new URL("/dang-nhap", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
