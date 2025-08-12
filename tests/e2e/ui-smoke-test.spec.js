const { test, expect } = require('@playwright/test');

test.describe('Lang Observatory UI Smoke Tests', () => {
  test('should load Langfuse dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Langfuse|Dashboard/);

    const healthElement = page.locator('[data-testid="health-status"]');
    await expect(healthElement).toBeVisible({ timeout: 10000 });
  });

  test('should load Grafana dashboard', async ({ page }) => {
    await page.goto('http://localhost:8080');

    await expect(page).toHaveTitle(/Grafana/);

    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible()) {
      await page.fill('[data-testid="username"]', 'admin');
      await page.fill('[data-testid="password"]', 'admin');
      await page.click('[data-testid="login-button"]');
    }

    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test('should load Prometheus metrics', async ({ page }) => {
    await page.goto('http://localhost:9090');

    await expect(page).toHaveTitle(/Prometheus/);

    const queryInput = page.locator('[data-testid="query-input"]');
    await expect(queryInput).toBeVisible();

    await queryInput.fill('up');
    await page.click('[data-testid="execute-button"]');

    const results = page.locator('[data-testid="query-results"]');
    await expect(results).toBeVisible({ timeout: 10000 });
  });

  test('should display system health status', async ({ page }) => {
    await page.goto('/health');

    const response = await page.waitForResponse(
      response =>
        response.url().includes('/health') && response.status() === 200
    );

    expect(response.status()).toBe(200);

    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
    expect(healthData.status).toBe('healthy');
  });

  test('should handle API rate limiting gracefully', async ({ page }) => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(page.goto('/api/v1/traces'));
    }

    const responses = await Promise.all(promises);
    const successfulResponses = responses.filter(r => r.status() === 200);
    const rateLimitedResponses = responses.filter(r => r.status() === 429);

    expect(successfulResponses.length + rateLimitedResponses.length).toBe(10);
  });

  test('should display metrics visualization', async ({ page }) => {
    await page.goto('/');

    const metricsChart = page.locator('[data-testid="metrics-chart"]');
    await expect(metricsChart).toBeVisible({ timeout: 15000 });

    const chartTitle = page.locator('[data-testid="chart-title"]');
    await expect(chartTitle).toContainText(/LLM|Token|Cost/);
  });
});
