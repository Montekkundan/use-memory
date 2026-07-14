export function authenticatedHeaders() {
  const cookie = process.env.EVAL_BETTER_AUTH_COOKIE?.trim();
  return cookie ? { cookie } : null;
}

export function requireAuthenticatedHeaders(
  skip: (reason: string) => never,
) {
  const headers = authenticatedHeaders();
  if (!headers) {
    skip("EVAL_BETTER_AUTH_COOKIE is required for this authenticated live eval");
  }
  return headers;
}
