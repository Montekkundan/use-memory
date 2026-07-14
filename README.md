# use-memory

A personal agent you can text from iMessage. Photon Cloud delivers messages to an Eve agent on Vercel, Better Auth owns identity, and Mem0 recalls only the verified user's memories.

## What is included

- Public phone waitlist with iPhone/Android routing and recorded messaging consent
- Protected approval queue that can invite iPhone users through Photon
- Photon Cloud iMessage DMs through Eve's Chat SDK channel
- Phone OTP sign-in, recovery email, and one-time browser links with Better Auth
- Resumable chat-only onboarding with text choices and numbered multiselect replies
- Consent-gated Mem0 recall and automatic memory writes per Better Auth user
- Neon Postgres for auth, profiles, onboarding, and durable memory jobs
- Redis for Chat SDK state, webhook deduplication, and short recall caching
- User-owned GitHub authorization through Vercel Connect
- App-owned 1-vCPU Vercel Sandboxes for bounded repository commands, tests, and diffs
- Web chat, memory controls, and GitHub integration settings

## Run locally

Requirements: Node.js 24+ and pnpm 9.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Local development uses PGlite when no remote Postgres URL is set. Phone delivery, Mem0, recovery email, and external connectors require their corresponding credentials.

See [Environment](./docs/ENVIRONMENT.md) for every variable.

## Deploy to Vercel

The repository is configured as two Vercel services. Project-level routing sends `/eve/v1/**` to Eve and every other path to Nuxt.

```bash
vercel link --yes --team monteks-projects --project use-memory
vercel env pull .env.local --yes
pnpm db:migrate
vercel deploy
```

Attach a Neon database and an Upstash Redis resource from the Vercel Marketplace. Configure a Resend sending domain, then add Photon and Mem0 credentials directly in Vercel. Never paste secrets into chat or commit them.

Set `WAITLIST_ADMIN_IDENTIFIERS` to your E.164 phone number for the first login. That environment-controlled number may request its initial OTP without a waitlist record; after verification it can manage `/admin`. Additional administrators may be listed by Better Auth user ID, verified email, or E.164 phone.

Photon labels its values `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, and `SPECTRUM_SIGNING_SECRET`. Add those names directly to Vercel. The equivalent `IMESSAGE_PROJECT_ID`, `IMESSAGE_PROJECT_SECRET`, and `IMESSAGE_WEBHOOK_SECRET` names are supported aliases; do not configure both sets.

The Photon webhook is:

```text
https://use-memory.vercel.app/eve/v1/photon
```

Create and attach these Vercel Connect resources:

```bash
vercel connect create github --name use-memory
vercel connect attach github/use-memory
```

Each user authorizes their own GitHub account. They never provide a developer API key or personal access token.

Vercel Sandbox uses the deployment's project OIDC identity, one vCPU, a five-minute timeout, and non-persistent microVMs. The user's short-lived, repository-scoped GitHub token is used only to clone and is removed from the Git remote before any agent command runs. Sandbox inspects, edits, tests, and returns a diff. When the user explicitly asks to publish that change, the GitHub tools may create a branch, update the reviewed files, and open a pull request directly from iMessage. Merges and other destructive writes remain approval-gated.

Public Sign in with Vercel is identity-only for this product today. Vercel resource/API permissions are still private beta, so signing in cannot safely make Sandbox run against each user's own Hobby quota. The current prototype intentionally charges Sandbox usage to the `use-memory` Vercel project instead of asking users for personal access tokens.

## Use it from iMessage

1. Join the waitlist at `https://use-memory.vercel.app` with an iPhone number.
2. An administrator signs in and grants access at `/admin`.
3. Photon accepts an invitation addressed to that number. Save the sending number as **Use Memory**.
4. Reply `START`, then reply with the six-digit verification code.
5. Reply `YES` or `1` to consent, then complete name, timezone, preferences, interests, and connector choices in the conversation.
6. Open the short-lived GitHub link when offered.
7. Keep texting the same contact. Later conversations recall only your verified user namespace.

The approval screen records whether Photon accepted the outbound request; that is not a carrier delivery receipt. Photon Cloud does not require a Mac to remain online.

## Android

Android visitors can join with a mobile number and email, but the current product does not start an Android conversation. Their request remains queued until an SMS/RCS channel is attached.

Photon advertises SMS/RCS fallback, but the current Chat SDK adapter does not expose the selected transport or delivery result. Keep Photon for the iMessage experience, and add the official Twilio Chat SDK adapter for an explicit SMS fallback. Linq is another option if transport selection and message delivery webhooks are more important than preserving the Photon implementation.

## Web app

- `/` — public waitlist with a live particle scene and phone/platform form
- `/home` and `/chat/:id` — authenticated Eve chat, streaming activity, retries, approvals, and tool results
- Sidebar — conversation history, search, keyboard shortcuts, and deletion
- Settings → Profile — profile fields, verified phone/recovery email, curated memory, and Mem0 search/delete/forget controls
- Settings → Integrations — per-user GitHub grants through Vercel Connect
- Coding sandbox — explicitly requested repository work runs in a fresh app-owned Vercel Sandbox and returns logs plus a diff
- `/connect/:id` — short-lived authenticated browser bridge opened from iMessage
- `/admin` — owner-only approval queue, Photon invitation status, and searchable request trace IDs

## Memory model

Curated profile memory remains pinned context you can edit directly. Automatic Mem0 memory is separate:

- `user_id` is the Better Auth user ID.
- `agent_id` and `app_id` are `use-memory`.
- Up to eight relevant facts are injected as untrusted context, never instructions.
- The final user/assistant pair is staged in Postgres before delivery to Mem0.
- Secrets, credentials, OAuth tokens, OTPs, and recovery codes are excluded.
- Settings → Profile can search, delete, pause, or forget all automatic memory.

## iMessage limitations

- Photon cloud webhooks currently guarantee text and attachment events, not poll votes. Consent uses `YES`/`1` and `NO`/`2`; onboarding accepts replies such as `1,3,4` for multiselect questions.
- Responses are sent when complete; iMessage does not receive token-by-token streaming.
- Inbound voice notes currently expose metadata but not reliable downloadable audio bytes through the adapter, so the agent asks for text.
- Typing, reactions, polls, files, read state, and outbound voice depend on the provisioned Photon Cloud plan and should be verified on the live line.
- Sandbox returns a proposed diff. An explicit iMessage request can publish that reviewed change as a branch and pull request; it never merges the pull request.

## Commands

```bash
pnpm test         # Vitest unit tests
pnpm typecheck    # Nuxt and TypeScript checks
pnpm build        # Production build
pnpm eval         # Eve agent evals against a local target
pnpm eval:remote  # Eve agent evals against production
pnpm db:generate  # Generate PostgreSQL migrations
pnpm db:migrate   # Apply migrations
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Environment](./docs/ENVIRONMENT.md)
- [Configuration](./docs/CUSTOMIZATION.md)
- [Contributing](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
