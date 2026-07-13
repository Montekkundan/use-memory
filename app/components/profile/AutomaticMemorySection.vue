<script setup lang="ts">
const {
  settings,
  pending,
  error,
  setEnabled,
  searchResults,
  searchPending,
  search,
  deleteMemory,
  forgetAll,
} = useAutomaticMemory();

const query = ref("");
const savingConsent = ref(false);
const deletingId = ref<string | null>(null);
const forgetOpen = ref(false);
const forgetting = ref(false);
const hasSearched = ref(false);
const toast = useToast();

async function handleConsent(enabled: boolean) {
  if (savingConsent.value) return;
  savingConsent.value = true;
  try {
    await setEnabled(enabled);
    toast.add({
      title: enabled ? "Automatic memory enabled" : "Automatic memory paused",
      description: enabled
        ? "New conversations can now be remembered by Mem0."
        : "No new conversations will be recalled or saved.",
      color: "neutral",
    });
  }
  catch {
    toast.add({ title: "Could not update automatic memory", color: "error" });
  }
  finally {
    savingConsent.value = false;
  }
}

async function handleSearch() {
  const value = query.value.trim();
  if (!value || searchPending.value) return;
  try {
    await search(value);
    hasSearched.value = true;
  }
  catch {
    toast.add({ title: "Could not search memories", color: "error" });
  }
}

async function handleDelete(id: string) {
  deletingId.value = id;
  try {
    await deleteMemory(id);
    toast.add({ title: "Memory forgotten", color: "neutral" });
  }
  catch {
    toast.add({ title: "Could not forget memory", color: "error" });
  }
  finally {
    deletingId.value = null;
  }
}

async function handleForgetAll() {
  forgetting.value = true;
  try {
    await forgetAll();
    hasSearched.value = false;
    forgetOpen.value = false;
    toast.add({ title: "All automatic memories forgotten", color: "neutral" });
  }
  catch {
    toast.add({ title: "Could not forget automatic memories", color: "error" });
  }
  finally {
    forgetting.value = false;
  }
}
</script>

<template>
  <section>
    <SettingsSection
      title="Automatic memory"
      description="Mem0 recalls useful facts from conversations across every linked channel."
    >
      <div
        v-if="pending"
        class="px-4 py-4 sm:px-5"
      >
        <USkeleton class="h-12 rounded-md" />
      </div>

      <div
        v-else-if="error"
        class="px-4 py-3 sm:px-5"
      >
        <UAlert
          color="error"
          variant="subtle"
          title="Automatic memory is unavailable"
          :description="error.message"
        />
      </div>

      <template v-else>
        <SettingsRow
          inline
          label="Remember conversations"
          description="When enabled, conversation pairs are sent to Mem0 so relevant facts can be recalled later. Secrets, OAuth tokens, and verification codes are excluded."
        >
          <USwitch
            :model-value="settings.enabled"
            :loading="savingConsent"
            aria-label="Remember conversations"
            @update:model-value="handleConsent"
          />
        </SettingsRow>

        <div class="px-4 py-4 sm:px-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm text-highlighted">
                Search automatic memory
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Search and remove inferred facts. Curated profile memory above is unchanged.
              </p>
            </div>
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              @click="() => { forgetOpen = true }"
            >
              Forget all
            </UButton>
          </div>

          <form
            class="flex gap-2"
            @submit.prevent="handleSearch"
          >
            <UInput
              v-model="query"
              class="min-w-0 flex-1"
              icon="i-lucide-search"
              placeholder="Search remembered preferences or context…"
            />
            <UButton
              type="submit"
              color="neutral"
              :loading="searchPending"
              :disabled="!query.trim()"
            >
              Search
            </UButton>
          </form>

          <div
            v-if="searchResults.length"
            class="mt-4 divide-y divide-default rounded-md border border-default"
          >
            <div
              v-for="memory in searchResults"
              :key="memory.id"
              class="flex items-start gap-3 px-3 py-2.5"
            >
              <p class="min-w-0 flex-1 text-sm leading-relaxed text-toned">
                {{ memory.memory }}
              </p>
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                :loading="deletingId === memory.id"
                :aria-label="`Forget: ${memory.memory}`"
                @click="handleDelete(memory.id)"
              />
            </div>
          </div>

          <p
            v-else-if="hasSearched && !searchPending"
            class="mt-4 text-center text-xs text-muted"
          >
            No matching memories.
          </p>
        </div>
      </template>
    </SettingsSection>

    <UModal
      v-model:open="forgetOpen"
      title="Forget all automatic memories?"
      description="This permanently deletes every Mem0 memory for your account. Curated profile memory is not affected."
    >
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="() => { forgetOpen = false }"
        />
        <UButton
          color="error"
          label="Forget all"
          :loading="forgetting"
          @click="handleForgetAll"
        />
      </template>
    </UModal>
  </section>
</template>
