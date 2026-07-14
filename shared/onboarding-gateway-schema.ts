import { z } from "zod";

export const onboardingGatewayRequestSchema = z.strictObject({
  attachments: z.array(z.strictObject({
    mimeType: z.string().optional(),
    name: z.string().optional(),
    type: z.enum(["audio", "file", "image", "video"]),
  })).optional(),
  interaction: z.strictObject({
    kind: z.literal("consent"),
    value: z.enum(["yes", "no"]),
  }).optional(),
  messageId: z.string().trim().min(1).optional(),
  phoneNumber: z.string().trim().min(1),
  text: z.string(),
  threadId: z.string().trim().min(1),
});

export type OnboardingGatewayRequest = z.infer<typeof onboardingGatewayRequestSchema>;
