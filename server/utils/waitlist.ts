import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@nuxthub/db";
import type { WaitlistEntry, WaitlistPlatform } from "#shared/types/waitlist";
import { normalizeWaitlistSubmission } from "#shared/waitlist";
import { waitlistEntries } from "~~/server/db/schema/waitlist";

type WaitlistRow = typeof waitlistEntries.$inferSelect;

function toEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    phoneNumber: row.phoneNumber,
    platform: row.platform as WaitlistPlatform,
    email: row.email,
    status: row.status as WaitlistEntry["status"],
    invitationAcceptedAt: row.invitationAcceptedAt?.toISOString() ?? null,
    invitedAt: row.invitedAt?.toISOString() ?? null,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    lastInvitationError: row.lastInvitationError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function joinWaitlist(input: {
  phoneNumber: string;
  platform: WaitlistPlatform;
  email?: string | null;
}) {
  const normalized = normalizeWaitlistSubmission(input);
  const [row] = await db.insert(waitlistEntries)
    .values({
      id: randomUUID(),
      ...normalized,
    })
    .onConflictDoUpdate({
      target: waitlistEntries.phoneNumber,
      set: {
        platform: normalized.platform,
        email: normalized.email,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error("Waitlist entry was not saved");
  return toEntry(row);
}

export async function getWaitlistEntryByPhone(phoneNumber: string) {
  const normalized = normalizeWaitlistSubmission({
    phoneNumber,
    platform: "iphone",
  }).phoneNumber;
  const [row] = await db.select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.phoneNumber, normalized))
    .limit(1);
  return row ? toEntry(row) : null;
}

export async function isPhoneInvited(phoneNumber: string) {
  const entry = await getWaitlistEntryByPhone(phoneNumber);
  return entry?.status === "invited" || entry?.status === "claimed";
}

export async function listWaitlistEntries() {
  const rows = await db.select()
    .from(waitlistEntries)
    .orderBy(desc(waitlistEntries.createdAt));
  return rows.map(toEntry);
}

export async function getWaitlistEntry(id: string) {
  const [row] = await db.select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.id, id))
    .limit(1);
  return row ? toEntry(row) : null;
}

export async function grantWaitlistAccess(id: string) {
  const [row] = await db.update(waitlistEntries)
    .set({
      status: "invited",
      invitedAt: new Date(),
      lastInvitationError: null,
      updatedAt: new Date(),
    })
    .where(eq(waitlistEntries.id, id))
    .returning();
  return row ? toEntry(row) : null;
}

export async function recordWaitlistInvitationResult(
  id: string,
  result: { accepted: boolean; error?: string },
) {
  await db.update(waitlistEntries)
    .set({
      invitationAcceptedAt: result.accepted ? new Date() : null,
      lastInvitationError: result.accepted ? null : result.error?.slice(0, 500) || "Photon did not accept the message",
      updatedAt: new Date(),
    })
    .where(eq(waitlistEntries.id, id));
}

export async function markWaitlistClaimed(phoneNumber: string) {
  const normalized = normalizeWaitlistSubmission({
    phoneNumber,
    platform: "iphone",
  }).phoneNumber;
  await db.update(waitlistEntries)
    .set({
      status: "claimed",
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(waitlistEntries.phoneNumber, normalized));
}
