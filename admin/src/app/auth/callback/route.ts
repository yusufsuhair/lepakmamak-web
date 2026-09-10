import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/admin-email";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.url));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const allowedEmail = process.env.ADMIN_EMAIL;
  if (!url || !key || !allowedEmail) return new NextResponse("Supabase Auth is not configured.", { status: 503 });

  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.url));
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAllowedAdminEmail(user?.email, allowedEmail)) {
    await supabase.auth.signOut();
    const rejected = NextResponse.redirect(new URL("/login?error=not_authorized", request.url));
    response.cookies.getAll().forEach((cookie) => rejected.cookies.set(cookie));
    return rejected;
  }
  return response;
}
