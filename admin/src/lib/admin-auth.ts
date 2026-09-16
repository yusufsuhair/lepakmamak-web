import { headers } from "next/headers";
import { requireAdmin, type AccessIdentity } from "./access";

export type AdminIdentity = AccessIdentity;

export async function currentAdmin(): Promise<AdminIdentity> {
  return requireAdmin(await headers());
}
