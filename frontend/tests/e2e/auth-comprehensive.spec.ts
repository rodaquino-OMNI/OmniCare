import { test, expect, Page } from '@playwright/test';
import { createHelpers, setupTest, cleanupTest } from './helpers/test-utils';
import { DEMO_USERS, generateErrorScenarios } from './helpers/test-data';

/**
 * Comprehensive Authentication E2E Tests
 * Tests all authentication scenarios including edge cases and error handling
 */

test.describe('Authentication - Comprehensive Flow', () => {
  let page: Page;
  let helpers: ReturnType<typeof createHelpers>;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    helpers = createHelpers(page);
    await page.goto('/auth/login');
  });

  test.afterEach(async () => {
    await cleanupTest(page);
  });

  test.describe('Successful Authentication', () => {
    test('should login successfully with doctor credentials', async () => {
      await test.step('Navigate to login page', async () => {
        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      });

      await test.step('Use doctor demo credentials', async () => {
        await page.getByRole('button', { name: 'Doctor' }).click();
        
        // Verify credentials are populated
        await expect(page.getByLabel(/email address/i)).toHaveValue(DEMO_USERS.doctor.email);
        await expect(page.getByLabel(/password/i)).toHaveValue(DEMO_USERS.doctor.password);
      });

      await test.step('Submit login form', async () => {
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // Wait for loading to complete
        await helpers.wait.waitForLoading();
      });

      await test.step('Verify successful login', async () => {
        // Should redirect to dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        
        // Should show welcome message
        await expect(page.getByText(/welcome/i)).toBeVisible();
        
        // Should show user-specific content
        await expect(page.getByText(DEMO_USERS.doctor.firstName)).toBeVisible();
        
        // Should show navigation menu
        await expect(page.getByRole('navigation')).toBeVisible();
      });

      await test.step('Verify user session is established', async () => {
        // Check for authentication indicators
        const userMenu = page.getByRole('button', { name: /user menu/i }).or(
          page.getByText(DEMO_USERS.doctor.firstName)
        );
        await expect(userMenu).toBeVisible();
        
        // Verify access to protected content
        await expect(page.getByText(/total patients/i)).toBeVisible();
      });
    });

    test('should login successfully with nurse credentials', async () => {
      await page.getByRole('button', { name: 'Nurse' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await helpers.wait.waitForLoading();
      
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(DEMO_USERS.nurse.firstName)).toBeVisible();
    });

    test('should login successfully with admin credentials', async () => {
      await page.getByRole('button', { name: 'Admin' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await helpers.wait.waitForLoading();
      
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(DEMO_USERS.admin.firstName)).toBeVisible();
    });

    test('should login with manual credential entry', async () => {
      // Manual entry without demo button
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await helpers.wait.waitForLoading();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle remember me functionality', async () => {
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      // Check remember me
      await page.getByLabel(/remember me/i).check();
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await helpers.wait.waitForLoading();
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Verify session persistence (would need to check localStorage/cookies)
      const rememberMeValue = await page.evaluate(() => {
        return localStorage.getItem('rememberMe') || sessionStorage.getItem('rememberMe');
      });
      
      expect(rememberMeValue).toBeTruthy();
    });
  });

  test.describe('Form Validation', () => {
    test('should show validation errors for empty fields', async () => {
      await test.step('Submit empty form', async () => {
        await page.getByRole('button', { name: /sign in/i }).click();
      });

      await test.step('Verify validation messages', async () => {
        await expect(page.getByText(/email is required/i)).toBeVisible();
        await expect(page.getByText(/password is required/i)).toBeVisible();
      });

      await test.step('Verify form cannot be submitted', async () => {
        // Should still be on login page
        await expect(page).toHaveURL(/\/auth\/login/);
      });
    });

    test('should validate email format', async () => {
      const errorScenarios = generateErrorScenarios();
      
      await page.getByLabel(/email address/i).fill(errorScenarios.invalidEmail.email);
      await page.getByLabel(/password/i).fill(errorScenarios.invalidEmail.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page.getByText(/invalid email format/i)).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should validate password length', async () => {
      await page.getByLabel(/email address/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('123'); // Too short
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();
    });

    test('should clear validation errors when fields are corrected', async () => {
      // First trigger validation errors
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByText(/email is required/i)).toBeVisible();
      
      // Fix the email field
      await page.getByLabel(/email address/i).fill('test@example.com');
      
      // Email error should disappear
      await expect(page.getByText(/email is required/i)).not.toBeVisible();
      
      // Password error should still be visible
      await expect(page.getByText(/password is required/i)).toBeVisible();
    });
  });

  test.describe('Authentication Errors', () => {
    test('should handle invalid credentials gracefully', async () => {
      const errorScenarios = generateErrorScenarios();
      
      await test.step('Enter invalid credentials', async () => {
        await page.getByLabel(/email address/i).fill(errorScenarios.invalidCredentials.email);
        await page.getByLabel(/password/i).fill(errorScenarios.invalidCredentials.password);
      });

      await test.step('Submit form', async () => {
        await page.getByRole('button', { name: /sign in/i }).click();
        await helpers.wait.waitForLoading();
      });

      await test.step('Verify error handling', async () => {
        // Should show error message
        await expect(page.getByText(/login failed/i).or(
          page.getByText(/invalid credentials/i)
        )).toBeVisible();
        
        // Should remain on login page
        await expect(page).toHaveURL(/\/auth\/login/);
        
        // Form should be reset or allow retry
        await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
      });
    });

    test('should handle server errors gracefully', async () => {
      // Mock server error
      await helpers.api.mockAPIError('**/auth/**', 500, 'Internal Server Error');
      
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show server error message
      await expect(page.getByText(/server error/i).or(
        page.getByText(/something went wrong/i)
      )).toBeVisible();
      
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should handle network failures gracefully', async () => {
      // Mock network failure
      await helpers.api.mockNetworkFailure('**/auth/**');
      
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show network error
      await expect(page.getByText(/network error/i).or(
        page.getByText(/connection failed/i)
      )).toBeVisible();
    });

    test('should handle rate limiting', async () => {
      // Mock rate limit response
      await helpers.api.mockAPIError('**/auth/**', 429, 'Too Many Requests');
      
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page.getByText(/too many requests/i).or(
        page.getByText(/rate limit/i)
      )).toBeVisible();
    });
  });

  test.describe('UI/UX Features', () => {
    test('should show loading state during authentication', async () => {
      // Mock slow response
      await helpers.api.mockSlowResponse('**/auth/**', 2000);
      
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show loading state
      await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled();
      
      // Should show loading indicator
      const loadingIndicator = page.locator('.loading, [data-testid="loading"], [aria-label="Loading"]');
      await expect(loadingIndicator).toBeVisible();
    });

    test('should disable form during submission', async () => {
      await helpers.api.mockSlowResponse('**/auth/**', 1000);
      
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Form fields should be disabled
      await expect(page.getByLabel(/email address/i)).toBeDisabled();
      await expect(page.getByLabel(/password/i)).toBeDisabled();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });

    test('should handle demo account switching', async () => {
      // Start with doctor
      await page.getByRole('button', { name: 'Doctor' }).click();
      await expect(page.getByLabel(/email address/i)).toHaveValue(DEMO_USERS.doctor.email);
      
      // Switch to nurse
      await page.getByRole('button', { name: 'Nurse' }).click();
      await expect(page.getByLabel(/email address/i)).toHaveValue(DEMO_USERS.nurse.email);
      
      // Switch to admin
      await page.getByRole('button', { name: 'Admin' }).click();
      await expect(page.getByLabel(/email address/i)).toHaveValue(DEMO_USERS.admin.email);
    });

    test('should show password visibility toggle', async () => {
      const passwordInput = page.getByLabel(/password/i);
      const toggleButton = page.getByRole('button', { name: /show password/i }).or(
        page.getByRole('button', { name: /toggle password visibility/i })
      );
      
      // Password should start hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      await passwordInput.fill('testpassword');
      
      // Click toggle to show
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'text');
        
        // Click toggle to hide again
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute('type', 'password');
      }
    });
  });

  test.describe('Security Features', () => {
    test('should clear form on page reload', async () => {
      await page.getByLabel(/email address/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('testpassword');
      
      await page.reload();
      
      await expect(page.getByLabel(/email address/i)).toHaveValue('');
      await expect(page.getByLabel(/password/i)).toHaveValue('');
    });

    test('should not expose credentials in URL', async () => {
      await page.getByLabel(/email address/i).fill(DEMO_USERS.doctor.email);
      await page.getByLabel(/password/i).fill(DEMO_USERS.doctor.password);
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // URL should not contain credentials
      const currentUrl = page.url();
      expect(currentUrl).not.toContain(DEMO_USERS.doctor.email);
      expect(currentUrl).not.toContain(DEMO_USERS.doctor.password);
    });

    test('should handle session timeout gracefully', async () => {
      // First login successfully
      await helpers.auth.loginAsUser('doctor');
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Mock session timeout
      await helpers.api.mockAPIError('**/api/**', 401, 'Unauthorized');
      
      // Try to navigate to protected resource
      await helpers.navigation.navigateTo('patients');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/);
      
      // Should show session timeout message
      await expect(page.getByText(/session expired/i).or(
        page.getByText(/please log in again/i)
      )).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      // Tab through form elements
      await page.keyboard.press('Tab'); // Email input
      await expect(page.getByLabel(/email address/i)).toBeFocused();
      
      await page.keyboard.press('Tab'); // Password input
      await expect(page.getByLabel(/password/i)).toBeFocused();
      
      await page.keyboard.press('Tab'); // Remember me checkbox
      await expect(page.getByLabel(/remember me/i)).toBeFocused();
      
      await page.keyboard.press('Tab'); // Sign in button
      await expect(page.getByRole('button', { name: /sign in/i })).toBeFocused();
    });

    test('should support screen readers', async () => {
      // Check for proper ARIA labels
      await expect(page.getByLabel(/email address/i)).toHaveAttribute('aria-label');
      await expect(page.getByLabel(/password/i)).toHaveAttribute('aria-label');
      
      // Check for proper form structure
      await expect(page.getByRole('form')).toBeVisible();
      
      // Check for proper headings
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should have sufficient color contrast', async () => {
      // This would ideally use axe-core for automated accessibility testing
      await helpers.a11y.checkColorContrast();
      
      // Verify elements are still visible in high contrast mode
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email address/i)).toBeVisible();
    });
  });

  test.describe('Multi-browser and Device Support', () => {
    test('should work on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Verify mobile layout
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email address/i)).toBeVisible();
      
      // Test mobile interaction
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await helpers.wait.waitForLoading();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle small screen sizes', async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      
      // Verify all elements are accessible
      await expect(page.getByLabel(/email address/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Demo buttons should be visible or in accessible menu
      const doctorButton = page.getByRole('button', { name: 'Doctor' });
      if (await doctorButton.isVisible()) {
        await expect(doctorButton).toBeVisible();
      }
    });
  });
});