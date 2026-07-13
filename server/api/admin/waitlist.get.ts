import { listWaitlistEntries } from "~~/server/utils/waitlist";
import { requireWaitlistAdmin } from "~~/server/utils/waitlist-admin";

export default defineEventHandler(async (event) => {
  await requireWaitlistAdmin(event);
  return { entries: await listWaitlistEntries() };
});
