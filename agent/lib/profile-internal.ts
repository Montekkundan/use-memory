import type { EditableProfilePatch } from "../../shared/profile-schema.js";
import {
  internalProfileUpdateResponseSchema,
} from "../../shared/profile-schema.js";
import { appOrigin, internalHeaders } from "./internal-api.js";

export async function updateProfileRemote(input: {
  userId: string;
  patch: EditableProfilePatch;
}) {
  const response = await fetch(`${appOrigin()}/api/internal/profile`, {
    method: "PATCH",
    headers: internalHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to update profile");
  }

  return internalProfileUpdateResponseSchema.parse(await response.json());
}
