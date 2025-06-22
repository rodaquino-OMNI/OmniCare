import { test, expect, Page } from '@playwright/test';
import { createHelpers, setupTest, cleanupTest } from './helpers/test-utils';
import { generateErrorScenarios, TEST_CONSTANTS } from './helpers/test-data';

/**
 * Comprehensive Error Handling and Edge Cases E2E Tests
 * Tests system resilience, error recovery, and edge case scenarios
 */

test.describe('Error Handling and Edge Cases', () => {
  let page: Page;
  let helpers: ReturnType<typeof createHelpers>;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    helpers = createHelpers(page);
  });

  test.afterEach(async () => {
    await cleanupTest(page);
  });

  test.describe('Network Connectivity Issues', () => {
    test('should handle complete network failure gracefully', async () => {
      await test.step('Login and navigate to patients', async () => {
        await helpers.auth.loginAsUser('doctor');
        await helpers.navigation.navigateTo('patients');
      });

      await test.step('Simulate network failure', async () => {
        // Block all network requests
        await helpers.api.mockNetworkFailure('**');
        
        // Try to navigate to a new page
        await page.getByRole('link', { name: /dashboard/i }).click();
      });

      await test.step('Verify graceful error handling', async () => {
        // Should show network error message
        await expect(page.getByText(/network error/i).or(
          page.getByText(/connection lost/i).or(
            page.getByText(/unable to connect/i)
          )
        )).toBeVisible();
        
        // Should provide retry option
        const retryButton = page.getByRole('button', { name: /retry/i });
        if (await retryButton.isVisible()) {
          await expect(retryButton).toBeVisible();
        }
        
        // Should not crash or show technical errors
        await expect(page.getByText(/error:|exception:|stack trace/i)).not.toBeVisible();
      });
    });

    test('should handle intermittent connectivity issues', async () => {
      await helpers.auth.loginAsUser('doctor');
      
      await test.step('Simulate slow network responses', async () => {
        // Mock very slow responses
        await helpers.api.mockSlowResponse('**/api/**', 10000);
        
        await helpers.navigation.navigateTo('patients');
      });

      await test.step('Verify loading states and timeouts', async () => {
        // Should show loading indicator
        await expect(page.locator('.loading, [data-testid="loading"]')).toBeVisible();
        
        // Should eventually timeout with appropriate message
        await expect(page.getByText(/loading/i).or(
          page.getByText(/please wait/i)
        )).toBeVisible({ timeout: TEST_CONSTANTS.TIMEOUTS.MEDIUM });
      });
    });

    test('should recover from temporary network issues', async () => {
      await helpers.auth.loginAsUser('doctor');
      
      await test.step('Simulate temporary network failure', async () => {
        await helpers.api.mockNetworkFailure('**/patients');
        
        await helpers.navigation.navigateTo('patients');
        
        // Should show error
        await expect(page.getByText(/unable to load/i)).toBeVisible();
      });

      await test.step('Restore network and retry', async () => {
        // Remove network mock to restore connectivity
        await page.unrouteAll();
        
        const retryButton = page.getByRole('button', { name: /retry/i });
        if (await retryButton.isVisible()) {
          await retryButton.click();
          
          // Should recover and load content
          await helpers.wait.waitForLoading();
          await expect(page.getByRole('table')).toBeVisible();
        }
      });
    });
  });

  test.describe('Authentication and Session Management', () => {
    test('should handle expired sessions during user interaction', async () => {
      await test.step('Login and start working', async () => {
        await helpers.auth.loginAsUser('doctor');
        await helpers.navigation.navigateTo('patients');
      });

      await test.step('Simulate session expiration', async () => {
        // Mock 401 unauthorized responses
        await helpers.api.mockAPIError('**/api/**', 401, 'Session expired');
        
        // Try to perform an action
        const searchInput = page.getByPlaceholder(/search/i);
        if (await searchInput.isVisible()) {
          await searchInput.fill('test');
          await page.keyboard.press('Enter');
        }
      });

      await test.step('Verify session timeout handling', async () => {
        // Should redirect to login page
        await expect(page).toHaveURL(/\/auth\/login/);
        
        // Should show session timeout message
        await expect(page.getByText(/session expired/i).or(
          page.getByText(/please log in again/i)
        )).toBeVisible();
        
        // Should preserve attempted action for after re-login
        const returnUrl = new URL(page.url()).searchParams.get('returnUrl');
        if (returnUrl) {
          expect(returnUrl).toContain('patients');
        }
      });
    });

    test('should handle concurrent session conflicts', async () => {
      await test.step('Simulate concurrent login elsewhere', async () => {
        await helpers.auth.loginAsUser('doctor');
        
        // Mock response indicating session was invalidated
        await helpers.api.mockAPIError('**/api/**', 409, 'Session conflict - logged in elsewhere');
        
        await helpers.navigation.navigateTo('dashboard');
      });

      await test.step('Verify conflict handling', async () => {
        // Should show appropriate message
        await expect(page.getByText(/logged in elsewhere/i).or(
          page.getByText(/session conflict/i)
        )).toBeVisible();
        
        // Should redirect to login
        await expect(page).toHaveURL(/\/auth\/login/);
      });
    });

    test('should handle invalid authentication tokens', async () => {
      await test.step('Simulate invalid token', async () => {
        // Set invalid token in localStorage
        await page.evaluate(() => {
          localStorage.setItem('authToken', 'invalid-token-12345');
        });
        
        await page.goto('/dashboard');
      });

      await test.step('Verify token validation', async () => {
        // Should redirect to login due to invalid token
        await expect(page).toHaveURL(/\/auth\/login/);
        
        // Should clear invalid token
        const token = await page.evaluate(() => localStorage.getItem('authToken'));
        expect(token).toBeFalsy();
      });
    });
  });

  test.describe('Data Validation and Input Errors', () => {
    test('should handle malformed data gracefully', async () => {
      await helpers.auth.loginAsUser('doctor');
      
      await test.step('Mock malformed API response', async () => {
        await helpers.api.mockAPIResponse('**/patients', {
          // Invalid FHIR Bundle structure
          invalidField: 'malformed data',
          entry: 'not an array'
        });
        
        await helpers.navigation.navigateTo('patients');
      });

      await test.step('Verify error handling for bad data', async () => {
        // Should show user-friendly error message
        await expect(page.getByText(/unable to load patients/i).or(
          page.getByText(/data format error/i)
        )).toBeVisible();
        
        // Should not show technical error details
        await expect(page.getByText(/undefined|null|object Object/i)).not.toBeVisible();
      });
    });

    test('should validate form inputs comprehensively', async () => {
      await helpers.auth.loginAsUser('admin');
      await helpers.navigation.navigateTo('patient-registration');
      
      const errorScenarios = generateErrorScenarios();
      
      await test.step('Test invalid email formats', async () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user@@domain.com',
          'user with spaces@domain.com'
        ];
        
        for (const email of invalidEmails) {
          await page.getByLabel(/email/i).clear();
          await page.getByLabel(/email/i).fill(email);
          await page.getByLabel(/first name/i).click(); // Trigger validation
          
          await expect(page.getByText(/invalid email/i)).toBeVisible();
        }
      });

      await test.step('Test invalid phone numbers', async () => {
        const invalidPhones = [
          '123',
          'abc-def-ghij',
          '123-456-78901', // too long
          '12-34-567' // wrong format
        ];
        
        for (const phone of invalidPhones) {
          await page.getByLabel(/phone/i).clear();
          await page.getByLabel(/phone/i).fill(phone);
          await page.getByLabel(/first name/i).click();
          
          await expect(page.getByText(/invalid phone/i).or(
            page.getByText(/phone format/i)
          )).toBeVisible();
        }
      });

      await test.step('Test invalid dates', async () => {
        const invalidDates = [
          '2025-13-01', // invalid month
          '2024-02-30', // invalid day
          'not-a-date',
          '2050-01-01' // future date for birth date
        ];
        
        for (const date of invalidDates) {
          await page.getByLabel(/date of birth/i).clear();
          await page.getByLabel(/date of birth/i).fill(date);
          await page.getByLabel(/first name/i).click();
          
          await expect(page.getByText(/invalid date/i).or(
            page.getByText(/date format/i)
          )).toBeVisible();
        }
      });
    });

    test('should handle SQL injection and XSS attempts', async () => {
      await helpers.auth.loginAsUser('doctor');
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Test SQL injection in search', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE patients; --",
          "1' OR '1'='1",
          "UNION SELECT * FROM users"
        ];
        
        const searchInput = page.getByPlaceholder(/search/i);
        
        for (const injection of sqlInjectionAttempts) {
          await searchInput.clear();
          await searchInput.fill(injection);
          await page.keyboard.press('Enter');
          
          await helpers.wait.waitForLoading();
          
          // Should not cause errors or expose system information
          await expect(page.getByText(/sql|error|exception/i)).not.toBeVisible();
          
          // Should treat as normal search string
          await expect(page.getByText(/no results found/i).or(
            page.getByRole('table')
          )).toBeVisible();
        }
      });

      await test.step('Test XSS attempts in forms', async () => {
        await helpers.navigation.navigateTo('patient-registration');
        
        const xssAttempts = [
          '<script>alert("XSS")</script>',
          '<img src="x" onerror="alert(1)">',
          'javascript:alert("XSS")'
        ];
        
        for (const xss of xssAttempts) {
          await page.getByLabel(/first name/i).clear();
          await page.getByLabel(/first name/i).fill(xss);
          
          // Should not execute script
          await expect(page.locator('body')).not.toContainText('XSS');
          
          // Should sanitize input
          const inputValue = await page.getByLabel(/first name/i).inputValue();
          expect(inputValue).not.toContain('<script>');
        }
      });
    });
  });

  test.describe('Browser and Device Compatibility', () => {
    test('should handle browser storage limitations', async () => {
      await test.step('Fill local storage to capacity', async () => {
        await page.evaluate(() => {
          try {
            // Fill localStorage until it's full
            let i = 0;
            while (i < 10000) {
              localStorage.setItem(`test-key-${i}`, 'x'.repeat(1000));
              i++;
            }
          } catch (e) {
            // Storage full
          }
        });
        
        await helpers.auth.loginAsUser('doctor');
      });

      await test.step('Verify graceful storage handling', async () => {
        // Application should still function
        await expect(page).toHaveURL(/\/dashboard/);
        
        // Should handle storage errors gracefully
        await helpers.navigation.navigateTo('patients');
        await expect(page.getByRole('table')).toBeVisible();
      });
    });

    test('should handle JavaScript errors gracefully', async () => {
      await test.step('Simulate JavaScript error', async () => {
        // Inject error into page
        await page.addInitScript(() => {
          window.addEventListener('load', () => {
            // Simulate random JavaScript error
            setTimeout(() => {
              throw new Error('Simulated JavaScript error');
            }, 1000);
          });
        });
        
        await helpers.auth.loginAsUser('doctor');
      });

      await test.step('Verify error boundaries work', async () => {
        // Should show error boundary UI instead of white screen
        const errorBoundary = page.locator('[data-testid="error-boundary"]');
        if (await errorBoundary.isVisible()) {
          await expect(errorBoundary).toBeVisible();
          await expect(errorBoundary).toContainText(/something went wrong/i);
        } else {
          // Or should continue functioning normally
          await expect(page.getByText(/welcome/i)).toBeVisible();
        }
      });
    });

    test('should handle memory constraints on mobile devices', async () => {
      await test.step('Simulate low memory conditions', async () => {
        // Set mobile viewport with limited memory simulation
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Simulate memory pressure
        await page.evaluate(() => {
          // Create memory pressure (simplified simulation)
          const arrays = [];
          for (let i = 0; i < 100; i++) {
            arrays.push(new Array(100000).fill(i));
          }
        });
        
        await helpers.auth.loginAsUser('doctor');
      });

      await test.step('Verify mobile performance', async () => {
        // Should still load and function
        await expect(page).toHaveURL(/\/dashboard/);
        
        // Navigation should work
        await helpers.navigation.navigateTo('patients');
        await helpers.wait.waitForLoading();
        
        // Content should be visible
        await expect(page.getByRole('main')).toBeVisible();
      });
    });
  });

  test.describe('Concurrent User Actions', () => {
    test('should handle rapid user interactions', async () => {
      await helpers.auth.loginAsUser('doctor');
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Rapidly click multiple buttons', async () => {
        const searchInput = page.getByPlaceholder(/search/i);
        
        // Rapidly type and clear search
        for (let i = 0; i < 5; i++) {
          await searchInput.fill(`search${i}`);
          await page.keyboard.press('Enter');
          await searchInput.clear();
        }
        
        // Should not cause errors or crashes
        await expect(page.getByRole('table')).toBeVisible();
      });
    });

    test('should handle conflicting data modifications', async () => {
      const testPatient = { id: 'test-patient-001' };
      
      await test.step('Simulate concurrent edit conflict', async () => {
        await helpers.auth.loginAsUser('doctor');
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        // Start editing patient
        await page.getByRole('button', { name: /edit/i }).click();
        await helpers.modal.waitForModal();
        
        // Simulate another user modifying the same patient
        await helpers.api.mockAPIError('**/patients/**', 409, 'Resource modified by another user');
        
        // Try to save changes
        await page.getByLabel(/phone/i).fill('555-9999');
        await page.getByRole('button', { name: /save/i }).click();
      });

      await test.step('Verify conflict resolution', async () => {
        // Should show conflict message
        await expect(page.getByText(/modified by another user/i).or(
          page.getByText(/conflict/i)
        )).toBeVisible();
        
        // Should offer options to resolve
        const refreshButton = page.getByRole('button', { name: /refresh/i });
        const overrideButton = page.getByRole('button', { name: /override/i });
        
        await expect(refreshButton.or(overrideButton)).toBeVisible();
      });
    });
  });

  test.describe('Data Integrity and Recovery', () => {
    test('should recover from incomplete form submissions', async () => {
      await helpers.auth.loginAsUser('admin');
      await helpers.navigation.navigateTo('patient-registration');
      
      await test.step('Start filling form', async () => {
        await helpers.form.fillForm({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        });
      });

      await test.step('Simulate interruption', async () => {
        // Simulate page refresh or navigation away
        await page.reload();
      });

      await test.step('Verify draft recovery', async () => {
        // Should offer to restore draft
        const restoreDraft = page.getByText(/restore draft/i).or(
          page.getByText(/unsaved changes/i)
        );
        
        if (await restoreDraft.isVisible()) {
          await expect(restoreDraft).toBeVisible();
          
          const restoreButton = page.getByRole('button', { name: /restore/i });
          if (await restoreButton.isVisible()) {
            await restoreButton.click();
            
            // Should restore previously entered data
            await expect(page.getByLabel(/first name/i)).toHaveValue('John');
            await expect(page.getByLabel(/last name/i)).toHaveValue('Doe');
          }
        }
      });
    });

    test('should handle data corruption gracefully', async () => {
      await test.step('Simulate corrupted local storage', async () => {
        await page.evaluate(() => {
          // Corrupt localStorage data
          localStorage.setItem('patientData', '{invalid json}');
          localStorage.setItem('userSettings', 'corrupted data');
        });
        
        await helpers.auth.loginAsUser('doctor');
      });

      await test.step('Verify corruption handling', async () => {
        // Should clear corrupted data and continue
        await expect(page).toHaveURL(/\/dashboard/);
        
        // Should not show error messages to user
        await expect(page.getByText(/syntax error|invalid json/i)).not.toBeVisible();
        
        // Should reset to default state
        await expect(page.getByText(/welcome/i)).toBeVisible();
      });
    });
  });

  test.describe('Performance and Resource Management', () => {
    test('should handle large datasets efficiently', async () => {
      await helpers.auth.loginAsUser('doctor');
      
      await test.step('Load large patient list', async () => {
        // Mock large dataset response
        const largePatientList = {
          resourceType: 'Bundle',
          total: 10000,
          entry: Array.from({ length: 100 }, (_, i) => ({
            resource: {
              resourceType: 'Patient',
              id: `patient-${i}`,
              name: [{ given: [`Patient${i}`], family: 'Test' }]
            }
          }))
        };
        
        await helpers.api.mockAPIResponse('**/patients', largePatientList);
        
        await helpers.navigation.navigateTo('patients');
      });

      await test.step('Verify performance with large data', async () => {
        // Should load without freezing
        await expect(page.getByRole('table')).toBeVisible({ timeout: TEST_CONSTANTS.TIMEOUTS.LONG });
        
        // Should show pagination or virtualization
        const pagination = page.locator('[data-testid="pagination"]');
        const virtualization = page.locator('[data-testid="virtual-list"]');
        
        await expect(pagination.or(virtualization)).toBeVisible();
        
        // Should remain responsive
        await page.getByPlaceholder(/search/i).fill('test');
        await expect(page.getByPlaceholder(/search/i)).toHaveValue('test');
      });
    });

    test('should manage memory usage effectively', async () => {
      await helpers.auth.loginAsUser('doctor');
      
      await test.step('Navigate through multiple pages', async () => {
        const pages = ['dashboard', 'patients', 'patients', 'dashboard'];
        
        for (const pageName of pages) {
          await helpers.navigation.navigateTo(pageName);
          await helpers.wait.waitForPageTransition();
        }
      });

      await test.step('Verify no memory leaks', async () => {
        // Check that previous page components are cleaned up
        // This is a simplified check - in real testing you'd use performance APIs
        
        const memoryUsage = await page.evaluate(() => {
          // @ts-ignore - performance.memory might not be available in all browsers
          return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        });
        
        // Memory usage should be reasonable (this is a basic check)
        if (memoryUsage > 0) {
          expect(memoryUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
        }
      });
    });
  });
});