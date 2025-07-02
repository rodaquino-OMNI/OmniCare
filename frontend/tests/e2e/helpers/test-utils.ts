import { Page, expect, Locator } from '@playwright/test';
import { DEMO_USERS, TEST_CONSTANTS } from './test-data';

/**
 * E2E Test Utilities
 * Common helper functions for E2E testing
 */

/**
 * Authentication helper functions
 */
export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * Login with demo user credentials
   */
  async loginAsUser(userType: 'doctor' | 'nurse' | 'admin') {
    const user = DEMO_USERS[userType];
    await this.page.goto('/auth/login');
    
    // Use demo button if available
    const demoButton = this.page.getByRole('button', { name: userType === 'doctor' ? 'Doctor' : userType === 'nurse' ? 'Nurse' : 'Admin' });
    
    if (await demoButton.isVisible()) {
      await demoButton.click();
    } else {
      // Manual entry
      await this.page.getByLabel(/email address/i).fill(user.email);
      await this.page.getByLabel(/password/i).fill(user.password);
    }
    
    await this.page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for successful login
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.page.getByText(/welcome/i)).toBeVisible();
  }

  /**
   * Login with custom credentials
   */
  async loginWithCredentials(email: string, password: string) {
    await this.page.goto('/auth/login');
    await this.page.getByLabel(/email address/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  /**
   * Logout current user
   */
  async logout() {
    // Look for user menu or logout button
    const userMenu = this.page.getByRole('button', { name: /user menu/i }).or(
      this.page.getByRole('button', { name: /profile/i })
    );
    
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.getByRole('menuitem', { name: /logout/i }).click();
    } else {
      // Direct logout link
      await this.page.getByRole('link', { name: /logout/i }).click();
    }
    
    await expect(this.page).toHaveURL(/\/auth\/login/);
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await expect(this.page.getByText(/welcome/i)).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Navigation helper functions
 */
export class NavigationHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific page
   */
  async navigateTo(pageName: string) {
    const navigationMap: Record<string, string> = {
      dashboard: '/dashboard',
      patients: '/patients',
      'patient-registration': '/admin/patients/register',
      appointments: '/appointments',
      'lab-orders': '/lab-orders',
      medications: '/medications',
      reports: '/reports',
      settings: '/settings'
    };
    
    const url = navigationMap[pageName];
    if (!url) {
      throw new Error(`Unknown page: ${pageName}`);
    }
    
    // Try to navigate via menu first
    const menuLink = this.page.getByRole('link', { name: new RegExp(pageName.replace('-', ' '), 'i') });
    
    if (await menuLink.isVisible()) {
      await menuLink.click();
    } else {
      // Direct navigation
      await this.page.goto(url);
    }
    
    await this.page.waitForURL(new RegExp(url));
  }

  /**
   * Navigate to patient details page
   */
  async navigateToPatient(patientId: string) {
    await this.page.goto(`/patients/${patientId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Use breadcrumb navigation
   */
  async navigateByBreadcrumb(breadcrumbText: string) {
    await this.page.getByRole('navigation', { name: /breadcrumb/i })
      .getByRole('link', { name: new RegExp(breadcrumbText, 'i') })
      .click();
  }
}

/**
 * Form helper functions
 */
export class FormHelpers {
  constructor(private page: Page) {}

  /**
   * Fill a form with data object
   */
  async fillForm(formData: Record<string, any>) {
    for (const [field, value] of Object.entries(formData)) {
      if (value === undefined || value === null) continue;
      
      const input = this.page.getByLabel(new RegExp(field.replace(/([A-Z])/g, ' $1'), 'i'));
      
      if (await input.getAttribute('type') === 'checkbox') {
        if (value) {
          await input.check();
        } else {
          await input.uncheck();
        }
      } else if (await input.getAttribute('type') === 'select') {
        await input.selectOption(value);
      } else {
        await input.fill(String(value));
      }
    }
  }

  /**
   * Submit form and wait for response
   */
  async submitForm(submitButtonText: string = 'submit') {
    await this.page.getByRole('button', { name: new RegExp(submitButtonText, 'i') }).click();
  }

  /**
   * Check for form validation errors
   */
  async checkValidationErrors(expectedErrors: string[]) {
    for (const error of expectedErrors) {
      await expect(this.page.getByText(new RegExp(error, 'i'))).toBeVisible();
    }
  }

  /**
   * Clear all form fields
   */
  async clearForm() {
    const inputs = this.page.getByRole('textbox');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      await inputs.nth(i).clear();
    }
  }
}

/**
 * Data table helper functions
 */
export class TableHelpers {
  constructor(private page: Page) {}

  /**
   * Get table row by text content
   */
  async getRowByText(text: string): Promise<Locator> {
    return this.page.getByRole('row').filter({ hasText: text });
  }

  /**
   * Click action button in table row
   */
  async clickRowAction(rowText: string, actionText: string) {
    const row = await this.getRowByText(rowText);
    await row.getByRole('button', { name: new RegExp(actionText, 'i') }).click();
  }

  /**
   * Sort table by column
   */
  async sortByColumn(columnName: string) {
    await this.page.getByRole('columnheader', { name: new RegExp(columnName, 'i') }).click();
  }

  /**
   * Filter table
   */
  async filterTable(searchText: string) {
    const searchInput = this.page.getByPlaceholder(/search/i).or(
      this.page.getByRole('textbox', { name: /filter/i })
    );
    
    await searchInput.fill(searchText);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Get table row count
   */
  async getRowCount(): Promise<number> {
    const rows = this.page.getByRole('row');
    return await rows.count() - 1; // Subtract header row
  }

  /**
   * Check if table contains text
   */
  async containsText(text: string): Promise<boolean> {
    try {
      await expect(this.page.getByRole('table')).toContainText(text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Modal and dialog helper functions
 */
export class ModalHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for modal to open
   */
  async waitForModal(modalTitle?: string) {
    if (modalTitle) {
      await expect(this.page.getByRole('dialog')).toContainText(modalTitle);
    } else {
      await expect(this.page.getByRole('dialog')).toBeVisible();
    }
  }

  /**
   * Close modal
   */
  async closeModal() {
    // Try close button first
    const closeButton = this.page.getByRole('button', { name: /close/i }).or(
      this.page.getByRole('button', { name: /cancel/i })
    );
    
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Try escape key
      await this.page.keyboard.press('Escape');
    }
    
    await expect(this.page.getByRole('dialog')).not.toBeVisible();
  }

  /**
   * Confirm action in modal
   */
  async confirmModal(confirmText: string = 'confirm') {
    await this.page.getByRole('button', { name: new RegExp(confirmText, 'i') }).click();
  }
}

/**
 * API mock helper functions
 */
export class APIMockHelpers {
  constructor(private page: Page) {}

  /**
   * Mock API response
   */
  async mockAPIResponse(pattern: string, response: any, status: number = 200) {
    await this.page.route(pattern, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Mock API error
   */
  async mockAPIError(pattern: string, status: number = 500, message: string = 'Server Error') {
    await this.page.route(pattern, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: message })
      });
    });
  }

  /**
   * Mock network failure
   */
  async mockNetworkFailure(pattern: string) {
    await this.page.route(pattern, route => route.abort());
  }

  /**
   * Mock slow response
   */
  async mockSlowResponse(pattern: string, delay: number = 5000) {
    await this.page.route(pattern, async route => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.continue();
    });
  }
}

/**
 * Wait helper functions
 */
export class WaitHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for loading to complete
   */
  async waitForLoading() {
    // Wait for loading indicators to disappear
    await this.page.locator('[data-testid="loading"], .loading, [aria-label="Loading"]')
      .first()
      .waitFor({ state: 'hidden', timeout: TEST_CONSTANTS.TIMEOUTS.MEDIUM });
  }

  /**
   * Wait for toast notification
   */
  async waitForToast(message?: string | RegExp) {
    const toast = this.page.locator('.toast, [data-testid="toast"], [role="alert"]');
    
    if (message) {
      await expect(toast).toContainText(message);
    } else {
      await expect(toast).toBeVisible();
    }
  }

  /**
   * Wait for page transition
   */
  async waitForPageTransition() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(TEST_CONSTANTS.WAIT_FOR_ANIMATION);
  }

  /**
   * Wait for element to be stable
   */
  async waitForStable(locator: Locator) {
    await locator.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(TEST_CONSTANTS.WAIT_FOR_ANIMATION);
  }
}

/**
 * Accessibility helper functions
 */
export class AccessibilityHelpers {
  constructor(private page: Page) {}

  /**
   * Check keyboard navigation
   */
  async testKeyboardNavigation(expectedFocusOrder: string[]) {
    // Start from beginning
    await this.page.keyboard.press('Tab');
    
    for (const expected of expectedFocusOrder) {
      const focused = await this.page.locator(':focus');
      await expect(focused).toHaveAttribute('aria-label', expected);
      await this.page.keyboard.press('Tab');
    }
  }

  /**
   * Check ARIA labels
   */
  async checkARIALabels(requiredLabels: string[]) {
    for (const label of requiredLabels) {
      await expect(this.page.getByRole('button', { name: label }).or(
        this.page.getByRole('textbox', { name: label })
      )).toBeVisible();
    }
  }

  /**
   * Check color contrast
   */
  async checkColorContrast() {
    // This would integrate with axe-core or similar tool
    // For now, just check that high contrast mode works
    await this.page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          * { border: 1px solid black !important; }
        }
      `
    });
    
    // Verify elements are still visible
    await expect(this.page.getByRole('main')).toBeVisible();
  }
}

/**
 * Create helper instances for a page
 */
export function createHelpers(page: Page) {
  return {
    auth: new AuthHelpers(page),
    navigation: new NavigationHelpers(page),
    form: new FormHelpers(page),
    table: new TableHelpers(page),
    modal: new ModalHelpers(page),
    api: new APIMockHelpers(page),
    wait: new WaitHelpers(page),
    a11y: new AccessibilityHelpers(page)
  };
}

/**
 * Common test setup function
 */
export async function setupTest(page: Page, userType: 'doctor' | 'nurse' | 'admin' = 'doctor') {
  const helpers = createHelpers(page);
  
  // Login and wait for dashboard
  await helpers.auth.loginAsUser(userType);
  await helpers.wait.waitForPageTransition();
  
  return helpers;
}

/**
 * Common test cleanup function
 */
export async function cleanupTest(page: Page) {
  try {
    // Clear any open modals
    await page.keyboard.press('Escape');
    
    // Clear local storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Reset API route mocks
    await page.unrouteAll();
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
}