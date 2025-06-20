import { test, expect } from '@playwright/test';

test.describe('Clinical Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Authentication Flow', () => {
    test('should login as doctor successfully', async ({ page }) => {
      // Fill in doctor credentials using demo button
      await page.getByRole('button', { name: 'Doctor' }).click();
      
      // Verify form is filled
      await expect(page.getByLabel(/email address/i)).toHaveValue('doctor@omnicare.com');
      await expect(page.getByLabel(/password/i)).toHaveValue('demo123');
      
      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Verify successful login by checking for dashboard redirect
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Verify user is logged in by checking for user info
      await expect(page.getByText(/welcome/i)).toBeVisible();
    });

    test('should handle login validation errors', async ({ page }) => {
      // Try to login without credentials
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Verify validation errors appear
      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
    });

    test('should handle invalid credentials', async ({ page }) => {
      // Fill in invalid credentials
      await page.getByLabel(/email address/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      
      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Verify error message appears
      await expect(page.getByText(/login failed/i)).toBeVisible();
    });

    test('should navigate between demo user types', async ({ page }) => {
      // Test Doctor login
      await page.getByRole('button', { name: 'Doctor' }).click();
      await expect(page.getByLabel(/email address/i)).toHaveValue('doctor@omnicare.com');
      
      // Test Nurse login
      await page.getByRole('button', { name: 'Nurse' }).click();
      await expect(page.getByLabel(/email address/i)).toHaveValue('nurse@omnicare.com');
      
      // Test Admin login
      await page.getByRole('button', { name: 'Admin' }).click();
      await expect(page.getByLabel(/email address/i)).toHaveValue('admin@omnicare.com');
    });
  });

  test.describe('Patient Management Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login as doctor before each test
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
    });

    test('should navigate to patient list', async ({ page }) => {
      // Navigate to patients page
      await page.getByRole('link', { name: /patients/i }).click();
      
      // Verify we're on the patients page
      await expect(page).toHaveURL(/\/patients/);
      await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();
    });

    test('should search for patients', async ({ page }) => {
      // Navigate to patients page
      await page.getByRole('link', { name: /patients/i }).click();
      
      // Search for a patient
      const searchInput = page.getByPlaceholder(/search patients/i);
      await searchInput.fill('John Doe');
      await page.keyboard.press('Enter');
      
      // Verify search results
      await expect(page.getByText(/search results/i)).toBeVisible();
    });

    test('should create new patient', async ({ page }) => {
      // Navigate to patients page
      await page.getByRole('link', { name: /patients/i }).click();
      
      // Click create new patient button
      await page.getByRole('button', { name: /new patient/i }).click();
      
      // Fill out patient form
      await page.getByLabel(/first name/i).fill('Jane');
      await page.getByLabel(/last name/i).fill('Smith');
      await page.getByLabel(/email/i).fill('jane.smith@example.com');
      await page.getByLabel(/phone/i).fill('555-0199');
      await page.getByLabel(/date of birth/i).fill('1985-05-15');
      await page.getByLabel(/gender/i).selectOption('female');
      
      // Fill address information
      await page.getByLabel(/street address/i).fill('456 Oak Ave');
      await page.getByLabel(/city/i).fill('Springfield');
      await page.getByLabel(/state/i).fill('IL');
      await page.getByLabel(/zip code/i).fill('62701');
      
      // Submit the form
      await page.getByRole('button', { name: /create patient/i }).click();
      
      // Verify patient was created
      await expect(page.getByText(/patient created successfully/i)).toBeVisible();
    });

    test('should view patient details', async ({ page }) => {
      // Navigate to patients page
      await page.getByRole('link', { name: /patients/i }).click();
      
      // Click on a patient in the list
      await page.getByRole('button', { name: /view patient/i }).first().click();
      
      // Verify patient details page loads
      await expect(page).toHaveURL(/\/patients\/[^\/]+$/);
      await expect(page.getByTestId('patient-header')).toBeVisible();
    });
  });

  test.describe('Clinical Documentation Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login as doctor and navigate to patient
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
      
      // Navigate to a patient
      await page.getByRole('link', { name: /patients/i }).click();
      await page.getByRole('button', { name: /view patient/i }).first().click();
    });

    test('should create new encounter', async ({ page }) => {
      // Click new encounter button
      await page.getByRole('button', { name: /new encounter/i }).click();
      
      // Fill encounter form
      await page.getByLabel(/encounter type/i).selectOption('routine');
      await page.getByLabel(/chief complaint/i).fill('Annual physical examination');
      await page.getByLabel(/visit reason/i).fill('Routine checkup');
      
      // Set encounter date and time
      const today = new Date().toISOString().split('T')[0];
      await page.getByLabel(/encounter date/i).fill(today);
      await page.getByLabel(/encounter time/i).fill('10:00');
      
      // Submit encounter
      await page.getByRole('button', { name: /create encounter/i }).click();
      
      // Verify encounter created
      await expect(page.getByText(/encounter created/i)).toBeVisible();
    });

    test('should record vital signs', async ({ page }) => {
      // Navigate to vitals section
      await page.getByRole('tab', { name: /vitals/i }).click();
      
      // Click add vitals button
      await page.getByRole('button', { name: /add vitals/i }).click();
      
      // Fill vital signs
      await page.getByLabel(/temperature/i).fill('98.6');
      await page.getByLabel(/systolic/i).fill('120');
      await page.getByLabel(/diastolic/i).fill('80');
      await page.getByLabel(/heart rate/i).fill('72');
      await page.getByLabel(/respiratory rate/i).fill('16');
      await page.getByLabel(/oxygen saturation/i).fill('98');
      await page.getByLabel(/weight/i).fill('160');
      await page.getByLabel(/height/i).fill('68');
      
      // Submit vitals
      await page.getByRole('button', { name: /save vitals/i }).click();
      
      // Verify vitals saved
      await expect(page.getByText(/vitals recorded/i)).toBeVisible();
    });

    test('should create assessment and plan', async ({ page }) => {
      // Navigate to assessment section
      await page.getByRole('tab', { name: /assessment/i }).click();
      
      // Add assessment
      await page.getByLabel(/assessment/i).fill('Patient appears healthy. No acute concerns.');
      
      // Add plan
      await page.getByLabel(/plan/i).fill('Continue current medications. Follow up in 6 months.');
      
      // Add diagnosis
      await page.getByRole('button', { name: /add diagnosis/i }).click();
      await page.getByLabel(/diagnosis code/i).fill('Z00.00');
      await page.getByLabel(/diagnosis description/i).fill('Encounter for general adult medical examination without abnormal findings');
      
      // Submit assessment
      await page.getByRole('button', { name: /save assessment/i }).click();
      
      // Verify assessment saved
      await expect(page.getByText(/assessment saved/i)).toBeVisible();
    });
  });

  test.describe('Medication Management Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login as doctor and navigate to patient
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
      
      // Navigate to a patient
      await page.getByRole('link', { name: /patients/i }).click();
      await page.getByRole('button', { name: /view patient/i }).first().click();
    });

    test('should prescribe medication', async ({ page }) => {
      // Navigate to medications tab
      await page.getByRole('tab', { name: /medications/i }).click();
      
      // Click prescribe medication button
      await page.getByRole('button', { name: /prescribe medication/i }).click();
      
      // Search for medication
      await page.getByLabel(/medication search/i).fill('Lisinopril');
      await page.getByRole('option', { name: /lisinopril 10mg/i }).click();
      
      // Fill prescription details
      await page.getByLabel(/dosage/i).fill('10mg');
      await page.getByLabel(/frequency/i).selectOption('once daily');
      await page.getByLabel(/duration/i).fill('30 days');
      await page.getByLabel(/quantity/i).fill('30');
      await page.getByLabel(/refills/i).fill('5');
      
      // Add instructions
      await page.getByLabel(/instructions/i).fill('Take once daily with or without food');
      
      // Submit prescription
      await page.getByRole('button', { name: /prescribe/i }).click();
      
      // Verify prescription created
      await expect(page.getByText(/prescription created/i)).toBeVisible();
    });

    test('should check drug interactions', async ({ page }) => {
      // Navigate to medications tab
      await page.getByRole('tab', { name: /medications/i }).click();
      
      // Click prescribe medication button
      await page.getByRole('button', { name: /prescribe medication/i }).click();
      
      // Search for medication that might have interactions
      await page.getByLabel(/medication search/i).fill('Warfarin');
      await page.getByRole('option', { name: /warfarin 5mg/i }).click();
      
      // Check for interaction warnings
      await expect(page.getByText(/drug interaction warning/i)).toBeVisible();
      
      // Verify interaction details are displayed
      await expect(page.getByText(/potential interactions/i)).toBeVisible();
    });

    test('should manage medication allergies', async ({ page }) => {
      // Navigate to allergies tab
      await page.getByRole('tab', { name: /allergies/i }).click();
      
      // Click add allergy button
      await page.getByRole('button', { name: /add allergy/i }).click();
      
      // Fill allergy information
      await page.getByLabel(/allergen/i).fill('Penicillin');
      await page.getByLabel(/reaction/i).fill('Skin rash');
      await page.getByLabel(/severity/i).selectOption('moderate');
      await page.getByLabel(/onset date/i).fill('2020-01-15');
      
      // Submit allergy
      await page.getByRole('button', { name: /save allergy/i }).click();
      
      // Verify allergy saved
      await expect(page.getByText(/allergy recorded/i)).toBeVisible();
    });
  });

  test.describe('Laboratory Orders Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login as doctor and navigate to patient
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
      
      // Navigate to a patient
      await page.getByRole('link', { name: /patients/i }).click();
      await page.getByRole('button', { name: /view patient/i }).first().click();
    });

    test('should order laboratory tests', async ({ page }) => {
      // Navigate to lab orders tab
      await page.getByRole('tab', { name: /lab orders/i }).click();
      
      // Click new lab order button
      await page.getByRole('button', { name: /new lab order/i }).click();
      
      // Select lab tests
      await page.getByLabel(/basic metabolic panel/i).check();
      await page.getByLabel(/complete blood count/i).check();
      await page.getByLabel(/lipid panel/i).check();
      
      // Add special instructions
      await page.getByLabel(/special instructions/i).fill('Patient is fasting');
      
      // Set priority
      await page.getByLabel(/priority/i).selectOption('routine');
      
      // Submit order
      await page.getByRole('button', { name: /submit order/i }).click();
      
      // Verify order submitted
      await expect(page.getByText(/lab order submitted/i)).toBeVisible();
    });

    test('should view lab results', async ({ page }) => {
      // Navigate to lab results tab
      await page.getByRole('tab', { name: /lab results/i }).click();
      
      // Check for results list
      await expect(page.getByRole('table')).toBeVisible();
      
      // Click on a result to view details
      await page.getByRole('button', { name: /view results/i }).first().click();
      
      // Verify result details modal opens
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/lab result details/i)).toBeVisible();
    });
  });

  test.describe('Accessibility and Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Login as doctor
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
    });

    test('should navigate using keyboard', async ({ page }) => {
      // Test keyboard navigation in main menu
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Verify navigation worked
      await expect(page).toHaveURL(/\/patients/);
    });

    test('should have proper heading structure', async ({ page }) => {
      // Check for proper heading hierarchy
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      
      const h2 = page.getByRole('heading', { level: 2 });
      await expect(h2.first()).toBeVisible();
    });

    test('should have accessible form labels', async ({ page }) => {
      // Navigate to patient creation form
      await page.getByRole('link', { name: /patients/i }).click();
      await page.getByRole('button', { name: /new patient/i }).click();
      
      // Check that all form inputs have associated labels
      const inputs = page.getByRole('textbox');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const labelledBy = await input.getAttribute('aria-labelledby');
        const label = await input.getAttribute('aria-label');
        
        expect(labelledBy || label).toBeTruthy();
      }
    });

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast mode (simulated through CSS)
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            * { border: 1px solid black !important; }
          }
        `
      });
      
      // Verify elements are still visible and distinguishable
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('navigation')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      // Login first
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to navigate to patients
      await page.getByRole('link', { name: /patients/i }).click();
      
      // Verify error message is displayed
      await expect(page.getByText(/unable to load/i)).toBeVisible();
    });

    test('should handle session timeout', async ({ page }) => {
      // Login first
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
      
      // Simulate session timeout by returning 401
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      });
      
      // Try to make an API call
      await page.getByRole('link', { name: /patients/i }).click();
      
      // Verify redirect to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should validate form inputs', async ({ page }) => {
      // Login and navigate to patient creation
      await page.getByRole('button', { name: 'Doctor' }).click();
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/);
      
      await page.getByRole('link', { name: /patients/i }).click();
      await page.getByRole('button', { name: /new patient/i }).click();
      
      // Try to submit form with invalid email
      await page.getByLabel(/first name/i).fill('John');
      await page.getByLabel(/last name/i).fill('Doe');
      await page.getByLabel(/email/i).fill('invalid-email');
      
      await page.getByRole('button', { name: /create patient/i }).click();
      
      // Verify validation error
      await expect(page.getByText(/invalid email/i)).toBeVisible();
    });
  });
});