# Test info

- Name: Core Application Functionality >> Home Page - Basic Navigation Works
- Location: /Users/jaredpace/Documents/code/pitch-perfect/__tests__/e2e/core-functionality.e2e.test.js:95:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "/upload"
Received string:    "http://localhost:3001/"
    at /Users/jaredpace/Documents/code/pitch-perfect/__tests__/e2e/core-functionality.e2e.test.js:107:26
```

# Page snapshot

```yaml
- heading "Pitch Perfect" [level=1]
- paragraph: Transform your presentations with AI-powered analysis using our comprehensive 15-point framework. Get instant, actionable feedback to make every pitch count.
- link "Analyze Your Pitch Now":
  - /url: /upload
- link "View Sample Analysis":
  - /url: /results
- text: 15 Evaluation Points 4 Core Categories AI Powered Analysis
- heading "The 15-Point Framework" [level=2]
- paragraph: Our research-backed framework evaluates every aspect of your presentation, from speech delivery to content structure, providing comprehensive insights that traditional feedback can't match.
- text: Speech Mechanics 30%
- list:
  - listitem: 1 Pace and Rhythm
  - listitem: 2 Volume and Projection
  - listitem: 3 Clarity and Articulation
  - listitem: 4 Filler Words and Pauses
  - listitem: 5 Vocal Confidence
- text: Content Quality 40%
- list:
  - listitem: 6 Problem Definition Clarity
  - listitem: 7 Solution Explanation
  - listitem: 8 Market Size Validation
  - listitem: 9 Traction Demonstration
  - listitem: 10 Financial Projections
- text: Visual Presentation 20%
- list:
  - listitem: 11 Slide Design Effectiveness
  - listitem: 12 Data Visualization Quality
  - listitem: 13 Timing and Flow
- text: Overall Effectiveness 10%
- list:
  - listitem: 14 Persuasion and Storytelling
  - listitem: 15 Confidence and Credibility
- heading "See What You'll Get" [level=2]
- paragraph: Our AI analyzes your pitch video and provides detailed scores and actionable recommendations across all framework categories.
- text: Sample Analysis Results 82
- paragraph: Overall Pitch Score
- text: Speech Mechanics 78/100
- progressbar
- text: Content Quality 85/100
- progressbar
- text: Visual Presentation 80/100
- progressbar
- text: Overall Effectiveness 84/100
- progressbar
- link "View Full Sample Report":
  - /url: /results
- heading "Why Choose Pitch Perfect?" [level=2]
- paragraph: Get professional-grade feedback in minutes, not days.
- text: 🎯 Comprehensive Analysis
- paragraph: Our 15-point framework covers every aspect of your presentation - from speech delivery to visual design and content structure.
- text: ⚡ Instant Feedback
- paragraph: Upload your video and receive detailed analysis in minutes. No more waiting weeks for coaching sessions or peer review.
- text: 📊 Actionable Insights
- paragraph: Receive specific, measurable recommendations that you can implement immediately to improve your pitch performance.
- heading "Ready to Perfect Your Pitch?" [level=2]
- paragraph: Join hundreds of founders who've improved their presentations with our AI-powered analysis.
- link "Get Started Now":
  - /url: /upload
- link "View Sample Results":
  - /url: /results
