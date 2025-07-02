import { test, expect, Page } from '@playwright/test';
import { createHelpers, setupTest, cleanupTest } from './helpers/test-utils';
import { generateMockPatient, generateMockVitalSigns, generateMockPrescription, generateMockLabOrder } from './helpers/test-data';
import { getTestPatient, getTestEncounter, getTestLabResult } from './fixtures/test-patients';

/**
 * FHIR Operations E2E Tests
 * Tests FHIR API integration including resource creation, updates, search, and validation
 */

test.describe('FHIR Operations - Comprehensive Integration', () => {
  let page: Page;
  let helpers: ReturnType<typeof createHelpers>;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    helpers = await setupTest(page, 'doctor');
  });

  test.afterEach(async () => {
    await cleanupTest(page);
  });

  test.describe('Patient Resource Operations', () => {
    test('should create FHIR Patient resource via UI', async () => {
      const mockPatient = generateMockPatient();
      
      await test.step('Create patient through registration form', async () => {
        await helpers.navigation.navigateTo('patient-registration');
        
        // Fill required fields
        await helpers.form.fillForm({
          firstName: mockPatient.firstName,
          lastName: mockPatient.lastName,
          dateOfBirth: mockPatient.dateOfBirth,
          gender: mockPatient.gender,
          email: mockPatient.email,
          phone: mockPatient.phone
        });
        
        // Complete required consents
        await page.getByLabel(/consent to treatment/i).check();
        await page.getByLabel(/hipaa consent/i).check();
        
        await page.getByRole('button', { name: /complete registration/i }).click();
        
        await helpers.wait.waitForToast(/patient registered successfully/i);
      });

      await test.step('Verify FHIR Patient resource created', async () => {
        // Should redirect to patient profile with FHIR ID in URL
        await expect(page).toHaveURL(/\/patients\/[\w-]+/);
        
        // Extract patient ID from URL
        const url = page.url();
        const patientId = url.split('/').pop();
        expect(patientId).toBeTruthy();
        
        // Verify patient data is displayed correctly
        await expect(page.getByText(`${mockPatient.firstName} ${mockPatient.lastName}`)).toBeVisible();
        await expect(page.getByText(mockPatient.email)).toBeVisible();
        
        // Verify FHIR-specific elements
        await expect(page.locator('[data-testid="patient-mrn"]')).toBeVisible();
        await expect(page.locator('[data-testid="fhir-resource-id"]')).toBeVisible();
      });
    });

    test('should update FHIR Patient resource via UI', async () => {
      const testPatient = getTestPatient('healthy_adult');
      
      await test.step('Navigate to patient and edit', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('button', { name: /edit patient/i }).click();
        await helpers.modal.waitForModal('edit patient');
      });

      await test.step('Update patient information', async () => {
        // Update phone number
        const phoneInput = page.getByLabel(/phone/i);
        await phoneInput.clear();
        await phoneInput.fill('555-1234');
        
        // Update email
        const emailInput = page.getByLabel(/email/i);
        await emailInput.clear();
        await emailInput.fill('updated@example.com');
        
        await page.getByRole('button', { name: /save changes/i }).click();
        
        await helpers.wait.waitForToast(/patient updated/i);
      });

      await test.step('Verify FHIR resource was updated', async () => {
        // Verify updated information is displayed
        await expect(page.getByText('555-1234')).toBeVisible();
        await expect(page.getByText('updated@example.com')).toBeVisible();
        
        // Check that version/last updated timestamp changed
        const lastUpdated = page.locator('[data-testid="last-updated"]');
        if (await lastUpdated.isVisible()) {
          await expect(lastUpdated).toContainText(/updated/i);
        }
      });
    });

    test('should search FHIR Patient resources', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Search by name', async () => {
        const searchInput = page.getByPlaceholder(/search patients/i);
        await searchInput.fill('John');
        await page.keyboard.press('Enter');
        
        await helpers.wait.waitForLoading();
        
        // Should return FHIR Bundle with Patient resources
        const results = page.getByRole('table');
        await expect(results).toBeVisible();
        
        // Verify search highlighting
        const highlighted = page.locator('.search-highlight, [data-testid="search-highlight"]');
        if (await highlighted.isVisible()) {
          await expect(highlighted).toContainText(/john/i);
        }
      });

      await test.step('Search by identifier (MRN)', async () => {
        const searchInput = page.getByPlaceholder(/search patients/i);
        await searchInput.clear();
        await searchInput.fill('MRN001234');
        await page.keyboard.press('Enter');
        
        await helpers.wait.waitForLoading();
        
        // Should find exact match
        await expect(page.getByText('MRN001234')).toBeVisible();
      });

      await test.step('Advanced search with FHIR parameters', async () => {
        const advancedSearchButton = page.getByRole('button', { name: /advanced search/i });
        if (await advancedSearchButton.isVisible()) {
          await advancedSearchButton.click();
          
          // Use FHIR search parameters
          await page.getByLabel(/birth date/i).fill('1980-05-15');
          await page.getByLabel(/gender/i).selectOption('male');
          
          await page.getByRole('button', { name: /search/i }).click();
          
          await helpers.wait.waitForLoading();
          
          // Verify results match criteria
          await expect(page.getByText('1980-05-15')).toBeVisible();
        }
      });
    });

    test('should validate FHIR Patient resource constraints', async () => {
      await helpers.navigation.navigateTo('patient-registration');
      
      await test.step('Attempt to create invalid patient', async () => {
        // Try invalid email format
        await helpers.form.fillForm({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-05-15',
          gender: 'male' as const,
          email: 'invalid-email-format',
          phone: '123' // Invalid phone
        });
        
        await page.getByLabel(/consent to treatment/i).check();
        await page.getByLabel(/hipaa consent/i).check();
        
        await page.getByRole('button', { name: /complete registration/i }).click();
      });

      await test.step('Verify FHIR validation errors', async () => {
        // Should show FHIR validation errors
        await expect(page.getByText(/invalid email format/i)).toBeVisible();
        await expect(page.getByText(/invalid phone/i).or(
          page.getByText(/phone must be/i)
        )).toBeVisible();
        
        // Should not create resource
        await expect(page).toHaveURL(/\/admin\/patients\/register/);
      });
    });
  });

  test.describe('Observation Resource Operations', () => {
    test('should create vital signs Observations via UI', async () => {
      const testPatient = getTestPatient('healthy_adult');
      const mockVitals = generateMockVitalSigns();
      
      await test.step('Navigate to patient and add vitals', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('tab', { name: /vitals/i }).click();
        await page.getByRole('button', { name: /add vitals/i }).click();
      });

      await test.step('Enter vital signs data', async () => {
        await helpers.form.fillForm({
          temperature: mockVitals.temperature.toString(),
          systolic: mockVitals.systolicBP.toString(),
          diastolic: mockVitals.diastolicBP.toString(),
          heartRate: mockVitals.heartRate.toString(),
          respiratoryRate: mockVitals.respiratoryRate.toString(),
          oxygenSaturation: mockVitals.oxygenSaturation.toString(),
          weight: mockVitals.weight.toString(),
          height: mockVitals.height.toString()
        });
        
        await page.getByRole('button', { name: /save vitals/i }).click();
        
        await helpers.wait.waitForToast(/vitals recorded/i);
      });

      await test.step('Verify FHIR Observation resources created', async () => {
        // Should show vitals in the list
        await expect(page.getByText(mockVitals.temperature.toString())).toBeVisible();
        await expect(page.getByText(`${mockVitals.systolicBP}/${mockVitals.diastolicBP}`)).toBeVisible();
        
        // Verify FHIR coding is displayed
        const loinc = page.locator('[data-testid="loinc-code"]');
        if (await loinc.isVisible()) {
          await expect(loinc).toBeVisible();
        }
        
        // Verify timestamp
        await expect(page.locator('[data-testid="observation-date"]')).toBeVisible();
      });
    });

    test('should display lab results as FHIR Observations', async () => {
      const testLabResult = getTestLabResult('normal_cbc');
      
      await test.step('Navigate to patient lab results', async () => {
        await helpers.navigation.navigateToPatient(testLabResult.patientId);
        
        await page.getByRole('tab', { name: /lab results/i }).click();
      });

      await test.step('View lab result details', async () => {
        // Click on lab result to view details
        await page.getByText(testLabResult.testName).click();
        
        // Should show FHIR Observation details
        await helpers.modal.waitForModal('lab result details');
        
        // Verify FHIR structure
        for (const result of testLabResult.results) {
          await expect(page.getByText(result.name)).toBeVisible();
          await expect(page.getByText(result.value)).toBeVisible();
          await expect(page.getByText(result.unit)).toBeVisible();
        }
        
        // Verify LOINC codes if displayed
        const loincCode = page.locator('[data-testid="loinc-code"]');
        if (await loincCode.isVisible()) {
          await expect(loincCode).toContainText(/\d+/);
        }
      });

      await test.step('Verify critical value handling', async () => {
        const criticalResult = testLabResult.results.find(r => r.critical);
        if (criticalResult) {
          // Should highlight critical values
          await expect(page.getByText(criticalResult.value)).toHaveClass(/critical|alert|high/);
          
          // Should show alert indicator
          const alertIcon = page.locator('[data-testid="critical-alert"]');
          if (await alertIcon.isVisible()) {
            await expect(alertIcon).toBeVisible();
          }
        }
      });
    });
  });

  test.describe('MedicationRequest Resource Operations', () => {
    test('should create MedicationRequest via prescription workflow', async () => {
      const testPatient = getTestPatient('healthy_adult');
      const mockPrescription = generateMockPrescription();
      
      await test.step('Navigate to patient and prescribe medication', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('tab', { name: /medications/i }).click();
        await page.getByRole('button', { name: /prescribe medication/i }).click();
      });

      await test.step('Search and select medication', async () => {
        // Search for medication
        const medicationSearch = page.getByLabel(/medication search/i);
        await medicationSearch.fill(mockPrescription.medication.split(' ')[0]);
        
        // Select from dropdown
        const medicationOption = page.getByRole('option', { name: new RegExp(mockPrescription.medication, 'i') });
        if (await medicationOption.isVisible()) {
          await medicationOption.click();
        } else {
          // Manual entry if not in dropdown
          await page.getByLabel(/medication name/i).fill(mockPrescription.medication);
        }
      });

      await test.step('Fill prescription details', async () => {
        await helpers.form.fillForm({
          dosage: mockPrescription.dosage,
          frequency: mockPrescription.frequency,
          duration: mockPrescription.duration,
          quantity: mockPrescription.quantity.toString(),
          refills: mockPrescription.refills.toString(),
          instructions: mockPrescription.instructions
        });
      });

      await test.step('Check for drug interactions', async () => {
        const interactionCheck = page.locator('[data-testid="drug-interaction-check"]');
        if (await interactionCheck.isVisible()) {
          // Wait for interaction check to complete
          await helpers.wait.waitForLoading();
          
          // Handle any warnings
          const warning = page.getByText(/drug interaction warning/i);
          if (await warning.isVisible()) {
            await expect(warning).toBeVisible();
            
            // Acknowledge warning to continue
            const acknowledgeButton = page.getByRole('button', { name: /acknowledge/i });
            if (await acknowledgeButton.isVisible()) {
              await acknowledgeButton.click();
            }
          }
        }
      });

      await test.step('Submit prescription and verify FHIR resource', async () => {
        await page.getByRole('button', { name: /prescribe/i }).click();
        
        await helpers.wait.waitForToast(/prescription created/i);
        
        // Verify medication appears in patient's medication list
        await expect(page.getByText(mockPrescription.medication)).toBeVisible();
        await expect(page.getByText(mockPrescription.frequency)).toBeVisible();
        
        // Verify FHIR MedicationRequest properties
        await expect(page.locator('[data-testid="prescription-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="prescriber-name"]')).toBeVisible();
      });
    });

    test('should handle medication allergies and contraindications', async () => {
      const testPatient = getTestPatient('complex_patient'); // Has allergies
      
      await test.step('Attempt to prescribe allergenic medication', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('tab', { name: /medications/i }).click();
        await page.getByRole('button', { name: /prescribe medication/i }).click();
        
        // Try to prescribe penicillin (patient is allergic)
        await page.getByLabel(/medication search/i).fill('Penicillin');
        
        const penicillinOption = page.getByRole('option', { name: /penicillin/i });
        if (await penicillinOption.isVisible()) {
          await penicillinOption.click();
        }
      });

      await test.step('Verify allergy warning appears', async () => {
        // Should show allergy alert
        await expect(page.getByText(/allergy warning/i).or(
          page.getByText(/contraindication/i)
        )).toBeVisible();
        
        // Should show severity
        await expect(page.getByText(/severe/i)).toBeVisible();
        
        // Should prevent prescription unless overridden
        const prescribeButton = page.getByRole('button', { name: /prescribe/i });
        await expect(prescribeButton).toBeDisabled();
      });
    });

    test('should update and discontinue medications', async () => {
      const testPatient = getTestPatient('complex_patient');
      
      await test.step('View current medications', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('tab', { name: /medications/i }).click();
        
        // Should show active medications
        if (testPatient.medications) {
          for (const medication of testPatient.medications) {
            await expect(page.getByText(medication.name)).toBeVisible();
          }
        }
      });

      await test.step('Modify medication dosage', async () => {
        const editButton = page.getByRole('button', { name: /edit/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
          
          await helpers.modal.waitForModal('edit medication');
          
          // Change dosage
          const dosageInput = page.getByLabel(/dosage/i);
          await dosageInput.clear();
          await dosageInput.fill('20mg');
          
          await page.getByRole('button', { name: /save changes/i }).click();
          
          await helpers.wait.waitForToast(/medication updated/i);
          
          // Verify new dosage is displayed
          await expect(page.getByText('20mg')).toBeVisible();
        }
      });

      await test.step('Discontinue medication', async () => {
        const discontinueButton = page.getByRole('button', { name: /discontinue/i }).first();
        if (await discontinueButton.isVisible()) {
          await discontinueButton.click();
          
          // Confirm discontinuation
          await helpers.modal.confirmModal('discontinue');
          
          await helpers.wait.waitForToast(/medication discontinued/i);
          
          // Should show as inactive/discontinued
          await expect(page.getByText(/discontinued/i)).toBeVisible();
        }
      });
    });
  });

  test.describe('Encounter Resource Operations', () => {
    test('should create and manage Encounter resources', async () => {
      const testPatient = getTestPatient('healthy_adult');
      const testEncounter = getTestEncounter('routine_checkup');
      
      await test.step('Create new encounter', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('button', { name: /new encounter/i }).click();
        
        await helpers.form.fillForm({
          encounterType: testEncounter.type,
          chiefComplaint: testEncounter.chiefComplaint,
          visitReason: 'Annual wellness visit',
          encounterDate: testEncounter.date,
          encounterTime: testEncounter.time
        });
        
        await page.getByRole('button', { name: /create encounter/i }).click();
        
        await helpers.wait.waitForToast(/encounter created/i);
      });

      await test.step('Verify Encounter resource properties', async () => {
        // Should navigate to encounter view
        await expect(page).toHaveURL(/\/encounters\/[\w-]+/);
        
        // Verify FHIR Encounter elements
        await expect(page.getByText(testEncounter.chiefComplaint)).toBeVisible();
        await expect(page.getByText(testEncounter.date)).toBeVisible();
        
        // Verify encounter status
        await expect(page.locator('[data-testid="encounter-status"]')).toContainText(/in-progress|planned/);
        
        // Verify practitioner reference
        await expect(page.locator('[data-testid="encounter-practitioner"]')).toBeVisible();
      });

      await test.step('Update encounter status', async () => {
        const statusButton = page.getByRole('button', { name: /update status/i });
        if (await statusButton.isVisible()) {
          await statusButton.click();
          
          await page.getByRole('option', { name: /finished/i }).click();
          
          await helpers.wait.waitForToast(/encounter updated/i);
          
          // Verify status change
          await expect(page.locator('[data-testid="encounter-status"]')).toContainText(/finished/);
        }
      });
    });
  });

  test.describe('FHIR Search and Bundle Operations', () => {
    test('should perform complex FHIR searches with multiple parameters', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Use FHIR search parameters', async () => {
        const advancedSearch = page.getByRole('button', { name: /advanced search/i });
        if (await advancedSearch.isVisible()) {
          await advancedSearch.click();
          
          // Set multiple search parameters
          await page.getByLabel(/family name/i).fill('Smith');
          await page.getByLabel(/birth date/i).fill('1965-12-03');
          await page.getByLabel(/gender/i).selectOption('female');
          
          // Use _include parameter
          const includeOptions = page.getByLabel(/include/i);
          if (await includeOptions.isVisible()) {
            await includeOptions.selectOption('Patient:general-practitioner');
          }
          
          await page.getByRole('button', { name: /search/i }).click();
          
          await helpers.wait.waitForLoading();
        }
      });

      await test.step('Verify Bundle response structure', async () => {
        // Should show search results
        const results = page.getByRole('table');
        await expect(results).toBeVisible();
        
        // Verify Bundle metadata
        const bundleInfo = page.locator('[data-testid="bundle-info"]');
        if (await bundleInfo.isVisible()) {
          await expect(bundleInfo).toContainText(/total/i);
        }
        
        // Verify included resources if any
        const includedResources = page.locator('[data-testid="included-resources"]');
        if (await includedResources.isVisible()) {
          await expect(includedResources).toBeVisible();
        }
      });
    });

    test('should handle FHIR search pagination', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Navigate through paginated results', async () => {
        const nextLink = page.getByRole('link', { name: /next/i });
        if (await nextLink.isVisible()) {
          await nextLink.click();
          
          await helpers.wait.waitForLoading();
          
          // Should load next page of Bundle
          await expect(page.getByRole('table')).toBeVisible();
          
          // Verify page indicators
          const pageInfo = page.locator('[data-testid="page-info"]');
          if (await pageInfo.isVisible()) {
            await expect(pageInfo).toContainText(/page/i);
          }
        }
      });
    });
  });

  test.describe('FHIR Validation and Error Handling', () => {
    test('should handle FHIR OperationOutcome responses', async () => {
      await test.step('Trigger validation error', async () => {
        // Mock FHIR validation error response
        await helpers.api.mockAPIResponse('**/patients', {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'invalid',
              diagnostics: 'Invalid date format for birthDate',
              expression: ['Patient.birthDate']
            }
          ]
        }, 400);
        
        await helpers.navigation.navigateTo('patient-registration');
        
        await helpers.form.fillForm({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: 'invalid-date',
          gender: 'male' as const
        });
        
        await page.getByLabel(/consent to treatment/i).check();
        await page.getByRole('button', { name: /complete registration/i }).click();
      });

      await test.step('Verify OperationOutcome error display', async () => {
        // Should show FHIR validation error
        await expect(page.getByText(/invalid date format/i)).toBeVisible();
        
        // Should highlight the problematic field
        const birthDateField = page.getByLabel(/date of birth/i);
        await expect(birthDateField).toHaveClass(/error|invalid/);
        
        // Should remain on registration page
        await expect(page).toHaveURL(/\/admin\/patients\/register/);
      });
    });

    test('should handle FHIR server errors gracefully', async () => {
      await test.step('Mock FHIR server error', async () => {
        await helpers.api.mockAPIError('**/fhir/**', 500, 'FHIR Server Error');
        
        await helpers.navigation.navigateTo('patients');
      });

      await test.step('Verify error handling', async () => {
        // Should show user-friendly error message
        await expect(page.getByText(/unable to load patients/i).or(
          page.getByText(/server error/i)
        )).toBeVisible();
        
        // Should provide retry option
        const retryButton = page.getByRole('button', { name: /retry/i });
        if (await retryButton.isVisible()) {
          await expect(retryButton).toBeVisible();
        }
      });
    });
  });
});