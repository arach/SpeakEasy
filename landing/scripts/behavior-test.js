const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("http://localhost:8899/landing/docs/design/landing-redesign-mock.html", { waitUntil: "networkidle0" });
  const r = {};

  // install tabs
  await page.click('#installTabs button[data-cmd^="pnpm"]');
  r.installTab = await page.$eval("#installCmd", el => el.textContent);

  // api tabs
  await page.click('#apiTabs button[data-pane="cli"]');
  r.cliVisible = await page.$eval('.codebox[data-pane="cli"]', el => !el.hidden);
  r.sdkHidden = await page.$eval('.codebox[data-pane="sdk"]', el => el.hidden);

  // copy buttons (clipboard may fail headless; text feedback is the observable)
  r.copyTargetAfterCli = await page.$eval(".api-copy", el => el.dataset.copyTarget);
  await page.evaluate(() => document.querySelector(".api-copy").click());
  await new Promise(res => setTimeout(res, 200));
  r.cliCopyLabel = await page.$eval(".api-copy", el => el.textContent);
  await page.click('#apiTabs button[data-pane="sdk"]'); // back
  r.copyTargetAfterSdk = await page.$eval(".api-copy", el => el.dataset.copyTarget);

  // play wiring
  await page.evaluate(() => document.querySelector(".voice-card .play").click());
  await new Promise(res => setTimeout(res, 200));
  r.playingClass = await page.$eval(".voice-card .play", el => el.classList.contains("playing"));
  r.cardClass = await page.$eval(".voice-card", el => el.classList.contains("playing-card"));
  r.audioSrc = await page.evaluate(() => document.querySelector("audio, video") ? "n/a" : "shared-el");
  r.eqVisible = await page.$eval(".voice-card .play .eq", el => getComputedStyle(el).display);

  // second play stops first (single playback)
  await page.evaluate(() => document.querySelectorAll(".notif .play")[1].click());
  await new Promise(res => setTimeout(res, 200));
  r.firstStopped = await page.$eval(".voice-card .play", el => !el.classList.contains("playing"));
  r.secondPlaying = await page.evaluate(() => document.querySelectorAll(".notif .play")[1].classList.contains("playing"));

  // CTA copy
  await page.evaluate(() => document.getElementById("ctaInstall").click());
  await new Promise(res => setTimeout(res, 200));
  r.ctaLabel = await page.$eval("#ctaInstall", el => el.textContent);

  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
