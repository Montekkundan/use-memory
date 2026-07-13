<script setup lang="ts">
const { connectors, error, refresh, isInitialLoad, pending } = useConnectors();
const route = useRoute();
const confirmationSent = ref(false);

watch([connectors, pending], async () => {
  if (confirmationSent.value || pending.value) return;
  const connected = typeof route.query.connected === "string" ? route.query.connected : "";
  if (connected !== 'github') return;
  const connector = connectors.value?.find(item => item.id === connected);
  if (connector?.status.state !== "connected") return;

  confirmationSent.value = true;
  await $fetch(`/api/integrations/${connected}/notify`, { method: "POST" }).catch(() => undefined);
}, { immediate: true });

const connectedCount = computed(
  () => connectors.value?.filter(connector => connector.status.state === "connected").length ?? 0,
);

const totalCount = computed(() => connectors.value?.length ?? 0);

const servicesDescription = computed(() => {
  if (isInitialLoad.value || error.value) {
    return "GitHub tools are available in web chat and iMessage once linked.";
  }
  return `${connectedCount.value} of ${totalCount.value} connected · GitHub tools are available in web chat and iMessage once linked.`;
});
</script>

<template>
  <UDashboardPanel
    id="integrations"
    class="min-h-0"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <Navbar />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-2xl px-6 py-8">
        <header class="mb-8">
          <h1 class="mb-1 text-lg font-medium text-highlighted">
            Settings
          </h1>
          <p class="max-w-lg text-sm text-muted">
            Manage your identity, memory, and integrations.
          </p>
        </header>

        <SettingsNav class="mb-8" />

        <div class="space-y-8">
          <SettingsSection
            title="GitHub"
            :description="servicesDescription"
          >
            <template #default>
              <div
                v-if="isInitialLoad"
                class="px-4 py-3"
              >
                <USkeleton class="h-12 rounded-md" />
              </div>

              <div
                v-else-if="error"
                class="px-4 py-3"
              >
                <UAlert
                  color="error"
                  variant="subtle"
                  title="Failed to load services"
                  :description="error.message"
                />
              </div>

              <template v-else>
                <IntegrationsConnectorCard
                  v-for="connector in connectors"
                  :key="connector.id"
                  :connector="connector"
                  @refresh="refresh()"
                />
              </template>
            </template>

            <template #actions>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-refresh-cw"
                :loading="pending"
                aria-label="Refresh services"
                @click="refresh()"
              />
            </template>
          </SettingsSection>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
