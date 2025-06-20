import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log('Starting global setup for E2E tests...');
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the application to be ready
    console.log(`Checking if application is ready at ${baseURL}`);
    await page.goto(baseURL || 'http://localhost:3000');
    
    // Wait for the main content to load
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Perform any necessary setup like authentication
    await setupTestEnvironment(page);
    
    console.log('Global setup completed successfully');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupTestEnvironment(page: any) {
  // Setup test data, authentication, etc.
  // This could include:
  // - Creating test users
  // - Setting up test data in the database
  // - Authenticating with test credentials
  
  try {
    // Example: Check if we need to authenticate
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // If we're on a login page, we might want to set up authentication
    // For now, just log that setup is running
    console.log('Test environment setup completed');
  } catch (error) {
    console.error('Test environment setup failed:', error);
    throw error;
  }
}

export default globalSetup;