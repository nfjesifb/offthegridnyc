/* Run against a static preview. Tests block production analytics. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_URL || "http://127.0.0.1:8765";
const out = process.env.SCREENSHOT_DIR || "test-results";
fs.mkdirSync(out, { recursive: true });
let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  console.log("PASS " + message);
  checks++;
}
const rows = (page) => page.locator(".place-row");
const ready = (page) => page.waitForSelector(".leaflet-marker-icon");
const rowCount = (page, count) =>
  page.waitForFunction(
    (n) => document.querySelectorAll(".place-row").length === n,
    count,
  );

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
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await ready(page);
    await rowCount(page, 85);
    ok(
      (await page.locator(".leaflet-marker-icon").count()) === 85,
      "map immediately shows all 85 places",
    );
    const mapRect = await page.locator("#map").boundingBox();
    ok(
      mapRect.width > 1000 && mapRect.height > 900,
      "map is the primary desktop surface",
    );
    await page.screenshot({ path: out + "/desktop-map.png" });
    await page.locator("#search").fill("ELEVATED acre");
    await rowCount(page, 1);
    ok(
      await rows(page)
        .innerText()
        .then((t) => t.includes("Elevated Acre")),
      "search finds the place",
    );
    ok(
      (await page.locator(".leaflet-marker-icon").count()) === 1,
      "search filters map and list together",
    );
    await page.locator(".leaflet-marker-icon").click();
    await page.waitForSelector("#selected-place:not([hidden])");
    ok(
      (await page.locator("#place-title").innerText()) === "Elevated Acre" &&
        (await page.locator("#map").isVisible()),
      "pin opens details while the map stays visible",
    );
    ok(
      (await page.locator(".map-marker.is-selected").count()) === 1,
      "selected place is highlighted on the map",
    );
    await page.locator("#save-place").click();
    await page.reload();
    await ready(page);
    ok(
      (await page.locator("#save-place").getAttribute("aria-pressed")) ===
        "true",
      "saved place and direct details survive reload",
    );
    await page.keyboard.press("Escape");
    ok(
      await page.locator("#selected-place").isHidden(),
      "Escape returns to the place list",
    );
    await page.locator("#saved-nav").click();
    await rowCount(page, 1);
    await page.locator("#share-results").click();
    const sharedURL = await page.evaluate(() => window.__copied);
    const sharedState = new URL(sharedURL);
    ok(
      sharedState.searchParams.get("collection") === "elevated-acre" &&
        !sharedState.searchParams.has("saved"),
      "saved list is shareable without recipient storage",
    );
    ok(
      sharedState.searchParams.has("map"),
      "share link includes the current map view",
    );
    const recipient = await browser.newContext();
    await recipient.route("**/googletagmanager.com/**", (route) =>
      route.abort(),
    );
    const received = await recipient.newPage();
    await received.goto(sharedURL);
    await ready(received);
    await rowCount(received, 1);
    ok(
      (await received.locator("#saved-count").innerText()) === "0",
      "shared collection works for a new visitor",
    );
    await recipient.close();
    await page.locator("#reset").click();
    await rowCount(page, 85);
    await page.locator("#search").fill("elevated acre");
    await page.locator("#theme").selectOption("public-private");
    await rowCount(page, 1);
    ok(
      new URL(page.url()).searchParams.get("q") === "elevated acre",
      "immediate theme selection preserves the pending search",
    );
    await page.locator("#reset").click();
    await page.locator("#theme").selectOption("communities");
    await rowCount(page, 23);
    await page.locator("#surprise").click();
    ok(
      (await page.locator("#place-content .place-category").innerText()) ===
        "Courts & communities",
      "random place respects the filter",
    );
    await page.locator("#back-to-results").click();
    await page.locator("#reset").click();
    await rowCount(page, 85);
    await page.locator("#search").fill("zzzz-no-place");
    await rowCount(page, 0);
    ok(
      (await page.locator("#empty-description").innerText()).includes(
        "No places match",
      ),
      "search gives a useful empty state",
    );
    await page.locator("#empty-reset").click();
    await rowCount(page, 85);
    await page.locator("#nearby").click();
    await page.waitForFunction(() =>
      document.querySelector(".place-row small").textContent.includes(" mi"),
    );
    ok(
      (await rows(page).first().innerText()).includes("Elevated Acre"),
      "Near me orders places by distance",
    );
    ok(
      !page.url().includes("40.703"),
      "device coordinates stay out of browsing URLs",
    );
    await page.locator("#reset").click();
    await page.locator("#in-view").check();
    await rowCount(page, 85);
    await page.locator('.place-row[data-slug="sylvan-terrace"]').click();
    await page.screenshot({ path: out + "/place-on-map.png" });
    await page.locator("#back-to-results").click();
    const zoomedCount = await rows(page).count();
    ok(
      zoomedCount > 0 && zoomedCount < 85,
      "visible list follows the focused map area",
    );
    await page.locator("#map").focus();
    await page.keyboard.press("ArrowRight");
    await page.locator("#fit-map").click();
    await rowCount(page, 85);
    ok(
      (await rows(page).count()) === 85,
      "show all results restores the full map and list",
    );
    await page.locator("#search").fill("elevated acre");
    await rowCount(page, 1);
    await rows(page).first().focus();
    await page.keyboard.press("Enter");
    ok(
      (await page.locator("#place-title").innerText()) === "Elevated Acre",
      "keyboard opens a place",
    );
    await page.locator("#place-content .nearby-links button").first().click();
    const neighbor = new URL(page.url()).searchParams.get("place");
    ok(
      neighbor !== "elevated-acre" &&
        (await page.locator(".map-marker.is-selected").count()) === 1,
      "nearby places cross filters and update the map",
    );
    await page.goBack();
    await page.waitForFunction(
      () =>
        document.querySelector("#place-title")?.textContent === "Elevated Acre",
    );
    ok(
      (await page.locator("#place-title").innerText()) === "Elevated Acre",
      "browser Back restores the previous place",
    );

    await page.goto(base + "/locations/elevated-acre/index.html");
    await ready(page);
    ok(
      (await page.locator("#save-place").getAttribute("aria-pressed")) ===
        "true",
      "standalone page shares saved state",
    );
    await page.locator("#share-place").click();
    ok(
      (await page.evaluate(() => window.__copied)).endsWith(
        "/locations/elevated-acre/index.html",
      ),
      "place share links to its complete page",
    );
    ok(
      (await page.locator(".nearby-links a").count()) === 4,
      "place page links to four geographic neighbors",
    );
    await page.goto(base + "/locations/temple-court/index.html");
    await ready(page);
    ok(
      (await page.locator(".description").innerText()).includes(
        "Windsor Terrace",
      ),
      "formerly empty page identifies the correct place",
    );
    ok(
      (await page.locator(".source-list a").count()) > 0 &&
        (await page.locator(".gallery").count()) === 0,
      "sources replace empty copy and unrelated photos",
    );
    ok(
      (await page.locator("iframe").count()) === 0,
      "no empty Street View or discussion embeds on load",
    );
    await page.screenshot({ path: out + "/place-page.png", fullPage: true });
    await page.goto(base + "/locations/sylvan-terrace/index.html");
    await ready(page);
    const gallery = page.locator(".gallery");
    await gallery
      .locator("img")
      .first()
      .evaluate((img) => img.decode());
    await gallery.locator(".gallery-next").click();
    await page.waitForFunction(() =>
      document.querySelector(".gallery-count").textContent.startsWith("2 /"),
    );
    ok(
      (await gallery.locator(".gallery-count").innerText()).startsWith("2 /"),
      "native photo gallery advances",
    );

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await ready(page);
      ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `no horizontal overflow at ${width}px`,
      );
      if (width === 390) {
        const before = await page.locator("#map").boundingBox();
        await page.locator("#panel-toggle").click();
        const after = await page.locator("#map").boundingBox();
        ok(
          after.height < before.height && after.height > 150,
          "phone panel expands while keeping the map visible",
        );
        await page.locator("#panel-toggle").click();
        await page.screenshot({ path: out + "/mobile-map.png" });
        await page.goto(base + "/?place=temple-court");
        await ready(page);
        ok(
          (await page.locator("#place-title").innerText()) === "Temple Court" &&
            (await page.locator("#map").isVisible()),
          "phone deep link shows place and map together",
        );
        await page.screenshot({ path: out + "/mobile-place.png" });
      }
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
    await fallback.goto(base + "/?place=elevated-acre");
    await ready(fallback);
    await fallback.locator("#save-place").click();
    ok(
      (await fallback.locator("#toast").innerText()).includes(
        "this visit only",
      ),
      "blocked storage keeps session saving available",
    );
    await fallback.locator("#back-to-results").click();
    await fallback.locator("#nearby").click();
    ok(
      (await fallback.locator("#toast").innerText()).includes(
        "permission denied",
      ),
      "denied location provides useful feedback",
    );
    await fallback.locator("#share-results").click();
    await fallback.waitForSelector("#share-dialog[open]");
    ok(
      (await fallback.locator("#share-url").inputValue()).startsWith(base),
      "clipboard failure gives a selectable link",
    );
    await fallback.keyboard.press("Escape");
    await fallback.route("**/assets/vendor/leaflet/leaflet.js", (route) =>
      route.abort(),
    );
    await fallback.reload();
    await fallback.waitForFunction(() =>
      document
        .querySelector("#map-status")
        .textContent.includes("couldn’t load"),
    );
    ok(
      (await rows(fallback).count()) === 85,
      "failed map leaves the complete list available",
    );
    await fallback.route("**/assets/data/places.json", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await fallback.reload();
    await fallback.waitForSelector("#place-list .inline-note a");
    ok(
      (await fallback
        .locator("#place-list .inline-note a")
        .getAttribute("href")) === "browse/",
      "catalog failure offers the static directory",
    );
    await denied.close();

    const brokenPhoto = await browser.newContext();
    await brokenPhoto.route("**/googletagmanager.com/**", (route) =>
      route.abort(),
    );
    await brokenPhoto.route(
      "**/locations/sylvan-terrace/images/photo_1.jpg",
      (route) => route.abort(),
    );
    const photoPage = await brokenPhoto.newPage();
    await photoPage.goto(base + "/locations/sylvan-terrace/index.html");
    await ready(photoPage);
    await photoPage.waitForFunction(
      () => document.querySelector(".gallery-track img").hidden,
    );
    ok(
      (await photoPage.locator(".gallery-count").innerText()) === "1 / 4",
      "failed photo is removed from gallery navigation",
    );
    await brokenPhoto.close();

    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const directory = await noJS.newPage();
    await directory.goto(base + "/browse/");
    ok(
      (await directory.locator(".directory-grid li a").count()) === 85,
      "all places are reachable without JavaScript",
    );
    await directory.goto(base + "/locations/temple-court/index.html");
    ok(
      (await directory.locator(".description").innerText()).length > 80,
      "complete place text is available without JavaScript",
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
