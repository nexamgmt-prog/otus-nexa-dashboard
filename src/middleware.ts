import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/session";

const PUBLIC_API_PREFIXES = [
  "/api/crm/submit",
  "/api/crm/ghl/import",
  "/api/auth/login",
  "/api/auth/first-access",
  "/api/auth/logout",
  "/api/google-calendar/callback",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/glass-lab.html") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await verifySession(token);
    if (!session || session.role !== "admin" || (session.company !== "nexa" && session.company !== "otus")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  // Meta authenticates this endpoint with a verification token (GET) or
  // an HMAC signature (POST), rather than a browser session cookie.
  if (pathname === "/api/crm/whatsapp/webhook") return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/glass-lab.html"],
};
