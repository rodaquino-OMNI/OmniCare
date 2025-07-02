import { test, expect, Page } from '@playwright/test';
import { generateMockPatient, generateMockSSN } from './helpers/test-data';

test.describe('Patient Registration Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // Login as administrative user
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@omnicare.com');
    await page.fill('input[name="password"]', 'AdminTest123!');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Navigate to patient registration
    await page.click('text=Patient Registration');
    await page.waitForURL('/admin/patients/register');
  });

  test('should complete full patient registration with all required fields', async () => {
    const mockPatient = generateMockPatient();
    
    // Demographics Section
    await test.step('Fill demographics information', async () => {
      await page.fill('input[name="firstName"]', mockPatient.firstName);
      await page.fill('input[name="middleName"]', mockPatient.middleName || '');
      await page.fill('input[name="lastName"]', mockPatient.lastName);
      await page.fill('input[name="dateOfBirth"]', mockPatient.dateOfBirth);
      await page.selectOption('select[name="gender"]', mockPatient.gender);
      await page.fill('input[name="ssn"]', mockPatient.ssn);
      
      // Verify age calculation
      await expect(page.locator('[data-testid="calculated-age"]')).toHaveText(/\d+ years/);
    });

    // Contact Information
    await test.step('Fill contact information', async () => {
      await page.fill('input[name="email"]', mockPatient.email);
      await page.fill('input[name="phone"]', mockPatient.phone);
      await page.fill('input[name="addressLine1"]', mockPatient.address.line1);
      await page.fill('input[name="addressLine2"]', mockPatient.address.line2 || '');
      await page.fill('input[name="city"]', mockPatient.address.city);
      await page.selectOption('select[name="state"]', mockPatient.address.state);
      await page.fill('input[name="zipCode"]', mockPatient.address.zipCode);
    });

    // Emergency Contact
    await test.step('Add emergency contact', async () => {
      await page.click('button:text("Add Emergency Contact")');
      await page.fill('input[name="emergencyContact.name"]', mockPatient.emergencyContact.name);
      await page.fill('input[name="emergencyContact.relationship"]', mockPatient.emergencyContact.relationship);
      await page.fill('input[name="emergencyContact.phone"]', mockPatient.emergencyContact.phone);
    });

    // Insurance Information
    await test.step('Add insurance information', async () => {
      await page.click('button:text("Add Insurance")');
      await page.selectOption('select[name="insurance.type"]', 'primary');
      await page.fill('input[name="insurance.provider"]', mockPatient.insurance.provider);
      await page.fill('input[name="insurance.policyNumber"]', mockPatient.insurance.policyNumber);
      await page.fill('input[name="insurance.groupNumber"]', mockPatient.insurance.groupNumber);
      await page.fill('input[name="insurance.subscriberName"]', `${mockPatient.firstName} ${mockPatient.lastName}`);
      await page.fill('input[name="insurance.subscriberDOB"]', mockPatient.dateOfBirth);
    });

    // Medical History
    await test.step('Add medical history', async () => {
      // Allergies
      await page.click('button:text("Add Allergy")');
      await page.fill('input[placeholder="Allergen"]', 'Penicillin');
      await page.selectOption('select[name="allergy.severity"]', 'severe');
      await page.fill('textarea[name="allergy.reaction"]', 'Anaphylaxis');
      
      // Current Medications
      await page.click('button:text("Add Medication")');
      await page.fill('input[placeholder="Medication name"]', 'Lisinopril');
      await page.fill('input[placeholder="Dosage"]', '10mg');
      await page.fill('input[placeholder="Frequency"]', 'Once daily');
      
      // Medical Conditions
      await page.click('button:text("Add Condition")');
      await page.fill('input[placeholder="Condition"]', 'Hypertension');
      await page.fill('input[name="condition.diagnosedDate"]', '2020-01-01');
    });

    // Consent and Privacy
    await test.step('Complete consent forms', async () => {
      await page.check('input[name="consentToTreatment"]');
      await page.check('input[name="hipaaConsent"]');
      await page.check('input[name="financialResponsibility"]');
      
      // Electronic signature
      await page.fill('input[name="signatureName"]', `${mockPatient.firstName} ${mockPatient.lastName}`);
      await page.click('button:text("Sign Electronically")');
      
      // Verify signature timestamp
      await expect(page.locator('[data-testid="signature-timestamp"]')).toBeVisible();
    });

    // Submit registration
    await test.step('Submit and verify registration', async () => {
      await page.click('button:text("Complete Registration")');
      
      // Wait for success message
      await expect(page.locator('.toast-success')).toContainText('Patient registered successfully');
      
      // Verify redirect to patient profile
      await page.waitForURL(/\/patients\/[\w-]+/);
      
      // Verify patient information displayed
      await expect(page.locator('h1')).toContainText(`${mockPatient.firstName} ${mockPatient.lastName}`);
      await expect(page.locator('[data-testid="patient-mrn"]')).toBeVisible();
      await expect(page.locator('[data-testid="patient-dob"]')).toContainText(mockPatient.dateOfBirth);
    });
  });

  test('should validate required fields and show appropriate errors', async () => {
    // Try to submit without filling required fields
    await page.click('button:text("Complete Registration")');
    
    // Check for validation errors
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Last name is required')).toBeVisible();
    await expect(page.locator('text=Date of birth is required')).toBeVisible();
    await expect(page.locator('text=Gender is required')).toBeVisible();
    
    // Fill some fields and verify errors update
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    
    await page.click('button:text("Complete Registration")');
    
    // These errors should be gone
    await expect(page.locator('text=First name is required')).not.toBeVisible();
    await expect(page.locator('text=Last name is required')).not.toBeVisible();
    
    // But these should still be visible
    await expect(page.locator('text=Date of birth is required')).toBeVisible();
    await expect(page.locator('text=Gender is required')).toBeVisible();
  });

  test('should check for duplicate patients', async () => {
    const existingPatient = {
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '1990-05-15',
      ssn: '123-45-6789'
    };
    
    // Fill patient information that already exists
    await page.fill('input[name="firstName"]', existingPatient.firstName);
    await page.fill('input[name="lastName"]', existingPatient.lastName);
    await page.fill('input[name="dateOfBirth"]', existingPatient.dateOfBirth);
    await page.fill('input[name="ssn"]', existingPatient.ssn);
    
    // Move to next field to trigger duplicate check
    await page.press('input[name="ssn"]', 'Tab');
    
    // Wait for duplicate check
    await expect(page.locator('[data-testid="duplicate-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="duplicate-warning"]')).toContainText('Potential duplicate patient found');
    
    // Show existing patient details
    await page.click('button:text("View Existing Patient")');
    
    // Verify modal shows existing patient
    await expect(page.locator('.modal')).toContainText('Jane Smith');
    await expect(page.locator('.modal')).toContainText('DOB: 05/15/1990');
    await expect(page.locator('.modal')).toContainText('MRN:');
    
    // Options to proceed
    await expect(page.locator('button:text("Use Existing Patient")')).toBeVisible();
    await expect(page.locator('button:text("Create New Patient Anyway")')).toBeVisible();
  });

  test('should handle insurance verification', async () => {
    const mockPatient = generateMockPatient();
    
    // Fill basic patient info
    await page.fill('input[name="firstName"]', mockPatient.firstName);
    await page.fill('input[name="lastName"]', mockPatient.lastName);
    await page.fill('input[name="dateOfBirth"]', mockPatient.dateOfBirth);
    await page.selectOption('select[name="gender"]', mockPatient.gender);
    
    // Add insurance
    await page.click('button:text("Add Insurance")');
    await page.fill('input[name="insurance.provider"]', 'Blue Cross Blue Shield');
    await page.fill('input[name="insurance.policyNumber"]', 'BCBS123456789');
    await page.fill('input[name="insurance.groupNumber"]', 'GRP987654');
    
    // Click verify insurance
    await page.click('button:text("Verify Insurance")');
    
    // Wait for verification
    await expect(page.locator('[data-testid="insurance-verification-status"]')).toContainText('Verifying...');
    
    // Mock successful verification
    await page.waitForTimeout(2000); // Simulate API call
    
    await expect(page.locator('[data-testid="insurance-verification-status"]')).toContainText('Verified');
    await expect(page.locator('[data-testid="insurance-coverage-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="insurance-copay"]')).toContainText('$25');
    await expect(page.locator('[data-testid="insurance-deductible"]')).toContainText('$500 remaining');
  });

  test('should save draft and resume registration', async () => {
    const mockPatient = generateMockPatient();
    
    // Fill partial information
    await page.fill('input[name="firstName"]', mockPatient.firstName);
    await page.fill('input[name="lastName"]', mockPatient.lastName);
    await page.fill('input[name="email"]', mockPatient.email);
    
    // Save draft
    await page.click('button:text("Save Draft")');
    await expect(page.locator('.toast-success')).toContainText('Draft saved');
    
    // Note draft ID
    const draftId = await page.locator('[data-testid="draft-id"]').textContent();
    
    // Navigate away
    await page.click('text=Dashboard');
    await page.waitForURL('/dashboard');
    
    // Come back to registration
    await page.click('text=Patient Registration');
    
    // Should see option to resume draft
    await expect(page.locator('[data-testid="draft-notification"]')).toContainText('You have an incomplete registration');
    await page.click('button:text("Resume Draft")');
    
    // Verify fields are populated
    await expect(page.locator('input[name="firstName"]')).toHaveValue(mockPatient.firstName);
    await expect(page.locator('input[name="lastName"]')).toHaveValue(mockPatient.lastName);
    await expect(page.locator('input[name="email"]')).toHaveValue(mockPatient.email);
  });

  test('should print registration summary', async () => {
    const mockPatient = generateMockPatient();
    
    // Complete minimal registration
    await page.fill('input[name="firstName"]', mockPatient.firstName);
    await page.fill('input[name="lastName"]', mockPatient.lastName);
    await page.fill('input[name="dateOfBirth"]', mockPatient.dateOfBirth);
    await page.selectOption('select[name="gender"]', mockPatient.gender);
    
    // Complete registration
    await page.check('input[name="consentToTreatment"]');
    await page.check('input[name="hipaaConsent"]');
    await page.fill('input[name="signatureName"]', `${mockPatient.firstName} ${mockPatient.lastName}`);
    await page.click('button:text("Sign Electronically")');
    
    await page.click('button:text("Complete Registration")');
    
    // Wait for patient profile
    await page.waitForURL(/\/patients\/[\w-]+/);
    
    // Print registration summary
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button:text("Print Registration Summary")')
    ]);
    
    // Verify print preview contains patient information
    await expect(newPage.locator('h1')).toContainText('Patient Registration Summary');
    await expect(newPage.locator('body')).toContainText(mockPatient.firstName);
    await expect(newPage.locator('body')).toContainText(mockPatient.lastName);
    await expect(newPage.locator('body')).toContainText('Registration Date:');
    await expect(newPage.locator('body')).toContainText('MRN:');
    
    await newPage.close();
  });

  test('should handle photo capture for patient ID', async () => {
    const mockPatient = generateMockPatient();
    
    // Fill basic info
    await page.fill('input[name="firstName"]', mockPatient.firstName);
    await page.fill('input[name="lastName"]', mockPatient.lastName);
    
    // Click capture photo
    await page.click('button:text("Capture Photo")');
    
    // Grant camera permission if prompted (handled by browser)
    // Mock camera stream
    await expect(page.locator('[data-testid="camera-preview"]')).toBeVisible();
    
    // Take photo
    await page.click('button:text("Take Photo")');
    
    // Preview captured photo
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
    
    // Options to retake or confirm
    await expect(page.locator('button:text("Retake")')).toBeVisible();
    await expect(page.locator('button:text("Use This Photo")')).toBeVisible();
    
    // Confirm photo
    await page.click('button:text("Use This Photo")');
    
    // Photo should be attached to registration
    await expect(page.locator('[data-testid="patient-photo-thumbnail"]')).toBeVisible();
  });

  test('should integrate with appointment scheduling after registration', async () => {
    const mockPatient = generateMockPatient();
    
    // Quick registration
    await page.fill('input[name="firstName"]', mockPatient.firstName);
    await page.fill('input[name="lastName"]', mockPatient.lastName);
    await page.fill('input[name="dateOfBirth"]', mockPatient.dateOfBirth);
    await page.selectOption('select[name="gender"]', mockPatient.gender);
    await page.fill('input[name="phone"]', mockPatient.phone);
    
    // Check option to schedule appointment
    await page.check('input[name="scheduleAppointmentAfterRegistration"]');
    
    // Select appointment reason
    await page.selectOption('select[name="appointmentReason"]', 'new-patient-visit');
    
    // Complete registration
    await page.check('input[name="consentToTreatment"]');
    await page.check('input[name="hipaaConsent"]');
    await page.fill('input[name="signatureName"]', `${mockPatient.firstName} ${mockPatient.lastName}`);
    await page.click('button:text("Sign Electronically")');
    
    await page.click('button:text("Complete Registration")');
    
    // Should redirect to appointment scheduling
    await page.waitForURL(/\/appointments\/schedule/);
    
    // Verify patient is pre-selected
    await expect(page.locator('[data-testid="selected-patient"]')).toContainText(`${mockPatient.firstName} ${mockPatient.lastName}`);
    await expect(page.locator('select[name="appointmentType"]')).toHaveValue('new-patient-visit');
  });
});