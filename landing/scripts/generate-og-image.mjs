import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=Silkscreen:wght@400;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1200px;
      height: 630px;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      position: relative;
      overflow: hidden;
    }

    .bg-pattern {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image:
        radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.06) 0%, transparent 50%),
        radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.04) 0%, transparent 50%);
    }

    .grid-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image:
        linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px);
      background-size: 60px 60px;
    }

    .content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 48px;
    }

    .logo {
      font-family: 'Silkscreen', monospace;
      font-size: 82px;
      font-weight: 400;
      color: #0f172a;
      letter-spacing: 3px;
      margin-bottom: 4px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }

    .subtitle {
      font-family: 'Outfit', sans-serif;
      font-size: 56px;
      font-weight: 300;
      letter-spacing: -1px;
      background: linear-gradient(135deg, #059669 0%, #0ea5e9 50%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 24px;
    }

    .tagline {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 24px;
      font-weight: 400;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 36px;
    }

    .waveform {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 36px;
      padding: 0 20px;
    }

    .bar {
      width: 6px;
      border-radius: 3px;
      background: linear-gradient(180deg, #10b981 0%, #3b82f6 100%);
      opacity: 0.75;
    }

    .providers {
      display: flex;
      gap: 12px;
    }

    .provider {
      padding: 10px 22px;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 100px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #475569;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .accent-circle-1 {
      position: absolute;
      top: -40px;
      left: -40px;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.08));
      filter: blur(40px);
    }

    .accent-circle-2 {
      position: absolute;
      bottom: -60px;
      right: -60px;
      width: 280px;
      height: 280px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.06));
      filter: blur(50px);
    }

    .decorative-ring {
      position: absolute;
      top: 60px;
      right: 80px;
      width: 80px;
      height: 80px;
      border: 2px solid rgba(16, 185, 129, 0.2);
      border-radius: 50%;
    }

    .decorative-dot {
      position: absolute;
      bottom: 80px;
      left: 100px;
      width: 12px;
      height: 12px;
      background: linear-gradient(135deg, #10b981, #3b82f6);
      border-radius: 50%;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="bg-pattern"></div>
  <div class="grid-overlay"></div>
  <div class="accent-circle-1"></div>
  <div class="accent-circle-2"></div>
  <div class="decorative-ring"></div>
  <div class="decorative-dot"></div>

  <div class="content">
    <div class="logo">SpeakEasy</div>
    <div class="subtitle">Unified TTS</div>
    <div class="tagline">Simple text-to-speech for all your projects</div>

    <div class="waveform">
      <div class="bar" style="height: 24px"></div>
      <div class="bar" style="height: 36px"></div>
      <div class="bar" style="height: 52px"></div>
      <div class="bar" style="height: 68px"></div>
      <div class="bar" style="height: 48px"></div>
      <div class="bar" style="height: 80px"></div>
      <div class="bar" style="height: 64px"></div>
      <div class="bar" style="height: 92px"></div>
      <div class="bar" style="height: 56px"></div>
      <div class="bar" style="height: 100px"></div>
      <div class="bar" style="height: 72px"></div>
      <div class="bar" style="height: 88px"></div>
      <div class="bar" style="height: 60px"></div>
      <div class="bar" style="height: 76px"></div>
      <div class="bar" style="height: 44px"></div>
      <div class="bar" style="height: 68px"></div>
      <div class="bar" style="height: 52px"></div>
      <div class="bar" style="height: 36px"></div>
      <div class="bar" style="height: 60px"></div>
      <div class="bar" style="height: 28px"></div>
      <div class="bar" style="height: 20px"></div>
    </div>

    <div class="providers">
      <div class="provider">OpenAI</div>
      <div class="provider">ElevenLabs</div>
      <div class="provider">System</div>
    </div>
  </div>
</body>
</html>
`;

async function generateOGImage() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

  console.log('Setting page content...');
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Wait for fonts to load
  console.log('Waiting for fonts...');
  await page.evaluate(() => document.fonts.ready);
  await new Promise(resolve => setTimeout(resolve, 1500));

  const outputPath = path.join(__dirname, '..', 'public', 'og-image.png');

  console.log('Taking screenshot...');
  await page.screenshot({
    path: outputPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 }
  });

  await browser.close();
  console.log(`OG image generated at: ${outputPath}`);
}

generateOGImage().catch(console.error);
