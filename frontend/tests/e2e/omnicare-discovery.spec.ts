import { test, expect } from '@playwright/test';

test.describe('OmniCare App Discovery', () => {
  test('investigate app structure and routing', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`Browser console: ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', error => console.error(`Page error: ${error}`));
    
    // Check if the app title is correct
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check localStorage for any clues
    const localStorageData = await page.evaluate(() => {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) data[key] = localStorage.getItem(key);
      }
      return data;
    });
    console.log('LocalStorage:', JSON.stringify(localStorageData, null, 2));
    
    // Try different routes
    const routes = [
      '/',
      '/auth/login',
      '/dashboard',
      '/patients',
      '/login',
      '/signin',
      '/api/health'
    ];
    
    for (const route of routes) {
      console.log(`\nChecking route: ${route}`);
      const response = await page.goto(route, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      }).catch(e => null);
      
      if (response) {
        console.log(`  Status: ${response.status()}`);
        console.log(`  URL: ${page.url()}`);
        
        // Get visible text content
        const visibleText = await page.evaluate(() => {
          const body = document.body;
          return body ? body.innerText.substring(0, 200) : 'No body content';
        });
        console.log(`  Content: ${visibleText.replace(/\n/g, ' ')}`);
        
        // Check for specific elements
        const hasLoginForm = await page.locator('form').count() > 0;
        const hasEmailInput = await page.locator('input[type="email"]').count() > 0;
        const hasPasswordInput = await page.locator('input[type="password"]').count() > 0;
        
        if (hasLoginForm || hasEmailInput || hasPasswordInput) {
          console.log('  ✓ Found potential login elements!');
          await page.screenshot({ 
            path: `test-results/route-${route.replace(/\//g, '-')}.png` 
          });
        }
      }
    }
    
    // Check if there's any React or Next.js specific info
    const reactInfo = await page.evaluate(() => {
      return {
        hasReact: !!(window as any).React,
        hasNext: !!(window as any).next,
        reactVersion: (window as any).React?.version,
        // Check for any global app config
        appConfig: (window as any).__APP_CONFIG__ || (window as any).APP_CONFIG,
      };
    });
    console.log('\nReact/Next info:', JSON.stringify(reactInfo, null, 2));
    
    // Final check - look for any Mantine components
    const mantineElements = await page.locator('[class*="mantine"]').count();
    console.log(`\nMantine elements found: ${mantineElements}`);
  });
});