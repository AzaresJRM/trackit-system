const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:5501'
  },
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:4000/',
      reuseExistingServer: true,
      cwd: '.',
      timeout: 120_000
    },
    {
      command: 'npx http-server ../trackit-frontend -p 5501 --silent -c-1',
      url: 'http://localhost:5501/index.html',
      reuseExistingServer: true,
      cwd: '.',
      timeout: 120_000
    }
  ]
});
