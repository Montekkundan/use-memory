import { createHmac, randomUUID } from "node:crypto";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

export default defineEval({
  description: "A signed Photon text webhook reaches the deployed iMessage channel.",
  tags: ["imessage", "photon", "live"],
  metadata: { surface: "imessage", proof: "signed ingress and outbound attempt" },
  async test(t) {
    const phoneNumber = process.env.EVAL_IMESSAGE_PHONE_NUMBER?.trim();
    const signingSecret = process.env.EVAL_IMESSAGE_WEBHOOK_SECRET?.trim();
    if (!phoneNumber || !signingSecret) {
      return t.skip("EVAL_IMESSAGE_PHONE_NUMBER and EVAL_IMESSAGE_WEBHOOK_SECRET are required");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const space = { id: `any;-;${phoneNumber}`, platform: "iMessage" };
    const marker = `IMESSAGE_EVAL_${randomUUID().slice(0, 8)}`;
    const body = JSON.stringify({
      event: "messages",
      space,
      message: {
        id: `spc-msg-${randomUUID()}`,
        platform: "iMessage",
        direction: "inbound",
        timestamp: new Date().toISOString(),
        sender: { id: phoneNumber, platform: "iMessage" },
        space,
        content: {
          type: "text",
          text: `Reply with exactly ${marker}. This is an automated live channel check.`,
        },
      },
    });
    const signature = `v0=${createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${body}`)
      .digest("hex")}`;

    const response = await t.target.fetch("/eve/v1/photon", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-spectrum-event": "messages",
        "x-spectrum-timestamp": timestamp,
        "x-spectrum-signature": signature,
      },
      body,
    });

    t.log(`Photon live marker: ${marker}`);
    t.check(response.status, equals(200));
  },
});
