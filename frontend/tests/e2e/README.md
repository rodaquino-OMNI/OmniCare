# OmniCare E2E Test Suite

Comprehensive end-to-end testing framework for the OmniCare Electronic Medical Records system.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all E2E tests
npm run test:e2e

# Run tests with UI
npm run test:e2e:ui

# Run specific test categories
npx playwright test --grep="Authentication"
npx playwright test --grep="Patient Management"
npx playwright test --grep="Clinical Workflows"
npx playwright test --grep="FHIR Operations"
```

## 📁 Test Structure

```
tests/e2e/
├── helpers/
│   ├── test-data.ts          # Mock data generators
│   └── test-utils.ts         # Test helper functions
├── fixtures/
│   └── test-patients.ts      # Pre-defined test data
├── auth-comprehensive.spec.ts
├── patient-management-comprehensive.spec.ts
├── clinical-workflows-comprehensive.spec.ts
├── fhir-operations.spec.ts
├── error-handling-comprehensive.spec.ts
├── global-setup.ts
├── global-teardown.ts
└── README.md
```

## 🧪 Test Categories

### Authentication Tests (`auth-comprehensive.spec.ts`)
- ✅ Demo user login flows (Doctor, Nurse, Admin)
- ✅ Form validation and error handling
- ✅ Session management and timeout
- ✅ Security features and protection
- ✅ Multi-browser and mobile support
- ✅ Accessibility compliance

### Patient Management Tests (`patient-management-comprehensive.spec.ts`)
- ✅ Complete patient registration workflow
- ✅ Patient search and filtering
- ✅ Patient profile management
- ✅ Duplicate patient detection
- ✅ Insurance verification
- ✅ Clinical data views and timeline

### Clinical Workflows Tests (`clinical-workflows-comprehensive.spec.ts`)
- ✅ Complete clinical encounter documentation
- ✅ Vital signs recording
- ✅ Clinical notes and templates
- ✅ Assessment and plan documentation
- ✅ Electronic signatures
- ✅ Clinical decision support integration
- ✅ Laboratory workflow
- ✅ Medication management and reconciliation

### FHIR Operations Tests (`fhir-operations.spec.ts`)
- ✅ Patient resource CRUD operations
- ✅ Observation resource management
- ✅ MedicationRequest workflows
- ✅ Encounter resource operations
- ✅ FHIR search and Bundle operations
- ✅ Resource validation and error handling

### Error Handling Tests (`error-handling-comprehensive.spec.ts`)
- ✅ Network connectivity issues
- ✅ Authentication and session management
- ✅ Data validation and input errors
- ✅ Browser and device compatibility
- ✅ Concurrent user actions
- ✅ Data integrity and recovery
- ✅ Performance and resource management

## 🛠 Test Helpers and Utilities

### Helper Classes

```typescript
const helpers = createHelpers(page);

// Authentication helpers
await helpers.auth.loginAsUser('doctor');
await helpers.auth.logout();

// Navigation helpers
await helpers.navigation.navigateTo('patients');
await helpers.navigation.navigateToPatient(patientId);

// Form helpers
await helpers.form.fillForm(formData);
await helpers.form.submitForm('Submit');

// Table helpers
await helpers.table.sortByColumn('Name');
await helpers.table.filterTable('search term');

// Modal helpers
await helpers.modal.waitForModal('Edit Patient');
await helpers.modal.confirmModal('Save');

// API mocking helpers
await helpers.api.mockAPIError('**/patients', 500);
await helpers.api.mockNetworkFailure('**');

// Wait helpers
await helpers.wait.waitForLoading();
await helpers.wait.waitForToast('Success message');

// Accessibility helpers
await helpers.a11y.testKeyboardNavigation(['input1', 'input2']);
await helpers.a11y.checkColorContrast();
```

### Test Data Generation

```typescript
// Generate realistic mock data
const mockPatient = generateMockPatient();
const mockVitals = generateMockVitalSigns();
const mockPrescription = generateMockPrescription();

// Use pre-defined test fixtures
const testPatient = getTestPatient('healthy_adult');
const testEncounter = getTestEncounter('routine_checkup');

// Generate complete test scenarios
const scenario = generateCompletePatientScenario();
```

## 🎯 Test Coverage

### Critical User Flows
- [x] User authentication and authorization
- [x] Patient registration and management
- [x] Clinical encounter documentation
- [x] Medication prescribing and management
- [x] Laboratory orders and results
- [x] Vital signs recording
- [x] Clinical decision support
- [x] FHIR resource operations

### Error Scenarios
- [x] Network failures and recovery
- [x] Session timeouts and conflicts
- [x] Data validation errors
- [x] Server errors and API failures
- [x] Concurrent user actions
- [x] Browser compatibility issues
- [x] Performance under load

### Accessibility
- [x] Keyboard navigation
- [x] Screen reader compatibility
- [x] Color contrast compliance
- [x] ARIA labels and structure
- [x] Mobile device support

## 📊 Test Configuration

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
});
```

