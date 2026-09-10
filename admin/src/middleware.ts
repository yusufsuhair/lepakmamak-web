import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedAdminEmail, normaliseEmail } from "@/lib/admin-email";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/auth/callback") {
    return NextResponse.next();
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const allowedEmail = process.env.ADMIN_EMAIL;
  if (!url || !key || !allowedEmail) {
    return new NextResponse("Admin Auth is not configured.", { status: 503 });
  }

  // Supabase's SSR client refreshes expiring sessions here and writes the new
  // cookies to the response. Pages and server actions then verify the user again.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (!isAllowedAdminEmail(normaliseEmail(user.email), allowedEmail)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
