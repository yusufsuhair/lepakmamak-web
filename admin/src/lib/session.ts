import "server-only";
import { headers } from "next/headers";
import { requireAdmin, type AccessIdentity } from "./access";

// Server actions do not receive the request, so the Access assertion is read back off the
// incoming headers and verified again here. The middleware already refused anyone without
// it; this is what stops a POST straight at the action from skipping that check.
export async function currentAdmin(): Promise<AccessIdentity> {
  const token = (await headers()).get("Cf-Access-Jwt-Assertion") ?? "";
  return requireAdmin(new Request("https://admin.local/", {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
  }));
}