- alert
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
   7 |     page.on('console', msg => {
   8 |       if (msg.type() === 'error') {
   9 |         consoleErrors.push(msg.text());
   10 |       }
   11 |     });
   12 |     
   13 |     // Listen for JavaScript errors
   14 |     const jsErrors = [];
   15 |     page.on('pageerror', error => {
   16 |       jsErrors.push(error.message);
   17 |     });
   18 |     
   19 |     // Store for later access
   20 |     page.consoleErrors = consoleErrors;
   21 |     page.jsErrors = jsErrors;
   22 |   });
   23 |
   24 |   test('Dashboard Demo - Core Interactive Elements Work', async ({ page }) => {
   25 |     // Navigate to dashboard demo
   26 |     await page.goto('http://localhost:3001/dashboard-demo');
   27 |     await page.waitForLoadState('networkidle');
   28 |     
   29 |     // Verify React is loaded (critical check)
   30 |     const reactLoaded = await page.evaluate(() => {
   31 |       return typeof window.React !== 'undefined' || 
   32 |              window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
   33 |              document.querySelector('[data-reactroot]') !== null;
   34 |     });
   35 |     
   36 |     expect(reactLoaded, 'React should be loaded and hydrated').toBeTruthy();
   37 |     
   38 |     // Verify no critical JavaScript errors
   39 |     expect(page.jsErrors.length, `JavaScript errors found: ${page.jsErrors.join(', ')}`).toBe(0);
   40 |     
   41 |     // Test tab functionality (the core issue we fixed)
   42 |     await page.waitForSelector('[role="tab"]');
   43 |     
   44 |     const overviewTab = page.locator('[role="tab"]').filter({ hasText: 'Overview' });
   45 |     const tipsTab = page.locator('[role="tab"]').filter({ hasText: 'Tips' });
   46 |     const exportTab = page.locator('[role="tab"]').filter({ hasText: 'Export' });
   47 |     
   48 |     // Verify tabs are not disabled and have event listeners
   49 |     const tipsTabInfo = await tipsTab.evaluate(el => ({
   50 |       disabled: el.disabled,
   51 |       hasClick: typeof el.onclick === 'function' || el.addEventListener !== undefined,
   52 |       tagName: el.tagName
   53 |     }));
   54 |     
   55 |     expect(tipsTabInfo.disabled).toBeFalsy();
   56 |     expect(tipsTabInfo.tagName).toBe('BUTTON');
   57 |     
   58 |     // Test tab switching works
   59 |     await tipsTab.click();
   60 |     await page.waitForTimeout(100); // Allow for state change
   61 |     
   62 |     const tipsSelected = await tipsTab.getAttribute('aria-selected');
   63 |     expect(tipsSelected).toBe('true');
   64 |     
   65 |     // Verify content switches
   66 |     const tipsContent = page.locator('[role="tabpanel"]').filter({ hasText: /recommendations|tips/i });
   67 |     await expect(tipsContent).toBeVisible();
   68 |     
   69 |     // Test Export tab
   70 |     await exportTab.click();
   71 |     await page.waitForTimeout(100);
   72 |     
   73 |     const exportSelected = await exportTab.getAttribute('aria-selected');
   74 |     expect(exportSelected).toBe('true');
   75 |     
   76 |     // Verify interactive elements work
   77 |     const expandableItems = page.locator('[data-state="closed"]').first();
   78 |     if (await expandableItems.isVisible()) {
   79 |       await expandableItems.click();
   80 |       await page.waitForTimeout(100);
   81 |       const expandedState = await expandableItems.getAttribute('data-state');
   82 |       expect(expandedState).toBe('open');
   83 |     }
   84 |     
   85 |     // Verify no hydration mismatches or errors
   86 |     const hydrationErrors = page.consoleErrors.filter(error => 
   87 |       error.includes('hydration') || 
   88 |       error.includes('mismatch') ||
   89 |       error.includes('Warning: ')
   90 |     );
   91 |     
   92 |     expect(hydrationErrors.length, `Hydration errors found: ${hydrationErrors.join(', ')}`).toBe(0);
   93 |   });
   94 |
   95 |   test('Home Page - Basic Navigation Works', async ({ page }) => {
   96 |     await page.goto('http://localhost:3001');
   97 |     await page.waitForLoadState('networkidle');
   98 |     
   99 |     // Verify no critical errors
  100 |     expect(page.jsErrors.length, `JavaScript errors on home page: ${page.jsErrors.join(', ')}`).toBe(0);
  101 |     
  102 |     // Test navigation links work
  103 |     const uploadLink = page.locator('a[href="/upload"]').first();
  104 |     if (await uploadLink.isVisible()) {
  105 |       await uploadLink.click();
  106 |       await page.waitForLoadState('networkidle');
> 107 |       expect(page.url()).toContain('/upload');
      |                          ^ Error: expect(received).toContain(expected) // indexOf
  108 |     }
  109 |   });
  110 |
  111 |   test('Upload Page - Form Elements Respond', async ({ page }) => {
  112 |     await page.goto('http://localhost:3001/upload');
  113 |     await page.waitForLoadState('networkidle');
  114 |     
  115 |     // Verify no critical errors
  116 |     expect(page.jsErrors.length, `JavaScript errors on upload page: ${page.jsErrors.join(', ')}`).toBe(0);
  117 |     
  118 |     // Test basic interactivity (file inputs, buttons, etc.)
  119 |     const fileInput = page.locator('input[type="file"]').first();
  120 |     const buttons = page.locator('button').first();
  121 |     
  122 |     if (await fileInput.isVisible()) {
  123 |       // Verify file input is not disabled
  124 |       const inputDisabled = await fileInput.isDisabled();
  125 |       expect(inputDisabled).toBeFalsy();
  126 |     }
  127 |     
  128 |     if (await buttons.isVisible()) {
  129 |       // Verify buttons respond to hover/focus
  130 |       await buttons.hover();
  131 |       // Basic interaction test passed if no errors
  132 |     }
  133 |   });
  134 | });
  135 |
  136 | test.describe('Post-Task Verification', () => {
  137 |   test('Critical User Journeys - Smoke Test', async ({ page }) => {
  138 |     // This is the key test that should pass after every task
  139 |     await page.goto('http://localhost:3001/dashboard-demo');
  140 |     await page.waitForLoadState('networkidle');
  141 |     
  142 |     // Critical checks that must pass
  143 |     const criticalChecks = await page.evaluate(() => {
  144 |       return {
  145 |         reactLoaded: typeof window.React !== 'undefined' || 
  146 |                     window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined,
  147 |         tabsPresent: document.querySelectorAll('[role="tab"]').length > 0,
  148 |         buttonsResponsive: Array.from(document.querySelectorAll('button')).some(btn => 
  149 |           !btn.disabled && btn.style.pointerEvents !== 'none'
  150 |         ),
  151 |         noHydrationWarnings: !document.body.innerHTML.includes('Warning:')
  152 |       };
  153 |     });
  154 |     
  155 |     expect(criticalChecks.reactLoaded, 'React must be loaded').toBeTruthy();
  156 |     expect(criticalChecks.tabsPresent, 'Interactive tabs must be present').toBeTruthy();
  157 |     expect(criticalChecks.buttonsResponsive, 'Buttons must be responsive').toBeTruthy();
  158 |     
  159 |     // Test the specific functionality we just fixed
  160 |     const tipsTab = page.locator('[role="tab"]').filter({ hasText: 'Tips' });
  161 |     await tipsTab.click();
  162 |     
  163 |     const selected = await tipsTab.getAttribute('aria-selected');
  164 |     expect(selected, 'Tabs must respond to clicks').toBe('true');
  165 |     
  166 |     console.log('✅ Post-task verification: All critical functionality working');
  167 |   });
  168 | }); 
```