import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function supabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(required("SUPABASE_URL"), required("SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always mutate cookies. Middleware refreshes the
          // session before rendering, while Server Actions can still write cookies.
        }
      },
    },
  });
}
