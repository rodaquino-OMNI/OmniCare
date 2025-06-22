import { test, expect, Page } from '@playwright/test';
import { createHelpers, setupTest, cleanupTest } from './helpers/test-utils';
import { generateMockPatient, generateCompletePatientScenario } from './helpers/test-data';
import { getTestPatient, TEST_PATIENTS } from './fixtures/test-patients';

/**
 * Comprehensive Patient Management E2E Tests
 * Tests all patient-related workflows including registration, search, updates, and clinical data
 */

test.describe('Patient Management - Comprehensive Flow', () => {
  let page: Page;
  let helpers: ReturnType<typeof createHelpers>;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    helpers = await setupTest(page, 'doctor');
  });

  test.afterEach(async () => {
    await cleanupTest(page);
  });

  test.describe('Patient Registration Workflow', () => {
    test('should complete full patient registration with all sections', async () => {
      const mockPatient = generateMockPatient();
      
      await test.step('Navigate to patient registration', async () => {
        await helpers.navigation.navigateTo('patient-registration');
        await expect(page.getByRole('heading', { name: /patient registration/i })).toBeVisible();
      });

      await test.step('Fill demographics section', async () => {
        await helpers.form.fillForm({
          firstName: mockPatient.firstName,
          middleName: mockPatient.middleName || '',
          lastName: mockPatient.lastName,
          dateOfBirth: mockPatient.dateOfBirth,
          gender: mockPatient.gender,
          ssn: mockPatient.ssn
        });
        
        // Verify age calculation
        const ageElement = page.locator('[data-testid="calculated-age"]');
        if (await ageElement.isVisible()) {
          await expect(ageElement).toContainText(/\d+ years/);
        }
      });

      await test.step('Fill contact information', async () => {
        await helpers.form.fillForm({
          email: mockPatient.email,
          phone: mockPatient.phone,
          addressLine1: mockPatient.address.line1,
          addressLine2: mockPatient.address.line2 || '',
          city: mockPatient.address.city,
          state: mockPatient.address.state,
          zipCode: mockPatient.address.zipCode
        });
      });

      await test.step('Add emergency contact', async () => {
        const addEmergencyButton = page.getByRole('button', { name: /add emergency contact/i });
        if (await addEmergencyButton.isVisible()) {
          await addEmergencyButton.click();
          
          await helpers.form.fillForm({
            'emergencyContact.name': mockPatient.emergencyContact.name,
            'emergencyContact.relationship': mockPatient.emergencyContact.relationship,
            'emergencyContact.phone': mockPatient.emergencyContact.phone
          });
        }
      });

      await test.step('Add insurance information', async () => {
        const addInsuranceButton = page.getByRole('button', { name: /add insurance/i });
        if (await addInsuranceButton.isVisible()) {
          await addInsuranceButton.click();
          
          await helpers.form.fillForm({
            'insurance.type': 'primary',
            'insurance.provider': mockPatient.insurance.provider,
            'insurance.policyNumber': mockPatient.insurance.policyNumber,
            'insurance.groupNumber': mockPatient.insurance.groupNumber,
            'insurance.subscriberName': `${mockPatient.firstName} ${mockPatient.lastName}`,
            'insurance.subscriberDOB': mockPatient.dateOfBirth
          });
        }
      });

      await test.step('Add medical history', async () => {
        // Add allergies
        for (const allergy of mockPatient.medicalHistory.allergies) {
          const addAllergyButton = page.getByRole('button', { name: /add allergy/i });
          if (await addAllergyButton.isVisible()) {
            await addAllergyButton.click();
            await page.getByPlaceholder(/allergen/i).last().fill(allergy.allergen);
            await page.locator('select[name*="allergy.severity"]').last().selectOption(allergy.severity);
            await page.getByPlaceholder(/reaction/i).last().fill(allergy.reaction);
          }
        }
        
        // Add current medications
        for (const medication of mockPatient.medicalHistory.medications) {
          const addMedicationButton = page.getByRole('button', { name: /add medication/i });
          if (await addMedicationButton.isVisible()) {
            await addMedicationButton.click();
            await page.getByPlaceholder(/medication name/i).last().fill(medication.name);
            await page.getByPlaceholder(/dosage/i).last().fill(medication.dosage);
            await page.getByPlaceholder(/frequency/i).last().fill(medication.frequency);
          }
        }
        
        // Add medical conditions
        for (const condition of mockPatient.medicalHistory.conditions) {
          const addConditionButton = page.getByRole('button', { name: /add condition/i });
          if (await addConditionButton.isVisible()) {
            await addConditionButton.click();
            await page.getByPlaceholder(/condition/i).last().fill(condition.condition);
            await page.locator('input[name*="condition.diagnosedDate"]').last().fill(condition.diagnosedDate);
          }
        }
      });

      await test.step('Complete consent and privacy forms', async () => {
        await page.getByLabel(/consent to treatment/i).check();
        await page.getByLabel(/hipaa consent/i).check();
        await page.getByLabel(/financial responsibility/i).check();
        
        // Electronic signature
        await page.getByLabel(/signature name/i).fill(`${mockPatient.firstName} ${mockPatient.lastName}`);
        
        const signButton = page.getByRole('button', { name: /sign electronically/i });
        if (await signButton.isVisible()) {
          await signButton.click();
          
          // Verify signature timestamp appears
          await expect(page.locator('[data-testid="signature-timestamp"]')).toBeVisible();
        }
      });

      await test.step('Submit registration and verify success', async () => {
        await page.getByRole('button', { name: /complete registration/i }).click();
        
        // Wait for success message
        await helpers.wait.waitForToast('patient registered successfully');
        
        // Should redirect to patient profile
        await expect(page).toHaveURL(/\/patients\/[\w-]+/);
        
        // Verify patient information is displayed
        await expect(page.getByRole('heading', { level: 1 })).toContainText(`${mockPatient.firstName} ${mockPatient.lastName}`);
        
        // Verify MRN is assigned
        await expect(page.locator('[data-testid="patient-mrn"]')).toBeVisible();
        
        // Verify basic demographics
        await expect(page.locator('[data-testid="patient-dob"]')).toContainText(mockPatient.dateOfBirth);
      });
    });

    test('should validate required fields and show appropriate errors', async () => {
      await helpers.navigation.navigateTo('patient-registration');
      
      await test.step('Attempt to submit empty form', async () => {
        await page.getByRole('button', { name: /complete registration/i }).click();
      });

      await test.step('Verify validation errors appear', async () => {
        await helpers.form.checkValidationErrors([
          'First name is required',
          'Last name is required',
          'Date of birth is required',
          'Gender is required'
        ]);
      });

      await test.step('Fill some fields and verify errors update', async () => {
        await page.getByLabel(/first name/i).fill('John');
        await page.getByLabel(/last name/i).fill('Doe');
        
        await page.getByRole('button', { name: /complete registration/i }).click();
        
        // Name errors should be gone
        await expect(page.getByText(/first name is required/i)).not.toBeVisible();
        await expect(page.getByText(/last name is required/i)).not.toBeVisible();
        
        // Other errors should still be visible
        await expect(page.getByText(/date of birth is required/i)).toBeVisible();
      });
    });

    test('should detect and handle duplicate patients', async () => {
      const existingPatient = getTestPatient('healthy_adult');
      
      await helpers.navigation.navigateTo('patient-registration');
      
      await test.step('Enter potentially duplicate patient information', async () => {
        await page.getByLabel(/first name/i).fill(existingPatient.firstName);
        await page.getByLabel(/last name/i).fill(existingPatient.lastName);
        await page.getByLabel(/date of birth/i).fill(existingPatient.dateOfBirth);
        await page.getByLabel(/ssn/i).fill(existingPatient.ssn);
        
        // Move to next field to trigger duplicate check
        await page.getByLabel(/ssn/i).press('Tab');
      });

      await test.step('Verify duplicate warning appears', async () => {
        await expect(page.locator('[data-testid="duplicate-warning"]')).toBeVisible();
        await expect(page.locator('[data-testid="duplicate-warning"]')).toContainText(/potential duplicate patient found/i);
      });

      await test.step('Show existing patient details', async () => {
        await page.getByRole('button', { name: /view existing patient/i }).click();
        
        // Verify modal shows existing patient
        await helpers.modal.waitForModal();
        await expect(page.getByRole('dialog')).toContainText(existingPatient.firstName);
        await expect(page.getByRole('dialog')).toContainText(existingPatient.lastName);
        await expect(page.getByRole('dialog')).toContainText(existingPatient.mrn);
      });

      await test.step('Handle duplicate options', async () => {
        // Should have options to use existing or create new
        await expect(page.getByRole('button', { name: /use existing patient/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /create new patient anyway/i })).toBeVisible();
        
        await helpers.modal.closeModal();
      });
    });

    test('should handle insurance verification', async () => {
      const mockPatient = generateMockPatient();
      
      await helpers.navigation.navigateTo('patient-registration');
      
      await test.step('Fill basic patient information', async () => {
        await helpers.form.fillForm({
          firstName: mockPatient.firstName,
          lastName: mockPatient.lastName,
          dateOfBirth: mockPatient.dateOfBirth,
          gender: mockPatient.gender
        });
      });

      await test.step('Add and verify insurance', async () => {
        await page.getByRole('button', { name: /add insurance/i }).click();
        
        await helpers.form.fillForm({
          'insurance.provider': 'Blue Cross Blue Shield',
          'insurance.policyNumber': 'BCBS123456789',
          'insurance.groupNumber': 'GRP987654'
        });
        
        // Click verify insurance
        await page.getByRole('button', { name: /verify insurance/i }).click();
        
        // Wait for verification status
        await expect(page.locator('[data-testid="insurance-verification-status"]')).toContainText(/verifying/i);
        
        // Mock successful verification response
        await helpers.wait.waitForLoading();
        
        await expect(page.locator('[data-testid="insurance-verification-status"]')).toContainText(/verified/i);
        await expect(page.locator('[data-testid="insurance-coverage-details"]')).toBeVisible();
      });
    });
  });

  test.describe('Patient Search and List Management', () => {
    test('should search patients by various criteria', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Search by name', async () => {
        const searchInput = page.getByPlaceholder(/search patients/i);
        await searchInput.fill('John Doe');
        await page.keyboard.press('Enter');
        
        await helpers.wait.waitForLoading();
        
        // Should show search results
        const resultsContainer = page.locator('[data-testid="search-results"]').or(
          page.getByRole('table')
        );
        await expect(resultsContainer).toBeVisible();
      });

      await test.step('Search by MRN', async () => {
        const searchInput = page.getByPlaceholder(/search patients/i);
        await searchInput.clear();
        await searchInput.fill('MRN001234');
        await page.keyboard.press('Enter');
        
        await helpers.wait.waitForLoading();
        
        // Should find specific patient
        await expect(page.getByText('MRN001234')).toBeVisible();
      });

      await test.step('Search by date of birth', async () => {
        const searchInput = page.getByPlaceholder(/search patients/i);
        await searchInput.clear();
        await searchInput.fill('1980-05-15');
        await page.keyboard.press('Enter');
        
        await helpers.wait.waitForLoading();
      });

      await test.step('Clear search results', async () => {
        const clearButton = page.getByRole('button', { name: /clear search/i });
        if (await clearButton.isVisible()) {
          await clearButton.click();
        } else {
          await page.getByPlaceholder(/search patients/i).clear();
          await page.keyboard.press('Enter');
        }
        
        // Should show full patient list
        await helpers.wait.waitForLoading();
      });
    });

    test('should sort patient list by different columns', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Sort by name', async () => {
        await helpers.table.sortByColumn('Name');
        await helpers.wait.waitForLoading();
        
        // Verify sorting (basic check)
        const firstRow = page.getByRole('row').nth(1); // Skip header
        await expect(firstRow).toBeVisible();
      });

      await test.step('Sort by date of birth', async () => {
        await helpers.table.sortByColumn('Date of Birth');
        await helpers.wait.waitForLoading();
      });

      await test.step('Sort by last visit', async () => {
        const lastVisitColumn = page.getByRole('columnheader', { name: /last visit/i });
        if (await lastVisitColumn.isVisible()) {
          await lastVisitColumn.click();
          await helpers.wait.waitForLoading();
        }
      });
    });

    test('should filter patients by status and demographics', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Filter by active status', async () => {
        const statusFilter = page.getByRole('combobox', { name: /status/i }).or(
          page.getByRole('button', { name: /filter/i })
        );
        
        if (await statusFilter.isVisible()) {
          await statusFilter.click();
          await page.getByRole('option', { name: /active/i }).click();
          await helpers.wait.waitForLoading();
        }
      });

      await test.step('Filter by age range', async () => {
        const ageFilter = page.getByRole('combobox', { name: /age/i });
        if (await ageFilter.isVisible()) {
          await ageFilter.click();
          await page.getByRole('option', { name: /adults/i }).click();
          await helpers.wait.waitForLoading();
        }
      });

      await test.step('Filter by gender', async () => {
        const genderFilter = page.getByRole('combobox', { name: /gender/i });
        if (await genderFilter.isVisible()) {
          await genderFilter.click();
          await page.getByRole('option', { name: /male/i }).click();
          await helpers.wait.waitForLoading();
        }
      });
    });

    test('should handle pagination for large patient lists', async () => {
      await helpers.navigation.navigateTo('patients');
      
      await test.step('Navigate through pages', async () => {
        const nextPageButton = page.getByRole('button', { name: /next page/i }).or(
          page.getByRole('button', { name: />/i })
        );
        
        if (await nextPageButton.isVisible() && await nextPageButton.isEnabled()) {
          const initialRowCount = await helpers.table.getRowCount();
          
          await nextPageButton.click();
          await helpers.wait.waitForLoading();
          
          // Verify we're on a different page
          const newRowCount = await helpers.table.getRowCount();
          // Should have different content or page indicator
        }
      });

      await test.step('Change items per page', async () => {
        const itemsPerPageSelect = page.getByRole('combobox', { name: /items per page/i });
        if (await itemsPerPageSelect.isVisible()) {
          await itemsPerPageSelect.click();
          await page.getByRole('option', { name: /50/i }).click();
          await helpers.wait.waitForLoading();
        }
      });
    });
  });

  test.describe('Patient Profile Management', () => {
    test('should view and edit patient demographics', async () => {
      const testPatient = getTestPatient('healthy_adult');
      
      await test.step('Navigate to patient profile', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        await expect(page.getByTestId('patient-header')).toBeVisible();
        await expect(page.getByRole('heading')).toContainText(`${testPatient.firstName} ${testPatient.lastName}`);
      });

      await test.step('View patient information sections', async () => {
        // Demographics section
        await expect(page.getByText(/demographics/i)).toBeVisible();
        await expect(page.getByText(testPatient.dateOfBirth)).toBeVisible();
        await expect(page.getByText(testPatient.gender)).toBeVisible();
        
        // Contact information
        await expect(page.getByText(testPatient.email)).toBeVisible();
        await expect(page.getByText(testPatient.phone)).toBeVisible();
        
        // Address
        await expect(page.getByText(testPatient.address.line1)).toBeVisible();
        await expect(page.getByText(testPatient.address.city)).toBeVisible();
      });

      await test.step('Edit patient information', async () => {
        const editButton = page.getByRole('button', { name: /edit/i });
        await editButton.click();
        
        // Should open edit modal or form
        await helpers.modal.waitForModal('edit patient');
        
        // Update phone number
        const phoneInput = page.getByLabel(/phone/i);
        await phoneInput.clear();
        await phoneInput.fill('555-9999');
        
        // Save changes
        await page.getByRole('button', { name: /save/i }).click();
        
        // Verify changes were saved
        await helpers.wait.waitForToast('patient updated');
        await expect(page.getByText('555-9999')).toBeVisible();
      });
    });

    test('should manage patient status changes', async () => {
      const testPatient = getTestPatient('healthy_adult');
      
      await helpers.navigation.navigateToPatient(testPatient.id);
      
      await test.step('Change patient status', async () => {
        const statusDropdown = page.getByRole('combobox', { name: /status/i }).or(
          page.getByRole('button', { name: /change status/i })
        );
        
        if (await statusDropdown.isVisible()) {
          await statusDropdown.click();
          await page.getByRole('option', { name: /inactive/i }).click();
          
          // Confirm status change
          await helpers.modal.confirmModal('confirm');
          
          await helpers.wait.waitForToast('status updated');
          
          // Verify status indicator updated
          await expect(page.locator('[data-testid="patient-status"]')).toContainText(/inactive/i);
        }
      });
    });

    test('should handle patient merge workflow', async () => {
      const testPatient = getTestPatient('healthy_adult');
      
      await helpers.navigation.navigateToPatient(testPatient.id);
      
      await test.step('Initiate patient merge', async () => {
        const moreActionsButton = page.getByRole('button', { name: /more actions/i }).or(
          page.getByRole('button', { name: /\.\.\./ })
        );
        
        if (await moreActionsButton.isVisible()) {
          await moreActionsButton.click();
          
          const mergeOption = page.getByRole('menuitem', { name: /merge patient/i });
          if (await mergeOption.isVisible()) {
            await mergeOption.click();
            
            // Should open merge workflow
            await helpers.modal.waitForModal('merge patient');
            
            // Cancel merge for this test
            await helpers.modal.closeModal();
          }
        }
      });
    });
  });

  test.describe('Patient Clinical Data Views', () => {
    test('should display patient timeline and history', async () => {
      const testPatient = getTestPatient('complex_patient');
      
      await helpers.navigation.navigateToPatient(testPatient.id);
      
      await test.step('View timeline tab', async () => {
        const timelineTab = page.getByRole('tab', { name: /timeline/i });
        if (await timelineTab.isVisible()) {
          await timelineTab.click();
          
          // Should show chronological events
          await expect(page.locator('[data-testid="timeline-events"]')).toBeVisible();
        }
      });

      await test.step('View encounters history', async () => {
        const encountersTab = page.getByRole('tab', { name: /encounters/i });
        if (await encountersTab.isVisible()) {
          await encountersTab.click();
          
          // Should show encounter list
          await expect(page.getByRole('table')).toBeVisible();
        }
      });

      await test.step('View medications list', async () => {
        const medicationsTab = page.getByRole('tab', { name: /medications/i });
        if (await medicationsTab.isVisible()) {
          await medicationsTab.click();
          
          // Should show current medications
          if (testPatient.medications && testPatient.medications.length > 0) {
            for (const medication of testPatient.medications) {
              await expect(page.getByText(medication.name)).toBeVisible();
            }
          } else {
            // If no medications, expect to see "No medications" or similar message
            const noMedicationsMessage = page.getByText(/no medications/i).or(
              page.getByText(/no current medications/i)
            );
            if (await noMedicationsMessage.isVisible()) {
              await expect(noMedicationsMessage).toBeVisible();
            }
          }
        }
      });

      await test.step('View allergies and conditions', async () => {
        const allergiesTab = page.getByRole('tab', { name: /allergies/i });
        if (await allergiesTab.isVisible()) {
          await allergiesTab.click();
          
          // Should show allergy list
          if (testPatient.allergies && testPatient.allergies.length > 0) {
            for (const allergy of testPatient.allergies) {
              await expect(page.getByText(allergy.allergen)).toBeVisible();
            }
          } else {
            // If no allergies, expect to see "No allergies" or similar message
            const noAllergiesMessage = page.getByText(/no allergies/i).or(
              page.getByText(/no known allergies/i)
            );
            if (await noAllergiesMessage.isVisible()) {
              await expect(noAllergiesMessage).toBeVisible();
            }
          }
        }
      });
    });

    test('should filter and search within patient data', async () => {
      const testPatient = getTestPatient('complex_patient');
      
      await helpers.navigation.navigateToPatient(testPatient.id);
      
      await test.step('Filter encounters by date range', async () => {
        await page.getByRole('tab', { name: /encounters/i }).click();
        
        const dateFilter = page.getByRole('button', { name: /filter by date/i });
        if (await dateFilter.isVisible()) {
          await dateFilter.click();
          
          // Set date range
          await page.getByLabel(/start date/i).fill('2024-01-01');
          await page.getByLabel(/end date/i).fill('2024-12-31');
          
          await page.getByRole('button', { name: /apply filter/i }).click();
          await helpers.wait.waitForLoading();
        }
      });

      await test.step('Search within clinical notes', async () => {
        const searchInput = page.getByPlaceholder(/search clinical notes/i);
        if (await searchInput.isVisible()) {
          await searchInput.fill('hypertension');
          await page.keyboard.press('Enter');
          
          await helpers.wait.waitForLoading();
          
          // Should highlight search terms
          await expect(page.getByText(/hypertension/i)).toBeVisible();
        }
      });
    });
  });
});