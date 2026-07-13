import { createHash } from "node:crypto";
import { getToken, UserAuthorizationRequiredError } from "@vercel/connect";
import { Sandbox } from "@vercel/sandbox";
import { defineDynamic, defineTool } from "eve/tools";
import { CONNECT_USER_ISSUER, GITHUB_CONNECTOR } from "../../shared/connect.js";
import { errorKind, logEvent, opaqueReference } from "../../shared/observability.js";
import {
  redactSandboxOutput,
  SANDBOX_RUNTIME,
  SANDBOX_TIMEOUT_MS,
  SANDBOX_VCPUS,
  sandboxCwd,
  sandboxRepositoryInputSchema,
  sandboxRepositoryOutputSchema,
  truncateSandboxOutput,
} from "../lib/sandbox.js";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const auth = ctx.session.auth.current;
      const userId = auth?.principalId;
      if (!userId || userId.startsWith("eve:")) return {};
      const issuer = auth.issuer ?? auth.authenticator ?? CONNECT_USER_ISSUER;

      return {
        sandbox_repository: defineTool({
          description:
            "Run an explicitly requested coding task against one connected GitHub repository in a fresh app-owned Vercel Sandbox. Uses 1 vCPU, stops after five minutes, never persists the VM, and returns command output plus the resulting git diff. It cannot push or open a pull request.",
          inputSchema: sandboxRepositoryInputSchema,
          outputSchema: sandboxRepositoryOutputSchema,
          async execute({ repository, revision, commands, stopOnFailure }) {
            const startedAt = Date.now();
            const fields = {
              userRef: opaqueReference(userId),
              repositoryRef: opaqueReference(repository.toLowerCase()),
            };
            let sandbox: Sandbox | undefined;
            let token = "";

            try {
              token = await getToken(GITHUB_CONNECTOR, {
                subject: { type: "user", id: userId, issuer },
                authorizationDetails: [{
                  type: "github_app_installation",
                  repositories: [repository],
                  permissions: ["contents:read"],
                }],
              });

              sandbox = await Sandbox.create({
                runtime: SANDBOX_RUNTIME,
                resources: { vcpus: SANDBOX_VCPUS },
                timeout: SANDBOX_TIMEOUT_MS,
                persistent: false,
                source: {
                  type: "git",
                  url: `https://github.com/${repository}.git`,
                  username: "x-access-token",
                  password: token,
                  depth: 1,
                  ...(revision ? { revision } : {}),
                },
                tags: {
                  app: "use-memory",
                  user: createHash("sha256").update(userId).digest("hex").slice(0, 16),
                  repo: createHash("sha256").update(repository).digest("hex").slice(0, 16),
                },
              });

              await sandbox.runCommand("git", [
                "remote",
                "set-url",
                "origin",
                `https://github.com/${repository}.git`,
              ]);

              const results = [];
              let outputTruncated = false;
              for (const command of commands) {
                const result = await sandbox.runCommand({
                  cmd: command.cmd,
                  args: command.args,
                  cwd: sandboxCwd(command.cwd),
                });
                const stdoutResult = truncateSandboxOutput(
                  redactSandboxOutput(await result.stdout(), [token]),
                  8_000,
                );
                const stderrResult = truncateSandboxOutput(
                  redactSandboxOutput(await result.stderr(), [token]),
                  8_000,
                );
                outputTruncated ||= stdoutResult.truncated || stderrResult.truncated;
                results.push({
                  command: [command.cmd, ...command.args].join(" "),
                  exitCode: result.exitCode,
                  stdout: stdoutResult.text,
                  stderr: stderrResult.text,
                });
                if (stopOnFailure && result.exitCode !== 0) break;
              }

              const statusResult = await sandbox.runCommand("git", ["status", "--short"]);
              await sandbox.runCommand("git", ["add", "-N", "."]);
              const diffResult = await sandbox.runCommand("git", [
                "diff",
                "--no-ext-diff",
                "--unified=3",
                "--",
              ]);
              const statusOutput = truncateSandboxOutput(
                redactSandboxOutput(await statusResult.stdout(), [token]),
                8_000,
              );
              const diffOutput = truncateSandboxOutput(
                redactSandboxOutput(await diffResult.stdout(), [token]),
                24_000,
              );
              outputTruncated ||= statusOutput.truncated || diffOutput.truncated;

              logEvent("info", "sandbox.repository.completed", {
                ...fields,
                commandCount: results.length,
                durationMs: Date.now() - startedAt,
              });
              return {
                repository,
                commands: results,
                status: statusOutput.text,
                diff: diffOutput.text,
                outputTruncated,
              };
            }
            catch (error) {
              logEvent("error", "sandbox.repository.failed", {
                ...fields,
                errorKind: errorKind(error),
                durationMs: Date.now() - startedAt,
              });
              if (error instanceof UserAuthorizationRequiredError) {
                throw new Error("Connect GitHub before starting a coding sandbox");
              }
              throw error;
            }
            finally {
              token = "";
              await sandbox?.stop().catch(() => undefined);
            }
          },
        }),
      };
    },
  },
});
