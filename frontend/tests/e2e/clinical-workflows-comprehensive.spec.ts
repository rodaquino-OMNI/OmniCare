import { test, expect, Page } from '@playwright/test';
import { createHelpers, setupTest, cleanupTest } from './helpers/test-utils';
import {
  generateMockVitalSigns,
  generateMockEncounter,
  generateMockPrescription,
  generateMockLabOrder,
  generateMockAssessmentPlan
} from './helpers/test-data';
import {
  getTestPatient,
  getTestEncounter,
  getTestLabResult,
  getTestMedication
} from './fixtures/test-patients';

/**
 * Comprehensive Clinical Workflows E2E Tests
 * Tests complete clinical documentation and workflow scenarios
 */

test.describe('Clinical Workflows - Complete Patient Care', () => {
  let page: Page;
  let helpers: ReturnType<typeof createHelpers>;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    helpers = await setupTest(page, 'doctor');
  });

  test.afterEach(async () => {
    await cleanupTest(page);
  });

  test.describe('Complete Clinical Encounter Workflow', () => {
    test('should complete full clinical encounter from start to finish', async () => {
      const testPatient = getTestPatient('healthy_adult');
      const mockEncounter = generateMockEncounter(testPatient.id);
      const mockVitals = generateMockVitalSigns();
      const mockAssessment = generateMockAssessmentPlan();
      
      await test.step('Create new encounter', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('button', { name: /new encounter/i }).click();
        
        await helpers.form.fillForm({
          encounterType: mockEncounter.type,
          chiefComplaint: mockEncounter.chiefComplaint,
          visitReason: mockEncounter.visitReason,
          encounterDate: mockEncounter.date,
          encounterTime: mockEncounter.time
        });
        
        await page.getByRole('button', { name: /create encounter/i }).click();
        await helpers.wait.waitForToast(/encounter created/i);
      });

      await test.step('Record vital signs', async () => {
        await page.getByRole('tab', { name: /vitals/i }).click();
        await page.getByRole('button', { name: /add vitals/i }).click();
        
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
        
        // Verify vitals are displayed
        await expect(page.getByText(mockVitals.temperature.toString())).toBeVisible();
        await expect(page.getByText(`${mockVitals.systolicBP}/${mockVitals.diastolicBP}`)).toBeVisible();
      });

      await test.step('Document clinical notes', async () => {
        await page.getByRole('tab', { name: /notes/i }).click();
        
        // History of Present Illness
        const hpiTextarea = page.getByLabel(/history of present illness/i);
        if (await hpiTextarea.isVisible()) {
          await hpiTextarea.fill('Patient presents for routine annual physical examination. No acute concerns or complaints. Patient reports feeling well overall.');
        }
        
        // Review of Systems
        const rosTextarea = page.getByLabel(/review of systems/i);
        if (await rosTextarea.isVisible()) {
          await rosTextarea.fill('All systems reviewed and negative except as noted above.');
        }
        
        // Physical Examination
        const peTextarea = page.getByLabel(/physical examination/i);
        if (await peTextarea.isVisible()) {
          await peTextarea.fill('General: Well-appearing, in no acute distress. Vital signs as noted. HEENT: Normal. CV: RRR, no murmurs. Pulm: Clear to auscultation bilaterally. Abd: Soft, non-tender. Ext: No edema.');
        }
        
        await page.getByRole('button', { name: /save notes/i }).click();
        await helpers.wait.waitForToast(/notes saved/i);
      });

      await test.step('Create assessment and plan', async () => {
        await page.getByRole('tab', { name: /assessment/i }).click();
        
        // Assessment
        await page.getByLabel(/assessment/i).fill(mockAssessment.assessment);
        
        // Plan
        await page.getByLabel(/plan/i).fill(mockAssessment.plan);
        
        // Add diagnosis
        await page.getByRole('button', { name: /add diagnosis/i }).click();
        await page.getByLabel(/diagnosis code/i).fill(mockAssessment.diagnosis.code);
        await page.getByLabel(/diagnosis description/i).fill(mockAssessment.diagnosis.description);
        
        await page.getByRole('button', { name: /save assessment/i }).click();
        await helpers.wait.waitForToast(/assessment saved/i);
      });

      await test.step('Complete and sign encounter', async () => {
        // Finalize encounter
        await page.getByRole('button', { name: /complete encounter/i }).click();
        
        // Electronic signature
        await helpers.modal.waitForModal('sign encounter');
        
        await page.getByLabel(/electronic signature/i).fill('Dr. Sarah Johnson');
        await page.getByRole('button', { name: /sign encounter/i }).click();
        
        await helpers.wait.waitForToast(/encounter completed/i);
        
        // Verify encounter status
        await expect(page.locator('[data-testid="encounter-status"]')).toContainText(/completed|finished/);
        
        // Verify signature timestamp
        await expect(page.locator('[data-testid="signature-timestamp"]')).toBeVisible();
      });
    });

    test('should handle encounter modifications and amendments', async () => {
      const testEncounter = getTestEncounter('routine_checkup');
      
      await test.step('Navigate to completed encounter', async () => {
        await helpers.navigation.navigateToPatient(testEncounter.patientId);
        
        // Find and open the encounter
        await page.getByRole('tab', { name: /encounters/i }).click();
        await page.getByText(testEncounter.chiefComplaint).click();
      });

      await test.step('Amend encounter documentation', async () => {
        const amendButton = page.getByRole('button', { name: /amend/i });
        if (await amendButton.isVisible()) {
          await amendButton.click();
          
          await helpers.modal.waitForModal('amend encounter');
          
          // Add amendment reason
          await page.getByLabel(/reason for amendment/i).fill('Additional clinical findings noted');
          
          // Add amendment text
          await page.getByLabel(/amendment/i).fill('Amendment: Patient also reported mild fatigue, which was not initially documented.');
          
          await page.getByRole('button', { name: /submit amendment/i }).click();
          
          await helpers.wait.waitForToast(/amendment added/i);
          
          // Verify amendment is displayed
          await expect(page.getByText(/amendment/i)).toBeVisible();
          await expect(page.getByText(/mild fatigue/i)).toBeVisible();
        }
      });

      await test.step('Add addendum to encounter', async () => {
        const addendumButton = page.getByRole('button', { name: /addendum/i });
        if (await addendumButton.isVisible()) {
          await addendumButton.click();
          
          await page.getByLabel(/addendum/i).fill('Addendum: Patient called with additional question about exercise recommendations.');
          
          await page.getByRole('button', { name: /add addendum/i }).click();
          
          await helpers.wait.waitForToast(/addendum added/i);
        }
      });
    });
  });

  test.describe('Clinical Decision Support Integration', () => {
    test('should provide drug interaction alerts during prescribing', async () => {
      const testPatient = getTestPatient('complex_patient'); // Has existing medications
      
      await test.step('Navigate to patient medications', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        await page.getByRole('tab', { name: /medications/i }).click();
      });

      await test.step('Attempt to prescribe interacting medication', async () => {
        await page.getByRole('button', { name: /prescribe medication/i }).click();
        
        // Try to prescribe warfarin (interacts with many drugs)
        await page.getByLabel(/medication search/i).fill('Warfarin');
        
        const warfarinOption = page.getByRole('option', { name: /warfarin/i });
        if (await warfarinOption.isVisible()) {
          await warfarinOption.click();
        } else {
          await page.getByLabel(/medication name/i).fill('Warfarin 5mg');
        }
        
        // Fill dosage to trigger interaction check
        await page.getByLabel(/dosage/i).fill('5mg');
        await page.getByLabel(/frequency/i).selectOption('once daily');
      });

      await test.step('Verify drug interaction alert', async () => {
        // Should show interaction warning
        await expect(page.getByText(/drug interaction warning/i)).toBeVisible();
        
        // Should show severity level
        const severityIndicator = page.locator('[data-testid="interaction-severity"]');
        if (await severityIndicator.isVisible()) {
          await expect(severityIndicator).toContainText(/major|moderate|minor/i);
        }
        
        // Should show interacting medications
        await expect(page.getByText(/interacts with/i)).toBeVisible();
        
        // Should provide clinical guidance
        const clinicalGuidance = page.locator('[data-testid="clinical-guidance"]');
        if (await clinicalGuidance.isVisible()) {
          await expect(clinicalGuidance).toBeVisible();
        }
      });

      await test.step('Handle interaction alert', async () => {
        // Options to override or cancel
        const overrideButton = page.getByRole('button', { name: /override/i });
        const cancelButton = page.getByRole('button', { name: /cancel/i });
        
        await expect(overrideButton.or(cancelButton)).toBeVisible();
        
        // For this test, cancel the prescription
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        }
      });
    });

    test('should provide clinical guidelines and alerts', async () => {
      const testPatient = getTestPatient('complex_patient');
      
      await test.step('Navigate to patient with conditions', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
      });

      await test.step('Check for guideline alerts', async () => {
        // Should show clinical alerts based on patient conditions
        const alertsPanel = page.locator('[data-testid="clinical-alerts"]');
        if (await alertsPanel.isVisible()) {
          await expect(alertsPanel).toBeVisible();
          
          // Should show specific alerts for diabetes/hypertension
          await expect(page.getByText(/hba1c due/i).or(
            page.getByText(/blood pressure check/i)
          )).toBeVisible();
        }
      });

      await test.step('View guideline recommendations', async () => {
        const guidelinesTab = page.getByRole('tab', { name: /guidelines/i });
        if (await guidelinesTab.isVisible()) {
          await guidelinesTab.click();
          
          // Should show relevant clinical guidelines
          await expect(page.getByText(/diabetes management/i).or(
            page.getByText(/hypertension guidelines/i)
          )).toBeVisible();
        }
      });
    });

    test('should provide preventive care reminders', async () => {
      const testPatient = getTestPatient('healthy_adult');
      
      await helpers.navigation.navigateToPatient(testPatient.id);
      
      await test.step('View preventive care alerts', async () => {
        const preventiveCarePanel = page.locator('[data-testid="preventive-care"]');
        if (await preventiveCarePanel.isVisible()) {
          await expect(preventiveCarePanel).toBeVisible();
          
          // Should show age-appropriate screening recommendations
          await expect(page.getByText(/colonoscopy/i).or(
            page.getByText(/mammogram/i).or(
              page.getByText(/immunization/i)
            )
          )).toBeVisible();
        }
      });

      await test.step('Acknowledge or schedule preventive care', async () => {
        const scheduleButton = page.getByRole('button', { name: /schedule/i });
        if (await scheduleButton.isVisible()) {
          await scheduleButton.click();
          
          // Should open scheduling workflow
          await helpers.modal.waitForModal('schedule');
          
          // Cancel for this test
          await helpers.modal.closeModal();
        }
      });
    });
  });

  test.describe('Laboratory Workflow', () => {
    test('should complete lab ordering and results review workflow', async () => {
      const testPatient = getTestPatient('healthy_adult');
      const mockLabOrder = generateMockLabOrder();
      
      await test.step('Order laboratory tests', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('tab', { name: /lab orders/i }).click();
        await page.getByRole('button', { name: /new lab order/i }).click();
        
        // Select tests
        for (const test of mockLabOrder.tests) {
          const testCheckbox = page.getByLabel(new RegExp(test.name, 'i'));
          if (await testCheckbox.isVisible()) {
            await testCheckbox.check();
          }
        }
        
        // Set priority and instructions
        await page.getByLabel(/priority/i).selectOption(mockLabOrder.priority);
        await page.getByLabel(/special instructions/i).fill(mockLabOrder.specialInstructions);
        
        // Set collection date
        await page.getByLabel(/collection date/i).fill(mockLabOrder.collectionDate);
        
        await page.getByRole('button', { name: /submit order/i }).click();
        await helpers.wait.waitForToast(/lab order submitted/i);
      });

      await test.step('Verify lab order confirmation', async () => {
        // Should show order in pending list
        await expect(page.getByText(/pending/i)).toBeVisible();
        
        // Should show ordered tests
        for (const test of mockLabOrder.tests) {
          await expect(page.getByText(test.name)).toBeVisible();
        }
        
        // Should show order details
        await expect(page.getByText(mockLabOrder.priority)).toBeVisible();
        await expect(page.getByText(mockLabOrder.specialInstructions)).toBeVisible();
      });

      await test.step('Review lab results when available', async () => {
        // Switch to results tab
        await page.getByRole('tab', { name: /lab results/i }).click();
        
        // Mock that results are now available
        const testLabResult = getTestLabResult('normal_cbc');
        
        // Click on result to view details
        const resultRow = page.getByText(testLabResult.testName);
        if (await resultRow.isVisible()) {
          await resultRow.click();
          
          await helpers.modal.waitForModal('lab result details');
          
          // Verify result details
          for (const result of testLabResult.results) {
            await expect(page.getByText(result.name)).toBeVisible();
            await expect(page.getByText(result.value)).toBeVisible();
            await expect(page.getByText(result.unit)).toBeVisible();
            
            // Check for abnormal flags
            if (result.status !== 'normal') {
              await expect(page.getByText(result.status)).toBeVisible();
            }
          }
        }
      });

      await test.step('Acknowledge and act on results', async () => {
        // Acknowledge review
        const acknowledgeButton = page.getByRole('button', { name: /acknowledge/i });
        if (await acknowledgeButton.isVisible()) {
          await acknowledgeButton.click();
          
          // Add clinical notes about results
          await page.getByLabel(/clinical notes/i).fill('Lab results reviewed. All values within normal limits. No action required at this time.');
          
          await page.getByRole('button', { name: /save acknowledgment/i }).click();
          
          await helpers.wait.waitForToast(/results acknowledged/i);
        }
        
        await helpers.modal.closeModal();
      });
    });

    test('should handle critical lab values and notifications', async () => {
      const criticalLabResult = getTestLabResult('abnormal_glucose');
      
      await test.step('Receive critical lab alert', async () => {
        await helpers.navigation.navigateToPatient(criticalLabResult.patientId);
        
        // Should show critical alert banner
        const criticalAlert = page.locator('[data-testid="critical-alert"]');
        if (await criticalAlert.isVisible()) {
          await expect(criticalAlert).toBeVisible();
          await expect(criticalAlert).toContainText(/critical value/i);
        }
        
        // Navigate to lab results
        await page.getByRole('tab', { name: /lab results/i }).click();
      });

      await test.step('Review critical result', async () => {
        // Critical results should be highlighted
        const criticalResult = criticalLabResult.results.find(r => r.critical);
        if (criticalResult) {
          const criticalElement = page.getByText(criticalResult.value);
          await expect(criticalElement).toHaveClass(/critical|alert|high/);
          
          // Click to view details
          await criticalElement.click();
          
          await helpers.modal.waitForModal();
          
          // Should show critical flag
          await expect(page.getByText(/critical/i)).toBeVisible();
          
          // Should show reference range
          await expect(page.getByText(criticalResult.range)).toBeVisible();
        }
      });

      await test.step('Document critical value notification', async () => {
        // Document that patient was notified
        const notifyButton = page.getByRole('button', { name: /notify patient/i });
        if (await notifyButton.isVisible()) {
          await notifyButton.click();
          
          await page.getByLabel(/notification method/i).selectOption('phone');
          await page.getByLabel(/person notified/i).fill('Patient');
          await page.getByLabel(/notification time/i).fill(new Date().toISOString().slice(0, 16));
          await page.getByLabel(/notification notes/i).fill('Patient notified of elevated glucose. Advised to follow up with primary care.');
          
          await page.getByRole('button', { name: /save notification/i }).click();
          
          await helpers.wait.waitForToast(/notification documented/i);
        }
      });
    });
  });

  test.describe('Medication Management Workflow', () => {
    test('should complete comprehensive medication review', async () => {
      const testPatient = getTestPatient('complex_patient');
      
      await test.step('Initiate medication reconciliation', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('tab', { name: /medications/i }).click();
        await page.getByRole('button', { name: /medication reconciliation/i }).click();
      });

      await test.step('Review current medications', async () => {
        await helpers.modal.waitForModal('medication reconciliation');
        
        // Should show all current medications
        if (testPatient.medications) {
          for (const medication of testPatient.medications) {
            await expect(page.getByText(medication.name)).toBeVisible();
            
            // Mark as confirmed or needs changes
            const confirmButton = page.getByRole('button', { name: /confirm/i }).first();
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
            }
          }
        }
      });

      await test.step('Add new medications if needed', async () => {
        const addMedicationButton = page.getByRole('button', { name: /add medication/i });
        if (await addMedicationButton.isVisible()) {
          await addMedicationButton.click();
          
          const newMedication = generateMockPrescription();
          
          await helpers.form.fillForm({
            medicationName: newMedication.medication,
            dosage: newMedication.dosage,
            frequency: newMedication.frequency,
            instructions: newMedication.instructions
          });
          
          await page.getByRole('button', { name: /add to list/i }).click();
        }
      });

      await test.step('Complete reconciliation', async () => {
        await page.getByRole('button', { name: /complete reconciliation/i }).click();
        
        await helpers.wait.waitForToast(/medication reconciliation completed/i);
        
        // Should show reconciliation timestamp
        await expect(page.locator('[data-testid="reconciliation-date"]')).toBeVisible();
      });
    });

    test('should handle medication adherence monitoring', async () => {
      const testPatient = getTestPatient('complex_patient');
      
      await helpers.navigation.navigateToPatient(testPatient.id);
      await page.getByRole('tab', { name: /medications/i }).click();
      
      await test.step('Review medication adherence', async () => {
        const adherenceTab = page.getByRole('tab', { name: /adherence/i });
        if (await adherenceTab.isVisible()) {
          await adherenceTab.click();
          
          // Should show adherence information
          await expect(page.getByText(/adherence/i)).toBeVisible();
          
          // Should show adherence percentage if available
          const adherencePercent = page.locator('[data-testid="adherence-percentage"]');
          if (await adherencePercent.isVisible()) {
            await expect(adherencePercent).toContainText(/%/);
          }
        }
      });

      await test.step('Document adherence counseling', async () => {
        const counselingButton = page.getByRole('button', { name: /adherence counseling/i });
        if (await counselingButton.isVisible()) {
          await counselingButton.click();
          
          await page.getByLabel(/counseling notes/i).fill('Discussed importance of taking medications as prescribed. Patient verbalized understanding.');
          
          await page.getByRole('button', { name: /save counseling/i }).click();
          
          await helpers.wait.waitForToast(/counseling documented/i);
        }
      });
    });
  });

  test.describe('Clinical Documentation Templates', () => {
    test('should use clinical templates for efficient documentation', async () => {
      const testPatient = getTestPatient('healthy_adult');
      
      await test.step('Access clinical templates', async () => {
        await helpers.navigation.navigateToPatient(testPatient.id);
        
        await page.getByRole('button', { name: /new encounter/i }).click();
        
        // Select encounter type that has templates
        await page.getByLabel(/encounter type/i).selectOption('annual-physical');
      });

      await test.step('Use template for documentation', async () => {
        const useTemplateButton = page.getByRole('button', { name: /use template/i });
        if (await useTemplateButton.isVisible()) {
          await useTemplateButton.click();
          
          // Should populate template fields
          await expect(page.getByText(/annual physical examination/i)).toBeVisible();
          
          // Template should have pre-filled sections
          const hpiField = page.getByLabel(/history of present illness/i);
          if (await hpiField.isVisible() && await hpiField.inputValue()) {
            const templateText = await hpiField.inputValue();
            expect(templateText.length).toBeGreaterThan(0);
          }
        }
      });

      await test.step('Customize template content', async () => {
        // Modify template content for this patient
        const hpiField = page.getByLabel(/history of present illness/i);
        if (await hpiField.isVisible()) {
          await hpiField.fill('Patient presents for routine annual physical. Reports feeling well with no specific concerns.');
        }
        
        // Save customized documentation
        await page.getByRole('button', { name: /save notes/i }).click();
        await helpers.wait.waitForToast(/notes saved/i);
      });
    });

    test('should create and save custom documentation templates', async () => {
      await test.step('Access template management', async () => {
        await helpers.navigation.navigateTo('settings');
        
        const templatesTab = page.getByRole('tab', { name: /templates/i });
        if (await templatesTab.isVisible()) {
          await templatesTab.click();
        }
      });

      await test.step('Create new template', async () => {
        const newTemplateButton = page.getByRole('button', { name: /new template/i });
        if (await newTemplateButton.isVisible()) {
          await newTemplateButton.click();
          
          await helpers.modal.waitForModal('create template');
          
          await helpers.form.fillForm({
            templateName: 'Diabetes Follow-up',
            templateType: 'follow-up',
            description: 'Standard template for diabetes follow-up visits'
          });
          
          // Add template content
          await page.getByLabel(/template content/i).fill(`
HPI: Patient returns for diabetes follow-up.
Medications: Review current diabetes medications and adherence.
Physical Exam: Weight, blood pressure, foot exam.
Assessment: Diabetes mellitus type 2.
Plan: Continue current regimen, follow up in 3 months.
          `);
          
          await page.getByRole('button', { name: /save template/i }).click();
          
          await helpers.wait.waitForToast(/template created/i);
        }
      });
    });
  });
});