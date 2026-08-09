// Section-by-section screenshots of the landing mock, desktop + mobile.
// Usage: node scripts/shoot-mock.mjs <outDir>
import puppeteer from "puppeteer";
import fs from "node:fs";

const outDir = process.argv[2] || "/tmp/mock-shots";
// the mock is the home page now — shoot the built site, not a loose file
const url = "http://localhost:8899/";
fs.mkdirSync(outDir, { recursive: true });

const sections = [
  ["hero", "header.hero"],
  ["voices", "section.voices"],
  ["agent", "section.agent"],
  ["claims", "section.claims"],
  ["api", "section.api"],
  ["codex", "section.codex"],
];

const widths = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
];

const browser = await puppeteer.launch({ headless: "new" });
for (const [wname, w, h] of widths) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${outDir}/${wname}-full.png`, fullPage: true });
  for (const [name, sel] of sections) {
    const el = await page.$(sel);
    if (!el) continue;
    await el.scrollIntoView();
    await new Promise((r) => setTimeout(r, 120));
    await el.screenshot({ path: `${outDir}/${wname}-${name}.png` });
  }
  const footer = await page.$("footer");
  if (footer) {
    await footer.scrollIntoView();
    await new Promise((r) => setTimeout(r, 120));
    await footer.screenshot({ path: `${outDir}/${wname}-footer.png` });
  }
  await page.close();
}
await browser.close();
console.log("done ->", outDir);
