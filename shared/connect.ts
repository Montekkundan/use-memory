import type { ConnectTokenSubject } from "@vercel/connect";

/**
 * Issuer passed to Vercel Connect for user-scoped tokens.
 * Must match Eve's `appSession()` authenticator in `agent/channels/eve.ts`.
 */
export const CONNECT_USER_ISSUER = "app";

/** Vercel Connect connector UID — keep in sync with `server/connectors.ts`. */
export const GITHUB_CONNECTOR = "github/use-memory";

export function connectUserSubjects(
  userId: string,
  preferredIssuer?: string,
): ConnectTokenSubject[] {
  const issuers = [
    preferredIssuer?.trim(),
    CONNECT_USER_ISSUER,
    undefined,
    process.env.BETTER_AUTH_URL?.trim(),
  ];
  const seen = new Set<string>();

  return issuers.flatMap((issuer) => {
    const key = issuer || "<none>";
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      type: "user" as const,
      id: userId,
      ...(issuer ? { issuer } : {}),
    }];
  });
}
