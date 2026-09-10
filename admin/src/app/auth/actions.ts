"use server";

import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase-server";

export async function logout() {
  const client = await supabaseServerClient();
  await client.auth.signOut();
  redirect("/login");
}
