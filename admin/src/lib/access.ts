import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AccessIdentity = { email: string };
export class AccessDenied extends Error {}

type VerifyOptions = {
  teamDomain: string;
  aud: string;
  allowedEmail: string;
  jwks?: JWTVerifyGetKey;
};

const remoteJwks = new Map<string, JWTVerifyGetKey>();

function accessHost(teamDomain: string) {
  return teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/\.cloudflareaccess\.com$/, "") + ".cloudflareaccess.com";
}

function jwksFor(teamDomain: string): JWTVerifyGetKey {
  const host = accessHost(teamDomain);
  const cached = remoteJwks.get(host);
  if (cached) return cached;
  const created = createRemoteJWKSet(new URL(`https://${host}/cdn-cgi/access/certs`));
  remoteJwks.set(host, created);
  return created;
}

export async function verifyAccessJwt(token: string, options: VerifyOptions): Promise<AccessIdentity> {
  const host = accessHost(options.teamDomain);
  const { payload } = await jwtVerify(token, options.jwks ?? jwksFor(options.teamDomain), {
    issuer: `https://${host}`,
    audience: options.aud,
    algorithms: ["RS256"],
    maxTokenAge: "24h",
  });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email !== options.allowedEmail.trim().toLowerCase()) {
    throw new AccessDenied("Not an authorised admin identity.");
  }
  return { email };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new AccessDenied(`${name} is not configured.`);
  return value;
}

export async function requireAdmin(headers: Pick<Headers, "get">): Promise<AccessIdentity> {
  const token = headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AccessDenied("Missing Access assertion.");
  return verifyAccessJwt(token, {
    teamDomain: required("CF_ACCESS_TEAM_DOMAIN"),
    aud: required("CF_ACCESS_AUD"),
    allowedEmail: required("ADMIN_EMAIL"),
  });
}
