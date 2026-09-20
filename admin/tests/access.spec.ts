import { expect, test } from "@playwright/test";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { AccessDenied, requireAdmin, verifyAccessJwt } from "../src/lib/access";

const TEAM = "example-team", AUD = "aud-tag", EMAIL = "admin@example.com";

async function harness() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); jwk.kid = "k1"; jwk.alg = "RS256";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const sign = (email: string | undefined, overrides: { aud?: string; iss?: string; exp?: string } = {}) =>
    new SignJWT(email ? { email } : {}).setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(overrides.iss ?? `https://${TEAM}.cloudflareaccess.com`).setAudience(overrides.aud ?? AUD)
      .setIssuedAt().setExpirationTime(overrides.exp ?? "5m").sign(privateKey);
  return { jwks, sign };
}
const options = (jwks: JWTVerifyGetKey) => ({ teamDomain: TEAM, aud: AUD, allowedEmail: EMAIL, jwks });

test("accepts only the allowed email", async () => {
  const { jwks, sign } = await harness();
  await expect(verifyAccessJwt(await sign(EMAIL.toUpperCase()), options(jwks))).resolves.toEqual({ email: EMAIL });
  await expect(verifyAccessJwt(await sign("other@example.com"), options(jwks))).rejects.toThrow(AccessDenied);
  await expect(verifyAccessJwt(await sign(undefined), options(jwks))).rejects.toThrow(AccessDenied);
});

test("rejects invalid claims and missing headers", async () => {
  const { jwks, sign } = await harness();
  await expect(verifyAccessJwt(await sign(EMAIL, { aud: "wrong" }), options(jwks))).rejects.toThrow();
  await expect(verifyAccessJwt(await sign(EMAIL, { iss: "https://evil.example" }), options(jwks))).rejects.toThrow();
  await expect(verifyAccessJwt(await sign(EMAIL, { exp: "-1m" }), options(jwks))).rejects.toThrow();
  await expect(requireAdmin(new Headers())).rejects.toThrow(AccessDenied);
});
