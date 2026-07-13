<script setup lang="ts">
import type { WaitlistEntry } from "#shared/types/waitlist";

definePageMeta({ middleware: "admin" });

const { data, error, pending, refresh } = await useFetch<{ entries: WaitlistEntry[] }>(
  "/api/admin/waitlist",
  { key: "admin-waitlist" },
);

const inviting = ref<string | null>(null);
const notice = ref("");

async function invite(entry: WaitlistEntry) {
  inviting.value = entry.id;
  notice.value = "";
  try {
    const result = await $fetch<{
      invitationAcceptedByPhoton: boolean;
      requestId: string;
    }>(`/api/admin/waitlist/${entry.id}/invite`, { method: "POST" });
    notice.value = result.invitationAcceptedByPhoton
      ? `Access granted and Photon accepted the message for ${entry.phoneNumber}. Trace: ${result.requestId}`
      : `Access granted for ${entry.phoneNumber}, but Photon did not accept the message. Trace: ${result.requestId}`;
    await refresh();
  }
  catch (cause) {
    const response = cause as { data?: { statusMessage?: string }; statusMessage?: string };
    notice.value = response.data?.statusMessage
      || response.statusMessage
      || "Could not grant access.";
  }
  finally {
    inviting.value = null;
  }
}
</script>

<template>
  <UDashboardPanel id="admin-waitlist">
    <template #header>
      <Navbar>
        <template #title>
          <span class="text-sm font-medium text-highlighted">Waitlist</span>
        </template>
      </Navbar>
    </template>

    <template #body>
      <UContainer class="w-full py-16 sm:py-20">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Private beta
            </p>
            <h1 class="mt-2 text-3xl font-semibold tracking-tight text-highlighted">
              Waitlist access
            </h1>
            <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Grant an iPhone entry to send the first Photon message. Android entries stay queued until an Android channel is configured.
            </p>
          </div>
          <UButton
            label="Refresh"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="pending"
            @click="refresh()"
          />
        </div>

        <UAlert
          v-if="notice"
          class="mt-6"
          color="neutral"
          variant="subtle"
          :description="notice"
          close
          @update:open="notice = ''"
        />

        <UAlert
          v-if="error"
          class="mt-6"
          color="error"
          variant="subtle"
          title="Waitlist is unavailable"
          :description="error.statusMessage || error.message"
        />

        <div v-else class="mt-8 overflow-hidden rounded-xl border border-default bg-default">
          <div v-if="pending && !data" class="p-8 text-center text-sm text-muted">
            Loading waitlist…
          </div>
          <div v-else-if="!data?.entries.length" class="p-8 text-center text-sm text-muted">
            No one has joined yet.
          </div>
          <ul v-else class="divide-y divide-default">
            <li
              v-for="entry in data.entries"
              :key="entry.id"
              class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-sm text-highlighted">{{ entry.phoneNumber }}</span>
                  <UBadge color="neutral" variant="subtle" size="sm">
                    {{ entry.platform === "iphone" ? "iPhone" : "Android" }}
                  </UBadge>
                  <UBadge
                    :color="entry.status === 'claimed' ? 'success' : entry.status === 'invited' ? 'info' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ entry.status }}
                  </UBadge>
                </div>
                <p v-if="entry.email" class="mt-1 text-xs text-muted">
                  {{ entry.email }}
                </p>
                <p v-if="entry.lastInvitationError" class="mt-2 text-xs text-error">
                  {{ entry.lastInvitationError }}
                </p>
                <p class="mt-2 text-xs text-dimmed">
                  Joined {{ new Date(entry.createdAt).toLocaleString() }}
                </p>
              </div>

              <UButton
                v-if="entry.platform === 'iphone' && entry.status !== 'claimed'"
                :label="entry.status === 'invited' ? 'Send again' : 'Grant access'"
                color="neutral"
                :variant="entry.status === 'invited' ? 'outline' : 'solid'"
                :loading="inviting === entry.id"
                @click="invite(entry)"
              />
              <span v-else-if="entry.platform === 'android'" class="text-xs text-muted">
                Android channel needed
              </span>
            </li>
          </ul>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
