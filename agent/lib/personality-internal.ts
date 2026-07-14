import type { PersonalityPatch } from "../../shared/personality-schema.js";
import { internalPersonalityUpdateResponseSchema } from "../../shared/personality-schema.js";
import { appOrigin, internalHeaders } from "./internal-api.js";

export async function updatePersonalityRemote(input: {
  userId: string;
  patch: PersonalityPatch;
}) {
  const response = await fetch(`${appOrigin()}/api/internal/personality`, {
    method: "PATCH",
    headers: internalHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to update personality");
  }

  return internalPersonalityUpdateResponseSchema.parse(await response.json());
}
