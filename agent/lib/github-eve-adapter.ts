import {
  createGithubTools,
  GITHUB_WRITE_TOOLS,
  type ApprovalConfig,
  type GithubWriteToolName,
} from "@github-tools/sdk";
import {
  defineTool,
  type ToolDefinition,
  type ToolModelOutput,
} from "eve/tools";
import { always, never } from "eve/tools/approval";

type GithubSdkTool = {
  description?: string | ((options: unknown) => string);
  execute?: (
    input: Record<string, unknown>,
    options: {
      abortSignal?: AbortSignal;
      context: undefined;
      messages: [];
      toolCallId: string;
    },
  ) => unknown;
  inputSchema: ToolDefinition<Record<string, unknown>, unknown>["inputSchema"];
  toModelOutput?: (options: {
    input: Record<string, unknown>;
    output: unknown;
    toolCallId: string;
  }) => unknown;
};

const WRITE_TOOL_NAMES = new Set<string>(Object.values(GITHUB_WRITE_TOOLS));

function approvalForTool(name: string, config: ApprovalConfig | undefined) {
  if (!WRITE_TOOL_NAMES.has(name)) {
    return undefined;
  }

  if (config === false) {
    return never();
  }

  if (config === true || config === undefined) {
    return always();
  }

  const requiresApproval = config[name as GithubWriteToolName] ?? true;
  return requiresApproval ? always() : never();
}

/**
 * Adapts the SDK's statically imported AI SDK tools to Eve definitions.
 *
 * The upstream `@github-tools/sdk/eve` adapter discovers `eve/tools` with a
 * runtime `require()`. Nitro bundles Eve into the Vercel function instead of
 * leaving it in `node_modules`, so that lookup fails only after deployment.
 * Keeping both imports static makes the same tools available in bundled
 * runtimes while preserving Eve-native approval handling.
 */
export function buildBundledEveGithubToolMap(options: {
  requireApproval?: ApprovalConfig;
  token: string;
}) {
  const githubTools = createGithubTools({
    preset: "maintainer",
    requireApproval: false,
    token: options.token,
  });
  const tools: Record<string, ToolDefinition<Record<string, unknown>, unknown>> = {};

  for (const [name, rawTool] of Object.entries(githubTools)) {
    const tool = rawTool as GithubSdkTool;
    if (typeof tool.description !== "string" || typeof tool.execute !== "function") {
      throw new TypeError(`GitHub tool ${name} is not executable`);
    }

    tools[name] = defineTool({
      approval: approvalForTool(name, options.requireApproval),
      description: tool.description,
      inputSchema: tool.inputSchema,
      async execute(input, ctx) {
        return await tool.execute?.(input, {
          abortSignal: ctx.abortSignal,
          context: undefined,
          messages: [],
          toolCallId: ctx.callId,
        });
      },
      ...(tool.toModelOutput
        ? {
            async toModelOutput(output: unknown) {
              return await tool.toModelOutput?.({
                input: {},
                output,
                toolCallId: "",
              }) as ToolModelOutput;
            },
          }
        : {}),
    });
  }

  return tools;
}
