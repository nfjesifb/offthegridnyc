// Browser smoke tests against the generated site (npm test).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 900 } },
  webServer: { command: 'node tools/serve.mjs 4173', url: 'http://127.0.0.1:4173/', reuseExistingServer: true, timeout: 20_000 },
});
