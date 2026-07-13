import { z } from "zod";

export const SANDBOX_RUNTIME = "node24";
export const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000;
export const SANDBOX_VCPUS = 1;

const ALLOWED_COMMANDS = [
  "bun",
  "bunx",
  "cargo",
  "cat",
  "cmake",
  "deno",
  "find",
  "git",
  "go",
  "head",
  "ls",
  "make",
  "node",
  "npm",
  "npx",
  "pnpm",
  "pnpx",
  "pwd",
  "pytest",
  "python",
  "python3",
  "rg",
  "tail",
  "uv",
  "wc",
] as const;

export const sandboxCommandSchema = z.strictObject({
  cmd: z.enum(ALLOWED_COMMANDS),
  args: z.array(z.string().max(4_000)).max(100).default([]),
  cwd: z.string().trim().min(1).max(240).optional().refine(
    value => value === undefined
      || (!value.startsWith("/") && !value.split("/").includes("..")),
    "cwd must stay inside the checked-out repository",
  ),
});

export const sandboxRepositoryInputSchema = z.strictObject({
  repository: z.string().trim().regex(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    "repository must use owner/name format",
  ),
  revision: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().min(1).max(500),
  commands: z.array(sandboxCommandSchema).min(1).max(8),
  stopOnFailure: z.boolean().default(true),
}).refine(
  input => JSON.stringify(input.commands).length <= 40_000,
  "command batch is too large",
);

export const sandboxRepositoryOutputSchema = z.strictObject({
  repository: z.string(),
  commands: z.array(z.strictObject({
    command: z.string(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
  })),
  status: z.string(),
  diff: z.string(),
  outputTruncated: z.boolean(),
});

export type SandboxRepositoryInput = z.infer<typeof sandboxRepositoryInputSchema>;

export function sandboxCwd(cwd?: string) {
  return cwd ? `/vercel/sandbox/${cwd}` : "/vercel/sandbox";
}

export function truncateSandboxOutput(value: string, maxLength: number) {
  if (value.length <= maxLength) return { text: value, truncated: false };
  return {
    text: `${value.slice(0, maxLength)}\n… output truncated …`,
    truncated: true,
  };
}

export function redactSandboxOutput(value: string, secrets: string[]) {
  let redacted = value
    .replace(/:\/\/[^\s/@:]+:[^\s/@]+@/gu, "://[redacted]@")
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/gu, "[redacted-github-token]")
    .replace(/\bgh[opsu]_[A-Za-z0-9_]+\b/gu, "[redacted-github-token]");

  for (const secret of secrets) {
    if (secret) redacted = redacted.replaceAll(secret, "[redacted]");
  }
  return redacted;
}
