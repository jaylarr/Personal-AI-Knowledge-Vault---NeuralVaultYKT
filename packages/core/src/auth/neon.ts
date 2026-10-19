import { createRemoteJWKSet, jwtVerify } from "jose";

export function createIdentityVerifier(issuer: string, keys: Parameters<typeof jwtVerify>[1]) {
  return async (token: string) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      algorithms: ["EdDSA"],
      requiredClaims: ["sub", "exp", "iat"],
    });
    if (
      !payload.sub ||
      payload.sub.length > 512 ||
      !payload.iat ||
      payload.iat > Math.floor(Date.now() / 1000) + 30
    )
      throw new Error("Invalid identity");
    return { issuer, subject: payload.sub };
  };
}

export function createNeonVerifier(baseUrl: string, jwksUrl: string) {
  const base = new URL(baseUrl);
  const keysUrl = new URL(jwksUrl);
  if (
    base.protocol !== "https:" ||
    keysUrl.origin !== base.origin ||
    keysUrl.pathname !== `${base.pathname.replace(/\/$/, "")}/.well-known/jwks.json`
  ) {
    throw new Error("Auth JWKS does not match the configured branch");
  }
  const jwks = createRemoteJWKSet(keysUrl, { timeoutDuration: 5000 });
  return createIdentityVerifier(base.origin, jwks);
}
