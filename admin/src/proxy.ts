import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/access";

export async function proxy(request: NextRequest) {
  try {
    await requireAdmin(request.headers);
    return NextResponse.next();
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
