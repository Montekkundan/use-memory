import { getToken, UserAuthorizationRequiredError } from "@vercel/connect";
import { defineDynamic } from "eve/tools";
import { CONNECT_USER_ISSUER, GITHUB_CONNECTOR } from "../../shared/connect.js";
import {
  DEFAULT_ACTION_PREFERENCES,
  type ActionPreferences,
} from "../../shared/personality-schema.js";
import { buildBundledEveGithubToolMap } from "../lib/github-eve-adapter.js";
import { fetchUserContext } from "../lib/memory-internal.js";
import { sessionUserId } from "../lib/session-user.js";

export function githubApprovalForChannel(
  channelKind: string | undefined,
  preferences: ActionPreferences = DEFAULT_ACTION_PREFERENCES,
) {
  if (channelKind !== "chat-sdk" && channelKind !== "photon") {
    return true;
  }

  return {
    createBranch: preferences.push !== "always",
    createOrUpdateFile: preferences.commit !== "always" || preferences.push !== "always",
    createPullRequest: preferences.openPullRequest !== "always",
  } as const;
}

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const auth = ctx.session.auth.current;
      const userId = sessionUserId(auth);
      if (!userId) {
        return {};
      }

      try {
        const context = await fetchUserContext(userId);
        const token = await getToken(GITHUB_CONNECTOR, {
          subject: {
            type: "user",
            id: userId,
            issuer: auth.issuer ?? auth.authenticator ?? CONNECT_USER_ISSUER,
          },
          scopes: ["repo"],
        });
        return buildBundledEveGithubToolMap({
          token,
          requireApproval: githubApprovalForChannel(
            ctx.channel.kind,
            context?.profile.actionPreferences,
          ),
        });
      }
      catch (error) {
        if (error instanceof UserAuthorizationRequiredError) {
          return {};
        }
        throw error;
      }
    },
  },
});
