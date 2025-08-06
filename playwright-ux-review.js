const { chromium } = require('playwright');

async function conductUXReview() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50 
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('\n🔍 Starting SpeakEasy UX Review\n');
  console.log('=' .repeat(60));

  const findings = {
    firstImpressions: [],
    clarity: [],
    useCases: [],
    missingInfo: [],
    improvements: [],
    interactions: [],
    performance: []
  };

  try {
    // Test 1: Initial page load and first impressions
    console.log('\n📱 Testing initial page load...');
    const startTime = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    findings.performance.push(`Page load time: ${loadTime}ms`);

    // Capture initial viewport
    await page.screenshot({ path: 'ux-review-hero.png' });

    // Test 2: Hero section analysis
    console.log('🎯 Analyzing hero section...');
    const heroText = await page.textContent('h1').catch(() => 'Not found');
    const tagline = await page.textContent('p.font-text').catch(() => 'Not found');
    findings.firstImpressions.push(`Hero headline: "${heroText}"`);
    findings.firstImpressions.push(`Tagline: "${tagline}"`);

    // Test 3: Interactive elements in hero
    console.log('🎮 Testing interactive elements...');
    
    // Check for demo/audio elements
    const audioElements = await page.$$('[data-audio], audio, .audio-player, button:has-text("Play"), button:has-text("Demo")');
    findings.interactions.push(`Found ${audioElements.length} audio/demo elements`);

    // Look for the audio pill/player
    const audioPill = await page.$('.group.inline-flex.items-center.gap-2.rounded-full');
    if (audioPill) {
      const isVisible = await audioPill.isVisible();
      findings.interactions.push(`Audio pill player is ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible) {
        // Try to interact with it
        await audioPill.hover();
        await page.waitForTimeout(500);
        
        // Check for any hover effects
        const hoverState = await audioPill.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            transform: styles.transform,
            cursor: styles.cursor
          };
        });
        findings.interactions.push(`Audio pill hover effects: cursor=${hoverState.cursor}`);
        
        // Try clicking it
        await audioPill.click();
        await page.waitForTimeout(1000);
        findings.interactions.push('Clicked audio pill - checking for audio playback');
      }
    }

    // Test 4: CTAs and installation
    console.log('🔘 Analyzing CTAs...');
    const ctaButtons = await page.$$('button, a[href*="npm"], a[href*="github"], a[href*="docs"]');
    findings.clarity.push(`Found ${ctaButtons.length} CTA buttons/links`);

    // Check for installation command
    const codeBlocks = await page.$$('pre, code');
    for (const block of codeBlocks) {
      const text = await block.textContent();
      if (text.includes('npm install') || text.includes('pnpm add') || text.includes('yarn add')) {
        findings.clarity.push(`Installation command found: "${text.trim()}"`);
        
        // Check if it's copyable
        const parent = await block.evaluateHandle(el => el.parentElement);
        const hasCopyButton = await parent.evaluate(el => el.querySelector('button[aria-label*="copy" i], button:has-text("Copy")') !== null);
        findings.interactions.push(`Installation command ${hasCopyButton ? 'has' : 'lacks'} copy button`);
      }
    }

    // Test 5: Navigation and sections
    console.log('📋 Testing navigation...');
    const navItems = await page.$$('nav a, header a');
    const navTexts = [];
    for (const item of navItems) {
      const text = await item.textContent();
      if (text && text.trim()) navTexts.push(text.trim());
    }
    findings.clarity.push(`Navigation items: ${navTexts.join(', ')}`);

    // Test 6: Scroll and discover more content
    console.log('📜 Scrolling to discover content...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    // Check for features section
    const featuresSection = await page.$('[id*="features"], section:has-text("Features"), section:has-text("Why")');
    if (featuresSection) {
      const features = await featuresSection.$$('h3, h4');
      const featureTexts = [];
      for (const feature of features) {
        const text = await feature.textContent();
        featureTexts.push(text);
      }
      findings.useCases.push(`Key features highlighted: ${featureTexts.join(', ')}`);
    }

    // Test 7: Code examples
    console.log('💻 Analyzing code examples...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    
    const codeExamples = await page.$$('pre:has(code)');
    findings.clarity.push(`Found ${codeExamples.length} code examples`);
    
    if (codeExamples.length > 0) {
      const firstExample = await codeExamples[0].textContent();
      findings.useCases.push(`First code example shows: ${firstExample.substring(0, 100)}...`);
    }

    // Test 8: Documentation links
    console.log('📚 Checking documentation...');
    const docLinks = await page.$$('a[href*="docs"], a[href*="documentation"], a:has-text("Docs"), a:has-text("Documentation")');
    findings.clarity.push(`Documentation links found: ${docLinks.length}`);
    
    if (docLinks.length > 0) {
      // Click first doc link
      await docLinks[0].click();
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      findings.interactions.push(`Documentation link navigates to: ${currentUrl}`);
      
      // Go back to main page
      if (currentUrl !== 'http://localhost:3000') {
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }

    // Test 9: GitHub integration
    console.log('🐙 Checking GitHub presence...');
    const githubLinks = await page.$$('a[href*="github"]');
    if (githubLinks.length > 0) {
      const href = await githubLinks[0].getAttribute('href');
      findings.clarity.push(`GitHub repository: ${href}`);
    } else {
      findings.missingInfo.push('No GitHub repository link found');
    }

    // Test 10: Mobile responsiveness
    console.log('📱 Testing mobile view...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'ux-review-mobile.png' });
    
    // Check if navigation becomes hamburger
    const mobileMenu = await page.$('[aria-label*="menu" i], button:has-text("Menu"), [role="navigation"] button');
    findings.interactions.push(`Mobile menu: ${mobileMenu ? 'Present' : 'Missing'}`);

    // Test 11: Dark mode support
    console.log('🌙 Checking theme support...');
    const themeToggle = await page.$('button[aria-label*="theme" i], button[aria-label*="mode" i], button:has-text("Theme")');
    if (themeToggle) {
      await themeToggle.click();
      await page.waitForTimeout(500);
      findings.interactions.push('Dark/light mode toggle available');
    } else {
      findings.missingInfo.push('No theme toggle found');
    }

    // Test 12: Footer and additional resources
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    const footer = await page.$('footer');
    if (footer) {
      const footerLinks = await footer.$$('a');
      findings.clarity.push(`Footer contains ${footerLinks.length} links`);
    }

    // Test 13: Search functionality
    console.log('🔍 Checking search...');
    const searchInput = await page.$('input[type="search"], input[placeholder*="search" i]');
    findings.missingInfo.push(searchInput ? 'Search functionality present' : 'No search functionality found');

    // Test 14: Version/release info
    const versionInfo = await page.$('*:has-text("version"), *:has-text("v0"), *:has-text("v1")');
    if (!versionInfo) {
      findings.missingInfo.push('No version information displayed');
    }

    // Test 15: Quick start prominence
    console.log('🚀 Evaluating quick start experience...');
    const quickStartSection = await page.$('*:has-text("Quick Start"), *:has-text("Get Started"), *:has-text("Getting Started")');
    if (quickStartSection) {
      findings.clarity.push('Quick start section is present');
    } else {
      findings.missingInfo.push('No clear quick start section');
    }

  } catch (error) {
    console.error('Error during review:', error);
    findings.improvements.push(`Error encountered: ${error.message}`);
  } finally {
    console.log('\n📊 Review Complete!\n');
    console.log('=' .repeat(60));
    
    // Output findings
    console.log('\n🎯 Key Findings:\n');
    Object.entries(findings).forEach(([category, items]) => {
      if (items.length > 0) {
        console.log(`\n${category.toUpperCase()}:`);
        items.forEach(item => console.log(`  • ${item}`));
      }
    });

    await browser.close();
  }
}

// Run the review
conductUXReview().catch(console.error);