# Environment

Copy [`.env.example`](../.env.example) to `.env` for local work. Add production secrets directly to Vercel.

## Core

| Variable | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | Signs Better Auth sessions and hashes one-time browser tokens. Generate at least 32 random characters. |
| `BETTER_AUTH_URL` | Yes | Public app origin, such as `http://localhost:3000` or `https://use-memory.vercel.app`. |
| `INTERNAL_API_SECRET` | Yes | Bearer secret shared by the Nuxt and Eve services. |
| `NUXT_PUBLIC_SITE_URL` | Recommended | Canonical public origin used by the UI and metadata. |
| `EVE_INTERNAL_URL` | No | Separate Eve origin for development. Vercel uses the public app origin and configured rewrites. |
| `WAITLIST_ADMIN_IDENTIFIERS` | Yes for approvals | Comma-separated Better Auth user IDs, verified emails, or E.164 phone numbers allowed to use `/admin`. Use an E.164 phone for the first-admin OTP bootstrap. |

Set the same core values for development, preview, and production where appropriate. `BETTER_AUTH_URL` and `NUXT_PUBLIC_SITE_URL` should use the correct deployment origin.

## PostgreSQL

NuxtHub uses PGlite locally when no remote database URL exists. On Vercel, attach Neon from the Marketplace; it supplies `DATABASE_URL` or a compatible Postgres URL.

```bash
vercel integration add neon
vercel env pull .env.local --yes
pnpm db:migrate
```

The database stores Better Auth users and sessions, curated profiles, onboarding state, and durable Mem0 delivery jobs. OAuth tokens remain managed by Vercel Connect.

## Photon Cloud

| Variable | Required | Purpose |
| --- | --- | --- |
| `IMESSAGE_LOCAL` | Yes in production | Set to `false` for Photon Cloud. |
| `SPECTRUM_PROJECT_ID` | Yes | Project ID shown in the Photon/Spectrum dashboard. Alias: `IMESSAGE_PROJECT_ID`. |
| `SPECTRUM_PROJECT_SECRET` | Yes | Project secret shown in the Photon/Spectrum dashboard. Alias: `IMESSAGE_PROJECT_SECRET`. |
| `SPECTRUM_SIGNING_SECRET` | Yes | Signing secret shown when registering the webhook. Alias: `IMESSAGE_WEBHOOK_SECRET`. It verifies `X-Spectrum-Signature` and rejects stale requests. |
| `PHOTON_NATIVE_POLL_EVENTS_ENABLED` | No | Experimental. Leave unset or `false` while Photon cloud webhooks only guarantee text and attachment delivery. Set to `true` only after `poll_option` deliveries are verified for the project. |

Use either the three `SPECTRUM_*` names or their three `IMESSAGE_*` aliases, not both. Project ID and project secret enable outbound delivery. The signing secret additionally enables authenticated inbound webhooks.

Configure Photon to send events to:

```text
https://use-memory.vercel.app/eve/v1/photon
```

The adapter also uses the Photon API to send OTPs and connection confirmations. Do not expose the internal OTP or system routes; they require `INTERNAL_API_SECRET`.

Onboarding consent always accepts `YES`/`1` and `NO`/`2`. Native polls remain opt-in because Photon documents text and attachment as the webhook payloads currently verified end to end; a poll can render in Messages without its vote reaching the webhook.

The approval queue stores when Photon accepts an invitation request. Photon acceptance is not a carrier delivery receipt. Android entries are held until a separate SMS/RCS adapter is configured.

Invitation, inbound message, agent-turn, and Mem0 delivery events are emitted as JSON logs with an `event` and privacy-safe hashed references. The approval response includes a `requestId` that can be searched in Vercel logs without logging a phone number or message body.

## Redis

Chat SDK state uses a Redis protocol URL:

- `REDIS_URL`, or
- `KV_URL` when supplied by a Vercel Marketplace integration.

Mem0 recall caching uses the Upstash REST pair:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

Without Redis, development falls back to process memory. Production warns and loses durable Chat SDK callback/deduplication state, so attach Redis before live iMessage testing.

## Mem0 Cloud

| Variable | Required | Purpose |
| --- | --- | --- |
| `MEM0_API_KEY` | Yes for automatic memory | Mem0 Cloud API key. |
| `MEM0_API_URL` | No | Alternate Mem0 endpoint. |

Mem0 is consent-gated. Every operation is scoped to the Better Auth user ID plus `agent_id=use-memory` and `app_id=use-memory`.

## Resend

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes for recovery email | Sends recovery and verification links. |
| `AUTH_EMAIL_FROM` | Yes for recovery email | Verified sender, for example `admin@cynevra.com`. |

Add and verify a domain in Resend before using recovery email. The magic link is short-lived, single-use, and stored hashed by Better Auth.

## Vercel Connect

GitHub does not require a developer API key in this application. Create and attach this connector UID:

- `github/use-memory`

Each Better Auth user follows their own authorization link. Vercel Connect stores and refreshes that user's grant, while the application requests tokens using the same Better Auth user ID as the subject.

## Vercel Sandbox

Vercel deployments authenticate Sandbox automatically through project OIDC; no user Vercel token is stored. For local Sandbox testing, link the repository and run `vercel env pull` so `VERCEL_OIDC_TOKEN` is available. Sandbox usage belongs to the linked `use-memory` Vercel project.

## Local reset

PGlite data lives under `.data/`. To start with an empty local database:

```bash
rm -rf .data
pnpm db:migrate
```

Never run that command against a directory containing data you need.

## Evals

`pnpm eval` runs deterministic and model-backed Eve checks through the same HTTP protocol used by web chat. `pnpm eval:remote` targets production. The authenticated and live-channel cases skip unless their credentials are supplied:

| Variable | Purpose |
| --- | --- |
| `EVAL_BETTER_AUTH_COOKIE` | Short-lived Better Auth cookie for read-only GitHub and temporary profile-update evals. Pass the complete cookie pair and never commit it. |
| `EVAL_IMESSAGE_PHONE_NUMBER` | Verified, fully onboarded test number that may receive the live iMessage marker. |
| `EVAL_IMESSAGE_WEBHOOK_SECRET` | Photon signing secret used only to construct the live signed-ingress fixture. |

The profile eval restores the original name in `finally`. The GitHub eval performs read-only calls and cross-checks the latest commit against GitHub's API. Eve evals prove the agent HTTP surface; a real Messages send remains the final proof that Apple-to-Photon inbound delivery occurred.
