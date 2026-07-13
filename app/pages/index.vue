<script setup lang="ts">
import emptyRoomSrc from "~/assets/figures/empty-room.png";
import type { WaitlistPlatform } from "#shared/types/waitlist";

definePageMeta({
  layout: false,
  prerender: true,
});

useSeoMeta({
  title: "Use Memory — your personal agent in Messages",
  description: "Join the private beta for a personal AI agent that remembers what matters and lives in Messages.",
});

type State = "intro" | "form" | "success";

const state = ref<State>("intro");
const platform = ref<WaitlistPlatform>("iphone");
const phoneNumber = ref("");
const email = ref("");
const loading = ref(false);
const error = ref("");
const activity = ref(0);
const platformOptions = [
  { value: "iphone" as const, label: "iPhone" },
  { value: "android" as const, label: "Android" },
];

const buttonLabel = computed(() => platform.value === "iphone"
  ? "Join the iMessage waitlist"
  : "Join the Android waitlist");

function registerActivity() {
  activity.value += 1;
}

async function submitWaitlist() {
  error.value = "";
  loading.value = true;
  registerActivity();

  try {
    await $fetch("/api/waitlist", {
      method: "POST",
      body: {
        phoneNumber: phoneNumber.value,
        platform: platform.value,
        email: email.value || null,
      },
    });
    state.value = "success";
  }
  catch (cause) {
    const response = cause as { data?: { statusMessage?: string }; statusMessage?: string };
    error.value = response.data?.statusMessage
      || response.statusMessage
      || "We could not save your spot. Check your details and try again.";
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="relative h-dvh min-h-[640px] w-dvw overflow-hidden bg-[#0b0b0c] text-white">
    <ParticleField
      class="absolute inset-0"
      :src="emptyRoomSrc"
      :activity="activity"
      :sample-step="3"
      :threshold="38"
      :dot-size="0.95"
      :render-scale="0.82"
      :vertical-offset="-0.18"
    />

    <NuxtLink
      to="/login"
      class="absolute right-5 top-5 z-20 text-xs text-white/35 transition hover:text-white/70 sm:right-7 sm:top-7"
    >
      Sign in
    </NuxtLink>

    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0"
      style="background: radial-gradient(1200px 800px at 50% 55%, transparent 40%, color-mix(in srgb, #0b0b0c 85%, transparent) 95%);"
    />
    <div
      aria-hidden="true"
      class="scene-fade pointer-events-none absolute inset-x-0 bottom-0 h-[50%]"
      :class="state === 'intro' ? 'opacity-100' : 'opacity-0'"
      style="background: linear-gradient(to bottom, transparent 0%, color-mix(in srgb, #0b0b0c 55%, transparent) 38%, color-mix(in srgb, #0b0b0c 88%, transparent) 70%, #0b0b0c 100%);"
    />
    <div
      aria-hidden="true"
      class="scene-fade pointer-events-none absolute inset-x-0 bottom-0 h-[74%]"
      :class="state === 'intro' ? 'opacity-0' : 'opacity-100'"
      style="background: linear-gradient(to bottom, transparent 0%, color-mix(in srgb, #0b0b0c 82%, transparent) 25%, #0b0b0c 72%);"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]"
      style="background: radial-gradient(440px 240px at 50% 74%, color-mix(in srgb, #0b0b0c 88%, transparent) 0%, transparent 72%);"
    />

    <div class="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-5 pb-8 text-center sm:px-6 sm:pb-12">
      <div class="w-full max-w-lg">
        <div
          class="font-mono text-[10px] uppercase tracking-[0.32em] text-white/50 sm:text-[11px]"
          style="text-shadow: 0 1px 16px rgba(0, 0, 0, 0.7);"
        >
          Invite-only, for now
        </div>

        <h1
          class="mt-4 text-3xl font-normal leading-tight tracking-[-0.035em] text-white sm:text-4xl"
          style="text-shadow: 0 1px 24px rgba(0, 0, 0, 0.7);"
        >
          This room's full.
        </h1>

        <Transition name="waitlist-panel" mode="out-in">
          <div v-if="state === 'intro'" key="intro">
            <p
              class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60"
              style="text-shadow: 0 1px 16px rgba(0, 0, 0, 0.75);"
            >
              Join the waitlist. When you're in, Use Memory will text you and finish setup in Messages.
            </p>

            <div class="mt-6">
              <button
                type="button"
                class="waitlist-action inline-flex h-11 items-center justify-center rounded-lg bg-white px-6 text-sm font-medium text-black shadow-xl shadow-black/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                @click="state = 'form'"
              >
                Join the waitlist
              </button>
            </div>
          </div>

          <form
            v-else-if="state === 'form'"
            key="form"
            class="mx-auto mt-5 max-w-md rounded-2xl border border-white/10 bg-black/45 p-4 text-left shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-5"
            @submit.prevent="submitWaitlist"
          >
          <fieldset>
            <legend class="sr-only">
              Your phone
            </legend>
            <div class="grid grid-cols-2 rounded-lg bg-white/7 p-1">
              <button
                v-for="option in platformOptions"
                :key="option.value"
                type="button"
                class="waitlist-choice h-9 rounded-md text-sm"
                :class="platform === option.value ? 'bg-white text-black shadow-sm' : 'text-white/55'"
                @click="platform = option.value; registerActivity()"
              >
                {{ option.label }}
              </button>
            </div>
          </fieldset>

          <label class="mt-4 block text-xs font-medium text-white/60" for="waitlist-phone">
            Mobile number
          </label>
          <ProfilePhoneInput
            id="waitlist-phone"
            v-model="phoneNumber"
            class="mt-2"
            default-country="US"
            size="md"
            @keydown="registerActivity"
          />

          <Transition name="field-reveal" mode="out-in">
            <div v-if="platform === 'android'" key="android">
              <label class="mt-4 block text-xs font-medium text-white/60" for="waitlist-email">
                Email for Android access updates
              </label>
              <UInput
                id="waitlist-email"
                v-model="email"
                class="mt-2 w-full"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                required
                @keydown="registerActivity"
              />
              <p class="mt-2 text-xs leading-relaxed text-white/45">
                Photon is iMessage-first. We'll keep your spot and email you when the Android channel is ready.
              </p>
            </div>
            <p v-else key="iphone" class="mt-3 text-xs leading-relaxed text-white/45">
              If approved, Use Memory will iMessage this number. Reply START and the agent handles setup in the conversation.
            </p>
          </Transition>

          <p v-if="error" class="mt-3 text-xs text-red-300" role="alert">
            {{ error }}
          </p>

          <button
            type="submit"
            class="waitlist-action mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!phoneNumber || (platform === 'android' && !email) || loading"
          >
            {{ loading ? "Saving your spot…" : buttonLabel }}
          </button>

          <p class="mt-3 text-center text-[11px] leading-relaxed text-white/35">
            By joining, you agree that Use Memory may send one access message to this number.
          </p>

          <button
            type="button"
            class="waitlist-secondary mt-3 w-full text-center text-xs text-white/40"
            @click="state = 'intro'; error = ''"
          >
            Back
          </button>
          </form>

          <div
            v-else
            key="success"
            class="mx-auto mt-5 max-w-md rounded-2xl border border-white/10 bg-black/45 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            role="status"
          >
            <div class="mx-auto flex size-9 items-center justify-center rounded-full bg-white text-black">
              <UIcon name="i-lucide-check" class="size-4" />
            </div>
            <h2 class="mt-3 text-base font-medium text-white">
              You're on the list.
            </h2>
            <p class="mt-2 text-sm leading-relaxed text-white/55">
              <template v-if="platform === 'iphone'">
                When access opens, Use Memory will iMessage your number. Reply START to begin private, chat-only setup.
              </template>
              <template v-else>
                We saved your Android spot and email. We'll notify you when an Android conversation channel is available.
              </template>
            </p>
          </div>
        </Transition>
      </div>
    </div>
  </main>
</template>

<style scoped>
.scene-fade {
  transition: opacity 220ms ease-out;
}

.waitlist-panel-enter-active,
.waitlist-panel-leave-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.waitlist-panel-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
}

.waitlist-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
}

.field-reveal-enter-active,
.field-reveal-leave-active {
  transition: opacity 160ms ease-out, transform 160ms ease-out;
}

.field-reveal-enter-from,
.field-reveal-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.waitlist-action,
.waitlist-choice,
.waitlist-secondary {
  transition: color 140ms ease, background-color 140ms ease, opacity 140ms ease, transform 140ms ease;
}

.waitlist-action:active,
.waitlist-choice:active,
.waitlist-secondary:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .waitlist-action:hover {
    background-color: rgb(255 255 255 / 0.9);
  }

  .waitlist-choice:not(.bg-white):hover,
  .waitlist-secondary:hover {
    color: rgb(255 255 255 / 0.75);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene-fade,
  .waitlist-panel-enter-active,
  .waitlist-panel-leave-active,
  .field-reveal-enter-active,
  .field-reveal-leave-active,
  .waitlist-action,
  .waitlist-choice,
  .waitlist-secondary {
    transition: none;
  }
}
</style>