### Environment Setup

The global setup performs:
- ✅ Application health validation
- ✅ Test environment configuration
- ✅ Test data preparation
- ✅ Authentication system validation
- ✅ Performance monitoring setup

The global teardown performs:
- ✅ Test report generation
- ✅ Test environment cleanup
- ✅ Test data cleanup
- ✅ Browser storage cleanup
- ✅ Performance metrics collection

## 📈 Test Reporting

### Generated Reports

1. **JSON Report**: `test-results/e2e-results.json`
2. **HTML Report**: `test-results/html-report/index.html`
3. **JUnit Report**: `test-results/e2e-results.xml`
4. **Custom Report**: `test-results/reports/e2e-test-report-{id}.html`

### Report Contents

- Test execution summary and statistics
- Pass/fail rates by test category
- Performance metrics and timing
- Screenshot and video evidence for failures
- Test coverage analysis
- Browser compatibility results

## 🔧 Running Tests

### Local Development

```bash
# Start the application
npm run dev

# In another terminal, run tests
npm run test:e2e

# Run specific test file
npx playwright test auth-comprehensive.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Debug specific test
npx playwright test --debug auth-comprehensive.spec.ts
```

### CI/CD Integration

```bash
# Install Playwright browsers
npx playwright install

# Run tests in CI mode
CI=true npm run test:e2e

# Generate and upload reports
npm run test:e2e:report
```

### Docker Support

```bash
# Run tests in Docker
docker run --rm -v $(pwd):/app -w /app mcr.microsoft.com/playwright:focal-dev bash -c "npm ci && npm run test:e2e"
```

## 🚨 Troubleshooting

### Common Issues

1. **Tests fail with "Target page, context or browser has been closed"**
   - Ensure proper cleanup in test teardown
   - Check for memory leaks or browser crashes

2. **Authentication tests fail**
   - Verify demo user credentials are correct
   - Check if authentication service is running

3. **Tests timeout**
   - Increase timeout values in configuration
   - Check for slow API responses
   - Verify network connectivity

4. **Tests are flaky**
   - Add proper wait conditions
   - Use helper functions for common operations
   - Increase retries for CI environment

### Debug Mode

```bash
# Run with debug output
DEBUG=pw:* npm run test:e2e

# Run in slow motion
npx playwright test --slow-mo=1000

# Run with browser visible
npx playwright test --headed --slow-mo=500
```

## 📝 Writing New Tests

### Test Structure Template

```typescript
import { test, expect, Page } from '@playwright/test';
import { createHelpers, setupTest, cleanupTest } from './helpers/test-utils';

test.describe('Feature Name', () => {
  let page: Page;
  let helpers: ReturnType<typeof createHelpers>;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    helpers = await setupTest(page, 'doctor');
  });

  test.afterEach(async () => {
    await cleanupTest(page);
  });

  test('should perform specific action', async () => {
    await test.step('Setup test data', async () => {
      // Test setup
    });

    await test.step('Perform action', async () => {
      // Test action
    });

    await test.step('Verify result', async () => {
      // Test assertions
    });
  });
});
```

### Best Practices

1. **Use descriptive test names** that clearly state the expected behavior
2. **Group related tests** using `test.describe` blocks
3. **Use test steps** to break down complex test scenarios
4. **Leverage helper functions** for common operations
5. **Mock external dependencies** to ensure test reliability
6. **Use proper wait strategies** instead of fixed timeouts
7. **Clean up after tests** to avoid side effects
8. **Add accessibility checks** for inclusive testing

## 🔒 Security Testing

The test suite includes security-focused tests:

- SQL injection prevention
- XSS attack prevention
- Authentication bypass attempts
- Session hijacking protection
- Data validation and sanitization
- CSRF protection verification

## 🎨 Accessibility Testing

Built-in accessibility testing includes:

- Keyboard navigation verification
- Screen reader compatibility
- Color contrast validation
- ARIA attribute checking
- Focus management testing
- Mobile accessibility support

## 📱 Mobile Testing

Mobile-specific test scenarios:

- Responsive design validation
- Touch interaction testing
- Mobile navigation patterns
- Performance on mobile devices
- Offline functionality (where applicable)

## 🔄 Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npm run test:e2e
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [OmniCare API Documentation](../backend/README.md)
- [Frontend Component Library](../src/components/README.md)

---

**Generated by E2E Test Engineer for OmniCare EMR System**  
*Comprehensive testing for healthcare excellence* 🏥✨