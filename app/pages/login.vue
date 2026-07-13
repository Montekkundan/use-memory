<script setup lang="ts">
import { authClient } from "~/lib/auth-client";

definePageMeta({
  layout: false,
  prerender: true,
});

const route = useRoute();
type LoginStep = "phone" | "code" | "setup-email" | "recovery" | "email-sent";

const step = ref<LoginStep>("phone");
const phoneNumber = ref("");
const code = ref("");
const email = ref("");
const error = ref("");
const loading = ref(false);
const emailPurpose = ref<"setup" | "recovery">("recovery");

const highlights = [
  { icon: "i-lucide-message-square", label: "Web chat" },
  { icon: "i-lucide-smartphone", label: "iMessage" },
  { icon: "i-simple-icons-slack", label: "Slack" },
  { icon: "i-simple-icons-linear", label: "Linear" },
  { icon: "i-lucide-brain", label: "Long-term memory" },
];

const redirectTo = computed(() => {
  const value = route.query.redirect;
  return typeof value === "string" && value.startsWith("/") ? value : "/home";
});

const cardTitle = computed(() => ({
  phone: "Continue with your phone",
  code: "Enter your code",
  "setup-email": "Add a recovery email",
  recovery: "Recover with email",
  "email-sent": "Check your email",
})[step.value]);

function showStep(next: LoginStep) {
  error.value = "";
  step.value = next;
}

async function sendPhoneCode() {
  if (!phoneNumber.value) return;
  error.value = "";
  loading.value = true;

  try {
    const result = await authClient.phoneNumber.sendOtp({
      phoneNumber: phoneNumber.value,
    });

    if (result.error) {
      error.value = result.error.message ?? "Could not send the verification code.";
      return;
    }

    code.value = "";
    showStep("code");
  }
  finally {
    loading.value = false;
  }
}

async function verifyPhoneCode() {
  if (code.value.length !== 6) return;
  error.value = "";
  loading.value = true;

  try {
    const result = await authClient.phoneNumber.verify({
      phoneNumber: phoneNumber.value,
      code: code.value,
    });

    if (result.error) {
      error.value = result.error.message ?? "That code is invalid or expired.";
      return;
    }

    const accountEmail = result.data?.user.email ?? "";
    if (accountEmail.endsWith("@phone.use-memory.invalid")) {
      email.value = "";
      showStep("setup-email");
      return;
    }

    await navigateTo(redirectTo.value);
  }
  finally {
    loading.value = false;
  }
}

async function requestRecoveryEmailSetup() {
  error.value = "";
  loading.value = true;

  try {
    const result = await authClient.changeEmail({
      newEmail: email.value,
      callbackURL: redirectTo.value,
    });

    if (result.error) {
      error.value = result.error.message ?? "Could not send the verification email.";
      return;
    }

    emailPurpose.value = "setup";
    showStep("email-sent");
  }
  finally {
    loading.value = false;
  }
}

async function requestRecoveryLink() {
  error.value = "";
  loading.value = true;

  try {
    const result = await authClient.signIn.magicLink({
      email: email.value,
      callbackURL: redirectTo.value,
    });

    if (result.error) {
      error.value = result.error.message ?? "Could not send the recovery link.";
      return;
    }

    emailPurpose.value = "recovery";
    showStep("email-sent");
  }
  finally {
    loading.value = false;
  }
}

async function skipRecoveryEmail() {
  await navigateTo(redirectTo.value);
}
</script>

