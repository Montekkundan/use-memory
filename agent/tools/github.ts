import { buildEveToolMap } from "@github-tools/sdk/eve";
import { getToken, UserAuthorizationRequiredError } from "@vercel/connect";
import { defineDynamic } from "eve/tools";
import { CONNECT_USER_ISSUER, GITHUB_CONNECTOR } from "../../shared/connect.js";
import { sessionUserId } from "../lib/session-user.js";

const IMESSAGE_PUBLISH_APPROVALS = {
  createBranch: false,
  createOrUpdateFile: false,
  createPullRequest: false,
} as const;

export function githubApprovalForChannel(channelKind: string | undefined) {
  return channelKind === "chat-sdk" || channelKind === "photon"
    ? IMESSAGE_PUBLISH_APPROVALS
    : true;
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
        const token = await getToken(GITHUB_CONNECTOR, {
          subject: {
            type: "user",
            id: userId,
            issuer: auth.issuer ?? auth.authenticator ?? CONNECT_USER_ISSUER,
          },
          scopes: ["repo"],
        });
        return buildEveToolMap({
          preset: "maintainer",
          token,
          requireApproval: githubApprovalForChannel(ctx.channel.kind),
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
