import { isAllowedAdminEmail, normaliseEmail } from "./admin-email";
import { supabaseServerClient } from "./supabase-server";

export type AdminIdentity = { email: string; userId: string };

export class AdminAuthDenied extends Error {}

export async function currentAdmin(): Promise<AdminIdentity> {
  const client = await supabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AdminAuthDenied("You must sign in as the admin.");

  const email = normaliseEmail(user.email);
  if (!isAllowedAdminEmail(email, process.env.ADMIN_EMAIL)) {
    throw new AdminAuthDenied("This account is not authorised for the admin console.");
  }
  return { email, userId: user.id };
}
