import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AccessIdentity = { email: string };

export class AccessDenied extends Error {}

export type VerifyOptions = {
  teamDomain: string;
  aud: string;
  allowedEmail: string;
  jwks?: JWTVerifyGetKey;
};

const remoteJwks = new Map<string, JWTVerifyGetKey>();

function jwksFor(teamDomain: string): JWTVerifyGetKey {
  const cached = remoteJwks.get(teamDomain);
  if (cached) return cached;
  // jose caches and refreshes the key set, which covers Access's 6-weekly rotation.
  const created = createRemoteJWKSet(
    new URL(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`),
  );
  remoteJwks.set(teamDomain, created);
  return created;
}

export async function verifyAccessJwt(
  token: string,
  options: VerifyOptions,
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(token, options.jwks ?? jwksFor(options.teamDomain), {
    issuer: `https://${options.teamDomain}.cloudflareaccess.com`,
    audience: options.aud,
  });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email !== options.allowedEmail.toLowerCase()) {
    throw new AccessDenied("Not an authorised admin identity.");
  }
  return { email };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new AccessDenied(`${name} is not configured.`);
  return value;
}

export async function requireAdmin(request: Request): Promise<AccessIdentity> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AccessDenied("Missing Access assertion.");
  return verifyAccessJwt(token, {
    teamDomain: required("CF_ACCESS_TEAM_DOMAIN"),
    aud: required("CF_ACCESS_AUD"),
    allowedEmail: required("ADMIN_EMAIL"),
  });
}
