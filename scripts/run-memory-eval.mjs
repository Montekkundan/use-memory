import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();
const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
const targetUrl = process.env.EVAL_TARGET_URL?.trim() || "https://use-memory.vercel.app";

if (!databaseUrl || !authSecret) {
  throw new Error("DATABASE_URL and BETTER_AUTH_SECRET are required");
}

const sql = neon(databaseUrl);
const userId = "use-memory-mem0-live-eval";
const email = "mem0-live-eval@users.use-memory.local";
const sessionId = randomUUID();
const sessionToken = randomBytes(32).toString("hex");
const sessionSignature = createHmac("sha256", authSecret)
  .update(sessionToken)
  .digest("base64");
const cookie = `__Secure-better-auth.session_token=${sessionToken}.${sessionSignature}`;

async function provisionEvalAccount() {
  await sql`DELETE FROM "user" WHERE "id" = ${userId} OR "email" = ${email}`;
  await sql`
    INSERT INTO "user" (
      "id", "name", "email", "email_verified", "phone_number_verified",
      "created_at", "updated_at"
    )
    VALUES (
      ${userId}, 'Mem0 live eval', ${email}, true, false, now(), now()
    )
  `;
  await sql`
    INSERT INTO "user_profiles" ("user_id", "timezone", "locale", "bio", "updated_at")
    VALUES (${userId}, 'UTC', 'en', '', now())
  `;
  await sql`
    INSERT INTO "mem0_user_settings" (
      "user_id", "automatic_memory_enabled", "consented_at", "created_at", "updated_at"
    )
    VALUES (${userId}, true, now(), now(), now())
  `;
  await sql`
    INSERT INTO "session" (
      "id", "expires_at", "token", "created_at", "updated_at", "user_id"
    )
    VALUES (
      ${sessionId}, now() + interval '2 hours', ${sessionToken}, now(), now(), ${userId}
    )
  `;
}

function runEval() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "eve",
        "eval",
        "memory/automatic-recall-live",
        "--url",
        targetUrl,
        "--strict",
        "--verbose",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          EVAL_MEMORY_ALLOW_FORGET_ALL: "true",
          EVAL_MEMORY_BETTER_AUTH_COOKIE: cookie,
          EVAL_MEMORY_EXPECTED_USER_ID: userId,
        },
      },
    );
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
}

await provisionEvalAccount();
let exitCode = 1;
try {
  exitCode = await runEval();
}
finally {
  await sql`DELETE FROM "user" WHERE "id" = ${userId}`;
}

process.exitCode = exitCode;
