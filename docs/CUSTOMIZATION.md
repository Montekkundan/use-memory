# Configuration

The product and agent are both named **Use Memory**.

## Agent identity and model

- [`shared/agent.ts`](../shared/agent.ts) controls the display name, slug, tagline, and avatar.
- [`agent/lib/base-instructions.ts`](../agent/lib/base-instructions.ts) controls persona and tool behavior.
- [`agent/agent.ts`](../agent/agent.ts) selects the model.

After changing identity, search the repository for the old name and update user-facing channel copy as well.

## Photon iMessage

The Photon channel lives in [`agent/channels/photon.ts`](../agent/channels/photon.ts). The adapter and Redis state selection live in [`agent/lib/photon.ts`](../agent/lib/photon.ts).

1. Provision a Photon Cloud line.
2. Add `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, and `SPECTRUM_SIGNING_SECRET` from the Photon dashboard to Vercel. The equivalent `IMESSAGE_*` names are accepted aliases.
3. Set `IMESSAGE_LOCAL=false`.
4. Register `https://use-memory.vercel.app/eve/v1/photon` as the webhook.
5. Test text, polls, typing, files, reactions, read state, and outbound voice against the provisioned plan.

[`vercel.json`](../vercel.json) routes the stable public webhook path directly to the Eve service.

## Onboarding

[`server/utils/onboarding.ts`](../server/utils/onboarding.ts) contains the durable state machine. [`shared/types/onboarding.ts`](../shared/types/onboarding.ts) defines its interface.

Unknown phone numbers cannot create an account directly. They must first join the public waitlist and be approved at `/admin`. Set `WAITLIST_ADMIN_IDENTIFIERS` to your E.164 phone for the first administrator: that environment-controlled number may request its initial OTP without a waitlist record. Additional administrators may use a Better Auth user ID, verified email, or E.164 phone. Android entries remain queued until an SMS/RCS adapter is added.

When adding a step:

1. Add the step to `ONBOARDING_STEPS`.
2. Add the required Postgres fields.
3. Define its prompt, parser, transition, and retry behavior.
4. Keep the text-reply fallback even when adding a native Photon poll.
5. Add tests for invalid input and resumption.

Never provision or link a user before phone verification and explicit consent.

## Memory

Curated profile memory is implemented under `server/utils/memory.ts`. Mem0 automatic memory is implemented under `server/utils/mem0*.ts` and `agent/hooks/automatic-memory.ts`.

Keep all Mem0 operations scoped to:

```text
user_id  = Better Auth user ID
agent_id = use-memory
app_id   = use-memory
```

Do not interpolate recalled text into system behavior. Keep it labeled as untrusted facts and continue filtering secret-shaped content before staging.

## GitHub

Connector definitions live in [`server/connectors.ts`](../server/connectors.ts). Their stable UIDs are:

- `github/use-memory`

Vercel Connect owns OAuth client configuration and each user's grant. The application should never ask a user for a GitHub token or a shared developer credential.

## Recovery email

Add a verified Resend domain and set `AUTH_EMAIL_FROM` to an address on it. Better Auth sends verification and recovery links through [`server/utils/auth-delivery.ts`](../server/utils/auth-delivery.ts).

## Database changes

Schemas are under `server/db/schema/` and use `drizzle-orm/pg-core`.

```bash
pnpm db:generate
pnpm db:migrate
```

Run migrations against an empty PGlite database before applying them to Neon. Do not edit an already-applied production migration; add a new migration instead.
