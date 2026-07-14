interface SessionAuthLike {
  principalId: string;
  principalType: string;
}

export function sessionUserId(auth: SessionAuthLike | null | undefined) {
  if (auth?.principalType !== "user" || auth.principalId.startsWith("eve:")) {
    return undefined;
  }

  return auth.principalId;
}
