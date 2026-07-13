export const ONBOARDING_STEPS = [
  "verify_phone",
  "consent",
  "name",
  "timezone",
  "preferences",
  "interests",
  "integrations",
  "complete",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingSnapshot {
  appUserId: string | null;
  completedAt: number | null;
  consent: boolean;
  integrations: string[];
  interests: string[];
  name: string | null;
  phoneNumber: string;
  preferences: string[];
  step: OnboardingStep;
  threadId: string;
  timezone: string | null;
  updatedAt: number;
}

export interface OnboardingAttachmentInput {
  mimeType?: string;
  name?: string;
  type: "audio" | "file" | "image" | "video";
}

export interface OnboardingGatewayRequest {
  attachments?: OnboardingAttachmentInput[];
  interaction?: {
    kind: "consent";
    value: "yes" | "no";
  };
  messageId?: string;
  phoneNumber: string;
  text: string;
  threadId: string;
}

export interface OnboardingNativeChoice {
  callbackId: "use-memory-onboarding-consent";
  fieldId: "consent";
  options: Array<{ label: string; value: string }>;
  title: string;
}

export type OnboardingGatewayResponse =
  | {
      appUserId: string;
      kind: "ready";
      snapshot: OnboardingSnapshot | null;
    }
  | {
      kind: "prompt" | "complete";
      message: string;
      nativeChoice?: OnboardingNativeChoice;
      snapshot: OnboardingSnapshot | null;
    };
