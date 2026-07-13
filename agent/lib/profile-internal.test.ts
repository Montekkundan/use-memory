import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfileRemote } from "./profile-internal";

describe("profile internal client", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_URL", "https://use-memory.test");
    vi.stubEnv("INTERNAL_API_SECRET", "internal-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends only the authenticated user id and safe patch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      profile: {
        name: "Monte",
        bio: "Builder",
        timezone: "America/Toronto",
        language: "en",
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateProfileRemote({
      userId: "user-1",
      patch: { name: "Monte" },
    })).resolves.toEqual({
      profile: {
        name: "Monte",
        bio: "Builder",
        timezone: "America/Toronto",
        language: "en",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://use-memory.test/api/internal/profile", {
      method: "PATCH",
      headers: {
        authorization: "Bearer internal-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-1", patch: { name: "Monte" } }),
    });
  });

  it("refuses a response that includes email or phone data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      profile: {
        name: "Monte",
        bio: "Builder",
        timezone: "America/Toronto",
        language: "en",
        email: "monte@example.com",
      },
    }), { status: 200 })));

    await expect(updateProfileRemote({
      userId: "user-1",
      patch: { bio: "Builder" },
    })).rejects.toThrow();
  });

  it("surfaces a failed internal update without returning response data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      email: "monte@example.com",
    }), { status: 400 })));

    await expect(updateProfileRemote({
      userId: "user-1",
      patch: { name: "Monte" },
    })).rejects.toThrow("Failed to update profile");
  });
});
