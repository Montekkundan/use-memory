<script setup lang="ts">
const route = useRoute();
const error = ref("");

onMounted(async () => {
  const id = typeof route.params.id === "string" ? route.params.id : "";
  if (id !== 'github') {
    error.value = "This connection link is not supported.";
    return;
  }

  try {
    const { url } = await $fetch<{ url: string }>(`/api/integrations/${id}/connect`, {
      method: "POST",
    });
    await navigateTo(url, { external: true });
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not start authorization.";
  }
});
</script>

<template>
  <div class="flex min-h-svh items-center justify-center bg-default px-6 text-default">
    <UCard class="w-full max-w-md">
      <div class="flex items-center gap-3">
        <UIcon
          :name="error ? 'i-lucide-circle-alert' : 'i-lucide-loader-circle'"
          class="size-5"
          :class="{ 'animate-spin': !error }"
        />
        <div>
          <p class="font-medium text-highlighted">
            {{ error ? "Connection could not start" : "Opening secure authorization…" }}
          </p>
          <p class="mt-1 text-sm text-muted">
            {{ error || "You will return to use-memory when authorization is complete." }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
