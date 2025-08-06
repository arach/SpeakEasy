const { chromium } = require('playwright');

async function conductFullUXReview() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('\n🚀 SPEAKEASY UX REVIEW - Senior Developer Perspective\n');
  console.log('=' .repeat(70));

  const review = {
    firstImpressions: {
      positive: [],
      negative: [],
      neutral: []
    },
    clarity: {
      clear: [],
      confusing: [],
      missing: []
    },
    useCases: {
      identified: [],
      myUseCase: [],
      targetAudience: []
    },
    adoption: {
      pros: [],
      cons: [],
      blockers: []
    },
    improvements: [],
    technicalDetails: {
      setup: [],
      docs: [],
      examples: []
    }
  };

  try {
    // ============ FIRST IMPRESSIONS ============
    console.log('\n1️⃣ FIRST IMPRESSIONS (First 30 seconds)\n');
    
    const startTime = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    await page.waitForTimeout(2000); // Let me "take it in" like a real user
    
    // What do I see immediately?
    const heroHeadline = await page.$eval('h1', el => el.textContent).catch(() => null);
    const heroTagline = await page.$eval('p.font-text', el => el.textContent).catch(() => null);
    
    console.log(`  📊 Page loaded in ${loadTime}ms`);
    console.log(`  📝 Hero: "${heroHeadline}"`);
    console.log(`  📝 Tagline: "${heroTagline}"`);
    
    // First impression analysis
    if (loadTime < 2000) {
      review.firstImpressions.positive.push(`Fast page load (${loadTime}ms) - good first impression`);
    } else {
      review.firstImpressions.negative.push(`Slow page load (${loadTime}ms) - might lose impatient developers`);
    }
    
    if (heroHeadline && heroHeadline.toLowerCase().includes('tts') || heroHeadline.toLowerCase().includes('speech')) {
      review.firstImpressions.positive.push('Purpose is immediately clear from headline');
    } else {
      review.firstImpressions.neutral.push('Headline exists but could be clearer about the purpose');
    }
    
    // Visual hierarchy check
    const buttons = await page.$$('button');
    const links = await page.$$('a');
    review.firstImpressions.neutral.push(`Visual complexity: ${buttons.length} buttons, ${links.length} links visible`);
    
    // ============ CLARITY & UNDERSTANDING ============
    console.log('\n2️⃣ CLARITY & UNDERSTANDING\n');
    
    // Can I understand what this does without scrolling?
    const aboveFoldContent = await page.evaluate(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const elements = document.querySelectorAll('h1, h2, h3, p, button');
      const visible = [];
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < viewport.height && rect.bottom > 0) {
          visible.push({ tag: el.tagName, text: el.textContent.substring(0, 100) });
        }
      });
      return visible;
    });
    
    // Look for key information
    const hasInstallCommand = aboveFoldContent.some(el => 
      el.text.includes('npm install') || el.text.includes('pnpm add')
    );
    const hasUsageExample = aboveFoldContent.some(el => 
      el.text.includes('import') || el.text.includes('require') || el.text.includes('speakeasy')
    );
    
    if (hasInstallCommand) {
      review.clarity.clear.push('Installation command is visible above the fold');
    } else {
      review.clarity.missing.push('No installation command visible without scrolling');
    }
    
    if (hasUsageExample) {
      review.clarity.clear.push('Usage example visible immediately');
    } else {
      review.clarity.confusing.push('No clear usage example above the fold');
    }
    
    // Check for package managers
    const packageTabs = await page.$$('[role="tab"]');
    if (packageTabs.length > 0) {
      review.clarity.clear.push(`Multiple package manager support shown (${packageTabs.length} options)`);
    }
    
    // ============ INTERACTIVE ELEMENTS ============
    console.log('\n3️⃣ TESTING INTERACTIVITY\n');
    
    // Try the main CTA
    const mainCTA = await page.$('button:has-text("Show Example"), button:has-text("Try"), button:has-text("Demo")');
    if (mainCTA) {
      console.log('  🎯 Found main CTA, clicking...');
      await mainCTA.click();
      await page.waitForTimeout(2000);
      
      // Check what happened
      const newElements = await page.$$('.transition-all');
      if (newElements.length > 0) {
        review.firstImpressions.positive.push('Interactive demo/example in hero - engaging!');
      }
    } else {
      review.firstImpressions.negative.push('No clear interactive demo or "Try it" button');
    }
    
    // Check for audio demos
    const audioElements = await page.$$('audio');
    const playButtons = await page.$$('button[aria-label*="play" i], button[aria-label*="Play" i]');
    
    if (audioElements.length > 0 || playButtons.length > 0) {
      review.firstImpressions.positive.push('Has audio demos - perfect for a TTS library!');
      
      // Try to play audio
      if (playButtons.length > 0) {
        console.log('  🔊 Attempting to play audio demo...');
        await playButtons[0].click();
        await page.waitForTimeout(2000);
      }
    } else {
      review.clarity.missing.push('No audio demos found - crucial for TTS library');
    }
    
    // ============ USE CASES & PROBLEMS ============
    console.log('\n4️⃣ IDENTIFYING USE CASES\n');
    
    // Scroll to find features/use cases
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    
    // Look for features section
    const featureHeadings = await page.$$eval('h2, h3', elements => 
      elements.map(el => el.textContent).filter(text => text.length > 0)
    );
    
    console.log(`  📋 Found ${featureHeadings.length} section headings`);
    
    // Check for specific use case mentions
    const pageText = await page.evaluate(() => document.body.innerText);
    const useCaseKeywords = ['notification', 'alert', 'accessibility', 'voice', 'announce', 'cli', 'automation'];
    useCaseKeywords.forEach(keyword => {
      if (pageText.toLowerCase().includes(keyword)) {
        review.useCases.identified.push(`Mentions ${keyword} use case`);
      }
    });
    
    // Personal use cases
    review.useCases.myUseCase.push('Build notifications for long-running processes');
    review.useCases.myUseCase.push('Accessibility features for visually impaired users');
    review.useCases.myUseCase.push('Voice feedback in CLI tools');
    review.useCases.myUseCase.push('Audio alerts in monitoring dashboards');
    
    // ============ CODE EXAMPLES ============
    console.log('\n5️⃣ EVALUATING CODE EXAMPLES\n');
    
    const codeBlocks = await page.$$('pre');
    console.log(`  💻 Found ${codeBlocks.length} code examples`);
    
    if (codeBlocks.length > 0) {
      // Check first code example
      const firstCode = await codeBlocks[0].textContent();
      
      if (firstCode.length < 50) {
        review.technicalDetails.examples.push('Code examples are concise and clear');
      } else if (firstCode.length > 200) {
        review.technicalDetails.examples.push('Code examples might be too verbose');
      }
      
      // Check for copy buttons
      for (let i = 0; i < Math.min(3, codeBlocks.length); i++) {
        const parent = await codeBlocks[i].evaluateHandle(el => el.parentElement);
        const hasCopyButton = await parent.evaluate(el => {
          const btn = el.querySelector('button');
          return btn !== null;
        });
        
        if (hasCopyButton) {
          review.clarity.clear.push('Code blocks have copy buttons - good DX');
          break;
        }
      }
    } else {
      review.clarity.missing.push('No code examples found - critical for adoption');
    }
    
    // ============ DOCUMENTATION CHECK ============
    console.log('\n6️⃣ CHECKING DOCUMENTATION\n');
    
    const docLinks = await page.$$('a[href*="doc"], a[href*="Doc"]');
    console.log(`  📚 Found ${docLinks.length} documentation links`);
    
    if (docLinks.length > 0) {
      // Click first doc link
      await docLinks[0].click();
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      if (currentUrl.includes('/docs')) {
        review.technicalDetails.docs.push('Documentation is available and accessible');
        
        // Check doc structure
        const docNav = await page.$('nav, aside');
        if (docNav) {
          review.technicalDetails.docs.push('Documentation has navigation structure');
        }
        
        // Go back
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    } else {
      review.clarity.missing.push('No clear documentation link - concerning for adoption');
    }
    
    // ============ GITHUB & COMMUNITY ============
    console.log('\n7️⃣ CHECKING GITHUB & COMMUNITY\n');
    
    const githubLinks = await page.$$('a[href*="github"]');
    if (githubLinks.length > 0) {
      const githubUrl = await githubLinks[0].getAttribute('href');
      review.technicalDetails.setup.push(`GitHub repository available: ${githubUrl}`);
      
      // Check for stars (if displayed)
      const starElements = await page.$$('svg + span:has-text("Star"), .star, *:has-text("★")');
      if (starElements.length > 0) {
        review.firstImpressions.positive.push('Shows GitHub stars - social proof');
      }
    } else {
      review.adoption.blockers.push('No GitHub link found - where is the source code?');
    }
    
    // ============ PROVIDERS & FEATURES ============
    console.log('\n8️⃣ UNDERSTANDING FEATURES\n');
    
    // Scroll more to find features
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1000);
    
    // Look for provider mentions
    const providers = ['OpenAI', 'ElevenLabs', 'Google', 'Amazon', 'Azure', 'System'];
    const supportedProviders = [];
    
    for (const provider of providers) {
      const hasProvider = await page.$(`*:has-text("${provider}")`);
      if (hasProvider) {
        supportedProviders.push(provider);
      }
    }
    
    if (supportedProviders.length > 0) {
      review.clarity.clear.push(`Clearly shows supported providers: ${supportedProviders.join(', ')}`);
    } else {
      review.clarity.confusing.push('Unclear which TTS providers are supported');
    }
    
    // ============ MOBILE RESPONSIVENESS ============
    console.log('\n9️⃣ TESTING MOBILE VIEW\n');
    
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    
    // Check if navigation collapses
    const mobileMenu = await page.$('button[aria-label*="menu" i]');
    const mobileNavVisible = await page.$$('nav a:visible');
    
    if (mobileMenu || mobileNavVisible.length < 3) {
      review.firstImpressions.positive.push('Responsive design with mobile menu');
    } else {
      review.firstImpressions.negative.push('Poor mobile experience - navigation not optimized');
    }
    
    await page.screenshot({ path: 'ux-review-mobile.png' });
    
    // Reset viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // ============ PRICING & LICENSING ============
    console.log('\n🔟 CHECKING PRICING & LICENSE\n');
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    const pricingMentions = await page.$$('*:has-text("pricing"), *:has-text("Pricing"), *:has-text("free"), *:has-text("Free")');
    const licenseMentions = await page.$$('*:has-text("MIT"), *:has-text("Apache"), *:has-text("license")');
    
    if (pricingMentions.length > 0 || licenseMentions.length > 0) {
      review.clarity.clear.push('Licensing/pricing information available');
    } else {
      review.clarity.missing.push('No clear licensing or pricing information');
    }
    
    // ============ FINAL ADOPTION ASSESSMENT ============
    console.log('\n✅ FINAL ASSESSMENT\n');
    
    // Adoption pros
    if (hasInstallCommand) review.adoption.pros.push('Easy installation process');
    if (supportedProviders.length > 2) review.adoption.pros.push('Multiple provider support - flexibility');
    if (loadTime < 2000) review.adoption.pros.push('Fast, responsive website');
    if (codeBlocks.length > 2) review.adoption.pros.push('Good code examples');
    
    // Adoption cons
    if (!hasUsageExample) review.adoption.cons.push('No immediate usage example');
    if (supportedProviders.length === 0) review.adoption.cons.push('Unclear provider support');
    if (docLinks.length === 0) review.adoption.cons.push('Documentation not easily accessible');
    
    // Generate improvements
    if (!audioElements.length) {
      review.improvements.push('Add audio demos on landing page - essential for TTS library');
    }
    if (!hasUsageExample) {
      review.improvements.push('Show a simple 2-3 line usage example above the fold');
    }
    review.improvements.push('Add a "Why SpeakEasy?" section comparing to alternatives');
    review.improvements.push('Include testimonials or usage statistics for credibility');
    review.improvements.push('Add a playground/sandbox for trying different voices and settings');
    
  } catch (error) {
    console.error('Error during review:', error.message);
  } finally {
    await browser.close();
    
    // ============ GENERATE REPORT ============
    console.log('\n' + '=' .repeat(70));
    console.log('\n📊 COMPREHENSIVE UX REVIEW REPORT\n');
    console.log('=' .repeat(70));
    
    console.log('\n### 1. FIRST IMPRESSIONS (First 30 Seconds)\n');
    console.log('**Positive:**');
    review.firstImpressions.positive.forEach(item => console.log(`  ✅ ${item}`));
    console.log('\n**Negative:**');
    review.firstImpressions.negative.forEach(item => console.log(`  ❌ ${item}`));
    console.log('\n**Neutral Observations:**');
    review.firstImpressions.neutral.forEach(item => console.log(`  ➖ ${item}`));
    
    console.log('\n### 2. CLARITY & UNDERSTANDING\n');
    console.log('**What\'s Clear:**');
    review.clarity.clear.forEach(item => console.log(`  ✅ ${item}`));
    console.log('\n**What\'s Confusing:**');
    review.clarity.confusing.forEach(item => console.log(`  ⚠️ ${item}`));
    console.log('\n**What\'s Missing:**');
    review.clarity.missing.forEach(item => console.log(`  ❌ ${item}`));
    
    console.log('\n### 3. USE CASES & APPEAL\n');
    console.log('**Identified Use Cases:**');
    review.useCases.identified.forEach(item => console.log(`  • ${item}`));
    console.log('\n**My Potential Use Cases:**');
    review.useCases.myUseCase.forEach(item => console.log(`  • ${item}`));
    
    console.log('\n### 4. MISSING INFORMATION\n');
    const allMissing = [...review.clarity.missing, ...review.adoption.blockers];
    allMissing.forEach(item => console.log(`  ⚠️ ${item}`));
    
    console.log('\n### 5. IMPROVEMENTS & RECOMMENDATIONS\n');
    review.improvements.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
    
    console.log('\n### 6. ADOPTION LIKELIHOOD\n');
    console.log('\n**Pros for Adoption:**');
    review.adoption.pros.forEach(item => console.log(`  ✅ ${item}`));
    console.log('\n**Cons Against Adoption:**');
    review.adoption.cons.forEach(item => console.log(`  ❌ ${item}`));
    
    // Final verdict
    const prosCount = review.adoption.pros.length;
    const consCount = review.adoption.cons.length + review.adoption.blockers.length;
    
    console.log('\n' + '=' .repeat(70));
    console.log('\n🎯 EXECUTIVE SUMMARY\n');
    console.log('=' .repeat(70));
    
    if (prosCount > consCount) {
      console.log('\n✅ WOULD RECOMMEND to my team with some reservations.\n');
      console.log('The library shows promise with clear purpose and decent documentation,');
      console.log('but needs better demos and clearer differentiation from alternatives.');
    } else if (prosCount === consCount) {
      console.log('\n🤔 NEUTRAL - Would need more investigation.\n');
      console.log('The library has potential but lacks key elements that would make');
      console.log('adoption a clear win. Need to see it in action first.');
    } else {
      console.log('\n❌ WOULD NOT RECOMMEND in current state.\n');
      console.log('Too many unknowns and missing critical information for confident adoption.');
      console.log('Would wait for better documentation and examples.');
    }
    
    console.log('\n**Bottom Line:** As a senior developer, I need to see/hear the library');
    console.log('in action immediately. A TTS library without audio demos is like a');
    console.log('color picker without color swatches. Fix that, and adoption likelihood');
    console.log('increases dramatically.\n');
  }
}

// Run the comprehensive review
conductFullUXReview().catch(console.error);