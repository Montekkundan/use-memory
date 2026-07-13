import { and, eq } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import type { PhoneLinkRecord } from "#shared/types/phone-link";
import { normalizeE164 } from "#shared/phone";

export function normalizePhoneNumber(value: string) {
  try {
    return normalizeE164(value);
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Phone number must be in E.164 format (e.g. +33612345678)",
    });
  }
}

function rowToRecord(row: typeof schema.user.$inferSelect): PhoneLinkRecord | undefined {
  if (!row.phoneNumber || !row.phoneNumberVerified) {
    return undefined;
  }

  return {
    appUserId: row.id,
    phoneNumber: row.phoneNumber,
    linkedAt: (row.phoneNumberVerifiedAt ?? row.updatedAt).toISOString(),
  };
}

export async function getPhoneLinkForAppUser(appUserId: string) {
  const [row] = await db.select()
    .from(schema.user)
    .where(and(
      eq(schema.user.id, appUserId),
      eq(schema.user.phoneNumberVerified, true),
    ))
    .limit(1);

  return row ? rowToRecord(row) : undefined;
}

export async function getPhoneLinkByPhoneNumber(phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber);

  const [row] = await db.select()
    .from(schema.user)
    .where(and(
      eq(schema.user.phoneNumber, normalized),
      eq(schema.user.phoneNumberVerified, true),
    ))
    .limit(1);

  return row ? rowToRecord(row) : undefined;
}
