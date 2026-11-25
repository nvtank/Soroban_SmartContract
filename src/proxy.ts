import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE, verifySessionToken } from "@/lib/supabase/demo-session";

function isOriginAllowed(originHeader: string, request: NextRequest): boolean {
  try {
    const originUrl = new URL(originHeader);
    const requestUrl = request.nextUrl;

    // 1. Same host & port
    if (originUrl.host === requestUrl.host) {
      return true;
    }

    // 2. Local development & test origins
    const allowedLocalHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
    if (
      allowedLocalHosts.includes(originUrl.hostname) &&
      allowedLocalHosts.includes(requestUrl.hostname)
    ) {
      return true;
    }

    // 3. NEXT_PUBLIC_APP_URL or WEBAUTHN_ORIGIN
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBAUTHN_ORIGIN;
    if (appUrl) {
      const parsedApp = new URL(appUrl);
      if (originUrl.host === parsedApp.host) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDemo = process.env.DEMO_MODE === "true";

  // 1. CSRF Protection for state-changing HTTP methods
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(request.method)) {
    // Webhook routes are exempted from browser CSRF (they use HMAC/cryptographic signatures)
    const isWebhook = pathname.startsWith("/api/payments/payos/webhook");

    if (!isWebhook) {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");

      if (origin) {
        if (!isOriginAllowed(origin, request)) {
          return new NextResponse(
            JSON.stringify({
              error: {
                code: "FORBIDDEN",
                message: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF (Origin không hợp lệ).",
              },
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      } else if (referer) {
        if (!isOriginAllowed(referer, request)) {
          return new NextResponse(
            JSON.stringify({
              error: {
                code: "FORBIDDEN",
                message: "Yêu cầu bị từ chối do vi phạm bảo mật CSRF (Referer không hợp lệ).",
              },
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
    }
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const session = verifySessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
    const isAdmin = session?.role === "ADMIN_DEMO";

    if (pathname === "/admin/dang-nhap") {
      return isAdmin ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
    }

    if (!isAdmin) {
      const loginUrl = new URL("/admin/dang-nhap", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Protect /app/admin-demo: ONLY ADMIN_DEMO when DEMO_MODE=true
  if (pathname.startsWith("/app/admin-demo")) {
    if (!isDemo) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const session = verifySessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);

    if (!session) {
      const loginUrl = new URL("/dang-nhap", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Vai trò lấy từ phiên đã ký, không tin cookie hay header do client gửi
    if (session.role !== "ADMIN_DEMO") {
      return new NextResponse(
        "Forbidden: Khu vực quản trị chỉ dành cho tài khoản có quyền ADMIN_DEMO.",
        { status: 403 },
      );
    }

    return NextResponse.next();
  }

  // 3. Protect all other /app/** routes at the server
  if (pathname.startsWith("/app")) {
    // Chỉ để điều hướng về trang đăng nhập; quyền thật luôn được kiểm tra lại ở API.
    const session = verifySessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
    const supabaseCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

    if (!session && !supabaseCookie) {
      const loginUrl = new URL("/dang-nhap", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
