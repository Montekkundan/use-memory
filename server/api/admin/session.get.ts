import { requireWaitlistAdmin } from "~~/server/utils/waitlist-admin";

export default defineEventHandler(async (event) => {
  await requireWaitlistAdmin(event);
  return { authorized: true };
});
