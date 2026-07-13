import type { H3Event } from "h3";
import { eq } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import { requireSessionUserId } from "~~/server/utils/session";
import {
  isWaitlistAdminIdentity,
  waitlistAdminIdentifiers,
} from "~~/server/utils/waitlist-admin-identifiers";

export async function requireWaitlistAdmin(event: H3Event) {
  const userId = await requireSessionUserId(event);
  const identifiers = waitlistAdminIdentifiers();
  if (!identifiers.size) {
    throw createError({
      statusCode: 503,
      statusMessage: "Waitlist admin access is not configured",
    });
  }

  const [user] = await db.select({
    email: schema.user.email,
    emailVerified: schema.user.emailVerified,
    id: schema.user.id,
    phoneNumber: schema.user.phoneNumber,
    phoneNumberVerified: schema.user.phoneNumberVerified,
  })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!user || !isWaitlistAdminIdentity(user, identifiers)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  return userId;
}
