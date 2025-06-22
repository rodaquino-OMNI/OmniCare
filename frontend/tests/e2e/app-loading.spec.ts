import { test, expect } from '@playwright/test';

test.describe('App Loading Debug', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/app-loading-debug.png', fullPage: true });
    
    // Log page content
    const pageContent = await page.textContent('body');
    console.log('Page content:', pageContent);
    
    // Check if we're stuck on loading
    const isLoading = pageContent?.includes('Loading React App');
    console.log('Is stuck on loading?', isLoading);
    
    // Check for any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
    
    // Wait for any dynamic content
    await page.waitForTimeout(5000);
    
    // Check current URL
    console.log('Current URL:', page.url());
    
    // Try to find any visible elements
    const visibleElements = await page.$$eval('*', elements => 
      elements
        .filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.textContent?.trim();
        })
        .slice(0, 10)
        .map(el => ({
          tag: el.tagName,
          text: el.textContent?.substring(0, 100),
          id: el.id,
          classes: el.className
        }))
    );
    console.log('Visible elements:', JSON.stringify(visibleElements, null, 2));
    
    // Expect something other than loading
    await expect(page.locator('body')).not.toHaveText('Loading React App', { timeout: 30000 });
  });
  
  test('should navigate directly to login', async ({ page }) => {
    // Go directly to login page
    await page.goto('/auth/login', { waitUntil: 'networkidle', timeout: 60000 });
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/login-page-debug.png', fullPage: true });
    
    // Check content
    const pageContent = await page.textContent('body');
    console.log('Login page content:', pageContent);
    
    // Check URL
    console.log('Login URL:', page.url());
  });
});