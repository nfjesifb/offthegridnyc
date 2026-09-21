/* Start a static server first. BROWSER_CHANNEL=msedge uses installed Edge.
 * PLAYWRIGHT_MODULE optionally points to an existing Playwright installation.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_URL || "http://127.0.0.1:8765";
const out = process.env.SCREENSHOT_DIR || "test-results";
fs.mkdirSync(out, { recursive: true });
let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks++;
  console.log("PASS " + message);
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["geolocation"],
      geolocation: { latitude: 40.7033047, longitude: -74.0086169 },
    });
    // Keep the test from sending visits to production analytics.
    await context.route("**/googletagmanager.com/**", (route) => route.abort());
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text) => {
            window.__copied = text;
          },
        },
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector(".place-card");
    ok(
      (await page.locator(".place-card").count()) === 12,
      "initial page renders 12 places",
    );
    ok(
      !(await page.locator(".leaflet-container").count()),
      "map is not loaded on initial visit",
    );
    await page.screenshot({ path: out + "/desktop.png", fullPage: true });
    await page.locator("#search").fill("ELEVATED acre");
    await page.waitForFunction(
      () => document.querySelectorAll(".place-card").length === 1,
    );
    ok(
      (await page.locator(".card-title").innerText()) === "Elevated Acre",
      "search finds canonical place",
    );
    await page.locator(".save-button").click();
    await page.reload();
    await page.waitForSelector(".place-card");
    ok(
      (await page.locator(".save-button").getAttribute("aria-pressed")) ===
        "true",
      "saved places persist after reload",
    );
    await page.locator("#saved-nav").click();
    ok(
      (await page.locator(".place-card").count()) === 1,
      "saved collection filters correctly",
    );
    await page.locator("#share-results").click();
    const sharedURL = await page.evaluate(() => window.__copied);
    ok(
      sharedURL.includes("collection=elevated-acre") &&
        !sharedURL.includes("saved=1"),
      "shared saved collection encodes places",
    );
    const recipient = await browser.newContext();
    await recipient.route("**/googletagmanager.com/**", (route) =>
      route.abort(),
    );
    const received = await recipient.newPage();
    await received.goto(sharedURL);
    await received.waitForSelector(".place-card");
    ok(
      (await received.locator(".place-card").count()) === 1 &&
        (await received.locator("#saved-count").innerText()) === "0",
      "collection works for a new visitor",
    );
    await recipient.close();
    await page.locator("#reset").click();
    await page.locator("#search").fill("elevated acre");
    await page.locator('[data-theme="public-private"]').click();
    ok(
      (await page.locator(".place-card").count()) === 1,
      "typing then immediately selecting a theme preserves the search",
    );
    await page.locator("#reset").click();
    await page.locator('[data-theme="communities"]').click();
    ok(
      (await page.locator("#results-count").innerText()).startsWith("23 "),
      "theme filter uses KML category membership",
    );
    await page.locator("[data-surprise]").click();
    await page.waitForSelector("#place-dialog[open]");
    ok(
      (await page.locator("#dialog-content .eyebrow").textContent()) ===
        "Hidden courts & communities",
      "surprise respects active theme",
    );
    await page.keyboard.press("Escape");
    ok(
      !(await page.locator("#place-dialog").isVisible()),
      "Escape closes preview",
    );
    await page.locator("#reset").click();
    await page.locator("#load-more").click();
    ok(
      (await page.locator(".place-card").count()) === 24,
      "load more adds next 12 places",
    );
    await page.locator("#search").fill("zzzz-no-place");
    await page.waitForSelector("#empty-state:not([hidden])");
    ok(
      (await page.locator("#empty-description").innerText()).includes(
        "No places match",
      ),
      "search has a useful empty state",
    );
    await page.locator("#empty-reset").click();
    await page.locator("#nearby").click();
    await page.waitForFunction(
      () => document.querySelector("#sort").value === "nearby",
    );
    ok(
      (await page.locator(".card-title").first().innerText()) ===
        "Elevated Acre",
      "nearby sorts from requested location",
    );
    ok(!page.url().includes("40.703"), "coordinates do not enter shared URLs");
    await page.locator('[data-view="map"]').click();
    await page.waitForSelector(".leaflet-marker-icon");
    ok(
      (await page.locator(".leaflet-marker-icon").count()) === 85,
      "map contains every matching place",
    );
    await page.locator("#search").fill("elevated acre");
    await page.waitForFunction(
      () => document.querySelectorAll(".leaflet-marker-icon").length === 1,
    );
    ok(
      (await page.locator(".place-card").count()) === 1,
      "map and list use the same filter",
    );
    await page.locator(".leaflet-marker-icon").click();
    await page.locator(".leaflet-popup-content button").click();
    await page.waitForSelector("#place-dialog[open]");
    ok(
      (await page.locator("#dialog-title").innerText()) === "Elevated Acre",
      "map marker opens place preview",
    );
    await page.keyboard.press("Escape");
    await page.locator("#reset").click();
    await page.screenshot({ path: out + "/map.png", fullPage: true });
    await page.goto(base + "/locations/elevated-acre/index.html");
    await page.waitForSelector(".otg-related a");
    ok(
      (await page.locator("[data-save-place]").getAttribute("aria-pressed")) ===
        "true",
      "detail page shares saved state",
    );
    await page.locator("[data-share-place]").click();
    ok(
      (await page.evaluate(() => window.__copied)).endsWith(
        "/locations/elevated-acre/index.html",
      ),
      "detail share uses the canonical place path",
    );
    await page.screenshot({ path: out + "/detail.png", fullPage: true });
    await page.goto(base + "/?place=pomander-walk");
    await page.waitForSelector("#place-dialog[open]");
    ok(
      (await page.locator("#dialog-title").innerText()) === "Pomander Walk",
      "direct place links reopen the correct preview",
    );
    await page.keyboard.press("Escape");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await page.waitForSelector(".place-card");
      ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `no horizontal overflow at ${width}px`,
      );
      if (width === 390)
        await page.screenshot({ path: out + "/mobile.png", fullPage: true });
    }
    ok(
      errors.length === 0,
      "no uncaught JavaScript errors: " + errors.join(", "),
    );
    await context.close();

    const denied = await browser.newContext();
    await denied.route("**/googletagmanager.com/**", (route) => route.abort());
    await denied.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition(success, failure) {
            failure({ code: 1 });
          },
        },
      });
      Object.defineProperty(navigator, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", { value: undefined });
    });
    const fallback = await denied.newPage();
    await fallback.goto(base);
    await fallback.waitForSelector(".place-card");
    await fallback.locator(".save-button").first().click();
    ok(
      (await fallback.locator("#toast").innerText()).includes(
        "this visit only",
      ),
      "blocked storage keeps the session usable",
    );
    await fallback.locator("#nearby").click();
    ok(
      (await fallback.locator("#toast").innerText()).includes(
        "permission denied",
      ),
      "denied location gives recovery feedback",
    );
    await fallback.locator("#share-results").click();
    await fallback.waitForSelector("#share-dialog[open]");
    ok(
      (await fallback.locator("#share-url").inputValue()).startsWith(base),
      "clipboard failure offers a selectable link",
    );
    await fallback.keyboard.press("Escape");
    await fallback.route("**/assets/vendor/leaflet/leaflet.js", (route) =>
      route.abort(),
    );
    await fallback.locator('[data-view="map"]').click();
    await fallback.waitForFunction(() =>
      document
        .querySelector("#map-status")
        .textContent.includes("couldn’t load"),
    );
    ok(
      (await fallback.locator(".place-card").count()) === 12,
      "failed map leaves browsing available",
    );
    await fallback.route("**/assets/data/places.json", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await fallback.reload();
    await fallback.waitForSelector("#place-grid .notice");
    ok(
      (await fallback.locator("#place-grid .notice a").getAttribute("href")) ===
        "browse/",
      "catalog failure offers the static directory",
    );
    await denied.close();
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const directory = await noJS.newPage();
    await directory.goto(base + "/browse/");
    ok(
      (await directory.locator(".directory-grid li a").count()) === 85,
      "all 85 stories are reachable without JavaScript",
    );
    await noJS.close();
    console.log(`${checks} browser checks passed.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
