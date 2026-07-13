<script setup lang="ts">
import { agent } from "~~/shared/agent";

defineProps<{
  size?: "sm" | "lg";
}>();
</script>

<template>
  <div
    v-if="size !== 'sm'"
    class="space-y-3 pb-2"
  >
    <div class="space-y-3">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
        {{ agent.name }}
      </h1>
      <p class="max-w-md text-sm leading-relaxed text-muted">
        {{ agent.description }}
      </p>
    </div>
  </div>

  <div
    v-else
    class="flex items-center gap-2.5"
  >
    <UIcon name="i-lucide-brain" class="size-3.5 text-highlighted" />
    <span class="text-sm font-semibold text-highlighted">
      {{ agent.name }}
    </span>
  </div>
</template>