<template>
  <div class="flex min-h-svh flex-col bg-default text-default lg:flex-row">
    <section class="flex flex-1 items-center justify-center border-b border-default px-6 py-10 lg:border-b-0 lg:border-e lg:px-12 lg:py-8">
      <div class="w-full max-w-sm">
        <UCard class="w-full">
          <template #header>
            <h2 class="text-lg font-semibold text-highlighted">
              {{ cardTitle }}
            </h2>
          </template>

          <form
            v-if="step === 'phone'"
            class="space-y-4"
            @submit.prevent="sendPhoneCode"
          >
            <p class="text-sm text-muted">
              We will send a six-digit sign-in code over iMessage.
            </p>

            <UFormField label="Phone number">
              <ProfilePhoneInput
                v-model="phoneNumber"
                default-country="US"
                size="md"
              />
            </UFormField>

            <p v-if="error" class="text-sm text-error">
              {{ error }}
            </p>

            <UButton
              type="submit"
              block
              color="neutral"
              :disabled="!phoneNumber"
              :loading="loading"
            >
              Send code
            </UButton>
          </form>

          <form
            v-else-if="step === 'code'"
            class="space-y-4"
            @submit.prevent="verifyPhoneCode"
          >
            <p class="text-sm text-muted">
              Enter the code sent to {{ phoneNumber }}.
            </p>

            <UFormField label="Verification code">
              <UInput
                v-model="code"
                class="w-full"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                required
                maxlength="6"
                pattern="[0-9]{6}"
                placeholder="123456"
              />
            </UFormField>

            <p v-if="error" class="text-sm text-error">
              {{ error }}
            </p>

            <UButton
              type="submit"
              block
              color="neutral"
              :disabled="code.length !== 6"
              :loading="loading"
            >
              Verify and continue
            </UButton>

            <div class="flex justify-between gap-3 text-sm">
              <button type="button" class="text-muted hover:text-highlighted" @click="showStep('phone')">
                Change number
              </button>
              <button type="button" class="text-muted hover:text-highlighted" :disabled="loading" @click="sendPhoneCode">
                Send a new code
              </button>
            </div>
          </form>

          <form
            v-else-if="step === 'setup-email' || step === 'recovery'"
            class="space-y-4"
            @submit.prevent="step === 'setup-email' ? requestRecoveryEmailSetup() : requestRecoveryLink()"
          >
            <p class="text-sm text-muted">
              {{
                step === "setup-email"
                  ? "Use this only if you lose access to your phone. We will verify it before saving it."
                  : "We will email a short-lived, one-time sign-in link if this address belongs to an account."
              }}
            </p>

            <UFormField label="Recovery email">
              <UInput
                v-model="email"
                class="w-full"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
              />
            </UFormField>

            <p
              v-if="error"
              class="text-sm text-error"
            >
              {{ error }}
            </p>

            <UButton
              type="submit"
              block
              color="neutral"
              :loading="loading"
            >
              {{ step === "setup-email" ? "Verify recovery email" : "Email me a sign-in link" }}
            </UButton>

            <UButton
              v-if="step === 'setup-email'"
              type="button"
              block
              color="neutral"
              variant="ghost"
              @click="skipRecoveryEmail"
            >
              Skip for now
            </UButton>
          </form>

          <div v-else class="space-y-4">
            <p class="text-sm text-muted">
              {{
                emailPurpose === "setup"
                  ? `Open the verification link sent to ${email}. It will finish setup and bring you into the app.`
                  : `If ${email} belongs to an account, a short-lived sign-in link is on its way.`
              }}
            </p>
          </div>

          <template #footer>
            <p class="text-center text-sm text-muted">
              <button
                v-if="step === 'phone'"
                type="button"
                class="text-highlighted hover:underline"
                @click="showStep('recovery')"
              >
                Lost access to your phone? Use recovery email
              </button>
              <button
                v-else-if="step === 'recovery' || (step === 'email-sent' && emailPurpose === 'recovery')"
                type="button"
                class="text-highlighted hover:underline"
                @click="showStep('phone')"
              >
                Back to phone sign in
              </button>
            </p>
          </template>
        </UCard>
      </div>
    </section>

    <section class="relative flex flex-1 flex-col px-6 py-6 sm:px-8 lg:px-12 lg:py-8 hero-glow">
      <header class="flex justify-end">
        <UColorModeButton
          color="neutral"
          variant="ghost"
        />
      </header>

      <div class="flex flex-1 flex-col justify-center py-10 lg:py-16">
        <div class="max-w-md space-y-5">
          <div class="space-y-3">
            <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
              Use Memory
            </h1>
            <p class="text-sm leading-relaxed text-muted sm:text-base">
              A durable AI assistant with long-term memory. Chat on the web, Slack, or iMessage — query Linear and pick up where you left off.
            </p>
          </div>

          <ul class="flex flex-wrap gap-x-5 gap-y-2">
            <li
              v-for="item in highlights"
              :key="item.label"
              class="flex items-center gap-1.5 text-xs text-toned"
            >
              <UIcon
                :name="item.icon"
                class="size-3.5 shrink-0"
              />
              {{ item.label }}
            </li>
          </ul>
        </div>
      </div>

    </section>
  </div>
</template>
