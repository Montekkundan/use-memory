import { afterEach, describe, expect, it, vi } from "vitest";
import { getConnector } from "./connectors";

describe("GitHub connector test", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the per-user token to list repository names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { full_name: "Montekkundan/use-memory" },
      { full_name: "Montekkundan/vdex" },
    ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await getConnector("github").test.run("short-lived-user-token");

    expect(results).toEqual(["Montekkundan/use-memory", "Montekkundan/vdex"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user/repos?per_page=5",
      {
        headers: {
          Authorization: "Bearer short-lived-user-token",
          Accept: "application/vnd.github+json",
          "User-Agent": "use-memory",
        },
      },
    );
  });

  it("fails closed when GitHub rejects the token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(null, { status: 401, statusText: "Unauthorized" }),
    ));

    await expect(getConnector("github").test.run("expired-token"))
      .rejects.toThrow("GitHub API error: 401 Unauthorized");
  });
});
