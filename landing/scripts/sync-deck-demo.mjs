import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// Reuse the actual Deck markup and styles. The static demo has no Mac runtime.
const output = new URL('../public/implementation/', import.meta.url);
mkdirSync(output, { recursive: true });
const source = readFileSync(new URL('../../deck/index.html', import.meta.url), 'utf8');
const boot = 'paint(); bootLive();';
if (!source.includes(boot)) throw new Error('Deck boot changed; review static demo initialization.');
writeFileSync(new URL('deck-demo.html', output), source.replace(boot, 'paint(); if (!DEMO_MODE) bootLive();'));
console.log('Deck demo synced from the app source.');
