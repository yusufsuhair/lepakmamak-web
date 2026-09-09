import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/access";

// Defence in depth: if Cloudflare Access is ever misconfigured or removed,
// refuse to serve pages rather than exposing service-role reads.
export async function middleware(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
