import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api/auth/login|_next|favicon.ico).*)"],
};

export default function middleware(req) {
  const auth = req.cookies.get("site_auth");
  if (auth?.value === "1") return NextResponse.next();

  const loginUrl = new URL("/login.html", req.url);
  loginUrl.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
