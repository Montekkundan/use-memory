import {
  getToken,
  NoValidTokenError,
  UserAuthorizationRequiredError,
} from "@vercel/connect";
import { defineDynamic } from "eve/tools";
import { connectUserSubjects, GITHUB_CONNECTOR } from "../../shared/connect.js";
import { errorKind, logEvent, opaqueReference } from "../../shared/observability.js";
import {
  DEFAULT_ACTION_PREFERENCES,
  type ActionPreferences,
} from "../../shared/personality-schema.js";
import { buildBundledEveGithubToolMap } from "../lib/github-eve-adapter.js";
import { isIMessageChannelKind } from "../lib/channel-kind.js";
import { fetchUserContext } from "../lib/memory-internal.js";
import { sessionUserId } from "../lib/session-user.js";

export function githubApprovalForChannel(
  channelKind: string | undefined,
  preferences: ActionPreferences = DEFAULT_ACTION_PREFERENCES,
) {
  if (!isIMessageChannelKind(channelKind)) {
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
    "turn.started": async (_event, ctx) => {
      const auth = ctx.session.auth.current;
      const userId = sessionUserId(auth);
      if (!userId) {
        return {};
      }

      const fields = {
        userRef: opaqueReference(userId),
        channelKind: ctx.channel.kind ?? "unknown",
      };

      try {
        let token: string | undefined;
        let lastMissingGrant: unknown;
        for (const subject of connectUserSubjects(
          userId,
          auth.issuer ?? auth.authenticator,
        )) {
          try {
            token = await getToken(GITHUB_CONNECTOR, {
              subject,
              scopes: ["repo"],
            }, { forceRefresh: true });
            break;
          }
          catch (error) {
            if (
              error instanceof UserAuthorizationRequiredError
              || error instanceof NoValidTokenError
            ) {
              lastMissingGrant = error;
              continue;
            }
            throw error;
          }
        }

        if (!token) {
          logEvent("info", "github.tools.resolved", {
            ...fields,
            connected: false,
            reason: lastMissingGrant ? "authorization_required" : "token_unavailable",
          });
          return {};
        }

        const context = await fetchUserContext(userId);
        const tools = buildBundledEveGithubToolMap({
          token,
          requireApproval: githubApprovalForChannel(
            ctx.channel.kind,
            context?.profile.actionPreferences,
          ),
        });
        logEvent("info", "github.tools.resolved", {
          ...fields,
          connected: true,
          toolCount: Object.keys(tools).length,
        });
        return tools;
      }
      catch (error) {
        logEvent("error", "github.tools.resolve_failed", {
          ...fields,
          errorKind: errorKind(error),
        });
        return {};
      }
    },
  },
});
