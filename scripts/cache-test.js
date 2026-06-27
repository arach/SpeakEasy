const fs = require('fs');
const path = require('path');
const os = require('os');
const { TTSCache } = require('../dist/index.js');

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeWavBuffer() {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(4, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.write('data', 36);
  header.writeUInt32LE(4, 40);
  return Buffer.concat([header, Buffer.from([0, 0, 0, 0])]);
}

async function testSqliteCache() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speakeasy-cache-test-'));
  const cache = new TTSCache(dir, '1h', '1mb');

  const key = cache.generateCacheKey('Hello world', 'openai', 'nova', 180);
  const audio = Buffer.from([0xff, 0xfb, 0x90, 0x00]);

  await cache.set(key, {
    provider: 'openai',
    voice: 'nova',
    rate: 180,
    text: 'Hello world',
  }, audio);

  const hit = await cache.get(key);
  await assert(!!hit, 'expected cache hit after set');
  await assert(hit.audioFilePath.endsWith('.mp3'), 'mp3 audio should use .mp3 extension');
  await assert(fs.existsSync(hit.audioFilePath), 'audio file should exist on disk');

  const dbFile = path.join(dir, 'cache.sqlite');
  await assert(fs.existsSync(dbFile), 'cache.sqlite should exist');
  await assert(cache.usesSqlite(), 'expected built-in SQLite backend');

  const metadata = await cache.getCacheMetadata();
  await assert(metadata.length === 1, `expected 1 metadata entry, got ${metadata.length}`);

  const found = await cache.findByText('hello');
  await assert(found.length === 1, 'findByText should match case-insensitively');

  const stats = await cache.getStats();
  await assert(stats.totalEntries === 1, 'stats should report 1 entry');

  await cache.delete(key);
  await assert(!(await cache.get(key)), 'expected cache miss after delete');

  console.log(`✅ SQLite cache tests passed (${cache.getSqliteBackend()})`);
}

async function testWavExtension() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speakeasy-cache-wav-'));
  const cache = new TTSCache(dir, '1h', '1mb');
  const key = cache.generateCacheKey('Gemini hello', 'gemini', 'Puck', 180);
  const wav = makeWavBuffer();

  await cache.set(key, {
    provider: 'gemini',
    voice: 'Puck',
    rate: 180,
    text: 'Gemini hello',
  }, wav, { extension: 'wav' });

  const hit = await cache.get(key);
  await assert(!!hit, 'expected wav cache hit');
  await assert(hit.audioFilePath.endsWith('.wav'), 'gemini/wav audio should use .wav extension');

  console.log('✅ WAV cache extension tests passed');
}

async function main() {
  await testSqliteCache();
  await testWavExtension();
}

main().catch((error) => {
  console.error('❌ Cache test failed:', error.message);
  process.exit(1);
});