const { test, expect } = require('@playwright/test');

test.describe('Core Application Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Listen for JavaScript errors
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    // Store for later access
    page.consoleErrors = consoleErrors;
    page.jsErrors = jsErrors;
  });

  test('Dashboard Demo - Core Interactive Elements Work', async ({ page }) => {
    // Navigate to dashboard demo
    await page.goto('http://localhost:3001/dashboard-demo');
    await page.waitForLoadState('networkidle');
    
    // Verify React is loaded (critical check)
    const reactLoaded = await page.evaluate(() => {
      return typeof window.React !== 'undefined' || 
             window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
             document.querySelector('[data-reactroot]') !== null;
    });
    
    expect(reactLoaded, 'React should be loaded and hydrated').toBeTruthy();
    
    // Verify no critical JavaScript errors
    expect(page.jsErrors.length, `JavaScript errors found: ${page.jsErrors.join(', ')}`).toBe(0);
    
    // Test tab functionality (the core issue we fixed)
    await page.waitForSelector('[role="tab"]');
    
    const overviewTab = page.locator('[role="tab"]').filter({ hasText: 'Overview' });
    const tipsTab = page.locator('[role="tab"]').filter({ hasText: 'Tips' });
    const exportTab = page.locator('[role="tab"]').filter({ hasText: 'Export' });
    
    // Verify tabs are not disabled and have event listeners
    const tipsTabInfo = await tipsTab.evaluate(el => ({
      disabled: el.disabled,
      hasClick: typeof el.onclick === 'function' || el.addEventListener !== undefined,
      tagName: el.tagName
    }));
    
    expect(tipsTabInfo.disabled).toBeFalsy();
    expect(tipsTabInfo.tagName).toBe('BUTTON');
    
    // Test tab switching works
    await tipsTab.click();
    await page.waitForTimeout(100); // Allow for state change
    
    const tipsSelected = await tipsTab.getAttribute('aria-selected');
    expect(tipsSelected).toBe('true');
    
    // Verify content switches
    const tipsContent = page.locator('[role="tabpanel"]').filter({ hasText: /recommendations|tips/i });
    await expect(tipsContent).toBeVisible();
    
    // Test Export tab
    await exportTab.click();
    await page.waitForTimeout(100);
    
    const exportSelected = await exportTab.getAttribute('aria-selected');
    expect(exportSelected).toBe('true');
    
    // Verify interactive elements work
    const expandableItems = page.locator('[data-state="closed"]').first();
    if (await expandableItems.isVisible()) {
      await expandableItems.click();
      await page.waitForTimeout(100);
      const expandedState = await expandableItems.getAttribute('data-state');
      expect(expandedState).toBe('open');
    }
    
    // Verify no hydration mismatches or errors
    const hydrationErrors = page.consoleErrors.filter(error => 
      error.includes('hydration') || 
      error.includes('mismatch') ||
      error.includes('Warning: ')
    );
    
    expect(hydrationErrors.length, `Hydration errors found: ${hydrationErrors.join(', ')}`).toBe(0);
  });

  test('Home Page - Basic Navigation Works', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Verify no critical errors
    expect(page.jsErrors.length, `JavaScript errors on home page: ${page.jsErrors.join(', ')}`).toBe(0);
    
    // Test navigation links work
    const uploadLink = page.locator('a[href="/upload"]').first();
    if (await uploadLink.isVisible()) {
      await uploadLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/upload');
    }
  });

  test('Upload Page - Form Elements Respond', async ({ page }) => {
    await page.goto('http://localhost:3001/upload');
    await page.waitForLoadState('networkidle');
    
    // Verify no critical errors
    expect(page.jsErrors.length, `JavaScript errors on upload page: ${page.jsErrors.join(', ')}`).toBe(0);
    
    // Test basic interactivity (file inputs, buttons, etc.)
    const fileInput = page.locator('input[type="file"]').first();
    const buttons = page.locator('button').first();
    
    if (await fileInput.isVisible()) {
      // Verify file input is not disabled
      const inputDisabled = await fileInput.isDisabled();
      expect(inputDisabled).toBeFalsy();
    }
    
    if (await buttons.isVisible()) {
      // Verify buttons respond to hover/focus
      await buttons.hover();
      // Basic interaction test passed if no errors
    }
  });
});

test.describe('Post-Task Verification', () => {
  test('Critical User Journeys - Smoke Test', async ({ page }) => {
    // This is the key test that should pass after every task
    await page.goto('http://localhost:3001/dashboard-demo');
    await page.waitForLoadState('networkidle');
    
    // Critical checks that must pass
    const criticalChecks = await page.evaluate(() => {
      return {
        reactLoaded: typeof window.React !== 'undefined' || 
                    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined,
        tabsPresent: document.querySelectorAll('[role="tab"]').length > 0,
        buttonsResponsive: Array.from(document.querySelectorAll('button')).some(btn => 
          !btn.disabled && btn.style.pointerEvents !== 'none'
        ),
        noHydrationWarnings: !document.body.innerHTML.includes('Warning:')
      };
    });
    
    expect(criticalChecks.reactLoaded, 'React must be loaded').toBeTruthy();
    expect(criticalChecks.tabsPresent, 'Interactive tabs must be present').toBeTruthy();
    expect(criticalChecks.buttonsResponsive, 'Buttons must be responsive').toBeTruthy();
    
    // Test the specific functionality we just fixed
    const tipsTab = page.locator('[role="tab"]').filter({ hasText: 'Tips' });
    await tipsTab.click();
    
    const selected = await tipsTab.getAttribute('aria-selected');
    expect(selected, 'Tabs must respond to clicks').toBe('true');
    
    console.log('✅ Post-task verification: All critical functionality working');
  });
}); 