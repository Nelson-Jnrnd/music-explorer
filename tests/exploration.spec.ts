import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = (n: number) => n.toString().padStart(22, "0");
const csv =
  "Track URI,Track Name,Artist Name(s),Album Name,Added At\n" +
  Array.from(
    { length: 45 },
    (_, n) =>
      `spotify:track:${id(n + 1)},Song ${n + 1},Artist ${n + 1},Album ${n + 1},2024-02-01`,
  ).join("\n");
async function importLibrary(page: import("@playwright/test").Page) {
  await page.goto("./?simulate=1");
  await page.getByRole("button", { name: "Import your Spotify CSV" }).click();
  await page.getByLabel("Spotify-compatible CSV").setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(page.getByText("eligible unique tracks")).toBeVisible();
  await page
    .getByRole("button", { name: "Import 45 tracks", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    }),
  ).toBeVisible();
}
test("twenty judgments, branches, reload and undo preserve local state", async ({
  page,
}) => {
  await importLibrary(page);
  await page
    .getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Reference replay", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fits", exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next suggestion" }).click();
  for (let i = 0; i < 20; i++) {
    const button = page.getByRole("button", {
      name: i % 3 === 0 ? "Fits 3" : i % 3 === 1 ? "No 1" : "Skip 2",
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(
      page.getByText(`${i + 1} decisions ·`, { exact: false }),
    ).toBeVisible();
  }
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("music-explorer-recovery-v1")!),
  );
  expect(before.evaluations).toHaveLength(20);
  expect(before.nodes.length).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Graph G", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Replay & explore from here", exact: true })
    .click();
  await expect(
    page.getByText("Reference replay", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next suggestion" }).click();
  await page.reload();
  await expect(
    page.getByText("Candidate evaluation", { exact: true }),
  ).toBeVisible();
  // Reload requires an explicit resume; no judgment can be inferred from stale playback.
  await expect(
    page.getByRole("button", { name: "Fits 3", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Resume candidate", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fits 3", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Undo Z", exact: true }).click();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("music-explorer-recovery-v1")!),
  );
  expect(after.evaluations).toHaveLength(20);
  expect(
    after.evaluations.filter(
      (x: { undoneByEventId?: string }) => !x.undoneByEventId,
    ),
  ).toHaveLength(19);
  expect(new Set(after.events.map((x: { id: string }) => x.id)).size).toBe(
    after.events.length,
  );
});
test("graph inspection has no playback or persistence side effects", async ({
  page,
}) => {
  await importLibrary(page);
  await page
    .getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Next suggestion" }).click();
  await page.getByRole("button", { name: "Fits 3", exact: true }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("music-explorer-recovery-v1"),
  );
  await page.getByRole("button", { name: "Graph G", exact: true }).click();
  await page.locator(".react-flow__node").first().click();
  await expect(
    page.getByText("Inspecting this node does not change playback."),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("music-explorer-recovery-v1"),
    ),
  ).toBe(before);
  await page.getByRole("button", { name: "Back to player" }).click();
  await expect(
    page.getByText("Candidate evaluation", { exact: true }),
  ).toBeVisible();
});
test("responsive screens, keyboard and accessibility", async ({ page }) => {
  await page.goto("./?simulate=1");
  await expect(
    page.getByRole("heading", { name: "Find where a song takes you." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/empty-desktop.png",
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await importLibrary(page);
  await page
    .getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Next suggestion" }).click();
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("2");
  await expect(page.getByText("1 decisions ·", { exact: false })).toBeVisible();
  await page.screenshot({
    path: "test-results/player-desktop.png",
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Fits 3", exact: true }).click();
  await page.getByRole("button", { name: "Graph G", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.locator(".react-flow__node").first().boundingBox())
          ?.width ?? 0,
    )
    .toBeGreaterThan(100);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/graph-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/player-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("malformed restore reports an error without replacing current data", async ({
  page,
}) => {
  await importLibrary(page);
  await page
    .getByRole("button", { name: "Settings and Spotify connection" })
    .click();
  await page.getByLabel("Restore JSON backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await page
    .getByRole("button", { name: "Close Settings & local data", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Backup could not be restored",
  );
  await expect(
    page.getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/error-desktop.png",
    fullPage: true,
  });
});

test("failed direct write blocks progression and retry commits exactly once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => ({
        createWritable: async () => ({
          write: async () => {
            if ((window as unknown as { failWrite: boolean }).failWrite) {
              (window as unknown as { failWrite: boolean }).failWrite = false;
              throw new Error("Simulated disk full");
            }
          },
          close: async () => {},
          abort: async () => {},
        }),
        queryPermission: async () => "granted",
      }),
    });
  });
  await importLibrary(page);
  await page
    .getByRole("button", { name: "Save as JSON file", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Next suggestion" }).click();
  const oldTitle = await page.getByRole("heading", { level: 1 }).textContent();
  await page.evaluate(() => {
    (window as unknown as { failWrite: boolean }).failWrite = true;
  });
  await page.getByRole("button", { name: "Fits 3", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Simulated disk full");
  await expect(
    page.getByRole("button", { name: "Fits 3", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(oldTitle!);
  await expect(page.getByText("0 decisions ·", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByText("1 decisions ·", { exact: false })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("music-explorer-recovery-v1")!),
  );
  expect(saved.evaluations).toHaveLength(1);
  expect(saved.nodes).toHaveLength(2);
});

test("real client mock confirms artwork and blocks mismatched or unknown playback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "music-explorer.spotify.access-token",
      "test-access",
    );
    sessionStorage.setItem(
      "music-explorer.spotify.refresh-token",
      "test-refresh",
    );
    sessionStorage.setItem(
      "music-explorer.spotify.expires-at",
      String(Date.now() + 3600000),
    );
    sessionStorage.setItem("music-explorer.spotify.client-id", "test-client");
  });
  let playingId = id(1);
  let unknown = false;
  let repeat = "off";
  let pauseCalls = 0;
  let commandCalls = 0;
  let linkedFrom: string | undefined;
  await page.route("https://api.spotify.com/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "PUT") commandCalls++;
    if (req.method() === "PUT" && url.pathname.endsWith("/pause")) pauseCalls++;
    if (req.method() === "GET" && url.pathname.endsWith("/devices"))
      return route.fulfill({
        json: {
          devices: [
            {
              id: "desktop",
              name: "Spotify Desktop",
              is_active: true,
              is_restricted: false,
            },
          ],
        },
      });
    if (req.method() === "GET" && url.pathname.includes("/tracks/"))
      return route.fulfill({
        json: {
          id: url.pathname.split("/").at(-1),
          name: "Test metadata",
          artists: [{ name: "Test artist" }],
          album: {
            name: "Test album",
            images: [{ url: "https://example.test/album.svg" }],
          },
          external_urls: { spotify: "https://open.spotify.com/" },
        },
      });
    if (req.method() === "GET" && url.pathname.endsWith("/player")) {
      if (unknown) return route.fulfill({ status: 204 });
      return route.fulfill({
        json: {
          device: { id: "desktop" },
          item: { id: playingId, duration_ms: 180000, ...(linkedFrom ? { linked_from: { id: linkedFrom } } : {}) },
          is_playing: true,
          progress_ms: 1000,
          repeat_state: repeat,
        },
      });
    }
    if (req.method() === "PUT" && url.pathname.endsWith("/repeat"))
      repeat = url.searchParams.get("state")!;
    if (
      req.method() === "PUT" &&
      url.pathname.endsWith("/play") &&
      req.postDataJSON()?.uris
    )
      playingId = req.postDataJSON().uris[0].split(":").at(-1);
    return route.fulfill({ status: 200, contentType: "text/plain", body: "opaque-command-ack" });
  });
  await page.route("https://example.test/album.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#849e73"/></svg>',
    }),
  );
  // Import helper uses simulation URL, then reload into the real adapter with HTTP mocked above.
  await importLibrary(page);
  await page.goto("./");
  await page
    .getByRole("button", {
      name: "Start exploration from Song 1 Artist 1",
      exact: true,
    })
    .click();
  await expect(page.locator(".cover-large img")).toBeVisible();
  await page.getByRole("button", { name: "Next suggestion" }).click();
  await expect(
    page.getByRole("button", { name: "Fits 3", exact: true }),
  ).toBeEnabled();
  playingId = id(44);
  await page.getByRole("button", { name: "Fits 3", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Candidate playback is not confirmed",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("music-explorer-recovery-v1")!)
          .evaluations.length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Resume candidate", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fits 3", exact: true }),
  ).toBeEnabled();
  unknown = true;
  await page.getByRole("button", { name: "No 1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "No 1", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("music-explorer-recovery-v1")!)
          .evaluations.length,
    ),
  ).toBe(0);
  // Unconfirmed/reloaded sessions must not silence unrelated Spotify playback.
  unknown = false;
  playingId = id(44);
  linkedFrom = await page.evaluate(() => JSON.parse(localStorage.getItem("music-explorer-recovery-v1")!).active.pendingTrackId);
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume candidate", exact: true })).toBeEnabled();
  const beforeCommands = commandCalls;
  const beforePauses = pauseCalls;
  await page.getByRole("button", { name: "Check playback", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Spotify reports playback playing" })).toContainText("Track matches candidate: no");
  await expect(page.getByRole("status").filter({ hasText: "Spotify reports playback playing" })).toContainText("Original linked track matches candidate: yes");
  expect(commandCalls).toBe(beforeCommands);
  await page.waitForTimeout(5600);
  expect(pauseCalls).toBe(beforePauses);
  await page.screenshot({ path: "test-results/playback-check-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/playback-check-mobile.png", fullPage: true });
  // An external change after candidate confirmation still blocks rating and pauses once.
  await page.getByRole("button", { name: "Resume candidate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fits 3", exact: true })).toBeEnabled();
  playingId = id(44);
  await expect(page.getByRole("alert")).toContainText("Playback changed outside Music Explorer", { timeout: 8000 });
  expect(pauseCalls).toBe(beforePauses + 1);
  await page.waitForTimeout(5600);
  expect(pauseCalls).toBe(beforePauses + 1);

});

test("configured Spotify sign-in redirects with PKCE without asking for a client ID", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "music-explorer.client-id",
      "obsolete-manual-client",
    ),
  );
  await page.route("https://accounts.spotify.com/authorize**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Spotify authorization test</h1>",
    }),
  );
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Connect with Spotify", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Settings and Spotify connection" })
    .click();
  await expect(page.getByLabel("Spotify Developer client ID")).toHaveCount(0);
  await page.screenshot({path:"test-results/spotify-signin-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"test-results/spotify-signin-mobile.png",fullPage:true});
  await page.setViewportSize({width:1280,height:720});
  const request = page.waitForRequest(
    "https://accounts.spotify.com/authorize**",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Connect with Spotify", exact: true })
    .click();
  const url = new URL((await request).url());
  expect(url.searchParams.get("client_id")).toBe(
    "d3b5ce2ed95647348467b30b06350099",
  );
  expect(url.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:5173/music-explorer/",
  );
  expect(url.searchParams.get("scope")).toBe(
    "user-read-playback-state user-modify-playback-state",
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(url.searchParams.has("client_secret")).toBe(false);
});

test("playback time advances between Spotify polls and stops when paused", async ({ page }) => {
  await importLibrary(page);
  await page.getByRole("button", { name: "Start exploration from Song 1 Artist 1", exact: true }).click();
  const progress = page.getByRole("progressbar", { name: "Playback progress" });
  await expect.poll(async () => Number(await progress.getAttribute("value")), { timeout: 3500 }).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(progress).toHaveAttribute("value", "0"); // Simulator confirms zero at pause.
  await page.waitForTimeout(1100);
  await expect(progress).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => Number(await progress.getAttribute("value")), { timeout: 3500 }).toBeGreaterThan(500);
  await page.screenshot({ path: "test-results/playback-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/playback-mobile.png", fullPage: true });
});

test("candidate startup shows pending, delayed confirmation and actionable failure beside controls", async ({ page }) => {
  await importLibrary(page);
  await page.addInitScript(() => {
    sessionStorage.setItem("music-explorer.spotify.access-token", "test-access");
    sessionStorage.setItem("music-explorer.spotify.refresh-token", "test-refresh");
    sessionStorage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 3600000));
    sessionStorage.setItem("music-explorer.spotify.client-id", "test-client");
  });
  let mode: "paused" | "delayed" | "denied" | "offline" = "paused";
  let playCalls = 0;
  let reads = 0;
  let releasePlay: (() => void) | undefined;
  await page.route("https://api.spotify.com/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.endsWith("/devices")) return route.fulfill({ json: { devices: [{ id: "phone", name: "My phone", is_active: true }] } });
    if (req.method() === "PUT" && url.pathname.endsWith("/play")) {
      playCalls++;
      reads = 0;
      if (mode === "offline") return route.abort("failed");
      if (mode === "denied") return route.fulfill({ status: 403, json: { error: { reason: "PREMIUM_REQUIRED" } } });
      if (mode === "delayed") await new Promise<void>((resolve) => { releasePlay = resolve; });
      return route.fulfill({ status: 204 });
    }
    if (req.method() === "GET" && url.pathname.endsWith("/player")) {
      reads++;
      if (mode === "delayed" && reads < 3) return route.fulfill({ status: 204 });
      return route.fulfill({ json: { device: { id: "phone" }, item: { id: id(1), duration_ms: 180000 }, is_playing: mode === "delayed", progress_ms: 0, repeat_state: "off" } });
    }
    return route.fulfill({ status: 204 });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Start exploration from Song 1 Artist 1", exact: true }).click();
  const inlineFeedback = page.locator(".notice.error[role=status]");
  await expect(inlineFeedback).toContainText("did not confirm candidate playback");
  expect(playCalls).toBe(1);
  await page.screenshot({ path: "test-results/start-unconfirmed-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/start-unconfirmed-mobile.png", fullPage: true });
  mode = "delayed";
  await page.getByRole("button", { name: "Resume candidate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Contacting Spotify…", exact: true })).toBeDisabled();
  await page.screenshot({ path: "test-results/start-pending-mobile.png", fullPage: true });
  await expect.poll(() => releasePlay !== undefined).toBe(true);
  releasePlay!();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  expect(playCalls).toBe(2);
  mode = "denied";
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(inlineFeedback).toContainText("Spotify could not start playback (403). Spotify Premium is required.");
  await expect(page.getByRole("button", { name: "Resume candidate", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/start-denied-mobile.png", fullPage: true });
  mode = "offline";
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(inlineFeedback).toContainText("Spotify could not start playback: the browser could not reach Spotify or read its response.");
  await expect(inlineFeedback).toContainText("The command may already have taken effect");
  expect(playCalls).toBe(4); // Each click sends one command, including failures.
  await page.screenshot({ path: "test-results/start-network-mobile.png", fullPage: true });
});
