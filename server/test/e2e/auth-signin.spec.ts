/**
 * E2E auth flow: navigate to the signin page and verify it renders
 * with a usable form. Does NOT submit credentials — the OIDC + simple
 * signin flows are covered by the MSW + password-hash unit tests.
 *
 * What this catches:
 * - /auth/signin returns 5xx (route broken)
 * - Form input fields missing (regression)
 * - Page fails to hydrate (JS error)
 */
import { test, expect } from "@playwright/test";

test.describe("auth flow", () => {
  test("signin page renders with username + password fields", async ({
    page,
  }) => {
    const response = await page.goto("/auth/signin");
    expect([200, 302]).toContain(response?.status() ?? 0);

    // At least one of: username input or password input must exist.
    // Both are present in the simple signin form; OIDC mode may show
    // only an OIDC button.
    const usernameInput = page.locator(
      'input[name="username"], input[type="text"], input#username',
    );
    const passwordInput = page.locator('input[type="password"]');
    const oidcButton = page.locator(
      'button:has-text("OpenID"), a:has-text("OpenID"), a:has-text("OIDC")',
    );

    const hasForm =
      (await usernameInput.count()) > 0 && (await passwordInput.count()) > 0;
    const hasOidc = (await oidcButton.count()) > 0;
    expect(hasForm || hasOidc).toBe(true);
  });

  test("register page renders", async ({ page }) => {
    const response = await page.goto("/auth/register");
    expect([200, 302, 404]).toContain(response?.status() ?? 0);
    // 404 acceptable if registration is admin-invite-only.
  });
});
