export interface AutomaticMemorySettings {
  enabled: boolean;
  consentedAt?: number;
}

export interface AutomaticMemoryResult {
  id: string;
  memory: string;
  score?: number;
  categories: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface SettingsResponse {
  settings: AutomaticMemorySettings;
}

interface SearchResponse {
  memories: AutomaticMemoryResult[];
}

export function useAutomaticMemory() {
  const { data, pending, error, refresh } = useFetch<SettingsResponse>("/api/mem0/settings", {
    key: "automatic-memory-settings",
    ...payloadCacheOptions,
  });
  const searchResults = ref<AutomaticMemoryResult[]>([]);
  const searchPending = ref(false);

  const settings = computed(() => data.value?.settings ?? { enabled: false });

  async function setEnabled(enabled: boolean) {
    const response = await $fetch<SettingsResponse>("/api/mem0/settings", {
      method: "PATCH",
      body: { enabled },
    });
    data.value = response;
    return response.settings;
  }

  async function search(query: string) {
    searchPending.value = true;
    try {
      const response = await $fetch<SearchResponse>("/api/mem0/search", {
        method: "POST",
        body: { query, limit: 8 },
      });
      searchResults.value = response.memories;
      return response.memories;
    }
    finally {
      searchPending.value = false;
    }
  }

  async function deleteMemory(id: string) {
    await $fetch(`/api/mem0/${encodeURIComponent(id)}`, { method: "DELETE" });
    searchResults.value = searchResults.value.filter(memory => memory.id !== id);
  }

  async function forgetAll() {
    await $fetch("/api/mem0/forget-all", { method: "DELETE" });
    searchResults.value = [];
  }

  return {
    settings,
    pending,
    error,
    refresh,
    setEnabled,
    searchResults,
    searchPending,
    search,
    deleteMemory,
    forgetAll,
  };
}
