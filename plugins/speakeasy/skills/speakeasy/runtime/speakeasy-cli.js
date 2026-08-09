#!/usr/bin/env node
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// src/adapters/request.ts
function toTTSRequest(config, defaultVoice) {
  return {
    text: config.text,
    voice: config.voice ?? defaultVoice,
    rate: config.rate,
    volume: config.volume ?? 0.7,
    tempDir: config.tempDir,
    apiKey: config.apiKey,
    instructions: config.instructions
  };
}

// src/hud.ts
import { openSync, writeSync, closeSync, constants } from "fs";
import { existsSync, statSync } from "fs";
function writeToPipe(message) {
  if (!existsSync(HUD_PIPE_PATH)) {
    return;
  }
  try {
    const stats = statSync(HUD_PIPE_PATH);
    if (!stats.isFIFO()) {
      return;
    }
    const fd = openSync(HUD_PIPE_PATH, constants.O_WRONLY | constants.O_NONBLOCK);
    try {
      const jsonMessage = JSON.stringify(message) + `
`;
      writeSync(fd, jsonMessage);
    } finally {
      closeSync(fd);
    }
  } catch {}
}
function notifyHUD(message) {
  writeToPipe(message);
}
function updateAudioLevel(level) {
  writeToPipe({ audioLevel: Math.max(0, Math.min(1, level)) });
}
var HUD_PIPE_PATH = "/tmp/speakeasy-hud.fifo";
var init_hud = () => {};

// src/adapters/audio.ts
import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
function extensionForFormat(format) {
  return format;
}
function playAudioFile(filePath, volume = 1) {
  return new Promise((resolve, reject) => {
    const volumeArgs = volume !== 1 ? ["-v", volume.toString()] : [];
    const afplay = spawn("afplay", [...volumeArgs, filePath]);
    let levelInterval = null;
    let phase = 0;
    const startLevelSimulation = () => {
      levelInterval = setInterval(() => {
        const base = 0.4 + Math.sin(phase * 0.3) * 0.2;
        const variation = Math.random() * 0.3;
        const level = Math.min(1, Math.max(0, base + variation));
        updateAudioLevel(level);
        phase++;
      }, 33);
    };
    const stopLevelSimulation = () => {
      if (levelInterval) {
        clearInterval(levelInterval);
        levelInterval = null;
      }
      updateAudioLevel(0);
    };
    startLevelSimulation();
    afplay.on("close", (code) => {
      stopLevelSimulation();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`afplay exited with code ${code}`));
      }
    });
    afplay.on("error", (err) => {
      stopLevelSimulation();
      reject(err);
    });
  });
}
async function playTTSResult(result, volume, tempDir) {
  const tempFile = path.join(tempDir, `speech_${Date.now()}.${extensionForFormat(result.format)}`);
  fs.writeFileSync(tempFile, result.audio, { mode: 384 });
  try {
    await playAudioFile(tempFile, volume);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}
function stopPlayback() {
  try {
    execSync('pkill -f "say|afplay"', { stdio: "ignore" });
  } catch {}
}
var init_audio = __esm(() => {
  init_hud();
});

// src/providers/system.ts
import { execSync as execSync2, spawn as spawn2 } from "child_process";
import * as fs2 from "fs";
import * as path2 from "path";
function getAvailableVoices() {
  if (cachedVoices)
    return cachedVoices;
  try {
    const output = execSync2('say -v "?"', { encoding: "utf-8" });
    cachedVoices = output.split(`
`).filter((line) => line.trim()).map((line) => {
      const match = line.match(/^(.+?)\s+[a-z]{2}[_-][A-Z]{2}/i);
      return match ? match[1].trim() : line.split(/\s+/)[0];
    });
    return cachedVoices;
  } catch {
    return ["Samantha"];
  }
}
function getBestVoice(language = "en_US") {
  const available = getAvailableVoices();
  for (const voice of PREFERRED_VOICES) {
    if (available.includes(voice)) {
      return voice;
    }
  }
  const englishPremium = available.find((v) => v.includes("(Premium)") && (v.includes("en_") || !v.includes("_")));
  if (englishPremium)
    return englishPremium;
  const englishEnhanced = available.find((v) => v.includes("(Enhanced)") && (v.includes("en_") || !v.includes("_")));
  if (englishEnhanced)
    return englishEnhanced;
  return "Samantha";
}

class SystemProvider {
  id = "system";
  capabilities = {
    cacheable: true,
    instructions: false,
    silent: true
  };
  voice;
  constructor(voice) {
    this.voice = voice || getBestVoice();
  }
  async synthesize(request) {
    const voice = request.voice || this.voice;
    const tempFile = path2.join(request.tempDir, `system_speech_${Date.now()}.aiff`);
    try {
      await runSay(["-v", voice, "-r", String(request.rate), "-o", tempFile, request.text]);
      const audio = fs2.readFileSync(tempFile);
      return { audio, format: "aiff", model: "macOS-system" };
    } finally {
      if (fs2.existsSync(tempFile)) {
        fs2.unlinkSync(tempFile);
      }
    }
  }
  validate() {
    return true;
  }
  formatError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return `System voice failed: ${message}. Ensure 'say' command is available.`;
  }
  validateConfig() {
    return this.validate();
  }
  getErrorMessage(error) {
    return this.formatError(error);
  }
  async generateAudio(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    return result.audio;
  }
  async speak(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}
function runSay(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn2("say", args);
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`say exited with code ${code}`));
      }
    });
  });
}
var PREFERRED_VOICES, cachedVoices = null;
var init_system = __esm(() => {
  init_audio();
  PREFERRED_VOICES = [
    "Ava (Premium)",
    "Evan (Enhanced)",
    "Zoe (Premium)",
    "Samantha (Enhanced)",
    "Samantha"
  ];
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/rng.js
function rng() {
  return crypto.getRandomValues(rnds8);
}
var rnds8;
var init_rng = __esm(() => {
  rnds8 = new Uint8Array(16);
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/regex.js
var regex_default;
var init_regex = __esm(() => {
  regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default;
var init_validate = __esm(() => {
  init_regex();
  validate_default = validate;
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/stringify.js
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
var byteToHex;
var init_stringify = __esm(() => {
  byteToHex = [];
  for (let i = 0;i < 256; ++i) {
    byteToHex.push((i + 256).toString(16).slice(1));
  }
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/v4.js
function v4(options, buf, offset) {
  if (!buf && !options && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return _v4(options, buf, offset);
}
function _v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0;i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default;
var init_v4 = __esm(() => {
  init_rng();
  init_stringify();
  v4_default = v4;
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/sha1.js
import { createHash } from "crypto";
function sha1(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === "string") {
    bytes = Buffer.from(bytes, "utf8");
  }
  return createHash("sha1").update(bytes).digest();
}
var sha1_default;
var init_sha1 = __esm(() => {
  sha1_default = sha1;
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/parse.js
function parse(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  let v;
  return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, v >>> 16 & 255, v >>> 8 & 255, v & 255, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255, v / 4294967296 & 255, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
}
var parse_default;
var init_parse = __esm(() => {
  init_validate();
  parse_default = parse;
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/v35.js
function stringToBytes(str) {
  str = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(str.length);
  for (let i = 0;i < str.length; ++i) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}
function v35(version, hash, value, namespace, buf, offset) {
  const valueBytes = typeof value === "string" ? stringToBytes(value) : value;
  const namespaceBytes = typeof namespace === "string" ? parse_default(namespace) : namespace;
  if (typeof namespace === "string") {
    namespace = parse_default(namespace);
  }
  if (namespace?.length !== 16) {
    throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
  }
  let bytes = new Uint8Array(16 + valueBytes.length);
  bytes.set(namespaceBytes);
  bytes.set(valueBytes, namespaceBytes.length);
  bytes = hash(bytes);
  bytes[6] = bytes[6] & 15 | version;
  bytes[8] = bytes[8] & 63 | 128;
  if (buf) {
    offset ??= 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0;i < 16; ++i) {
      buf[offset + i] = bytes[i];
    }
    return buf;
  }
  return unsafeStringify(bytes);
}
var DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8", URL2 = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
var init_v35 = __esm(() => {
  init_parse();
  init_stringify();
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/v5.js
function v5(value, namespace, buf, offset) {
  return v35(80, sha1_default, value, namespace, buf, offset);
}
var v5_default;
var init_v5 = __esm(() => {
  init_sha1();
  init_v35();
  v5.DNS = DNS;
  v5.URL = URL2;
  v5_default = v5;
});

// node_modules/.pnpm/uuid@14.0.1/node_modules/uuid/dist-node/index.js
var init_dist_node = __esm(() => {
  init_v4();
  init_v5();
});

// src/cache-config.ts
function parseTTL(ttl) {
  if (typeof ttl === "number")
    return ttl;
  const units = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    M: 30 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000
  };
  const match = ttl.toString().match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match)
    throw new Error(`Invalid TTL format: ${ttl}`);
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (!(unit in units)) {
    throw new Error(`Invalid TTL unit: ${unit}. Use: ${Object.keys(units).join(", ")}`);
  }
  return value * units[unit];
}
function parseSize(size) {
  if (typeof size === "number")
    return size;
  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  const match = size.toString().match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match)
    throw new Error(`Invalid size format: ${size}`);
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (!(unit in units)) {
    throw new Error(`Invalid size unit: ${unit}. Use: ${Object.keys(units).join(", ")}`);
  }
  return value * units[unit];
}

// src/cache.ts
var exports_cache = {};
__export(exports_cache, {
  TTSCache: () => TTSCache
});
import * as path3 from "path";
import * as fs3 from "fs";
function wrapNodeDatabase(db) {
  return db;
}
function wrapBunDatabase(db) {
  return {
    exec: (sql) => {
      db.run(sql);
    },
    prepare: (sql) => {
      const statement = db.query(sql);
      return {
        run: (...args) => {
          statement.run(...args);
        },
        get: (...args) => statement.get(...args),
        all: (...args) => statement.all(...args)
      };
    }
  };
}
function detectAudioExtension(buffer) {
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "FORM") {
    return "aiff";
  }
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "RIFF") {
    return "wav";
  }
  if (buffer.length >= 3 && buffer[0] === 73 && buffer[1] === 68 && buffer[2] === 51) {
    return "mp3";
  }
  if (buffer.length >= 2 && buffer[0] === 255 && (buffer[1] & 224) === 224) {
    return "mp3";
  }
  return "mp3";
}
function openBuiltinSqlite(dbPath) {
  try {
    const specifier = ["node", "sqlite"].join(":");
    const { DatabaseSync } = __require(specifier);
    return { db: wrapNodeDatabase(new DatabaseSync(dbPath)), backend: "node" };
  } catch {}
  try {
    const specifier = ["bun", "sqlite"].join(":");
    const { Database } = __require(specifier);
    return { db: wrapBunDatabase(new Database(dbPath, { create: true })), backend: "bun" };
  } catch {
    return null;
  }
}

class TTSCache {
  cacheDir;
  dbPath;
  metadataFile;
  statsFile;
  ttlMs;
  maxSize;
  logger;
  db = null;
  sqliteBackend = null;
  jsonEntries = {};
  useJsonFallback = false;
  metadataLoaded = false;
  cacheHits = 0;
  cacheMisses = 0;
  constructor(cacheDir, ttl = "7d", maxSize, logger) {
    this.cacheDir = cacheDir || path3.join("/tmp", "speakeasy-cache");
    this.dbPath = path3.join(this.cacheDir, "cache.sqlite");
    this.metadataFile = path3.join(this.cacheDir, "metadata.json");
    this.statsFile = path3.join(this.cacheDir, "stats.json");
    this.ttlMs = parseTTL(ttl);
    this.maxSize = maxSize ? parseSize(maxSize) : undefined;
    this.logger = logger || this.createDefaultLogger();
    this.loadStats();
    this.logger.debug("Initializing TTSCache with dir:", this.cacheDir, "ttl:", ttl, "maxSize:", maxSize);
    if (!fs3.existsSync(this.cacheDir)) {
      this.logger.debug("Creating cache directory:", this.cacheDir);
    }
    fs3.mkdirSync(this.cacheDir, { recursive: true, mode: 448 });
    fs3.chmodSync(this.cacheDir, 448);
    this.initializeStorage();
  }
  createDefaultLogger() {
    return {
      debug: () => {},
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }
  initializeStorage() {
    const sqlite = openBuiltinSqlite(this.dbPath);
    if (sqlite) {
      try {
        this.db = sqlite.db;
        this.sqliteBackend = sqlite.backend;
        this.db.exec(CREATE_ENTRIES_TABLE);
        this.db.exec(CREATE_INDEXES);
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.migrateJsonMetadataIfNeeded();
        this.migrateLegacySqliteIfNeeded();
        this.logger.debug(`Using ${sqlite.backend} SQLite cache at:`, this.dbPath);
        return;
      } catch (error) {
        this.logger.warn("Built-in SQLite unavailable, using JSON fallback:", error);
        this.db = null;
        this.sqliteBackend = null;
      }
    } else {
      this.logger.warn("No built-in SQLite available (Node 22.5+ or Bun), using JSON fallback");
    }
    this.useJsonFallback = true;
    this.loadJsonMetadata();
  }
  migrateJsonMetadataIfNeeded() {
    if (!this.db || !fs3.existsSync(this.metadataFile))
      return;
    try {
      const data = JSON.parse(fs3.readFileSync(this.metadataFile, "utf8"));
      const entries = Object.entries(data.entries || {});
      if (entries.length === 0)
        return;
      let imported = 0;
      for (const [cacheKey, entry] of entries) {
        if (this.importStoredEntry(cacheKey, entry)) {
          imported++;
        }
      }
      if (imported > 0) {
        const backupPath = `${this.metadataFile}.migrated`;
        fs3.renameSync(this.metadataFile, backupPath);
        this.logger.debug(`Migrated ${imported} JSON cache entries to SQLite`);
      }
    } catch (error) {
      this.logger.warn("Failed to migrate JSON metadata to SQLite:", error);
    }
  }
  migrateLegacySqliteIfNeeded() {
    if (!this.db)
      return;
    const legacyMetadataPath = path3.join(this.cacheDir, "metadata.sqlite");
    const legacyKeyvPath = path3.join(this.cacheDir, "tts-cache.sqlite");
    this.importLegacyMetadataDb(legacyMetadataPath);
    this.importLegacyKeyvDb(legacyKeyvPath);
  }
  importStoredEntry(cacheKey, entry) {
    if (!this.db || this.getSqliteEntry(cacheKey))
      return false;
    if (!entry.audioFilePath || !fs3.existsSync(entry.audioFilePath))
      return false;
    this.upsertSqliteEntry(cacheKey, entry);
    return true;
  }
  importLegacyMetadataDb(legacyPath) {
    if (!this.db || !fs3.existsSync(legacyPath))
      return;
    try {
      const legacy = openBuiltinSqlite(legacyPath);
      if (!legacy)
        return;
      const rows = legacy.db.prepare("SELECT * FROM metadata").all();
      let imported = 0;
      for (const row of rows) {
        const cacheKey = row.cache_key;
        const storedEntry = {
          audioFilePath: row.file_path,
          provider: row.provider,
          voice: row.voice,
          rate: row.rate,
          timestamp: row.timestamp,
          text: row.original_text,
          fileSize: row.file_size,
          model: row.model,
          source: row.source,
          sessionId: row.session_id,
          processId: row.process_id,
          hostname: row.hostname,
          user: row.user,
          workingDirectory: row.working_directory,
          commandLine: row.command_line,
          durationMs: row.duration_ms,
          success: row.success === 1,
          errorMessage: row.error_message
        };
        if (this.importStoredEntry(cacheKey, storedEntry)) {
          imported++;
        }
      }
      if (imported > 0) {
        fs3.renameSync(legacyPath, `${legacyPath}.migrated`);
        this.logger.debug(`Migrated ${imported} entries from legacy metadata.sqlite`);
      }
    } catch (error) {
      this.logger.warn("Legacy metadata.sqlite migration failed:", error);
    }
  }
  importLegacyKeyvDb(legacyPath) {
    if (!this.db || !fs3.existsSync(legacyPath))
      return;
    try {
      const legacy = openBuiltinSqlite(legacyPath);
      if (!legacy)
        return;
      const rows = legacy.db.prepare("SELECT key, value FROM keyv").all();
      let imported = 0;
      for (const row of rows) {
        const cacheKey = row.key;
        if (this.getSqliteEntry(cacheKey))
          continue;
        const parsed = JSON.parse(row.value);
        const entry = parsed.value;
        if (!entry || !this.isValidEntry(entry))
          continue;
        if (parsed.expires && Date.now() > parsed.expires)
          continue;
        if (!fs3.existsSync(entry.audioFilePath))
          continue;
        const storedEntry = {
          ...entry,
          fileSize: fs3.statSync(entry.audioFilePath).size
        };
        if (this.importStoredEntry(cacheKey, storedEntry)) {
          imported++;
        }
      }
      if (imported > 0) {
        fs3.renameSync(legacyPath, `${legacyPath}.migrated`);
        this.logger.debug(`Migrated ${imported} entries from legacy tts-cache.sqlite`);
      }
    } catch (error) {
      this.logger.warn("Legacy tts-cache.sqlite migration failed:", error);
    }
  }
  ensureMetadataLoaded() {
    if (!this.metadataLoaded && this.useJsonFallback) {
      this.loadJsonMetadata();
    }
  }
  loadJsonMetadata() {
    try {
      if (fs3.existsSync(this.metadataFile)) {
        const data = JSON.parse(fs3.readFileSync(this.metadataFile, "utf8"));
        this.jsonEntries = data.entries || {};
      } else {
        this.jsonEntries = {};
      }
    } catch (error) {
      this.logger.warn("Error loading JSON metadata, starting fresh:", error);
      this.jsonEntries = {};
    }
    this.metadataLoaded = true;
  }
  saveJsonMetadata() {
    const data = { version: 1, entries: this.jsonEntries };
    const tempFile = `${this.metadataFile}.tmp`;
    fs3.writeFileSync(tempFile, JSON.stringify(data, null, 2), { mode: 384 });
    fs3.renameSync(tempFile, this.metadataFile);
    fs3.chmodSync(this.metadataFile, 384);
  }
  loadStats() {
    try {
      if (fs3.existsSync(this.statsFile)) {
        const stats = JSON.parse(fs3.readFileSync(this.statsFile, "utf8"));
        this.cacheHits = stats.cacheHits || 0;
        this.cacheMisses = stats.cacheMisses || 0;
      }
    } catch (error) {
      this.logger.warn("Error loading stats:", error);
    }
  }
  saveStats() {
    try {
      fs3.writeFileSync(this.statsFile, JSON.stringify({
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        timestamp: Date.now()
      }, null, 2), { mode: 384 });
      fs3.chmodSync(this.statsFile, 384);
    } catch (error) {
      this.logger.warn("Error saving stats:", error);
    }
  }
  rowToStoredEntry(row) {
    return {
      audioFilePath: row.file_path,
      provider: row.provider,
      voice: row.voice,
      rate: row.rate,
      timestamp: row.timestamp,
      text: row.original_text,
      fileSize: row.file_size,
      expiresAt: row.expires_at == null ? undefined : row.expires_at,
      model: row.model,
      source: row.source,
      sessionId: row.session_id,
      processId: row.process_id,
      hostname: row.hostname,
      user: row.user,
      workingDirectory: row.working_directory,
      commandLine: row.command_line,
      durationMs: row.duration_ms,
      success: row.success === 1,
      errorMessage: row.error_message
    };
  }
  rowToMetadata(row) {
    return {
      cacheKey: row.cache_key,
      originalText: row.original_text,
      provider: row.provider,
      voice: row.voice,
      rate: row.rate,
      timestamp: row.timestamp,
      fileSize: row.file_size,
      filePath: row.file_path,
      model: row.model,
      source: row.source,
      sessionId: row.session_id,
      processId: row.process_id,
      hostname: row.hostname,
      user: row.user,
      workingDirectory: row.working_directory,
      commandLine: row.command_line,
      durationMs: row.duration_ms,
      success: row.success === 1,
      errorMessage: row.error_message
    };
  }
  toMetadata(cacheKey, entry) {
    return {
      cacheKey,
      originalText: entry.text,
      provider: entry.provider,
      voice: entry.voice,
      rate: entry.rate,
      timestamp: entry.timestamp,
      fileSize: entry.fileSize,
      filePath: entry.audioFilePath,
      model: entry.model,
      source: entry.source,
      sessionId: entry.sessionId,
      processId: entry.processId,
      hostname: entry.hostname,
      user: entry.user,
      workingDirectory: entry.workingDirectory,
      commandLine: entry.commandLine,
      durationMs: entry.durationMs,
      success: entry.success,
      errorMessage: entry.errorMessage
    };
  }
  isExpired(entry) {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }
  isValidEntry(entry) {
    return !!entry && typeof entry.audioFilePath === "string" && typeof entry.provider === "string" && typeof entry.voice === "string" && typeof entry.rate === "number" && typeof entry.timestamp === "number" && typeof entry.text === "string";
  }
  inferModel(provider, voice) {
    switch (provider) {
      case "openai":
        return "tts-1";
      case "elevenlabs":
        return "eleven_multilingual_v2";
      case "groq":
        return "tts-1-hd";
      case "system":
        return `macOS-${voice}`;
      default:
        return provider;
    }
  }
  getSource() {
    if (process.argv[1]?.includes("speakeasy-cli"))
      return "cli";
    if (false)
      ;
    return "api";
  }
  getSessionId() {
    return `${Date.now()}-${process.pid}`;
  }
  upsertSqliteEntry(cacheKey, entry) {
    if (!this.db)
      return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (
        cache_key, original_text, provider, voice, rate, timestamp,
        file_size, file_path, expires_at, model, source, session_id,
        process_id, hostname, user, working_directory, command_line,
        duration_ms, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(cacheKey, entry.text, entry.provider, entry.voice, entry.rate, entry.timestamp, entry.fileSize, entry.audioFilePath, entry.expiresAt ?? null, entry.model ?? null, entry.source ?? null, entry.sessionId ?? null, entry.processId ?? null, entry.hostname ?? null, entry.user ?? null, entry.workingDirectory ?? null, entry.commandLine ?? null, entry.durationMs ?? null, entry.success === false ? 0 : 1, entry.errorMessage ?? null);
  }
  getSqliteEntry(cacheKey) {
    if (!this.db)
      return;
    const row = this.db.prepare("SELECT * FROM entries WHERE cache_key = ?").get(cacheKey);
    return row ? this.rowToStoredEntry(row) : undefined;
  }
  deleteSqliteEntry(cacheKey) {
    if (!this.db)
      return;
    this.db.prepare("DELETE FROM entries WHERE cache_key = ?").run(cacheKey);
  }
  deleteEntry(cacheKey, entry) {
    const resolved = entry || (this.useJsonFallback ? this.jsonEntries[cacheKey] : this.getSqliteEntry(cacheKey));
    if (resolved?.audioFilePath && fs3.existsSync(resolved.audioFilePath)) {
      fs3.unlinkSync(resolved.audioFilePath);
    }
    if (this.useJsonFallback) {
      delete this.jsonEntries[cacheKey];
      this.saveJsonMetadata();
    } else {
      this.deleteSqliteEntry(cacheKey);
    }
  }
  enforceMaxSize() {
    if (!this.maxSize)
      return;
    const entries = this.useJsonFallback ? Object.entries(this.jsonEntries).map(([cacheKey, entry]) => ({ cacheKey, entry })) : (this.db?.prepare("SELECT cache_key, file_size, timestamp FROM entries ORDER BY timestamp ASC").all() || []).map((row) => ({
      cacheKey: row.cache_key,
      entry: { fileSize: row.file_size }
    }));
    let totalSize = entries.reduce((sum, item) => sum + (item.entry.fileSize || 0), 0);
    if (totalSize <= this.maxSize)
      return;
    for (const item of entries) {
      if (totalSize <= this.maxSize)
        break;
      const entry = this.useJsonFallback ? this.jsonEntries[item.cacheKey] : this.getSqliteEntry(item.cacheKey);
      if (!entry)
        continue;
      totalSize -= entry.fileSize;
      this.deleteEntry(item.cacheKey, entry);
    }
  }
  buildSearchQuery(options) {
    const where = [];
    const params = [];
    if (options.text) {
      where.push("original_text LIKE ?");
      params.push(`%${options.text}%`);
    }
    if (options.provider) {
      where.push("provider = ?");
      params.push(options.provider);
    }
    if (options.model) {
      where.push("model = ?");
      params.push(options.model);
    }
    if (options.source) {
      where.push("source = ?");
      params.push(options.source);
    }
    if (options.fromDate) {
      where.push("timestamp >= ?");
      params.push(options.fromDate.getTime());
    }
    if (options.toDate) {
      where.push("timestamp <= ?");
      params.push(options.toDate.getTime());
    }
    if (options.minSize !== undefined) {
      where.push("file_size >= ?");
      params.push(options.minSize);
    }
    if (options.maxSize !== undefined) {
      where.push("file_size <= ?");
      params.push(options.maxSize);
    }
    if (options.success !== undefined) {
      where.push("success = ?");
      params.push(options.success ? 1 : 0);
    }
    if (options.workingDirectory) {
      where.push("working_directory LIKE ?");
      params.push(`%${options.workingDirectory}%`);
    }
    if (options.user) {
      where.push("user = ?");
      params.push(options.user);
    }
    if (options.sessionId) {
      where.push("session_id = ?");
      params.push(options.sessionId);
    }
    let sql = "SELECT * FROM entries";
    if (where.length > 0) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }
    sql += " ORDER BY timestamp DESC";
    if (options.limit !== undefined) {
      sql += " LIMIT ?";
      params.push(options.limit);
      if (options.offset !== undefined) {
        sql += " OFFSET ?";
        params.push(options.offset);
      }
    }
    return { sql, params };
  }
  filterJsonMetadata(options = {}) {
    this.ensureMetadataLoaded();
    let results = Object.entries(this.jsonEntries).map(([cacheKey, entry]) => this.toMetadata(cacheKey, entry)).sort((a, b) => b.timestamp - a.timestamp);
    if (options.text) {
      const needle = options.text.toLowerCase();
      results = results.filter((entry) => entry.originalText.toLowerCase().includes(needle));
    }
    if (options.provider)
      results = results.filter((entry) => entry.provider === options.provider);
    if (options.model)
      results = results.filter((entry) => entry.model === options.model);
    if (options.source)
      results = results.filter((entry) => entry.source === options.source);
    if (options.fromDate)
      results = results.filter((entry) => entry.timestamp >= options.fromDate.getTime());
    if (options.toDate)
      results = results.filter((entry) => entry.timestamp <= options.toDate.getTime());
    if (options.minSize !== undefined)
      results = results.filter((entry) => entry.fileSize >= options.minSize);
    if (options.maxSize !== undefined)
      results = results.filter((entry) => entry.fileSize <= options.maxSize);
    if (options.success !== undefined)
      results = results.filter((entry) => entry.success === options.success);
    if (options.workingDirectory) {
      const needle = options.workingDirectory.toLowerCase();
      results = results.filter((entry) => entry.workingDirectory?.toLowerCase().includes(needle));
    }
    if (options.user)
      results = results.filter((entry) => entry.user === options.user);
    if (options.sessionId)
      results = results.filter((entry) => entry.sessionId === options.sessionId);
    if (options.offset)
      results = results.slice(options.offset);
    if (options.limit)
      results = results.slice(0, options.limit);
    return results;
  }
  calculateStats(metadata) {
    if (metadata.length === 0) {
      return {
        totalEntries: 0,
        totalSize: 0,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        providers: {},
        models: {},
        sources: {},
        dateRange: null,
        avgFileSize: 0,
        hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
      };
    }
    const stats = {
      totalEntries: metadata.length,
      totalSize: metadata.reduce((sum, entry) => sum + entry.fileSize, 0),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providers: {},
      models: {},
      sources: {},
      dateRange: {
        earliest: new Date(Math.min(...metadata.map((entry) => entry.timestamp))),
        latest: new Date(Math.max(...metadata.map((entry) => entry.timestamp)))
      },
      avgFileSize: metadata.reduce((sum, entry) => sum + entry.fileSize, 0) / metadata.length,
      hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
    };
    metadata.forEach((entry) => {
      stats.providers[entry.provider] = (stats.providers[entry.provider] || 0) + 1;
      stats.models[entry.model || "unknown"] = (stats.models[entry.model || "unknown"] || 0) + 1;
      stats.sources[entry.source || "unknown"] = (stats.sources[entry.source || "unknown"] || 0) + 1;
    });
    return stats;
  }
  async get(key) {
    try {
      const entry = this.useJsonFallback ? (this.ensureMetadataLoaded(), this.jsonEntries[key]) : this.getSqliteEntry(key);
      if (entry && this.isValidEntry(entry)) {
        if (this.isExpired(entry)) {
          this.deleteEntry(key, entry);
        } else if (fs3.existsSync(entry.audioFilePath)) {
          this.cacheHits++;
          this.saveStats();
          return entry;
        } else {
          this.deleteEntry(key, entry);
        }
      }
    } catch (error) {
      console.warn("Cache retrieval error:", error);
    }
    this.cacheMisses++;
    this.saveStats();
    return;
  }
  async set(key, entry, audioBuffer, options) {
    try {
      const extension = options?.extension || detectAudioExtension(audioBuffer);
      const audioFilePath = path3.join(this.cacheDir, `${key}.${extension}`);
      fs3.writeFileSync(audioFilePath, audioBuffer, { mode: 384 });
      fs3.chmodSync(audioFilePath, 384);
      const timestamp = Date.now();
      const storedEntry = {
        ...entry,
        audioFilePath,
        timestamp,
        fileSize: audioBuffer.length,
        expiresAt: this.ttlMs ? timestamp + this.ttlMs : undefined,
        model: options?.model || this.inferModel(entry.provider, entry.voice),
        source: options?.source || this.getSource(),
        sessionId: this.getSessionId(),
        processId: process.pid.toString(),
        hostname: __require("os").hostname(),
        user: __require("os").userInfo().username,
        workingDirectory: process.cwd(),
        commandLine: process.argv.join(" "),
        durationMs: options?.durationMs,
        success: options?.success ?? true,
        errorMessage: options?.errorMessage
      };
      if (this.useJsonFallback) {
        this.ensureMetadataLoaded();
        this.jsonEntries[key] = storedEntry;
        this.saveJsonMetadata();
      } else {
        this.upsertSqliteEntry(key, storedEntry);
      }
      this.enforceMaxSize();
      this.logger.debug("Cache entry stored:", this.toMetadata(key, storedEntry));
      return true;
    } catch (error) {
      this.logger.warn("Cache storage error:", error);
      return false;
    }
  }
  async getCacheMetadata() {
    return this.search();
  }
  async findByText(text) {
    return this.search({ text });
  }
  async findByProvider(provider) {
    return this.search({ provider });
  }
  async search(options = {}) {
    if (this.useJsonFallback) {
      return this.filterJsonMetadata(options);
    }
    if (!this.db)
      return [];
    const { sql, params } = this.buildSearchQuery(options);
    return this.db.prepare(sql).all(...params).map((row) => this.rowToMetadata(row));
  }
  async getStats() {
    if (this.useJsonFallback) {
      return this.calculateStats(this.filterJsonMetadata());
    }
    if (!this.db) {
      return this.calculateStats([]);
    }
    const countRow = this.db.prepare("SELECT COUNT(*) AS count, SUM(file_size) AS total_size FROM entries").get();
    const count = countRow?.count || 0;
    if (count === 0) {
      return this.calculateStats([]);
    }
    const dateRow = this.db.prepare("SELECT MIN(timestamp) AS earliest, MAX(timestamp) AS latest FROM entries").get();
    const providers = {};
    const models = {};
    const sources = {};
    this.db.prepare("SELECT provider, COUNT(*) AS count FROM entries GROUP BY provider").all().forEach((row) => {
      providers[row.provider] = row.count;
    });
    this.db.prepare("SELECT model, COUNT(*) AS count FROM entries GROUP BY model").all().forEach((row) => {
      models[row.model || "unknown"] = row.count;
    });
    this.db.prepare("SELECT source, COUNT(*) AS count FROM entries GROUP BY source").all().forEach((row) => {
      sources[row.source || "unknown"] = row.count;
    });
    const totalSize = countRow?.total_size || 0;
    return {
      totalEntries: count,
      totalSize,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providers,
      models,
      sources,
      dateRange: {
        earliest: new Date(dateRow?.earliest),
        latest: new Date(dateRow?.latest)
      },
      avgFileSize: totalSize / count,
      hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
    };
  }
  async getRecent(limit = 10) {
    return this.search({ limit });
  }
  async delete(key) {
    try {
      this.deleteEntry(key);
      return true;
    } catch (error) {
      console.warn("Cache deletion error:", error);
      return false;
    }
  }
  async clear() {
    try {
      for (const file of fs3.readdirSync(this.cacheDir)) {
        if (file.endsWith(".mp3") || file.endsWith(".wav")) {
          fs3.unlinkSync(path3.join(this.cacheDir, file));
        }
      }
      if (this.useJsonFallback) {
        this.jsonEntries = {};
        this.saveJsonMetadata();
      } else if (this.db) {
        this.db.exec("DELETE FROM entries");
      }
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.saveStats();
    } catch (error) {
      console.warn("Cache clear error:", error);
    }
  }
  async cleanup(maxAge) {
    try {
      const cutoff = Date.now() - (maxAge || 7 * 24 * 60 * 60 * 1000);
      if (this.useJsonFallback) {
        this.ensureMetadataLoaded();
        for (const [key, entry] of Object.entries(this.jsonEntries)) {
          if (entry.timestamp < cutoff) {
            this.deleteEntry(key, entry);
          }
        }
        return;
      }
      if (!this.db)
        return;
      const oldEntries = this.db.prepare("SELECT cache_key, file_path FROM entries WHERE timestamp < ?").all(cutoff);
      for (const row of oldEntries) {
        const cacheKey = row.cache_key;
        const filePath = row.file_path;
        if (fs3.existsSync(filePath)) {
          fs3.unlinkSync(filePath);
        }
        this.deleteSqliteEntry(cacheKey);
      }
    } catch (error) {
      console.warn("Cache cleanup error:", error);
    }
  }
  generateCacheKey(text, provider, voice, rate, instructions) {
    const normalizedText = text.trim().toLowerCase();
    const normalizedInstructions = instructions?.trim() || "";
    const keyData = `${normalizedText}|${provider}|${voice}|${rate}|${normalizedInstructions}`;
    return v5_default(keyData, "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  }
  getCacheDir() {
    return this.cacheDir;
  }
  getEntryCount() {
    if (this.useJsonFallback) {
      this.ensureMetadataLoaded();
      return Object.keys(this.jsonEntries).length;
    }
    const row = this.db?.prepare("SELECT COUNT(*) AS count FROM entries").get();
    return row?.count || 0;
  }
  usesSqlite() {
    return !this.useJsonFallback && this.db !== null;
  }
  getSqliteBackend() {
    if (this.useJsonFallback)
      return "json";
    return this.sqliteBackend || "json";
  }
}
var CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entries (
    cache_key TEXT PRIMARY KEY,
    original_text TEXT NOT NULL,
    provider TEXT NOT NULL,
    voice TEXT NOT NULL,
    rate INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    expires_at INTEGER,
    model TEXT,
    source TEXT,
    session_id TEXT,
    process_id TEXT,
    hostname TEXT,
    user TEXT,
    working_directory TEXT,
    command_line TEXT,
    duration_ms INTEGER,
    success INTEGER DEFAULT 1,
    error_message TEXT
  )
`, CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_provider ON entries(provider);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON entries(timestamp);
  CREATE INDEX IF NOT EXISTS idx_source ON entries(source);
  CREATE INDEX IF NOT EXISTS idx_user ON entries(user);
  CREATE INDEX IF NOT EXISTS idx_model ON entries(model);
  CREATE INDEX IF NOT EXISTS idx_success ON entries(success);
`;
var init_cache = __esm(() => {
  init_dist_node();
});

// src/history.ts
import * as fs4 from "fs";
import * as path4 from "path";
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}
function getHistoryFile(historyDir, date = new Date) {
  const { year, week } = getWeekNumber(date);
  const weekStr = week.toString().padStart(2, "0");
  return path4.join(historyDir, `history-${year}-W${weekStr}.json`);
}

class NotificationHistory {
  entries = [];
  currentFile;
  maxEntries = 1000;
  historyDir;
  constructor(historyDir = HISTORY_DIR) {
    this.historyDir = historyDir;
    this.currentFile = getHistoryFile(this.historyDir);
    this.ensureDir();
    this.load();
  }
  ensureDir() {
    fs4.mkdirSync(this.historyDir, { recursive: true, mode: 448 });
    fs4.chmodSync(this.historyDir, 448);
  }
  load() {
    try {
      if (fs4.existsSync(this.currentFile)) {
        const data = fs4.readFileSync(this.currentFile, "utf8");
        this.entries = JSON.parse(data);
      }
    } catch (error) {
      console.warn("Failed to load history:", error);
      this.entries = [];
    }
  }
  save() {
    const newFile = getHistoryFile(this.historyDir);
    if (newFile !== this.currentFile) {
      this.currentFile = newFile;
      this.entries = [];
    }
    try {
      this.ensureDir();
      fs4.writeFileSync(this.currentFile, JSON.stringify(this.entries, null, 2), { mode: 384 });
      fs4.chmodSync(this.currentFile, 384);
    } catch (error) {
      console.warn("Failed to save history:", error);
    }
  }
  add(entry) {
    const id = v4_default();
    const fullEntry = { id, ...entry };
    this.entries.unshift(fullEntry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
    this.save();
    return id;
  }
  getAll() {
    return [...this.entries];
  }
  getRecent(limit = 20) {
    return this.entries.slice(0, limit);
  }
  clear() {
    this.entries = [];
    this.save();
  }
  getById(id) {
    return this.entries.find((e) => e.id === id);
  }
  getAllHistory() {
    const allEntries = [];
    try {
      if (!fs4.existsSync(this.historyDir))
        return allEntries;
      const files = fs4.readdirSync(this.historyDir).filter((f) => f.startsWith("history-") && f.endsWith(".json")).sort().reverse();
      for (const file of files) {
        try {
          const data = fs4.readFileSync(path4.join(this.historyDir, file), "utf8");
          const entries = JSON.parse(data);
          allEntries.push(...entries);
        } catch {}
      }
    } catch (error) {
      console.warn("Failed to read history files:", error);
    }
    return allEntries.sort((a, b) => b.timestamp - a.timestamp);
  }
  getHistoryDir() {
    return this.historyDir;
  }
}
function getHistory() {
  if (!historyInstance) {
    historyInstance = new NotificationHistory;
  }
  return historyInstance;
}
var CONFIG_DIR, HISTORY_DIR, historyInstance = null;
var init_history = __esm(() => {
  init_dist_node();
  CONFIG_DIR = path4.join(__require("os").homedir(), ".config", "speakeasy");
  HISTORY_DIR = path4.join(CONFIG_DIR, "history");
});

// src/providers/openai.ts
class OpenAIProvider {
  id = "openai";
  capabilities = {
    cacheable: true,
    instructions: true,
    silent: true
  };
  apiKey;
  voice;
  instructions;
  constructor(apiKey = "", voice = "nova", instructions) {
    this.apiKey = apiKey;
    this.voice = voice;
    this.instructions = instructions;
  }
  async synthesize(request) {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
    const instructions = request.instructions || this.instructions;
    if (instructions) {
      return this.synthesizeWithInstructions(request, instructions);
    }
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: request.voice || this.voice,
          input: request.text,
          speed: request.rate / 200
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.");
        }
        if (response.status === 429) {
          throw new Error("OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.");
        }
        throw new Error(`OpenAI API error: ${response.status}. Check your API key and rate limits.`);
      }
      const audioBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(audioBuffer),
        format: "mp3",
        model: "tts-1"
      };
    } catch (error) {
      throw new Error(`OpenAI TTS failed: ${error}`);
    }
  }
  async synthesizeWithInstructions(request, instructions) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-audio-preview",
          modalities: ["text", "audio"],
          audio: {
            voice: request.voice || this.voice,
            format: "mp3"
          },
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: request.text }
          ]
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.");
        }
        if (response.status === 429) {
          throw new Error("OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.");
        }
        const errorBody = await response.text();
        throw new Error(`OpenAI API error: ${response.status}. ${errorBody}`);
      }
      const data = await response.json();
      const audioData = data.choices?.[0]?.message?.audio?.data;
      if (!audioData) {
        throw new Error("No audio data in OpenAI response");
      }
      return {
        audio: Buffer.from(audioData, "base64"),
        format: "mp3",
        model: "gpt-4o-audio-preview"
      };
    } catch (error) {
      throw new Error(`OpenAI TTS with instructions failed: ${error}`);
    }
  }
  validate() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  formatError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Invalid API key")) {
      return "\uD83D\uDD11 Invalid OpenAI API key. Get yours at: https://platform.openai.com/api-keys";
    }
    if (message.includes("Rate limit")) {
      return '\u23F0 OpenAI rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `OpenAI TTS failed: ${message}`;
  }
  validateConfig() {
    return this.validate();
  }
  getErrorMessage(error) {
    return this.formatError(error);
  }
  async generateAudio(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    return result.audio;
  }
  async speak(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}
var init_openai = __esm(() => {
  init_audio();
});

// src/providers/elevenlabs.ts
class ElevenLabsProvider {
  id = "elevenlabs";
  capabilities = {
    cacheable: true,
    instructions: false,
    silent: true
  };
  apiKey;
  voiceId;
  constructor(apiKey = "", voiceId = "EXAVITQu4vr4xnSDxMaL") {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }
  async synthesize(request) {
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key is required");
    }
    const BALANCED = 0.5;
    const NATURAL = 0.5;
    try {
      const voiceId = request.voice || this.voiceId;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey
        },
        body: JSON.stringify({
          text: request.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: BALANCED,
            similarity_boost: NATURAL
          }
        })
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (response.status === 401) {
          if (errorBody.includes("model_deprecated")) {
            throw new Error("ElevenLabs API error: Model deprecated - updating to newer model");
          }
          throw new Error("ElevenLabs API error: Invalid API key");
        }
        if (response.status === 429) {
          throw new Error("ElevenLabs API error: Rate limit exceeded");
        }
        if (response.status === 403) {
          throw new Error("ElevenLabs API error: Access forbidden - check your API key permissions");
        }
        if (response.status === 422) {
          throw new Error("ElevenLabs API error: Invalid voice ID or parameters - check your configuration");
        }
        if (response.status === 404) {
          throw new Error(`ElevenLabs API error: Voice ID "${voiceId}" not found. Use a valid voice ID (e.g., EXAVITQu4vr4xnSDxMaL) not a voice name`);
        }
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }
      const audioBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(audioBuffer),
        format: "mp3",
        model: "eleven_multilingual_v2"
      };
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }
  }
  validate() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  formatError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Invalid API key")) {
      return "\uD83D\uDD11 Invalid ElevenLabs API key. Get yours at: https://elevenlabs.io/app/settings/api-keys";
    }
    if (message.includes("Access forbidden")) {
      return "\uD83D\uDD12 ElevenLabs access forbidden. Ensure your API key has TTS permissions";
    }
    if (message.includes("Rate limit")) {
      return '\u23F0 ElevenLabs rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    if (message.includes("not found")) {
      return '\uD83D\uDD0A Invalid ElevenLabs voice ID. Use a voice ID like "EXAVITQu4vr4xnSDxMaL", not a name like "nova". Find voice IDs at: https://elevenlabs.io/app/voice-library';
    }
    return `ElevenLabs TTS failed: ${message}`;
  }
  validateConfig() {
    return this.validate();
  }
  getErrorMessage(error) {
    return this.formatError(error);
  }
  async generateAudio(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voiceId));
    return result.audio;
  }
  async speak(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voiceId));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}
var init_elevenlabs = __esm(() => {
  init_audio();
});

// src/providers/groq.ts
class GroqProvider {
  id = "groq";
  capabilities = {
    cacheable: true,
    instructions: false,
    silent: true
  };
  apiKey;
  voice;
  constructor(apiKey = "", voice = "tara") {
    this.apiKey = apiKey;
    this.voice = voice;
  }
  async synthesize(request) {
    if (!this.apiKey) {
      throw new Error("Groq API key is required");
    }
    try {
      const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "canopylabs/orpheus-v1-english",
          voice: request.voice || this.voice,
          input: request.text
        })
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (response.status === 401) {
          throw new Error("Groq API error: Invalid API key");
        }
        if (response.status === 429) {
          throw new Error("Groq API error: Rate limit exceeded");
        }
        if (response.status === 400) {
          throw new Error(`Groq API error: Bad request - ${errorBody || "check voice name and parameters"}`);
        }
        throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
      }
      const audioBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(audioBuffer),
        format: "mp3",
        model: "canopylabs/orpheus-v1-english"
      };
    } catch (error) {
      throw new Error(`Groq TTS failed: ${error}`);
    }
  }
  validate() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  formatError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Invalid API key")) {
      return "\uD83D\uDD11 Invalid Groq API key. Get yours at: https://console.groq.com/keys";
    }
    if (message.includes("Rate limit")) {
      return '\u23F0 Groq rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `Groq TTS failed: ${message}`;
  }
  validateConfig() {
    return this.validate();
  }
  getErrorMessage(error) {
    return this.formatError(error);
  }
  async generateAudio(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    return result.audio;
  }
  async speak(config) {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}
var init_groq = __esm(() => {
  init_audio();
});

// src/providers/gemini.ts
class GeminiProvider {
  id = "gemini";
  capabilities = {
    cacheable: true,
    instructions: false,
    silent: true
  };
  apiKey;
  model;
  voiceName;
  constructor(apiKey = "", model = "gemini-2.5-flash-preview-tts", voiceName = "Puck") {
    this.apiKey = apiKey;
    this.model = model;
    this.voiceName = voiceName;
  }
  async synthesize(request) {
    if (!this.apiKey) {
      throw new Error("Gemini API key is required");
    }
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: request.text }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: request.voice || this.voiceName
                }
              }
            }
          }
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const error = JSON.parse(errorData);
          errorMessage = error.error?.message || errorMessage;
        } catch {}
        if (response.status === 429) {
          throw new Error("Rate limit exceeded");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("Invalid API key");
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]) {
        const part = data.candidates[0].content.parts[0];
        if ("inlineData" in part && part.inlineData) {
          const audioData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || "audio/wav";
          const buffer = Buffer.from(audioData, "base64");
          if (mimeType.includes("wav")) {
            return { audio: buffer, format: "wav", model: this.model };
          }
          return {
            audio: this.convertToWav(buffer, mimeType),
            format: "wav",
            model: this.model
          };
        }
      }
      throw new Error("No audio content received from Gemini API");
    } catch (error) {
      if (error.message?.includes("API key") || error.message?.includes("Invalid API key")) {
        throw new Error("Gemini API error: Invalid API key. Check your GEMINI_API_KEY environment variable.");
      }
      if (error.message?.includes("quota") || error.message?.includes("rate") || error.message?.includes("Rate limit")) {
        throw new Error("Gemini API error: Rate limit exceeded. Try again later or reduce request frequency.");
      }
      if (error.message?.includes("model")) {
        throw new Error(`Gemini API error: Model '${this.model}' may not support audio generation. Try 'gemini-2.5-flash-preview-tts' or check available models.`);
      }
      throw new Error(`Gemini TTS failed: ${error.message || error}`);
    }
  }
  convertToWav(rawData, mimeType) {
    const options = this.parseMimeType(mimeType);
    const wavHeader = this.createWavHeader(rawData.length, options);
    return Buffer.concat([wavHeader, rawData]);
  }
  parseMimeType(mimeType) {
    const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
    const [, format] = fileType.split("/");
    const options = {
      numChannels: 1,
      sampleRate: 24000,
      bitsPerSample: 16
    };
    if (format && format.startsWith("L")) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }
    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key === "rate") {
        const rate = parseInt(value, 10);
        if (!isNaN(rate)) {
          options.sampleRate = rate;
        }
      }
    }
    return options;
  }
  createWavHeader(dataLength, options) {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = Buffer.alloc(44);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
  }
  validate() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  formatError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Invalid API key")) {
      return "\uD83D\uDD11 Invalid Gemini API key. Get yours at: https://aistudio.google.com/apikey";
    }
    if (message.includes("Rate limit") || message.includes("quota")) {
      return '\u23F0 Gemini rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    if (message.includes("model")) {
      return "\u274C Model not supported for audio. Try using gemini-2.5-flash-preview-tts or check available models.";
    }
    return `Gemini TTS failed: ${message}`;
  }
  validateConfig() {
    return this.validate();
  }
  getErrorMessage(error) {
    return this.formatError(error);
  }
  async generateAudio(config) {
    const result = await this.synthesize(toTTSRequest(config, this.model));
    return result.audio;
  }
  async speak(config) {
    const result = await this.synthesize(toTTSRequest(config, this.model));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}
var init_gemini = __esm(() => {
  init_audio();
});

// src/adapters/registry.ts
function createAdapterRegistry(config) {
  const registry = new Map;
  registry.set("system", new SystemProvider(config.systemVoice || getBestVoice()));
  registry.set("openai", new OpenAIProvider(config.apiKeys?.openai || "", config.openaiVoice || "nova", config.instructions));
  registry.set("elevenlabs", new ElevenLabsProvider(config.apiKeys?.elevenlabs || "", config.elevenlabsVoiceId || "EXAVITQu4vr4xnSDxMaL"));
  registry.set("groq", new GroqProvider(config.apiKeys?.groq || "", config.groqVoice || "tara"));
  registry.set("gemini", new GeminiProvider(config.apiKeys?.gemini || "", config.geminiModel || "gemini-2.5-flash-preview-tts"));
  return registry;
}
var PROVIDER_ORDER;
var init_registry = __esm(() => {
  init_system();
  init_system();
  init_openai();
  init_elevenlabs();
  init_groq();
  init_gemini();
  PROVIDER_ORDER = [
    "system",
    "openai",
    "elevenlabs",
    "groq",
    "gemini"
  ];
});
// src/player-protocol.ts
var PLAYER_PROTOCOL_VERSION = 1, PLAYER_SOCKET_PATH = "/tmp/speakeasy-player.sock";

// src/player-client.ts
import { randomUUID } from "crypto";
import { createConnection } from "net";
function sendPlayerCommand(command, commandArguments, timeoutMs = 5000) {
  const request = {
    protocolVersion: PLAYER_PROTOCOL_VERSION,
    requestId: randomUUID(),
    command,
    arguments: commandArguments
  };
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: PLAYER_SOCKET_PATH });
    let buffer = "";
    let settled = false;
    const finish = (error, response) => {
      if (settled)
        return;
      settled = true;
      socket.destroy();
      if (error)
        reject(error);
      else if (response)
        resolve(response);
    };
    socket.setTimeout(timeoutMs, () => {
      finish(new PlayerUnavailableError("SpeakEasy player did not respond"));
    });
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(request)}
`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf(`
`);
      if (newline < 0)
        return;
      try {
        const response = JSON.parse(buffer.slice(0, newline));
        if (response.protocolVersion !== PLAYER_PROTOCOL_VERSION) {
          finish(new Error(`Unsupported SpeakEasy player protocol ${response.protocolVersion}`));
          return;
        }
        if (response.requestId.toLowerCase() !== request.requestId.toLowerCase()) {
          finish(new Error("SpeakEasy player returned a mismatched request id"));
          return;
        }
        finish(undefined, response);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.on("error", (error) => {
      const code = error.code;
      if (code === "ENOENT" || code === "ECONNREFUSED") {
        finish(new PlayerUnavailableError);
      } else {
        finish(error);
      }
    });
    socket.on("end", () => {
      if (!settled)
        finish(new Error("SpeakEasy player closed the connection without a response"));
    });
  });
}
function enqueueInPlayer(audioPath, options = {}) {
  const item = {
    id: randomUUID(),
    audioPath,
    title: options.title ?? "SpeakEasy narration",
    text: options.text,
    provider: options.provider,
    createdAt: new Date().toISOString(),
    synthesisRateWPM: options.synthesisRateWPM,
    sourceThreadId: options.sourceThreadId ?? process.env.CODEX_THREAD_ID
  };
  return sendPlayerCommand("enqueue", {
    item,
    priority: options.priority ?? "normal",
    interrupt: options.interrupt ?? false,
    autoplay: options.autoplay ?? true
  });
}
var PlayerUnavailableError;
var init_player_client = __esm(() => {
  PlayerUnavailableError = class PlayerUnavailableError extends Error {
    constructor(message = "SpeakEasy player is unavailable") {
      super(message);
      this.name = "PlayerUnavailableError";
    }
  };
});

// src/index.ts
var exports_src = {};
__export(exports_src, {
  stopPlayback: () => stopPlayback,
  speak: () => speak,
  sendPlayerCommand: () => sendPlayerCommand,
  say: () => say,
  playTTSResult: () => playTTSResult,
  playAudioFile: () => playAudioFile,
  getBestVoice: () => getBestVoice,
  getAvailableVoices: () => getAvailableVoices,
  enqueueInPlayer: () => enqueueInPlayer,
  createAdapterRegistry: () => createAdapterRegistry,
  TTSCache: () => TTSCache,
  SystemProvider: () => SystemProvider,
  SpeakEasy: () => SpeakEasy,
  PlayerUnavailableError: () => PlayerUnavailableError,
  PROVIDER_ORDER: () => PROVIDER_ORDER,
  PLAYER_SOCKET_PATH: () => PLAYER_SOCKET_PATH,
  PLAYER_PROTOCOL_VERSION: () => PLAYER_PROTOCOL_VERSION,
  OpenAIProvider: () => OpenAIProvider,
  GroqProvider: () => GroqProvider,
  GeminiProvider: () => GeminiProvider,
  ElevenLabsProvider: () => ElevenLabsProvider,
  CONFIG_FILE: () => CONFIG_FILE
});
import * as fs5 from "fs";
import * as path5 from "path";
function loadGlobalConfig() {
  try {
    if (fs5.existsSync(CONFIG_FILE)) {
      const configData = fs5.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(configData);
    }
  } catch (error) {
    console.warn("Failed to load global config:", error);
  }
  return {};
}
function cleanTextForSpeech(text) {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, "").replace(/[^\w\s.,!?'-]/g, " ").replace(/\s+/g, " ").trim();
}

class SpeakEasy {
  config;
  adapters;
  isPlaying = false;
  queue = [];
  cache;
  useCache = false;
  debug = false;
  hudEnabled = false;
  lastAudioFile = null;
  constructor(config) {
    const globalConfig = loadGlobalConfig();
    this.hudEnabled = globalConfig.hud?.enabled ?? false;
    this.config = {
      provider: config.provider || globalConfig.defaults?.provider || "system",
      systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || getBestVoice(),
      openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || "nova",
      elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.providers?.elevenlabs?.voiceId || "EXAVITQu4vr4xnSDxMaL",
      groqVoice: config.groqVoice || globalConfig.providers?.groq?.voice || "tara",
      geminiModel: config.geminiModel || globalConfig.providers?.gemini?.model || "gemini-2.5-flash-preview-tts",
      rate: config.rate || globalConfig.defaults?.rate || 180,
      volume: config.volume !== undefined ? config.volume : globalConfig.defaults?.volume !== undefined ? globalConfig.defaults.volume : 0.7,
      instructions: config.instructions || globalConfig.providers?.openai?.instructions,
      debug: config.debug || false,
      apiKeys: {
        openai: config.apiKeys?.openai || globalConfig.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || "",
        elevenlabs: config.apiKeys?.elevenlabs || globalConfig.providers?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY || "",
        groq: config.apiKeys?.groq || globalConfig.providers?.groq?.apiKey || process.env.GROQ_API_KEY || "",
        gemini: config.apiKeys?.gemini || globalConfig.providers?.gemini?.apiKey || process.env.GEMINI_API_KEY || ""
      },
      tempDir: config.tempDir || globalConfig.global?.tempDir || "/tmp"
    };
    const cacheConfig = config.cache || globalConfig.cache;
    const hasApiKeys = !!(this.config.apiKeys?.openai || this.config.apiKeys?.elevenlabs || this.config.apiKeys?.groq || this.config.apiKeys?.gemini);
    const cacheEnabled = cacheConfig?.enabled ?? (hasApiKeys && this.config.provider !== "system");
    this.useCache = cacheEnabled;
    if (this.useCache) {
      const cacheDir = cacheConfig?.dir || path5.join(this.config.tempDir || "/tmp", "speakeasy-cache");
      this.cache = new TTSCache(cacheDir, cacheConfig?.ttl || "7d", cacheConfig?.maxSize);
    }
    this.adapters = createAdapterRegistry(this.config);
    this.debug = this.config.debug || false;
    if (this.debug) {
      this.printConfigDiagnostics();
    }
  }
  async speak(text, options = {}) {
    const cleanText = cleanTextForSpeech(text);
    if (options.interrupt && this.isPlaying) {
      this.stopSpeaking();
    }
    if (options.priority === "high") {
      this.queue.unshift({ text: cleanText, options });
    } else {
      this.queue.push({ text: cleanText, options });
    }
    if (!this.isPlaying) {
      await this.processQueue();
    }
  }
  async processQueue() {
    if (this.queue.length === 0)
      return;
    this.isPlaying = true;
    const { text, options } = this.queue.shift();
    try {
      await this.speakText(text, options);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("\u274C Speech error:", errorMsg);
      throw error;
    } finally {
      this.isPlaying = false;
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }
  async speakText(text, options = {}) {
    const requestedId = this.config.provider || "system";
    const silent = options.silent || false;
    this.lastAudioFile = null;
    if (this.debug) {
      console.log(`\uD83D\uDD0D Requested provider: ${requestedId}`);
      console.log(`\uD83D\uDD0D Text: "${text}"`);
      if (silent)
        console.log(`\uD83D\uDD07 Silent mode: audio will not be played`);
    }
    const requestedAdapter = this.adapters.get(requestedId);
    if (requestedId !== "system" && requestedAdapter && !requestedAdapter.validate()) {
      const providerName = requestedId.charAt(0).toUpperCase() + requestedId.slice(1);
      const envVarHelp = API_KEY_HELP[requestedId];
      throw new Error(`${providerName} API key is required.${envVarHelp ? ` Run: ${envVarHelp}` : ""}`);
    }
    let lastError = null;
    for (const providerId of PROVIDER_ORDER) {
      if (providerId !== requestedId && !lastError)
        continue;
      const adapter = this.adapters.get(providerId);
      if (!adapter?.validate())
        continue;
      try {
        const request = this.buildRequest(text, providerId);
        if (this.debug) {
          console.log(`\u2705 Using provider: ${providerId}`);
          console.log(`\uD83C\uDF99\uFE0F  Voice/model: ${request.voice}`);
          console.log(`\u26A1 Rate: ${request.rate} WPM`);
          console.log(`\uD83D\uDD0A Volume: ${(request.volume * 100).toFixed(0)}%`);
        }
        if (this.useCache && adapter.capabilities.cacheable && this.cache) {
          const cacheKey = this.cache.generateCacheKey(text, providerId, request.voice, request.rate, adapter.capabilities.instructions ? request.instructions : undefined);
          const cachedEntry = await this.cache.get(cacheKey);
          if (cachedEntry) {
            console.log("(already cached)");
            this.lastAudioFile = cachedEntry.audioFilePath;
            if (this.debug) {
              console.log(`\uD83D\uDCE6 Using cached audio from: ${cachedEntry.audioFilePath}`);
            }
            await this.sendHUDNotification(text, providerId, true);
            if (!silent) {
              await playAudioFile(cachedEntry.audioFilePath, request.volume);
            }
            return;
          }
        }
        const startTime = Date.now();
        const result = await adapter.synthesize(request);
        if (this.useCache && adapter.capabilities.cacheable && this.cache) {
          const cacheKey = this.cache.generateCacheKey(text, providerId, request.voice, request.rate, adapter.capabilities.instructions ? request.instructions : undefined);
          const stored = await this.cache.set(cacheKey, {
            provider: providerId,
            voice: request.voice,
            rate: request.rate,
            text
          }, result.audio, {
            model: result.model ?? providerId,
            durationMs: Date.now() - startTime,
            success: true,
            extension: result.format
          });
          if (stored) {
            this.lastAudioFile = path5.join(this.cache.getCacheDir(), `${cacheKey}.${result.format}`);
          }
          console.log("cached");
        }
        await this.sendHUDNotification(text, providerId, false);
        if (!silent) {
          await playTTSResult(result, request.volume, request.tempDir);
        }
        return;
      } catch (error) {
        console.warn(`${providerId} provider failed:`, error);
        lastError = error;
      }
    }
    if (lastError) {
      if (requestedId !== "system") {
        const providerName = requestedId.charAt(0).toUpperCase() + requestedId.slice(1);
        const helpUrl = lastError.message.includes("API key") ? API_KEY_URLS[requestedId] : undefined;
        throw new Error(`${providerName} failed: ${lastError.message}${helpUrl ? `
\uD83D\uDCA1 Get your API key: ${helpUrl}` : ""}
\uD83D\uDDE3\uFE0F  Try: speakeasy --text "hello world" --provider system`);
      }
      throw new Error(`All providers failed. Last error: ${lastError.message}`);
    }
    throw new Error(`No available TTS provider. Ensure you're on macOS for system voice.`);
  }
  buildRequest(text, providerId) {
    return {
      text,
      voice: this.getVoiceForProvider(providerId),
      rate: this.config.rate || 180,
      volume: this.config.volume !== undefined ? this.config.volume : 0.7,
      tempDir: this.config.tempDir || "/tmp",
      apiKey: this.getApiKeyForProvider(providerId) || undefined,
      instructions: providerId === "openai" ? this.config.instructions : undefined
    };
  }
  printConfigDiagnostics() {
    console.log("\uD83D\uDD0D Debug mode enabled");
    console.log("\uD83D\uDCCA Current Configuration:");
    console.log(`   Provider: ${this.config.provider}`);
    console.log(`   Rate: ${this.config.rate} WPM`);
    console.log(`   Volume: ${((this.config.volume || 0.7) * 100).toFixed(0)}%`);
    console.log(`   System Voice: ${this.config.systemVoice}`);
    console.log(`   OpenAI Voice: ${this.config.openaiVoice}`);
    console.log(`   ElevenLabs Voice: ${this.config.elevenlabsVoiceId}`);
    console.log(`   Gemini Model: ${this.config.geminiModel}`);
    if (this.config.instructions) {
      console.log(`   Instructions: "${this.config.instructions.substring(0, 50)}${this.config.instructions.length > 50 ? "..." : ""}"`);
    }
    console.log("\uD83D\uDD11 API Key Status:");
    const providers = [
      { name: "OpenAI", key: "openai", env: "OPENAI_API_KEY" },
      { name: "ElevenLabs", key: "elevenlabs", env: "ELEVENLABS_API_KEY" },
      { name: "Groq", key: "groq", env: "GROQ_API_KEY" },
      { name: "Gemini", key: "gemini", env: "GEMINI_API_KEY" }
    ];
    providers.forEach(({ name, key, env }) => {
      const fromConfig = this.config.apiKeys?.[key];
      const fromEnv = process.env[env];
      if (fromConfig && fromConfig.length > 10) {
        console.log(`   \u2705 ${name}: Available from config (${fromConfig.substring(0, 8)}...)`);
      } else if (fromEnv && fromEnv.length > 10) {
        console.log(`   \u2705 ${name}: Available from environment (${fromEnv.substring(0, 8)}...)`);
      } else {
        console.log(`   \u274C ${name}: Not available`);
      }
    });
    console.log("\uD83D\uDCE6 Cache Status:");
    console.log(`   Enabled: ${this.useCache}`);
    if (this.cache) {
      console.log(`   Directory: ${this.cache.dir || "default"}`);
    }
    console.log("");
  }
  getVoiceForProvider(provider) {
    switch (provider) {
      case "openai":
        return this.config.openaiVoice || "nova";
      case "elevenlabs":
        return this.config.elevenlabsVoiceId || "EXAVITQu4vr4xnSDxMaL";
      case "system":
        return this.config.systemVoice || "Samantha";
      case "groq":
        return this.config.groqVoice || "tara";
      case "gemini":
        return this.config.geminiModel || "gemini-2.5-flash-preview-tts";
      default:
        return this.config.systemVoice || "Samantha";
    }
  }
  getApiKeyForProvider(provider) {
    switch (provider) {
      case "openai":
        return this.config.apiKeys?.openai || "";
      case "elevenlabs":
        return this.config.apiKeys?.elevenlabs || "";
      case "groq":
        return this.config.apiKeys?.groq || "";
      case "gemini":
        return this.config.apiKeys?.gemini || "";
      default:
        return "";
    }
  }
  async sendHUDNotification(text, provider, cached) {
    const timestamp = Date.now();
    getHistory().add({
      text,
      provider,
      timestamp,
      cached
    });
    if (!this.hudEnabled)
      return;
    notifyHUD({
      text: text.substring(0, 200),
      provider,
      cached,
      timestamp
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  stopSpeaking() {
    stopPlayback();
  }
  requireCache() {
    if (!this.cache) {
      throw new Error("Cache is not enabled. Configure cache.enabled or use an API provider with keys present.");
    }
    return this.cache;
  }
  async getCacheStats() {
    if (!this.cache) {
      return {
        totalEntries: 0,
        totalSize: 0,
        cacheHits: 0,
        cacheMisses: 0,
        providers: {},
        models: {},
        sources: {},
        dateRange: null,
        avgFileSize: 0,
        hitRate: 0
      };
    }
    const stats = await this.cache.getStats();
    return {
      ...stats,
      dir: this.cache.getCacheDir()
    };
  }
  async getCacheMetadata() {
    return this.requireCache().getCacheMetadata();
  }
  async findByText(text) {
    return this.requireCache().findByText(text);
  }
  async findByProvider(provider) {
    return this.requireCache().findByProvider(provider);
  }
}
var CONFIG_DIR2, CONFIG_FILE, API_KEY_HELP, API_KEY_URLS, say = (text, provider) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text argument is required for say()");
  }
  return new SpeakEasy(provider ? { provider } : {}).speak(text);
}, speak = (text, options) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text argument is required for speak()");
  }
  const { provider, volume, ...speakOptions } = options || {};
  const config = { provider, volume };
  return new SpeakEasy(config).speak(text, speakOptions);
};
var init_src = __esm(() => {
  init_system();
  init_cache();
  init_hud();
  init_history();
  init_registry();
  init_audio();
  init_registry();
  init_audio();
  init_system();
  init_openai();
  init_elevenlabs();
  init_groq();
  init_gemini();
  init_cache();
  init_player_client();
  CONFIG_DIR2 = path5.join(__require("os").homedir(), ".config", "speakeasy");
  CONFIG_FILE = path5.join(CONFIG_DIR2, "settings.json");
  API_KEY_HELP = {
    openai: "export OPENAI_API_KEY=your_key_here",
    elevenlabs: "export ELEVENLABS_API_KEY=your_key_here",
    groq: "export GROQ_API_KEY=your_key_here",
    gemini: "export GEMINI_API_KEY=your_key_here"
  };
  API_KEY_URLS = {
    openai: "https://platform.openai.com/api-keys",
    elevenlabs: "https://elevenlabs.io/app/settings/api-keys",
    groq: "https://console.groq.com/keys",
    gemini: "https://makersuite.google.com/app/apikey"
  };
});

// package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "@arach/speakeasy",
    version: "0.2.19",
    description: "Convenient TTS CLI for Mac \u2014 centralized credentials + configurable caching so all your apps and agents can speak.",
    homepage: "https://speakeasy.arach.dev",
    repository: {
      type: "git",
      url: "https://github.com/arach/SpeakEasy.git"
    },
    bugs: {
      url: "https://github.com/arach/SpeakEasy/issues"
    },
    main: "dist/index.js",
    types: "dist/index.d.ts",
    files: [
      "dist",
      "!dist/test.*"
    ],
    exports: {
      ".": "./dist/index.js"
    },
    publishConfig: {
      access: "public"
    },
    scripts: {
      build: "tsup src/index.ts src/bin/speakeasy-cli.ts --dts --format cjs --external node:sqlite --external bun:sqlite",
      "build:plugin-runtime": "bun build src/bin/speakeasy-cli.ts --target=bun --outfile plugins/speakeasy/skills/speakeasy/runtime/speakeasy-cli.js",
      "package:plugin-submission": "plugins/speakeasy/tools/build-submission.sh",
      "verify:plugin-bundle": "plugins/speakeasy/tools/verify-skill-bundle.sh",
      prepublishOnly: "pnpm run build",
      dev: "pnpm run build --watch",
      test: "bun test src",
      "test:privacy": "bun test src/privacy-permissions.test.ts",
      "test:cache": "pnpm run build && node scripts/cache-test.js",
      example: "pnpm run build && node examples/basic-usage.js",
      cli: "pnpm run build && node dist/bin/speakeasy-cli.js",
      docs: "cd docs-site && pnpm dev",
      "docs:build": "cd docs-site && pnpm build"
    },
    bin: {
      speakeasy: "dist/bin/speakeasy-cli.js"
    },
    keywords: [
      "tts",
      "speech",
      "text-to-speech",
      "openai",
      "elevenlabs",
      "groq",
      "macos",
      "cache",
      "cli"
    ],
    author: "arach",
    license: "MIT",
    engines: {
      node: ">=22.12.0",
      bun: ">=1.0.0"
    },
    dependencies: {
      "@openscout/agent-sessions": "^0.2.64",
      "bonjour-service": "^1.4.4",
      chalk: "^5.6.2",
      commander: "^15.0.0",
      qrcode: "^1.5.4",
      uuid: "^14.0.1",
      ws: "^8.21.1",
      zod: "^3.25.76"
    },
    devDependencies: {
      "@arach/dewey": "^0.2.0",
      "@types/node": "^22.0.0",
      "@types/qrcode": "^1.5.6",
      "@types/ws": "^8.18.1",
      tsup: "^8.5.1",
      typescript: "^5.9.3"
    },
    overrides: {
      "tar-fs": "^2.1.4"
    },
    pnpm: {
      overrides: {
        rollup: ">=4.59.0",
        esbuild: ">=0.28.1",
        yaml: ">=2.8.3",
        "picomatch@>=4": ">=4.0.4"
      }
    }
  };
});

// src/cli/constants.ts
import * as path6 from "path";
import { homedir } from "os";
var CONFIG_DIR3, CONFIG_FILE2, PROVIDERS, DEFAULT_VOICES, DEFAULTS, getPackageVersion = () => {
  try {
    const pkg = require_package();
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};
var init_constants = __esm(() => {
  CONFIG_DIR3 = path6.join(homedir(), ".config", "speakeasy");
  CONFIG_FILE2 = path6.join(CONFIG_DIR3, "settings.json");
  PROVIDERS = [
    { name: "OpenAI", key: "openai", env: "OPENAI_API_KEY" },
    { name: "ElevenLabs", key: "elevenlabs", env: "ELEVENLABS_API_KEY" },
    { name: "Groq", key: "groq", env: "GROQ_API_KEY" },
    { name: "Gemini", key: "gemini", env: "GEMINI_API_KEY" }
  ];
  DEFAULT_VOICES = {
    system: "Samantha",
    openai: "nova",
    elevenlabs: "EXAVITQu4vr4xnSDxMaL",
    groq: "tara",
    gemini: "gemini-2.5-flash-preview-tts"
  };
  DEFAULTS = {
    rate: 180,
    volume: 0.7,
    provider: "system"
  };
});

// node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/vendor/ansi-styles/index.js
function assembleStyles() {
  const codes = new Map;
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ANSI_BACKGROUND_OFFSET = 10, wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`, wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`, wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`, styles, modifierNames, foregroundColorNames, backgroundColorNames, colorNames, ansiStyles, ansi_styles_default;
var init_ansi_styles = __esm(() => {
  styles = {
    modifier: {
      reset: [0, 0],
      bold: [1, 22],
      dim: [2, 22],
      italic: [3, 23],
      underline: [4, 24],
      overline: [53, 55],
      inverse: [7, 27],
      hidden: [8, 28],
      strikethrough: [9, 29]
    },
    color: {
      black: [30, 39],
      red: [31, 39],
      green: [32, 39],
      yellow: [33, 39],
      blue: [34, 39],
      magenta: [35, 39],
      cyan: [36, 39],
      white: [37, 39],
      blackBright: [90, 39],
      gray: [90, 39],
      grey: [90, 39],
      redBright: [91, 39],
      greenBright: [92, 39],
      yellowBright: [93, 39],
      blueBright: [94, 39],
      magentaBright: [95, 39],
      cyanBright: [96, 39],
      whiteBright: [97, 39]
    },
    bgColor: {
      bgBlack: [40, 49],
      bgRed: [41, 49],
      bgGreen: [42, 49],
      bgYellow: [43, 49],
      bgBlue: [44, 49],
      bgMagenta: [45, 49],
      bgCyan: [46, 49],
      bgWhite: [47, 49],
      bgBlackBright: [100, 49],
      bgGray: [100, 49],
      bgGrey: [100, 49],
      bgRedBright: [101, 49],
      bgGreenBright: [102, 49],
      bgYellowBright: [103, 49],
      bgBlueBright: [104, 49],
      bgMagentaBright: [105, 49],
      bgCyanBright: [106, 49],
      bgWhiteBright: [107, 49]
    }
  };
  modifierNames = Object.keys(styles.modifier);
  foregroundColorNames = Object.keys(styles.color);
  backgroundColorNames = Object.keys(styles.bgColor);
  colorNames = [...foregroundColorNames, ...backgroundColorNames];
  ansiStyles = assembleStyles();
  ansi_styles_default = ansiStyles;
});

// node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "process";
import os from "os";
import tty from "tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== undefined) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === undefined) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => (key in env))) {
      return 3;
    }
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => (sign in env)) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var env, flagForceColor, supportsColor, supports_color_default;
var init_supports_color = __esm(() => {
  ({ env } = process2);
  if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
    flagForceColor = 0;
  } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
    flagForceColor = 1;
  }
  supportsColor = {
    stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
    stderr: createSupportsColor({ isTTY: tty.isatty(2) })
  };
  supports_color_default = supportsColor;
});

// node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? `\r
` : `
`) + postfix;
    endIndex = index + 1;
    index = string.indexOf(`
`, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/index.js
function createChalk(options) {
  return chalkFactory(options);
}
var stdoutColor, stderrColor, GENERATOR, STYLER, IS_EMPTY, levelMapping, styles2, applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === undefined ? colorLevel : options.level;
}, chalkFactory = (options) => {
  const chalk = (...strings) => strings.join(" ");
  applyOptions(chalk, options);
  Object.setPrototypeOf(chalk, createChalk.prototype);
  return chalk;
}, getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
}, usedModels, proto, createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === undefined) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
}, createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
}, applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === undefined) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== undefined) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf(`
`);
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
}, chalk, chalkStderr, source_default;
var init_source = __esm(() => {
  init_ansi_styles();
  init_supports_color();
  ({ stdout: stdoutColor, stderr: stderrColor } = supports_color_default);
  GENERATOR = Symbol("GENERATOR");
  STYLER = Symbol("STYLER");
  IS_EMPTY = Symbol("IS_EMPTY");
  levelMapping = [
    "ansi",
    "ansi",
    "ansi256",
    "ansi16m"
  ];
  styles2 = Object.create(null);
  Object.setPrototypeOf(createChalk.prototype, Function.prototype);
  for (const [styleName, style] of Object.entries(ansi_styles_default)) {
    styles2[styleName] = {
      get() {
        const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
        Object.defineProperty(this, styleName, { value: builder });
        return builder;
      }
    };
  }
  styles2.visible = {
    get() {
      const builder = createBuilder(this, this[STYLER], true);
      Object.defineProperty(this, "visible", { value: builder });
      return builder;
    }
  };
  usedModels = ["rgb", "hex", "ansi256"];
  for (const model of usedModels) {
    styles2[model] = {
      get() {
        const { level } = this;
        return function(...arguments_) {
          const styler = createStyler(getModelAnsi(model, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
          return createBuilder(this, styler, this[IS_EMPTY]);
        };
      }
    };
    const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
    styles2[bgModel] = {
      get() {
        const { level } = this;
        return function(...arguments_) {
          const styler = createStyler(getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
          return createBuilder(this, styler, this[IS_EMPTY]);
        };
      }
    };
  }
  proto = Object.defineProperties(() => {}, {
    ...styles2,
    level: {
      enumerable: true,
      get() {
        return this[GENERATOR].level;
      },
      set(level) {
        this[GENERATOR].level = level;
      }
    }
  });
  Object.defineProperties(createChalk.prototype, styles2);
  chalk = createChalk();
  chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
  source_default = chalk;
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
var init_util = __esm(() => {
  (function(util2) {
    util2.assertEqual = (_) => {};
    function assertIs(_arg) {}
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error;
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
      const filtered = {};
      for (const k of validKeys) {
        filtered[k] = obj[k];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
      };
    };
  })(objectUtil || (objectUtil = {}));
  ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
}, ZodError;
var init_ZodError = __esm(() => {
  init_util();
  ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  ZodError = class ZodError extends Error {
    get errors() {
      return this.issues;
    }
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    static assert(value) {
      if (!(value instanceof ZodError)) {
        throw new Error(`Not a ZodError: ${value}`);
      }
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          const firstEl = sub.path[0];
          fieldErrors[firstEl] = fieldErrors[firstEl] || [];
          fieldErrors[firstEl].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
}, en_default;
var init_en = __esm(() => {
  init_ZodError();
  init_util();
  en_default = errorMap;
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors = __esm(() => {
  init_en();
  overrideErrorMap = en_default;
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === en_default ? undefined : en_default
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}

class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
var makeIssue = (params) => {
  const { data, path: path11, errorMaps, issueData } = params;
  const fullPath = [...path11, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== undefined) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
}, EMPTY_PATH, INVALID, DIRTY = (value) => ({ status: "dirty", value }), OK = (value) => ({ status: "valid", value }), isAborted = (x) => x.status === "aborted", isDirty = (x) => x.status === "dirty", isValid = (x) => x.status === "valid", isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
var init_parseUtil = __esm(() => {
  init_errors();
  init_en();
  EMPTY_PATH = [];
  INVALID = Object.freeze({
    status: "aborted"
  });
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = () => {};

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm(() => {
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
  })(errorUtil || (errorUtil = {}));
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
class ParseInputLazyPath {
  constructor(parent, value, path11, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path11;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}

class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus,
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(undefined).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
}, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [undefined];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [undefined, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
}, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params), stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring = () => stringType().optional(), onumber = () => numberType().optional(), oboolean = () => booleanType().optional(), coerce, NEVER;
var init_types = __esm(() => {
  init_ZodError();
  init_errors();
  init_errorUtil();
  init_parseUtil();
  init_util();
  cuidRegex = /^c[^\s-]{8,}$/i;
  cuid2Regex = /^[0-9a-z]+$/;
  ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  nanoidRegex = /^[a-z0-9_-]{21}$/i;
  jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
  ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  dateRegex = new RegExp(`^${dateRegexSource}$`);
  ZodString = class ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.string,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const status = new ParseStatus;
      let ctx = undefined;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "nanoid") {
          if (!nanoidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "nanoid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "date") {
          const regex = dateRegex;
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "date",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "time") {
          const regex = timeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "time",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "duration") {
          if (!durationRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "duration",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "jwt") {
          if (!isValidJWT(input.data, check.alg)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "jwt",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cidr") {
          if (!isValidCidr(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cidr",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64") {
          if (!base64Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64url") {
          if (!base64urlRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
    }
    _addCheck(check) {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
      return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
      return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
      return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
      return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
      return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
      return this._addCheck({
        kind: "base64url",
        ...errorUtil.errToObj(message)
      });
    }
    jwt(options) {
      return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
      return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
      return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          local: false,
          message: options
        });
      }
      return this._addCheck({
        kind: "datetime",
        precision: typeof options?.precision === "undefined" ? null : options?.precision,
        offset: options?.offset ?? false,
        local: options?.local ?? false,
        ...errorUtil.errToObj(options?.message)
      });
    }
    date(message) {
      return this._addCheck({ kind: "date", message });
    }
    time(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "time",
          precision: null,
          message: options
        });
      }
      return this._addCheck({
        kind: "time",
        precision: typeof options?.precision === "undefined" ? null : options?.precision,
        ...errorUtil.errToObj(options?.message)
      });
    }
    duration(message) {
      return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    includes(value, options) {
      return this._addCheck({
        kind: "includes",
        value,
        position: options?.position,
        ...errorUtil.errToObj(options?.message)
      });
    }
    startsWith(value, message) {
      return this._addCheck({
        kind: "startsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    endsWith(value, message) {
      return this._addCheck({
        kind: "endsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this._addCheck({
        kind: "length",
        value: len,
        ...errorUtil.errToObj(message)
      });
    }
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodString.create = (params) => {
    return new ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: params?.coerce ?? false,
      ...processCreateParams(params)
    });
  };
  ZodNumber = class ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = undefined;
      const status = new ParseStatus;
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null;
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  };
  ZodNumber.create = (params) => {
    return new ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: params?.coerce || false,
      ...processCreateParams(params)
    });
  };
  ZodBigInt = class ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        try {
          input.data = BigInt(input.data);
        } catch {
          return this._getInvalidInput(input);
        }
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        return this._getInvalidInput(input);
      }
      let ctx = undefined;
      const status = new ParseStatus;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx.parsedType
      });
      return INVALID;
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new ZodBigInt({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new ZodBigInt({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodBigInt.create = (params) => {
    return new ZodBigInt({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: params?.coerce ?? false,
      ...processCreateParams(params)
    });
  };
  ZodBoolean = class ZodBoolean extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodBoolean.create = (params) => {
    return new ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: params?.coerce || false,
      ...processCreateParams(params)
    });
  };
  ZodDate = class ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (Number.isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus;
      let ctx = undefined;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new ZodDate({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  };
  ZodDate.create = (params) => {
    return new ZodDate({
      checks: [],
      coerce: params?.coerce || false,
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  ZodSymbol = class ZodSymbol extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodSymbol.create = (params) => {
    return new ZodSymbol({
      typeName: ZodFirstPartyTypeKind.ZodSymbol,
      ...processCreateParams(params)
    });
  };
  ZodUndefined = class ZodUndefined extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodUndefined.create = (params) => {
    return new ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  ZodNull = class ZodNull extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodNull.create = (params) => {
    return new ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  ZodAny = class ZodAny extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodAny.create = (params) => {
    return new ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  ZodUnknown = class ZodUnknown extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodUnknown.create = (params) => {
    return new ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  ZodNever = class ZodNever extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  ZodNever.create = (params) => {
    return new ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  ZodVoid = class ZodVoid extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodVoid.create = (params) => {
    return new ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  ZodArray = class ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : undefined,
            maximum: tooBig ? def.exactLength.value : undefined,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = [...ctx.data].map((item, i) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return new ZodArray({
        ...this._def,
        exactLength: { value: len, message: errorUtil.toString(message) }
      });
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodArray.create = (schema, params) => {
    return new ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  ZodObject = class ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      this._cached = { shape, keys };
      return this._cached;
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") {} else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== undefined ? {
          errorMap: (issue, ctx) => {
            const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: errorUtil.errToObj(message).message ?? defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    extend(augmentation) {
      return new ZodObject({
        ...this._def,
        shape: () => ({
          ...this._def.shape(),
          ...augmentation
        })
      });
    }
    merge(merging) {
      const merged = new ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => ({
          ...this._def.shape(),
          ...merging._def.shape()
        }),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    catchall(index) {
      return new ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      for (const key of util.objectKeys(mask)) {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  };
  ZodObject.create = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodUnion = class ZodUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        })).then(handleResults);
      } else {
        let dirty = undefined;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  ZodUnion.create = (types3, params) => {
    return new ZodUnion({
      options: types3,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  ZodDiscriminatedUnion = class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    static create(discriminator, options, params) {
      const optionsMap = new Map;
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap,
        ...processCreateParams(params)
      });
    }
  };
  ZodIntersection = class ZodIntersection extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  };
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  ZodTuple = class ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x) => !!x);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new ZodTuple({
        ...this._def,
        rest
      });
    }
  };
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  ZodRecord = class ZodRecord extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new ZodRecord({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(third)
        });
      }
      return new ZodRecord({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(second)
      });
    }
  };
  ZodMap = class ZodMap extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = new Map;
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = new Map;
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  ZodSet = class ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = new Set;
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodSet.create = (valueType, params) => {
    return new ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  ZodFunction = class ZodFunction extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        const me = this;
        return OK(async function(...args) {
          const error = new ZodError([]);
          const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
            error.addIssue(makeArgsIssue(args, e));
            throw error;
          });
          const result = await Reflect.apply(fn, this, parsedArgs);
          const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
            error.addIssue(makeReturnsIssue(result, e));
            throw error;
          });
          return parsedReturns;
        });
      } else {
        const me = this;
        return OK(function(...args) {
          const parsedArgs = me._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = Reflect.apply(fn, this, parsedArgs.data);
          const parsedReturns = me._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new ZodFunction({
        ...this._def,
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      });
    }
    returns(returnType) {
      return new ZodFunction({
        ...this._def,
        returns: returnType
      });
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    static create(args, returns, params) {
      return new ZodFunction({
        args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
        returns: returns || ZodUnknown.create(),
        typeName: ZodFirstPartyTypeKind.ZodFunction,
        ...processCreateParams(params)
      });
    }
  };
  ZodLazy = class ZodLazy extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  ZodLazy.create = (getter, params) => {
    return new ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  ZodLiteral = class ZodLiteral extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  ZodEnum = class ZodEnum extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(this._def.values);
      }
      if (!this._cache.has(input.data)) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values, newDef = this._def) {
      return ZodEnum.create(values, {
        ...this._def,
        ...newDef
      });
    }
    exclude(values, newDef = this._def) {
      return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
        ...this._def,
        ...newDef
      });
    }
  };
  ZodEnum.create = createZodEnum;
  ZodNativeEnum = class ZodNativeEnum extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(util.getValidEnumValues(this._def.values));
      }
      if (!this._cache.has(input.data)) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  ZodPromise = class ZodPromise extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  };
  ZodPromise.create = (schema, params) => {
    return new ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  ZodEffects = class ZodEffects extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(processed).then(async (processed2) => {
            if (status.value === "aborted")
              return INVALID;
            const result = await this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          });
        } else {
          if (status.value === "aborted")
            return INVALID;
          const result = this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return INVALID;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
              status: status.value,
              value: result
            }));
          });
        }
      }
      util.assertNever(effect);
    }
  };
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  ZodOptional = class ZodOptional extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(undefined);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodOptional.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  ZodNullable = class ZodNullable extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodNullable.create = (type, params) => {
    return new ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  ZodDefault = class ZodDefault extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodDefault({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default,
      ...processCreateParams(params)
    });
  };
  ZodCatch = class ZodCatch extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = {
        ...ctx,
        common: {
          ...ctx.common,
          issues: []
        }
      };
      const result = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: {
          ...newCtx
        }
      });
      if (isAsync(result)) {
        return result.then((result2) => {
          return {
            status: "valid",
            value: result2.status === "valid" ? result2.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result.status === "valid" ? result.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  ZodCatch.create = (type, params) => {
    return new ZodCatch({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
      ...processCreateParams(params)
    });
  };
  ZodNaN = class ZodNaN extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  ZodNaN.create = (params) => {
    return new ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  BRAND = Symbol("zod_brand");
  ZodBranded = class ZodBranded extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  ZodPipeline = class ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = async () => {
          const inResult = await this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        };
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a, b) {
      return new ZodPipeline({
        in: a,
        out: b,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  };
  ZodReadonly = class ZodReadonly extends ZodType {
    _parse(input) {
      const result = this._def.innerType._parse(input);
      const freeze = (data) => {
        if (isValid(data)) {
          data.value = Object.freeze(data.value);
        }
        return data;
      };
      return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly,
      ...processCreateParams(params)
    });
  };
  late = {
    object: ZodObject.lazycreate
  };
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  stringType = ZodString.create;
  numberType = ZodNumber.create;
  nanType = ZodNaN.create;
  bigIntType = ZodBigInt.create;
  booleanType = ZodBoolean.create;
  dateType = ZodDate.create;
  symbolType = ZodSymbol.create;
  undefinedType = ZodUndefined.create;
  nullType = ZodNull.create;
  anyType = ZodAny.create;
  unknownType = ZodUnknown.create;
  neverType = ZodNever.create;
  voidType = ZodVoid.create;
  arrayType = ZodArray.create;
  objectType = ZodObject.create;
  strictObjectType = ZodObject.strictCreate;
  unionType = ZodUnion.create;
  discriminatedUnionType = ZodDiscriminatedUnion.create;
  intersectionType = ZodIntersection.create;
  tupleType = ZodTuple.create;
  recordType = ZodRecord.create;
  mapType = ZodMap.create;
  setType = ZodSet.create;
  functionType = ZodFunction.create;
  lazyType = ZodLazy.create;
  literalType = ZodLiteral.create;
  enumType = ZodEnum.create;
  nativeEnumType = ZodNativeEnum.create;
  promiseType = ZodPromise.create;
  effectsType = ZodEffects.create;
  optionalType = ZodOptional.create;
  nullableType = ZodNullable.create;
  preprocessType = ZodEffects.createWithPreprocess;
  pipelineType = ZodPipeline.create;
  coerce = {
    string: (arg) => ZodString.create({ ...arg, coerce: true }),
    number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
    boolean: (arg) => ZodBoolean.create({
      ...arg,
      coerce: true
    }),
    bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
    date: (arg) => ZodDate.create({ ...arg, coerce: true })
  };
  NEVER = INVALID;
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var exports_external = {};
__export(exports_external, {
  void: () => voidType,
  util: () => util,
  unknown: () => unknownType,
  union: () => unionType,
  undefined: () => undefinedType,
  tuple: () => tupleType,
  transformer: () => effectsType,
  symbol: () => symbolType,
  string: () => stringType,
  strictObject: () => strictObjectType,
  setErrorMap: () => setErrorMap,
  set: () => setType,
  record: () => recordType,
  quotelessJson: () => quotelessJson,
  promise: () => promiseType,
  preprocess: () => preprocessType,
  pipeline: () => pipelineType,
  ostring: () => ostring,
  optional: () => optionalType,
  onumber: () => onumber,
  oboolean: () => oboolean,
  objectUtil: () => objectUtil,
  object: () => objectType,
  number: () => numberType,
  nullable: () => nullableType,
  null: () => nullType,
  never: () => neverType,
  nativeEnum: () => nativeEnumType,
  nan: () => nanType,
  map: () => mapType,
  makeIssue: () => makeIssue,
  literal: () => literalType,
  lazy: () => lazyType,
  late: () => late,
  isValid: () => isValid,
  isDirty: () => isDirty,
  isAsync: () => isAsync,
  isAborted: () => isAborted,
  intersection: () => intersectionType,
  instanceof: () => instanceOfType,
  getParsedType: () => getParsedType,
  getErrorMap: () => getErrorMap,
  function: () => functionType,
  enum: () => enumType,
  effect: () => effectsType,
  discriminatedUnion: () => discriminatedUnionType,
  defaultErrorMap: () => en_default,
  datetimeRegex: () => datetimeRegex,
  date: () => dateType,
  custom: () => custom,
  coerce: () => coerce,
  boolean: () => booleanType,
  bigint: () => bigIntType,
  array: () => arrayType,
  any: () => anyType,
  addIssueToContext: () => addIssueToContext,
  ZodVoid: () => ZodVoid,
  ZodUnknown: () => ZodUnknown,
  ZodUnion: () => ZodUnion,
  ZodUndefined: () => ZodUndefined,
  ZodType: () => ZodType,
  ZodTuple: () => ZodTuple,
  ZodTransformer: () => ZodEffects,
  ZodSymbol: () => ZodSymbol,
  ZodString: () => ZodString,
  ZodSet: () => ZodSet,
  ZodSchema: () => ZodType,
  ZodRecord: () => ZodRecord,
  ZodReadonly: () => ZodReadonly,
  ZodPromise: () => ZodPromise,
  ZodPipeline: () => ZodPipeline,
  ZodParsedType: () => ZodParsedType,
  ZodOptional: () => ZodOptional,
  ZodObject: () => ZodObject,
  ZodNumber: () => ZodNumber,
  ZodNullable: () => ZodNullable,
  ZodNull: () => ZodNull,
  ZodNever: () => ZodNever,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNaN: () => ZodNaN,
  ZodMap: () => ZodMap,
  ZodLiteral: () => ZodLiteral,
  ZodLazy: () => ZodLazy,
  ZodIssueCode: () => ZodIssueCode,
  ZodIntersection: () => ZodIntersection,
  ZodFunction: () => ZodFunction,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodError: () => ZodError,
  ZodEnum: () => ZodEnum,
  ZodEffects: () => ZodEffects,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodDefault: () => ZodDefault,
  ZodDate: () => ZodDate,
  ZodCatch: () => ZodCatch,
  ZodBranded: () => ZodBranded,
  ZodBoolean: () => ZodBoolean,
  ZodBigInt: () => ZodBigInt,
  ZodArray: () => ZodArray,
  ZodAny: () => ZodAny,
  Schema: () => ZodType,
  ParseStatus: () => ParseStatus,
  OK: () => OK,
  NEVER: () => NEVER,
  INVALID: () => INVALID,
  EMPTY_PATH: () => EMPTY_PATH,
  DIRTY: () => DIRTY,
  BRAND: () => BRAND
});
var init_external = __esm(() => {
  init_errors();
  init_parseUtil();
  init_typeAliases();
  init_util();
  init_types();
  init_ZodError();
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js
var init_zod = __esm(() => {
  init_external();
  init_external();
});
// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/protocol/adapter.ts
class BaseAdapter {
  config;
  session;
  eventListeners = new Set;
  errorListeners = new Set;
  constructor(config) {
    this.config = config;
    this.session = {
      id: config.sessionId,
      name: config.name ?? config.sessionId,
      adapterType: "",
      status: "connecting",
      cwd: config.cwd
    };
  }
  on(event, listener) {
    if (event === "event")
      this.eventListeners.add(listener);
    else if (event === "error")
      this.errorListeners.add(listener);
  }
  off(event, listener) {
    if (event === "event")
      this.eventListeners.delete(listener);
    else if (event === "error")
      this.errorListeners.delete(listener);
  }
  emit(event, payload) {
    if (event === "event") {
      for (const fn of this.eventListeners)
        fn(payload);
    } else if (event === "error") {
      for (const fn of this.errorListeners)
        fn(payload);
    }
  }
  setStatus(status) {
    this.session.status = status;
    this.session.adapterType = this.type;
    this.emit("event", { event: "session:update", session: { ...this.session } });
  }
}

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/protocol/approval-normalization.ts
function defaultApprovalTitle(block) {
  switch (block.action.kind) {
    case "command":
      return "Approve Command";
    case "file_change":
      return "Approve File Change";
    case "tool_call":
      return "Approve Tool Call";
    case "subagent":
      return "Approve Subagent";
  }
}
function defaultApprovalDetail(block) {
  switch (block.action.kind) {
    case "command":
      return block.action.command?.trim() || null;
    case "file_change":
      return block.action.path?.trim() || null;
    case "tool_call":
      return block.action.toolName?.trim() || null;
    case "subagent":
      return block.action.agentName?.trim() || block.action.agentId?.trim() || null;
  }
}
function normalizeApprovalRequest(session, turnId, block) {
  if (block.action.status !== "awaiting_approval" || !block.action.approval) {
    return null;
  }
  const title = defaultApprovalTitle(block);
  const detail = defaultApprovalDetail(block);
  const description = block.action.approval.description?.trim() || detail || title;
  return {
    sessionId: session.id,
    sessionName: session.name,
    adapterType: session.adapterType,
    turnId,
    blockId: block.id,
    version: block.action.approval.version,
    risk: block.action.approval.risk ?? "medium",
    title,
    description,
    detail,
    actionKind: block.action.kind,
    actionStatus: block.action.status
  };
}
function extractPendingApprovalRequests(snapshot) {
  const approvals = [];
  for (const turn of snapshot.turns) {
    for (const blockState of turn.blocks) {
      if (blockState.block.type !== "action") {
        continue;
      }
      const approval = normalizeApprovalRequest(snapshot.session, turn.id, blockState.block);
      if (approval) {
        approvals.push(approval);
      }
    }
  }
  return approvals;
}

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/protocol/cost.ts
function normalizeAdapterCostProvider(input) {
  const provider = input.provider?.trim().toLowerCase() ?? "";
  const adapterType = input.adapterType?.trim().toLowerCase() ?? "";
  const model = normalizeAdapterCostModel(input.model) ?? "";
  const haystack = [provider, adapterType].filter(Boolean);
  if (haystack.some((value) => OPENAI_PROVIDER_HINTS.some((hint) => value.includes(hint)))) {
    return "openai";
  }
  if (haystack.some((value) => ANTHROPIC_PROVIDER_HINTS.some((hint) => value.includes(hint)))) {
    return "anthropic";
  }
  if (model.startsWith("gpt-") || model.startsWith("o") || model.includes("codex")) {
    return "openai";
  }
  if (model.startsWith("claude-")) {
    return "anthropic";
  }
  return "unknown";
}
function normalizeAdapterCostModel(model) {
  if (!model)
    return null;
  return model.trim().toLowerCase().replace(/^(openai|anthropic)\//, "").replace(/_/g, "-").replace(/-\d{8}$/, "");
}
function adapterTokenBreakdown(usage) {
  const input = numberOrNull(usage?.inputTokens);
  const cachedInput = numberOrNull(usage?.cacheReadInputTokens);
  const cacheWrite = numberOrNull(usage?.cacheCreationInputTokens);
  const output = numberOrNull(usage?.outputTokens);
  const reasoningOutput = numberOrNull(usage?.reasoningOutputTokens);
  const observedTotal = [input, output].reduce((sum, value) => sum + (value ?? 0), 0);
  const total = numberOrNull(usage?.totalTokens) ?? (observedTotal || null);
  return {
    input,
    uncachedInput: input == null ? null : Math.max(0, input - (cachedInput ?? 0) - (cacheWrite ?? 0)),
    cachedInput,
    cacheWrite,
    output,
    reasoningOutput,
    total,
    webSearchRequests: numberOrNull(usage?.webSearchRequests),
    webFetchRequests: numberOrNull(usage?.webFetchRequests)
  };
}
function estimateAdapterCost(input) {
  const provider = normalizeAdapterCostProvider(input);
  const model = normalizeAdapterCostModel(input.model);
  const usage = adapterTokenBreakdown(input.usage);
  const resolved = resolveRateCard(provider, model);
  const billingMode = resolveBillingMode(input);
  if (!resolved.rateCard) {
    return {
      provider,
      model,
      rateCard: null,
      rateCardSource: "unknown",
      capturedAt: input.capturedAt ?? Date.now(),
      usage,
      lineItems: [],
      totalUsd: null,
      billedTotalUsd: null,
      billingMode,
      subscriptionWindows: input.subscriptionWindows ?? []
    };
  }
  const rateCard = resolved.rateCard;
  const uncachedInput = usage.uncachedInput ?? usage.input ?? 0;
  const cachedInput = usage.cachedInput ?? 0;
  const cacheWrite = usage.cacheWrite ?? 0;
  const output = usage.output ?? 0;
  const webSearchRequests = usage.webSearchRequests ?? 0;
  const lineItems = [
    tokenLine("input", "Input", uncachedInput, rateCard.inputPerM, billingMode),
    tokenLine("cached_input", "Cached input", cachedInput, rateCard.cachedInputPerM ?? rateCard.inputPerM, billingMode),
    tokenLine("cache_write", "Cache write", cacheWrite, rateCard.cacheWritePerM ?? rateCard.inputPerM, billingMode),
    tokenLine("output", "Output", output, rateCard.outputPerM, billingMode),
    {
      key: "web_search",
      label: "Web search",
      quantity: webSearchRequests,
      unit: "requests",
      rate: rateCard.webSearchPer1K ?? 0,
      billedRate: billingMode === "subscription" ? 0 : rateCard.webSearchPer1K ?? 0,
      costUsd: webSearchRequests / 1000 * (rateCard.webSearchPer1K ?? 0),
      billedCostUsd: billingMode === "subscription" ? 0 : webSearchRequests / 1000 * (rateCard.webSearchPer1K ?? 0)
    }
  ].filter((item) => item.quantity > 0);
  return {
    provider,
    model,
    rateCard,
    rateCardSource: resolved.source,
    capturedAt: input.capturedAt ?? Date.now(),
    usage,
    lineItems,
    totalUsd: lineItems.reduce((sum, item) => sum + item.costUsd, 0),
    billedTotalUsd: lineItems.reduce((sum, item) => sum + item.billedCostUsd, 0),
    billingMode,
    subscriptionWindows: input.subscriptionWindows ?? []
  };
}
function resolveRateCard(provider, model) {
  if (provider === "unknown")
    return { rateCard: null, source: "unknown" };
  const exactKey = model ? `${provider}:${model}` : null;
  if (exactKey && RATE_CARDS[exactKey]) {
    return { rateCard: RATE_CARDS[exactKey], source: "exact" };
  }
  const aliasKey = model ? EXACT_MODEL_ALIASES[model] : null;
  if (aliasKey && RATE_CARDS[aliasKey]) {
    return { rateCard: RATE_CARDS[aliasKey], source: "alias" };
  }
  if (provider === "anthropic") {
    if (model?.includes("opus"))
      return { rateCard: RATE_CARDS["anthropic:claude-opus-4.5"], source: "provider-default" };
    if (model?.includes("haiku"))
      return { rateCard: RATE_CARDS["anthropic:claude-haiku-4.5"], source: "provider-default" };
    if (model?.includes("sonnet") || !model)
      return { rateCard: RATE_CARDS["anthropic:claude-sonnet-4.5"], source: "provider-default" };
  }
  return { rateCard: null, source: "unknown" };
}
function tokenLine(key, label, quantity, rate, billingMode) {
  const billedRate = billingMode === "subscription" ? 0 : rate;
  return {
    key,
    label,
    quantity,
    unit: "tokens",
    rate,
    billedRate,
    costUsd: quantity / 1e6 * rate,
    billedCostUsd: quantity / 1e6 * billedRate
  };
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function resolveBillingMode(input) {
  if (input.billingMode)
    return input.billingMode;
  const adapterType = input.adapterType?.trim().toLowerCase();
  if (adapterType === "claude-code" || adapterType === "claude_stream_json") {
    return "subscription";
  }
  const planType = input.usage?.planType?.trim().toLowerCase();
  if (!planType)
    return "api";
  if (planType === "api" || planType.includes("api"))
    return "api";
  return "subscription";
}
var OPENAI_PROVIDER_HINTS, ANTHROPIC_PROVIDER_HINTS, RATE_CARDS, EXACT_MODEL_ALIASES;
var init_cost = __esm(() => {
  OPENAI_PROVIDER_HINTS = ["openai", "codex", "codex_app_server"];
  ANTHROPIC_PROVIDER_HINTS = ["anthropic", "claude", "claude-code", "claude_stream_json"];
  RATE_CARDS = {
    "openai:gpt-5.5": { provider: "openai", model: "gpt-5.5", inputPerM: 5, cachedInputPerM: 0.5, cacheWritePerM: null, outputPerM: 30, webSearchPer1K: 10 },
    "openai:gpt-5.5-pro": { provider: "openai", model: "gpt-5.5-pro", inputPerM: 30, cachedInputPerM: null, cacheWritePerM: null, outputPerM: 180, webSearchPer1K: 10 },
    "openai:gpt-5.4": { provider: "openai", model: "gpt-5.4", inputPerM: 2.5, cachedInputPerM: 0.25, cacheWritePerM: null, outputPerM: 15, webSearchPer1K: 10 },
    "openai:gpt-5.4-mini": { provider: "openai", model: "gpt-5.4-mini", inputPerM: 0.75, cachedInputPerM: 0.075, cacheWritePerM: null, outputPerM: 4.5, webSearchPer1K: 10 },
    "openai:gpt-5.4-nano": { provider: "openai", model: "gpt-5.4-nano", inputPerM: 0.2, cachedInputPerM: 0.02, cacheWritePerM: null, outputPerM: 1.25, webSearchPer1K: 10 },
    "openai:gpt-5.4-pro": { provider: "openai", model: "gpt-5.4-pro", inputPerM: 30, cachedInputPerM: null, cacheWritePerM: null, outputPerM: 180, webSearchPer1K: 10 },
    "openai:gpt-5.3-codex": { provider: "openai", model: "gpt-5.3-codex", inputPerM: 1.75, cachedInputPerM: 0.175, cacheWritePerM: null, outputPerM: 14, webSearchPer1K: 10 },
    "openai:gpt-5.3-chat-latest": { provider: "openai", model: "gpt-5.3-chat-latest", inputPerM: 1.75, cachedInputPerM: 0.175, cacheWritePerM: null, outputPerM: 14, webSearchPer1K: 10 },
    "openai:gpt-5.2": { provider: "openai", model: "gpt-5.2", inputPerM: 1.75, cachedInputPerM: 0.175, cacheWritePerM: null, outputPerM: 14, webSearchPer1K: 10 },
    "openai:gpt-5.2-codex": { provider: "openai", model: "gpt-5.2-codex", inputPerM: 1.75, cachedInputPerM: 0.175, cacheWritePerM: null, outputPerM: 14, webSearchPer1K: 10 },
    "openai:gpt-5.2-chat-latest": { provider: "openai", model: "gpt-5.2-chat-latest", inputPerM: 1.75, cachedInputPerM: 0.175, cacheWritePerM: null, outputPerM: 14, webSearchPer1K: 10 },
    "openai:gpt-5.2-pro": { provider: "openai", model: "gpt-5.2-pro", inputPerM: 21, cachedInputPerM: null, cacheWritePerM: null, outputPerM: 168, webSearchPer1K: 10 },
    "openai:gpt-5.1": { provider: "openai", model: "gpt-5.1", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5.1-codex": { provider: "openai", model: "gpt-5.1-codex", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5.1-codex-max": { provider: "openai", model: "gpt-5.1-codex-max", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5.1-chat-latest": { provider: "openai", model: "gpt-5.1-chat-latest", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5": { provider: "openai", model: "gpt-5", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5-codex": { provider: "openai", model: "gpt-5-codex", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5-chat-latest": { provider: "openai", model: "gpt-5-chat-latest", inputPerM: 1.25, cachedInputPerM: 0.125, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-5-mini": { provider: "openai", model: "gpt-5-mini", inputPerM: 0.25, cachedInputPerM: 0.025, cacheWritePerM: null, outputPerM: 2, webSearchPer1K: 10 },
    "openai:gpt-5-nano": { provider: "openai", model: "gpt-5-nano", inputPerM: 0.05, cachedInputPerM: 0.005, cacheWritePerM: null, outputPerM: 0.4, webSearchPer1K: 10 },
    "openai:gpt-5-pro": { provider: "openai", model: "gpt-5-pro", inputPerM: 15, cachedInputPerM: null, cacheWritePerM: null, outputPerM: 120, webSearchPer1K: 10 },
    "openai:gpt-4.1": { provider: "openai", model: "gpt-4.1", inputPerM: 2, cachedInputPerM: 0.5, cacheWritePerM: null, outputPerM: 8, webSearchPer1K: 10 },
    "openai:gpt-4.1-mini": { provider: "openai", model: "gpt-4.1-mini", inputPerM: 0.4, cachedInputPerM: 0.1, cacheWritePerM: null, outputPerM: 1.6, webSearchPer1K: 10 },
    "openai:gpt-4.1-nano": { provider: "openai", model: "gpt-4.1-nano", inputPerM: 0.1, cachedInputPerM: 0.025, cacheWritePerM: null, outputPerM: 0.4, webSearchPer1K: 10 },
    "openai:gpt-4o": { provider: "openai", model: "gpt-4o", inputPerM: 2.5, cachedInputPerM: 1.25, cacheWritePerM: null, outputPerM: 10, webSearchPer1K: 10 },
    "openai:gpt-4o-mini": { provider: "openai", model: "gpt-4o-mini", inputPerM: 0.15, cachedInputPerM: 0.075, cacheWritePerM: null, outputPerM: 0.6, webSearchPer1K: 10 },
    "anthropic:claude-opus-4.6": { provider: "anthropic", model: "claude-opus-4.6", inputPerM: 5, cachedInputPerM: 0.5, cacheWritePerM: 6.25, outputPerM: 25, webSearchPer1K: 10 },
    "anthropic:claude-opus-4.5": { provider: "anthropic", model: "claude-opus-4.5", inputPerM: 5, cachedInputPerM: 0.5, cacheWritePerM: 6.25, outputPerM: 25, webSearchPer1K: 10 },
    "anthropic:claude-opus-4.1": { provider: "anthropic", model: "claude-opus-4.1", inputPerM: 15, cachedInputPerM: 1.5, cacheWritePerM: 18.75, outputPerM: 75, webSearchPer1K: 10 },
    "anthropic:claude-opus-4": { provider: "anthropic", model: "claude-opus-4", inputPerM: 15, cachedInputPerM: 1.5, cacheWritePerM: 18.75, outputPerM: 75, webSearchPer1K: 10 },
    "anthropic:claude-sonnet-4.6": { provider: "anthropic", model: "claude-sonnet-4.6", inputPerM: 3, cachedInputPerM: 0.3, cacheWritePerM: 3.75, outputPerM: 15, webSearchPer1K: 10 },
    "anthropic:claude-sonnet-4.5": { provider: "anthropic", model: "claude-sonnet-4.5", inputPerM: 3, cachedInputPerM: 0.3, cacheWritePerM: 3.75, outputPerM: 15, webSearchPer1K: 10 },
    "anthropic:claude-sonnet-4": { provider: "anthropic", model: "claude-sonnet-4", inputPerM: 3, cachedInputPerM: 0.3, cacheWritePerM: 3.75, outputPerM: 15, webSearchPer1K: 10 },
    "anthropic:claude-3-7-sonnet": { provider: "anthropic", model: "claude-3-7-sonnet", inputPerM: 3, cachedInputPerM: 0.3, cacheWritePerM: 3.75, outputPerM: 15, webSearchPer1K: 10 },
    "anthropic:claude-haiku-4.5": { provider: "anthropic", model: "claude-haiku-4.5", inputPerM: 1, cachedInputPerM: 0.1, cacheWritePerM: 1.25, outputPerM: 5, webSearchPer1K: 10 }
  };
  EXACT_MODEL_ALIASES = {
    "claude-sonnet-4-5": "anthropic:claude-sonnet-4.5",
    "claude-sonnet-4-6": "anthropic:claude-sonnet-4.6",
    "claude-opus-4-5": "anthropic:claude-opus-4.5",
    "claude-opus-4-6": "anthropic:claude-opus-4.6",
    "claude-haiku-4-5": "anthropic:claude-haiku-4.5"
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/state.ts
function normalizeTrackedTimestamp(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value < 1000000000000 ? value * 1000 : value;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric < 1000000000000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

class StateTracker {
  states = new Map;
  createSession(sessionId, session) {
    this.states.set(sessionId, {
      session: { ...session },
      turns: []
    });
  }
  removeSession(sessionId) {
    this.states.delete(sessionId);
  }
  getSessionState(sessionId) {
    return this.states.get(sessionId) ?? null;
  }
  getAllSessionSummaries() {
    const summaries = [];
    for (const state of this.states.values()) {
      const currentTurn = state.currentTurnId ? state.turns.find((t) => t.id === state.currentTurnId) : undefined;
      const lastTurn = state.turns[state.turns.length - 1];
      const startedAt = state.turns[0]?.startedAt ?? Date.now();
      const lastActivityAt = lastTurn?.endedAt ?? lastTurn?.startedAt ?? startedAt;
      summaries.push({
        sessionId: state.session.id,
        name: state.session.name,
        adapterType: state.session.adapterType,
        status: state.session.status,
        turnCount: state.turns.length,
        currentTurnStatus: currentTurn?.status,
        startedAt,
        lastActivityAt
      });
    }
    return summaries;
  }
  trackEvent(sessionId, event, capturedAt) {
    const state = this.states.get(sessionId);
    if (!state)
      return;
    switch (event.event) {
      case "session:update":
        state.session = { ...event.session };
        break;
      case "session:closed":
        state.session = { ...state.session, status: "closed" };
        break;
      case "turn:start":
        this.handleTurnStart(state, event, capturedAt);
        break;
      case "turn:end":
        this.handleTurnEnd(state, event, capturedAt);
        break;
      case "turn:error":
        this.handleTurnError(state, event, capturedAt);
        break;
      case "block:start":
        this.handleBlockStart(state, event);
        break;
      case "block:delta":
        this.handleBlockTextDelta(state, event);
        break;
      case "block:action:output":
        this.handleBlockActionOutput(state, event);
        break;
      case "block:action:status":
        this.handleBlockActionStatus(state, event);
        break;
      case "block:action:approval":
        this.handleBlockActionApproval(state, event);
        break;
      case "block:question:answer":
        this.handleBlockQuestionAnswer(state, event);
        break;
      case "block:end":
        this.handleBlockEnd(state, event);
        break;
    }
  }
  handleTurnStart(state, event, capturedAt) {
    const turn = {
      id: event.turn.id,
      status: "streaming",
      blocks: [],
      startedAt: normalizeTrackedTimestamp(event.turn.startedAt) ?? normalizeTrackedTimestamp(capturedAt) ?? Date.now()
    };
    state.turns.push(turn);
    state.currentTurnId = turn.id;
  }
  handleTurnEnd(state, event, capturedAt) {
    const turn = this.findTurn(state, event.turnId);
    if (!turn)
      return;
    switch (event.status) {
      case "completed":
        turn.status = "completed";
        break;
      case "stopped":
        turn.status = "interrupted";
        break;
      case "failed":
        turn.status = "error";
        break;
      default:
        turn.status = "completed";
        break;
    }
    turn.endedAt = normalizeTrackedTimestamp(capturedAt) ?? Date.now();
    if (state.currentTurnId === event.turnId) {
      state.currentTurnId = undefined;
    }
  }
  handleTurnError(state, event, capturedAt) {
    const turn = this.findTurn(state, event.turnId);
    if (!turn)
      return;
    turn.status = "error";
    turn.endedAt = normalizeTrackedTimestamp(capturedAt) ?? Date.now();
    if (state.currentTurnId === event.turnId) {
      state.currentTurnId = undefined;
    }
  }
  handleBlockStart(state, event) {
    const turn = this.findTurn(state, event.turnId);
    if (!turn)
      return;
    const blockState = {
      block: { ...event.block },
      status: event.block.status === "completed" ? "completed" : "streaming"
    };
    turn.blocks.push(blockState);
  }
  handleBlockTextDelta(state, event) {
    const blockState = this.findBlock(state, event.turnId, event.blockId);
    if (!blockState)
      return;
    const block = blockState.block;
    if (block.type === "text") {
      block.text += event.text;
    } else if (block.type === "reasoning") {
      block.text += event.text;
    }
  }
  handleBlockActionOutput(state, event) {
    const blockState = this.findBlock(state, event.turnId, event.blockId);
    if (!blockState)
      return;
    const block = blockState.block;
    if (block.type === "action") {
      block.action.output += event.output;
    }
  }
  handleBlockActionStatus(state, event) {
    const blockState = this.findBlock(state, event.turnId, event.blockId);
    if (!blockState)
      return;
    const block = blockState.block;
    if (block.type === "action") {
      block.action.status = event.status;
    }
  }
  handleBlockActionApproval(state, event) {
    const blockState = this.findBlock(state, event.turnId, event.blockId);
    if (!blockState)
      return;
    const block = blockState.block;
    if (block.type === "action") {
      block.action.status = "awaiting_approval";
      block.action.approval = { ...event.approval };
    }
  }
  handleBlockQuestionAnswer(state, event) {
    const blockState = this.findBlock(state, event.turnId, event.blockId);
    if (!blockState)
      return;
    const block = blockState.block;
    if (block.type === "question") {
      const questionBlock = block;
      questionBlock.questionStatus = event.questionStatus;
      questionBlock.answer = event.answer ? [...event.answer] : undefined;
    }
  }
  handleBlockEnd(state, event) {
    const blockState = this.findBlock(state, event.turnId, event.blockId);
    if (!blockState)
      return;
    blockState.status = "completed";
    blockState.block.status = event.status;
  }
  findTurn(state, turnId) {
    return state.turns.find((t) => t.id === turnId);
  }
  findBlock(state, turnId, blockId) {
    const turn = this.findTurn(state, turnId);
    if (!turn)
      return;
    return turn.blocks.find((b) => b.block.id === blockId);
  }
}

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/buffer.ts
class OutboundBuffer {
  ring;
  capacity;
  head = 0;
  count = 0;
  nextSeq = 1;
  constructor(capacity = DEFAULT_CAPACITY) {
    if (capacity < 1) {
      throw new Error("Buffer capacity must be at least 1");
    }
    this.capacity = capacity;
    this.ring = new Array(capacity);
  }
  push(event) {
    const seq = this.nextSeq++;
    const entry = {
      seq,
      event,
      timestamp: Date.now()
    };
    this.ring[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
    return seq;
  }
  replay(afterSeq) {
    if (this.count === 0)
      return [];
    const oldest = this.oldestSeq();
    const current = this.currentSeq();
    if (afterSeq >= current)
      return [];
    const effectiveStart = afterSeq < oldest ? oldest : afterSeq + 1;
    const skip = effectiveStart - oldest;
    const resultCount = this.count - skip;
    if (resultCount <= 0)
      return [];
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    const startIndex = (tail + skip) % this.capacity;
    const result = new Array(resultCount);
    for (let i = 0;i < resultCount; i++) {
      const idx = (startIndex + i) % this.capacity;
      result[i] = this.ring[idx];
    }
    return result;
  }
  currentSeq() {
    return this.nextSeq - 1;
  }
  oldestSeq() {
    if (this.count === 0)
      return 0;
    const tail = (this.head - this.count + this.capacity) % this.capacity;
    return this.ring[tail].seq;
  }
  clear() {
    this.ring = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }
}
var DEFAULT_CAPACITY = 500;

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/registry.ts
function isSessionRegistryError(error) {
  return error instanceof SessionRegistryError;
}

class SessionRegistry {
  config;
  sessions = new Map;
  listeners = new Set;
  buffers = new Map;
  stateTracker = new StateTracker;
  constructor(config) {
    this.config = config;
  }
  async createSession(adapterType, options) {
    const factory = this.config.adapters[adapterType];
    if (!factory) {
      throw new Error(`Unknown adapter type: "${adapterType}". Registered: ${Object.keys(this.config.adapters).join(", ")}`);
    }
    const sessionId = options?.sessionId ?? crypto.randomUUID();
    const config = {
      sessionId,
      name: options?.name ?? `${adapterType} session`,
      cwd: options?.cwd ?? process.cwd(),
      env: options?.env,
      options: options?.options
    };
    const branch = this.detectBranch(config.cwd);
    const adapter = factory(config);
    adapter.on("event", (event) => {
      this.stateTracker.trackEvent(sessionId, event);
      this.broadcast(sessionId, event);
    });
    adapter.on("error", (error) => {
      const errorEvent = {
        event: "session:update",
        session: { ...adapter.session, status: "error" }
      };
      this.stateTracker.trackEvent(sessionId, errorEvent);
      this.broadcast(sessionId, errorEvent);
      console.error(`[session-registry] adapter error (${sessionId}):`, error.message);
    });
    if (branch) {
      adapter.session.providerMeta = {
        ...adapter.session.providerMeta,
        branch
      };
    }
    this.sessions.set(sessionId, adapter);
    this.ensureBuffer(sessionId);
    this.stateTracker.createSession(sessionId, adapter.session);
    await adapter.start();
    this.stateTracker.trackEvent(sessionId, {
      event: "session:update",
      session: { ...adapter.session }
    });
    return adapter.session;
  }
  send(prompt) {
    const adapter = this.sessions.get(prompt.sessionId);
    if (!adapter) {
      throw new SessionRegistryError("NOT_FOUND", `No session: ${prompt.sessionId}`);
    }
    adapter.send(prompt);
  }
  interrupt(sessionId) {
    const adapter = this.sessions.get(sessionId);
    if (!adapter) {
      return;
    }
    adapter.interrupt();
  }
  answer(answer) {
    const adapter = this.sessions.get(answer.sessionId);
    if (!adapter) {
      throw new SessionRegistryError("NOT_FOUND", `No session: ${answer.sessionId}`);
    }
    if (!adapter.answerQuestion) {
      throw new SessionRegistryError("BAD_REQUEST", "Adapter does not support interactive questions");
    }
    adapter.answerQuestion(answer);
  }
  decide(input) {
    const adapter = this.sessions.get(input.sessionId);
    if (!adapter) {
      throw new SessionRegistryError("NOT_FOUND", `No session: ${input.sessionId}`);
    }
    if (!adapter.decide) {
      throw new SessionRegistryError("BAD_REQUEST", "Adapter does not support approvals");
    }
    const approvalVersion = this.findApprovalVersion(input.sessionId, input.turnId, input.blockId);
    if (approvalVersion == null || approvalVersion !== input.version) {
      throw new SessionRegistryError("CONFLICT", "Stale approval version");
    }
    adapter.decide(input.turnId, input.blockId, input.decision, input.reason);
  }
  async closeSession(sessionId) {
    const adapter = this.sessions.get(sessionId);
    if (!adapter) {
      return;
    }
    await adapter.shutdown();
    this.sessions.delete(sessionId);
    const closedEvent = { event: "session:closed", sessionId };
    this.stateTracker.trackEvent(sessionId, closedEvent);
    this.broadcast(sessionId, closedEvent);
    this.stateTracker.removeSession(sessionId);
    this.buffers.delete(sessionId);
  }
  listSessions() {
    return [...this.sessions.values()].map((adapter) => ({ ...adapter.session }));
  }
  async shutdown() {
    const ids = [...this.sessions.keys()];
    await Promise.allSettled(ids.map((sessionId) => this.closeSession(sessionId)));
  }
  getSessionSnapshot(sessionId) {
    return this.stateTracker.getSessionState(sessionId);
  }
  getSessionSummaries() {
    return this.stateTracker.getAllSessionSummaries();
  }
  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  replay(sessionId, afterSeq) {
    return this.buffers.get(sessionId)?.replay(afterSeq) ?? [];
  }
  currentSeq(sessionId) {
    return this.buffers.get(sessionId)?.currentSeq() ?? 0;
  }
  oldestBufferedSeq(sessionId) {
    return this.buffers.get(sessionId)?.oldestSeq() ?? 0;
  }
  broadcast(sessionId, event) {
    const seq = this.ensureBuffer(sessionId).push(event);
    const sequenced = {
      seq,
      event,
      timestamp: Date.now()
    };
    for (const listener of this.listeners) {
      listener(sequenced);
    }
  }
  detectBranch(cwd) {
    try {
      const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: cwd ?? process.cwd(),
        stdout: "pipe",
        stderr: "pipe"
      });
      if (result.exitCode === 0) {
        return new TextDecoder().decode(result.stdout).trim();
      }
    } catch {}
    return;
  }
  findApprovalVersion(sessionId, turnId, blockId) {
    const snapshot = this.stateTracker.getSessionState(sessionId);
    if (!snapshot) {
      return null;
    }
    const turn = snapshot.turns.find((candidate) => candidate.id === turnId);
    if (!turn) {
      return null;
    }
    const blockState = turn.blocks.find((candidate) => candidate.block.id === blockId);
    if (!blockState || blockState.block.type !== "action") {
      return null;
    }
    return blockState.block.action.approval?.version ?? null;
  }
  ensureBuffer(sessionId) {
    let buffer = this.buffers.get(sessionId);
    if (!buffer) {
      buffer = new OutboundBuffer(this.config.bufferCapacity);
      this.buffers.set(sessionId, buffer);
    }
    return buffer;
  }
}
var SessionRegistryError;
var init_registry2 = __esm(() => {
  SessionRegistryError = class SessionRegistryError extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "SessionRegistryError";
      this.code = code;
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/history.ts
import { basename as basename2, dirname } from "path";
function decodeClaudeProjectsSlug(name) {
  if (!name || !name.startsWith("-")) {
    return null;
  }
  const tail = name.slice(1);
  if (!tail) {
    return null;
  }
  return `/${tail.replace(/-/g, "/")}`;
}
function inferClaudeHistoryCwd(path11) {
  const parent = basename2(dirname(path11));
  return decodeClaudeProjectsSlug(parent);
}
function deriveHistoryName(path11) {
  const claudeCwd = inferClaudeHistoryCwd(path11);
  if (claudeCwd) {
    return basename2(claudeCwd) || claudeCwd;
  }
  const parent = basename2(dirname(path11));
  return parent || basename2(path11) || "History Session";
}
function normalizeTimestamp(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value < 1000000000000 ? value * 1000 : value;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric < 1000000000000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
function extractRecordTimestamp(record) {
  const candidates = [
    record.timestamp,
    record.createdAt,
    record.created_at,
    record.updatedAt,
    record.updated_at,
    record.time,
    record.ts
  ];
  for (const candidate of candidates) {
    const normalized = normalizeTimestamp(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}
function stringifyUnknown(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function maybeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
function maybeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function renderToolResultContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const text = content.map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      const item = entry;
      if (typeof item.text === "string") {
        return item.text;
      }
      if (typeof item.content === "string") {
        return item.content;
      }
      return stringifyUnknown(entry);
    }).filter(Boolean).join(`
`);
    return text || stringifyUnknown(content);
  }
  return stringifyUnknown(content);
}
function extractQuestionOptions(firstQuestion) {
  const options = Array.isArray(firstQuestion.options) ? firstQuestion.options : [];
  return options.map((option) => {
    if (typeof option === "string") {
      return { label: option };
    }
    const record = option;
    return {
      label: typeof record.label === "string" ? record.label : String(option),
      description: typeof record.description === "string" ? record.description : undefined
    };
  });
}
function parseQuestionAnswer(content) {
  const text = renderToolResultContent(content).trim();
  if (!text) {
    return [];
  }
  return text.split(/\s*,\s*/u).map((part) => part.trim()).filter(Boolean);
}
function inferHistoryAdapterType(path11, adapterType) {
  const normalizedAdapter = adapterType?.trim();
  if (normalizedAdapter === "claude-code") {
    return "claude-code";
  }
  if (normalizedAdapter === "codex") {
    return "codex";
  }
  const normalizedPath = path11.toLowerCase();
  if (normalizedPath.includes("/.claude/projects/")) {
    return "claude-code";
  }
  if (normalizedPath.includes("/.codex/") || normalizedPath.includes("/.openai-codex/")) {
    return "codex";
  }
  return "unknown";
}
function supportsHistorySessionSnapshot(adapterType) {
  return inferHistoryAdapterType("", adapterType ?? undefined) === "claude-code" || adapterType === "claude-code";
}
function buildBaseHistorySession(input, adapterType) {
  const cwd = input.cwd?.trim() || inferClaudeHistoryCwd(input.path) || undefined;
  return {
    id: input.sessionId?.trim() || `history:${input.path}`,
    name: input.name?.trim() || deriveHistoryName(input.path),
    adapterType,
    status: "idle",
    ...cwd ? { cwd } : {},
    providerMeta: {
      historyPath: input.path,
      historyAdapterType: adapterType,
      source: "external_history"
    }
  };
}

class ClaudeCodeHistoryParser {
  session;
  baseTimestampMs;
  events = [];
  currentTurn = null;
  turnCounter = 0;
  blockIndex = 0;
  toolBlockMap = new Map;
  questionBlockMap = new Map;
  blockById = new Map;
  activeStreamBlocks = new Map;
  sawStreamTextThisTurn = false;
  assistantUsageByMessageId = new Map;
  constructor(session, baseTimestampMs) {
    this.session = session;
    this.baseTimestampMs = baseTimestampMs;
  }
  parse(content) {
    const lines = content.split(/\r?\n/u);
    let parsedLineCount = 0;
    let skippedLineCount = 0;
    let lineCount = 0;
    let lastCapturedAt = this.baseTimestampMs;
    for (let index = 0;index < lines.length; index += 1) {
      const rawLine = lines[index];
      const trimmed = rawLine.trim();
      if (!trimmed) {
        continue;
      }
      lineCount += 1;
      let record;
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          skippedLineCount += 1;
          continue;
        }
        record = parsed;
      } catch {
        skippedLineCount += 1;
        continue;
      }
      const capturedAt = extractRecordTimestamp(record) ?? this.baseTimestampMs + index;
      lastCapturedAt = capturedAt;
      if (this.handleRecord(record, capturedAt)) {
        parsedLineCount += 1;
      } else {
        skippedLineCount += 1;
      }
    }
    if (this.persistObserveUsageMetadata()) {
      this.emitEvent(lastCapturedAt, {
        event: "session:update",
        session: { ...this.session }
      });
    }
    return {
      events: this.events,
      lineCount,
      parsedLineCount,
      skippedLineCount
    };
  }
  handleRecord(record, capturedAt) {
    this.captureRecordMetadata(record);
    const type = typeof record.type === "string" ? record.type : null;
    if (!type) {
      return false;
    }
    switch (type) {
      case "system":
        this.handleSystem(record, capturedAt);
        return true;
      case "user":
        this.handleUser(record, capturedAt);
        return true;
      case "assistant":
        this.handleAssistant(record, capturedAt);
        return true;
      case "tool_use":
        this.handleToolUse(record, capturedAt);
        return true;
      case "tool_result":
        this.handleToolResult(record, capturedAt);
        return true;
      case "stream_event":
        this.handleStreamEvent(record, capturedAt);
        return true;
      case "result":
        this.handleResult(record, capturedAt);
        return true;
      case "error":
        this.handleError(record, capturedAt);
        return true;
      default:
        return false;
    }
  }
  captureRecordMetadata(record) {
    const runtime = this.ensureObserveMetaRecord("observeRuntime");
    this.assignObserveString(runtime, "entrypoint", record.entrypoint);
    this.assignObserveString(runtime, "cliVersion", record.version);
    this.assignObserveString(runtime, "gitBranch", record.gitBranch);
    this.assignObserveString(runtime, "permissionMode", record.permissionMode);
    this.assignObserveString(runtime, "userType", record.userType);
    const recordCwd = maybeString(record.cwd);
    if (recordCwd && !this.session.cwd) {
      this.session.cwd = recordCwd;
    }
    const message = isRecord(record.message) ? record.message : null;
    const model = maybeString(message?.model);
    if (model && !this.session.model) {
      this.session.model = model;
    }
    const usage = this.readClaudeUsageEntry(record);
    if (!usage) {
      return;
    }
    const messageId = maybeString(message?.id) ?? maybeString(record.requestId) ?? maybeString(record.uuid);
    if (!messageId) {
      return;
    }
    this.assistantUsageByMessageId.set(messageId, usage);
  }
  readClaudeUsageEntry(record) {
    const type = maybeString(record.type);
    const message = isRecord(record.message) ? record.message : null;
    const role = maybeString(message?.role);
    if (type !== "assistant" && role !== "assistant") {
      return null;
    }
    const usage = isRecord(message?.usage) ? message.usage : null;
    const serverToolUse = isRecord(usage?.server_tool_use) ? usage.server_tool_use : null;
    const entry = {
      inputTokens: maybeNumber(usage?.input_tokens) ?? 0,
      outputTokens: maybeNumber(usage?.output_tokens) ?? 0,
      cacheReadInputTokens: maybeNumber(usage?.cache_read_input_tokens) ?? 0,
      cacheCreationInputTokens: maybeNumber(usage?.cache_creation_input_tokens) ?? 0,
      webSearchRequests: maybeNumber(serverToolUse?.web_search_requests) ?? 0,
      webFetchRequests: maybeNumber(serverToolUse?.web_fetch_requests) ?? 0,
      ...maybeString(message?.service_tier) ? { serviceTier: maybeString(message?.service_tier) } : {},
      ...maybeString(message?.speed) ? { speed: maybeString(message?.speed) } : {}
    };
    const hasUsage = entry.inputTokens > 0 || entry.outputTokens > 0 || entry.cacheReadInputTokens > 0 || entry.cacheCreationInputTokens > 0 || entry.webSearchRequests > 0 || entry.webFetchRequests > 0 || Boolean(entry.serviceTier) || Boolean(entry.speed);
    return hasUsage ? entry : null;
  }
  persistObserveUsageMetadata() {
    if (this.assistantUsageByMessageId.size === 0) {
      return false;
    }
    const usage = this.ensureObserveMetaRecord("observeUsage");
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let webSearchRequests = 0;
    let webFetchRequests = 0;
    let serviceTier;
    let speed;
    for (const entry of this.assistantUsageByMessageId.values()) {
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
      cacheReadInputTokens += entry.cacheReadInputTokens;
      cacheCreationInputTokens += entry.cacheCreationInputTokens;
      webSearchRequests += entry.webSearchRequests;
      webFetchRequests += entry.webFetchRequests;
      if (entry.serviceTier) {
        serviceTier = entry.serviceTier;
      }
      if (entry.speed) {
        speed = entry.speed;
      }
    }
    let changed = false;
    const assignNumber = (key, value) => {
      if (usage[key] !== value) {
        usage[key] = value;
        changed = true;
      }
    };
    const assignString = (key, value) => {
      if (usage[key] !== value) {
        usage[key] = value;
        changed = true;
      }
    };
    assignNumber("assistantMessages", this.assistantUsageByMessageId.size);
    if (inputTokens > 0)
      assignNumber("inputTokens", inputTokens);
    if (outputTokens > 0)
      assignNumber("outputTokens", outputTokens);
    if (cacheReadInputTokens > 0)
      assignNumber("cacheReadInputTokens", cacheReadInputTokens);
    if (cacheCreationInputTokens > 0)
      assignNumber("cacheCreationInputTokens", cacheCreationInputTokens);
    if (webSearchRequests > 0)
      assignNumber("webSearchRequests", webSearchRequests);
    if (webFetchRequests > 0)
      assignNumber("webFetchRequests", webFetchRequests);
    if (serviceTier)
      assignString("serviceTier", serviceTier);
    if (speed)
      assignString("speed", speed);
    return changed;
  }
  ensureObserveMetaRecord(key) {
    const providerMeta = isRecord(this.session.providerMeta) ? this.session.providerMeta : {};
    this.session.providerMeta = providerMeta;
    const existing = providerMeta[key];
    if (isRecord(existing)) {
      return existing;
    }
    const next = {};
    providerMeta[key] = next;
    return next;
  }
  assignObserveString(target, key, value) {
    const next = maybeString(value);
    if (next) {
      target[key] = next;
    }
  }
  handleSystem(record, capturedAt) {
    if (record.subtype !== "init") {
      return;
    }
    let changed = false;
    const externalSessionId = typeof record.session_id === "string" ? record.session_id : typeof record.sessionId === "string" ? record.sessionId : null;
    if (externalSessionId) {
      const providerMeta = { ...this.session.providerMeta ?? {} };
      if (providerMeta.externalSessionId !== externalSessionId) {
        providerMeta.externalSessionId = externalSessionId;
        this.session.providerMeta = providerMeta;
        changed = true;
      }
    }
    if (typeof record.cwd === "string" && record.cwd.trim() && this.session.cwd !== record.cwd) {
      this.session.cwd = record.cwd;
      changed = true;
    }
    if (typeof record.model === "string" && record.model.trim() && this.session.model !== record.model) {
      this.session.model = record.model;
      changed = true;
    }
    if (changed) {
      this.emitEvent(capturedAt, {
        event: "session:update",
        session: { ...this.session }
      });
    }
  }
  handleUser(record, capturedAt) {
    const message = record.message && typeof record.message === "object" ? record.message : null;
    const content = message?.content;
    if (Array.isArray(content) && content.length > 0) {
      const toolResults = content.filter((entry) => {
        return !!entry && typeof entry === "object" && !Array.isArray(entry) && entry.type === "tool_result";
      });
      if (toolResults.length === content.length) {
        for (const toolResult of toolResults) {
          this.handleToolResult({
            ...toolResult,
            tool_use_id: typeof toolResult.tool_use_id === "string" ? toolResult.tool_use_id : toolResult.id,
            is_error: toolResult.is_error === true
          }, capturedAt);
        }
        return;
      }
    }
    this.startTurn(capturedAt);
  }
  handleAssistant(record, capturedAt) {
    const turn = this.ensureTurn(capturedAt);
    const content = record.message && typeof record.message === "object" ? record.message.content : record.content;
    if (!Array.isArray(content)) {
      this.maybeEndTurnFromAssistant(record, capturedAt);
      return;
    }
    const skipTextBlocks = this.sawStreamTextThisTurn;
    for (const part of content) {
      const contentPart = part;
      const contentType = typeof contentPart.type === "string" ? contentPart.type : "";
      if (contentType === "thinking" || contentType === "reasoning") {
        if (skipTextBlocks) {
          continue;
        }
        const block = this.startBlock(turn, capturedAt, {
          type: "reasoning",
          text: typeof contentPart.thinking === "string" ? contentPart.thinking : typeof contentPart.text === "string" ? contentPart.text : "",
          status: "completed"
        });
        this.emitBlockEnd(capturedAt, turn, block, "completed");
      } else if (contentType === "text") {
        if (skipTextBlocks) {
          continue;
        }
        const block = this.startBlock(turn, capturedAt, {
          type: "text",
          text: typeof contentPart.text === "string" ? contentPart.text : "",
          status: "completed"
        });
        this.emitBlockEnd(capturedAt, turn, block, "completed");
      } else if (contentType === "tool_use") {
        this.handleToolUse(contentPart, capturedAt);
      }
    }
    this.maybeEndTurnFromAssistant(record, capturedAt);
  }
  handleStreamEvent(record, capturedAt) {
    const turn = this.ensureTurn(capturedAt);
    const streamEvent = record.event;
    if (!streamEvent || typeof streamEvent !== "object") {
      return;
    }
    const eventRecord = streamEvent;
    const streamType = typeof eventRecord.type === "string" ? eventRecord.type : "";
    if (streamType === "message_start") {
      this.activeStreamBlocks.clear();
      this.sawStreamTextThisTurn = false;
      return;
    }
    if (streamType === "content_block_start") {
      const index = typeof eventRecord.index === "number" ? eventRecord.index : 0;
      const contentBlock = eventRecord.content_block;
      if (!contentBlock || typeof contentBlock !== "object") {
        return;
      }
      const contentRecord = contentBlock;
      const contentType = typeof contentRecord.type === "string" ? contentRecord.type : "";
      if (contentType !== "text" && contentType !== "thinking") {
        return;
      }
      const block = this.startBlock(turn, capturedAt, {
        type: contentType === "thinking" ? "reasoning" : "text",
        text: "",
        status: "streaming"
      });
      this.activeStreamBlocks.set(index, block);
      this.sawStreamTextThisTurn = true;
      const initialText = contentType === "thinking" ? typeof contentRecord.thinking === "string" ? contentRecord.thinking : "" : typeof contentRecord.text === "string" ? contentRecord.text : "";
      this.appendTextDelta(capturedAt, turn, block, initialText);
      return;
    }
    if (streamType === "content_block_delta") {
      const index = typeof eventRecord.index === "number" ? eventRecord.index : 0;
      const block = this.activeStreamBlocks.get(index);
      const delta = eventRecord.delta;
      if (!block || !delta || typeof delta !== "object") {
        return;
      }
      const deltaRecord = delta;
      const deltaType = typeof deltaRecord.type === "string" ? deltaRecord.type : "";
      if (deltaType === "text_delta") {
        this.appendTextDelta(capturedAt, turn, block, typeof deltaRecord.text === "string" ? deltaRecord.text : "");
        return;
      }
      if (deltaType === "thinking_delta") {
        this.appendTextDelta(capturedAt, turn, block, typeof deltaRecord.thinking === "string" ? deltaRecord.thinking : "");
      }
      return;
    }
    if (streamType === "content_block_stop") {
      const index = typeof eventRecord.index === "number" ? eventRecord.index : 0;
      const block = this.activeStreamBlocks.get(index);
      if (!block) {
        return;
      }
      this.emitBlockEnd(capturedAt, turn, block, "completed");
      this.activeStreamBlocks.delete(index);
    }
  }
  handleToolUse(record, capturedAt) {
    const turn = this.ensureTurn(capturedAt);
    const toolName = typeof record.tool_name === "string" ? record.tool_name : typeof record.name === "string" ? record.name : "unknown";
    const toolCallId = typeof record.tool_use_id === "string" ? record.tool_use_id : typeof record.id === "string" ? record.id : `${turn.id}:tool:${this.blockIndex}`;
    if (toolName === "AskUserQuestion") {
      const input = record.input && typeof record.input === "object" ? record.input : {};
      const questions = Array.isArray(input.questions) ? input.questions : [];
      const firstQuestion = questions[0] ?? {};
      const block2 = this.startBlock(turn, capturedAt, {
        id: `${turn.id}:question:${toolCallId}`,
        type: "question",
        header: typeof firstQuestion.header === "string" ? firstQuestion.header : undefined,
        question: typeof firstQuestion.question === "string" ? firstQuestion.question : "",
        options: extractQuestionOptions(firstQuestion),
        multiSelect: firstQuestion.multiSelect === true,
        questionStatus: "awaiting_answer",
        answer: undefined,
        status: "streaming"
      });
      this.toolBlockMap.set(toolCallId, block2.id);
      this.questionBlockMap.set(toolCallId, block2.id);
      return;
    }
    let action;
    if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") {
      const input = record.input && typeof record.input === "object" ? record.input : {};
      action = {
        kind: "file_change",
        path: typeof input.file_path === "string" ? input.file_path : typeof input.path === "string" ? input.path : "",
        diff: "",
        status: "running",
        output: ""
      };
    } else if (toolName === "Bash") {
      const input = record.input && typeof record.input === "object" ? record.input : {};
      action = {
        kind: "command",
        command: typeof input.command === "string" ? input.command : "",
        status: "running",
        output: ""
      };
    } else if (toolName === "Agent") {
      const input = record.input && typeof record.input === "object" ? record.input : {};
      action = {
        kind: "subagent",
        agentId: toolCallId,
        agentName: typeof input.description === "string" ? input.description : undefined,
        prompt: typeof input.prompt === "string" ? input.prompt : undefined,
        status: "running",
        output: ""
      };
    } else {
      action = {
        kind: "tool_call",
        toolName,
        toolCallId,
        input: record.input,
        status: "running",
        output: ""
      };
    }
    const block = this.startBlock(turn, capturedAt, {
      id: `${turn.id}:action:${toolCallId}`,
      type: "action",
      action,
      status: "streaming"
    });
    this.toolBlockMap.set(toolCallId, block.id);
  }
  handleToolResult(record, capturedAt) {
    const turn = this.ensureTurn(capturedAt);
    const toolCallId = typeof record.tool_use_id === "string" ? record.tool_use_id : typeof record.id === "string" ? record.id : "";
    if (!toolCallId) {
      return;
    }
    const questionBlockId = this.questionBlockMap.get(toolCallId);
    if (questionBlockId) {
      const answer = parseQuestionAnswer(record.content);
      this.emitEvent(capturedAt, {
        event: "block:question:answer",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: questionBlockId,
        questionStatus: "answered",
        ...answer.length > 0 ? { answer } : {}
      });
      const block2 = this.blockById.get(questionBlockId);
      if (block2) {
        this.emitBlockEnd(capturedAt, turn, block2, "completed");
      }
      this.questionBlockMap.delete(toolCallId);
      this.toolBlockMap.delete(toolCallId);
      return;
    }
    const blockId = this.toolBlockMap.get(toolCallId);
    if (!blockId) {
      return;
    }
    const output = renderToolResultContent(record.content);
    if (output) {
      this.emitEvent(capturedAt, {
        event: "block:action:output",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId,
        output
      });
    }
    const status = record.is_error === true ? "failed" : "completed";
    this.emitEvent(capturedAt, {
      event: "block:action:status",
      sessionId: this.session.id,
      turnId: turn.id,
      blockId,
      status
    });
    const block = this.blockById.get(blockId);
    if (block) {
      this.emitBlockEnd(capturedAt, turn, block, status === "failed" ? "failed" : "completed");
    }
    this.toolBlockMap.delete(toolCallId);
  }
  handleResult(record, capturedAt) {
    const turn = this.currentTurn;
    if (!turn) {
      return;
    }
    this.completeOpenStreamBlocks(capturedAt, turn);
    const denials = Array.isArray(record.permission_denials) ? record.permission_denials : [];
    for (const denial of denials) {
      const denialRecord = denial;
      if (denialRecord.tool_name !== "AskUserQuestion") {
        continue;
      }
      const input = denialRecord.tool_input && typeof denialRecord.tool_input === "object" ? denialRecord.tool_input : {};
      const questions = Array.isArray(input.questions) ? input.questions : [];
      const firstQuestion = questions[0] ?? {};
      const block = this.startBlock(turn, capturedAt, {
        type: "question",
        header: typeof firstQuestion.header === "string" ? firstQuestion.header : undefined,
        question: typeof firstQuestion.question === "string" ? firstQuestion.question : "",
        options: extractQuestionOptions(firstQuestion),
        multiSelect: firstQuestion.multiSelect === true,
        questionStatus: "denied",
        status: "completed"
      });
      this.emitBlockEnd(capturedAt, turn, block, "completed");
    }
    this.endTurn(record.subtype === "error" ? "failed" : "completed", capturedAt);
  }
  handleError(record, capturedAt) {
    const turn = this.ensureTurn(capturedAt);
    const error = record.error && typeof record.error === "object" ? record.error : {};
    const message = typeof error.message === "string" ? error.message : typeof record.message === "string" ? record.message : "Unknown error";
    this.emitError(turn, capturedAt, message);
    this.endTurn("failed", capturedAt);
  }
  maybeEndTurnFromAssistant(record, capturedAt) {
    const stopReason = record.message && typeof record.message === "object" ? record.message.stop_reason : record.stop_reason;
    if (stopReason === "end_turn") {
      this.endTurn("completed", capturedAt);
    }
  }
  startTurn(capturedAt) {
    if (this.currentTurn) {
      this.endTurn("stopped", capturedAt);
    }
    this.turnCounter += 1;
    this.blockIndex = 0;
    this.toolBlockMap.clear();
    this.questionBlockMap.clear();
    this.blockById.clear();
    this.activeStreamBlocks.clear();
    this.sawStreamTextThisTurn = false;
    this.session.status = "active";
    this.emitEvent(capturedAt, {
      event: "session:update",
      session: { ...this.session }
    });
    const turn = {
      id: `history-turn-${this.turnCounter}`,
      sessionId: this.session.id,
      status: "started",
      startedAt: new Date(capturedAt).toISOString(),
      blocks: []
    };
    this.currentTurn = turn;
    this.emitEvent(capturedAt, {
      event: "turn:start",
      sessionId: this.session.id,
      turn
    });
    return turn;
  }
  ensureTurn(capturedAt) {
    return this.currentTurn ?? this.startTurn(capturedAt);
  }
  endTurn(status, capturedAt) {
    const turn = this.currentTurn;
    if (!turn) {
      return;
    }
    turn.status = status;
    turn.endedAt = new Date(capturedAt).toISOString();
    this.emitEvent(capturedAt, {
      event: "turn:end",
      sessionId: this.session.id,
      turnId: turn.id,
      status
    });
    this.currentTurn = null;
    this.toolBlockMap.clear();
    this.questionBlockMap.clear();
    this.blockById.clear();
    this.activeStreamBlocks.clear();
    this.sawStreamTextThisTurn = false;
    this.session.status = "idle";
    this.emitEvent(capturedAt, {
      event: "session:update",
      session: { ...this.session }
    });
  }
  startBlock(turn, capturedAt, partial) {
    const block = {
      ...partial,
      id: partial.id || `${turn.id}:block:${this.blockIndex}`,
      turnId: turn.id,
      index: this.blockIndex
    };
    this.blockIndex += 1;
    turn.blocks.push(block);
    this.blockById.set(block.id, block);
    this.emitEvent(capturedAt, {
      event: "block:start",
      sessionId: this.session.id,
      turnId: turn.id,
      block
    });
    return block;
  }
  appendTextDelta(capturedAt, turn, block, text) {
    if (!text) {
      return;
    }
    block.text += text;
    block.status = "streaming";
    this.emitEvent(capturedAt, {
      event: "block:delta",
      sessionId: this.session.id,
      turnId: turn.id,
      blockId: block.id,
      text
    });
  }
  emitBlockEnd(capturedAt, turn, block, status) {
    block.status = status;
    this.emitEvent(capturedAt, {
      event: "block:end",
      sessionId: this.session.id,
      turnId: turn.id,
      blockId: block.id,
      status
    });
  }
  completeOpenStreamBlocks(capturedAt, turn) {
    for (const block of this.activeStreamBlocks.values()) {
      this.emitBlockEnd(capturedAt, turn, block, "completed");
    }
    this.activeStreamBlocks.clear();
  }
  emitError(turn, capturedAt, message) {
    const block = this.startBlock(turn, capturedAt, {
      type: "error",
      message,
      status: "completed"
    });
    this.emitBlockEnd(capturedAt, turn, block, "completed");
  }
  emitEvent(capturedAt, event) {
    this.events.push({
      capturedAt,
      event: structuredClone(event)
    });
  }
}
function inferHistorySessionAdapterType(path11, adapterType) {
  return inferHistoryAdapterType(path11, adapterType);
}
function supportsHistorySessionSnapshotForPath(path11, adapterType) {
  return inferHistoryAdapterType(path11, adapterType) === "claude-code";
}
function createHistorySessionSnapshot(input) {
  const adapterType = inferHistoryAdapterType(input.path, input.adapterType);
  if (adapterType !== "claude-code") {
    throw new Error(`History snapshot is not supported for adapter type "${adapterType}".`);
  }
  const session = buildBaseHistorySession(input, adapterType);
  const baseTimestampMs = normalizeTimestamp(input.baseTimestampMs) ?? Date.now();
  const parser = new ClaudeCodeHistoryParser(session, baseTimestampMs);
  const replay = parser.parse(input.content);
  const tracker = new StateTracker;
  tracker.createSession(session.id, session);
  for (const entry of replay.events) {
    tracker.trackEvent(session.id, entry.event, entry.capturedAt);
  }
  const snapshot = tracker.getSessionState(session.id);
  if (!snapshot) {
    throw new Error("Failed to reconstruct session snapshot from history.");
  }
  return {
    adapterType,
    lineCount: replay.lineCount,
    parsedLineCount: replay.parsedLineCount,
    skippedLineCount: replay.skippedLineCount,
    events: replay.events,
    snapshot
  };
}
var init_history2 = () => {};

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/adapters/claude-code.ts
import { existsSync as existsSync11, readdirSync as readdirSync3, statSync as statSync3 } from "fs";
import { homedir as homedir3 } from "os";
import { join as join9 } from "path";
function resolveClaudeResumeContext(config) {
  const rawResumeId = config.options?.["resume"];
  const resumeId = typeof rawResumeId === "string" ? rawResumeId.trim().replace(/\.jsonl$/u, "") : "";
  if (!resumeId) {
    return null;
  }
  const projectsRoot = join9(homedir3(), ".claude", "projects");
  if (!existsSync11(projectsRoot)) {
    return null;
  }
  let projectSlugs;
  try {
    projectSlugs = readdirSync3(projectsRoot);
  } catch {
    return null;
  }
  for (const slug of projectSlugs) {
    const sessionPath = join9(projectsRoot, slug, `${resumeId}.jsonl`);
    if (!existsSync11(sessionPath)) {
      continue;
    }
    const cwd = decodeClaudeProjectsSlug2(slug);
    if (!cwd) {
      continue;
    }
    try {
      if (!statSync3(cwd).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    return {
      cwd,
      resumeId,
      sessionPath
    };
  }
  return null;
}
function decodeClaudeProjectsSlug2(slug) {
  if (!slug.startsWith("-")) {
    return null;
  }
  const tail = slug.slice(1);
  if (!tail) {
    return null;
  }
  return `/${tail.replace(/-/g, "/")}`;
}
var ClaudeCodeAdapter, createAdapter = (config) => new ClaudeCodeAdapter(config);
var init_claude_code = __esm(() => {
  ClaudeCodeAdapter = class ClaudeCodeAdapter extends BaseAdapter {
    type = "claude-code";
    process = null;
    currentTurn = null;
    blockIndex = 0;
    claudeSessionId = null;
    toolBlockMap = new Map;
    questionBlockMap = new Map;
    pendingAnswers = new Map;
    activeStreamBlocks = new Map;
    sawStreamTextThisTurn = false;
    constructor(config) {
      const resumeContext = resolveClaudeResumeContext(config);
      const resolvedConfig = resumeContext ? {
        ...config,
        cwd: resumeContext.cwd,
        options: {
          ...config.options,
          resume: resumeContext.resumeId
        }
      } : config;
      super(resolvedConfig);
      if (resumeContext) {
        this.session.providerMeta = {
          ...this.session.providerMeta ?? {},
          resumeSessionPath: resumeContext.sessionPath,
          resumeProjectCwd: resumeContext.cwd
        };
      }
    }
    async start() {
      const args = [
        "--print",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--include-partial-messages"
      ];
      const model = this.config.options?.["model"];
      if (model) {
        args.push("--model", model);
      }
      const resumeId = this.config.options?.["resume"];
      if (resumeId) {
        args.push("--resume", resumeId);
      }
      this.process = Bun.spawn(["claude", ...args], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe"
      });
      this.readStdout();
      this.process.exited.then((code) => {
        if (code !== 0 && this.session.status !== "closed") {
          this.emit("error", new Error(`claude exited with code ${code}`));
          this.setStatus("error");
        }
      });
      this.setStatus("active");
    }
    send(prompt) {
      if (!this.process?.stdin || typeof this.process.stdin === "number") {
        this.emit("error", new Error("Claude Code process not running"));
        return;
      }
      this.blockIndex = 0;
      this.toolBlockMap.clear();
      this.activeStreamBlocks.clear();
      this.sawStreamTextThisTurn = false;
      const turn = {
        id: crypto.randomUUID(),
        sessionId: this.session.id,
        status: "started",
        startedAt: new Date().toISOString(),
        blocks: []
      };
      this.currentTurn = turn;
      this.emit("event", { event: "turn:start", sessionId: this.session.id, turn });
      let content = prompt.text;
      if (prompt.images?.length || prompt.files?.length) {
        const parts = [];
        parts.push({ type: "text", text: prompt.text });
        if (prompt.images?.length) {
          for (const img of prompt.images) {
            parts.push({
              type: "image",
              source: { type: "base64", media_type: img.mimeType, data: img.data }
            });
          }
        }
        if (prompt.files?.length) {
          parts.push({ type: "text", text: `

Referenced files: ${prompt.files.join(", ")}` });
        }
        content = parts;
      }
      const msg = JSON.stringify({
        type: "user",
        session_id: this.claudeSessionId ?? "",
        message: { role: "user", content },
        parent_tool_use_id: null
      }) + `
`;
      this.process.stdin.write(msg);
      this.process.stdin.flush();
    }
    interrupt() {
      if (this.process && !this.process.killed) {
        this.process.kill("SIGINT");
      }
      if (this.currentTurn) {
        this.endTurn(this.currentTurn, "stopped");
      }
    }
    async shutdown() {
      if (this.process && !this.process.killed) {
        this.process.kill();
      }
      this.process = null;
      this.setStatus("closed");
    }
    async readStdout() {
      const stdout = this.process?.stdout;
      if (!stdout || typeof stdout === "number")
        return;
      const reader = stdout.getReader();
      const decoder = new TextDecoder;
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(`
`);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
              continue;
            try {
              this.handleEvent(JSON.parse(trimmed));
            } catch {}
          }
        }
      } catch {}
      if (this.currentTurn && this.currentTurn.status !== "stopped") {
        this.endTurn(this.currentTurn, "completed");
      }
    }
    handleEvent(event) {
      switch (event.type) {
        case "system": {
          if (event.subtype === "init") {
            const sid = event.session_id ?? event.sessionId;
            if (sid)
              this.claudeSessionId = sid;
            if (typeof event.cwd === "string" && event.cwd.trim()) {
              this.session.cwd = event.cwd;
            }
            if (typeof event.model === "string" && event.model.trim()) {
              this.session.model = event.model;
            }
            this.emit("event", { event: "session:update", session: { ...this.session } });
          }
          break;
        }
        case "assistant": {
          this.handleAssistant(event);
          break;
        }
        case "tool_use": {
          this.handleToolUse(event);
          break;
        }
        case "tool_result": {
          this.handleToolResult(event);
          break;
        }
        case "stream_event": {
          this.handleStreamEvent(event);
          break;
        }
        case "result": {
          this.completeOpenStreamBlocks();
          const denials = Array.isArray(event.permission_denials) ? event.permission_denials : [];
          for (const denial of denials) {
            if (denial.tool_name === "AskUserQuestion" && this.currentTurn) {
              const input = denial.tool_input ?? {};
              const questions = Array.isArray(input.questions) ? input.questions : [];
              const first = questions[0] ?? {};
              const options = Array.isArray(first.options) ? first.options.map((o) => ({ label: o.label ?? String(o), description: o.description })) : [];
              const block = this.startBlock(this.currentTurn, {
                type: "question",
                header: first.header,
                question: first.question ?? "",
                options,
                multiSelect: first.multiSelect ?? false,
                questionStatus: "denied",
                status: "completed"
              });
              this.emitBlockEnd(this.currentTurn, block, "completed");
            }
          }
          if (this.currentTurn && this.currentTurn.status !== "stopped") {
            this.endTurn(this.currentTurn, event.subtype === "error" ? "failed" : "completed");
          }
          break;
        }
        case "error": {
          if (this.currentTurn) {
            this.emitError(this.currentTurn, event.error?.message ?? event.message ?? "Unknown error");
            this.endTurn(this.currentTurn, "failed");
          }
          break;
        }
      }
    }
    handleAssistant(event) {
      if (!this.currentTurn)
        return;
      if (this.sawStreamTextThisTurn)
        return;
      const content = event.message?.content ?? event.content;
      if (!Array.isArray(content))
        return;
      for (const part of content) {
        if (part.type === "thinking" || part.type === "reasoning") {
          const block = this.startBlock(this.currentTurn, {
            type: "reasoning",
            text: part.thinking ?? part.text ?? "",
            status: "completed"
          });
          this.emitBlockEnd(this.currentTurn, block, "completed");
        } else if (part.type === "text") {
          const block = this.startBlock(this.currentTurn, {
            type: "text",
            text: part.text ?? "",
            status: "completed"
          });
          this.emitBlockEnd(this.currentTurn, block, "completed");
        }
      }
    }
    handleStreamEvent(event) {
      if (!this.currentTurn)
        return;
      const streamEvent = event.event;
      if (!streamEvent || typeof streamEvent !== "object")
        return;
      const streamType = typeof streamEvent.type === "string" ? streamEvent.type : "";
      if (streamType === "message_start") {
        this.activeStreamBlocks.clear();
        this.sawStreamTextThisTurn = false;
        return;
      }
      if (streamType === "content_block_start") {
        const index = typeof streamEvent.index === "number" ? streamEvent.index : 0;
        const contentBlock = streamEvent.content_block;
        if (!contentBlock || typeof contentBlock !== "object")
          return;
        const contentType = typeof contentBlock.type === "string" ? contentBlock.type : "";
        if (contentType !== "text" && contentType !== "thinking") {
          return;
        }
        const block = this.startBlock(this.currentTurn, {
          type: contentType === "thinking" ? "reasoning" : "text",
          text: "",
          status: "streaming"
        });
        this.activeStreamBlocks.set(index, block);
        this.sawStreamTextThisTurn = true;
        const initialText = contentType === "thinking" ? typeof contentBlock.thinking === "string" ? contentBlock.thinking : "" : typeof contentBlock.text === "string" ? contentBlock.text : "";
        this.appendTextDelta(block, initialText);
        return;
      }
      if (streamType === "content_block_delta") {
        const index = typeof streamEvent.index === "number" ? streamEvent.index : 0;
        const block = this.activeStreamBlocks.get(index);
        const delta = streamEvent.delta;
        if (!block || !delta || typeof delta !== "object")
          return;
        const deltaType = typeof delta.type === "string" ? delta.type : "";
        if (deltaType === "text_delta") {
          this.appendTextDelta(block, typeof delta.text === "string" ? delta.text : "");
          return;
        }
        if (deltaType === "thinking_delta") {
          this.appendTextDelta(block, typeof delta.thinking === "string" ? delta.thinking : "");
        }
        return;
      }
      if (streamType === "content_block_stop") {
        const index = typeof streamEvent.index === "number" ? streamEvent.index : 0;
        const block = this.activeStreamBlocks.get(index);
        if (!block || !this.currentTurn)
          return;
        this.emitBlockEnd(this.currentTurn, block, "completed");
        this.activeStreamBlocks.delete(index);
      }
    }
    handleToolUse(event) {
      if (!this.currentTurn)
        return;
      const toolName = event.tool_name ?? event.name ?? "unknown";
      const toolCallId = event.tool_use_id ?? event.id ?? crypto.randomUUID();
      let action;
      if (toolName === "AskUserQuestion") {
        const input = event.input ?? {};
        const questions = Array.isArray(input.questions) ? input.questions : [];
        const first = questions[0] ?? {};
        const options = Array.isArray(first.options) ? first.options.map((o) => ({ label: o.label ?? String(o), description: o.description })) : [];
        const block2 = this.startBlock(this.currentTurn, {
          type: "question",
          header: first.header,
          question: first.question ?? "",
          options,
          multiSelect: first.multiSelect ?? false,
          questionStatus: "awaiting_answer",
          answer: undefined,
          status: "streaming"
        });
        this.toolBlockMap.set(toolCallId, block2.id);
        this.questionBlockMap.set(toolCallId, block2.id);
        this.awaitAndSendAnswer(block2.id, toolCallId);
        return;
      }
      if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") {
        action = {
          kind: "file_change",
          path: event.input?.file_path ?? event.input?.path ?? "",
          diff: "",
          status: "running",
          output: ""
        };
      } else if (toolName === "Bash") {
        action = {
          kind: "command",
          command: event.input?.command ?? "",
          status: "running",
          output: ""
        };
      } else if (toolName === "Agent") {
        action = {
          kind: "subagent",
          agentId: toolCallId,
          agentName: event.input?.description ?? undefined,
          prompt: event.input?.prompt ?? undefined,
          status: "running",
          output: ""
        };
      } else {
        action = {
          kind: "tool_call",
          toolName,
          toolCallId,
          input: event.input,
          status: "running",
          output: ""
        };
      }
      const block = this.startBlock(this.currentTurn, {
        type: "action",
        action,
        status: "streaming"
      });
      this.toolBlockMap.set(toolCallId, block.id);
    }
    handleToolResult(event) {
      if (!this.currentTurn)
        return;
      const toolCallId = event.tool_use_id ?? event.id ?? "";
      const blockId = this.toolBlockMap.get(toolCallId);
      if (!blockId)
        return;
      const output = typeof event.content === "string" ? event.content : JSON.stringify(event.content ?? "");
      this.emit("event", {
        event: "block:action:output",
        sessionId: this.session.id,
        turnId: this.currentTurn.id,
        blockId,
        output
      });
      const status = event.is_error ? "failed" : "completed";
      this.emit("event", {
        event: "block:action:status",
        sessionId: this.session.id,
        turnId: this.currentTurn.id,
        blockId,
        status
      });
      this.emit("event", {
        event: "block:end",
        sessionId: this.session.id,
        turnId: this.currentTurn.id,
        blockId,
        status: status === "failed" ? "failed" : "completed"
      });
    }
    answerQuestion(answer) {
      const resolve = this.pendingAnswers.get(answer.blockId);
      if (!resolve)
        return;
      this.pendingAnswers.delete(answer.blockId);
      resolve(answer.answer);
      const turn = this.currentTurn;
      if (turn) {
        this.emit("event", {
          event: "block:question:answer",
          sessionId: this.session.id,
          turnId: turn.id,
          blockId: answer.blockId,
          questionStatus: "answered",
          answer: answer.answer
        });
      }
    }
    async awaitAndSendAnswer(blockId, toolCallId) {
      const answer = await new Promise((resolve) => {
        this.pendingAnswers.set(blockId, resolve);
      });
      if (!this.process?.stdin || typeof this.process.stdin === "number")
        return;
      const response = JSON.stringify({
        type: "tool_result",
        tool_use_id: toolCallId,
        content: answer.join(", ")
      });
      this.process.stdin.write(response + `
`);
      await this.process.stdin.flush();
    }
    startBlock(turn, partial) {
      const block = {
        ...partial,
        id: crypto.randomUUID(),
        turnId: turn.id,
        index: this.blockIndex++
      };
      turn.blocks.push(block);
      this.emit("event", {
        event: "block:start",
        sessionId: this.session.id,
        turnId: turn.id,
        block
      });
      return block;
    }
    emitBlockEnd(turn, block, status) {
      this.emit("event", {
        event: "block:end",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        status
      });
    }
    emitError(turn, message) {
      const block = this.startBlock(turn, {
        type: "error",
        message,
        status: "completed"
      });
      this.emitBlockEnd(turn, block, "completed");
    }
    endTurn(turn, status) {
      turn.status = status;
      turn.endedAt = new Date().toISOString();
      this.currentTurn = null;
      this.activeStreamBlocks.clear();
      this.sawStreamTextThisTurn = false;
      this.emit("event", {
        event: "turn:end",
        sessionId: this.session.id,
        turnId: turn.id,
        status
      });
    }
    appendTextDelta(block, text) {
      if (!text || !this.currentTurn)
        return;
      block.text += text;
      this.emit("event", {
        event: "block:delta",
        sessionId: this.session.id,
        turnId: this.currentTurn.id,
        blockId: block.id,
        text
      });
    }
    completeOpenStreamBlocks() {
      if (!this.currentTurn)
        return;
      for (const block of this.activeStreamBlocks.values()) {
        this.emitBlockEnd(this.currentTurn, block, "completed");
      }
      this.activeStreamBlocks.clear();
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/codex-launch-config.ts
import { accessSync as accessSync2, constants as constants3, existsSync as existsSync12 } from "fs";
import { homedir as homedir4 } from "os";
import { basename as basename3, delimiter, dirname as dirname2, join as join10, resolve } from "path";
import { fileURLToPath } from "url";
function isExecutable(filePath) {
  if (!filePath) {
    return false;
  }
  try {
    accessSync2(filePath, constants3.X_OK);
    return true;
  } catch {
    return false;
  }
}
function uniquePaths(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0).map((value) => resolve(value)))];
}
function ancestorChain(start) {
  const chain = [];
  let current = resolve(start);
  while (true) {
    chain.push(current);
    const parent = dirname2(current);
    if (parent === current) {
      return chain;
    }
    current = parent;
  }
}
function resolveExecutableFromSearchPath(names, env2) {
  const pathEntries = (env2.PATH ?? "").split(delimiter).filter(Boolean);
  const commonDirectories = [
    join10(homedir4(), ".local", "bin"),
    join10(homedir4(), ".bun", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin"
  ];
  for (const directory of [...pathEntries, ...commonDirectories]) {
    for (const name of names) {
      const candidate = join10(directory, name);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}
function resolveBunExecutable(env2) {
  const explicitCandidates = [
    env2.OPENSCOUT_BUN_BIN,
    env2.SCOUT_BUN_BIN,
    env2.BUN_BIN
  ];
  for (const candidate of explicitCandidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  if (basename3(process.execPath).startsWith("bun") && isExecutable(process.execPath)) {
    return process.execPath;
  }
  return resolveExecutableFromSearchPath(["bun"], env2);
}
function resolveScoutExecutable(env2) {
  const explicitCandidates = [
    env2.OPENSCOUT_CLI_BIN,
    env2.SCOUT_CLI_BIN,
    env2.OPENSCOUT_SCOUT_BIN,
    env2.SCOUT_BIN
  ];
  for (const candidate of explicitCandidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return resolveExecutableFromSearchPath(["scout"], env2);
}
function resolveRepoScoutScript(currentDirectory) {
  const moduleDirectory = dirname2(fileURLToPath(import.meta.url));
  const starts = uniquePaths([currentDirectory, moduleDirectory]);
  for (const start of starts) {
    for (const candidate of ancestorChain(start)) {
      const scriptPath = join10(candidate, "apps", "desktop", "bin", "scout.ts");
      if (existsSync12(scriptPath)) {
        return scriptPath;
      }
    }
  }
  return null;
}
function resolveContextRoot(currentDirectory, env2) {
  const configured = env2.OPENSCOUT_SETUP_CWD?.trim();
  return resolve(configured || currentDirectory);
}
function resolveScoutMcpCommand(options) {
  const env2 = options.env ?? process.env;
  const contextRoot = resolveContextRoot(options.currentDirectory, env2);
  const scoutExecutable = resolveScoutExecutable(env2);
  if (scoutExecutable) {
    return {
      command: scoutExecutable,
      args: ["mcp", "--context-root", contextRoot],
      cwd: contextRoot
    };
  }
  const scoutScript = resolveRepoScoutScript(options.currentDirectory);
  const bunExecutable = resolveBunExecutable(env2);
  if (scoutScript && bunExecutable) {
    return {
      command: bunExecutable,
      args: [scoutScript, "mcp", "--context-root", contextRoot],
      cwd: contextRoot
    };
  }
  return null;
}
function buildScoutMcpCodexLaunchArgs(options) {
  const resolved = resolveScoutMcpCommand(options);
  if (!resolved) {
    return [];
  }
  return [
    "-c",
    `mcp_servers.scout.command=${JSON.stringify(resolved.command)}`,
    "-c",
    `mcp_servers.scout.args=${JSON.stringify(resolved.args)}`,
    "-c",
    `mcp_servers.scout.cwd=${JSON.stringify(resolved.cwd)}`
  ];
}
var init_codex_launch_config = () => {};

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/adapters/codex.ts
import { spawn as spawn5 } from "child_process";
import { access, appendFile, constants as constants4, mkdir, readFile, rm, writeFile } from "fs/promises";
import { delimiter as delimiter2, join as join11 } from "path";
import { homedir as homedir5 } from "os";
function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
function buildUnsupportedServerRequestError(message) {
  if (message.method === "item/tool/call") {
    const tool = typeof message.params?.tool === "string" ? message.params.tool : null;
    const toolLabel = tool ? `dynamic tool call \`${tool}\`` : "dynamic tool call";
    return {
      code: -32000,
      message: `${toolLabel} is not supported by openscout-runtime`
    };
  }
  return {
    code: -32000,
    message: `Unsupported server request: ${message.method}`
  };
}
function isResponse(message) {
  return Boolean(message && typeof message === "object" && "id" in message && (("result" in message) || ("error" in message)));
}
function isServerRequest(message) {
  return Boolean(message && typeof message === "object" && "id" in message && "method" in message && !("result" in message) && !("error" in message));
}
function isNotification(message) {
  return Boolean(message && typeof message === "object" && "method" in message && !("id" in message));
}
function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
async function readOptionalFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const trimmed = raw.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}
function stringifyValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function extractReasoningText(item) {
  const summary = Array.isArray(item.summary) ? item.summary : [];
  const content = Array.isArray(item.content) ? item.content : [];
  const summaryText = summary.map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }
    const record = entry;
    if (typeof record.text === "string") {
      return record.text;
    }
    if (typeof record.summary === "string") {
      return record.summary;
    }
    return "";
  }).filter(Boolean).join(`
`);
  const contentText = content.map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }
    const record = entry;
    return typeof record.text === "string" ? record.text : "";
  }).filter(Boolean).join(`
`);
  return [summaryText, contentText].filter(Boolean).join(`

`).trim();
}
function extractTextDelta(params) {
  if (typeof params.delta === "string") {
    return params.delta;
  }
  if (typeof params.text === "string") {
    return params.text;
  }
  const delta = params.delta;
  if (typeof delta?.text === "string") {
    return delta.text;
  }
  const content = Array.isArray(params.content) ? params.content : [];
  const first = content[0];
  if (typeof first?.text === "string") {
    return first.text;
  }
  return "";
}
function renderActionOutput(item) {
  if (typeof item.text === "string" && item.text.trim()) {
    return item.text;
  }
  if (item.action !== undefined) {
    return stringifyValue(item.action);
  }
  if (item.output !== undefined) {
    return stringifyValue(item.output);
  }
  return stringifyValue(item);
}
function isMissingCodexRolloutError(error) {
  return errorMessage(error).toLowerCase().includes("no rollout found for thread id");
}
async function isExecutable2(filePath) {
  if (!filePath) {
    return false;
  }
  try {
    await access(filePath, constants4.X_OK);
    return true;
  } catch {
    return false;
  }
}
async function resolveCodexExecutable() {
  const explicitCandidates = [
    process.env.OPENSCOUT_CODEX_BIN,
    process.env.CODEX_BIN
  ].filter(Boolean);
  for (const candidate of explicitCandidates) {
    if (await isExecutable2(candidate)) {
      return candidate;
    }
  }
  const pathEntries = (process.env.PATH ?? "").split(delimiter2).filter(Boolean);
  const commonDirectories = [
    `${process.env.HOME ?? ""}/.local/bin`,
    `${process.env.HOME ?? ""}/.bun/bin`,
    "/opt/homebrew/bin",
    "/usr/local/bin"
  ].filter(Boolean);
  for (const directory of [...pathEntries, ...commonDirectories]) {
    const candidate = join11(directory, "codex");
    if (await isExecutable2(candidate)) {
      return candidate;
    }
  }
  return "codex";
}
function threadStatusToSessionStatus(status) {
  switch (status) {
    case "active":
      return "active";
    case "idle":
      return "idle";
    case "error":
      return "error";
    default:
      return "connecting";
  }
}
var CodexAdapter, createAdapter2 = (config) => new CodexAdapter(config);
var init_codex = __esm(() => {
  init_codex_launch_config();
  CodexAdapter = class CodexAdapter extends BaseAdapter {
    type = "codex";
    process = null;
    lineBuffer = "";
    nextRequestId = 1;
    pendingRequests = new Map;
    serialized = Promise.resolve();
    starting = null;
    currentThreadId = null;
    currentThreadPath = null;
    currentTurnState = null;
    blockIndex = 0;
    constructor(config) {
      super(config);
    }
    async start() {
      await this.ensureStarted();
    }
    send(prompt) {
      this.enqueue(async () => {
        try {
          await this.ensureStarted();
          if (!this.currentThreadId) {
            throw new Error(`Codex adapter for ${this.session.name} has no active thread.`);
          }
          const input = [
            {
              type: "text",
              text: prompt.text,
              text_elements: []
            }
          ];
          if (this.currentTurnState?.turn.id) {
            await this.request("turn/steer", {
              threadId: this.currentThreadId,
              expectedTurnId: this.currentTurnState.turn.id,
              input
            });
            return;
          }
          await this.request("turn/start", {
            threadId: this.currentThreadId,
            cwd: this.codexOptions.cwd,
            input
          });
        } catch (error) {
          this.emit("error", error instanceof Error ? error : new Error(errorMessage(error)));
        }
      });
    }
    interrupt() {
      this.enqueue(async () => {
        try {
          await this.ensureStarted();
          if (!this.currentThreadId || !this.currentTurnState?.turn.id) {
            return;
          }
          await this.request("turn/interrupt", {
            threadId: this.currentThreadId,
            turnId: this.currentTurnState.turn.id
          });
        } catch (error) {
          this.emit("error", error instanceof Error ? error : new Error(errorMessage(error)));
        }
      });
    }
    async shutdown() {
      const child = this.process;
      this.process = null;
      this.starting = null;
      this.lineBuffer = "";
      const turnState = this.currentTurnState;
      this.currentTurnState = null;
      if (turnState) {
        this.closeOpenBlocks(turnState, "failed");
        this.finishTurn(turnState, "stopped");
      }
      for (const pending of this.pendingRequests.values()) {
        pending.reject(new Error(`Codex adapter for ${this.session.name} was shut down.`));
      }
      this.pendingRequests.clear();
      if (child && child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
        await new Promise((resolve2) => setTimeout(resolve2, 250));
        if (child.exitCode === null && !child.killed) {
          child.kill("SIGKILL");
        }
      }
      this.setStatus("closed");
      await this.persistState();
    }
    get codexOptions() {
      const runtimeRoot = join11(homedir5(), ".scout/pairing", "codex", this.session.id);
      const configuredThreadId = this.config.options?.["threadId"];
      const requireExistingThread = this.config.options?.["requireExistingThread"];
      const rawLaunchArgs = this.config.options?.["launchArgs"];
      const launchArgs = Array.isArray(rawLaunchArgs) ? rawLaunchArgs.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
      return {
        agentName: this.session.name,
        sessionId: this.session.id,
        cwd: this.config.cwd ?? process.cwd(),
        systemPrompt: this.systemPrompt,
        runtimeDirectory: join11(runtimeRoot, "runtime"),
        logsDirectory: join11(runtimeRoot, "logs"),
        launchArgs,
        threadId: typeof configuredThreadId === "string" && configuredThreadId.trim().length > 0 ? configuredThreadId.trim() : undefined,
        requireExistingThread: requireExistingThread ?? Boolean(configuredThreadId)
      };
    }
    get systemPrompt() {
      const raw = this.config.options?.systemPrompt;
      return typeof raw === "string" && raw.trim().length > 0 ? raw : "You are a helpful agent working through Pairing.";
    }
    get threadIdPath() {
      return join11(this.codexOptions.runtimeDirectory, "codex-thread-id.txt");
    }
    get statePath() {
      return join11(this.codexOptions.runtimeDirectory, "state.json");
    }
    get stdoutLogPath() {
      return join11(this.codexOptions.logsDirectory, "stdout.log");
    }
    get stderrLogPath() {
      return join11(this.codexOptions.logsDirectory, "stderr.log");
    }
    enqueue(task) {
      const next = this.serialized.then(task, task);
      this.serialized = next.then(() => {
        return;
      }, () => {
        return;
      });
      return next;
    }
    async ensureStarted() {
      if (this.process && !this.process.killed && this.process.exitCode === null && this.currentThreadId) {
        return;
      }
      if (this.starting) {
        return this.starting;
      }
      this.starting = this.startSession();
      try {
        await this.starting;
      } finally {
        this.starting = null;
      }
    }
    async startSession() {
      const options = this.codexOptions;
      await mkdir(options.runtimeDirectory, { recursive: true });
      await mkdir(options.logsDirectory, { recursive: true });
      await writeFile(join11(options.runtimeDirectory, "prompt.txt"), options.systemPrompt);
      const codexExecutable = await resolveCodexExecutable();
      const childEnv = {
        ...process.env,
        ...this.config.env ?? {}
      };
      const child = spawn5(codexExecutable, [
        "app-server",
        ...buildScoutMcpCodexLaunchArgs({
          currentDirectory: options.cwd,
          env: childEnv
        }),
        ...options.launchArgs
      ], {
        cwd: options.cwd,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.process = child;
      this.lineBuffer = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        appendFile(this.stdoutLogPath, chunk).catch(() => {
          return;
        });
        this.handleStdoutChunk(chunk);
      });
      child.stderr.on("data", (chunk) => {
        appendFile(this.stderrLogPath, chunk).catch(() => {
          return;
        });
      });
      child.once("error", (error) => {
        this.failSession(new Error(`Codex app-server failed for ${this.session.name}: ${errorMessage(error)}`));
      });
      child.once("exit", (code, signal) => {
        if (this.session.status === "closed") {
          return;
        }
        this.failSession(new Error(`Codex app-server exited for ${this.session.name}` + (code !== null ? ` with code ${code}` : "") + (signal ? ` (${signal})` : "")));
      });
      await this.request("initialize", {
        clientInfo: {
          name: "openscout-pairing",
          title: "OpenScout Pairing",
          version: "0.0.0"
        },
        capabilities: {
          experimentalApi: true
        }
      });
      this.notify("initialized");
      await this.resumeOrStartThread();
      this.setStatus("idle");
      await this.persistState();
    }
    async resumeOrStartThread() {
      const options = this.codexOptions;
      const requestedThreadId = options.threadId?.trim() || null;
      const storedThreadId = requestedThreadId ?? await readOptionalFile(this.threadIdPath);
      if (storedThreadId) {
        try {
          const resumed = await this.request("thread/resume", {
            threadId: storedThreadId,
            cwd: options.cwd,
            approvalPolicy: "never",
            sandbox: "danger-full-access",
            baseInstructions: options.systemPrompt,
            persistExtendedHistory: true
          });
          this.currentThreadId = resumed.thread.id;
          this.currentThreadPath = resumed.thread.path ?? null;
          this.updateSessionFromThread(resumed.thread);
          await this.persistThreadId();
          return;
        } catch (error) {
          await appendFile(this.stderrLogPath, `[openscout] failed to resume stored Codex thread ${storedThreadId}: ${errorMessage(error)}
`).catch(() => {
            return;
          });
          if (!requestedThreadId && isMissingCodexRolloutError(error)) {
            await rm(this.threadIdPath, { force: true }).catch(() => {
              return;
            });
          }
          if (requestedThreadId || options.requireExistingThread) {
            throw new Error(`Failed to resume requested Codex thread ${storedThreadId}: ${errorMessage(error)}`);
          }
        }
      }
      if (options.requireExistingThread) {
        const detail = requestedThreadId ? ` for requested thread ${requestedThreadId}` : "";
        throw new Error(`Codex adapter for ${this.session.name} requires an existing thread${detail}.`);
      }
      const started = await this.request("thread/start", {
        cwd: options.cwd,
        approvalPolicy: "never",
        sandbox: "danger-full-access",
        baseInstructions: options.systemPrompt,
        ephemeral: false,
        experimentalRawEvents: false,
        persistExtendedHistory: true
      });
      this.currentThreadId = started.thread.id;
      this.currentThreadPath = started.thread.path ?? null;
      this.updateSessionFromThread(started.thread);
      await this.persistThreadId();
    }
    handleStdoutChunk(chunk) {
      this.lineBuffer += chunk;
      while (true) {
        const newlineIndex = this.lineBuffer.indexOf(`
`);
        if (newlineIndex === -1) {
          break;
        }
        const line = this.lineBuffer.slice(0, newlineIndex).trim();
        this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }
        const message = parseJsonLine(line);
        if (!message) {
          appendFile(this.stderrLogPath, `[openscout] unparsable app-server output: ${line}
`).catch(() => {
            return;
          });
          continue;
        }
        if (isResponse(message)) {
          this.handleResponse(message);
          continue;
        }
        if (isServerRequest(message)) {
          this.handleServerRequest(message);
          continue;
        }
        if (isNotification(message)) {
          this.handleNotification(message);
        }
      }
    }
    handleResponse(message) {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      this.pendingRequests.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || `Codex app-server request failed: ${String(message.id)}`));
        return;
      }
      pending.resolve(message.result);
    }
    handleServerRequest(message) {
      this.writeMessage({
        id: message.id,
        error: buildUnsupportedServerRequestError(message)
      });
    }
    handleNotification(message) {
      const params = message.params ?? {};
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      switch (message.method) {
        case "thread/started":
        case "thread/name/updated": {
          const thread = params.thread;
          if (thread) {
            this.updateSessionFromThread(thread);
            this.persistThreadId();
          }
          return;
        }
        case "thread/status/changed": {
          const status = params.status?.type;
          this.setStatus(threadStatusToSessionStatus(typeof status === "string" ? status : undefined));
          return;
        }
        case "turn/started": {
          const turn = params.turn;
          const startedTurnId = typeof turn?.id === "string" ? turn.id : turnId;
          if (!startedTurnId) {
            return;
          }
          this.ensureTurn(startedTurnId);
          this.setStatus("active");
          return;
        }
        case "item/started":
          this.handleItemStarted(params);
          return;
        case "item/agentMessage/delta":
          this.handleAgentMessageDelta(params);
          return;
        case "item/reasoning/delta":
        case "item/reasoning/summaryTextDelta":
          this.handleReasoningDelta(params);
          return;
        case "item/fileChange/outputDelta":
        case "item/commandExecution/outputDelta":
        case "item/toolCall/outputDelta":
          this.handleActionOutputDelta(message.method, params);
          return;
        case "item/commandExecution/terminalInteraction":
          this.handleActionTerminalInteraction(params);
          return;
        case "item/completed":
          this.handleItemCompleted(params);
          return;
        case "turn/completed":
          this.handleTurnCompleted(params);
          return;
        case "error": {
          const detail = typeof params.message === "string" ? params.message : "Codex app-server reported an error.";
          this.emit("error", new Error(detail));
          return;
        }
        default:
          return;
      }
    }
    handleItemStarted(params) {
      const item = params.item;
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      const itemId = typeof item?.id === "string" ? item.id : null;
      const itemType = typeof item?.type === "string" ? item.type : null;
      if (!turnId || !item || !itemId || !itemType || itemType === "userMessage") {
        return;
      }
      const turnState = this.ensureTurn(turnId);
      switch (itemType) {
        case "agentMessage":
          this.ensureTextBlock(turnState, itemId, typeof item.text === "string" ? item.text : "");
          return;
        case "reasoning": {
          const text = extractReasoningText(item);
          if (text) {
            this.ensureReasoningBlock(turnState, itemId, text);
          }
          return;
        }
        default:
          this.ensureActionBlock(turnState, itemId, this.buildActionFromItem(item, itemId));
      }
    }
    handleAgentMessageDelta(params) {
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      const itemId = typeof params.itemId === "string" ? params.itemId : null;
      const delta = extractTextDelta(params);
      if (!turnId || !itemId || !delta) {
        return;
      }
      const turnState = this.ensureTurn(turnId);
      const block = this.ensureTextBlock(turnState, itemId);
      this.emitTextDelta(turnState.turn, block, delta);
    }
    handleReasoningDelta(params) {
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      const itemId = typeof params.itemId === "string" ? params.itemId : null;
      const delta = extractTextDelta(params);
      if (!turnId || !itemId || !delta) {
        return;
      }
      const turnState = this.ensureTurn(turnId);
      const block = this.ensureReasoningBlock(turnState, itemId);
      this.emitTextDelta(turnState.turn, block, delta);
    }
    handleActionOutputDelta(method, params) {
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      const itemId = typeof params.itemId === "string" ? params.itemId : null;
      const output = extractTextDelta(params) || stringifyValue(params.output);
      if (!turnId || !itemId || !output) {
        return;
      }
      const turnState = this.ensureTurn(turnId);
      const block = this.ensureActionBlock(turnState, itemId, this.buildActionFromMethod(method, params, itemId));
      this.emitActionOutput(turnState.turn, block, output);
    }
    handleActionTerminalInteraction(params) {
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      const itemId = typeof params.itemId === "string" ? params.itemId : null;
      if (!turnId || !itemId) {
        return;
      }
      const turnState = this.ensureTurn(turnId);
      const block = turnState.blocksByItemId.get(itemId);
      if (block?.type !== "action") {
        return;
      }
      const exitCode = typeof params.exitCode === "number" ? params.exitCode : typeof params.status?.exitCode === "number" ? Number(params.status.exitCode) : undefined;
      this.emitActionStatus(turnState.turn, block, exitCode === 0 ? "completed" : "failed", exitCode === undefined ? undefined : { exitCode });
    }
    handleItemCompleted(params) {
      const item = params.item;
      const turnId = typeof params.turnId === "string" ? params.turnId : null;
      const itemId = typeof item?.id === "string" ? item.id : null;
      const itemType = typeof item?.type === "string" ? item.type : null;
      if (!turnId || !item || !itemId || !itemType || itemType === "userMessage") {
        return;
      }
      const turnState = this.ensureTurn(turnId);
      switch (itemType) {
        case "agentMessage": {
          const block = this.ensureTextBlock(turnState, itemId);
          const finalText = typeof item.text === "string" ? item.text : "";
          this.emitMissingText(turnState.turn, block, finalText);
          this.completeBlock(turnState.turn, block);
          turnState.blocksByItemId.delete(itemId);
          return;
        }
        case "reasoning": {
          const finalText = extractReasoningText(item);
          if (!finalText && !turnState.blocksByItemId.has(itemId)) {
            return;
          }
          const block = this.ensureReasoningBlock(turnState, itemId);
          this.emitMissingText(turnState.turn, block, finalText);
          this.completeBlock(turnState.turn, block);
          turnState.blocksByItemId.delete(itemId);
          return;
        }
        default: {
          const block = this.ensureActionBlock(turnState, itemId, this.buildActionFromItem(item, itemId));
          this.emitMissingActionOutput(turnState.turn, block, renderActionOutput(item));
          this.emitActionStatus(turnState.turn, block, "completed", this.buildActionMeta(item));
          this.completeBlock(turnState.turn, block);
          turnState.blocksByItemId.delete(itemId);
        }
      }
    }
    handleTurnCompleted(params) {
      const turnId = params.turn.id;
      const turnState = this.currentTurnState;
      if (!turnState || turnState.turn.id !== turnId) {
        return;
      }
      switch (params.turn.status) {
        case "failed": {
          const message = params.turn.error?.message || params.turn.error?.additionalDetails || `Turn failed for ${this.session.name}.`;
          this.emitErrorBlock(turnState.turn, message);
          this.closeOpenBlocks(turnState, "failed");
          this.finishTurn(turnState, "failed");
          this.setStatus("error");
          return;
        }
        case "interrupted":
          this.closeOpenBlocks(turnState, "failed");
          this.finishTurn(turnState, "stopped");
          this.setStatus("idle");
          return;
        default:
          this.closeOpenBlocks(turnState, "completed");
          this.finishTurn(turnState, "completed");
          this.setStatus("idle");
      }
    }
    ensureTurn(turnId) {
      const current = this.currentTurnState;
      if (current?.turn.id === turnId) {
        return current;
      }
      if (current) {
        this.closeOpenBlocks(current, "failed");
        this.finishTurn(current, "stopped");
      }
      const turn = {
        id: turnId,
        sessionId: this.session.id,
        status: "started",
        startedAt: new Date().toISOString(),
        blocks: []
      };
      const nextState = {
        turn,
        blocksByItemId: new Map
      };
      this.currentTurnState = nextState;
      this.blockIndex = 0;
      this.emit("event", {
        event: "turn:start",
        sessionId: this.session.id,
        turn
      });
      return nextState;
    }
    ensureTextBlock(turnState, itemId, initialText = "") {
      const existing = turnState.blocksByItemId.get(itemId);
      if (existing?.type === "text") {
        return existing;
      }
      const block = this.startBlock(turnState, {
        id: itemId,
        type: "text",
        text: initialText,
        status: "streaming"
      });
      turnState.blocksByItemId.set(itemId, block);
      return block;
    }
    ensureReasoningBlock(turnState, itemId, initialText = "") {
      const existing = turnState.blocksByItemId.get(itemId);
      if (existing?.type === "reasoning") {
        return existing;
      }
      const block = this.startBlock(turnState, {
        id: itemId,
        type: "reasoning",
        text: initialText,
        status: "streaming"
      });
      turnState.blocksByItemId.set(itemId, block);
      return block;
    }
    ensureActionBlock(turnState, itemId, action) {
      const existing = turnState.blocksByItemId.get(itemId);
      if (existing?.type === "action") {
        return existing;
      }
      const block = this.startBlock(turnState, {
        id: itemId,
        type: "action",
        action,
        status: "streaming"
      });
      turnState.blocksByItemId.set(itemId, block);
      return block;
    }
    startBlock(turnState, partial) {
      const block = {
        ...partial,
        turnId: turnState.turn.id,
        index: this.blockIndex++
      };
      turnState.turn.blocks.push(block);
      this.emit("event", {
        event: "block:start",
        sessionId: this.session.id,
        turnId: turnState.turn.id,
        block
      });
      return block;
    }
    emitTextDelta(turn, block, text) {
      if (!text) {
        return;
      }
      block.text += text;
      block.status = "streaming";
      this.emit("event", {
        event: "block:delta",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        text
      });
    }
    emitMissingText(turn, block, finalText) {
      if (!finalText || block.text === finalText) {
        return;
      }
      if (!block.text) {
        this.emitTextDelta(turn, block, finalText);
        return;
      }
      if (finalText.startsWith(block.text)) {
        this.emitTextDelta(turn, block, finalText.slice(block.text.length));
      }
    }
    emitActionOutput(turn, block, output) {
      if (!output) {
        return;
      }
      block.action.output += output;
      block.action.status = "running";
      this.emit("event", {
        event: "block:action:output",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        output
      });
    }
    emitMissingActionOutput(turn, block, finalOutput) {
      if (!finalOutput || block.action.output === finalOutput) {
        return;
      }
      if (!block.action.output) {
        this.emitActionOutput(turn, block, finalOutput);
        return;
      }
      if (finalOutput.startsWith(block.action.output)) {
        this.emitActionOutput(turn, block, finalOutput.slice(block.action.output.length));
      }
    }
    emitActionStatus(turn, block, status, meta) {
      block.action.status = status;
      this.emit("event", {
        event: "block:action:status",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        status,
        ...meta ? { meta } : {}
      });
    }
    completeBlock(turn, block, status = "completed") {
      block.status = status;
      this.emit("event", {
        event: "block:end",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        status
      });
    }
    closeOpenBlocks(turnState, actionStatus) {
      const seen = new Set;
      for (const block of turnState.blocksByItemId.values()) {
        if (seen.has(block.id)) {
          continue;
        }
        seen.add(block.id);
        if (block.type === "action" && block.action.status !== actionStatus) {
          this.emitActionStatus(turnState.turn, block, actionStatus);
        }
        this.completeBlock(turnState.turn, block, actionStatus === "completed" ? "completed" : "failed");
      }
      turnState.blocksByItemId.clear();
    }
    emitErrorBlock(turn, message) {
      const turnState = this.currentTurnState;
      if (!turnState || turnState.turn.id !== turn.id) {
        return;
      }
      const block = this.startBlock(turnState, {
        id: crypto.randomUUID(),
        type: "error",
        message,
        status: "completed"
      });
      this.completeBlock(turn, block, "completed");
    }
    finishTurn(turnState, status) {
      turnState.turn.status = status;
      turnState.turn.endedAt = new Date().toISOString();
      if (this.currentTurnState?.turn.id === turnState.turn.id) {
        this.currentTurnState = null;
      }
      this.emit("event", {
        event: "turn:end",
        sessionId: this.session.id,
        turnId: turnState.turn.id,
        status
      });
    }
    buildActionFromItem(item, itemId) {
      const itemType = typeof item.type === "string" ? item.type : "toolCall";
      switch (itemType) {
        case "commandExecution":
          return {
            kind: "command",
            command: typeof item.command === "string" ? item.command : "",
            output: "",
            status: "running"
          };
        case "fileChange":
          return {
            kind: "file_change",
            path: typeof item.filePath === "string" ? item.filePath : typeof item.path === "string" ? item.path : "",
            diff: typeof item.diff === "string" ? item.diff : undefined,
            output: "",
            status: "running"
          };
        case "subagent":
          return {
            kind: "subagent",
            agentId: typeof item.agentId === "string" ? item.agentId : itemId,
            agentName: typeof item.agentName === "string" ? item.agentName : undefined,
            prompt: typeof item.prompt === "string" ? item.prompt : undefined,
            output: "",
            status: "running"
          };
        default:
          return {
            kind: "tool_call",
            toolName: itemType,
            toolCallId: itemId,
            input: item,
            output: "",
            status: "running"
          };
      }
    }
    buildActionFromMethod(method, params, itemId) {
      if (method === "item/commandExecution/outputDelta") {
        return {
          kind: "command",
          command: typeof params.command === "string" ? params.command : "",
          output: "",
          status: "running"
        };
      }
      if (method === "item/fileChange/outputDelta") {
        return {
          kind: "file_change",
          path: typeof params.filePath === "string" ? params.filePath : typeof params.path === "string" ? params.path : "",
          output: "",
          status: "running"
        };
      }
      return {
        kind: "tool_call",
        toolName: typeof params.toolName === "string" ? params.toolName : typeof params.name === "string" ? params.name : method.replace(/^item\//, "").replace(/\/outputDelta$/, ""),
        toolCallId: typeof params.toolCallId === "string" ? params.toolCallId : itemId,
        input: params.input,
        output: "",
        status: "running"
      };
    }
    buildActionMeta(item) {
      const exitCode = typeof item.exitCode === "number" ? item.exitCode : typeof item.status?.exitCode === "number" ? Number(item.status.exitCode) : undefined;
      if (exitCode !== undefined) {
        return { exitCode };
      }
      return;
    }
    updateSessionFromThread(thread) {
      const threadId = typeof thread.id === "string" ? thread.id : null;
      const threadPath = typeof thread.path === "string" ? thread.path : null;
      const threadName = typeof thread.name === "string" && thread.name.trim().length > 0 ? thread.name.trim() : null;
      const cwd = typeof thread.cwd === "string" && thread.cwd.trim().length > 0 ? thread.cwd.trim() : null;
      if (threadId) {
        this.currentThreadId = threadId;
      }
      if (threadPath !== null) {
        this.currentThreadPath = threadPath;
      }
      if (threadName) {
        this.session.name = threadName;
      }
      if (cwd) {
        this.session.cwd = cwd;
      }
      const nextProviderMeta = {
        ...this.session.providerMeta ?? {}
      };
      if (this.currentThreadId) {
        nextProviderMeta.threadId = this.currentThreadId;
      }
      if (this.currentThreadPath) {
        nextProviderMeta.threadPath = this.currentThreadPath;
      }
      nextProviderMeta.stdoutLogFile = this.stdoutLogPath;
      nextProviderMeta.stderrLogFile = this.stderrLogPath;
      this.session.providerMeta = nextProviderMeta;
      this.emitSessionUpdate();
    }
    emitSessionUpdate() {
      this.session.adapterType = this.type;
      this.emit("event", {
        event: "session:update",
        session: {
          ...this.session,
          providerMeta: this.session.providerMeta ? { ...this.session.providerMeta } : undefined
        }
      });
    }
    failSession(error) {
      if (this.process) {
        this.process.removeAllListeners();
        this.process.stdout.removeAllListeners();
        this.process.stderr.removeAllListeners();
      }
      this.process = null;
      this.starting = null;
      const turnState = this.currentTurnState;
      this.currentTurnState = null;
      if (turnState) {
        this.emitErrorBlock(turnState.turn, error.message);
        this.closeOpenBlocks(turnState, "failed");
        this.finishTurn(turnState, "failed");
      }
      for (const pending of this.pendingRequests.values()) {
        pending.reject(error);
      }
      this.pendingRequests.clear();
      this.emit("error", error);
      this.setStatus("error");
      appendFile(this.stderrLogPath, `[openscout] ${error.message}
`).catch(() => {
        return;
      });
      this.persistState();
    }
    async persistThreadId() {
      if (!this.currentThreadId) {
        await rm(this.threadIdPath, { force: true });
        return;
      }
      await writeFile(this.threadIdPath, `${this.currentThreadId}
`);
      await this.persistState();
    }
    async persistState() {
      const options = this.codexOptions;
      await writeFile(this.statePath, JSON.stringify({
        agentId: options.agentName,
        transport: "codex_app_server",
        sessionId: options.sessionId,
        projectRoot: options.cwd,
        cwd: options.cwd,
        threadId: this.currentThreadId,
        threadPath: this.currentThreadPath,
        requestedThreadId: options.threadId ?? null,
        requireExistingThread: options.requireExistingThread === true,
        pid: this.process?.pid ?? null,
        stdoutLogFile: this.stdoutLogPath,
        stderrLogFile: this.stderrLogPath,
        updatedAt: new Date().toISOString()
      }, null, 2) + `
`);
    }
    async request(method, params) {
      const id = String(this.nextRequestId++);
      return new Promise((resolve2, reject) => {
        this.pendingRequests.set(id, {
          resolve: (value) => resolve2(value),
          reject
        });
        try {
          const request = { id, method, params };
          this.writeMessage(request);
        } catch (error) {
          this.pendingRequests.delete(id);
          reject(error instanceof Error ? error : new Error(errorMessage(error)));
        }
      });
    }
    notify(method, params) {
      this.writeMessage(params === undefined ? { method } : { method, params });
    }
    writeMessage(message) {
      const child = this.process;
      if (!child || child.killed || child.exitCode !== null) {
        throw new Error(`Codex app-server for ${this.session.name} is not running.`);
      }
      child.stdin.write(`${JSON.stringify(message)}
`);
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/adapters/openai-compat.ts
function parseOptions(raw) {
  if (!raw) {
    throw new Error("openai adapter requires options with at least baseUrl and model");
  }
  const baseUrl = raw["baseUrl"];
  const model = raw["model"];
  if (!baseUrl || !model) {
    throw new Error("openai adapter requires options.baseUrl and options.model");
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: raw["apiKey"],
    model,
    maxTokens: raw["maxTokens"],
    temperature: raw["temperature"]
  };
}
var OpenAICompatAdapter, createAdapter3 = (config) => new OpenAICompatAdapter(config);
var init_openai_compat = __esm(() => {
  OpenAICompatAdapter = class OpenAICompatAdapter extends BaseAdapter {
    type = "openai";
    options;
    currentTurn = null;
    blockIndex = 0;
    abortController = null;
    constructor(config) {
      super(config);
      this.options = parseOptions(config.options);
      this.session.model = this.options.model;
    }
    async start() {
      this.setStatus("active");
    }
    send(prompt) {
      this.abortController = new AbortController;
      this.blockIndex = 0;
      const turn = {
        id: crypto.randomUUID(),
        sessionId: this.session.id,
        status: "started",
        startedAt: new Date().toISOString(),
        blocks: []
      };
      this.currentTurn = turn;
      this.emit("event", { event: "turn:start", sessionId: this.session.id, turn });
      this.executeRequest(turn, prompt).catch((err) => {
        this.emit("error", err);
      });
    }
    interrupt() {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      if (this.currentTurn) {
        this.endTurn(this.currentTurn, "stopped");
      }
    }
    async shutdown() {
      this.interrupt();
      this.setStatus("closed");
    }
    async executeRequest(turn, prompt) {
      const { baseUrl, apiKey, model, maxTokens, temperature } = this.options;
      const messages = this.buildMessages(prompt);
      const body = {
        model,
        messages,
        stream: true
      };
      if (maxTokens !== undefined)
        body["max_tokens"] = maxTokens;
      if (temperature !== undefined)
        body["temperature"] = temperature;
      if (prompt.providerOptions) {
        for (const [key, value] of Object.entries(prompt.providerOptions)) {
          if (!(key in body))
            body[key] = value;
        }
      }
      const headers = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      let response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: this.abortController?.signal
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          this.endTurn(turn, "stopped");
          return;
        }
        const message = err instanceof Error ? err.message : "Network request failed";
        this.emitError(turn, message);
        this.endTurn(turn, "failed");
        return;
      }
      if (!response.ok) {
        let errorText;
        try {
          const errorBody = await response.text();
          errorText = `HTTP ${response.status}: ${errorBody}`;
        } catch {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
        this.emitError(turn, errorText);
        this.endTurn(turn, "failed");
        return;
      }
      await this.parseSSEStream(turn, response);
    }
    buildMessages(prompt) {
      const messages = [];
      const contentParts = [];
      if (prompt.text) {
        contentParts.push({ type: "text", text: prompt.text });
      }
      if (prompt.images?.length) {
        for (const img of prompt.images) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${img.mimeType};base64,${img.data}`
            }
          });
        }
      }
      if (prompt.files?.length) {
        contentParts.push({
          type: "text",
          text: `

Referenced files: ${prompt.files.join(", ")}`
        });
      }
      if (contentParts.length === 1 && contentParts[0]["type"] === "text") {
        messages.push({ role: "user", content: contentParts[0]["text"] });
      } else {
        messages.push({ role: "user", content: contentParts });
      }
      return messages;
    }
    async parseSSEStream(turn, response) {
      const body = response.body;
      if (!body) {
        this.emitError(turn, "Response body is null");
        this.endTurn(turn, "failed");
        return;
      }
      const reader = body.getReader();
      const decoder = new TextDecoder;
      let buffer = "";
      let textBlock = null;
      let reasoningBlock = null;
      const toolCalls = new Map;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(`
`);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "data: [DONE]") {
              continue;
            }
            if (!trimmed.startsWith("data: ")) {
              continue;
            }
            const jsonStr = trimmed.slice(6);
            let chunk;
            try {
              chunk = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            const choice = chunk.choices[0];
            if (!choice)
              continue;
            const delta = choice.delta;
            if (delta.reasoning_content) {
              if (!reasoningBlock) {
                reasoningBlock = this.startBlock(turn, {
                  type: "reasoning",
                  text: "",
                  status: "streaming"
                });
              }
              this.emitBlockDelta(turn, reasoningBlock, delta.reasoning_content);
            }
            if (delta.content) {
              if (reasoningBlock) {
                this.emitBlockEnd(turn, reasoningBlock, "completed");
                reasoningBlock = null;
              }
              if (!textBlock) {
                textBlock = this.startBlock(turn, {
                  type: "text",
                  text: "",
                  status: "streaming"
                });
              }
              this.emitBlockDelta(turn, textBlock, delta.content);
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index);
                if (existing) {
                  if (tc.function?.arguments) {
                    existing.arguments += tc.function.arguments;
                  }
                } else {
                  toolCalls.set(tc.index, {
                    id: tc.id ?? crypto.randomUUID(),
                    name: tc.function?.name ?? "unknown",
                    arguments: tc.function?.arguments ?? ""
                  });
                }
              }
            }
            if (choice.finish_reason) {
              if (reasoningBlock) {
                this.emitBlockEnd(turn, reasoningBlock, "completed");
                reasoningBlock = null;
              }
              if (textBlock) {
                this.emitBlockEnd(turn, textBlock, "completed");
                textBlock = null;
              }
              if (choice.finish_reason === "tool_calls" || toolCalls.size > 0) {
                this.emitToolCallBlocks(turn, toolCalls);
                toolCalls.clear();
              }
            }
          }
        }
        if (buffer.trim().startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
          try {
            const chunk = JSON.parse(buffer.trim().slice(6));
            const choice = chunk.choices[0];
            if (choice?.finish_reason) {
              if (reasoningBlock) {
                this.emitBlockEnd(turn, reasoningBlock, "completed");
                reasoningBlock = null;
              }
              if (textBlock) {
                this.emitBlockEnd(turn, textBlock, "completed");
                textBlock = null;
              }
              if (toolCalls.size > 0) {
                this.emitToolCallBlocks(turn, toolCalls);
                toolCalls.clear();
              }
            }
          } catch {}
        }
        if (reasoningBlock) {
          this.emitBlockEnd(turn, reasoningBlock, "completed");
        }
        if (textBlock) {
          this.emitBlockEnd(turn, textBlock, "completed");
        }
        if (toolCalls.size > 0) {
          this.emitToolCallBlocks(turn, toolCalls);
        }
        if (turn.status !== "stopped" && turn.status !== "failed") {
          this.endTurn(turn, "completed");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          if (reasoningBlock)
            this.emitBlockEnd(turn, reasoningBlock, "completed");
          if (textBlock)
            this.emitBlockEnd(turn, textBlock, "completed");
          this.endTurn(turn, "stopped");
        } else {
          const message = err instanceof Error ? err.message : "Stream read error";
          if (reasoningBlock)
            this.emitBlockEnd(turn, reasoningBlock, "failed");
          if (textBlock)
            this.emitBlockEnd(turn, textBlock, "failed");
          this.emitError(turn, message);
          this.endTurn(turn, "failed");
        }
      }
    }
    emitToolCallBlocks(turn, toolCalls) {
      for (const [, tc] of toolCalls) {
        let parsedInput;
        try {
          parsedInput = JSON.parse(tc.arguments);
        } catch {
          parsedInput = tc.arguments;
        }
        const action = {
          kind: "tool_call",
          toolName: tc.name,
          toolCallId: tc.id,
          input: parsedInput,
          status: "completed",
          output: ""
        };
        const block = this.startBlock(turn, {
          type: "action",
          action,
          status: "completed"
        });
        this.emitBlockEnd(turn, block, "completed");
      }
    }
    startBlock(turn, partial) {
      const block = {
        ...partial,
        id: crypto.randomUUID(),
        turnId: turn.id,
        index: this.blockIndex++
      };
      turn.blocks.push(block);
      this.emit("event", {
        event: "block:start",
        sessionId: this.session.id,
        turnId: turn.id,
        block
      });
      return block;
    }
    emitBlockDelta(turn, block, text) {
      this.emit("event", {
        event: "block:delta",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        text
      });
    }
    emitBlockEnd(turn, block, status) {
      this.emit("event", {
        event: "block:end",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        status
      });
    }
    emitError(turn, message) {
      const block = this.startBlock(turn, {
        type: "error",
        message,
        status: "completed"
      });
      this.emitBlockEnd(turn, block, "completed");
    }
    endTurn(turn, status) {
      turn.status = status;
      turn.endedAt = new Date().toISOString();
      this.currentTurn = null;
      this.emit("event", {
        event: "turn:end",
        sessionId: this.session.id,
        turnId: turn.id,
        status
      });
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/adapters/opencode.ts
var OpenCodeAdapter, createAdapter4 = (config) => new OpenCodeAdapter(config);
var init_opencode = __esm(() => {
  OpenCodeAdapter = class OpenCodeAdapter extends BaseAdapter {
    type = "opencode";
    serverProcess = null;
    serverPort = 0;
    serverUrl = "";
    currentTurn = null;
    blockIndex = 0;
    openCodeSessionId = null;
    eventSource = null;
    blockByPartId = new Map;
    lastSeenRole = null;
    constructor(config) {
      super(config);
    }
    async start() {
      this.serverPort = 1e4 + Math.floor(Math.random() * 50000);
      this.serverUrl = `http://127.0.0.1:${this.serverPort}`;
      const args = ["serve", "--port", String(this.serverPort)];
      this.serverProcess = Bun.spawn(["opencode", ...args], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdout: "pipe",
        stderr: "pipe"
      });
      await this.waitForServer();
      await this.ensureSession();
      this.connectEventStream();
      this.serverProcess.exited.then((code) => {
        if (code !== 0 && this.session.status !== "closed") {
          this.emit("error", new Error(`opencode serve exited with code ${code}`));
          this.setStatus("error");
        }
      });
      this.setStatus("active");
    }
    send(prompt) {
      if (!this.openCodeSessionId) {
        this.emit("error", new Error("No OpenCode session"));
        return;
      }
      this.blockIndex = 0;
      this.blockByPartId.clear();
      const turn = {
        id: crypto.randomUUID(),
        sessionId: this.session.id,
        status: "started",
        startedAt: new Date().toISOString(),
        blocks: []
      };
      this.currentTurn = turn;
      this.emit("event", { event: "turn:start", sessionId: this.session.id, turn });
      const parts = [
        { type: "text", text: prompt.text }
      ];
      if (prompt.images?.length) {
        for (const img of prompt.images) {
          parts.push({
            type: "image",
            mimeType: img.mimeType,
            data: img.data
          });
        }
      }
      fetch(`${this.serverUrl}/session/${this.openCodeSessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts })
      }).catch((err) => {
        this.emitError(turn, err.message ?? "Failed to send message");
        this.endTurn(turn, "failed");
      });
    }
    interrupt() {
      if (this.openCodeSessionId) {
        fetch(`${this.serverUrl}/session/${this.openCodeSessionId}/abort`, {
          method: "POST"
        }).catch(() => {});
      }
      if (this.currentTurn) {
        this.endTurn(this.currentTurn, "stopped");
      }
    }
    async shutdown() {
      this.eventSource?.abort();
      this.eventSource = null;
      if (this.serverProcess && !this.serverProcess.killed) {
        this.serverProcess.kill();
      }
      this.serverProcess = null;
      this.setStatus("closed");
    }
    async waitForServer(timeoutMs = 15000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`${this.serverUrl}/session`);
          if (res.ok)
            return;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error("OpenCode server did not start in time");
    }
    async ensureSession() {
      const resume = this.config.options?.["resume"];
      const sessionId = this.config.options?.["session"];
      if (sessionId) {
        this.openCodeSessionId = sessionId;
        return;
      }
      if (resume) {
        const res2 = await fetch(`${this.serverUrl}/session`);
        const sessions = await res2.json();
        if (sessions.length > 0) {
          this.openCodeSessionId = sessions[0].id;
          return;
        }
      }
      const res = await fetch(`${this.serverUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const session = await res.json();
      this.openCodeSessionId = session.id;
    }
    connectEventStream() {
      if (!this.openCodeSessionId)
        return;
      this.eventSource = new AbortController;
      const url = `${this.serverUrl}/event?sessionID=${this.openCodeSessionId}`;
      this.readSSE(url, this.eventSource.signal);
    }
    async readSSE(url, signal) {
      try {
        const res = await fetch(url, {
          headers: { Accept: "text/event-stream" },
          signal
        });
        if (!res.ok || !res.body)
          return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder;
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(`
`);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data)
                continue;
              try {
                this.handleSSEEvent(JSON.parse(data));
              } catch {}
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setTimeout(() => {
            if (!signal.aborted)
              this.readSSE(url, signal);
          }, 2000);
        }
      }
    }
    handleSSEEvent(event) {
      const type = event.type ?? "";
      const props = event.properties ?? {};
      switch (type) {
        case "session.status": {
          const status = props.status?.type;
          if (status === "idle" && this.currentTurn) {
            this.closeOpenBlocks();
            this.endTurn(this.currentTurn, "completed");
          }
          break;
        }
        case "message.part.updated": {
          this.handlePartUpdated(props);
          break;
        }
        case "message.updated": {
          const info = props.info;
          if (info?.role === "assistant" && info?.modelID) {
            this.session.model = info.modelID;
          }
          break;
        }
      }
    }
    handlePartUpdated(props) {
      if (!this.currentTurn)
        return;
      const part = props.part;
      if (!part)
        return;
      const partId = part.id ?? "";
      const partType = part.type ?? "";
      switch (partType) {
        case "text": {
          let block = this.blockByPartId.get(partId);
          if (!block) {
            block = this.startBlock(this.currentTurn, {
              type: "text",
              text: part.text ?? "",
              status: "streaming"
            });
            this.blockByPartId.set(partId, block);
          } else {
            this.emit("event", {
              event: "block:delta",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: block.id,
              text: part.text ?? ""
            });
          }
          break;
        }
        case "thinking": {
          let block = this.blockByPartId.get(partId);
          if (!block) {
            block = this.startBlock(this.currentTurn, {
              type: "reasoning",
              text: part.text ?? "",
              status: "streaming"
            });
            this.blockByPartId.set(partId, block);
          } else {
            this.emit("event", {
              event: "block:delta",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: block.id,
              text: part.text ?? ""
            });
          }
          break;
        }
        case "step-start": {
          break;
        }
        case "step-finish": {
          break;
        }
        case "tool": {
          let block = this.blockByPartId.get(partId);
          const state = part.state ?? {};
          const toolName = part.tool ?? "unknown";
          const callId = part.callID ?? partId;
          if (!block) {
            let action;
            const input = state.input ?? {};
            const output = state.output ?? "";
            if (toolName === "edit" || toolName === "write" || toolName === "multi_edit") {
              action = {
                kind: "file_change",
                path: input.filePath ?? input.file_path ?? "",
                diff: output,
                status: state.status === "completed" ? "completed" : "running",
                output
              };
            } else if (toolName === "bash") {
              action = {
                kind: "command",
                command: input.command ?? "",
                exitCode: state.metadata?.exitCode,
                status: state.status === "completed" ? "completed" : "running",
                output
              };
            } else {
              action = {
                kind: "tool_call",
                toolName,
                toolCallId: callId,
                input,
                status: state.status === "completed" ? "completed" : "running",
                output
              };
            }
            block = this.startBlock(this.currentTurn, {
              type: "action",
              action,
              status: state.status === "completed" ? "completed" : "streaming"
            });
            this.blockByPartId.set(partId, block);
            if (state.status === "completed") {
              if (output) {
                this.emit("event", {
                  event: "block:action:output",
                  sessionId: this.session.id,
                  turnId: this.currentTurn.id,
                  blockId: block.id,
                  output
                });
              }
              this.emit("event", {
                event: "block:action:status",
                sessionId: this.session.id,
                turnId: this.currentTurn.id,
                blockId: block.id,
                status: state.status === "error" ? "failed" : "completed"
              });
              this.emitBlockEnd(this.currentTurn, block, state.status === "error" ? "failed" : "completed");
            }
          } else {
            const output = state.output ?? "";
            if (output) {
              this.emit("event", {
                event: "block:action:output",
                sessionId: this.session.id,
                turnId: this.currentTurn.id,
                blockId: block.id,
                output
              });
            }
            if (state.status === "completed" || state.status === "error") {
              this.emit("event", {
                event: "block:action:status",
                sessionId: this.session.id,
                turnId: this.currentTurn.id,
                blockId: block.id,
                status: state.status === "error" ? "failed" : "completed"
              });
              this.emitBlockEnd(this.currentTurn, block, state.status === "error" ? "failed" : "completed");
            }
          }
          break;
        }
      }
    }
    closeOpenBlocks() {
      if (!this.currentTurn)
        return;
      for (const [, block] of this.blockByPartId) {
        if (block.status !== "completed" && block.status !== "failed") {
          this.emitBlockEnd(this.currentTurn, block, "completed");
        }
      }
      this.blockByPartId.clear();
    }
    startBlock(turn, partial) {
      const block = {
        ...partial,
        id: crypto.randomUUID(),
        turnId: turn.id,
        index: this.blockIndex++
      };
      turn.blocks.push(block);
      this.emit("event", {
        event: "block:start",
        sessionId: this.session.id,
        turnId: turn.id,
        block
      });
      return block;
    }
    emitBlockEnd(turn, block, status) {
      this.emit("event", {
        event: "block:end",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        status
      });
    }
    emitError(turn, message) {
      const block = this.startBlock(turn, {
        type: "error",
        message,
        status: "completed"
      });
      this.emitBlockEnd(turn, block, "completed");
    }
    endTurn(turn, status) {
      turn.status = status;
      turn.endedAt = new Date().toISOString();
      this.currentTurn = null;
      this.emit("event", {
        event: "turn:end",
        sessionId: this.session.id,
        turnId: turn.id,
        status
      });
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/adapters/pi.ts
function readEnvValue(source, key) {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function copyFirstValue(target, outputKey, keys, sources) {
  for (const source of sources) {
    for (const key of keys) {
      const value = readEnvValue(source, key);
      if (value) {
        target[outputKey] = value;
        return;
      }
    }
  }
}
function normalizeProvider(value) {
  if (!value)
    return;
  const normalized = value.trim().toLowerCase();
  if (!normalized)
    return;
  if (normalized === "azure-openai")
    return "azure";
  if (normalized === "aws" || normalized === "aws-bedrock")
    return "bedrock";
  if (normalized === "ai-gateway" || normalized === "ai_gateway")
    return "vercel";
  if (normalized === "grok")
    return "xai";
  return normalized;
}
function inferProviderFromModel(model) {
  if (!model)
    return;
  const normalized = model.trim().toLowerCase();
  if (!normalized)
    return;
  if (normalized.includes("/")) {
    return normalizeProvider(normalized.split("/", 1)[0]);
  }
  if (normalized.startsWith("minimax"))
    return "minimax";
  if (normalized.startsWith("claude"))
    return "anthropic";
  if (normalized.startsWith("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4"))
    return "openai";
  if (normalized.startsWith("gemini"))
    return "google";
  if (normalized.startsWith("mistral") || normalized.startsWith("codestral"))
    return "mistral";
  return;
}
function selectedProvider(options) {
  const provider = typeof options?.provider === "string" ? options.provider : undefined;
  const model = typeof options?.model === "string" ? options.model : undefined;
  return normalizeProvider(provider) ?? inferProviderFromModel(model);
}
function buildPiProcessEnv(config, sourceEnv = process.env) {
  const env2 = {};
  const sources = [config.env ?? {}, sourceEnv];
  for (const key of BASE_PROCESS_ENV_KEYS) {
    copyFirstValue(env2, key, [key], sources);
  }
  const provider = selectedProvider(config.options);
  const credentialMappings = provider ? PROVIDER_CREDENTIAL_ENV[provider] : undefined;
  if (!credentialMappings) {
    return env2;
  }
  for (const mapping of credentialMappings) {
    copyFirstValue(env2, mapping.outputKey, mapping.sourceKeys ?? [mapping.outputKey], sources);
  }
  return env2;
}
var BASE_PROCESS_ENV_KEYS, PROVIDER_CREDENTIAL_ENV, PiAdapter, createAdapter5 = (config) => new PiAdapter(config);
var init_pi = __esm(() => {
  BASE_PROCESS_ENV_KEYS = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "TEMP",
    "TMP",
    "TERM",
    "LANG",
    "LC_ALL",
    "LC_CTYPE"
  ];
  PROVIDER_CREDENTIAL_ENV = {
    anthropic: [
      { outputKey: "ANTHROPIC_API_KEY" },
      { outputKey: "ANTHROPIC_OAUTH_TOKEN" }
    ],
    azure: [
      { outputKey: "AZURE_OPENAI_API_KEY" },
      { outputKey: "AZURE_OPENAI_BASE_URL" },
      { outputKey: "AZURE_OPENAI_RESOURCE_NAME" },
      { outputKey: "AZURE_OPENAI_API_VERSION" },
      { outputKey: "AZURE_OPENAI_DEPLOYMENT_NAME_MAP" }
    ],
    bedrock: [
      { outputKey: "AWS_ACCESS_KEY_ID" },
      { outputKey: "AWS_SECRET_ACCESS_KEY" },
      { outputKey: "AWS_SESSION_TOKEN" },
      { outputKey: "AWS_REGION" },
      { outputKey: "AWS_DEFAULT_REGION" },
      { outputKey: "AWS_PROFILE" }
    ],
    cerebras: [{ outputKey: "CEREBRAS_API_KEY" }],
    gemini: [{ outputKey: "GEMINI_API_KEY" }],
    google: [{ outputKey: "GEMINI_API_KEY" }],
    groq: [{ outputKey: "GROQ_API_KEY" }],
    kimi: [{ outputKey: "KIMI_API_KEY" }],
    minimax: [{
      outputKey: "MINIMAX_API_KEY",
      sourceKeys: ["MINIMAX_API_KEY", "MINIMAX_TOKEN"]
    }],
    mistral: [{ outputKey: "MISTRAL_API_KEY" }],
    moonshot: [{ outputKey: "KIMI_API_KEY" }],
    openai: [{ outputKey: "OPENAI_API_KEY" }],
    openrouter: [{ outputKey: "OPENROUTER_API_KEY" }],
    opencode: [{ outputKey: "OPENCODE_API_KEY" }],
    vercel: [{ outputKey: "AI_GATEWAY_API_KEY" }],
    xai: [{ outputKey: "XAI_API_KEY" }],
    zai: [{ outputKey: "ZAI_API_KEY" }]
  };
  PiAdapter = class PiAdapter extends BaseAdapter {
    type = "pi";
    process = null;
    currentTurn = null;
    blockIndex = 0;
    currentTextBlock = null;
    currentReasoningBlock = null;
    toolBlockByIndex = new Map;
    constructor(config) {
      super(config);
    }
    async start() {
      const args = ["--mode", "rpc"];
      const model = this.config.options?.["model"];
      if (model)
        args.push("--model", model);
      const provider = this.config.options?.["provider"];
      if (provider)
        args.push("--provider", provider);
      const thinking = this.config.options?.["thinking"];
      if (thinking)
        args.push("--thinking", thinking);
      const resume = this.config.options?.["resume"];
      if (resume)
        args.push("--continue");
      const sessionPath = this.config.options?.["session"];
      if (sessionPath)
        args.push("--session", sessionPath);
      const extensions = this.config.options?.["extensions"];
      if (extensions) {
        for (const ext of extensions)
          args.push("--extension", ext);
      }
      const env2 = buildPiProcessEnv(this.config);
      this.process = Bun.spawn(["pi", ...args], {
        cwd: this.config.cwd,
        env: env2,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe"
      });
      this.readStdout();
      this.process.exited.then((code) => {
        if (code !== 0 && this.session.status !== "closed") {
          this.emit("error", new Error(`pi exited with code ${code}`));
          this.setStatus("error");
        }
      });
      this.setStatus("active");
    }
    send(prompt) {
      this.sendRPC({
        type: "prompt",
        message: prompt.text,
        images: prompt.images?.map((img) => ({
          mimeType: img.mimeType,
          data: img.data
        }))
      });
    }
    interrupt() {
      this.sendRPC({ type: "abort" });
      if (this.currentTurn) {
        this.endTurn(this.currentTurn, "stopped");
      }
    }
    async shutdown() {
      if (this.process && !this.process.killed) {
        this.process.kill();
      }
      this.process = null;
      this.setStatus("closed");
    }
    sendRPC(command) {
      const stdin = this.process?.stdin;
      if (!stdin || typeof stdin === "number")
        return;
      stdin.write(JSON.stringify(command) + `
`);
      stdin.flush();
    }
    async readStdout() {
      const stdout = this.process?.stdout;
      if (!stdout || typeof stdout === "number")
        return;
      const reader = stdout.getReader();
      const decoder = new TextDecoder;
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(`
`);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
              continue;
            try {
              this.handleEvent(JSON.parse(trimmed));
            } catch {}
          }
        }
      } catch {}
      if (this.currentTurn && this.currentTurn.status !== "stopped") {
        this.endTurn(this.currentTurn, "completed");
      }
    }
    handleEvent(event) {
      switch (event.type) {
        case "turn_start": {
          this.blockIndex = 0;
          this.currentTextBlock = null;
          this.currentReasoningBlock = null;
          this.toolBlockByIndex.clear();
          const turn = {
            id: crypto.randomUUID(),
            sessionId: this.session.id,
            status: "started",
            startedAt: new Date().toISOString(),
            blocks: []
          };
          this.currentTurn = turn;
          this.emit("event", { event: "turn:start", sessionId: this.session.id, turn });
          break;
        }
        case "turn_end": {
          this.closeOpenBlocks();
          if (this.currentTurn) {
            this.endTurn(this.currentTurn, "completed");
          }
          break;
        }
        case "message_update": {
          this.handleMessageUpdate(event);
          break;
        }
        case "message_end": {
          if (event.message?.role === "assistant") {
            this.closeOpenBlocks();
          }
          break;
        }
        case "message_start": {
          if (event.message?.role === "assistant" && event.message?.model) {
            this.session.model = event.message.model;
          }
          break;
        }
        case "response": {
          if (!event.success && event.error) {
            if (this.currentTurn) {
              this.emitError(this.currentTurn, event.error);
            }
          }
          break;
        }
      }
    }
    handleMessageUpdate(event) {
      if (!this.currentTurn)
        return;
      const ame = event.assistantMessageEvent;
      if (!ame)
        return;
      switch (ame.type) {
        case "text_start": {
          this.currentTextBlock = this.startBlock(this.currentTurn, {
            type: "text",
            text: "",
            status: "streaming"
          });
          break;
        }
        case "text_delta": {
          if (this.currentTextBlock) {
            this.emit("event", {
              event: "block:delta",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: this.currentTextBlock.id,
              text: ame.delta ?? ""
            });
          }
          break;
        }
        case "text_end": {
          if (this.currentTextBlock) {
            this.emitBlockEnd(this.currentTurn, this.currentTextBlock, "completed");
            this.currentTextBlock = null;
          }
          break;
        }
        case "thinking_start": {
          this.currentReasoningBlock = this.startBlock(this.currentTurn, {
            type: "reasoning",
            text: "",
            status: "streaming"
          });
          break;
        }
        case "thinking_delta": {
          if (this.currentReasoningBlock) {
            this.emit("event", {
              event: "block:delta",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: this.currentReasoningBlock.id,
              text: ame.delta ?? ""
            });
          }
          break;
        }
        case "thinking_end": {
          if (this.currentReasoningBlock) {
            this.emitBlockEnd(this.currentTurn, this.currentReasoningBlock, "completed");
            this.currentReasoningBlock = null;
          }
          break;
        }
        case "tool_start": {
          const contentIndex = ame.contentIndex ?? 0;
          const toolName = ame.content?.name ?? ame.name ?? "unknown";
          const toolId = ame.content?.id ?? crypto.randomUUID();
          const input = ame.content?.input;
          let action;
          if (toolName === "edit") {
            action = {
              kind: "file_change",
              path: input?.file_path ?? input?.path ?? "",
              diff: "",
              status: "running",
              output: ""
            };
          } else if (toolName === "bash") {
            action = {
              kind: "command",
              command: input?.command ?? "",
              status: "running",
              output: ""
            };
          } else {
            action = {
              kind: "tool_call",
              toolName,
              toolCallId: toolId,
              input,
              status: "running",
              output: ""
            };
          }
          const block = this.startBlock(this.currentTurn, {
            type: "action",
            action,
            status: "streaming"
          });
          this.toolBlockByIndex.set(contentIndex, block);
          break;
        }
        case "tool_delta": {
          const contentIndex = ame.contentIndex ?? 0;
          const block = this.toolBlockByIndex.get(contentIndex);
          if (block) {
            this.emit("event", {
              event: "block:action:output",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: block.id,
              output: ame.delta ?? ""
            });
          }
          break;
        }
        case "tool_end": {
          const contentIndex = ame.contentIndex ?? 0;
          const block = this.toolBlockByIndex.get(contentIndex);
          if (block) {
            this.emit("event", {
              event: "block:action:status",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: block.id,
              status: "completed"
            });
            this.emitBlockEnd(this.currentTurn, block, "completed");
            this.toolBlockByIndex.delete(contentIndex);
          }
          break;
        }
        case "tool_result_start":
        case "tool_result_delta": {
          const contentIndex = ame.contentIndex ?? 0;
          const block = this.toolBlockByIndex.get(contentIndex);
          if (block && ame.delta) {
            this.emit("event", {
              event: "block:action:output",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: block.id,
              output: ame.delta
            });
          }
          break;
        }
        case "tool_result_end": {
          const contentIndex = ame.contentIndex ?? 0;
          const block = this.toolBlockByIndex.get(contentIndex);
          if (block) {
            const isError = ame.content?.is_error ?? false;
            this.emit("event", {
              event: "block:action:status",
              sessionId: this.session.id,
              turnId: this.currentTurn.id,
              blockId: block.id,
              status: isError ? "failed" : "completed"
            });
            this.emitBlockEnd(this.currentTurn, block, isError ? "failed" : "completed");
            this.toolBlockByIndex.delete(contentIndex);
          }
          break;
        }
      }
    }
    closeOpenBlocks() {
      if (!this.currentTurn)
        return;
      if (this.currentTextBlock) {
        this.emitBlockEnd(this.currentTurn, this.currentTextBlock, "completed");
        this.currentTextBlock = null;
      }
      if (this.currentReasoningBlock) {
        this.emitBlockEnd(this.currentTurn, this.currentReasoningBlock, "completed");
        this.currentReasoningBlock = null;
      }
      for (const [idx, block] of this.toolBlockByIndex) {
        this.emitBlockEnd(this.currentTurn, block, "completed");
      }
      this.toolBlockByIndex.clear();
    }
    startBlock(turn, partial) {
      const block = {
        ...partial,
        id: crypto.randomUUID(),
        turnId: turn.id,
        index: this.blockIndex++
      };
      turn.blocks.push(block);
      this.emit("event", {
        event: "block:start",
        sessionId: this.session.id,
        turnId: turn.id,
        block
      });
      return block;
    }
    emitBlockEnd(turn, block, status) {
      this.emit("event", {
        event: "block:end",
        sessionId: this.session.id,
        turnId: turn.id,
        blockId: block.id,
        status
      });
    }
    emitError(turn, message) {
      const block = this.startBlock(turn, {
        type: "error",
        message,
        status: "completed"
      });
      this.emitBlockEnd(turn, block, "completed");
    }
    endTurn(turn, status) {
      turn.status = status;
      turn.endedAt = new Date().toISOString();
      this.currentTurn = null;
      this.emit("event", {
        event: "turn:end",
        sessionId: this.session.id,
        turnId: turn.id,
        status
      });
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/adapters/echo.ts
var DEFAULT_STEP_DELAY_MS = 5, EchoAdapter, createAdapter6 = (config) => new EchoAdapter(config);
var init_echo = __esm(() => {
  EchoAdapter = class EchoAdapter extends BaseAdapter {
    type = "echo";
    interrupted = false;
    stepping = false;
    stepDelay;
    requireApproval;
    pendingApprovals = new Map;
    constructor(config) {
      super(config);
      this.stepDelay = typeof config.options?.stepDelay === "number" ? config.options.stepDelay : DEFAULT_STEP_DELAY_MS;
      this.requireApproval = config.options?.requireApproval === true;
    }
    async start() {
      this.setStatus("active");
    }
    send(prompt) {
      this.interrupted = false;
      this.stepping = true;
      this.runTurn(prompt.text).finally(() => {
        this.stepping = false;
      });
    }
    interrupt() {
      this.interrupted = true;
      for (const [, pending] of this.pendingApprovals) {
        pending.resolve("deny");
      }
      this.pendingApprovals.clear();
    }
    async shutdown() {
      this.interrupted = true;
      for (const [, pending] of this.pendingApprovals) {
        pending.resolve("deny");
      }
      this.pendingApprovals.clear();
      this.setStatus("closed");
    }
    decide(turnId, blockId, decision, reason) {
      const pending = this.pendingApprovals.get(this.approvalKey(turnId, blockId));
      if (!pending)
        return;
      pending.reason = reason;
      pending.resolve(decision);
      this.pendingApprovals.delete(this.approvalKey(turnId, blockId));
    }
    async runTurn(text) {
      const turnId = crypto.randomUUID();
      const sessionId = this.config.sessionId;
      let blockIndex = 0;
      const turn = {
        id: turnId,
        sessionId,
        status: "started",
        startedAt: new Date().toISOString(),
        blocks: []
      };
      this.emit("event", { event: "turn:start", sessionId, turn });
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      await this.delay();
      const reasoningId = crypto.randomUUID();
      const reasoningText = `Thinking about: ${text}`;
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emitBlockStart(sessionId, turnId, {
        id: reasoningId,
        turnId,
        type: "reasoning",
        text: "",
        status: "streaming",
        index: blockIndex++
      });
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emit("event", {
        event: "block:delta",
        sessionId,
        turnId,
        blockId: reasoningId,
        text: reasoningText
      });
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emitBlockEnd(sessionId, turnId, reasoningId, "completed");
      await this.delay();
      const textId = crypto.randomUUID();
      const echoText = `Echo: ${text}`;
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emitBlockStart(sessionId, turnId, {
        id: textId,
        turnId,
        type: "text",
        text: "",
        status: "streaming",
        index: blockIndex++
      });
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emit("event", {
        event: "block:delta",
        sessionId,
        turnId,
        blockId: textId,
        text: echoText
      });
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emitBlockEnd(sessionId, turnId, textId, "completed");
      await this.delay();
      const actionId = crypto.randomUUID();
      const toolCallId = crypto.randomUUID();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      const initialActionStatus = this.requireApproval ? "awaiting_approval" : "running";
      this.emitBlockStart(sessionId, turnId, {
        id: actionId,
        turnId,
        type: "action",
        status: "streaming",
        index: blockIndex++,
        action: {
          kind: "tool_call",
          toolName: "echo",
          toolCallId,
          status: initialActionStatus,
          output: "",
          ...this.requireApproval ? {
            approval: { version: 1, description: `Run echo tool with: ${text}`, risk: "low" }
          } : {}
        }
      });
      if (this.requireApproval) {
        this.emit("event", {
          event: "block:action:approval",
          sessionId,
          turnId,
          blockId: actionId,
          approval: { version: 1, description: `Run echo tool with: ${text}`, risk: "low" }
        });
        const decision = await new Promise((resolve2) => {
          this.pendingApprovals.set(this.approvalKey(turnId, actionId), { resolve: resolve2 });
        });
        if (this.interrupted) {
          this.emitTurnEnd(sessionId, turnId, "stopped");
          return;
        }
        if (decision === "deny") {
          this.emit("event", {
            event: "block:action:status",
            sessionId,
            turnId,
            blockId: actionId,
            status: "failed"
          });
          this.emitBlockEnd(sessionId, turnId, actionId, "failed");
          await this.delay();
          this.emitTurnEnd(sessionId, turnId, "completed");
          return;
        }
        this.emit("event", {
          event: "block:action:status",
          sessionId,
          turnId,
          blockId: actionId,
          status: "running"
        });
      }
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emit("event", {
        event: "block:action:output",
        sessionId,
        turnId,
        blockId: actionId,
        output: text
      });
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emit("event", {
        event: "block:action:status",
        sessionId,
        turnId,
        blockId: actionId,
        status: "completed"
      });
      await this.delay();
      if (this.interrupted) {
        this.emitTurnEnd(sessionId, turnId, "stopped");
        return;
      }
      this.emitBlockEnd(sessionId, turnId, actionId, "completed");
      await this.delay();
      this.emitTurnEnd(sessionId, turnId, "completed");
    }
    emitBlockStart(sessionId, turnId, block) {
      this.emit("event", { event: "block:start", sessionId, turnId, block });
    }
    approvalKey(turnId, blockId) {
      return `${turnId}:${blockId}`;
    }
    emitBlockEnd(sessionId, turnId, blockId, status) {
      this.emit("event", { event: "block:end", sessionId, turnId, blockId, status });
    }
    emitTurnEnd(sessionId, turnId, status) {
      this.emit("event", { event: "turn:end", sessionId, turnId, status });
    }
    delay() {
      if (this.stepDelay <= 0)
        return Promise.resolve();
      return new Promise((resolve2) => setTimeout(resolve2, this.stepDelay));
    }
  };
});

// node_modules/.pnpm/@openscout+agent-sessions@0.2.64/node_modules/@openscout/agent-sessions/src/index.ts
var exports_src2 = {};
__export(exports_src2, {
  supportsHistorySessionSnapshotForPath: () => supportsHistorySessionSnapshotForPath,
  supportsHistorySessionSnapshot: () => supportsHistorySessionSnapshot,
  normalizeApprovalRequest: () => normalizeApprovalRequest,
  normalizeAdapterCostProvider: () => normalizeAdapterCostProvider,
  normalizeAdapterCostModel: () => normalizeAdapterCostModel,
  isSessionRegistryError: () => isSessionRegistryError,
  inferHistorySessionAdapterType: () => inferHistorySessionAdapterType,
  extractPendingApprovalRequests: () => extractPendingApprovalRequests,
  estimateAdapterCost: () => estimateAdapterCost,
  createPiAdapter: () => createAdapter5,
  createOpencodeAdapter: () => createAdapter4,
  createOpenAiCompatAdapter: () => createAdapter3,
  createHistorySessionSnapshot: () => createHistorySessionSnapshot,
  createEchoAdapter: () => createAdapter6,
  createCodexAdapter: () => createAdapter2,
  createClaudeCodeAdapter: () => createAdapter,
  buildScoutMcpCodexLaunchArgs: () => buildScoutMcpCodexLaunchArgs,
  adapterTokenBreakdown: () => adapterTokenBreakdown,
  StateTracker: () => StateTracker,
  SessionRegistryError: () => SessionRegistryError,
  SessionRegistry: () => SessionRegistry,
  OutboundBuffer: () => OutboundBuffer,
  BaseAdapter: () => BaseAdapter
});
var init_src2 = __esm(() => {
  init_registry2();
  init_registry2();
  init_history2();
  init_claude_code();
  init_codex();
  init_openai_compat();
  init_opencode();
  init_pi();
  init_echo();
  init_codex_launch_config();
  init_cost();
});

// src/cli/deck-agent-client.ts
import { randomUUID as randomUUID3 } from "crypto";
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { homedir as homedir6 } from "os";
import path11 from "path";
function safeSessionSegment(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "codex";
}
function deckAgentRuntimeDir(sessionId) {
  return path11.join(homedir6(), ".scout", "local", "codex", safeSessionSegment(sessionId), "runtime");
}
function threadIdPath(sessionId) {
  return path11.join(deckAgentRuntimeDir(sessionId), "codex-thread-id.txt");
}
async function readThreadId(sessionId) {
  try {
    const value = (await readFile2(threadIdPath(sessionId), "utf8")).trim();
    return value || undefined;
  } catch {
    return;
  }
}
async function persistThreadId(sessionId, nativeId) {
  if (!nativeId)
    return;
  const runtimeDir = deckAgentRuntimeDir(sessionId);
  await mkdir2(runtimeDir, { recursive: true });
  await writeFile2(threadIdPath(sessionId), nativeId, { mode: 384 });
}
function nativeThreadId(adapter2) {
  const value = adapter2.session.providerMeta?.threadId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function normalizedModel(model) {
  const trimmed = model.trim();
  if (trimmed === "5.6" || trimmed === "gpt-5.6")
    return "gpt-5.6-sol";
  return /^\d+(?:\.\d+)*(?:-[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(trimmed) ? `gpt-${trimmed}` : trimmed;
}
function launchArgs(model, effort) {
  return [
    ...model?.trim() ? ["-c", `model=${JSON.stringify(normalizedModel(model))}`] : [],
    ...effort?.trim() ? ["-c", `model_reasoning_effort=${JSON.stringify(effort.trim())}`] : []
  ];
}
async function npmAdapterFactory() {
  const module = await Promise.resolve().then(() => (init_src2(), exports_src2));
  return module.createCodexAdapter;
}
function terminalError(event) {
  if (event.event === "turn:error")
    return new Error(event.message || "Codex turn failed.");
  if (event.event !== "turn:end")
    return;
  if (event.status === "failed")
    return new Error("Codex turn failed.");
  if (event.status === "stopped")
    return new Error("Codex turn was interrupted.");
  return;
}
async function createDeckAgentClient(options, dependencies = {}) {
  const sessionId = options.reuseKey.trim() || randomUUID3();
  const createAdapter7 = dependencies.createAdapter ?? await npmAdapterFactory();
  const existingThreadId = await readThreadId(sessionId);
  const adapter2 = createAdapter7({
    sessionId,
    name: "SpeakEasy Deck",
    cwd: options.cwd,
    options: {
      systemPrompt: options.systemPrompt,
      launchArgs: launchArgs(options.model, options.effort),
      ...existingThreadId ? { threadId: existingThreadId } : {}
    }
  });
  let closed = false;
  let started = false;
  let queue = Promise.resolve();
  const ensureStarted = async () => {
    if (closed)
      throw new Error("Deck agent client is closed.");
    if (started)
      return;
    await adapter2.start();
    started = true;
    await persistThreadId(sessionId, nativeThreadId(adapter2));
  };
  if (options.warmth === "warm")
    await ensureStarted();
  const runTurn = async (turn) => {
    await ensureStarted();
    if (turn.signal?.aborted)
      throw new Error("Codex turn was aborted.");
    const timeoutMs = Math.max(1, turn.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const blocks = new Map;
    let activeTurnId;
    let timer;
    let removeAbortListener;
    const text = await new Promise((resolve2, reject) => {
      let settled = false;
      const cleanup = () => {
        if (timer)
          clearTimeout(timer);
        adapter2.off("event", onEvent);
        adapter2.off("error", onError);
        removeAbortListener?.();
      };
      const settle = (callback) => {
        if (settled)
          return;
        settled = true;
        cleanup();
        callback();
      };
      const finish = () => {
        const output = [...blocks.values()].sort((a, b) => a.index - b.index).map((block) => block.text.trim()).filter(Boolean).join(`

`);
        settle(() => resolve2(output));
      };
      const onEvent = (event) => {
        if ("sessionId" in event && event.sessionId !== sessionId)
          return;
        if (event.event === "turn:start") {
          activeTurnId = event.turn.id;
          return;
        }
        if (event.event === "block:start" && event.block.type === "text") {
          blocks.set(event.block.id, { index: event.block.index, text: event.block.text });
          return;
        }
        if (event.event === "block:delta") {
          const block = blocks.get(event.blockId);
          if (block)
            block.text += event.text;
          return;
        }
        if ((event.event === "turn:end" || event.event === "turn:error") && activeTurnId === event.turnId) {
          const error = terminalError(event);
          if (error)
            settle(() => reject(error));
          else
            finish();
        }
      };
      const onError = (error) => settle(() => reject(error));
      adapter2.on("event", onEvent);
      adapter2.on("error", onError);
      timer = setTimeout(() => {
        adapter2.interrupt();
        settle(() => reject(new Error(`Timed out waiting for Codex after ${timeoutMs}ms.`)));
      }, timeoutMs);
      if (turn.signal) {
        const abort = () => {
          adapter2.interrupt();
          settle(() => reject(new Error("Codex turn was aborted.")));
        };
        turn.signal.addEventListener("abort", abort, { once: true });
        removeAbortListener = () => turn.signal?.removeEventListener("abort", abort);
      }
      adapter2.send({ sessionId, text: turn.input.trim() });
    });
    const nativeId = nativeThreadId(adapter2);
    await persistThreadId(sessionId, nativeId);
    return { text, session: { id: sessionId, nativeId } };
  };
  return {
    turn(turn) {
      const next = queue.then(() => runTurn(turn), () => runTurn(turn));
      queue = next.then(() => {
        return;
      }, () => {
        return;
      });
      return next;
    },
    async close() {
      closed = true;
      await adapter2.shutdown();
    },
    interrupt() {
      adapter2.interrupt();
    }
  };
}
var DEFAULT_TIMEOUT_MS = 300000;
var init_deck_agent_client = () => {};

// src/cli/codex-desktop-submit.ts
import { randomUUID as randomUUID4 } from "crypto";
import { spawn as spawn6 } from "child_process";
import { existsSync as existsSync13 } from "fs";
import path12 from "path";
function resolveCodexDesktopBridge(override = process.env.SPEAKEASY_CODEX_BRIDGE_PATH) {
  const candidates = [
    override?.trim(),
    path12.resolve(__dirname, "..", "..", "app", "Sources", "SpeakEasy", "Resources", "codex-desktop-bridge.cjs"),
    "/Applications/SpeakEasy.app/Contents/Resources/SpeakEasy_SpeakEasy.bundle/codex-desktop-bridge.cjs"
  ].filter((candidate) => Boolean(candidate));
  const bridge = candidates.find((candidate) => existsSync13(candidate));
  if (!bridge) {
    throw new Error("The Codex Desktop bridge is not installed. Update SpeakEasy, then try again.");
  }
  return bridge;
}
function parseBridgeEnvelope(result, expectedThreadId) {
  if (!result.ok) {
    throw new Error(result.error?.trim() || `Codex Desktop bridge failed (${result.code || "unknown error"}).`);
  }
  if (result.threadId !== expectedThreadId) {
    throw new Error("Codex Desktop returned the wrong task; the turn was not accepted.");
  }
  if (result.delivery !== "started-turn" && result.delivery !== "steered-active-turn") {
    throw new Error("Codex Desktop did not confirm how the turn was delivered.");
  }
  const response = result.response?.trim();
  const turnId = result.turnId?.trim();
  if (!response || !turnId) {
    throw new Error("Codex Desktop completed without a correlatable response.");
  }
  return {
    response,
    delivery: result.delivery,
    threadId: result.threadId,
    turnId
  };
}
function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return;
  child.kill("SIGTERM");
  const hardStop = setTimeout(() => child.kill("SIGKILL"), 1000);
  hardStop.unref();
}

class CodexDesktopSession {
  threadId;
  bridgePath;
  runtimePath;
  readyTimeoutMs;
  child = null;
  readyPromise = null;
  readyResolve = null;
  readyReject = null;
  readyTimer = null;
  stdout = "";
  stderr = "";
  pending = new Map;
  disposed = false;
  constructor(threadId, options = {}) {
    const exactThreadId = threadId.trim();
    if (!exactThreadId)
      throw new Error("The lane has no exact Codex task ID.");
    this.threadId = exactThreadId;
    this.bridgePath = options.bridgePath ?? resolveCodexDesktopBridge();
    this.runtimePath = options.runtimePath ?? process.execPath;
    this.readyTimeoutMs = Math.max(5000, options.readyTimeoutMs ?? 125000);
  }
  warm() {
    if (this.disposed)
      return Promise.reject(new Error("The Codex Desktop session is closed."));
    if (this.readyPromise)
      return this.readyPromise;
    this.readyPromise = new Promise((resolve2, reject) => {
      this.readyResolve = resolve2;
      this.readyReject = reject;
    });
    const child = spawn6(this.runtimePath, [this.bridgePath, "serve", this.threadId], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });
    this.child = child;
    this.stdout = "";
    this.stderr = "";
    this.readyTimer = setTimeout(() => {
      this.reset(new Error(`Timed out warming the exact Codex task after ${this.readyTimeoutMs}ms.`), child);
    }, this.readyTimeoutMs);
    this.readyTimer.unref();
    child.stdout.on("data", (chunk) => this.consumeStdout(chunk, child));
    child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString("utf8")).slice(-64 * 1024);
    });
    child.stdin.on("error", (error) => this.reset(error, child));
    child.on("error", (error) => this.reset(error, child));
    child.on("close", (code) => {
      if (this.child !== child)
        return;
      const detail = this.stderr.trim();
      this.reset(new Error(detail || `Codex Desktop warm bridge exited (${code ?? "signal"}).`), child);
    });
    return this.readyPromise;
  }
  async turn(text, options = {}) {
    const transcript = text.trim();
    if (!transcript)
      throw new Error("The transcript is empty.");
    if (options.signal?.aborted)
      throw new Error("The Codex turn was cancelled.");
    await this.warm();
    const child = this.child;
    if (!child?.stdin.writable)
      throw new Error("Codex Desktop warm bridge is unavailable.");
    if (this.pending.size > 0)
      throw new Error("A canonical Codex turn is already in flight.");
    const requestId = randomUUID4();
    const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS2);
    return new Promise((resolve2, reject) => {
      const onAbort = () => this.reset(new Error("The Codex turn was cancelled."), child);
      const timer = setTimeout(() => {
        this.reset(new Error(`Timed out waiting for the exact Codex task after ${timeoutMs}ms.`), child);
      }, timeoutMs);
      timer.unref();
      const pending = { resolve: resolve2, reject, timer, signal: options.signal, onAbort };
      this.pending.set(requestId, pending);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      child.stdin.write(`${JSON.stringify({ type: "submit", requestId, text: transcript })}
`);
    });
  }
  close() {
    this.disposed = true;
    this.reset(new Error("The Codex Desktop session was closed."), this.child);
  }
  consumeStdout(chunk, child) {
    if (this.child !== child)
      return;
    this.stdout += chunk.toString("utf8");
    if (Buffer.byteLength(this.stdout, "utf8") > MAX_OUTPUT_BYTES) {
      this.reset(new Error("Codex Desktop bridge output exceeded its safety limit."), child);
      return;
    }
    const lines = this.stdout.split(`
`);
    this.stdout = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim())
        continue;
      let envelope;
      try {
        envelope = JSON.parse(line);
      } catch {
        this.reset(new Error("Codex Desktop returned an unreadable bridge result."), child);
        return;
      }
      if (envelope.type === "ready") {
        if (!envelope.ok || envelope.threadId !== this.threadId) {
          this.reset(new Error(envelope.error || "Codex Desktop warmed the wrong task."), child);
          return;
        }
        if (this.readyTimer)
          clearTimeout(this.readyTimer);
        this.readyTimer = null;
        const resolve2 = this.readyResolve;
        this.readyResolve = null;
        this.readyReject = null;
        resolve2?.();
        continue;
      }
      if (this.readyResolve && envelope.ok === false && !envelope.requestId) {
        this.reset(new Error(envelope.error || "Codex Desktop could not warm the exact task."), child);
        return;
      }
      const requestId = envelope.requestId;
      if (!requestId)
        continue;
      const pending = this.pending.get(requestId);
      if (!pending)
        continue;
      this.pending.delete(requestId);
      clearTimeout(pending.timer);
      if (pending.onAbort)
        pending.signal?.removeEventListener("abort", pending.onAbort);
      try {
        pending.resolve(parseBridgeEnvelope(envelope, this.threadId));
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  reset(error, child) {
    if (child && this.child !== child)
      return;
    const active = this.child;
    this.child = null;
    if (this.readyTimer)
      clearTimeout(this.readyTimer);
    this.readyTimer = null;
    const rejectReady = this.readyReject;
    this.readyResolve = null;
    this.readyReject = null;
    this.readyPromise = null;
    rejectReady?.(error);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      if (pending.onAbort)
        pending.signal?.removeEventListener("abort", pending.onAbort);
      pending.reject(error);
    }
    this.pending.clear();
    if (active)
      stop(active);
  }
}
var __dirname = "/Users/arach/dev/SpeakEasy/.claude/worktrees/landing-polish/src/cli", DEFAULT_TIMEOUT_MS2 = 185000, MAX_OUTPUT_BYTES;
var init_codex_desktop_submit = __esm(() => {
  MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
});

// src/cli/codex-thread-catalog.ts
import { spawn as spawn7 } from "child_process";
import { readFile as readFile3 } from "fs/promises";
import { homedir as homedir7 } from "os";
import path13 from "path";
function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}
function displayCodexThreadTitle(value) {
  let title = stringValue(value).replace(/\s+/g, " ");
  if (!title)
    return "Untitled task";
  if (title.startsWith("\u2316")) {
    const subjectStart = title.indexOf("\u203A");
    if (subjectStart >= 0 && subjectStart < 400)
      title = title.slice(subjectStart + 1).trim();
    const brokerMarkers = [
      /\s+delivery:\s*routed\b/i,
      /\s*<!--\s*SCOUT BROKER\b/i,
      /\s*<details>\s*<summary>Scout routing context/i
    ];
    let end = title.length;
    for (const marker of brokerMarkers) {
      const match = marker.exec(title);
      if (match && match.index < end)
        end = match.index;
    }
    title = title.slice(0, end).trim();
    title = title.replace(/\s+\(run:\s*.*$/i, "").trim();
  }
  const limit = 120;
  if (title.length > limit) {
    title = title.slice(0, limit - 1).replace(/\s+\S*$/, "").trimEnd() + "\u2026";
  }
  return title || "Untitled task";
}
function secondsToMs(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0)
    return 0;
  return n > 10000000000 ? n : n * 1000;
}
function fallbackProject(cwd) {
  const clean = cwd.replace(/\/+$/, "");
  return path13.basename(clean) || "Codex";
}
async function loadCodexAppState() {
  try {
    return JSON.parse(await readFile3(APP_STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function codexProjectName(state, threadId, cwd) {
  const projects = state["local-projects"] ?? {};
  const assignedId = stringValue(state["thread-project-assignments"]?.[threadId]?.projectId);
  const assignedName = stringValue(projects[assignedId]?.name);
  if (assignedName)
    return assignedName;
  let best = null;
  for (const project of Object.values(projects)) {
    const name = stringValue(project?.name);
    const roots = Array.isArray(project?.rootPaths) ? project.rootPaths : [];
    if (!name)
      continue;
    for (const rawRoot of roots) {
      const root = stringValue(rawRoot).replace(/\/+$/, "");
      if (!root || cwd !== root && !cwd.startsWith(`${root}/`))
        continue;
      if (!best || root.length > best.length)
        best = { length: root.length, name };
    }
  }
  if (best)
    return best.name;
  const leaf = path13.basename(cwd.replace(/\/+$/, "")).toLowerCase();
  if (leaf) {
    for (const project of Object.values(projects)) {
      const name = stringValue(project?.name);
      const roots = Array.isArray(project?.rootPaths) ? project.rootPaths : [];
      if (name && roots.some((root) => path13.basename(stringValue(root).replace(/\/+$/, "")).toLowerCase() === leaf)) {
        return name;
      }
    }
  }
  return fallbackProject(cwd);
}
function codexProjectCwd(state, threadId, cwd) {
  if (cwd && cwd !== "/")
    return cwd;
  const projects = state["local-projects"] ?? {};
  const assignedId = stringValue(state["thread-project-assignments"]?.[threadId]?.projectId);
  const roots = Array.isArray(projects[assignedId]?.rootPaths) ? projects[assignedId].rootPaths : [];
  return roots.map(stringValue).find(Boolean) || cwd;
}

class AppServerClient {
  child;
  buffer = "";
  nextId = 0;
  pending = new Map;
  stderr = "";
  closed = false;
  constructor(cwd) {
    const executable = process.env.CODEX_BIN?.trim() || "codex";
    this.child = spawn7(executable, ["app-server"], {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.consume(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk).slice(-4000);
    });
    this.child.once("error", (error) => this.fail(error));
    this.child.once("exit", (code, signal) => {
      if (this.closed)
        return;
      const suffix = this.stderr.trim() ? `: ${this.stderr.trim().split(`
`).slice(-1)[0]}` : "";
      this.fail(new Error(`Codex app-server exited (${code ?? signal ?? "unknown"})${suffix}`));
    });
  }
  consume(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf(`
`);
      if (newline < 0)
        return;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line)
        continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof message.id === "number" && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error)
          pending.reject(new Error(message.error.message || "Codex app-server request failed."));
        else
          pending.resolve(message.result);
        continue;
      }
      if (message.id !== undefined && message.method) {
        this.write({ id: message.id, error: { code: -32601, message: "Unsupported by SpeakEasy catalog client" } });
      }
    }
  }
  write(message) {
    if (this.closed || !this.child.stdin.writable)
      throw new Error("Codex app-server is not running.");
    this.child.stdin.write(`${JSON.stringify(message)}
`);
  }
  request(method, params) {
    const id = ++this.nextId;
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server ${method} timed out.`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve2, reject, timer });
      try {
        this.write({ method, id, ...params ? { params } : {} });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  notify(method, params) {
    this.write({ method, ...params ? { params } : {} });
  }
  fail(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
  close() {
    if (this.closed)
      return;
    this.closed = true;
    this.fail(new Error("Codex app-server closed."));
    this.child.stdin.end();
    if (this.child.exitCode === null && !this.child.killed)
      this.child.kill("SIGTERM");
  }
}
async function listCodexThreadReferences(cwd = process.cwd(), limit = DEFAULT_LIMIT) {
  const client = new AppServerClient(cwd);
  try {
    await client.request("initialize", {
      clientInfo: { name: "speakeasy", title: "SpeakEasy", version: "0.2.8" }
    });
    client.notify("initialized");
    const threads = [];
    let cursor = null;
    do {
      const page = await client.request("thread/list", {
        cursor,
        limit: Math.min(100, Math.max(1, limit - threads.length)),
        sortKey: "recency_at",
        sortDirection: "desc",
        archived: false
      });
      if (Array.isArray(page?.data))
        threads.push(...page.data);
      cursor = typeof page?.nextCursor === "string" && page.nextCursor ? page.nextCursor : null;
    } while (cursor && threads.length < limit);
    const state = await loadCodexAppState();
    const pinnedThreadIds = new Set(Array.isArray(state["pinned-thread-ids"]) ? state["pinned-thread-ids"].map(stringValue).filter(Boolean) : []);
    return threads.filter((thread) => thread.ephemeral !== true).map((thread) => {
      const id = stringValue(thread.id);
      const threadCwd = stringValue(thread.cwd);
      if (!id || !threadCwd)
        return null;
      const identityCwd = codexProjectCwd(state, id, threadCwd);
      const preview = stringValue(thread.preview);
      const title = displayCodexThreadTitle(stringValue(thread.name) || stringValue(thread.title) || preview || "Untitled task");
      return {
        id,
        title,
        preview,
        cwd: identityCwd,
        project: codexProjectName(state, id, identityCwd),
        at: secondsToMs(thread.recencyAt) || secondsToMs(thread.updatedAt) || secondsToMs(thread.createdAt),
        createdAt: secondsToMs(thread.createdAt),
        source: stringValue(thread.sourceKind) || stringValue(thread.source),
        isPinned: thread.isPinned === true || pinnedThreadIds.has(id)
      };
    }).filter((thread) => thread !== null).slice(0, limit);
  } finally {
    client.close();
  }
}
var APP_STATE_FILE, DEFAULT_LIMIT = 150, REQUEST_TIMEOUT_MS = 12000;
var init_codex_thread_catalog = __esm(() => {
  APP_STATE_FILE = path13.join(homedir7(), ".codex", ".codex-global-state.json");
});

// src/cli/deck-runtime.ts
import { EventEmitter as EventEmitter2 } from "events";
import { spawn as spawn8, execFile, execFileSync as execFileSync2 } from "child_process";
import { mkdtempSync as mkdtempSync2, rmSync as rmSync2, existsSync as existsSync14, copyFileSync, readFileSync as readFileSync8, writeFileSync as writeFileSync6, readdirSync as readdirSync4, statSync as statSync4, mkdirSync as mkdirSync5, openSync as openSync2, readSync, closeSync as closeSync2 } from "fs";
import { tmpdir as tmpdir2, homedir as homedir8, hostname } from "os";
import path14 from "path";
function run(cmd, args, timeout) {
  return new Promise((resolve2, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err)
        reject(err);
      else
        resolve2(stdout);
    });
  });
}
function gitBranchFor(cwd) {
  if (!cwd)
    return "";
  try {
    const branch = execFileSync2("git", ["-C", cwd, "branch", "--show-current"], {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (branch)
      return branch;
    const commit = execFileSync2("git", ["-C", cwd, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return commit ? `detached @ ${commit}` : "";
  } catch {
    return "";
  }
}
function resolveDeckTurnRoute(laneIx, taskId) {
  if (laneIx === MASTER_IX)
    return { kind: "overview" };
  const exactTaskId = taskId?.trim();
  return exactTaskId ? { kind: "canonical", taskId: exactTaskId } : { kind: "unassigned" };
}
function readHead(file, bytes) {
  const fd = openSync2(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.toString("utf8", 0, n);
  } finally {
    closeSync2(fd);
  }
}
function parseRollout(file, at) {
  let head;
  try {
    head = readHead(file, 65536);
  } catch {
    return null;
  }
  let id = "";
  let cwd = "";
  let originator = "";
  let snippet = "";
  for (const line of head.split(`
`)) {
    if (!line)
      continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const p = rec.payload;
    if (rec.type === "session_meta" && p) {
      id = String(p.session_id ?? p.id ?? "");
      cwd = String(p.cwd ?? "");
      originator = String(p.originator ?? "");
    } else if (!snippet && rec.type === "response_item" && p?.type === "message" && p?.role === "user") {
      const content = Array.isArray(p.content) ? p.content : [];
      const text = content.filter((c) => c.type === "input_text").map((c) => String(c.text ?? "")).join(" ").trim();
      if (text && !text.startsWith("<"))
        snippet = text.replace(/\s+/g, " ").slice(0, 90);
    }
    if (id && snippet)
      break;
  }
  if (!id)
    return null;
  return {
    id,
    cwd,
    snippet: displayCodexThreadTitle(snippet || `${path14.basename(cwd)} thread`),
    preview: snippet,
    project: path14.basename(cwd) || "Codex",
    at,
    originator
  };
}
function laneRuntimeDir(key) {
  return deckAgentRuntimeDir(key);
}
function findRollout(threadId) {
  let names;
  try {
    names = readdirSync4(CODEX_SESSIONS_DIR, { recursive: true });
  } catch {
    return null;
  }
  const match = names.find((n) => n.includes(threadId) && n.endsWith(".jsonl"));
  if (!match)
    return null;
  const file = path14.join(CODEX_SESSIONS_DIR, match);
  try {
    return parseRollout(file, statSync4(file).mtimeMs);
  } catch {
    return null;
  }
}
function scanCodexThreadsFallback() {
  let names;
  try {
    names = readdirSync4(CODEX_SESSIONS_DIR, { recursive: true });
  } catch {
    return null;
  }
  const rollouts = [];
  for (const n of names) {
    if (!/rollout-.*\.jsonl$/.test(n))
      continue;
    try {
      rollouts.push({ file: n, at: statSync4(path14.join(CODEX_SESSIONS_DIR, n)).mtimeMs });
    } catch {}
  }
  rollouts.sort((a, b) => b.at - a.at);
  const out = [];
  for (const { file, at } of rollouts.slice(0, CATALOG_LIMIT * 3)) {
    const info = parseRollout(path14.join(CODEX_SESSIONS_DIR, file), at);
    if (info)
      out.push(info);
    if (out.length >= CATALOG_LIMIT)
      break;
  }
  return out;
}
function loadLaneKeys() {
  const base = Array.from({ length: LANE_COUNT }, (_, i) => `speakeasy-deck-lane-${i}`);
  try {
    const saved = JSON.parse(readFileSync8(LANES_FILE, "utf8"));
    return base.map((b, i) => {
      const v = saved[String(i)];
      return typeof v === "string" && v.startsWith("speakeasy-deck-lane-") ? v : b;
    });
  } catch {
    return base;
  }
}
function clock() {
  const d = new Date;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function estimateDuration(text, rate = 1) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words / (2.5 * rate));
}
function parseIntent(raw) {
  const parsed = intentSchema.safeParse(raw);
  if (!parsed.success)
    return { error: "invalid intent" };
  return { intent: parsed.data };
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
var intentSchema, SPEEDS, LANE_COUNT = 9, MASTER_IX = 9, MASTER_REUSE_KEY = "speakeasy-deck-master-v2", OVERVIEW_MODEL = "gpt-5.6-luna", OVERVIEW_EFFORT = "low", TICK_MS = 250, MAX_MESSAGES_PER_LANE = 50, LANES_FILE, CODEX_SESSIONS_DIR, CATALOG_LIMIT = 25, OVERVIEW_SYSTEM_PROMPT, DeckRuntime;
var init_deck_runtime = __esm(() => {
  init_zod();
  init_deck_agent_client();
  init_codex_desktop_submit();
  init_codex_thread_catalog();
  intentSchema = exports_external.discriminatedUnion("name", [
    exports_external.object({ name: exports_external.literal("lane.select"), index: exports_external.number().int().min(0).max(9) }),
    exports_external.object({ name: exports_external.literal("playback.toggle"), id: exports_external.string().regex(/^\d:\d{1,3}$/) }),
    exports_external.object({ name: exports_external.literal("playback.scrub"), id: exports_external.string().regex(/^\d:\d{1,3}$/), frac: exports_external.number().min(0).max(1) }),
    exports_external.object({ name: exports_external.literal("playback.speed") }),
    exports_external.object({ name: exports_external.literal("playback.volume"), vol: exports_external.number().min(0).max(1) }),
    exports_external.object({ name: exports_external.literal("playback.autoplay") }),
    exports_external.object({ name: exports_external.literal("playback.stop") }),
    exports_external.object({ name: exports_external.literal("playback.replay") }),
    exports_external.object({ name: exports_external.literal("capture.start") }),
    exports_external.object({ name: exports_external.literal("capture.cancel"), reason: exports_external.string().max(60).optional() }),
    exports_external.object({ name: exports_external.literal("capture.end"), text: exports_external.string().max(500).optional() }),
    exports_external.object({ name: exports_external.literal("speak"), text: exports_external.string().min(1).max(4000) }),
    exports_external.object({ name: exports_external.literal("lane.cycle"), index: exports_external.number().int().min(0).max(8) }),
    exports_external.object({ name: exports_external.literal("catalog.refresh") }),
    exports_external.object({
      name: exports_external.literal("lane.assign"),
      index: exports_external.number().int().min(0).max(8),
      threadId: exports_external.string().max(64).nullable(),
      activate: exports_external.boolean().optional()
    }),
    exports_external.object({ name: exports_external.literal("playback.progress"), id: exports_external.string().regex(/^\d:\d{1,3}$/), pos: exports_external.number().min(0), dur: exports_external.number().positive().optional() }),
    exports_external.object({ name: exports_external.literal("playback.ended"), id: exports_external.string().regex(/^\d:\d{1,3}$/) })
  ]);
  SPEEDS = [1, 1.25, 1.5, 0.75];
  LANES_FILE = path14.join(homedir8(), ".config", "speakeasy", "deck-lanes.json");
  CODEX_SESSIONS_DIR = path14.join(homedir8(), ".codex", "sessions");
  OVERVIEW_SYSTEM_PROMPT = "You are the overview officer of a voice-command deck with nine lanes, each a live codex thread. " + "Every question arrives with a DECK STATUS digest that is live and authoritative. " + "Report exactly what the digest shows and nothing more \u2014 no interpretation, no suggestions, no color commentary, never invent state. " + "Do not use tools, do not read or write files, do not access the network. " + "Plain spoken words, no lists, no code: one or two sentences for a status question, a few plain sentences for a summary.";
  DeckRuntime = class DeckRuntime extends EventEmitter2 {
    rev = 0;
    laneIx = 1;
    lanes = [
      ...Array.from({ length: LANE_COUNT }, (_, i) => ({
        num: String(i + 1).padStart(2, "0"),
        name: `LANE ${i + 1}`,
        title: "assign a Codex task before speaking",
        state: "idle"
      })),
      {
        num: "OV",
        name: "OVERVIEW",
        title: `whole-deck view \xB7 ${OVERVIEW_MODEL} \xB7 ${OVERVIEW_EFFORT}`,
        state: "idle"
      }
    ];
    laneKeys = loadLaneKeys();
    laneClients = new Map;
    canonicalTurnAbort = null;
    canonicalSession = null;
    canonicalSessionReady = false;
    threads = Array.from({ length: LANE_COUNT + 1 }, () => []);
    playing = null;
    paused = false;
    pos = 0;
    speedIx = 0;
    vol = 0.8;
    autoplay = true;
    listening = false;
    phase = "idle";
    confirm = "READY";
    trace = [];
    host = hostname().replace(/\.(local|lan)$/, "");
    catalog = [];
    catalogError = null;
    catalogRefresh = null;
    ticker = null;
    busy = false;
    destroyed = false;
    gen = 0;
    suppressAutoplayForGeneration = null;
    player = null;
    playerRate = 1;
    synthDir = mkdtempSync2(path14.join(tmpdir2(), "speakeasy-deck-synth-"));
    liveClients = () => 0;
    get audioDir() {
      return this.synthDir;
    }
    constructor(options = {}) {
      super();
      this.restoreLaneBindings();
      if (options.warmCatalog !== false)
        this.refreshThreadCatalog();
      if (options.warmCanonical !== false)
        queueMicrotask(() => this.warmCanonicalLane(this.laneIx));
    }
    applyThreadIdentity(lane, info) {
      lane.title = info.snippet;
      lane.project = info.project || path14.basename(info.cwd) || "Codex";
      lane.cwd = info.cwd || undefined;
      lane.branch = info.cwd ? gitBranchFor(info.cwd) || undefined : undefined;
      lane.updatedAt = info.at;
    }
    refreshThreadCatalog() {
      if (this.catalogRefresh)
        return this.catalogRefresh;
      this.catalogRefresh = (async () => {
        let next = null;
        let fallback = false;
        try {
          const refs = await listCodexThreadReferences(process.cwd());
          next = refs.map((thread) => ({
            id: thread.id,
            cwd: thread.cwd,
            snippet: thread.title,
            preview: thread.preview,
            project: thread.project,
            at: thread.at,
            originator: thread.source,
            isPinned: thread.isPinned
          }));
        } catch {
          next = scanCodexThreadsFallback();
          fallback = next !== null;
        }
        if (this.destroyed)
          return;
        if (next) {
          const master = this.masterThreadId();
          this.catalog = master ? next.filter((thread) => thread.id !== master) : next;
          this.catalogError = fallback ? "Codex task titles are unavailable \u2014 showing rollout references." : null;
          for (let i = 0;i < LANE_COUNT; i++) {
            const id = this.laneThreadId(i);
            const match = id ? this.catalog.find((thread) => thread.id === id) : undefined;
            if (match)
              this.applyThreadIdentity(this.lanes[i], match);
          }
        } else {
          this.catalogError = "Could not read Codex tasks \u2014 showing the last list.";
          this.log("CATALOG FAILED", "Codex app-server and rollout catalog unavailable");
        }
        this.changed();
      })().finally(() => {
        this.catalogRefresh = null;
      });
      return this.catalogRefresh;
    }
    restoreLaneBindings() {
      const claimed = new Set;
      let rotated = false;
      this.laneKeys.forEach((key, i) => {
        let threadId = "";
        try {
          threadId = readFileSync8(path14.join(laneRuntimeDir(key), "codex-thread-id.txt"), "utf8").trim();
        } catch {
          return;
        }
        if (!threadId)
          return;
        if (claimed.has(threadId)) {
          this.laneKeys[i] = `speakeasy-deck-lane-${i}-${Date.now().toString(36)}`;
          rotated = true;
          this.log("LANE DEDUPED", `lane ${i + 1} \u2192 unassigned (task already bound)`);
          return;
        }
        claimed.add(threadId);
        const lane = this.lanes[i];
        lane.threadId = threadId;
        lane.sessionAlias = threadId.replace(/-/g, "").slice(-8);
        const info = findRollout(threadId);
        if (info)
          this.applyThreadIdentity(lane, info);
        else
          lane.title = "codex thread";
      });
      if (rotated)
        this.persistLaneKeys();
    }
    snapshot() {
      return {
        type: "snapshot",
        rev: this.rev,
        lane: this.laneIx,
        lanes: this.lanes,
        threads: this.threads,
        playing: this.playing,
        paused: this.paused,
        pos: this.pos,
        speedIx: this.speedIx,
        vol: this.vol,
        autoplay: this.autoplay,
        listening: this.listening,
        phase: this.phase,
        confirm: this.confirm,
        trace: this.trace,
        host: this.host,
        catalog: this.catalog,
        catalogError: this.catalogError,
        clients: this.liveClients()
      };
    }
    changed() {
      this.rev++;
      this.emit("changed", this.snapshot());
    }
    log(kind, detail) {
      this.trace = [{ at: clock(), kind, detail }, ...this.trace].slice(0, 7);
    }
    async laneClient(ix) {
      if (ix !== MASTER_IX)
        throw new Error("Assign a Codex task to this lane before speaking.");
      const key = MASTER_REUSE_KEY;
      const existing = this.laneClients.get(ix);
      if (existing && existing.key === key)
        return existing.client;
      if (existing) {
        this.laneClients.delete(ix);
        existing.client.close().catch(() => {
          return;
        });
      }
      const options = {
        harness: "codex",
        cwd: process.cwd(),
        reuseKey: key,
        warmth: "lazy",
        systemPrompt: OVERVIEW_SYSTEM_PROMPT,
        model: OVERVIEW_MODEL,
        effort: OVERVIEW_EFFORT
      };
      const client = await createDeckAgentClient(options);
      const currentKey = MASTER_REUSE_KEY;
      if (this.destroyed || currentKey !== key) {
        client.close().catch(() => {
          return;
        });
        throw new Error("lane was reset");
      }
      this.laneClients.set(ix, { key, client });
      return client;
    }
    persistLaneKeys() {
      try {
        const out = {};
        this.laneKeys.forEach((k, i) => {
          out[String(i)] = k;
        });
        writeFileSync6(LANES_FILE, JSON.stringify(out), { mode: 384 });
      } catch {}
    }
    masterThreadId() {
      const live = this.lanes[MASTER_IX].threadId;
      if (live)
        return live;
      try {
        const id = readFileSync8(path14.join(laneRuntimeDir(MASTER_REUSE_KEY), "codex-thread-id.txt"), "utf8").trim();
        return id || null;
      } catch {
        return null;
      }
    }
    laneThreadId(index) {
      try {
        const id = readFileSync8(path14.join(laneRuntimeDir(this.laneKeys[index]), "codex-thread-id.txt"), "utf8").trim();
        return id || null;
      } catch {
        return null;
      }
    }
    assignLane(index, threadId) {
      if (threadId && this.laneThreadId(index) === threadId) {
        this.log("LANE UNCHANGED", `lane ${index + 1} already holds this thread`);
        this.changed();
        return;
      }
      if (this.playing?.startsWith(`${index}:`)) {
        this.stopPlayer();
        this.clearPlayback("READY");
      }
      const lane = this.lanes[index];
      const key = `speakeasy-deck-lane-${index}-${Date.now().toString(36)}`;
      let bound = false;
      if (threadId) {
        try {
          const dir = laneRuntimeDir(key);
          mkdirSync5(dir, { recursive: true });
          writeFileSync6(path14.join(dir, "codex-thread-id.txt"), threadId);
          bound = true;
        } catch {
          bound = false;
        }
      }
      this.laneKeys[index] = key;
      this.persistLaneKeys();
      this.threads[index] = [];
      const existing = this.laneClients.get(index);
      if (existing) {
        this.laneClients.delete(index);
        existing.client.close().catch(() => {
          return;
        });
      }
      lane.name = `LANE ${index + 1}`;
      lane.state = "idle";
      if (threadId && bound) {
        const info = this.catalog.find((t) => t.id === threadId);
        if (info)
          this.applyThreadIdentity(lane, info);
        else
          lane.title = "codex thread";
        lane.threadId = threadId;
        lane.sessionAlias = threadId.replace(/-/g, "").slice(-8);
        this.log("LANE ASSIGNED", `lane ${index + 1} \u2192 thread ${lane.sessionAlias}`);
        for (let j = 0;j < LANE_COUNT; j++) {
          if (j !== index && this.laneThreadId(j) === threadId) {
            this.log("LANE MOVED", `thread left lane ${j + 1} for lane ${index + 1}`);
            this.assignLane(j, null);
          }
        }
      } else {
        lane.title = "assign a Codex task before speaking";
        lane.threadId = undefined;
        lane.sessionAlias = undefined;
        lane.project = undefined;
        lane.cwd = undefined;
        lane.branch = undefined;
        lane.updatedAt = undefined;
        this.log(threadId ? "ASSIGN FAILED" : "LANE CLEARED", `lane ${index + 1} \u2192 unassigned`);
      }
      this.changed();
    }
    laneLabel(ix) {
      return this.lanes[ix]?.name.toLowerCase() ?? `lane ${ix + 1}`;
    }
    selectLane(index) {
      this.laneIx = index;
      const label = index === MASTER_IX ? "OVERVIEW" : `LANE ${String(index + 1).padStart(2, "0")}`;
      const state = this.lanes[index]?.state;
      const status = state === "working" ? "WORKING" : state === "speaking" ? "SPEAKING" : "READY";
      this.setPhase(this.phase, `${status} \xB7 ${label}`);
      this.log("LANE SELECTED", index === MASTER_IX ? "overview" : `lane ${index + 1}`);
      this.changed();
      this.warmCanonicalLane(index);
    }
    canonicalSessionFor(taskId) {
      if (this.canonicalSession?.threadId === taskId)
        return this.canonicalSession;
      this.canonicalSession?.close();
      this.canonicalSession = new CodexDesktopSession(taskId);
      this.canonicalSessionReady = false;
      return this.canonicalSession;
    }
    warmCanonicalLane(index) {
      if (this.destroyed || this.busy)
        return;
      const route = resolveDeckTurnRoute(index, this.lanes[index]?.threadId);
      if (route.kind !== "canonical")
        return;
      const session = this.canonicalSessionFor(route.taskId);
      if (this.canonicalSessionReady)
        return;
      session.warm().then(() => {
        if (this.destroyed || this.canonicalSession !== session || this.canonicalSessionReady)
          return;
        this.canonicalSessionReady = true;
        this.log("CODEX LINK READY", `lane ${index + 1} \xB7 exact task owner verified`);
        this.changed();
      }).catch((error) => {
        if (this.destroyed || this.canonicalSession !== session)
          return;
        this.canonicalSessionReady = false;
        this.log("CODEX LINK FAILED", error.message.slice(0, 60));
        this.changed();
      });
    }
    systemDigest() {
      const lines = this.lanes.slice(0, LANE_COUNT).map((lane, i) => {
        const bound = lane.threadId ? `bound ${lane.sessionAlias}` : "unassigned";
        let line = `lane ${i + 1}: ${bound} \xB7 ${lane.state} \xB7 "${lane.title}"`;
        const msgs = this.threads[i];
        const lastYou = [...msgs].reverse().find((m) => m.role === "you")?.text;
        const lastAgent = [...msgs].reverse().find((m) => m.role === "agent")?.text;
        if (lastYou)
          line += ` \xB7 last asked "${lastYou.slice(0, 80)}"`;
        if (lastAgent)
          line += ` \xB7 last answered "${lastAgent.slice(0, 80)}"`;
        return line;
      });
      return [`DECK STATUS (live, authoritative): host ${this.host} \xB7 ${LANE_COUNT} lanes`, ...lines].join(`
`);
    }
    setLaneState(ix, state) {
      const lane = this.lanes[ix];
      if (!lane || lane.state === "empty")
        return false;
      if (lane.state === state)
        return false;
      lane.state = state;
      return true;
    }
    clearPlayback(confirm) {
      if (this.playing) {
        const [li] = this.playing.split(":").map(Number);
        this.setLaneState(li, "idle");
      }
      this.playing = null;
      this.paused = false;
      this.pos = 0;
      if (confirm)
        this.setPhase(this.phase === "speaking" ? "idle" : this.phase, confirm);
    }
    ensureTicker() {
      if (this.ticker)
        return;
      this.ticker = setInterval(() => {
        if (!this.playing || this.paused)
          return;
        if (!this.player && this.liveClients() > 0 && !this.messageAt(this.playing)?.mirrored) {
          return;
        }
        const rate = this.player ? this.playerRate : 1;
        this.pos += TICK_MS / 1000 * rate;
        const dur = this.durOf(this.playing);
        if (!this.player && this.pos >= dur) {
          this.playing = null;
          this.pos = 0;
          this.paused = false;
          this.log("PLAYBACK ENDED", "buffer complete");
          this.setPhase("idle", "READY");
        }
        this.changed();
      }, TICK_MS);
      this.ticker.unref();
    }
    durOf(id) {
      if (!id)
        return 30;
      const [li, mi] = id.split(":").map(Number);
      return this.threads[li]?.[mi]?.dur ?? 30;
    }
    messageAt(id) {
      const [li, mi] = id.split(":").map(Number);
      return this.threads[li]?.[mi] ?? null;
    }
    setPhase(phase, confirm) {
      this.phase = phase;
      this.confirm = confirm;
    }
    async apply(intent) {
      switch (intent.name) {
        case "lane.select": {
          this.selectLane(intent.index);
          return { ok: true, rev: this.rev };
        }
        case "playback.toggle": {
          const msg = this.messageAt(intent.id);
          if (!msg)
            return { ok: false, rev: this.rev, error: "no such message" };
          if (!msg.file)
            return { ok: false, rev: this.rev, error: "no controllable audio for this item" };
          if (this.playing === intent.id && !this.paused) {
            this.paused = true;
            this.player?.kill("SIGSTOP");
            this.log("PLAYBACK PAUSED", `${Math.floor(this.pos)}s elapsed`);
          } else if (this.playing === intent.id && this.paused) {
            this.paused = false;
            this.player?.kill("SIGCONT");
            this.log("PLAYBACK RESUMED", `${Math.floor(this.pos)}s elapsed`);
          } else {
            this.stopPlayer();
            this.playing = intent.id;
            this.paused = false;
            this.pos = 0;
            this.setPhase("speaking", "PLAYING");
            this.log("PLAYBACK STARTED", `${SPEEDS[this.speedIx].toFixed(2)}x`);
            if (msg.file)
              this.playFile(msg.file);
          }
          this.ensureTicker();
          this.changed();
          return { ok: true, rev: this.rev };
        }
        case "playback.scrub":
          return { ok: false, rev: this.rev, error: "seek not supported yet" };
        case "playback.speed":
          this.speedIx = (this.speedIx + 1) % SPEEDS.length;
          this.log("SPEED CHANGE", `${SPEEDS[this.speedIx].toFixed(2)}x \xB7 applies to next play`);
          this.changed();
          return { ok: true, rev: this.rev };
        case "playback.volume":
          this.vol = intent.vol;
          this.log("NARRATION VOLUME", `${Math.round(this.vol * 100)}%`);
          this.changed();
          return { ok: true, rev: this.rev };
        case "playback.autoplay":
          this.autoplay = !this.autoplay;
          this.log("AUTOPLAY", this.autoplay ? "on" : "off");
          this.changed();
          return { ok: true, rev: this.rev };
        case "playback.stop":
          if (this.busy)
            this.suppressAutoplayForGeneration = this.gen;
          this.stopPlayer();
          this.clearPlayback();
          this.listening = false;
          this.setPhase("idle", this.busy ? "AUDIO STOPPED \xB7 TASK CONTINUES" : "AUDIO STOPPED");
          this.log("PLAYBACK STOPPED", this.busy ? "audio cleared \xB7 canonical task continues" : "buffer cleared");
          this.changed();
          return { ok: true, rev: this.rev };
        case "playback.replay": {
          const t = this.threads[this.laneIx];
          for (let i = t.length - 1;i >= 0; i--) {
            if (t[i].role === "agent" && t[i].file) {
              this.stopPlayer();
              this.playing = `${this.laneIx}:${i}`;
              this.paused = false;
              this.pos = 0;
              this.setPhase("speaking", "REPLAYING LAST REPLY");
              this.ensureTicker();
              this.log("REPLAY", `lane ${this.laneIx + 1} \xB7 last reply`);
              this.playFile(t[i].file);
              this.changed();
              return { ok: true, rev: this.rev };
            }
          }
          return { ok: false, rev: this.rev, error: "no replayable reply" };
        }
        case "capture.start":
          if (this.busy)
            return { ok: false, rev: this.rev, error: "response already in flight" };
          this.gen++;
          this.stopPlayer();
          this.clearPlayback();
          this.listening = true;
          this.setPhase("recording", "LISTENING");
          this.log("VOICE COMMAND", `${this.laneLabel(this.laneIx)} \xB7 recording`);
          this.changed();
          return { ok: true, rev: this.rev };
        case "capture.cancel":
          if (!this.listening)
            return { ok: false, rev: this.rev, error: "not recording" };
          this.listening = false;
          this.setPhase("idle", intent.reason ?? "READY");
          this.log("VOICE COMMAND", intent.reason ?? "cancelled");
          this.changed();
          return { ok: true, rev: this.rev };
        case "capture.end": {
          if (!this.listening)
            return { ok: false, rev: this.rev, error: "not recording" };
          this.listening = false;
          if (this.busy) {
            this.changed();
            return { ok: false, rev: this.rev, error: "response already in flight" };
          }
          const command = intent.text?.trim() || "Walk me through what is still blocking, then keep going.";
          this.respond(this.laneIx, command, this.gen);
          return { ok: true, rev: this.rev };
        }
        case "speak": {
          this.narrate(intent.text, this.laneIx, true);
          return { ok: true, rev: this.rev };
        }
        case "lane.cycle": {
          if (this.busy)
            return { ok: false, rev: this.rev, error: "response in flight \u2014 try again in a moment" };
          this.assignLane(intent.index, null);
          return { ok: true, rev: this.rev };
        }
        case "catalog.refresh": {
          await this.refreshThreadCatalog();
          return { ok: true, rev: this.rev };
        }
        case "lane.assign": {
          if (this.busy)
            return { ok: false, rev: this.rev, error: "response in flight \u2014 try again in a moment" };
          if (intent.threadId && intent.threadId === this.masterThreadId()) {
            return { ok: false, rev: this.rev, error: "that thread belongs to the overview lane" };
          }
          this.assignLane(intent.index, intent.threadId);
          if (intent.activate && intent.threadId && this.lanes[intent.index]?.threadId === intent.threadId) {
            this.selectLane(intent.index);
          }
          return { ok: true, rev: this.rev };
        }
        case "playback.progress": {
          if (this.playing !== intent.id)
            return { ok: false, rev: this.rev, error: "not playing" };
          this.pos = intent.pos;
          if (intent.dur) {
            const msg = this.messageAt(intent.id);
            if (msg)
              msg.dur = intent.dur;
          }
          this.changed();
          return { ok: true, rev: this.rev };
        }
        case "playback.ended": {
          if (this.playing !== intent.id)
            return { ok: false, rev: this.rev, error: "not playing" };
          const [li] = intent.id.split(":").map(Number);
          this.playing = null;
          this.pos = 0;
          this.paused = false;
          this.setPhase("idle", "READY");
          this.setLaneState(li, "idle");
          this.log("PLAYBACK ENDED", "buffer complete");
          this.changed();
          return { ok: true, rev: this.rev };
        }
      }
    }
    async narrate(text, laneIx, play) {
      const lane = Math.min(MASTER_IX, Math.max(0, laneIx));
      const msg = { role: "agent", text, dur: estimateDuration(text), mirrored: true };
      this.pushMessage(lane, msg);
      const id = `${lane}:${this.threads[lane].length - 1}`;
      this.log("NARRATION", `lane ${lane + 1} \xB7 ${msg.dur.toFixed(0)}s`);
      if (this.autoplay) {
        this.playing = id;
        this.paused = false;
        this.pos = 0;
        this.setPhase("speaking", "SPEAKING");
        this.ensureTicker();
      }
      this.changed();
      if (play) {
        const file = await this.synthesize(text);
        if (file)
          this.playFile(file);
      }
    }
    pushMessage(lane, msg) {
      const t = [...this.threads[lane], msg];
      this.threads[lane] = t.slice(-MAX_MESSAGES_PER_LANE);
    }
    async respond(laneIx, command, gen) {
      this.busy = true;
      const lane = laneIx;
      const alive = () => this.gen === gen;
      this.setLaneState(lane, "working");
      try {
        this.setPhase("transcribing", `TRANSCRIBING \xB7 LANE ${String(lane + 1).padStart(2, "0")}`);
        this.changed();
        await wait(600);
        if (!alive())
          return;
        this.pushMessage(lane, { role: "you", text: command, dur: estimateDuration(command) });
        this.setPhase("submitting", `SUBMITTING \xB7 LANE ${String(lane + 1).padStart(2, "0")}`);
        this.log("AGENT ASKED", `${this.laneLabel(lane)} \xB7 ${command.slice(0, 40)}`);
        this.changed();
        const reply = await this.askAgent(command, lane);
        if (!alive())
          return;
        const msg = { role: "agent", text: reply, dur: estimateDuration(reply) };
        this.pushMessage(lane, msg);
        const id = `${lane}:${this.threads[lane].length - 1}`;
        this.setPhase("preparingSpeech", `PREPARING SPEECH \xB7 LANE ${String(lane + 1).padStart(2, "0")}`);
        this.log("AGENT REPLY", `${msg.dur.toFixed(0)}s queued`);
        this.changed();
        const file = await this.synthesize(reply);
        if (!alive()) {
          if (!msg.file) {
            msg.mirrored = true;
            this.changed();
          }
          return;
        }
        if (!file) {
          msg.mirrored = true;
          this.setPhase("idle", `READY \xB7 LANE ${String(lane + 1).padStart(2, "0")}`);
          this.log("NO AUDIO", "synthesis unavailable \xB7 text-only reply");
          this.changed();
          return;
        }
        msg.file = file;
        msg.audioUrl = `/audio/${path14.basename(file)}`;
        if (this.autoplay && this.suppressAutoplayForGeneration !== gen) {
          this.playing = id;
          this.paused = false;
          this.pos = 0;
          this.setPhase("speaking", `SPEAKING \xB7 LANE ${String(lane + 1).padStart(2, "0")}`);
          this.setLaneState(lane, "speaking");
          this.ensureTicker();
          this.changed();
          if (this.liveClients() === 0)
            this.playFile(file);
        } else {
          this.setPhase("idle", `READY \xB7 LANE ${String(lane + 1).padStart(2, "0")}`);
          this.changed();
        }
      } finally {
        this.busy = false;
        if (this.suppressAutoplayForGeneration === gen)
          this.suppressAutoplayForGeneration = null;
        if (this.lanes[lane]?.state !== "speaking" && this.setLaneState(lane, "idle"))
          this.changed();
        if (this.laneIx !== lane)
          this.warmCanonicalLane(this.laneIx);
      }
    }
    async askAgent(question, laneIx) {
      const lane = this.lanes[laneIx];
      const route = resolveDeckTurnRoute(laneIx, lane?.threadId);
      try {
        if (route.kind === "unassigned") {
          this.log("LANE UNASSIGNED", `lane ${laneIx + 1} \xB7 no Codex task`);
          return "Assign a Codex task to this lane before speaking.";
        }
        if (route.kind === "canonical") {
          const controller = new AbortController;
          this.canonicalTurnAbort = controller;
          try {
            const session = this.canonicalSessionFor(route.taskId);
            const result2 = await session.turn(question, {
              signal: controller.signal,
              timeoutMs: 180000
            });
            this.canonicalSessionReady = true;
            lane.updatedAt = Date.now();
            this.log("CANONICAL TURN", result2.delivery === "steered-active-turn" ? `lane ${laneIx + 1} \xB7 steered active Codex task` : `lane ${laneIx + 1} \xB7 started in Codex Desktop`);
            const text2 = result2.response.trim();
            if (!text2)
              throw new Error("empty reply from the canonical task");
            return text2.length > 600 ? text2.slice(0, 600).replace(/\s+\S*$/, "") + "\u2026" : text2;
          } finally {
            if (this.canonicalTurnAbort === controller)
              this.canonicalTurnAbort = null;
          }
        }
        const client = await this.laneClient(MASTER_IX);
        const input = `${this.systemDigest()}

Operator asks: ${question.slice(0, 500)}`;
        const result = await client.turn({ input, timeoutMs: 180000 });
        const thread = result.session.nativeId;
        if (lane && thread) {
          lane.threadId = thread;
          lane.sessionAlias = thread.replace(/-/g, "").slice(-8);
          if (!lane.cwd) {
            lane.cwd = process.cwd();
            lane.project = path14.basename(lane.cwd) || "Codex";
            lane.branch = gitBranchFor(lane.cwd) || undefined;
          }
          lane.updatedAt = Date.now();
        }
        const text = result.text.trim();
        if (!text)
          throw new Error("empty reply from session");
        return text.length > 600 ? text.slice(0, 600).replace(/\s+\S*$/, "") + "\u2026" : text;
      } catch (error) {
        const canonical = route.kind === "canonical";
        this.log(canonical ? "CANONICAL FAILED" : "AGENT FAILED", error.message.slice(0, 60));
        if (canonical) {
          return "I could not reach the exact Codex task. Open that task in Codex Desktop and try again. SpeakEasy did not send this turn anywhere else.";
        }
        if (route.kind === "unassigned")
          return "Assign a Codex task to this lane before speaking.";
        const who = this.lanes[laneIx]?.name.toLowerCase();
        return who ? `${who[0].toUpperCase() + who.slice(1)} didn't answer that one \u2014 try again in a moment.` : "Sorry, the agent did not answer that one. Try again in a moment.";
      }
    }
    cancelAgentWork() {
      this.canonicalTurnAbort?.abort();
      this.canonicalTurnAbort = null;
      this.canonicalSession?.close();
      this.canonicalSession = null;
      this.canonicalSessionReady = false;
      for (const { client } of this.laneClients.values())
        client.interrupt?.();
    }
    async synthesize(text) {
      try {
        const { SpeakEasy: SpeakEasy2 } = await Promise.resolve().then(() => (init_src(), exports_src));
        const speaker = new SpeakEasy2({
          volume: this.vol,
          cache: { enabled: true }
        });
        await speaker.speak(text, { silent: true });
        if (speaker.lastAudioFile && existsSync14(speaker.lastAudioFile)) {
          const owned = path14.join(this.synthDir, `reply-${Date.now()}${path14.extname(speaker.lastAudioFile) || ".mp3"}`);
          copyFileSync(speaker.lastAudioFile, owned);
          return owned;
        }
      } catch {}
      const file = path14.join(this.synthDir, `reply-${Date.now()}.aiff`);
      try {
        await run("say", ["-o", file, text], 30000);
        return file;
      } catch (error) {
        this.log("SYNTH FAILED", error.message.slice(0, 60));
        this.changed();
        return null;
      }
    }
    playFile(file) {
      if (this.liveClients() > 0)
        return;
      this.stopPlayer();
      const args = [];
      if (this.vol !== 1)
        args.push("-v", this.vol.toFixed(2));
      this.playerRate = SPEEDS[this.speedIx];
      if (this.playerRate !== 1)
        args.push("-r", String(this.playerRate));
      const player = spawn8("afplay", [...args, file]);
      this.player = player;
      player.once("exit", () => {
        if (this.player !== player)
          return;
        this.player = null;
        if (this.playing && !this.paused) {
          const [li] = this.playing.split(":").map(Number);
          this.playing = null;
          this.pos = 0;
          this.paused = false;
          this.setPhase("idle", "READY");
          this.setLaneState(li, "idle");
          this.log("PLAYBACK ENDED", "buffer complete");
          this.changed();
        }
      });
    }
    stopPlayer() {
      if (this.player) {
        this.player.kill("SIGKILL");
        this.player = null;
      }
    }
    destroy() {
      this.destroyed = true;
      this.gen++;
      this.cancelAgentWork();
      this.stopPlayer();
      if (this.ticker)
        clearInterval(this.ticker);
      for (const { client } of this.laneClients.values())
        client.close().catch(() => {
          return;
        });
      this.laneClients.clear();
      rmSync2(this.synthDir, { recursive: true, force: true });
    }
  };
});

// src/cli/deck-live.ts
import { createServer } from "http";
import { randomUUID as randomUUID5 } from "crypto";
import { mkdirSync as mkdirSync6, mkdtempSync as mkdtempSync3, writeFileSync as writeFileSync7, renameSync as renameSync3, rmSync as rmSync3, existsSync as existsSync15, chmodSync as chmodSync4, readFileSync as readFileSync9, statSync as statSync5, lstatSync, createReadStream, openSync as openSync3, readSync as readSync2, closeSync as closeSync3 } from "fs";
import { createConnection as createConnection2 } from "net";
import { tmpdir as tmpdir3 } from "os";
import path15 from "path";
import { WebSocketServer, WebSocket } from "ws";
function requestLocalTranscription(audioPath) {
  return new Promise((resolve2, reject) => {
    try {
      const socketInfo = lstatSync(PLAYER_SOCKET_PATH2);
      if (!socketInfo.isSocket() || socketInfo.uid !== process.getuid?.() || (socketInfo.mode & 63) !== 0) {
        reject(new Error("LOCAL TRANSCRIBER UNAVAILABLE \xB7 OPEN SPEAKEASY"));
        return;
      }
    } catch {
      reject(new Error("LOCAL TRANSCRIBER UNAVAILABLE \xB7 OPEN SPEAKEASY"));
      return;
    }
    const requestId = randomUUID5();
    const socket = createConnection2(PLAYER_SOCKET_PATH2);
    let settled = false;
    let body = "";
    const finish = (error, response) => {
      if (settled)
        return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error)
        reject(error);
      else
        resolve2(response ?? { ok: false, error: "LOCAL TRANSCRIPTION FAILED" });
    };
    const timeout = setTimeout(() => finish(new Error("LOCAL TRANSCRIPTION TIMED OUT")), 180000);
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.write(JSON.stringify({ protocolVersion: 1, requestId, command: "transcribe", audioPath }) + `
`);
    });
    socket.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        finish(new Error("INVALID LOCAL TRANSCRIBER RESPONSE"));
        return;
      }
      const newline = body.indexOf(`
`);
      if (newline < 0)
        return;
      try {
        const response = JSON.parse(body.slice(0, newline));
        if (response.requestId?.toLowerCase() !== requestId.toLowerCase() || response.protocolVersion !== 1) {
          finish(new Error("INVALID LOCAL TRANSCRIBER RESPONSE"));
          return;
        }
        finish(undefined, response);
      } catch {
        finish(new Error("INVALID LOCAL TRANSCRIBER RESPONSE"));
      }
    });
    socket.on("error", () => finish(new Error("LOCAL TRANSCRIBER UNAVAILABLE \xB7 OPEN SPEAKEASY")));
    socket.on("end", () => finish(new Error("LOCAL TRANSCRIBER CLOSED EARLY")));
  });
}
function writeDiscovery(info) {
  try {
    mkdirSync6(CONFIG_DIR3, { recursive: true });
    const tmp = `${DISCOVERY_FILE}.${process.pid}.tmp`;
    writeFileSync7(tmp, JSON.stringify(info), { mode: 384 });
    chmodSync4(tmp, 384);
    renameSync3(tmp, DISCOVERY_FILE);
  } catch {}
}
function clearDiscovery() {
  try {
    if (!existsSync15(DISCOVERY_FILE))
      return;
    const info = JSON.parse(readFileSync9(DISCOVERY_FILE, "utf8"));
    if (info.pid === process.pid)
      rmSync3(DISCOVERY_FILE);
  } catch {}
}
function authorized(req, token) {
  if (token) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.searchParams.get("k") !== token)
      return false;
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
async function startDataPlane(runtime, dataPort, token) {
  const clients = new Set;
  runtime.liveClients = () => clients.size;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/audio/") && req.method === "GET") {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      let file;
      try {
        file = path15.join(runtime.audioDir, path15.basename(decodeURIComponent(url.pathname)));
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (!file.startsWith(runtime.audioDir) || !existsSync15(file)) {
        res.writeHead(404).end();
        return;
      }
      const head = Buffer.alloc(12);
      const fd = openSync3(file, "r");
      readSync2(fd, head, 0, 12, 0);
      closeSync3(fd);
      const type = head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WAVE" ? "audio/wav" : head.toString("ascii", 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(head.toString("ascii", 8, 12)) ? "audio/aiff" : head.toString("ascii", 0, 3) === "ID3" || head[0] === 255 && (head[1] & 224) === 224 ? "audio/mpeg" : "application/octet-stream";
      res.writeHead(200, { "content-type": type, "content-length": statSync5(file).size, "cache-control": "no-store" });
      createReadStream(file).pipe(res);
      return;
    }
    if (url.pathname === "/api/snapshot") {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(runtime.snapshot()));
      return;
    }
    if (url.pathname === "/api/transcribe" && req.method === "POST") {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const contentType = String(req.headers["content-type"] ?? "").split(";", 1)[0].toLowerCase();
      const extensions = {
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/aiff": ".aiff",
        "audio/x-aiff": ".aiff",
        "audio/mp4": ".m4a",
        "audio/m4a": ".m4a"
      };
      const extension = extensions[contentType];
      if (!extension) {
        res.writeHead(415, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "PCM WAV AUDIO REQUIRED" }));
        return;
      }
      const chunks = [];
      let bytes = 0;
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_TRANSCRIBE_BYTES) {
            res.writeHead(413, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "RECORDING TOO LONG" }));
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (bytes <= 44) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "EMPTY RECORDING" }));
        return;
      }
      const directory = mkdtempSync3(path15.join(tmpdir3(), "speakeasy-deck-transcribe-"));
      const audioPath = path15.join(directory, `capture${extension}`);
      try {
        chmodSync4(directory, 448);
        writeFileSync7(audioPath, Buffer.concat(chunks), { mode: 384 });
        chmodSync4(audioPath, 384);
        const response = await requestLocalTranscription(audioPath);
        const ok = response.ok === true && typeof response.text === "string" && response.text.trim().length > 0;
        res.writeHead(ok ? 200 : 422, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({
          ok,
          text: ok ? response.text.trim() : undefined,
          engine: response.engine ?? "parakeet",
          error: ok ? undefined : response.error || "NO SPEECH DETECTED"
        }));
      } catch (error) {
        res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "LOCAL TRANSCRIPTION FAILED" }));
      } finally {
        rmSync3(directory, { recursive: true, force: true });
      }
      return;
    }
    if (url.pathname === "/api/intent" && req.method === "POST") {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const chunks = [];
      let bytes = 0;
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_WS_PAYLOAD) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        res.writeHead(400).end();
        return;
      }
      let raw;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "bad json" }));
        return;
      }
      const { intent, error } = parseIntent(raw);
      const result = intent ? await runtime.apply(intent) : { ok: false, rev: runtime.snapshot().rev, error: error ?? "invalid intent" };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    if (url.pathname === "/api/speak" && req.method === "POST") {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const chunks = [];
      let bytes = 0;
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_SPEAK_BYTES) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        res.writeHead(400).end();
        return;
      }
      try {
        const { text, lane, play } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (typeof text !== "string" || !text.trim() || text.length > 4000) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "text required (1\u20134000 chars)" }));
          return;
        }
        const laneIx = typeof lane === "number" && Number.isInteger(lane) ? lane : undefined;
        runtime.narrate(text.trim(), laneIx ?? runtime.snapshot().lane, play === true);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "bad json" }));
      }
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: MAX_WS_PAYLOAD,
    verifyClient: (info, done) => {
      if (token) {
        const url = new URL(info.req.url ?? "/", "http://localhost");
        if (url.searchParams.get("k") !== token)
          return done(false, 403, "Forbidden");
      }
      const origin = info.req.headers.origin;
      if (origin) {
        try {
          if (new URL(origin).host !== info.req.headers.host)
            return done(false, 403, "Forbidden");
        } catch {
          return done(false, 403, "Forbidden");
        }
      }
      done(true);
    }
  });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify(runtime.snapshot()));
    ws.on("message", (data) => {
      (async () => {
        let raw;
        try {
          raw = JSON.parse(String(data));
        } catch {
          return;
        }
        const envelope = raw;
        if (envelope?.type !== "intent")
          return;
        const { intent, error } = parseIntent(raw);
        const result = intent ? await runtime.apply(intent) : { ok: false, rev: runtime.snapshot().rev, error: error ?? "invalid intent" };
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ack", id: typeof envelope.id === "number" ? envelope.id : null, ...result }));
        }
      })();
    });
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });
  runtime.on("changed", (snap) => {
    const payload = JSON.stringify(snap);
    for (const ws of clients) {
      if (ws.readyState !== WebSocket.OPEN)
        continue;
      if (ws.bufferedAmount > MAX_BUFFERED) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      ws.send(payload);
    }
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(dataPort, "127.0.0.1", () => resolve2());
  });
  return {
    dataPort,
    token,
    stop: () => {
      for (const ws of clients)
        ws.terminate();
      wss.close();
      server.close();
    }
  };
}
var DISCOVERY_FILE, MAX_SPEAK_BYTES, MAX_TRANSCRIBE_BYTES, MAX_WS_PAYLOAD, MAX_BUFFERED, PLAYER_SOCKET_PATH2 = "/tmp/speakeasy-player.sock";
var init_deck_live = __esm(() => {
  init_constants();
  init_deck_runtime();
  DISCOVERY_FILE = path15.join(CONFIG_DIR3, "deck-listener.json");
  MAX_SPEAK_BYTES = 64 * 1024;
  MAX_TRANSCRIBE_BYTES = 16 * 1024 * 1024;
  MAX_WS_PAYLOAD = 16 * 1024;
  MAX_BUFFERED = 256 * 1024;
});

// src/cli/plugin.ts
var exports_plugin = {};
__export(exports_plugin, {
  validateTarballPaths: () => validateTarballPaths,
  runPlugin: () => runPlugin,
  downloadTarball: () => downloadTarball,
  assertNoSymlinks: () => assertNoSymlinks,
  REPO: () => REPO
});
import { execFileSync as execFileSync3, spawnSync as spawnSync2 } from "child_process";
import { createWriteStream as createWriteStream2, existsSync as existsSync16, mkdtempSync as mkdtempSync4, readdirSync as readdirSync5, renameSync as renameSync4, rmSync as rmSync4, cpSync, lstatSync as lstatSync2 } from "fs";
import { tmpdir as tmpdir4 } from "os";
import path16 from "path";
import os3 from "os";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
function installedPath(host) {
  return path16.join(host.skillsDir(), "speakeasy");
}
function listHosts() {
  console.log("");
  console.log(source_default.bold("  \uD83D\uDD0C SpeakEasy plugins"));
  console.log("");
  for (const h of HOSTS) {
    const present = existsSync16(installedPath(h));
    const mark = present ? source_default.green("\u2713 installed") : source_default.dim("\xB7 not installed");
    console.log(`    ${source_default.cyan(h.id.padEnd(8))} ${h.name.padEnd(13)} ${mark}`);
    console.log(`    ${" ".repeat(8)} ${source_default.dim(installedPath(h))}`);
  }
  console.log("");
  console.log(source_default.dim("  Install one:  speakeasy plugin <host>"));
  console.log(source_default.dim(`  Pin a build:  speakeasy plugin <host> --ref v${getPackageVersion()}`));
  console.log("");
}
function usage(out = console.error) {
  out("");
  out(source_default.bold("  \uD83D\uDD0C speakeasy plugin <host>"));
  out("");
  out("  Install the SpeakEasy skill into an agent host:");
  for (const h of HOSTS)
    out(`    ${source_default.cyan(h.id.padEnd(8))} ${h.name}  ${source_default.dim("\u2192 " + h.skillsDir())}`);
  out("");
  out(source_default.dim("  Example: speakeasy plugin codex          (latest release)"));
  out(source_default.dim(`           speakeasy plugin codex --ref v${getPackageVersion()}`));
  out("");
}
function parsePluginArgs(argv) {
  let host = "";
  let ref;
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      usage(console.log);
      process.exit(0);
    } else if (arg === "--ref") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        console.error("\u274C --ref requires a value, e.g. --ref v0.2.17");
        process.exit(1);
      }
      ref = value;
      i++;
    } else if (arg.startsWith("-")) {
      console.error(`\u274C Unknown flag: ${arg}`);
      usage();
      process.exit(1);
    } else if (!host) {
      host = arg;
    } else {
      console.error(`\u274C Unexpected argument: ${arg}`);
      usage();
      process.exit(1);
    }
  }
  return { host, ref };
}
async function latestReleaseTag() {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "user-agent": "speakeasy-cli" },
      signal: AbortSignal.timeout(1e4)
    });
  } catch (error) {
    throw new Error(`could not reach GitHub to resolve the latest release (${error.message}) \u2014 retry, or pass --ref <tag>`);
  }
  if (!res.ok) {
    throw new Error(`could not resolve the latest release (HTTP ${res.status}) \u2014 retry, or pass --ref <tag>`);
  }
  const data = await res.json();
  if (!data.tag_name)
    throw new Error("latest release response had no tag \u2014 pass --ref <tag>");
  return data.tag_name;
}
async function downloadTarball(ref, dest) {
  const isBranch = ref === "master" || ref === "main";
  const candidates = isBranch ? [`heads/${ref}`] : [`tags/${ref}`, `heads/${ref}`];
  let lastError;
  for (const candidate of candidates) {
    const url = `https://codeload.github.com/${REPO}/tar.gz/refs/${candidate}`;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "speakeasy-cli" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok || !res.body) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_TARBALL_BYTES)
        throw new Error(`tarball too large (${declared} bytes)`);
      let received = 0;
      const counter = new Transform({
        transform(chunk, _enc, cb) {
          received += chunk.length;
          if (received > MAX_TARBALL_BYTES)
            cb(new Error(`tarball exceeded ${MAX_TARBALL_BYTES} bytes`));
          else
            cb(null, chunk);
        }
      });
      await pipeline(Readable.fromWeb(res.body), counter, createWriteStream2(dest));
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`download failed for ref "${ref}" (${lastError?.message ?? "no response"})`);
}
function validateTarballPaths(tarball) {
  const listing = execFileSync3("tar", ["-tzf", tarball], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  for (const entry of listing.split(`
`)) {
    if (!entry)
      continue;
    if (entry.startsWith("/") || entry.split("/").includes("..")) {
      throw new Error(`unsafe archive entry: ${entry}`);
    }
  }
}
function extractSkill(tarball, workdir) {
  execFileSync3("tar", ["-xzf", tarball, "-C", workdir], { stdio: "pipe" });
  const top = readdirSync5(workdir).filter((e) => e !== ".DS_Store");
  for (const dir of top) {
    const candidate = path16.join(workdir, dir, SKILL_SUBPATH);
    if (existsSync16(path16.join(candidate, "SKILL.md")))
      return candidate;
  }
  throw new Error(`skill not found at ${SKILL_SUBPATH} in that ref \u2014 the plugin may not exist there yet`);
}
function assertNoSymlinks(dir) {
  for (const entry of readdirSync5(dir, { withFileTypes: true })) {
    const full = path16.join(dir, entry.name);
    if (lstatSync2(full).isSymbolicLink())
      throw new Error(`refusing to install symlink: ${entry.name}`);
    if (entry.isDirectory())
      assertNoSymlinks(full);
  }
}
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function installSkill(skillSrc, destDir) {
  const dest = path16.join(destDir, "speakeasy");
  const staging = path16.join(destDir, `.speakeasy-staging-${process.pid}`);
  try {
    cpSync(skillSrc, staging, { recursive: true });
    if (!existsSync16(path16.join(staging, "SKILL.md")))
      throw new Error("staged skill is missing SKILL.md");
    assertNoSymlinks(staging);
    let backup = null;
    try {
      if (existsSync16(dest)) {
        backup = `${dest}.backup-${timestamp()}`;
        renameSync4(dest, backup);
      }
      renameSync4(staging, dest);
    } catch (error) {
      if (backup && existsSync16(backup) && !existsSync16(dest))
        renameSync4(backup, dest);
      throw error;
    }
    return { backup, dest };
  } finally {
    rmSync4(staging, { recursive: true, force: true });
  }
}
function rollbackInstall(dest, backup) {
  rmSync4(dest, { recursive: true, force: true });
  if (backup && existsSync16(backup))
    renameSync4(backup, dest);
}
function pruneBackups(destDir) {
  const backups = readdirSync5(destDir).filter((e) => e.startsWith("speakeasy.backup-")).sort().reverse();
  for (const old of backups.slice(KEEP_BACKUPS)) {
    rmSync4(path16.join(destDir, old), { recursive: true, force: true });
  }
}
async function runPlugin(argv) {
  const { host, ref } = parsePluginArgs(argv);
  const target = HOSTS.find((h) => h.id === host);
  if (!target) {
    if (!host) {
      listHosts();
      return;
    }
    console.error(`\u274C Unknown host: ${host}`);
    usage();
    process.exit(1);
  }
  console.log("");
  console.log(source_default.bold(`  \uD83D\uDD0C SpeakEasy skill for ${target.name}`));
  console.log("");
  if (process.platform !== "darwin") {
    console.log(source_default.yellow("  \u26A0\uFE0F  The native SpeakEasy player needs macOS 14+ \u2014 installing the skill anyway."));
    console.log("");
  }
  const workdir = mkdtempSync4(path16.join(tmpdir4(), "speakeasy-plugin-"));
  let exitCode = 0;
  try {
    const stage = ref ?? await latestReleaseTag();
    console.log(`  ${source_default.dim("Source")}     ${source_default.cyan(`github.com/${REPO}`)} ${source_default.dim("@")} ${stage}`);
    console.log(`  ${source_default.dim("Downloading\u2026")}`);
    const tarball = path16.join(workdir, "repo.tar.gz");
    await downloadTarball(stage, tarball);
    console.log(`  ${source_default.dim("Extracting\u2026")}`);
    validateTarballPaths(tarball);
    const skillSrc = extractSkill(tarball, workdir);
    const { backup, dest } = installSkill(skillSrc, target.skillsDir());
    if (backup)
      console.log(`  ${source_default.dim("Previous")}  ${source_default.yellow("moved to")} ${source_default.dim(backup)}`);
    console.log(`  ${source_default.dim("Installed")} ${source_default.green(dest)}`);
    const bun = spawnSync2("which", ["bun"], { stdio: "pipe" });
    let healthy = false;
    if (bun.status === 0) {
      console.log("");
      console.log(`  ${source_default.dim("Health check\u2026")}`);
      const doctor = spawnSync2("bun", [path16.join(dest, "scripts", "speakeasy-runtime.ts"), "--doctor"], { stdio: "inherit" });
      if (doctor.status !== 0) {
        rollbackInstall(dest, backup);
        throw new Error("health check failed \u2014 rolled back to the previous install");
      }
      healthy = true;
    } else {
      console.log("");
      console.log(source_default.yellow("  \u26A0\uFE0F  Bun not found \u2014 the skill scripts need it: https://bun.sh"));
      console.log(source_default.dim("      Install it, then verify: bun " + path16.join(dest, "scripts", "speakeasy-runtime.ts") + " --doctor"));
    }
    if (healthy)
      pruneBackups(target.skillsDir());
    console.log("");
    console.log(`  ${source_default.green("\u2713")} ${target.hint}`);
    console.log("");
  } catch (error) {
    console.error("");
    console.error(`  \u274C Install failed: ${error.message}`);
    console.error(source_default.dim("     Check your network, or pick a ref explicitly with --ref <tag> (e.g. --ref master)"));
    console.error("");
    exitCode = 1;
  } finally {
    rmSync4(workdir, { recursive: true, force: true });
  }
  if (exitCode !== 0)
    process.exit(exitCode);
}
var REPO = "arach/SpeakEasy", SKILL_SUBPATH, MAX_TARBALL_BYTES, KEEP_BACKUPS = 3, HOSTS;
var init_plugin = __esm(() => {
  init_source();
  init_constants();
  SKILL_SUBPATH = path16.join("plugins", "speakeasy", "skills", "speakeasy");
  MAX_TARBALL_BYTES = 150 * 1024 * 1024;
  HOSTS = [
    {
      id: "codex",
      name: "Codex",
      skillsDir: () => path16.join(os3.homedir(), ".codex", "skills"),
      hint: "Start a new Codex session, then say: \u201CRead this summary aloud in SpeakEasy.\u201D"
    },
    {
      id: "claude",
      name: "Claude Code",
      skillsDir: () => path16.join(os3.homedir(), ".claude", "skills"),
      hint: "Start a new Claude Code session, then ask it to read something aloud."
    }
  ];
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/dns-equal.js
var require_dns_equal = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = dnsEqual;
  var capitalLetterRegex = /[A-Z]/g;
  function toLowerCase(input) {
    return input.toLowerCase();
  }
  function dnsEqual(a, b) {
    const aFormatted = a.replace(capitalLetterRegex, toLowerCase);
    const bFormatted = b.replace(capitalLetterRegex, toLowerCase);
    return aFormatted === bFormatted;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/dns-txt.js
var require_dns_txt = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DnsTxt = undefined;

  class DnsTxt {
    constructor(opts = {}) {
      this.binary = opts ? opts.binary : false;
    }
    encode(data = {}) {
      return Object.entries(data).map(([key, value]) => {
        let item = `${key}=${value}`;
        return Buffer.from(item);
      });
    }
    decode(buffer) {
      var data = {};
      try {
        let format = buffer.toString();
        let parts = format.split(/=(.+)/);
        let key = parts[0];
        let value = parts[1];
        data[key] = value;
      } catch (_) {}
      return data;
    }
    decodeAll(buffer) {
      return buffer.filter((i) => i.length > 1).map((i) => this.decode(i)).reduce((prev, curr) => {
        var obj = prev;
        let [key] = Object.keys(curr);
        let [value] = Object.values(curr);
        obj[key] = value;
        return obj;
      }, {});
    }
  }
  exports.DnsTxt = DnsTxt;
  exports.default = DnsTxt;
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/service-types.js
var require_service_types = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.toType = exports.toString = undefined;
  var Prefix = (name) => {
    return "_" + name;
  };
  var AllowedProp = (key) => {
    let keys = ["name", "protocol", "subtype"];
    return keys.includes(key);
  };
  var toString = (data) => {
    let formatted = {
      name: data.name,
      protocol: data.protocol,
      subtype: data.subtype
    };
    let entries = Object.entries(formatted);
    return entries.filter(([key, val]) => AllowedProp(key) && val !== undefined).reduce((prev, [key, val]) => {
      switch (typeof val) {
        case "object":
          val.map((i) => prev.push(Prefix(i)));
          break;
        default:
          prev.push(Prefix(val));
          break;
      }
      return prev;
    }, []).join(".");
  };
  exports.toString = toString;
  var toType = (string) => {
    let parts = string.split(".");
    let subtype;
    for (let i in parts) {
      if (parts[i][0] !== "_")
        continue;
      parts[i] = parts[i].slice(1);
    }
    if (parts.includes("sub")) {
      subtype = parts.shift();
      parts.shift();
    }
    return {
      name: parts.shift(),
      protocol: parts.shift() || null,
      subtype
    };
  };
  exports.toType = toType;
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/service.js
var require_service = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Service = undefined;
  var os_1 = __importDefault(__require("os"));
  var dns_txt_1 = __importDefault(require_dns_txt());
  var events_1 = __require("events");
  var service_types_1 = require_service_types();
  var TLD = ".local";

  class Service extends events_1.EventEmitter {
    constructor(config, start, stop2) {
      super();
      this.start = start;
      this.stop = stop2;
      this.probe = true;
      this.published = false;
      this.activated = false;
      this.destroyed = false;
      this.txtService = new dns_txt_1.default;
      if (!config.name)
        throw new Error("ServiceConfig requires `name` property to be set");
      if (!config.type)
        throw new Error("ServiceConfig requires `type` property to be set");
      if (!config.port)
        throw new Error("ServiceConfig requires `port` property to be set");
      this.name = config.name.split(".").join("-");
      this.protocol = config.protocol || "tcp";
      this.type = (0, service_types_1.toString)({ name: config.type, protocol: this.protocol });
      this.port = config.port;
      this.host = config.host || os_1.default.hostname();
      this.fqdn = `${this.name}.${this.type}${TLD}`;
      this.txt = config.txt;
      this.subtypes = config.subtypes;
      this.disableIPv6 = !!config.disableIPv6;
    }
    records() {
      var records = [
        this.RecordPTR(this),
        this.RecordSRV(this),
        this.RecordTXT(this),
        this.RecordServicePTR(this)
      ];
      for (let subtype of this.subtypes || []) {
        records.push(this.RecordSubtypePTR(this, subtype));
      }
      let ifaces = Object.values(os_1.default.networkInterfaces());
      for (let iface of ifaces) {
        let addrs = iface;
        for (let addr of addrs) {
          if (addr.internal || addr.mac === "00:00:00:00:00:00")
            continue;
          switch (addr.family) {
            case "IPv4":
              records.push(this.RecordA(this, addr.address));
              break;
            case "IPv6":
              if (this.disableIPv6)
                break;
              records.push(this.RecordAAAA(this, addr.address));
              break;
          }
        }
      }
      return records;
    }
    RecordPTR(service) {
      return {
        name: `${service.type}${TLD}`,
        type: "PTR",
        ttl: 28800,
        data: service.fqdn
      };
    }
    RecordServicePTR(service) {
      return {
        name: `_services._dns-sd._udp${TLD}`,
        type: "PTR",
        ttl: 120,
        data: `${service.type}${TLD}`
      };
    }
    RecordSubtypePTR(service, subtype) {
      return {
        name: `_${subtype}._sub.${service.type}${TLD}`,
        type: "PTR",
        ttl: 28800,
        data: `${service.name}.${service.type}${TLD}`
      };
    }
    RecordSRV(service) {
      return {
        name: service.fqdn,
        type: "SRV",
        ttl: 120,
        data: {
          port: service.port,
          target: service.host
        }
      };
    }
    RecordTXT(service) {
      return {
        name: service.fqdn,
        type: "TXT",
        ttl: 4500,
        data: this.txtService.encode(service.txt)
      };
    }
    RecordA(service, ip) {
      return {
        name: service.host,
        type: "A",
        ttl: 120,
        data: ip
      };
    }
    RecordAAAA(service, ip) {
      return {
        name: service.host,
        type: "AAAA",
        ttl: 120,
        data: ip
      };
    }
  }
  exports.Service = Service;
  exports.default = Service;
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/registry.js
var require_registry = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Registry = undefined;
  var dns_equal_1 = __importDefault(require_dns_equal());
  var service_1 = __importDefault(require_service());
  var REANNOUNCE_MAX_MS = 60 * 60 * 1000;
  var REANNOUNCE_FACTOR = 3;
  var noop = function() {};

  class Registry {
    constructor(server) {
      this.services = [];
      this.server = server;
    }
    publish(config) {
      const configProbe = config.probe !== false;
      const service = new service_1.default(config, start.bind(null, this), stop2.bind(null, this));
      function start(registry, { probe = configProbe } = {}) {
        if (service.activated)
          return;
        service.activated = true;
        registry.services.push(service);
        if (!(service instanceof service_1.default))
          return;
        if (probe) {
          registry.probe(registry.server.mdns, service, (exists) => {
            if (exists) {
              if (service.stop !== undefined)
                service.stop();
              console.log(new Error("Service name is already in use on the network"));
              return;
            }
            registry.announce(registry.server, service);
          });
        } else {
          registry.announce(registry.server, service);
        }
      }
      function stop2(registry, callback) {
        if (!callback)
          callback = noop;
        if (!service.activated)
          return process.nextTick(callback);
        if (!(service instanceof service_1.default))
          return process.nextTick(callback);
        registry.teardown(registry.server, service, callback);
        const index = registry.services.indexOf(service);
        if (index !== -1)
          registry.services.splice(index, 1);
      }
      service.start();
      return service;
    }
    unpublishAll(callback) {
      this.teardown(this.server, this.services, callback);
      this.services = [];
    }
    destroy() {
      this.services.map((service) => service.destroyed = true);
    }
    probe(mdns, service, callback) {
      var sent = false;
      var retries = 0;
      var timer;
      const send = () => {
        if (!service.activated || service.destroyed)
          return;
        mdns.query(service.fqdn, "ANY", function() {
          sent = true;
          timer = setTimeout(++retries < 3 ? send : done, 250);
          timer.unref();
        });
      };
      const onresponse = (packet) => {
        if (!sent)
          return;
        if (packet.answers.some(matchRR) || packet.additionals.some(matchRR))
          done(true);
      };
      const matchRR = (rr) => {
        return (0, dns_equal_1.default)(rr.name, service.fqdn);
      };
      const done = (exists) => {
        mdns.removeListener("response", onresponse);
        clearTimeout(timer);
        callback(!!exists);
      };
      mdns.on("response", onresponse);
      setTimeout(send, Math.random() * 250);
    }
    announce(server, service) {
      var delay = 1000;
      var packet = service.records();
      server.register(packet);
      const broadcast = () => {
        if (!service.activated || service.destroyed)
          return;
        server.mdns.respond(packet, function() {
          if (!service.published) {
            service.activated = true;
            service.published = true;
            service.emit("up");
          }
          delay = delay * REANNOUNCE_FACTOR;
          if (delay < REANNOUNCE_MAX_MS && !service.destroyed) {
            setTimeout(broadcast, delay).unref();
          }
        });
      };
      broadcast();
    }
    teardown(server, services, callback) {
      if (!Array.isArray(services))
        services = [services];
      services = services.filter((service) => service.activated);
      var records = services.flatMap(function(service) {
        service.activated = false;
        var records2 = service.records();
        records2.forEach((record) => {
          record.ttl = 0;
        });
        return records2;
      });
      if (records.length === 0)
        return callback && process.nextTick(callback);
      server.unregister(records);
      server.mdns.respond(records, function() {
        services.forEach(function(service) {
          service.published = false;
        });
        if (typeof callback === "function") {
          callback.apply(null, arguments);
        }
      });
    }
  }
  exports.Registry = Registry;
  exports.default = Registry;
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/types.js
var require_types = __commonJS((exports) => {
  exports.toString = function(type) {
    switch (type) {
      case 1:
        return "A";
      case 10:
        return "NULL";
      case 28:
        return "AAAA";
      case 18:
        return "AFSDB";
      case 42:
        return "APL";
      case 257:
        return "CAA";
      case 60:
        return "CDNSKEY";
      case 59:
        return "CDS";
      case 37:
        return "CERT";
      case 5:
        return "CNAME";
      case 49:
        return "DHCID";
      case 32769:
        return "DLV";
      case 39:
        return "DNAME";
      case 48:
        return "DNSKEY";
      case 43:
        return "DS";
      case 55:
        return "HIP";
      case 13:
        return "HINFO";
      case 45:
        return "IPSECKEY";
      case 25:
        return "KEY";
      case 36:
        return "KX";
      case 29:
        return "LOC";
      case 15:
        return "MX";
      case 35:
        return "NAPTR";
      case 2:
        return "NS";
      case 47:
        return "NSEC";
      case 50:
        return "NSEC3";
      case 51:
        return "NSEC3PARAM";
      case 12:
        return "PTR";
      case 46:
        return "RRSIG";
      case 17:
        return "RP";
      case 24:
        return "SIG";
      case 6:
        return "SOA";
      case 99:
        return "SPF";
      case 33:
        return "SRV";
      case 44:
        return "SSHFP";
      case 32768:
        return "TA";
      case 249:
        return "TKEY";
      case 52:
        return "TLSA";
      case 250:
        return "TSIG";
      case 16:
        return "TXT";
      case 252:
        return "AXFR";
      case 251:
        return "IXFR";
      case 41:
        return "OPT";
      case 255:
        return "ANY";
    }
    return "UNKNOWN_" + type;
  };
  exports.toType = function(name) {
    switch (name.toUpperCase()) {
      case "A":
        return 1;
      case "NULL":
        return 10;
      case "AAAA":
        return 28;
      case "AFSDB":
        return 18;
      case "APL":
        return 42;
      case "CAA":
        return 257;
      case "CDNSKEY":
        return 60;
      case "CDS":
        return 59;
      case "CERT":
        return 37;
      case "CNAME":
        return 5;
      case "DHCID":
        return 49;
      case "DLV":
        return 32769;
      case "DNAME":
        return 39;
      case "DNSKEY":
        return 48;
      case "DS":
        return 43;
      case "HIP":
        return 55;
      case "HINFO":
        return 13;
      case "IPSECKEY":
        return 45;
      case "KEY":
        return 25;
      case "KX":
        return 36;
      case "LOC":
        return 29;
      case "MX":
        return 15;
      case "NAPTR":
        return 35;
      case "NS":
        return 2;
      case "NSEC":
        return 47;
      case "NSEC3":
        return 50;
      case "NSEC3PARAM":
        return 51;
      case "PTR":
        return 12;
      case "RRSIG":
        return 46;
      case "RP":
        return 17;
      case "SIG":
        return 24;
      case "SOA":
        return 6;
      case "SPF":
        return 99;
      case "SRV":
        return 33;
      case "SSHFP":
        return 44;
      case "TA":
        return 32768;
      case "TKEY":
        return 249;
      case "TLSA":
        return 52;
      case "TSIG":
        return 250;
      case "TXT":
        return 16;
      case "AXFR":
        return 252;
      case "IXFR":
        return 251;
      case "OPT":
        return 41;
      case "ANY":
        return 255;
      case "*":
        return 255;
    }
    if (name.toUpperCase().startsWith("UNKNOWN_"))
      return parseInt(name.slice(8));
    return 0;
  };
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/rcodes.js
var require_rcodes = __commonJS((exports) => {
  exports.toString = function(rcode) {
    switch (rcode) {
      case 0:
        return "NOERROR";
      case 1:
        return "FORMERR";
      case 2:
        return "SERVFAIL";
      case 3:
        return "NXDOMAIN";
      case 4:
        return "NOTIMP";
      case 5:
        return "REFUSED";
      case 6:
        return "YXDOMAIN";
      case 7:
        return "YXRRSET";
      case 8:
        return "NXRRSET";
      case 9:
        return "NOTAUTH";
      case 10:
        return "NOTZONE";
      case 11:
        return "RCODE_11";
      case 12:
        return "RCODE_12";
      case 13:
        return "RCODE_13";
      case 14:
        return "RCODE_14";
      case 15:
        return "RCODE_15";
    }
    return "RCODE_" + rcode;
  };
  exports.toRcode = function(code) {
    switch (code.toUpperCase()) {
      case "NOERROR":
        return 0;
      case "FORMERR":
        return 1;
      case "SERVFAIL":
        return 2;
      case "NXDOMAIN":
        return 3;
      case "NOTIMP":
        return 4;
      case "REFUSED":
        return 5;
      case "YXDOMAIN":
        return 6;
      case "YXRRSET":
        return 7;
      case "NXRRSET":
        return 8;
      case "NOTAUTH":
        return 9;
      case "NOTZONE":
        return 10;
      case "RCODE_11":
        return 11;
      case "RCODE_12":
        return 12;
      case "RCODE_13":
        return 13;
      case "RCODE_14":
        return 14;
      case "RCODE_15":
        return 15;
    }
    return 0;
  };
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/opcodes.js
var require_opcodes = __commonJS((exports) => {
  exports.toString = function(opcode) {
    switch (opcode) {
      case 0:
        return "QUERY";
      case 1:
        return "IQUERY";
      case 2:
        return "STATUS";
      case 3:
        return "OPCODE_3";
      case 4:
        return "NOTIFY";
      case 5:
        return "UPDATE";
      case 6:
        return "OPCODE_6";
      case 7:
        return "OPCODE_7";
      case 8:
        return "OPCODE_8";
      case 9:
        return "OPCODE_9";
      case 10:
        return "OPCODE_10";
      case 11:
        return "OPCODE_11";
      case 12:
        return "OPCODE_12";
      case 13:
        return "OPCODE_13";
      case 14:
        return "OPCODE_14";
      case 15:
        return "OPCODE_15";
    }
    return "OPCODE_" + opcode;
  };
  exports.toOpcode = function(code) {
    switch (code.toUpperCase()) {
      case "QUERY":
        return 0;
      case "IQUERY":
        return 1;
      case "STATUS":
        return 2;
      case "OPCODE_3":
        return 3;
      case "NOTIFY":
        return 4;
      case "UPDATE":
        return 5;
      case "OPCODE_6":
        return 6;
      case "OPCODE_7":
        return 7;
      case "OPCODE_8":
        return 8;
      case "OPCODE_9":
        return 9;
      case "OPCODE_10":
        return 10;
      case "OPCODE_11":
        return 11;
      case "OPCODE_12":
        return 12;
      case "OPCODE_13":
        return 13;
      case "OPCODE_14":
        return 14;
      case "OPCODE_15":
        return 15;
    }
    return 0;
  };
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/classes.js
var require_classes = __commonJS((exports) => {
  exports.toString = function(klass) {
    switch (klass) {
      case 1:
        return "IN";
      case 2:
        return "CS";
      case 3:
        return "CH";
      case 4:
        return "HS";
      case 255:
        return "ANY";
    }
    return "UNKNOWN_" + klass;
  };
  exports.toClass = function(name) {
    switch (name.toUpperCase()) {
      case "IN":
        return 1;
      case "CS":
        return 2;
      case "CH":
        return 3;
      case "HS":
        return 4;
      case "ANY":
        return 255;
    }
    return 0;
  };
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/optioncodes.js
var require_optioncodes = __commonJS((exports) => {
  exports.toString = function(type) {
    switch (type) {
      case 1:
        return "LLQ";
      case 2:
        return "UL";
      case 3:
        return "NSID";
      case 5:
        return "DAU";
      case 6:
        return "DHU";
      case 7:
        return "N3U";
      case 8:
        return "CLIENT_SUBNET";
      case 9:
        return "EXPIRE";
      case 10:
        return "COOKIE";
      case 11:
        return "TCP_KEEPALIVE";
      case 12:
        return "PADDING";
      case 13:
        return "CHAIN";
      case 14:
        return "KEY_TAG";
      case 26946:
        return "DEVICEID";
    }
    if (type < 0) {
      return null;
    }
    return `OPTION_${type}`;
  };
  exports.toCode = function(name) {
    if (typeof name === "number") {
      return name;
    }
    if (!name) {
      return -1;
    }
    switch (name.toUpperCase()) {
      case "OPTION_0":
        return 0;
      case "LLQ":
        return 1;
      case "UL":
        return 2;
      case "NSID":
        return 3;
      case "OPTION_4":
        return 4;
      case "DAU":
        return 5;
      case "DHU":
        return 6;
      case "N3U":
        return 7;
      case "CLIENT_SUBNET":
        return 8;
      case "EXPIRE":
        return 9;
      case "COOKIE":
        return 10;
      case "TCP_KEEPALIVE":
        return 11;
      case "PADDING":
        return 12;
      case "CHAIN":
        return 13;
      case "KEY_TAG":
        return 14;
      case "DEVICEID":
        return 26946;
      case "OPTION_65535":
        return 65535;
    }
    const m = name.match(/_(\d+)$/);
    if (m) {
      return parseInt(m[1], 10);
    }
    return -1;
  };
});

// node_modules/.pnpm/@leichtgewicht+ip-codec@2.0.5/node_modules/@leichtgewicht/ip-codec/index.cjs
var require_ip_codec = __commonJS((exports, module) => {
  var ipCodec = function(exports2) {
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.decode = decode;
    exports2.encode = encode;
    exports2.familyOf = familyOf;
    exports2.name = undefined;
    exports2.sizeOf = sizeOf;
    exports2.v6 = exports2.v4 = undefined;
    const v4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
    const v4Size = 4;
    const v6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;
    const v6Size = 16;
    const v42 = {
      name: "v4",
      size: v4Size,
      isFormat: (ip) => v4Regex.test(ip),
      encode(ip, buff, offset) {
        offset = ~~offset;
        buff = buff || new Uint8Array(offset + v4Size);
        const max = ip.length;
        let n = 0;
        for (let i = 0;i < max; ) {
          const c = ip.charCodeAt(i++);
          if (c === 46) {
            buff[offset++] = n;
            n = 0;
          } else {
            n = n * 10 + (c - 48);
          }
        }
        buff[offset] = n;
        return buff;
      },
      decode(buff, offset) {
        offset = ~~offset;
        return `${buff[offset++]}.${buff[offset++]}.${buff[offset++]}.${buff[offset]}`;
      }
    };
    exports2.v4 = v42;
    const v6 = {
      name: "v6",
      size: v6Size,
      isFormat: (ip) => ip.length > 0 && v6Regex.test(ip),
      encode(ip, buff, offset) {
        offset = ~~offset;
        let end = offset + v6Size;
        let fill = -1;
        let hexN = 0;
        let decN = 0;
        let prevColon = true;
        let useDec = false;
        buff = buff || new Uint8Array(offset + v6Size);
        for (let i = 0;i < ip.length; i++) {
          let c = ip.charCodeAt(i);
          if (c === 58) {
            if (prevColon) {
              if (fill !== -1) {
                if (offset < end)
                  buff[offset] = 0;
                if (offset < end - 1)
                  buff[offset + 1] = 0;
                offset += 2;
              } else if (offset < end) {
                fill = offset;
              }
            } else {
              if (useDec === true) {
                if (offset < end)
                  buff[offset] = decN;
                offset++;
              } else {
                if (offset < end)
                  buff[offset] = hexN >> 8;
                if (offset < end - 1)
                  buff[offset + 1] = hexN & 255;
                offset += 2;
              }
              hexN = 0;
              decN = 0;
            }
            prevColon = true;
            useDec = false;
          } else if (c === 46) {
            if (offset < end)
              buff[offset] = decN;
            offset++;
            decN = 0;
            hexN = 0;
            prevColon = false;
            useDec = true;
          } else {
            prevColon = false;
            if (c >= 97) {
              c -= 87;
            } else if (c >= 65) {
              c -= 55;
            } else {
              c -= 48;
              decN = decN * 10 + c;
            }
            hexN = (hexN << 4) + c;
          }
        }
        if (prevColon === false) {
          if (useDec === true) {
            if (offset < end)
              buff[offset] = decN;
            offset++;
          } else {
            if (offset < end)
              buff[offset] = hexN >> 8;
            if (offset < end - 1)
              buff[offset + 1] = hexN & 255;
            offset += 2;
          }
        } else if (fill === 0) {
          if (offset < end)
            buff[offset] = 0;
          if (offset < end - 1)
            buff[offset + 1] = 0;
          offset += 2;
        } else if (fill !== -1) {
          offset += 2;
          for (let i = Math.min(offset - 1, end - 1);i >= fill + 2; i--) {
            buff[i] = buff[i - 2];
          }
          buff[fill] = 0;
          buff[fill + 1] = 0;
          fill = offset;
        }
        if (fill !== offset && fill !== -1) {
          if (offset > end - 2) {
            offset = end - 2;
          }
          while (end > fill) {
            buff[--end] = offset < end && offset > fill ? buff[--offset] : 0;
          }
        } else {
          while (offset < end) {
            buff[offset++] = 0;
          }
        }
        return buff;
      },
      decode(buff, offset) {
        offset = ~~offset;
        let result = "";
        for (let i = 0;i < v6Size; i += 2) {
          if (i !== 0) {
            result += ":";
          }
          result += (buff[offset + i] << 8 | buff[offset + i + 1]).toString(16);
        }
        return result.replace(/(^|:)0(:0)*:0(:|$)/, "$1::$3").replace(/:{3,4}/, "::");
      }
    };
    exports2.v6 = v6;
    const name = "ip";
    exports2.name = name;
    function sizeOf(ip) {
      if (v42.isFormat(ip))
        return v42.size;
      if (v6.isFormat(ip))
        return v6.size;
      throw Error(`Invalid ip address: ${ip}`);
    }
    function familyOf(string) {
      return sizeOf(string) === v42.size ? 1 : 2;
    }
    function encode(ip, buff, offset) {
      offset = ~~offset;
      const size = sizeOf(ip);
      if (typeof buff === "function") {
        buff = buff(offset + size);
      }
      if (size === v42.size) {
        return v42.encode(ip, buff, offset);
      }
      return v6.encode(ip, buff, offset);
    }
    function decode(buff, offset, length) {
      offset = ~~offset;
      length = length || buff.length - offset;
      if (length === v42.size) {
        return v42.decode(buff, offset, length);
      }
      if (length === v6.size) {
        return v6.decode(buff, offset, length);
      }
      throw Error(`Invalid buffer size needs to be ${v42.size} for v4 or ${v6.size} for v6.`);
    }
    return "default" in exports2 ? exports2.default : exports2;
  }({});
  if (typeof define === "function" && define.amd)
    define([], function() {
      return ipCodec;
    });
  else if (typeof module === "object" && typeof exports === "object")
    module.exports = ipCodec;
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/index.js
var require_dns_packet = __commonJS((exports) => {
  var Buffer2 = __require("buffer").Buffer;
  var types4 = require_types();
  var rcodes = require_rcodes();
  var opcodes = require_opcodes();
  var classes = require_classes();
  var optioncodes = require_optioncodes();
  var ip = require_ip_codec();
  var QUERY_FLAG = 0;
  var RESPONSE_FLAG = 1 << 15;
  var FLUSH_MASK = 1 << 15;
  var NOT_FLUSH_MASK = ~FLUSH_MASK;
  var QU_MASK = 1 << 15;
  var NOT_QU_MASK = ~QU_MASK;
  var name = exports.name = {};
  name.encode = function(str, buf, offset, { mail = false } = {}) {
    if (!buf)
      buf = Buffer2.alloc(name.encodingLength(str));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const n = str.replace(/^\.|\.$/gm, "");
    if (n.length) {
      let list = [];
      if (mail) {
        let localPart = "";
        n.split(".").forEach((label) => {
          if (label.endsWith("\\")) {
            localPart += (localPart.length ? "." : "") + label.slice(0, -1);
          } else {
            if (list.length === 0 && localPart.length) {
              list.push(localPart + "." + label);
            } else {
              list.push(label);
            }
          }
        });
      } else {
        list = n.split(".");
      }
      for (let i = 0;i < list.length; i++) {
        const len = buf.write(list[i], offset + 1);
        buf[offset] = len;
        offset += len + 1;
      }
    }
    buf[offset++] = 0;
    name.encode.bytes = offset - oldOffset;
    return buf;
  };
  name.encode.bytes = 0;
  name.decode = function(buf, offset, { mail = false } = {}) {
    if (!offset)
      offset = 0;
    const list = [];
    let oldOffset = offset;
    let totalLength = 0;
    let consumedBytes = 0;
    let jumped = false;
    while (true) {
      if (offset >= buf.length) {
        throw new Error("Cannot decode name (buffer overflow)");
      }
      const len = buf[offset++];
      consumedBytes += jumped ? 0 : 1;
      if (len === 0) {
        break;
      } else if ((len & 192) === 0) {
        if (offset + len > buf.length) {
          throw new Error("Cannot decode name (buffer overflow)");
        }
        totalLength += len + 1;
        if (totalLength > 254) {
          throw new Error("Cannot decode name (name too long)");
        }
        let label = buf.toString("utf-8", offset, offset + len);
        if (mail) {
          label = label.replace(/\./g, "\\.");
        }
        list.push(label);
        offset += len;
        consumedBytes += jumped ? 0 : len;
      } else if ((len & 192) === 192) {
        if (offset + 1 > buf.length) {
          throw new Error("Cannot decode name (buffer overflow)");
        }
        const jumpOffset = buf.readUInt16BE(offset - 1) - 49152;
        if (jumpOffset >= oldOffset) {
          throw new Error("Cannot decode name (bad pointer)");
        }
        offset = jumpOffset;
        oldOffset = jumpOffset;
        consumedBytes += jumped ? 0 : 1;
        jumped = true;
      } else {
        throw new Error("Cannot decode name (bad label)");
      }
    }
    name.decode.bytes = consumedBytes;
    return list.length === 0 ? "." : list.join(".");
  };
  name.decode.bytes = 0;
  name.encodingLength = function(n) {
    if (n === "." || n === "..")
      return 1;
    return Buffer2.byteLength(n.replace(/^\.|\.$/gm, "")) + 2;
  };
  var string = {};
  string.encode = function(s, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(string.encodingLength(s));
    if (!offset)
      offset = 0;
    const len = buf.write(s, offset + 1);
    buf[offset] = len;
    string.encode.bytes = len + 1;
    return buf;
  };
  string.encode.bytes = 0;
  string.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const len = buf[offset];
    const s = buf.toString("utf-8", offset + 1, offset + 1 + len);
    string.decode.bytes = len + 1;
    return s;
  };
  string.decode.bytes = 0;
  string.encodingLength = function(s) {
    return Buffer2.byteLength(s) + 1;
  };
  var header = {};
  header.encode = function(h, buf, offset) {
    if (!buf)
      buf = header.encodingLength(h);
    if (!offset)
      offset = 0;
    const flags = (h.flags || 0) & 32767;
    const type = h.type === "response" ? RESPONSE_FLAG : QUERY_FLAG;
    buf.writeUInt16BE(h.id || 0, offset);
    buf.writeUInt16BE(flags | type, offset + 2);
    buf.writeUInt16BE(h.questions.length, offset + 4);
    buf.writeUInt16BE(h.answers.length, offset + 6);
    buf.writeUInt16BE(h.authorities.length, offset + 8);
    buf.writeUInt16BE(h.additionals.length, offset + 10);
    return buf;
  };
  header.encode.bytes = 12;
  header.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    if (buf.length < 12)
      throw new Error("Header must be 12 bytes");
    const flags = buf.readUInt16BE(offset + 2);
    return {
      id: buf.readUInt16BE(offset),
      type: flags & RESPONSE_FLAG ? "response" : "query",
      flags: flags & 32767,
      flag_qr: (flags >> 15 & 1) === 1,
      opcode: opcodes.toString(flags >> 11 & 15),
      flag_aa: (flags >> 10 & 1) === 1,
      flag_tc: (flags >> 9 & 1) === 1,
      flag_rd: (flags >> 8 & 1) === 1,
      flag_ra: (flags >> 7 & 1) === 1,
      flag_z: (flags >> 6 & 1) === 1,
      flag_ad: (flags >> 5 & 1) === 1,
      flag_cd: (flags >> 4 & 1) === 1,
      rcode: rcodes.toString(flags & 15),
      questions: new Array(buf.readUInt16BE(offset + 4)),
      answers: new Array(buf.readUInt16BE(offset + 6)),
      authorities: new Array(buf.readUInt16BE(offset + 8)),
      additionals: new Array(buf.readUInt16BE(offset + 10))
    };
  };
  header.decode.bytes = 12;
  header.encodingLength = function() {
    return 12;
  };
  var runknown = exports.unknown = {};
  runknown.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(runknown.encodingLength(data));
    if (!offset)
      offset = 0;
    buf.writeUInt16BE(data.length, offset);
    data.copy(buf, offset + 2);
    runknown.encode.bytes = data.length + 2;
    return buf;
  };
  runknown.encode.bytes = 0;
  runknown.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const len = buf.readUInt16BE(offset);
    const data = buf.slice(offset + 2, offset + 2 + len);
    runknown.decode.bytes = len + 2;
    return data;
  };
  runknown.decode.bytes = 0;
  runknown.encodingLength = function(data) {
    return data.length + 2;
  };
  var rns = exports.ns = {};
  rns.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rns.encodingLength(data));
    if (!offset)
      offset = 0;
    name.encode(data, buf, offset + 2);
    buf.writeUInt16BE(name.encode.bytes, offset);
    rns.encode.bytes = name.encode.bytes + 2;
    return buf;
  };
  rns.encode.bytes = 0;
  rns.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const len = buf.readUInt16BE(offset);
    const dd = name.decode(buf, offset + 2);
    rns.decode.bytes = len + 2;
    return dd;
  };
  rns.decode.bytes = 0;
  rns.encodingLength = function(data) {
    return name.encodingLength(data) + 2;
  };
  var rsoa = exports.soa = {};
  rsoa.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rsoa.encodingLength(data));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    name.encode(data.mname, buf, offset);
    offset += name.encode.bytes;
    name.encode(data.rname, buf, offset, { mail: true });
    offset += name.encode.bytes;
    buf.writeUInt32BE(data.serial || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.refresh || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.retry || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.expire || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.minimum || 0, offset);
    offset += 4;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rsoa.encode.bytes = offset - oldOffset;
    return buf;
  };
  rsoa.encode.bytes = 0;
  rsoa.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.mname = name.decode(buf, offset);
    offset += name.decode.bytes;
    data.rname = name.decode(buf, offset, { mail: true });
    offset += name.decode.bytes;
    data.serial = buf.readUInt32BE(offset);
    offset += 4;
    data.refresh = buf.readUInt32BE(offset);
    offset += 4;
    data.retry = buf.readUInt32BE(offset);
    offset += 4;
    data.expire = buf.readUInt32BE(offset);
    offset += 4;
    data.minimum = buf.readUInt32BE(offset);
    offset += 4;
    rsoa.decode.bytes = offset - oldOffset;
    return data;
  };
  rsoa.decode.bytes = 0;
  rsoa.encodingLength = function(data) {
    return 22 + name.encodingLength(data.mname) + name.encodingLength(data.rname);
  };
  var rtxt = exports.txt = {};
  rtxt.encode = function(data, buf, offset) {
    if (!Array.isArray(data))
      data = [data];
    for (let i = 0;i < data.length; i++) {
      if (typeof data[i] === "string") {
        data[i] = Buffer2.from(data[i]);
      }
      if (!Buffer2.isBuffer(data[i])) {
        throw new Error("Must be a Buffer");
      }
    }
    if (!buf)
      buf = Buffer2.alloc(rtxt.encodingLength(data));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    data.forEach(function(d) {
      buf[offset++] = d.length;
      d.copy(buf, offset, 0, d.length);
      offset += d.length;
    });
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rtxt.encode.bytes = offset - oldOffset;
    return buf;
  };
  rtxt.encode.bytes = 0;
  rtxt.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    let remaining = buf.readUInt16BE(offset);
    offset += 2;
    let data = [];
    while (remaining > 0) {
      const len = buf[offset++];
      --remaining;
      if (remaining < len) {
        throw new Error("Buffer overflow");
      }
      data.push(buf.slice(offset, offset + len));
      offset += len;
      remaining -= len;
    }
    rtxt.decode.bytes = offset - oldOffset;
    return data;
  };
  rtxt.decode.bytes = 0;
  rtxt.encodingLength = function(data) {
    if (!Array.isArray(data))
      data = [data];
    let length = 2;
    data.forEach(function(buf) {
      if (typeof buf === "string") {
        length += Buffer2.byteLength(buf) + 1;
      } else {
        length += buf.length + 1;
      }
    });
    return length;
  };
  var rnull = exports.null = {};
  rnull.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rnull.encodingLength(data));
    if (!offset)
      offset = 0;
    if (typeof data === "string")
      data = Buffer2.from(data);
    if (!data)
      data = Buffer2.alloc(0);
    const oldOffset = offset;
    offset += 2;
    const len = data.length;
    data.copy(buf, offset, 0, len);
    offset += len;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rnull.encode.bytes = offset - oldOffset;
    return buf;
  };
  rnull.encode.bytes = 0;
  rnull.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const len = buf.readUInt16BE(offset);
    offset += 2;
    const data = buf.slice(offset, offset + len);
    offset += len;
    rnull.decode.bytes = offset - oldOffset;
    return data;
  };
  rnull.decode.bytes = 0;
  rnull.encodingLength = function(data) {
    if (!data)
      return 2;
    return (Buffer2.isBuffer(data) ? data.length : Buffer2.byteLength(data)) + 2;
  };
  var rhinfo = exports.hinfo = {};
  rhinfo.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rhinfo.encodingLength(data));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    string.encode(data.cpu, buf, offset);
    offset += string.encode.bytes;
    string.encode(data.os, buf, offset);
    offset += string.encode.bytes;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rhinfo.encode.bytes = offset - oldOffset;
    return buf;
  };
  rhinfo.encode.bytes = 0;
  rhinfo.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.cpu = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.os = string.decode(buf, offset);
    offset += string.decode.bytes;
    rhinfo.decode.bytes = offset - oldOffset;
    return data;
  };
  rhinfo.decode.bytes = 0;
  rhinfo.encodingLength = function(data) {
    return string.encodingLength(data.cpu) + string.encodingLength(data.os) + 2;
  };
  var rptr = exports.ptr = {};
  var rcname = exports.cname = rptr;
  var rdname = exports.dname = rptr;
  rptr.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rptr.encodingLength(data));
    if (!offset)
      offset = 0;
    name.encode(data, buf, offset + 2);
    buf.writeUInt16BE(name.encode.bytes, offset);
    rptr.encode.bytes = name.encode.bytes + 2;
    return buf;
  };
  rptr.encode.bytes = 0;
  rptr.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const data = name.decode(buf, offset + 2);
    rptr.decode.bytes = name.decode.bytes + 2;
    return data;
  };
  rptr.decode.bytes = 0;
  rptr.encodingLength = function(data) {
    return name.encodingLength(data) + 2;
  };
  var rsrv = exports.srv = {};
  rsrv.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rsrv.encodingLength(data));
    if (!offset)
      offset = 0;
    buf.writeUInt16BE(data.priority || 0, offset + 2);
    buf.writeUInt16BE(data.weight || 0, offset + 4);
    buf.writeUInt16BE(data.port || 0, offset + 6);
    name.encode(data.target, buf, offset + 8);
    const len = name.encode.bytes + 6;
    buf.writeUInt16BE(len, offset);
    rsrv.encode.bytes = len + 2;
    return buf;
  };
  rsrv.encode.bytes = 0;
  rsrv.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const len = buf.readUInt16BE(offset);
    const data = {};
    data.priority = buf.readUInt16BE(offset + 2);
    data.weight = buf.readUInt16BE(offset + 4);
    data.port = buf.readUInt16BE(offset + 6);
    data.target = name.decode(buf, offset + 8);
    rsrv.decode.bytes = len + 2;
    return data;
  };
  rsrv.decode.bytes = 0;
  rsrv.encodingLength = function(data) {
    return 8 + name.encodingLength(data.target);
  };
  var rcaa = exports.caa = {};
  rcaa.ISSUER_CRITICAL = 1 << 7;
  rcaa.encode = function(data, buf, offset) {
    const len = rcaa.encodingLength(data);
    if (!buf)
      buf = Buffer2.alloc(rcaa.encodingLength(data));
    if (!offset)
      offset = 0;
    if (data.issuerCritical) {
      data.flags = rcaa.ISSUER_CRITICAL;
    }
    buf.writeUInt16BE(len - 2, offset);
    offset += 2;
    buf.writeUInt8(data.flags || 0, offset);
    offset += 1;
    string.encode(data.tag, buf, offset);
    offset += string.encode.bytes;
    buf.write(data.value, offset);
    offset += Buffer2.byteLength(data.value);
    rcaa.encode.bytes = len;
    return buf;
  };
  rcaa.encode.bytes = 0;
  rcaa.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const len = buf.readUInt16BE(offset);
    offset += 2;
    const oldOffset = offset;
    const data = {};
    data.flags = buf.readUInt8(offset);
    offset += 1;
    data.tag = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.value = buf.toString("utf-8", offset, oldOffset + len);
    data.issuerCritical = !!(data.flags & rcaa.ISSUER_CRITICAL);
    rcaa.decode.bytes = len + 2;
    return data;
  };
  rcaa.decode.bytes = 0;
  rcaa.encodingLength = function(data) {
    return string.encodingLength(data.tag) + string.encodingLength(data.value) + 2;
  };
  var rmx = exports.mx = {};
  rmx.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rmx.encodingLength(data));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    buf.writeUInt16BE(data.preference || 0, offset);
    offset += 2;
    name.encode(data.exchange, buf, offset);
    offset += name.encode.bytes;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rmx.encode.bytes = offset - oldOffset;
    return buf;
  };
  rmx.encode.bytes = 0;
  rmx.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.preference = buf.readUInt16BE(offset);
    offset += 2;
    data.exchange = name.decode(buf, offset);
    offset += name.decode.bytes;
    rmx.decode.bytes = offset - oldOffset;
    return data;
  };
  rmx.encodingLength = function(data) {
    return 4 + name.encodingLength(data.exchange);
  };
  var ra = exports.a = {};
  ra.encode = function(host, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(ra.encodingLength(host));
    if (!offset)
      offset = 0;
    buf.writeUInt16BE(4, offset);
    offset += 2;
    ip.v4.encode(host, buf, offset);
    ra.encode.bytes = 6;
    return buf;
  };
  ra.encode.bytes = 0;
  ra.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    offset += 2;
    const host = ip.v4.decode(buf, offset);
    ra.decode.bytes = 6;
    return host;
  };
  ra.decode.bytes = 0;
  ra.encodingLength = function() {
    return 6;
  };
  var raaaa = exports.aaaa = {};
  raaaa.encode = function(host, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(raaaa.encodingLength(host));
    if (!offset)
      offset = 0;
    buf.writeUInt16BE(16, offset);
    offset += 2;
    ip.v6.encode(host, buf, offset);
    raaaa.encode.bytes = 18;
    return buf;
  };
  raaaa.encode.bytes = 0;
  raaaa.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    offset += 2;
    const host = ip.v6.decode(buf, offset);
    raaaa.decode.bytes = 18;
    return host;
  };
  raaaa.decode.bytes = 0;
  raaaa.encodingLength = function() {
    return 18;
  };
  var roption = exports.option = {};
  roption.encode = function(option, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(roption.encodingLength(option));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const code = optioncodes.toCode(option.code);
    buf.writeUInt16BE(code, offset);
    offset += 2;
    if (option.data) {
      buf.writeUInt16BE(option.data.length, offset);
      offset += 2;
      option.data.copy(buf, offset);
      offset += option.data.length;
    } else {
      switch (code) {
        case 8:
          const spl = option.sourcePrefixLength || 0;
          const fam = option.family || ip.familyOf(option.ip);
          const ipBuf = ip.encode(option.ip, Buffer2.alloc);
          const ipLen = Math.ceil(spl / 8);
          buf.writeUInt16BE(ipLen + 4, offset);
          offset += 2;
          buf.writeUInt16BE(fam, offset);
          offset += 2;
          buf.writeUInt8(spl, offset++);
          buf.writeUInt8(option.scopePrefixLength || 0, offset++);
          ipBuf.copy(buf, offset, 0, ipLen);
          offset += ipLen;
          break;
        case 11:
          if (option.timeout) {
            buf.writeUInt16BE(2, offset);
            offset += 2;
            buf.writeUInt16BE(option.timeout, offset);
            offset += 2;
          } else {
            buf.writeUInt16BE(0, offset);
            offset += 2;
          }
          break;
        case 12:
          const len = option.length || 0;
          buf.writeUInt16BE(len, offset);
          offset += 2;
          buf.fill(0, offset, offset + len);
          offset += len;
          break;
        case 14:
          const tagsLen = option.tags.length * 2;
          buf.writeUInt16BE(tagsLen, offset);
          offset += 2;
          for (const tag of option.tags) {
            buf.writeUInt16BE(tag, offset);
            offset += 2;
          }
          break;
        default:
          throw new Error(`Unknown roption code: ${option.code}`);
      }
    }
    roption.encode.bytes = offset - oldOffset;
    return buf;
  };
  roption.encode.bytes = 0;
  roption.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const option = {};
    option.code = buf.readUInt16BE(offset);
    option.type = optioncodes.toString(option.code);
    offset += 2;
    const len = buf.readUInt16BE(offset);
    offset += 2;
    option.data = buf.slice(offset, offset + len);
    switch (option.code) {
      case 8:
        option.family = buf.readUInt16BE(offset);
        offset += 2;
        option.sourcePrefixLength = buf.readUInt8(offset++);
        option.scopePrefixLength = buf.readUInt8(offset++);
        const padded = Buffer2.alloc(option.family === 1 ? 4 : 16);
        buf.copy(padded, 0, offset, offset + len - 4);
        option.ip = ip.decode(padded);
        break;
      case 11:
        if (len > 0) {
          option.timeout = buf.readUInt16BE(offset);
          offset += 2;
        }
        break;
      case 14:
        option.tags = [];
        for (let i = 0;i < len; i += 2) {
          option.tags.push(buf.readUInt16BE(offset));
          offset += 2;
        }
    }
    roption.decode.bytes = len + 4;
    return option;
  };
  roption.decode.bytes = 0;
  roption.encodingLength = function(option) {
    if (option.data) {
      return option.data.length + 4;
    }
    const code = optioncodes.toCode(option.code);
    switch (code) {
      case 8:
        const spl = option.sourcePrefixLength || 0;
        return Math.ceil(spl / 8) + 8;
      case 11:
        return typeof option.timeout === "number" ? 6 : 4;
      case 12:
        return option.length + 4;
      case 14:
        return 4 + option.tags.length * 2;
    }
    throw new Error(`Unknown roption code: ${option.code}`);
  };
  var ropt = exports.opt = {};
  ropt.encode = function(options, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(ropt.encodingLength(options));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const rdlen = encodingLengthList(options, roption);
    buf.writeUInt16BE(rdlen, offset);
    offset = encodeList(options, roption, buf, offset + 2);
    ropt.encode.bytes = offset - oldOffset;
    return buf;
  };
  ropt.encode.bytes = 0;
  ropt.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const options = [];
    let rdlen = buf.readUInt16BE(offset);
    offset += 2;
    let o = 0;
    while (rdlen > 0) {
      options[o++] = roption.decode(buf, offset);
      offset += roption.decode.bytes;
      rdlen -= roption.decode.bytes;
    }
    ropt.decode.bytes = offset - oldOffset;
    return options;
  };
  ropt.decode.bytes = 0;
  ropt.encodingLength = function(options) {
    return 2 + encodingLengthList(options || [], roption);
  };
  var rdnskey = exports.dnskey = {};
  rdnskey.PROTOCOL_DNSSEC = 3;
  rdnskey.ZONE_KEY = 128;
  rdnskey.SECURE_ENTRYPOINT = 32768;
  rdnskey.encode = function(key, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rdnskey.encodingLength(key));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const keydata = key.key;
    if (!Buffer2.isBuffer(keydata)) {
      throw new Error("Key must be a Buffer");
    }
    offset += 2;
    buf.writeUInt16BE(key.flags, offset);
    offset += 2;
    buf.writeUInt8(rdnskey.PROTOCOL_DNSSEC, offset);
    offset += 1;
    buf.writeUInt8(key.algorithm, offset);
    offset += 1;
    keydata.copy(buf, offset, 0, keydata.length);
    offset += keydata.length;
    rdnskey.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rdnskey.encode.bytes - 2, oldOffset);
    return buf;
  };
  rdnskey.encode.bytes = 0;
  rdnskey.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var key = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    key.flags = buf.readUInt16BE(offset);
    offset += 2;
    if (buf.readUInt8(offset) !== rdnskey.PROTOCOL_DNSSEC) {
      throw new Error("Protocol must be 3");
    }
    offset += 1;
    key.algorithm = buf.readUInt8(offset);
    offset += 1;
    key.key = buf.slice(offset, oldOffset + length + 2);
    offset += key.key.length;
    rdnskey.decode.bytes = offset - oldOffset;
    return key;
  };
  rdnskey.decode.bytes = 0;
  rdnskey.encodingLength = function(key) {
    return 6 + Buffer2.byteLength(key.key);
  };
  var rrrsig = exports.rrsig = {};
  rrrsig.encode = function(sig, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rrrsig.encodingLength(sig));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const signature = sig.signature;
    if (!Buffer2.isBuffer(signature)) {
      throw new Error("Signature must be a Buffer");
    }
    offset += 2;
    buf.writeUInt16BE(types4.toType(sig.typeCovered), offset);
    offset += 2;
    buf.writeUInt8(sig.algorithm, offset);
    offset += 1;
    buf.writeUInt8(sig.labels, offset);
    offset += 1;
    buf.writeUInt32BE(sig.originalTTL, offset);
    offset += 4;
    buf.writeUInt32BE(sig.expiration, offset);
    offset += 4;
    buf.writeUInt32BE(sig.inception, offset);
    offset += 4;
    buf.writeUInt16BE(sig.keyTag, offset);
    offset += 2;
    name.encode(sig.signersName, buf, offset);
    offset += name.encode.bytes;
    signature.copy(buf, offset, 0, signature.length);
    offset += signature.length;
    rrrsig.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rrrsig.encode.bytes - 2, oldOffset);
    return buf;
  };
  rrrsig.encode.bytes = 0;
  rrrsig.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var sig = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    sig.typeCovered = types4.toString(buf.readUInt16BE(offset));
    offset += 2;
    sig.algorithm = buf.readUInt8(offset);
    offset += 1;
    sig.labels = buf.readUInt8(offset);
    offset += 1;
    sig.originalTTL = buf.readUInt32BE(offset);
    offset += 4;
    sig.expiration = buf.readUInt32BE(offset);
    offset += 4;
    sig.inception = buf.readUInt32BE(offset);
    offset += 4;
    sig.keyTag = buf.readUInt16BE(offset);
    offset += 2;
    sig.signersName = name.decode(buf, offset);
    offset += name.decode.bytes;
    sig.signature = buf.slice(offset, oldOffset + length + 2);
    offset += sig.signature.length;
    rrrsig.decode.bytes = offset - oldOffset;
    return sig;
  };
  rrrsig.decode.bytes = 0;
  rrrsig.encodingLength = function(sig) {
    return 20 + name.encodingLength(sig.signersName) + Buffer2.byteLength(sig.signature);
  };
  var rrp = exports.rp = {};
  rrp.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rrp.encodingLength(data));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    name.encode(data.mbox || ".", buf, offset, { mail: true });
    offset += name.encode.bytes;
    name.encode(data.txt || ".", buf, offset);
    offset += name.encode.bytes;
    rrp.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rrp.encode.bytes - 2, oldOffset);
    return buf;
  };
  rrp.encode.bytes = 0;
  rrp.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.mbox = name.decode(buf, offset, { mail: true }) || ".";
    offset += name.decode.bytes;
    data.txt = name.decode(buf, offset) || ".";
    offset += name.decode.bytes;
    rrp.decode.bytes = offset - oldOffset;
    return data;
  };
  rrp.decode.bytes = 0;
  rrp.encodingLength = function(data) {
    return 2 + name.encodingLength(data.mbox || ".") + name.encodingLength(data.txt || ".");
  };
  var typebitmap = {};
  typebitmap.encode = function(typelist, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(typebitmap.encodingLength(typelist));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var typesByWindow = [];
    for (var i = 0;i < typelist.length; i++) {
      var typeid = types4.toType(typelist[i]);
      if (typesByWindow[typeid >> 8] === undefined) {
        typesByWindow[typeid >> 8] = [];
      }
      typesByWindow[typeid >> 8][typeid >> 3 & 31] |= 1 << 7 - (typeid & 7);
    }
    for (i = 0;i < typesByWindow.length; i++) {
      if (typesByWindow[i] !== undefined) {
        var windowBuf = Buffer2.from(typesByWindow[i]);
        buf.writeUInt8(i, offset);
        offset += 1;
        buf.writeUInt8(windowBuf.length, offset);
        offset += 1;
        windowBuf.copy(buf, offset);
        offset += windowBuf.length;
      }
    }
    typebitmap.encode.bytes = offset - oldOffset;
    return buf;
  };
  typebitmap.encode.bytes = 0;
  typebitmap.decode = function(buf, offset, length) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var typelist = [];
    while (offset - oldOffset < length) {
      var window = buf.readUInt8(offset);
      offset += 1;
      var windowLength = buf.readUInt8(offset);
      offset += 1;
      for (var i = 0;i < windowLength; i++) {
        var b = buf.readUInt8(offset + i);
        for (var j = 0;j < 8; j++) {
          if (b & 1 << 7 - j) {
            var typeid = types4.toString(window << 8 | i << 3 | j);
            typelist.push(typeid);
          }
        }
      }
      offset += windowLength;
    }
    typebitmap.decode.bytes = offset - oldOffset;
    return typelist;
  };
  typebitmap.decode.bytes = 0;
  typebitmap.encodingLength = function(typelist) {
    var extents = [];
    for (var i = 0;i < typelist.length; i++) {
      var typeid = types4.toType(typelist[i]);
      extents[typeid >> 8] = Math.max(extents[typeid >> 8] || 0, typeid & 255);
    }
    var len = 0;
    for (i = 0;i < extents.length; i++) {
      if (extents[i] !== undefined) {
        len += 2 + Math.ceil((extents[i] + 1) / 8);
      }
    }
    return len;
  };
  var rnsec = exports.nsec = {};
  rnsec.encode = function(record, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rnsec.encodingLength(record));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    name.encode(record.nextDomain, buf, offset);
    offset += name.encode.bytes;
    typebitmap.encode(record.rrtypes, buf, offset);
    offset += typebitmap.encode.bytes;
    rnsec.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rnsec.encode.bytes - 2, oldOffset);
    return buf;
  };
  rnsec.encode.bytes = 0;
  rnsec.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var record = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    record.nextDomain = name.decode(buf, offset);
    offset += name.decode.bytes;
    record.rrtypes = typebitmap.decode(buf, offset, length - (offset - oldOffset));
    offset += typebitmap.decode.bytes;
    rnsec.decode.bytes = offset - oldOffset;
    return record;
  };
  rnsec.decode.bytes = 0;
  rnsec.encodingLength = function(record) {
    return 2 + name.encodingLength(record.nextDomain) + typebitmap.encodingLength(record.rrtypes);
  };
  var rnsec3 = exports.nsec3 = {};
  rnsec3.encode = function(record, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rnsec3.encodingLength(record));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const salt = record.salt;
    if (!Buffer2.isBuffer(salt)) {
      throw new Error("salt must be a Buffer");
    }
    const nextDomain = record.nextDomain;
    if (!Buffer2.isBuffer(nextDomain)) {
      throw new Error("nextDomain must be a Buffer");
    }
    offset += 2;
    buf.writeUInt8(record.algorithm, offset);
    offset += 1;
    buf.writeUInt8(record.flags, offset);
    offset += 1;
    buf.writeUInt16BE(record.iterations, offset);
    offset += 2;
    buf.writeUInt8(salt.length, offset);
    offset += 1;
    salt.copy(buf, offset, 0, salt.length);
    offset += salt.length;
    buf.writeUInt8(nextDomain.length, offset);
    offset += 1;
    nextDomain.copy(buf, offset, 0, nextDomain.length);
    offset += nextDomain.length;
    typebitmap.encode(record.rrtypes, buf, offset);
    offset += typebitmap.encode.bytes;
    rnsec3.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rnsec3.encode.bytes - 2, oldOffset);
    return buf;
  };
  rnsec3.encode.bytes = 0;
  rnsec3.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var record = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    record.algorithm = buf.readUInt8(offset);
    offset += 1;
    record.flags = buf.readUInt8(offset);
    offset += 1;
    record.iterations = buf.readUInt16BE(offset);
    offset += 2;
    const saltLength = buf.readUInt8(offset);
    offset += 1;
    record.salt = buf.slice(offset, offset + saltLength);
    offset += saltLength;
    const hashLength = buf.readUInt8(offset);
    offset += 1;
    record.nextDomain = buf.slice(offset, offset + hashLength);
    offset += hashLength;
    record.rrtypes = typebitmap.decode(buf, offset, length - (offset - oldOffset));
    offset += typebitmap.decode.bytes;
    rnsec3.decode.bytes = offset - oldOffset;
    return record;
  };
  rnsec3.decode.bytes = 0;
  rnsec3.encodingLength = function(record) {
    return 8 + record.salt.length + record.nextDomain.length + typebitmap.encodingLength(record.rrtypes);
  };
  var rds = exports.ds = {};
  rds.encode = function(digest, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rds.encodingLength(digest));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const digestdata = digest.digest;
    if (!Buffer2.isBuffer(digestdata)) {
      throw new Error("Digest must be a Buffer");
    }
    offset += 2;
    buf.writeUInt16BE(digest.keyTag, offset);
    offset += 2;
    buf.writeUInt8(digest.algorithm, offset);
    offset += 1;
    buf.writeUInt8(digest.digestType, offset);
    offset += 1;
    digestdata.copy(buf, offset, 0, digestdata.length);
    offset += digestdata.length;
    rds.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rds.encode.bytes - 2, oldOffset);
    return buf;
  };
  rds.encode.bytes = 0;
  rds.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    var digest = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    digest.keyTag = buf.readUInt16BE(offset);
    offset += 2;
    digest.algorithm = buf.readUInt8(offset);
    offset += 1;
    digest.digestType = buf.readUInt8(offset);
    offset += 1;
    digest.digest = buf.slice(offset, oldOffset + length + 2);
    offset += digest.digest.length;
    rds.decode.bytes = offset - oldOffset;
    return digest;
  };
  rds.decode.bytes = 0;
  rds.encodingLength = function(digest) {
    return 6 + Buffer2.byteLength(digest.digest);
  };
  var rsshfp = exports.sshfp = {};
  rsshfp.getFingerprintLengthForHashType = function getFingerprintLengthForHashType(hashType) {
    switch (hashType) {
      case 1:
        return 20;
      case 2:
        return 32;
    }
  };
  rsshfp.encode = function encode(record, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rsshfp.encodingLength(record));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    buf[offset] = record.algorithm;
    offset += 1;
    buf[offset] = record.hash;
    offset += 1;
    const fingerprintBuf = Buffer2.from(record.fingerprint.toUpperCase(), "hex");
    if (fingerprintBuf.length !== rsshfp.getFingerprintLengthForHashType(record.hash)) {
      throw new Error("Invalid fingerprint length");
    }
    fingerprintBuf.copy(buf, offset);
    offset += fingerprintBuf.byteLength;
    rsshfp.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rsshfp.encode.bytes - 2, oldOffset);
    return buf;
  };
  rsshfp.encode.bytes = 0;
  rsshfp.decode = function decode(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const record = {};
    offset += 2;
    record.algorithm = buf[offset];
    offset += 1;
    record.hash = buf[offset];
    offset += 1;
    const fingerprintLength = rsshfp.getFingerprintLengthForHashType(record.hash);
    record.fingerprint = buf.slice(offset, offset + fingerprintLength).toString("hex").toUpperCase();
    offset += fingerprintLength;
    rsshfp.decode.bytes = offset - oldOffset;
    return record;
  };
  rsshfp.decode.bytes = 0;
  rsshfp.encodingLength = function(record) {
    return 4 + Buffer2.from(record.fingerprint, "hex").byteLength;
  };
  var rnaptr = exports.naptr = {};
  rnaptr.encode = function(data, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rnaptr.encodingLength(data));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    offset += 2;
    buf.writeUInt16BE(data.order || 0, offset);
    offset += 2;
    buf.writeUInt16BE(data.preference || 0, offset);
    offset += 2;
    string.encode(data.flags, buf, offset);
    offset += string.encode.bytes;
    string.encode(data.services, buf, offset);
    offset += string.encode.bytes;
    string.encode(data.regexp, buf, offset);
    offset += string.encode.bytes;
    name.encode(data.replacement, buf, offset);
    offset += name.encode.bytes;
    rnaptr.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rnaptr.encode.bytes - 2, oldOffset);
    return buf;
  };
  rnaptr.encode.bytes = 0;
  rnaptr.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.order = buf.readUInt16BE(offset);
    offset += 2;
    data.preference = buf.readUInt16BE(offset);
    offset += 2;
    data.flags = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.services = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.regexp = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.replacement = name.decode(buf, offset);
    offset += name.decode.bytes;
    rnaptr.decode.bytes = offset - oldOffset;
    return data;
  };
  rnaptr.decode.bytes = 0;
  rnaptr.encodingLength = function(data) {
    return string.encodingLength(data.flags) + string.encodingLength(data.services) + string.encodingLength(data.regexp) + name.encodingLength(data.replacement) + 6;
  };
  var rtlsa = exports.tlsa = {};
  rtlsa.encode = function(cert, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(rtlsa.encodingLength(cert));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const certdata = cert.certificate;
    if (!Buffer2.isBuffer(certdata)) {
      throw new Error("Certificate must be a Buffer");
    }
    offset += 2;
    buf.writeUInt8(cert.usage, offset);
    offset += 1;
    buf.writeUInt8(cert.selector, offset);
    offset += 1;
    buf.writeUInt8(cert.matchingType, offset);
    offset += 1;
    certdata.copy(buf, offset, 0, certdata.length);
    offset += certdata.length;
    rtlsa.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rtlsa.encode.bytes - 2, oldOffset);
    return buf;
  };
  rtlsa.encode.bytes = 0;
  rtlsa.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const cert = {};
    const length = buf.readUInt16BE(offset);
    offset += 2;
    cert.usage = buf.readUInt8(offset);
    offset += 1;
    cert.selector = buf.readUInt8(offset);
    offset += 1;
    cert.matchingType = buf.readUInt8(offset);
    offset += 1;
    cert.certificate = buf.slice(offset, oldOffset + length + 2);
    offset += cert.certificate.length;
    rtlsa.decode.bytes = offset - oldOffset;
    return cert;
  };
  rtlsa.decode.bytes = 0;
  rtlsa.encodingLength = function(cert) {
    return 5 + Buffer2.byteLength(cert.certificate);
  };
  var renc = exports.record = function(type) {
    switch (type.toUpperCase()) {
      case "A":
        return ra;
      case "PTR":
        return rptr;
      case "CNAME":
        return rcname;
      case "DNAME":
        return rdname;
      case "TXT":
        return rtxt;
      case "NULL":
        return rnull;
      case "AAAA":
        return raaaa;
      case "SRV":
        return rsrv;
      case "HINFO":
        return rhinfo;
      case "CAA":
        return rcaa;
      case "NS":
        return rns;
      case "SOA":
        return rsoa;
      case "MX":
        return rmx;
      case "OPT":
        return ropt;
      case "DNSKEY":
        return rdnskey;
      case "RRSIG":
        return rrrsig;
      case "RP":
        return rrp;
      case "NSEC":
        return rnsec;
      case "NSEC3":
        return rnsec3;
      case "SSHFP":
        return rsshfp;
      case "DS":
        return rds;
      case "NAPTR":
        return rnaptr;
      case "TLSA":
        return rtlsa;
    }
    return runknown;
  };
  var answer = exports.answer = {};
  answer.encode = function(a, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(answer.encodingLength(a));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    name.encode(a.name, buf, offset);
    offset += name.encode.bytes;
    buf.writeUInt16BE(types4.toType(a.type), offset);
    if (a.type.toUpperCase() === "OPT") {
      if (a.name !== ".") {
        throw new Error("OPT name must be root.");
      }
      buf.writeUInt16BE(a.udpPayloadSize || 4096, offset + 2);
      buf.writeUInt8(a.extendedRcode || 0, offset + 4);
      buf.writeUInt8(a.ednsVersion || 0, offset + 5);
      buf.writeUInt16BE(a.flags || 0, offset + 6);
      offset += 8;
      ropt.encode(a.options || [], buf, offset);
      offset += ropt.encode.bytes;
    } else {
      let klass = classes.toClass(a.class === undefined ? "IN" : a.class);
      if (a.flush)
        klass |= FLUSH_MASK;
      buf.writeUInt16BE(klass, offset + 2);
      buf.writeUInt32BE(a.ttl || 0, offset + 4);
      offset += 8;
      const enc = renc(a.type);
      enc.encode(a.data, buf, offset);
      offset += enc.encode.bytes;
    }
    answer.encode.bytes = offset - oldOffset;
    return buf;
  };
  answer.encode.bytes = 0;
  answer.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const a = {};
    const oldOffset = offset;
    a.name = name.decode(buf, offset);
    offset += name.decode.bytes;
    a.type = types4.toString(buf.readUInt16BE(offset));
    if (a.type === "OPT") {
      a.udpPayloadSize = buf.readUInt16BE(offset + 2);
      a.extendedRcode = buf.readUInt8(offset + 4);
      a.ednsVersion = buf.readUInt8(offset + 5);
      a.flags = buf.readUInt16BE(offset + 6);
      a.flag_do = (a.flags >> 15 & 1) === 1;
      a.options = ropt.decode(buf, offset + 8);
      offset += 8 + ropt.decode.bytes;
    } else {
      const klass = buf.readUInt16BE(offset + 2);
      a.ttl = buf.readUInt32BE(offset + 4);
      a.class = classes.toString(klass & NOT_FLUSH_MASK);
      a.flush = !!(klass & FLUSH_MASK);
      const enc = renc(a.type);
      a.data = enc.decode(buf, offset + 8);
      offset += 8 + enc.decode.bytes;
    }
    answer.decode.bytes = offset - oldOffset;
    return a;
  };
  answer.decode.bytes = 0;
  answer.encodingLength = function(a) {
    const data = a.data !== null && a.data !== undefined ? a.data : a.options;
    return name.encodingLength(a.name) + 8 + renc(a.type).encodingLength(data);
  };
  var question = exports.question = {};
  question.encode = function(q, buf, offset) {
    if (!buf)
      buf = Buffer2.alloc(question.encodingLength(q));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    name.encode(q.name, buf, offset);
    offset += name.encode.bytes;
    buf.writeUInt16BE(types4.toType(q.type), offset);
    offset += 2;
    buf.writeUInt16BE(classes.toClass(q.class === undefined ? "IN" : q.class), offset);
    offset += 2;
    question.encode.bytes = offset - oldOffset;
    return q;
  };
  question.encode.bytes = 0;
  question.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const q = {};
    q.name = name.decode(buf, offset);
    offset += name.decode.bytes;
    q.type = types4.toString(buf.readUInt16BE(offset));
    offset += 2;
    q.class = classes.toString(buf.readUInt16BE(offset));
    offset += 2;
    const qu = !!(q.class & QU_MASK);
    if (qu)
      q.class &= NOT_QU_MASK;
    question.decode.bytes = offset - oldOffset;
    return q;
  };
  question.decode.bytes = 0;
  question.encodingLength = function(q) {
    return name.encodingLength(q.name) + 4;
  };
  exports.AUTHORITATIVE_ANSWER = 1 << 10;
  exports.TRUNCATED_RESPONSE = 1 << 9;
  exports.RECURSION_DESIRED = 1 << 8;
  exports.RECURSION_AVAILABLE = 1 << 7;
  exports.AUTHENTIC_DATA = 1 << 5;
  exports.CHECKING_DISABLED = 1 << 4;
  exports.DNSSEC_OK = 1 << 15;
  exports.encode = function(result, buf, offset) {
    const allocing = !buf;
    if (allocing)
      buf = Buffer2.alloc(exports.encodingLength(result));
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    if (!result.questions)
      result.questions = [];
    if (!result.answers)
      result.answers = [];
    if (!result.authorities)
      result.authorities = [];
    if (!result.additionals)
      result.additionals = [];
    header.encode(result, buf, offset);
    offset += header.encode.bytes;
    offset = encodeList(result.questions, question, buf, offset);
    offset = encodeList(result.answers, answer, buf, offset);
    offset = encodeList(result.authorities, answer, buf, offset);
    offset = encodeList(result.additionals, answer, buf, offset);
    exports.encode.bytes = offset - oldOffset;
    if (allocing && exports.encode.bytes !== buf.length) {
      return buf.slice(0, exports.encode.bytes);
    }
    return buf;
  };
  exports.encode.bytes = 0;
  exports.decode = function(buf, offset) {
    if (!offset)
      offset = 0;
    const oldOffset = offset;
    const result = header.decode(buf, offset);
    offset += header.decode.bytes;
    offset = decodeList(result.questions, question, buf, offset);
    offset = decodeList(result.answers, answer, buf, offset);
    offset = decodeList(result.authorities, answer, buf, offset);
    offset = decodeList(result.additionals, answer, buf, offset);
    exports.decode.bytes = offset - oldOffset;
    return result;
  };
  exports.decode.bytes = 0;
  exports.encodingLength = function(result) {
    return header.encodingLength(result) + encodingLengthList(result.questions || [], question) + encodingLengthList(result.answers || [], answer) + encodingLengthList(result.authorities || [], answer) + encodingLengthList(result.additionals || [], answer);
  };
  exports.streamEncode = function(result) {
    const buf = exports.encode(result);
    const sbuf = Buffer2.alloc(2);
    sbuf.writeUInt16BE(buf.byteLength);
    const combine = Buffer2.concat([sbuf, buf]);
    exports.streamEncode.bytes = combine.byteLength;
    return combine;
  };
  exports.streamEncode.bytes = 0;
  exports.streamDecode = function(sbuf) {
    const len = sbuf.readUInt16BE(0);
    if (sbuf.byteLength < len + 2) {
      return null;
    }
    const result = exports.decode(sbuf.slice(2));
    exports.streamDecode.bytes = exports.decode.bytes;
    return result;
  };
  exports.streamDecode.bytes = 0;
  function encodingLengthList(list, enc) {
    let len = 0;
    for (let i = 0;i < list.length; i++)
      len += enc.encodingLength(list[i]);
    return len;
  }
  function encodeList(list, enc, buf, offset) {
    for (let i = 0;i < list.length; i++) {
      enc.encode(list[i], buf, offset);
      offset += enc.encode.bytes;
    }
    return offset;
  }
  function decodeList(list, enc, buf, offset) {
    for (let i = 0;i < list.length; i++) {
      list[i] = enc.decode(buf, offset);
      offset += enc.decode.bytes;
    }
    return offset;
  }
});

// node_modules/.pnpm/thunky@1.1.0/node_modules/thunky/index.js
var require_thunky = __commonJS((exports, module) => {
  var nextTick = nextTickArgs;
  process.nextTick(upgrade, 42);
  module.exports = thunky;
  function thunky(fn) {
    var state = run2;
    return thunk;
    function thunk(callback) {
      state(callback || noop);
    }
    function run2(callback) {
      var stack = [callback];
      state = wait2;
      fn(done);
      function wait2(callback2) {
        stack.push(callback2);
      }
      function done(err) {
        var args = arguments;
        state = isError(err) ? run2 : finished;
        while (stack.length)
          finished(stack.shift());
        function finished(callback2) {
          nextTick(apply, callback2, args);
        }
      }
    }
  }
  function isError(err) {
    return Object.prototype.toString.call(err) === "[object Error]";
  }
  function noop() {}
  function apply(callback, args) {
    callback.apply(null, args);
  }
  function upgrade(val) {
    if (val === 42)
      nextTick = process.nextTick;
  }
  function nextTickArgs(fn, a, b) {
    process.nextTick(function() {
      fn(a, b);
    });
  }
});

// node_modules/.pnpm/multicast-dns@7.2.5/node_modules/multicast-dns/index.js
var require_multicast_dns = __commonJS((exports, module) => {
  var packet = require_dns_packet();
  var dgram = __require("dgram");
  var thunky = require_thunky();
  var events = __require("events");
  var os4 = __require("os");
  var noop = function() {};
  module.exports = function(opts) {
    if (!opts)
      opts = {};
    var that = new events.EventEmitter;
    var port = typeof opts.port === "number" ? opts.port : 5353;
    var type = opts.type || "udp4";
    var ip = opts.ip || opts.host || (type === "udp4" ? "224.0.0.251" : null);
    var me = { address: ip, port };
    var memberships = {};
    var destroyed = false;
    var interval = null;
    if (type === "udp6" && (!ip || !opts.interface)) {
      throw new Error("For IPv6 multicast you must specify `ip` and `interface`");
    }
    var socket = opts.socket || dgram.createSocket({
      type,
      reuseAddr: opts.reuseAddr !== false,
      toString: function() {
        return type;
      }
    });
    socket.on("error", function(err) {
      if (err.code === "EACCES" || err.code === "EADDRINUSE")
        that.emit("error", err);
      else
        that.emit("warning", err);
    });
    socket.on("message", function(message, rinfo) {
      try {
        message = packet.decode(message);
      } catch (err) {
        that.emit("warning", err);
        return;
      }
      that.emit("packet", message, rinfo);
      if (message.type === "query")
        that.emit("query", message, rinfo);
      if (message.type === "response")
        that.emit("response", message, rinfo);
    });
    socket.on("listening", function() {
      if (!port)
        port = me.port = socket.address().port;
      if (opts.multicast !== false) {
        that.update();
        interval = setInterval(that.update, 5000);
        socket.setMulticastTTL(opts.ttl || 255);
        socket.setMulticastLoopback(opts.loopback !== false);
      }
    });
    var bind = thunky(function(cb) {
      if (!port || opts.bind === false)
        return cb(null);
      socket.once("error", cb);
      socket.bind(port, opts.bind || opts.interface, function() {
        socket.removeListener("error", cb);
        cb(null);
      });
    });
    bind(function(err) {
      if (err)
        return that.emit("error", err);
      that.emit("ready");
    });
    that.send = function(value, rinfo, cb) {
      if (typeof rinfo === "function")
        return that.send(value, null, rinfo);
      if (!cb)
        cb = noop;
      if (!rinfo)
        rinfo = me;
      else if (!rinfo.host && !rinfo.address)
        rinfo.address = me.address;
      bind(onbind);
      function onbind(err) {
        if (destroyed)
          return cb();
        if (err)
          return cb(err);
        var message = packet.encode(value);
        socket.send(message, 0, message.length, rinfo.port, rinfo.address || rinfo.host, cb);
      }
    };
    that.response = that.respond = function(res, rinfo, cb) {
      if (Array.isArray(res))
        res = { answers: res };
      res.type = "response";
      res.flags = (res.flags || 0) | packet.AUTHORITATIVE_ANSWER;
      that.send(res, rinfo, cb);
    };
    that.query = function(q, type2, rinfo, cb) {
      if (typeof type2 === "function")
        return that.query(q, null, null, type2);
      if (typeof type2 === "object" && type2 && type2.port)
        return that.query(q, null, type2, rinfo);
      if (typeof rinfo === "function")
        return that.query(q, type2, null, rinfo);
      if (!cb)
        cb = noop;
      if (typeof q === "string")
        q = [{ name: q, type: type2 || "ANY" }];
      if (Array.isArray(q))
        q = { type: "query", questions: q };
      q.type = "query";
      that.send(q, rinfo, cb);
    };
    that.destroy = function(cb) {
      if (!cb)
        cb = noop;
      if (destroyed)
        return process.nextTick(cb);
      destroyed = true;
      clearInterval(interval);
      for (var iface in memberships) {
        try {
          socket.dropMembership(ip, iface);
        } catch (e) {}
      }
      memberships = {};
      socket.close(cb);
    };
    that.update = function() {
      var ifaces = opts.interface ? [].concat(opts.interface) : allInterfaces();
      var updated = false;
      for (var i = 0;i < ifaces.length; i++) {
        var addr = ifaces[i];
        if (memberships[addr])
          continue;
        try {
          socket.addMembership(ip, addr);
          memberships[addr] = true;
          updated = true;
        } catch (err) {
          that.emit("warning", err);
        }
      }
      if (updated) {
        if (socket.setMulticastInterface) {
          try {
            socket.setMulticastInterface(opts.interface || defaultInterface());
          } catch (err) {
            that.emit("warning", err);
          }
        }
        that.emit("networkInterface");
      }
    };
    return that;
  };
  function defaultInterface() {
    var networks = os4.networkInterfaces();
    var names = Object.keys(networks);
    for (var i = 0;i < names.length; i++) {
      var net = networks[names[i]];
      for (var j = 0;j < net.length; j++) {
        var iface = net[j];
        if (isIPv4(iface.family) && !iface.internal) {
          if (os4.platform() === "darwin" && names[i] === "en0")
            return iface.address;
          return "0.0.0.0";
        }
      }
    }
    return "127.0.0.1";
  }
  function allInterfaces() {
    var networks = os4.networkInterfaces();
    var names = Object.keys(networks);
    var res = [];
    for (var i = 0;i < names.length; i++) {
      var net = networks[names[i]];
      for (var j = 0;j < net.length; j++) {
        var iface = net[j];
        if (isIPv4(iface.family)) {
          res.push(iface.address);
          break;
        }
      }
    }
    return res;
  }
  function isIPv4(family) {
    return family === 4 || family === "IPv4";
  }
});

// node_modules/.pnpm/fast-deep-equal@3.1.3/node_modules/fast-deep-equal/es6/index.js
var require_es6 = __commonJS((exports, module) => {
  module.exports = function equal(a, b) {
    if (a === b)
      return true;
    if (a && b && typeof a == "object" && typeof b == "object") {
      if (a.constructor !== b.constructor)
        return false;
      var length, i, keys;
      if (Array.isArray(a)) {
        length = a.length;
        if (length != b.length)
          return false;
        for (i = length;i-- !== 0; )
          if (!equal(a[i], b[i]))
            return false;
        return true;
      }
      if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size)
          return false;
        for (i of a.entries())
          if (!b.has(i[0]))
            return false;
        for (i of a.entries())
          if (!equal(i[1], b.get(i[0])))
            return false;
        return true;
      }
      if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size)
          return false;
        for (i of a.entries())
          if (!b.has(i[0]))
            return false;
        return true;
      }
      if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
        length = a.length;
        if (length != b.length)
          return false;
        for (i = length;i-- !== 0; )
          if (a[i] !== b[i])
            return false;
        return true;
      }
      if (a.constructor === RegExp)
        return a.source === b.source && a.flags === b.flags;
      if (a.valueOf !== Object.prototype.valueOf)
        return a.valueOf() === b.valueOf();
      if (a.toString !== Object.prototype.toString)
        return a.toString() === b.toString();
      keys = Object.keys(a);
      length = keys.length;
      if (length !== Object.keys(b).length)
        return false;
      for (i = length;i-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(b, keys[i]))
          return false;
      for (i = length;i-- !== 0; ) {
        var key = keys[i];
        if (!equal(a[key], b[key]))
          return false;
      }
      return true;
    }
    return a !== a && b !== b;
  };
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/mdns-server.js
var require_mdns_server = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Server = undefined;
  var multicast_dns_1 = __importDefault(require_multicast_dns());
  var es6_1 = __importDefault(require_es6());
  var dns_equal_1 = __importDefault(require_dns_equal());

  class Server {
    constructor(opts, errorCallback) {
      this.registry = {};
      this.mdns = (0, multicast_dns_1.default)(opts);
      this.mdns.setMaxListeners(0);
      this.mdns.on("query", this.respondToQuery.bind(this));
      this.errorCallback = errorCallback !== null && errorCallback !== undefined ? errorCallback : function(err) {
        throw err;
      };
    }
    register(records) {
      const shouldRegister = (record) => {
        var subRegistry = this.registry[record.type];
        if (!subRegistry) {
          subRegistry = this.registry[record.type] = [];
        } else if (subRegistry.some(this.isDuplicateRecord(record))) {
          return;
        }
        subRegistry.push(record);
      };
      if (Array.isArray(records)) {
        records.forEach(shouldRegister);
      } else {
        shouldRegister(records);
      }
    }
    unregister(records) {
      const shouldUnregister = (record) => {
        let type = record.type;
        if (!(type in this.registry)) {
          return;
        }
        this.registry[type] = this.registry[type].filter((i) => i.name !== record.name);
      };
      if (Array.isArray(records)) {
        records.forEach(shouldUnregister);
      } else {
        shouldUnregister(records);
      }
    }
    respondToQuery(query) {
      let self = this;
      query.questions.forEach((question) => {
        var type = question.type;
        var name = question.name;
        var answers = type === "ANY" ? Object.keys(self.registry).map(self.recordsFor.bind(self, name)).flat(1) : self.recordsFor(name, type);
        if (answers.length === 0)
          return;
        var additionals = [];
        if (type !== "ANY") {
          answers.forEach((answer) => {
            if (answer.type !== "PTR")
              return;
            additionals = additionals.concat(self.recordsFor(answer.data, "SRV")).concat(self.recordsFor(answer.data, "TXT"));
          });
          additionals.filter(function(record) {
            return record.type === "SRV";
          }).map(function(record) {
            return record.data.target;
          }).filter(this.unique()).forEach(function(target) {
            additionals = additionals.concat(self.recordsFor(target, "A")).concat(self.recordsFor(target, "AAAA"));
          });
        }
        self.mdns.respond({ answers, additionals }, (err) => {
          if (err) {
            this.errorCallback(err);
          }
        });
      });
    }
    recordsFor(name, type) {
      if (!(type in this.registry)) {
        return [];
      }
      return this.registry[type].filter((record) => {
        var _name = ~name.indexOf(".") ? record.name : record.name.split(".")[0];
        return (0, dns_equal_1.default)(_name, name);
      });
    }
    isDuplicateRecord(a) {
      return (b) => {
        return a.type === b.type && a.name === b.name && (0, es6_1.default)(a.data, b.data);
      };
    }
    unique() {
      var set = [];
      return (obj) => {
        if (~set.indexOf(obj))
          return false;
        set.push(obj);
        return true;
      };
    }
  }
  exports.Server = Server;
  exports.default = Server;
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/filter-service.js
var require_filter_service = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = (service, txtQuery) => {
    if (txtQuery === undefined)
      return true;
    let serviceTxt = service.txt;
    let query = Object.entries(txtQuery).map(([key, value]) => {
      let queryValue = serviceTxt[key];
      if (queryValue === undefined)
        return false;
      if (value != queryValue)
        return false;
      return true;
    });
    if (query.length == 0)
      return true;
    if (query.includes(false))
      return false;
    return true;
  };
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/filter-txt.js
var require_filter_txt = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = (data) => Object.keys(data).filter((key) => !key.includes("binary")).reduce((cur, key) => {
    return Object.assign(cur, { [key]: data[key] });
  }, {});
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/equal-txt.js
var require_equal_txt = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = equalTxt;
  function equalTxt(a, b) {
    if (a === undefined || b === undefined)
      return false;
    let aKeys = Object.keys(a);
    let bKeys = Object.keys(b);
    if (aKeys.length != bKeys.length)
      return false;
    for (let key of aKeys) {
      if (a[key] != b[key])
        return false;
    }
    return true;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/browser.js
var require_browser = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Browser = undefined;
  var dns_txt_1 = __importDefault(require_dns_txt());
  var dns_equal_1 = __importDefault(require_dns_equal());
  var events_1 = __require("events");
  var service_types_1 = require_service_types();
  var filter_service_1 = __importDefault(require_filter_service());
  var filter_txt_1 = __importDefault(require_filter_txt());
  var equal_txt_1 = __importDefault(require_equal_txt());
  var TLD = ".local";
  var WILDCARD = "_services._dns-sd._udp" + TLD;

  class Browser extends events_1.EventEmitter {
    constructor(mdns, opts, onup) {
      super();
      this.onresponse = undefined;
      this.serviceMap = {};
      this.wildcard = false;
      this._services = [];
      if (typeof opts === "function")
        return new Browser(mdns, null, opts);
      this.mdns = mdns;
      this.txt = new dns_txt_1.default(opts !== null && opts.txt != null ? opts.txt : undefined);
      if (opts === null || opts.type === undefined) {
        this.name = WILDCARD;
        this.wildcard = true;
      } else {
        this.name = (0, service_types_1.toString)({ name: opts.type, protocol: opts.protocol || "tcp" }) + TLD;
        if (opts.name)
          this.name = opts.name + "." + this.name;
        this.wildcard = false;
      }
      if (opts != null && opts.txt !== undefined)
        this.txtQuery = (0, filter_txt_1.default)(opts.txt);
      if (onup)
        this.on("up", onup);
      this.start();
    }
    start() {
      if (this.onresponse || this.name === undefined)
        return;
      var self = this;
      var nameMap = {};
      if (!this.wildcard)
        nameMap[this.name] = true;
      this.onresponse = (packet, rinfo) => {
        if (self.wildcard) {
          packet.answers.forEach((answer) => {
            if (answer.type !== "PTR" || answer.name !== self.name || answer.name in nameMap)
              return;
            nameMap[answer.data] = true;
            self.mdns.query(answer.data, "PTR");
          });
        }
        const receiveTime = Date.now();
        Object.keys(nameMap).forEach(function(name) {
          self.goodbyes(name, packet).forEach(self.removeService.bind(self));
          var matches = self.buildServicesFor(name, packet, self.txt, rinfo, receiveTime);
          if (matches.length === 0)
            return;
          matches.forEach((service) => {
            const existingService = self._services.find((s) => (0, dns_equal_1.default)(s.fqdn, service.fqdn));
            if (existingService) {
              self.updateServiceSrv(existingService, service);
              self.updateServiceTxt(existingService, service);
              return;
            }
            self.addService(service);
          });
        });
      };
      this.mdns.on("response", this.onresponse);
      this.update();
    }
    stop() {
      if (!this.onresponse)
        return;
      this.mdns.removeListener("response", this.onresponse);
      this.onresponse = undefined;
    }
    update() {
      this.mdns.query(this.name, "PTR");
    }
    expire() {
      const currentTime = Date.now();
      this._services = this._services.filter((service) => {
        if (!service.ttl || service.lastSeen === undefined)
          return true;
        const expireTime = service.lastSeen + service.ttl * 1000;
        if (expireTime < currentTime) {
          this.emit("down", service);
          return false;
        }
        return true;
      });
    }
    get services() {
      return this._services;
    }
    addService(service) {
      if ((0, filter_service_1.default)(service, this.txtQuery) === false)
        return;
      this._services.push(service);
      this.serviceMap[service.fqdn] = true;
      this.emit("up", service);
    }
    updateServiceSrv(existingService, newService) {
      if (existingService.name !== newService.name || existingService.host !== newService.host || existingService.port !== newService.port || existingService.type !== newService.type || existingService.protocol !== newService.protocol) {
        this.replaceService(newService);
        this.emit("srv-update", newService, existingService);
      }
    }
    updateServiceTxt(existingService, service) {
      if ((0, equal_txt_1.default)(service.txt, (existingService === null || existingService === undefined ? undefined : existingService.txt) || {}))
        return;
      if (!(0, filter_service_1.default)(service, this.txtQuery)) {
        this.removeService(service.fqdn);
        return;
      }
      this.replaceService(service);
      this.emit("txt-update", service, existingService);
    }
    replaceService(service) {
      this._services = this._services.map((s) => {
        if (!(0, dns_equal_1.default)(s.fqdn, service.fqdn))
          return s;
        return service;
      });
    }
    removeService(fqdn) {
      var service, index;
      this._services.some(function(s, i) {
        if ((0, dns_equal_1.default)(s.fqdn, fqdn)) {
          service = s;
          index = i;
          return true;
        }
      });
      if (!service || index === undefined)
        return;
      this._services.splice(index, 1);
      delete this.serviceMap[fqdn];
      this.emit("down", service);
    }
    goodbyes(name, packet) {
      return packet.answers.concat(packet.additionals).filter((rr) => rr.type === "PTR" && rr.ttl === 0 && (0, dns_equal_1.default)(rr.name, name)).map((rr) => rr.data);
    }
    buildServicesFor(name, packet, txt, referer, receiveTime) {
      var records = packet.answers.concat(packet.additionals).filter((rr) => rr.ttl > 0);
      return records.filter((rr) => rr.type === "PTR" && (0, dns_equal_1.default)(rr.name, name)).map((ptr) => {
        const service = {
          addresses: [],
          subtypes: [],
          ttl: ptr.ttl,
          lastSeen: receiveTime
        };
        records.filter((rr) => {
          return rr.type === "PTR" && (0, dns_equal_1.default)(rr.data, ptr.data) && rr.name.includes("._sub");
        }).forEach((rr) => {
          const types4 = (0, service_types_1.toType)(rr.name);
          service.subtypes.push(types4.subtype);
        });
        records.filter((rr) => {
          return (rr.type === "SRV" || rr.type === "TXT") && (0, dns_equal_1.default)(rr.name, ptr.data);
        }).forEach((rr) => {
          if (rr.type === "SRV") {
            var parts = rr.name.split(".");
            var name2 = parts[0];
            var types4 = (0, service_types_1.toType)(parts.slice(1, -1).join("."));
            service.name = name2;
            service.fqdn = rr.name;
            service.host = rr.data.target;
            service.referer = referer;
            service.port = rr.data.port;
            service.type = types4.name;
            service.protocol = types4.protocol;
          } else if (rr.type === "TXT") {
            service.rawTxt = rr.data;
            service.txt = this.txt.decodeAll(rr.data);
          }
        });
        if (!service.name)
          return;
        records.filter((rr) => (rr.type === "A" || rr.type === "AAAA") && (0, dns_equal_1.default)(rr.name, service.host)).forEach((rr) => service.addresses.push(rr.data));
        return service;
      }).filter((rr) => !!rr);
    }
  }
  exports.Browser = Browser;
  exports.default = Browser;
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/bonjour.js
var require_bonjour = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Browser = exports.Service = undefined;
  var registry_1 = __importDefault(require_registry());
  var mdns_server_1 = __importDefault(require_mdns_server());
  var browser_1 = __importDefault(require_browser());
  exports.Browser = browser_1.default;
  var service_1 = __importDefault(require_service());
  exports.Service = service_1.default;

  class Bonjour {
    constructor(opts = {}, errorCallback) {
      this.server = new mdns_server_1.default(opts, errorCallback);
      this.registry = new registry_1.default(this.server);
    }
    publish(opts) {
      return this.registry.publish(opts);
    }
    unpublishAll(callback) {
      return this.registry.unpublishAll(callback);
    }
    find(opts = null, onup) {
      return new browser_1.default(this.server.mdns, opts, onup);
    }
    findOne(opts = null, timeout = 1e4, callback) {
      const browser = new browser_1.default(this.server.mdns, opts);
      var timer;
      browser.once("up", (service) => {
        if (timer !== undefined)
          clearTimeout(timer);
        browser.stop();
        if (callback)
          callback(service);
      });
      timer = setTimeout(() => {
        browser.stop();
        if (callback)
          callback(null);
      }, timeout);
      return browser;
    }
    destroy(callback) {
      this.registry.destroy();
      this.server.mdns.destroy(callback);
    }
  }
  exports.default = Bonjour;
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/index.js
var require_dist = __commonJS((exports, module) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
  } : function(o, v) {
    o["default"] = v;
  });
  var __importStar = exports && exports.__importStar || function() {
    var ownKeys = function(o) {
      ownKeys = Object.getOwnPropertyNames || function(o2) {
        var ar = [];
        for (var k in o2)
          if (Object.prototype.hasOwnProperty.call(o2, k))
            ar[ar.length] = k;
        return ar;
      };
      return ownKeys(o);
    };
    return function(mod) {
      if (mod && mod.__esModule)
        return mod;
      var result = {};
      if (mod != null) {
        for (var k = ownKeys(mod), i = 0;i < k.length; i++)
          if (k[i] !== "default")
            __createBinding(result, mod, k[i]);
      }
      __setModuleDefault(result, mod);
      return result;
    };
  }();
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  var bonjour_1 = __importDefault(require_bonjour());
  var imported = __importStar(require_bonjour());

  class Bonjour extends bonjour_1.default {
  }
  var BonjourClass = Bonjour;
  (function(Bonjour2) {
    Bonjour2.Bonjour = BonjourClass;
    Bonjour2.Service = imported.Service;
    Bonjour2.Browser = imported.Browser;
  })(Bonjour || (Bonjour = {}));
  Object.defineProperty(Bonjour, "default", {
    enumerable: true,
    value: Bonjour
  });
  module.exports.Bonjour = Bonjour;
  module.exports.Service = imported.Service;
  module.exports.Browser = imported.Browser;
  module.exports.default = Bonjour;
  module.exports = Bonjour;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/can-promise.js
var require_can_promise = __commonJS((exports, module) => {
  module.exports = function() {
    return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/utils.js
var require_utils = __commonJS((exports) => {
  var toSJISFunction;
  var CODEWORDS_COUNT = [
    0,
    26,
    44,
    70,
    100,
    134,
    172,
    196,
    242,
    292,
    346,
    404,
    466,
    532,
    581,
    655,
    733,
    815,
    901,
    991,
    1085,
    1156,
    1258,
    1364,
    1474,
    1588,
    1706,
    1828,
    1921,
    2051,
    2185,
    2323,
    2465,
    2611,
    2761,
    2876,
    3034,
    3196,
    3362,
    3532,
    3706
  ];
  exports.getSymbolSize = function getSymbolSize(version) {
    if (!version)
      throw new Error('"version" cannot be null or undefined');
    if (version < 1 || version > 40)
      throw new Error('"version" should be in range from 1 to 40');
    return version * 4 + 17;
  };
  exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
    return CODEWORDS_COUNT[version];
  };
  exports.getBCHDigit = function(data) {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  };
  exports.setToSJISFunction = function setToSJISFunction(f) {
    if (typeof f !== "function") {
      throw new Error('"toSJISFunc" is not a valid function.');
    }
    toSJISFunction = f;
  };
  exports.isKanjiModeEnabled = function() {
    return typeof toSJISFunction !== "undefined";
  };
  exports.toSJIS = function toSJIS(kanji) {
    return toSJISFunction(kanji);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/error-correction-level.js
var require_error_correction_level = __commonJS((exports) => {
  exports.L = { bit: 1 };
  exports.M = { bit: 0 };
  exports.Q = { bit: 3 };
  exports.H = { bit: 2 };
  function fromString(string) {
    if (typeof string !== "string") {
      throw new Error("Param is not a string");
    }
    const lcStr = string.toLowerCase();
    switch (lcStr) {
      case "l":
      case "low":
        return exports.L;
      case "m":
      case "medium":
        return exports.M;
      case "q":
      case "quartile":
        return exports.Q;
      case "h":
      case "high":
        return exports.H;
      default:
        throw new Error("Unknown EC Level: " + string);
    }
  }
  exports.isValid = function isValid2(level) {
    return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
  };
  exports.from = function from(value, defaultValue) {
    if (exports.isValid(value)) {
      return value;
    }
    try {
      return fromString(value);
    } catch (e) {
      return defaultValue;
    }
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/bit-buffer.js
var require_bit_buffer = __commonJS((exports, module) => {
  function BitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  BitBuffer.prototype = {
    get: function(index) {
      const bufIndex = Math.floor(index / 8);
      return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
    },
    put: function(num, length) {
      for (let i = 0;i < length; i++) {
        this.putBit((num >>> length - i - 1 & 1) === 1);
      }
    },
    getLengthInBits: function() {
      return this.length;
    },
    putBit: function(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) {
        this.buffer.push(0);
      }
      if (bit) {
        this.buffer[bufIndex] |= 128 >>> this.length % 8;
      }
      this.length++;
    }
  };
  module.exports = BitBuffer;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/bit-matrix.js
var require_bit_matrix = __commonJS((exports, module) => {
  function BitMatrix(size) {
    if (!size || size < 1) {
      throw new Error("BitMatrix size must be defined and greater than 0");
    }
    this.size = size;
    this.data = new Uint8Array(size * size);
    this.reservedBit = new Uint8Array(size * size);
  }
  BitMatrix.prototype.set = function(row, col, value, reserved) {
    const index = row * this.size + col;
    this.data[index] = value;
    if (reserved)
      this.reservedBit[index] = true;
  };
  BitMatrix.prototype.get = function(row, col) {
    return this.data[row * this.size + col];
  };
  BitMatrix.prototype.xor = function(row, col, value) {
    this.data[row * this.size + col] ^= value;
  };
  BitMatrix.prototype.isReserved = function(row, col) {
    return this.reservedBit[row * this.size + col];
  };
  module.exports = BitMatrix;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/alignment-pattern.js
var require_alignment_pattern = __commonJS((exports) => {
  var getSymbolSize = require_utils().getSymbolSize;
  exports.getRowColCoords = function getRowColCoords(version) {
    if (version === 1)
      return [];
    const posCount = Math.floor(version / 7) + 2;
    const size = getSymbolSize(version);
    const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
    const positions = [size - 7];
    for (let i = 1;i < posCount - 1; i++) {
      positions[i] = positions[i - 1] - intervals;
    }
    positions.push(6);
    return positions.reverse();
  };
  exports.getPositions = function getPositions(version) {
    const coords = [];
    const pos = exports.getRowColCoords(version);
    const posLength = pos.length;
    for (let i = 0;i < posLength; i++) {
      for (let j = 0;j < posLength; j++) {
        if (i === 0 && j === 0 || i === 0 && j === posLength - 1 || i === posLength - 1 && j === 0) {
          continue;
        }
        coords.push([pos[i], pos[j]]);
      }
    }
    return coords;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/finder-pattern.js
var require_finder_pattern = __commonJS((exports) => {
  var getSymbolSize = require_utils().getSymbolSize;
  var FINDER_PATTERN_SIZE = 7;
  exports.getPositions = function getPositions(version) {
    const size = getSymbolSize(version);
    return [
      [0, 0],
      [size - FINDER_PATTERN_SIZE, 0],
      [0, size - FINDER_PATTERN_SIZE]
    ];
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/mask-pattern.js
var require_mask_pattern = __commonJS((exports) => {
  exports.Patterns = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  var PenaltyScores = {
    N1: 3,
    N2: 3,
    N3: 40,
    N4: 10
  };
  exports.isValid = function isValid2(mask) {
    return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
  };
  exports.from = function from(value) {
    return exports.isValid(value) ? parseInt(value, 10) : undefined;
  };
  exports.getPenaltyN1 = function getPenaltyN1(data) {
    const size = data.size;
    let points = 0;
    let sameCountCol = 0;
    let sameCountRow = 0;
    let lastCol = null;
    let lastRow = null;
    for (let row = 0;row < size; row++) {
      sameCountCol = sameCountRow = 0;
      lastCol = lastRow = null;
      for (let col = 0;col < size; col++) {
        let module2 = data.get(row, col);
        if (module2 === lastCol) {
          sameCountCol++;
        } else {
          if (sameCountCol >= 5)
            points += PenaltyScores.N1 + (sameCountCol - 5);
          lastCol = module2;
          sameCountCol = 1;
        }
        module2 = data.get(col, row);
        if (module2 === lastRow) {
          sameCountRow++;
        } else {
          if (sameCountRow >= 5)
            points += PenaltyScores.N1 + (sameCountRow - 5);
          lastRow = module2;
          sameCountRow = 1;
        }
      }
      if (sameCountCol >= 5)
        points += PenaltyScores.N1 + (sameCountCol - 5);
      if (sameCountRow >= 5)
        points += PenaltyScores.N1 + (sameCountRow - 5);
    }
    return points;
  };
  exports.getPenaltyN2 = function getPenaltyN2(data) {
    const size = data.size;
    let points = 0;
    for (let row = 0;row < size - 1; row++) {
      for (let col = 0;col < size - 1; col++) {
        const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
        if (last === 4 || last === 0)
          points++;
      }
    }
    return points * PenaltyScores.N2;
  };
  exports.getPenaltyN3 = function getPenaltyN3(data) {
    const size = data.size;
    let points = 0;
    let bitsCol = 0;
    let bitsRow = 0;
    for (let row = 0;row < size; row++) {
      bitsCol = bitsRow = 0;
      for (let col = 0;col < size; col++) {
        bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
        if (col >= 10 && (bitsCol === 1488 || bitsCol === 93))
          points++;
        bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
        if (col >= 10 && (bitsRow === 1488 || bitsRow === 93))
          points++;
      }
    }
    return points * PenaltyScores.N3;
  };
  exports.getPenaltyN4 = function getPenaltyN4(data) {
    let darkCount = 0;
    const modulesCount = data.data.length;
    for (let i = 0;i < modulesCount; i++)
      darkCount += data.data[i];
    const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
    return k * PenaltyScores.N4;
  };
  function getMaskAt(maskPattern, i, j) {
    switch (maskPattern) {
      case exports.Patterns.PATTERN000:
        return (i + j) % 2 === 0;
      case exports.Patterns.PATTERN001:
        return i % 2 === 0;
      case exports.Patterns.PATTERN010:
        return j % 3 === 0;
      case exports.Patterns.PATTERN011:
        return (i + j) % 3 === 0;
      case exports.Patterns.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case exports.Patterns.PATTERN101:
        return i * j % 2 + i * j % 3 === 0;
      case exports.Patterns.PATTERN110:
        return (i * j % 2 + i * j % 3) % 2 === 0;
      case exports.Patterns.PATTERN111:
        return (i * j % 3 + (i + j) % 2) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + maskPattern);
    }
  }
  exports.applyMask = function applyMask(pattern, data) {
    const size = data.size;
    for (let col = 0;col < size; col++) {
      for (let row = 0;row < size; row++) {
        if (data.isReserved(row, col))
          continue;
        data.xor(row, col, getMaskAt(pattern, row, col));
      }
    }
  };
  exports.getBestMask = function getBestMask(data, setupFormatFunc) {
    const numPatterns = Object.keys(exports.Patterns).length;
    let bestPattern = 0;
    let lowerPenalty = Infinity;
    for (let p = 0;p < numPatterns; p++) {
      setupFormatFunc(p);
      exports.applyMask(p, data);
      const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
      exports.applyMask(p, data);
      if (penalty < lowerPenalty) {
        lowerPenalty = penalty;
        bestPattern = p;
      }
    }
    return bestPattern;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/error-correction-code.js
var require_error_correction_code = __commonJS((exports) => {
  var ECLevel = require_error_correction_level();
  var EC_BLOCKS_TABLE = [
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    2,
    2,
    1,
    2,
    2,
    4,
    1,
    2,
    4,
    4,
    2,
    4,
    4,
    4,
    2,
    4,
    6,
    5,
    2,
    4,
    6,
    6,
    2,
    5,
    8,
    8,
    4,
    5,
    8,
    8,
    4,
    5,
    8,
    11,
    4,
    8,
    10,
    11,
    4,
    9,
    12,
    16,
    4,
    9,
    16,
    16,
    6,
    10,
    12,
    18,
    6,
    10,
    17,
    16,
    6,
    11,
    16,
    19,
    6,
    13,
    18,
    21,
    7,
    14,
    21,
    25,
    8,
    16,
    20,
    25,
    8,
    17,
    23,
    25,
    9,
    17,
    23,
    34,
    9,
    18,
    25,
    30,
    10,
    20,
    27,
    32,
    12,
    21,
    29,
    35,
    12,
    23,
    34,
    37,
    12,
    25,
    34,
    40,
    13,
    26,
    35,
    42,
    14,
    28,
    38,
    45,
    15,
    29,
    40,
    48,
    16,
    31,
    43,
    51,
    17,
    33,
    45,
    54,
    18,
    35,
    48,
    57,
    19,
    37,
    51,
    60,
    19,
    38,
    53,
    63,
    20,
    40,
    56,
    66,
    21,
    43,
    59,
    70,
    22,
    45,
    62,
    74,
    24,
    47,
    65,
    77,
    25,
    49,
    68,
    81
  ];
  var EC_CODEWORDS_TABLE = [
    7,
    10,
    13,
    17,
    10,
    16,
    22,
    28,
    15,
    26,
    36,
    44,
    20,
    36,
    52,
    64,
    26,
    48,
    72,
    88,
    36,
    64,
    96,
    112,
    40,
    72,
    108,
    130,
    48,
    88,
    132,
    156,
    60,
    110,
    160,
    192,
    72,
    130,
    192,
    224,
    80,
    150,
    224,
    264,
    96,
    176,
    260,
    308,
    104,
    198,
    288,
    352,
    120,
    216,
    320,
    384,
    132,
    240,
    360,
    432,
    144,
    280,
    408,
    480,
    168,
    308,
    448,
    532,
    180,
    338,
    504,
    588,
    196,
    364,
    546,
    650,
    224,
    416,
    600,
    700,
    224,
    442,
    644,
    750,
    252,
    476,
    690,
    816,
    270,
    504,
    750,
    900,
    300,
    560,
    810,
    960,
    312,
    588,
    870,
    1050,
    336,
    644,
    952,
    1110,
    360,
    700,
    1020,
    1200,
    390,
    728,
    1050,
    1260,
    420,
    784,
    1140,
    1350,
    450,
    812,
    1200,
    1440,
    480,
    868,
    1290,
    1530,
    510,
    924,
    1350,
    1620,
    540,
    980,
    1440,
    1710,
    570,
    1036,
    1530,
    1800,
    570,
    1064,
    1590,
    1890,
    600,
    1120,
    1680,
    1980,
    630,
    1204,
    1770,
    2100,
    660,
    1260,
    1860,
    2220,
    720,
    1316,
    1950,
    2310,
    750,
    1372,
    2040,
    2430
  ];
  exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case ECLevel.L:
        return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
      case ECLevel.M:
        return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
      case ECLevel.Q:
        return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
      case ECLevel.H:
        return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
      default:
        return;
    }
  };
  exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case ECLevel.L:
        return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
      case ECLevel.M:
        return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
      case ECLevel.Q:
        return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
      case ECLevel.H:
        return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
      default:
        return;
    }
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/galois-field.js
var require_galois_field = __commonJS((exports) => {
  var EXP_TABLE = new Uint8Array(512);
  var LOG_TABLE = new Uint8Array(256);
  (function initTables() {
    let x = 1;
    for (let i = 0;i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 256) {
        x ^= 285;
      }
    }
    for (let i = 255;i < 512; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 255];
    }
  })();
  exports.log = function log(n) {
    if (n < 1)
      throw new Error("log(" + n + ")");
    return LOG_TABLE[n];
  };
  exports.exp = function exp(n) {
    return EXP_TABLE[n];
  };
  exports.mul = function mul(x, y) {
    if (x === 0 || y === 0)
      return 0;
    return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/polynomial.js
var require_polynomial = __commonJS((exports) => {
  var GF = require_galois_field();
  exports.mul = function mul(p1, p2) {
    const coeff = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0;i < p1.length; i++) {
      for (let j = 0;j < p2.length; j++) {
        coeff[i + j] ^= GF.mul(p1[i], p2[j]);
      }
    }
    return coeff;
  };
  exports.mod = function mod(divident, divisor) {
    let result = new Uint8Array(divident);
    while (result.length - divisor.length >= 0) {
      const coeff = result[0];
      for (let i = 0;i < divisor.length; i++) {
        result[i] ^= GF.mul(divisor[i], coeff);
      }
      let offset = 0;
      while (offset < result.length && result[offset] === 0)
        offset++;
      result = result.slice(offset);
    }
    return result;
  };
  exports.generateECPolynomial = function generateECPolynomial(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0;i < degree; i++) {
      poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
    }
    return poly;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/reed-solomon-encoder.js
var require_reed_solomon_encoder = __commonJS((exports, module) => {
  var Polynomial = require_polynomial();
  function ReedSolomonEncoder(degree) {
    this.genPoly = undefined;
    this.degree = degree;
    if (this.degree)
      this.initialize(this.degree);
  }
  ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
    this.degree = degree;
    this.genPoly = Polynomial.generateECPolynomial(this.degree);
  };
  ReedSolomonEncoder.prototype.encode = function encode(data) {
    if (!this.genPoly) {
      throw new Error("Encoder not initialized");
    }
    const paddedData = new Uint8Array(data.length + this.degree);
    paddedData.set(data);
    const remainder = Polynomial.mod(paddedData, this.genPoly);
    const start = this.degree - remainder.length;
    if (start > 0) {
      const buff = new Uint8Array(this.degree);
      buff.set(remainder, start);
      return buff;
    }
    return remainder;
  };
  module.exports = ReedSolomonEncoder;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/version-check.js
var require_version_check = __commonJS((exports) => {
  exports.isValid = function isValid2(version) {
    return !isNaN(version) && version >= 1 && version <= 40;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/regex.js
var require_regex = __commonJS((exports) => {
  var numeric = "[0-9]+";
  var alphanumeric = "[A-Z $%*+\\-./:]+";
  var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|" + "[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|" + "[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|" + "[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
  kanji = kanji.replace(/u/g, "\\u");
  var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + `)(?:.|[\r
]))+`;
  exports.KANJI = new RegExp(kanji, "g");
  exports.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
  exports.BYTE = new RegExp(byte, "g");
  exports.NUMERIC = new RegExp(numeric, "g");
  exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
  var TEST_KANJI = new RegExp("^" + kanji + "$");
  var TEST_NUMERIC = new RegExp("^" + numeric + "$");
  var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
  exports.testKanji = function testKanji(str) {
    return TEST_KANJI.test(str);
  };
  exports.testNumeric = function testNumeric(str) {
    return TEST_NUMERIC.test(str);
  };
  exports.testAlphanumeric = function testAlphanumeric(str) {
    return TEST_ALPHANUMERIC.test(str);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/mode.js
var require_mode = __commonJS((exports) => {
  var VersionCheck = require_version_check();
  var Regex = require_regex();
  exports.NUMERIC = {
    id: "Numeric",
    bit: 1 << 0,
    ccBits: [10, 12, 14]
  };
  exports.ALPHANUMERIC = {
    id: "Alphanumeric",
    bit: 1 << 1,
    ccBits: [9, 11, 13]
  };
  exports.BYTE = {
    id: "Byte",
    bit: 1 << 2,
    ccBits: [8, 16, 16]
  };
  exports.KANJI = {
    id: "Kanji",
    bit: 1 << 3,
    ccBits: [8, 10, 12]
  };
  exports.MIXED = {
    bit: -1
  };
  exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
    if (!mode.ccBits)
      throw new Error("Invalid mode: " + mode);
    if (!VersionCheck.isValid(version)) {
      throw new Error("Invalid version: " + version);
    }
    if (version >= 1 && version < 10)
      return mode.ccBits[0];
    else if (version < 27)
      return mode.ccBits[1];
    return mode.ccBits[2];
  };
  exports.getBestModeForData = function getBestModeForData(dataStr) {
    if (Regex.testNumeric(dataStr))
      return exports.NUMERIC;
    else if (Regex.testAlphanumeric(dataStr))
      return exports.ALPHANUMERIC;
    else if (Regex.testKanji(dataStr))
      return exports.KANJI;
    else
      return exports.BYTE;
  };
  exports.toString = function toString(mode) {
    if (mode && mode.id)
      return mode.id;
    throw new Error("Invalid mode");
  };
  exports.isValid = function isValid2(mode) {
    return mode && mode.bit && mode.ccBits;
  };
  function fromString(string) {
    if (typeof string !== "string") {
      throw new Error("Param is not a string");
    }
    const lcStr = string.toLowerCase();
    switch (lcStr) {
      case "numeric":
        return exports.NUMERIC;
      case "alphanumeric":
        return exports.ALPHANUMERIC;
      case "kanji":
        return exports.KANJI;
      case "byte":
        return exports.BYTE;
      default:
        throw new Error("Unknown mode: " + string);
    }
  }
  exports.from = function from(value, defaultValue) {
    if (exports.isValid(value)) {
      return value;
    }
    try {
      return fromString(value);
    } catch (e) {
      return defaultValue;
    }
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/version.js
var require_version = __commonJS((exports) => {
  var Utils = require_utils();
  var ECCode = require_error_correction_code();
  var ECLevel = require_error_correction_level();
  var Mode = require_mode();
  var VersionCheck = require_version_check();
  var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
  var G18_BCH = Utils.getBCHDigit(G18);
  function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
    for (let currentVersion = 1;currentVersion <= 40; currentVersion++) {
      if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
        return currentVersion;
      }
    }
    return;
  }
  function getReservedBitsCount(mode, version) {
    return Mode.getCharCountIndicator(mode, version) + 4;
  }
  function getTotalBitsFromDataArray(segments, version) {
    let totalBits = 0;
    segments.forEach(function(data) {
      const reservedBits = getReservedBitsCount(data.mode, version);
      totalBits += reservedBits + data.getBitsLength();
    });
    return totalBits;
  }
  function getBestVersionForMixedData(segments, errorCorrectionLevel) {
    for (let currentVersion = 1;currentVersion <= 40; currentVersion++) {
      const length = getTotalBitsFromDataArray(segments, currentVersion);
      if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
        return currentVersion;
      }
    }
    return;
  }
  exports.from = function from(value, defaultValue) {
    if (VersionCheck.isValid(value)) {
      return parseInt(value, 10);
    }
    return defaultValue;
  };
  exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
    if (!VersionCheck.isValid(version)) {
      throw new Error("Invalid QR Code version");
    }
    if (typeof mode === "undefined")
      mode = Mode.BYTE;
    const totalCodewords = Utils.getSymbolTotalCodewords(version);
    const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
    if (mode === Mode.MIXED)
      return dataTotalCodewordsBits;
    const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
    switch (mode) {
      case Mode.NUMERIC:
        return Math.floor(usableBits / 10 * 3);
      case Mode.ALPHANUMERIC:
        return Math.floor(usableBits / 11 * 2);
      case Mode.KANJI:
        return Math.floor(usableBits / 13);
      case Mode.BYTE:
      default:
        return Math.floor(usableBits / 8);
    }
  };
  exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
    let seg;
    const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
    if (Array.isArray(data)) {
      if (data.length > 1) {
        return getBestVersionForMixedData(data, ecl);
      }
      if (data.length === 0) {
        return 1;
      }
      seg = data[0];
    } else {
      seg = data;
    }
    return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
  };
  exports.getEncodedBits = function getEncodedBits(version) {
    if (!VersionCheck.isValid(version) || version < 7) {
      throw new Error("Invalid QR Code version");
    }
    let d = version << 12;
    while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
      d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
    }
    return version << 12 | d;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/format-info.js
var require_format_info = __commonJS((exports) => {
  var Utils = require_utils();
  var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
  var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
  var G15_BCH = Utils.getBCHDigit(G15);
  exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
    const data = errorCorrectionLevel.bit << 3 | mask;
    let d = data << 10;
    while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
      d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
    }
    return (data << 10 | d) ^ G15_MASK;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/numeric-data.js
var require_numeric_data = __commonJS((exports, module) => {
  var Mode = require_mode();
  function NumericData(data) {
    this.mode = Mode.NUMERIC;
    this.data = data.toString();
  }
  NumericData.getBitsLength = function getBitsLength(length) {
    return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
  };
  NumericData.prototype.getLength = function getLength() {
    return this.data.length;
  };
  NumericData.prototype.getBitsLength = function getBitsLength() {
    return NumericData.getBitsLength(this.data.length);
  };
  NumericData.prototype.write = function write(bitBuffer) {
    let i, group, value;
    for (i = 0;i + 3 <= this.data.length; i += 3) {
      group = this.data.substr(i, 3);
      value = parseInt(group, 10);
      bitBuffer.put(value, 10);
    }
    const remainingNum = this.data.length - i;
    if (remainingNum > 0) {
      group = this.data.substr(i);
      value = parseInt(group, 10);
      bitBuffer.put(value, remainingNum * 3 + 1);
    }
  };
  module.exports = NumericData;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/alphanumeric-data.js
var require_alphanumeric_data = __commonJS((exports, module) => {
  var Mode = require_mode();
  var ALPHA_NUM_CHARS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    " ",
    "$",
    "%",
    "*",
    "+",
    "-",
    ".",
    "/",
    ":"
  ];
  function AlphanumericData(data) {
    this.mode = Mode.ALPHANUMERIC;
    this.data = data;
  }
  AlphanumericData.getBitsLength = function getBitsLength(length) {
    return 11 * Math.floor(length / 2) + 6 * (length % 2);
  };
  AlphanumericData.prototype.getLength = function getLength() {
    return this.data.length;
  };
  AlphanumericData.prototype.getBitsLength = function getBitsLength() {
    return AlphanumericData.getBitsLength(this.data.length);
  };
  AlphanumericData.prototype.write = function write(bitBuffer) {
    let i;
    for (i = 0;i + 2 <= this.data.length; i += 2) {
      let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
      value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
      bitBuffer.put(value, 11);
    }
    if (this.data.length % 2) {
      bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
    }
  };
  module.exports = AlphanumericData;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/byte-data.js
var require_byte_data = __commonJS((exports, module) => {
  var Mode = require_mode();
  function ByteData(data) {
    this.mode = Mode.BYTE;
    if (typeof data === "string") {
      this.data = new TextEncoder().encode(data);
    } else {
      this.data = new Uint8Array(data);
    }
  }
  ByteData.getBitsLength = function getBitsLength(length) {
    return length * 8;
  };
  ByteData.prototype.getLength = function getLength() {
    return this.data.length;
  };
  ByteData.prototype.getBitsLength = function getBitsLength() {
    return ByteData.getBitsLength(this.data.length);
  };
  ByteData.prototype.write = function(bitBuffer) {
    for (let i = 0, l = this.data.length;i < l; i++) {
      bitBuffer.put(this.data[i], 8);
    }
  };
  module.exports = ByteData;
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/kanji-data.js
var require_kanji_data = __commonJS((exports, module) => {
  var Mode = require_mode();
  var Utils = require_utils();
  function KanjiData(data) {
    this.mode = Mode.KANJI;
    this.data = data;
  }
  KanjiData.getBitsLength = function getBitsLength(length) {
    return length * 13;
  };
  KanjiData.prototype.getLength = function getLength() {
    return this.data.length;
  };
  KanjiData.prototype.getBitsLength = function getBitsLength() {
    return KanjiData.getBitsLength(this.data.length);
  };
  KanjiData.prototype.write = function(bitBuffer) {
    let i;
    for (i = 0;i < this.data.length; i++) {
      let value = Utils.toSJIS(this.data[i]);
      if (value >= 33088 && value <= 40956) {
        value -= 33088;
      } else if (value >= 57408 && value <= 60351) {
        value -= 49472;
      } else {
        throw new Error("Invalid SJIS character: " + this.data[i] + `
` + "Make sure your charset is UTF-8");
      }
      value = (value >>> 8 & 255) * 192 + (value & 255);
      bitBuffer.put(value, 13);
    }
  };
  module.exports = KanjiData;
});

// node_modules/.pnpm/dijkstrajs@1.0.3/node_modules/dijkstrajs/dijkstra.js
var require_dijkstra = __commonJS((exports, module) => {
  var dijkstra = {
    single_source_shortest_paths: function(graph, s, d) {
      var predecessors = {};
      var costs = {};
      costs[s] = 0;
      var open = dijkstra.PriorityQueue.make();
      open.push(s, 0);
      var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
      while (!open.empty()) {
        closest = open.pop();
        u = closest.value;
        cost_of_s_to_u = closest.cost;
        adjacent_nodes = graph[u] || {};
        for (v in adjacent_nodes) {
          if (adjacent_nodes.hasOwnProperty(v)) {
            cost_of_e = adjacent_nodes[v];
            cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
            cost_of_s_to_v = costs[v];
            first_visit = typeof costs[v] === "undefined";
            if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
              costs[v] = cost_of_s_to_u_plus_cost_of_e;
              open.push(v, cost_of_s_to_u_plus_cost_of_e);
              predecessors[v] = u;
            }
          }
        }
      }
      if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
        var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
        throw new Error(msg);
      }
      return predecessors;
    },
    extract_shortest_path_from_predecessor_list: function(predecessors, d) {
      var nodes = [];
      var u = d;
      var predecessor;
      while (u) {
        nodes.push(u);
        predecessor = predecessors[u];
        u = predecessors[u];
      }
      nodes.reverse();
      return nodes;
    },
    find_path: function(graph, s, d) {
      var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
      return dijkstra.extract_shortest_path_from_predecessor_list(predecessors, d);
    },
    PriorityQueue: {
      make: function(opts) {
        var T = dijkstra.PriorityQueue, t = {}, key;
        opts = opts || {};
        for (key in T) {
          if (T.hasOwnProperty(key)) {
            t[key] = T[key];
          }
        }
        t.queue = [];
        t.sorter = opts.sorter || T.default_sorter;
        return t;
      },
      default_sorter: function(a, b) {
        return a.cost - b.cost;
      },
      push: function(value, cost2) {
        var item = { value, cost: cost2 };
        this.queue.push(item);
        this.queue.sort(this.sorter);
      },
      pop: function() {
        return this.queue.shift();
      },
      empty: function() {
        return this.queue.length === 0;
      }
    }
  };
  if (typeof module !== "undefined") {
    module.exports = dijkstra;
  }
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/segments.js
var require_segments = __commonJS((exports) => {
  var Mode = require_mode();
  var NumericData = require_numeric_data();
  var AlphanumericData = require_alphanumeric_data();
  var ByteData = require_byte_data();
  var KanjiData = require_kanji_data();
  var Regex = require_regex();
  var Utils = require_utils();
  var dijkstra = require_dijkstra();
  function getStringByteLength(str) {
    return unescape(encodeURIComponent(str)).length;
  }
  function getSegments(regex, mode, str) {
    const segments = [];
    let result;
    while ((result = regex.exec(str)) !== null) {
      segments.push({
        data: result[0],
        index: result.index,
        mode,
        length: result[0].length
      });
    }
    return segments;
  }
  function getSegmentsFromString(dataStr) {
    const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
    const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
    let byteSegs;
    let kanjiSegs;
    if (Utils.isKanjiModeEnabled()) {
      byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
      kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
    } else {
      byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
      kanjiSegs = [];
    }
    const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
    return segs.sort(function(s1, s2) {
      return s1.index - s2.index;
    }).map(function(obj) {
      return {
        data: obj.data,
        mode: obj.mode,
        length: obj.length
      };
    });
  }
  function getSegmentBitsLength(length, mode) {
    switch (mode) {
      case Mode.NUMERIC:
        return NumericData.getBitsLength(length);
      case Mode.ALPHANUMERIC:
        return AlphanumericData.getBitsLength(length);
      case Mode.KANJI:
        return KanjiData.getBitsLength(length);
      case Mode.BYTE:
        return ByteData.getBitsLength(length);
    }
  }
  function mergeSegments(segs) {
    return segs.reduce(function(acc, curr) {
      const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
      if (prevSeg && prevSeg.mode === curr.mode) {
        acc[acc.length - 1].data += curr.data;
        return acc;
      }
      acc.push(curr);
      return acc;
    }, []);
  }
  function buildNodes(segs) {
    const nodes = [];
    for (let i = 0;i < segs.length; i++) {
      const seg = segs[i];
      switch (seg.mode) {
        case Mode.NUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
            { data: seg.data, mode: Mode.BYTE, length: seg.length }
          ]);
          break;
        case Mode.ALPHANUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.BYTE, length: seg.length }
          ]);
          break;
        case Mode.KANJI:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
          ]);
          break;
        case Mode.BYTE:
          nodes.push([
            { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
          ]);
      }
    }
    return nodes;
  }
  function buildGraph(nodes, version) {
    const table = {};
    const graph = { start: {} };
    let prevNodeIds = ["start"];
    for (let i = 0;i < nodes.length; i++) {
      const nodeGroup = nodes[i];
      const currentNodeIds = [];
      for (let j = 0;j < nodeGroup.length; j++) {
        const node = nodeGroup[j];
        const key = "" + i + j;
        currentNodeIds.push(key);
        table[key] = { node, lastCount: 0 };
        graph[key] = {};
        for (let n = 0;n < prevNodeIds.length; n++) {
          const prevNodeId = prevNodeIds[n];
          if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
            graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
            table[prevNodeId].lastCount += node.length;
          } else {
            if (table[prevNodeId])
              table[prevNodeId].lastCount = node.length;
            graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
          }
        }
      }
      prevNodeIds = currentNodeIds;
    }
    for (let n = 0;n < prevNodeIds.length; n++) {
      graph[prevNodeIds[n]].end = 0;
    }
    return { map: graph, table };
  }
  function buildSingleSegment(data, modesHint) {
    let mode;
    const bestMode = Mode.getBestModeForData(data);
    mode = Mode.from(modesHint, bestMode);
    if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
      throw new Error('"' + data + '"' + " cannot be encoded with mode " + Mode.toString(mode) + `.
 Suggested mode is: ` + Mode.toString(bestMode));
    }
    if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
      mode = Mode.BYTE;
    }
    switch (mode) {
      case Mode.NUMERIC:
        return new NumericData(data);
      case Mode.ALPHANUMERIC:
        return new AlphanumericData(data);
      case Mode.KANJI:
        return new KanjiData(data);
      case Mode.BYTE:
        return new ByteData(data);
    }
  }
  exports.fromArray = function fromArray(array) {
    return array.reduce(function(acc, seg) {
      if (typeof seg === "string") {
        acc.push(buildSingleSegment(seg, null));
      } else if (seg.data) {
        acc.push(buildSingleSegment(seg.data, seg.mode));
      }
      return acc;
    }, []);
  };
  exports.fromString = function fromString(data, version) {
    const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
    const nodes = buildNodes(segs);
    const graph = buildGraph(nodes, version);
    const path17 = dijkstra.find_path(graph.map, "start", "end");
    const optimizedSegs = [];
    for (let i = 1;i < path17.length - 1; i++) {
      optimizedSegs.push(graph.table[path17[i]].node);
    }
    return exports.fromArray(mergeSegments(optimizedSegs));
  };
  exports.rawSplit = function rawSplit(data) {
    return exports.fromArray(getSegmentsFromString(data, Utils.isKanjiModeEnabled()));
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/core/qrcode.js
var require_qrcode = __commonJS((exports) => {
  var Utils = require_utils();
  var ECLevel = require_error_correction_level();
  var BitBuffer = require_bit_buffer();
  var BitMatrix = require_bit_matrix();
  var AlignmentPattern = require_alignment_pattern();
  var FinderPattern = require_finder_pattern();
  var MaskPattern = require_mask_pattern();
  var ECCode = require_error_correction_code();
  var ReedSolomonEncoder = require_reed_solomon_encoder();
  var Version = require_version();
  var FormatInfo = require_format_info();
  var Mode = require_mode();
  var Segments = require_segments();
  function setupFinderPattern(matrix, version) {
    const size = matrix.size;
    const pos = FinderPattern.getPositions(version);
    for (let i = 0;i < pos.length; i++) {
      const row = pos[i][0];
      const col = pos[i][1];
      for (let r = -1;r <= 7; r++) {
        if (row + r <= -1 || size <= row + r)
          continue;
        for (let c = -1;c <= 7; c++) {
          if (col + c <= -1 || size <= col + c)
            continue;
          if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
            matrix.set(row + r, col + c, true, true);
          } else {
            matrix.set(row + r, col + c, false, true);
          }
        }
      }
    }
  }
  function setupTimingPattern(matrix) {
    const size = matrix.size;
    for (let r = 8;r < size - 8; r++) {
      const value = r % 2 === 0;
      matrix.set(r, 6, value, true);
      matrix.set(6, r, value, true);
    }
  }
  function setupAlignmentPattern(matrix, version) {
    const pos = AlignmentPattern.getPositions(version);
    for (let i = 0;i < pos.length; i++) {
      const row = pos[i][0];
      const col = pos[i][1];
      for (let r = -2;r <= 2; r++) {
        for (let c = -2;c <= 2; c++) {
          if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
            matrix.set(row + r, col + c, true, true);
          } else {
            matrix.set(row + r, col + c, false, true);
          }
        }
      }
    }
  }
  function setupVersionInfo(matrix, version) {
    const size = matrix.size;
    const bits = Version.getEncodedBits(version);
    let row, col, mod;
    for (let i = 0;i < 18; i++) {
      row = Math.floor(i / 3);
      col = i % 3 + size - 8 - 3;
      mod = (bits >> i & 1) === 1;
      matrix.set(row, col, mod, true);
      matrix.set(col, row, mod, true);
    }
  }
  function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
    const size = matrix.size;
    const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
    let i, mod;
    for (i = 0;i < 15; i++) {
      mod = (bits >> i & 1) === 1;
      if (i < 6) {
        matrix.set(i, 8, mod, true);
      } else if (i < 8) {
        matrix.set(i + 1, 8, mod, true);
      } else {
        matrix.set(size - 15 + i, 8, mod, true);
      }
      if (i < 8) {
        matrix.set(8, size - i - 1, mod, true);
      } else if (i < 9) {
        matrix.set(8, 15 - i - 1 + 1, mod, true);
      } else {
        matrix.set(8, 15 - i - 1, mod, true);
      }
    }
    matrix.set(size - 8, 8, 1, true);
  }
  function setupData(matrix, data) {
    const size = matrix.size;
    let inc = -1;
    let row = size - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    for (let col = size - 1;col > 0; col -= 2) {
      if (col === 6)
        col--;
      while (true) {
        for (let c = 0;c < 2; c++) {
          if (!matrix.isReserved(row, col - c)) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = (data[byteIndex] >>> bitIndex & 1) === 1;
            }
            matrix.set(row, col - c, dark);
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || size <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
  function createData(version, errorCorrectionLevel, segments) {
    const buffer = new BitBuffer;
    segments.forEach(function(data) {
      buffer.put(data.mode.bit, 4);
      buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
      data.write(buffer);
    });
    const totalCodewords = Utils.getSymbolTotalCodewords(version);
    const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
    if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
      buffer.put(0, 4);
    }
    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(0);
    }
    const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
    for (let i = 0;i < remainingByte; i++) {
      buffer.put(i % 2 ? 17 : 236, 8);
    }
    return createCodewords(buffer, version, errorCorrectionLevel);
  }
  function createCodewords(bitBuffer, version, errorCorrectionLevel) {
    const totalCodewords = Utils.getSymbolTotalCodewords(version);
    const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
    const dataTotalCodewords = totalCodewords - ecTotalCodewords;
    const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
    const blocksInGroup2 = totalCodewords % ecTotalBlocks;
    const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
    const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
    const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
    const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
    const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
    const rs = new ReedSolomonEncoder(ecCount);
    let offset = 0;
    const dcData = new Array(ecTotalBlocks);
    const ecData = new Array(ecTotalBlocks);
    let maxDataSize = 0;
    const buffer = new Uint8Array(bitBuffer.buffer);
    for (let b = 0;b < ecTotalBlocks; b++) {
      const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
      dcData[b] = buffer.slice(offset, offset + dataSize);
      ecData[b] = rs.encode(dcData[b]);
      offset += dataSize;
      maxDataSize = Math.max(maxDataSize, dataSize);
    }
    const data = new Uint8Array(totalCodewords);
    let index = 0;
    let i, r;
    for (i = 0;i < maxDataSize; i++) {
      for (r = 0;r < ecTotalBlocks; r++) {
        if (i < dcData[r].length) {
          data[index++] = dcData[r][i];
        }
      }
    }
    for (i = 0;i < ecCount; i++) {
      for (r = 0;r < ecTotalBlocks; r++) {
        data[index++] = ecData[r][i];
      }
    }
    return data;
  }
  function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
    let segments;
    if (Array.isArray(data)) {
      segments = Segments.fromArray(data);
    } else if (typeof data === "string") {
      let estimatedVersion = version;
      if (!estimatedVersion) {
        const rawSegments = Segments.rawSplit(data);
        estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
      }
      segments = Segments.fromString(data, estimatedVersion || 40);
    } else {
      throw new Error("Invalid data");
    }
    const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
    if (!bestVersion) {
      throw new Error("The amount of data is too big to be stored in a QR Code");
    }
    if (!version) {
      version = bestVersion;
    } else if (version < bestVersion) {
      throw new Error(`
` + `The chosen QR Code version cannot contain this amount of data.
` + "Minimum version required to store current data is: " + bestVersion + `.
`);
    }
    const dataBits = createData(version, errorCorrectionLevel, segments);
    const moduleCount = Utils.getSymbolSize(version);
    const modules = new BitMatrix(moduleCount);
    setupFinderPattern(modules, version);
    setupTimingPattern(modules);
    setupAlignmentPattern(modules, version);
    setupFormatInfo(modules, errorCorrectionLevel, 0);
    if (version >= 7) {
      setupVersionInfo(modules, version);
    }
    setupData(modules, dataBits);
    if (isNaN(maskPattern)) {
      maskPattern = MaskPattern.getBestMask(modules, setupFormatInfo.bind(null, modules, errorCorrectionLevel));
    }
    MaskPattern.applyMask(maskPattern, modules);
    setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
    return {
      modules,
      version,
      errorCorrectionLevel,
      maskPattern,
      segments
    };
  }
  exports.create = function create(data, options) {
    if (typeof data === "undefined" || data === "") {
      throw new Error("No input text");
    }
    let errorCorrectionLevel = ECLevel.M;
    let version;
    let mask;
    if (typeof options !== "undefined") {
      errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
      version = Version.from(options.version);
      mask = MaskPattern.from(options.maskPattern);
      if (options.toSJISFunc) {
        Utils.setToSJISFunction(options.toSJISFunc);
      }
    }
    return createSymbol(data, version, errorCorrectionLevel, mask);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS((exports, module) => {
  var util3 = __require("util");
  var Stream = __require("stream");
  var ChunkStream = module.exports = function() {
    Stream.call(this);
    this._buffers = [];
    this._buffered = 0;
    this._reads = [];
    this._paused = false;
    this._encoding = "utf8";
    this.writable = true;
  };
  util3.inherits(ChunkStream, Stream);
  ChunkStream.prototype.read = function(length, callback) {
    this._reads.push({
      length: Math.abs(length),
      allowLess: length < 0,
      func: callback
    });
    process.nextTick(function() {
      this._process();
      if (this._paused && this._reads && this._reads.length > 0) {
        this._paused = false;
        this.emit("drain");
      }
    }.bind(this));
  };
  ChunkStream.prototype.write = function(data, encoding) {
    if (!this.writable) {
      this.emit("error", new Error("Stream not writable"));
      return false;
    }
    let dataBuffer;
    if (Buffer.isBuffer(data)) {
      dataBuffer = data;
    } else {
      dataBuffer = Buffer.from(data, encoding || this._encoding);
    }
    this._buffers.push(dataBuffer);
    this._buffered += dataBuffer.length;
    this._process();
    if (this._reads && this._reads.length === 0) {
      this._paused = true;
    }
    return this.writable && !this._paused;
  };
  ChunkStream.prototype.end = function(data, encoding) {
    if (data) {
      this.write(data, encoding);
    }
    this.writable = false;
    if (!this._buffers) {
      return;
    }
    if (this._buffers.length === 0) {
      this._end();
    } else {
      this._buffers.push(null);
      this._process();
    }
  };
  ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
  ChunkStream.prototype._end = function() {
    if (this._reads.length > 0) {
      this.emit("error", new Error("Unexpected end of input"));
    }
    this.destroy();
  };
  ChunkStream.prototype.destroy = function() {
    if (!this._buffers) {
      return;
    }
    this.writable = false;
    this._reads = null;
    this._buffers = null;
    this.emit("close");
  };
  ChunkStream.prototype._processReadAllowingLess = function(read) {
    this._reads.shift();
    let smallerBuf = this._buffers[0];
    if (smallerBuf.length > read.length) {
      this._buffered -= read.length;
      this._buffers[0] = smallerBuf.slice(read.length);
      read.func.call(this, smallerBuf.slice(0, read.length));
    } else {
      this._buffered -= smallerBuf.length;
      this._buffers.shift();
      read.func.call(this, smallerBuf);
    }
  };
  ChunkStream.prototype._processRead = function(read) {
    this._reads.shift();
    let pos = 0;
    let count = 0;
    let data = Buffer.alloc(read.length);
    while (pos < read.length) {
      let buf = this._buffers[count++];
      let len = Math.min(buf.length, read.length - pos);
      buf.copy(data, pos, 0, len);
      pos += len;
      if (len !== buf.length) {
        this._buffers[--count] = buf.slice(len);
      }
    }
    if (count > 0) {
      this._buffers.splice(0, count);
    }
    this._buffered -= read.length;
    read.func.call(this, data);
  };
  ChunkStream.prototype._process = function() {
    try {
      while (this._buffered > 0 && this._reads && this._reads.length > 0) {
        let read = this._reads[0];
        if (read.allowLess) {
          this._processReadAllowingLess(read);
        } else if (this._buffered >= read.length) {
          this._processRead(read);
        } else {
          break;
        }
      }
      if (this._buffers && !this.writable) {
        this._end();
      }
    } catch (ex) {
      this.emit("error", ex);
    }
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS((exports) => {
  var imagePasses = [
    {
      x: [0],
      y: [0]
    },
    {
      x: [4],
      y: [0]
    },
    {
      x: [0, 4],
      y: [4]
    },
    {
      x: [2, 6],
      y: [0, 4]
    },
    {
      x: [0, 2, 4, 6],
      y: [2, 6]
    },
    {
      x: [1, 3, 5, 7],
      y: [0, 2, 4, 6]
    },
    {
      x: [0, 1, 2, 3, 4, 5, 6, 7],
      y: [1, 3, 5, 7]
    }
  ];
  exports.getImagePasses = function(width, height) {
    let images = [];
    let xLeftOver = width % 8;
    let yLeftOver = height % 8;
    let xRepeats = (width - xLeftOver) / 8;
    let yRepeats = (height - yLeftOver) / 8;
    for (let i = 0;i < imagePasses.length; i++) {
      let pass = imagePasses[i];
      let passWidth = xRepeats * pass.x.length;
      let passHeight = yRepeats * pass.y.length;
      for (let j = 0;j < pass.x.length; j++) {
        if (pass.x[j] < xLeftOver) {
          passWidth++;
        } else {
          break;
        }
      }
      for (let j = 0;j < pass.y.length; j++) {
        if (pass.y[j] < yLeftOver) {
          passHeight++;
        } else {
          break;
        }
      }
      if (passWidth > 0 && passHeight > 0) {
        images.push({ width: passWidth, height: passHeight, index: i });
      }
    }
    return images;
  };
  exports.getInterlaceIterator = function(width) {
    return function(x, y, pass) {
      let outerXLeftOver = x % imagePasses[pass].x.length;
      let outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
      let outerYLeftOver = y % imagePasses[pass].y.length;
      let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
      return outerX * 4 + outerY * width * 4;
    };
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS((exports, module) => {
  module.exports = function paethPredictor(left, above, upLeft) {
    let paeth = left + above - upLeft;
    let pLeft = Math.abs(paeth - left);
    let pAbove = Math.abs(paeth - above);
    let pUpLeft = Math.abs(paeth - upLeft);
    if (pLeft <= pAbove && pLeft <= pUpLeft) {
      return left;
    }
    if (pAbove <= pUpLeft) {
      return above;
    }
    return upLeft;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS((exports, module) => {
  var interlaceUtils = require_interlace();
  var paethPredictor = require_paeth_predictor();
  function getByteWidth(width, bpp, depth) {
    let byteWidth = width * bpp;
    if (depth !== 8) {
      byteWidth = Math.ceil(byteWidth / (8 / depth));
    }
    return byteWidth;
  }
  var Filter = module.exports = function(bitmapInfo, dependencies) {
    let width = bitmapInfo.width;
    let height = bitmapInfo.height;
    let interlace = bitmapInfo.interlace;
    let bpp = bitmapInfo.bpp;
    let depth = bitmapInfo.depth;
    this.read = dependencies.read;
    this.write = dependencies.write;
    this.complete = dependencies.complete;
    this._imageIndex = 0;
    this._images = [];
    if (interlace) {
      let passes = interlaceUtils.getImagePasses(width, height);
      for (let i = 0;i < passes.length; i++) {
        this._images.push({
          byteWidth: getByteWidth(passes[i].width, bpp, depth),
          height: passes[i].height,
          lineIndex: 0
        });
      }
    } else {
      this._images.push({
        byteWidth: getByteWidth(width, bpp, depth),
        height,
        lineIndex: 0
      });
    }
    if (depth === 8) {
      this._xComparison = bpp;
    } else if (depth === 16) {
      this._xComparison = bpp * 2;
    } else {
      this._xComparison = 1;
    }
  };
  Filter.prototype.start = function() {
    this.read(this._images[this._imageIndex].byteWidth + 1, this._reverseFilterLine.bind(this));
  };
  Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
    let xComparison = this._xComparison;
    let xBiggerThan = xComparison - 1;
    for (let x = 0;x < byteWidth; x++) {
      let rawByte = rawData[1 + x];
      let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
      unfilteredLine[x] = rawByte + f1Left;
    }
  };
  Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
    let lastLine = this._lastLine;
    for (let x = 0;x < byteWidth; x++) {
      let rawByte = rawData[1 + x];
      let f2Up = lastLine ? lastLine[x] : 0;
      unfilteredLine[x] = rawByte + f2Up;
    }
  };
  Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
    let xComparison = this._xComparison;
    let xBiggerThan = xComparison - 1;
    let lastLine = this._lastLine;
    for (let x = 0;x < byteWidth; x++) {
      let rawByte = rawData[1 + x];
      let f3Up = lastLine ? lastLine[x] : 0;
      let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
      let f3Add = Math.floor((f3Left + f3Up) / 2);
      unfilteredLine[x] = rawByte + f3Add;
    }
  };
  Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
    let xComparison = this._xComparison;
    let xBiggerThan = xComparison - 1;
    let lastLine = this._lastLine;
    for (let x = 0;x < byteWidth; x++) {
      let rawByte = rawData[1 + x];
      let f4Up = lastLine ? lastLine[x] : 0;
      let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
      let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
      let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
      unfilteredLine[x] = rawByte + f4Add;
    }
  };
  Filter.prototype._reverseFilterLine = function(rawData) {
    let filter = rawData[0];
    let unfilteredLine;
    let currentImage = this._images[this._imageIndex];
    let byteWidth = currentImage.byteWidth;
    if (filter === 0) {
      unfilteredLine = rawData.slice(1, byteWidth + 1);
    } else {
      unfilteredLine = Buffer.alloc(byteWidth);
      switch (filter) {
        case 1:
          this._unFilterType1(rawData, unfilteredLine, byteWidth);
          break;
        case 2:
          this._unFilterType2(rawData, unfilteredLine, byteWidth);
          break;
        case 3:
          this._unFilterType3(rawData, unfilteredLine, byteWidth);
          break;
        case 4:
          this._unFilterType4(rawData, unfilteredLine, byteWidth);
          break;
        default:
          throw new Error("Unrecognised filter type - " + filter);
      }
    }
    this.write(unfilteredLine);
    currentImage.lineIndex++;
    if (currentImage.lineIndex >= currentImage.height) {
      this._lastLine = null;
      this._imageIndex++;
      currentImage = this._images[this._imageIndex];
    } else {
      this._lastLine = unfilteredLine;
    }
    if (currentImage) {
      this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
    } else {
      this._lastLine = null;
      this.complete();
    }
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS((exports, module) => {
  var util3 = __require("util");
  var ChunkStream = require_chunkstream();
  var Filter = require_filter_parse();
  var FilterAsync = module.exports = function(bitmapInfo) {
    ChunkStream.call(this);
    let buffers = [];
    let that = this;
    this._filter = new Filter(bitmapInfo, {
      read: this.read.bind(this),
      write: function(buffer) {
        buffers.push(buffer);
      },
      complete: function() {
        that.emit("complete", Buffer.concat(buffers));
      }
    });
    this._filter.start();
  };
  util3.inherits(FilterAsync, ChunkStream);
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/constants.js
var require_constants = __commonJS((exports, module) => {
  module.exports = {
    PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
    TYPE_IHDR: 1229472850,
    TYPE_IEND: 1229278788,
    TYPE_IDAT: 1229209940,
    TYPE_PLTE: 1347179589,
    TYPE_tRNS: 1951551059,
    TYPE_gAMA: 1732332865,
    COLORTYPE_GRAYSCALE: 0,
    COLORTYPE_PALETTE: 1,
    COLORTYPE_COLOR: 2,
    COLORTYPE_ALPHA: 4,
    COLORTYPE_PALETTE_COLOR: 3,
    COLORTYPE_COLOR_ALPHA: 6,
    COLORTYPE_TO_BPP_MAP: {
      0: 1,
      2: 3,
      3: 1,
      4: 2,
      6: 4
    },
    GAMMA_DIVISION: 1e5
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/crc.js
var require_crc = __commonJS((exports, module) => {
  var crcTable = [];
  (function() {
    for (let i = 0;i < 256; i++) {
      let currentCrc = i;
      for (let j = 0;j < 8; j++) {
        if (currentCrc & 1) {
          currentCrc = 3988292384 ^ currentCrc >>> 1;
        } else {
          currentCrc = currentCrc >>> 1;
        }
      }
      crcTable[i] = currentCrc;
    }
  })();
  var CrcCalculator = module.exports = function() {
    this._crc = -1;
  };
  CrcCalculator.prototype.write = function(data) {
    for (let i = 0;i < data.length; i++) {
      this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
    }
    return true;
  };
  CrcCalculator.prototype.crc32 = function() {
    return this._crc ^ -1;
  };
  CrcCalculator.crc32 = function(buf) {
    let crc = -1;
    for (let i = 0;i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
    }
    return crc ^ -1;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/parser.js
var require_parser = __commonJS((exports, module) => {
  var constants5 = require_constants();
  var CrcCalculator = require_crc();
  var Parser = module.exports = function(options, dependencies) {
    this._options = options;
    options.checkCRC = options.checkCRC !== false;
    this._hasIHDR = false;
    this._hasIEND = false;
    this._emittedHeadersFinished = false;
    this._palette = [];
    this._colorType = 0;
    this._chunks = {};
    this._chunks[constants5.TYPE_IHDR] = this._handleIHDR.bind(this);
    this._chunks[constants5.TYPE_IEND] = this._handleIEND.bind(this);
    this._chunks[constants5.TYPE_IDAT] = this._handleIDAT.bind(this);
    this._chunks[constants5.TYPE_PLTE] = this._handlePLTE.bind(this);
    this._chunks[constants5.TYPE_tRNS] = this._handleTRNS.bind(this);
    this._chunks[constants5.TYPE_gAMA] = this._handleGAMA.bind(this);
    this.read = dependencies.read;
    this.error = dependencies.error;
    this.metadata = dependencies.metadata;
    this.gamma = dependencies.gamma;
    this.transColor = dependencies.transColor;
    this.palette = dependencies.palette;
    this.parsed = dependencies.parsed;
    this.inflateData = dependencies.inflateData;
    this.finished = dependencies.finished;
    this.simpleTransparency = dependencies.simpleTransparency;
    this.headersFinished = dependencies.headersFinished || function() {};
  };
  Parser.prototype.start = function() {
    this.read(constants5.PNG_SIGNATURE.length, this._parseSignature.bind(this));
  };
  Parser.prototype._parseSignature = function(data) {
    let signature = constants5.PNG_SIGNATURE;
    for (let i = 0;i < signature.length; i++) {
      if (data[i] !== signature[i]) {
        this.error(new Error("Invalid file signature"));
        return;
      }
    }
    this.read(8, this._parseChunkBegin.bind(this));
  };
  Parser.prototype._parseChunkBegin = function(data) {
    let length = data.readUInt32BE(0);
    let type = data.readUInt32BE(4);
    let name = "";
    for (let i = 4;i < 8; i++) {
      name += String.fromCharCode(data[i]);
    }
    let ancillary = Boolean(data[4] & 32);
    if (!this._hasIHDR && type !== constants5.TYPE_IHDR) {
      this.error(new Error("Expected IHDR on beggining"));
      return;
    }
    this._crc = new CrcCalculator;
    this._crc.write(Buffer.from(name));
    if (this._chunks[type]) {
      return this._chunks[type](length);
    }
    if (!ancillary) {
      this.error(new Error("Unsupported critical chunk type " + name));
      return;
    }
    this.read(length + 4, this._skipChunk.bind(this));
  };
  Parser.prototype._skipChunk = function() {
    this.read(8, this._parseChunkBegin.bind(this));
  };
  Parser.prototype._handleChunkEnd = function() {
    this.read(4, this._parseChunkEnd.bind(this));
  };
  Parser.prototype._parseChunkEnd = function(data) {
    let fileCrc = data.readInt32BE(0);
    let calcCrc = this._crc.crc32();
    if (this._options.checkCRC && calcCrc !== fileCrc) {
      this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
      return;
    }
    if (!this._hasIEND) {
      this.read(8, this._parseChunkBegin.bind(this));
    }
  };
  Parser.prototype._handleIHDR = function(length) {
    this.read(length, this._parseIHDR.bind(this));
  };
  Parser.prototype._parseIHDR = function(data) {
    this._crc.write(data);
    let width = data.readUInt32BE(0);
    let height = data.readUInt32BE(4);
    let depth = data[8];
    let colorType = data[9];
    let compr = data[10];
    let filter = data[11];
    let interlace = data[12];
    if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
      this.error(new Error("Unsupported bit depth " + depth));
      return;
    }
    if (!(colorType in constants5.COLORTYPE_TO_BPP_MAP)) {
      this.error(new Error("Unsupported color type"));
      return;
    }
    if (compr !== 0) {
      this.error(new Error("Unsupported compression method"));
      return;
    }
    if (filter !== 0) {
      this.error(new Error("Unsupported filter method"));
      return;
    }
    if (interlace !== 0 && interlace !== 1) {
      this.error(new Error("Unsupported interlace method"));
      return;
    }
    this._colorType = colorType;
    let bpp = constants5.COLORTYPE_TO_BPP_MAP[this._colorType];
    this._hasIHDR = true;
    this.metadata({
      width,
      height,
      depth,
      interlace: Boolean(interlace),
      palette: Boolean(colorType & constants5.COLORTYPE_PALETTE),
      color: Boolean(colorType & constants5.COLORTYPE_COLOR),
      alpha: Boolean(colorType & constants5.COLORTYPE_ALPHA),
      bpp,
      colorType
    });
    this._handleChunkEnd();
  };
  Parser.prototype._handlePLTE = function(length) {
    this.read(length, this._parsePLTE.bind(this));
  };
  Parser.prototype._parsePLTE = function(data) {
    this._crc.write(data);
    let entries = Math.floor(data.length / 3);
    for (let i = 0;i < entries; i++) {
      this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255]);
    }
    this.palette(this._palette);
    this._handleChunkEnd();
  };
  Parser.prototype._handleTRNS = function(length) {
    this.simpleTransparency();
    this.read(length, this._parseTRNS.bind(this));
  };
  Parser.prototype._parseTRNS = function(data) {
    this._crc.write(data);
    if (this._colorType === constants5.COLORTYPE_PALETTE_COLOR) {
      if (this._palette.length === 0) {
        this.error(new Error("Transparency chunk must be after palette"));
        return;
      }
      if (data.length > this._palette.length) {
        this.error(new Error("More transparent colors than palette size"));
        return;
      }
      for (let i = 0;i < data.length; i++) {
        this._palette[i][3] = data[i];
      }
      this.palette(this._palette);
    }
    if (this._colorType === constants5.COLORTYPE_GRAYSCALE) {
      this.transColor([data.readUInt16BE(0)]);
    }
    if (this._colorType === constants5.COLORTYPE_COLOR) {
      this.transColor([
        data.readUInt16BE(0),
        data.readUInt16BE(2),
        data.readUInt16BE(4)
      ]);
    }
    this._handleChunkEnd();
  };
  Parser.prototype._handleGAMA = function(length) {
    this.read(length, this._parseGAMA.bind(this));
  };
  Parser.prototype._parseGAMA = function(data) {
    this._crc.write(data);
    this.gamma(data.readUInt32BE(0) / constants5.GAMMA_DIVISION);
    this._handleChunkEnd();
  };
  Parser.prototype._handleIDAT = function(length) {
    if (!this._emittedHeadersFinished) {
      this._emittedHeadersFinished = true;
      this.headersFinished();
    }
    this.read(-length, this._parseIDAT.bind(this, length));
  };
  Parser.prototype._parseIDAT = function(length, data) {
    this._crc.write(data);
    if (this._colorType === constants5.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
      throw new Error("Expected palette not found");
    }
    this.inflateData(data);
    let leftOverLength = length - data.length;
    if (leftOverLength > 0) {
      this._handleIDAT(leftOverLength);
    } else {
      this._handleChunkEnd();
    }
  };
  Parser.prototype._handleIEND = function(length) {
    this.read(length, this._parseIEND.bind(this));
  };
  Parser.prototype._parseIEND = function(data) {
    this._crc.write(data);
    this._hasIEND = true;
    this._handleChunkEnd();
    if (this.finished) {
      this.finished();
    }
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS((exports) => {
  var interlaceUtils = require_interlace();
  var pixelBppMapper = [
    function() {},
    function(pxData, data, pxPos, rawPos) {
      if (rawPos === data.length) {
        throw new Error("Ran out of data");
      }
      let pixel = data[rawPos];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = 255;
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos + 1 >= data.length) {
        throw new Error("Ran out of data");
      }
      let pixel = data[rawPos];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = data[rawPos + 1];
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos + 2 >= data.length) {
        throw new Error("Ran out of data");
      }
      pxData[pxPos] = data[rawPos];
      pxData[pxPos + 1] = data[rawPos + 1];
      pxData[pxPos + 2] = data[rawPos + 2];
      pxData[pxPos + 3] = 255;
    },
    function(pxData, data, pxPos, rawPos) {
      if (rawPos + 3 >= data.length) {
        throw new Error("Ran out of data");
      }
      pxData[pxPos] = data[rawPos];
      pxData[pxPos + 1] = data[rawPos + 1];
      pxData[pxPos + 2] = data[rawPos + 2];
      pxData[pxPos + 3] = data[rawPos + 3];
    }
  ];
  var pixelBppCustomMapper = [
    function() {},
    function(pxData, pixelData, pxPos, maxBit) {
      let pixel = pixelData[0];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = maxBit;
    },
    function(pxData, pixelData, pxPos) {
      let pixel = pixelData[0];
      pxData[pxPos] = pixel;
      pxData[pxPos + 1] = pixel;
      pxData[pxPos + 2] = pixel;
      pxData[pxPos + 3] = pixelData[1];
    },
    function(pxData, pixelData, pxPos, maxBit) {
      pxData[pxPos] = pixelData[0];
      pxData[pxPos + 1] = pixelData[1];
      pxData[pxPos + 2] = pixelData[2];
      pxData[pxPos + 3] = maxBit;
    },
    function(pxData, pixelData, pxPos) {
      pxData[pxPos] = pixelData[0];
      pxData[pxPos + 1] = pixelData[1];
      pxData[pxPos + 2] = pixelData[2];
      pxData[pxPos + 3] = pixelData[3];
    }
  ];
  function bitRetriever(data, depth) {
    let leftOver = [];
    let i = 0;
    function split() {
      if (i === data.length) {
        throw new Error("Ran out of data");
      }
      let byte = data[i];
      i++;
      let byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
      switch (depth) {
        default:
          throw new Error("unrecognised depth");
        case 16:
          byte2 = data[i];
          i++;
          leftOver.push((byte << 8) + byte2);
          break;
        case 4:
          byte2 = byte & 15;
          byte1 = byte >> 4;
          leftOver.push(byte1, byte2);
          break;
        case 2:
          byte4 = byte & 3;
          byte3 = byte >> 2 & 3;
          byte2 = byte >> 4 & 3;
          byte1 = byte >> 6 & 3;
          leftOver.push(byte1, byte2, byte3, byte4);
          break;
        case 1:
          byte8 = byte & 1;
          byte7 = byte >> 1 & 1;
          byte6 = byte >> 2 & 1;
          byte5 = byte >> 3 & 1;
          byte4 = byte >> 4 & 1;
          byte3 = byte >> 5 & 1;
          byte2 = byte >> 6 & 1;
          byte1 = byte >> 7 & 1;
          leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
          break;
      }
    }
    return {
      get: function(count) {
        while (leftOver.length < count) {
          split();
        }
        let returner = leftOver.slice(0, count);
        leftOver = leftOver.slice(count);
        return returner;
      },
      resetAfterLine: function() {
        leftOver.length = 0;
      },
      end: function() {
        if (i !== data.length) {
          throw new Error("extra data found");
        }
      }
    };
  }
  function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
    let imageWidth = image.width;
    let imageHeight = image.height;
    let imagePass = image.index;
    for (let y = 0;y < imageHeight; y++) {
      for (let x = 0;x < imageWidth; x++) {
        let pxPos = getPxPos(x, y, imagePass);
        pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
        rawPos += bpp;
      }
    }
    return rawPos;
  }
  function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
    let imageWidth = image.width;
    let imageHeight = image.height;
    let imagePass = image.index;
    for (let y = 0;y < imageHeight; y++) {
      for (let x = 0;x < imageWidth; x++) {
        let pixelData = bits.get(bpp);
        let pxPos = getPxPos(x, y, imagePass);
        pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
      }
      bits.resetAfterLine();
    }
  }
  exports.dataToBitMap = function(data, bitmapInfo) {
    let width = bitmapInfo.width;
    let height = bitmapInfo.height;
    let depth = bitmapInfo.depth;
    let bpp = bitmapInfo.bpp;
    let interlace = bitmapInfo.interlace;
    let bits;
    if (depth !== 8) {
      bits = bitRetriever(data, depth);
    }
    let pxData;
    if (depth <= 8) {
      pxData = Buffer.alloc(width * height * 4);
    } else {
      pxData = new Uint16Array(width * height * 4);
    }
    let maxBit = Math.pow(2, depth) - 1;
    let rawPos = 0;
    let images;
    let getPxPos;
    if (interlace) {
      images = interlaceUtils.getImagePasses(width, height);
      getPxPos = interlaceUtils.getInterlaceIterator(width, height);
    } else {
      let nonInterlacedPxPos = 0;
      getPxPos = function() {
        let returner = nonInterlacedPxPos;
        nonInterlacedPxPos += 4;
        return returner;
      };
      images = [{ width, height }];
    }
    for (let imageIndex = 0;imageIndex < images.length; imageIndex++) {
      if (depth === 8) {
        rawPos = mapImage8Bit(images[imageIndex], pxData, getPxPos, bpp, data, rawPos);
      } else {
        mapImageCustomBit(images[imageIndex], pxData, getPxPos, bpp, bits, maxBit);
      }
    }
    if (depth === 8) {
      if (rawPos !== data.length) {
        throw new Error("extra data found");
      }
    } else {
      bits.end();
    }
    return pxData;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS((exports, module) => {
  function dePalette(indata, outdata, width, height, palette) {
    let pxPos = 0;
    for (let y = 0;y < height; y++) {
      for (let x = 0;x < width; x++) {
        let color = palette[indata[pxPos]];
        if (!color) {
          throw new Error("index " + indata[pxPos] + " not in palette");
        }
        for (let i = 0;i < 4; i++) {
          outdata[pxPos + i] = color[i];
        }
        pxPos += 4;
      }
    }
  }
  function replaceTransparentColor(indata, outdata, width, height, transColor) {
    let pxPos = 0;
    for (let y = 0;y < height; y++) {
      for (let x = 0;x < width; x++) {
        let makeTrans = false;
        if (transColor.length === 1) {
          if (transColor[0] === indata[pxPos]) {
            makeTrans = true;
          }
        } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
          makeTrans = true;
        }
        if (makeTrans) {
          for (let i = 0;i < 4; i++) {
            outdata[pxPos + i] = 0;
          }
        }
        pxPos += 4;
      }
    }
  }
  function scaleDepth(indata, outdata, width, height, depth) {
    let maxOutSample = 255;
    let maxInSample = Math.pow(2, depth) - 1;
    let pxPos = 0;
    for (let y = 0;y < height; y++) {
      for (let x = 0;x < width; x++) {
        for (let i = 0;i < 4; i++) {
          outdata[pxPos + i] = Math.floor(indata[pxPos + i] * maxOutSample / maxInSample + 0.5);
        }
        pxPos += 4;
      }
    }
  }
  module.exports = function(indata, imageData) {
    let depth = imageData.depth;
    let width = imageData.width;
    let height = imageData.height;
    let colorType = imageData.colorType;
    let transColor = imageData.transColor;
    let palette = imageData.palette;
    let outdata = indata;
    if (colorType === 3) {
      dePalette(indata, outdata, width, height, palette);
    } else {
      if (transColor) {
        replaceTransparentColor(indata, outdata, width, height, transColor);
      }
      if (depth !== 8) {
        if (depth === 16) {
          outdata = Buffer.alloc(width * height * 4);
        }
        scaleDepth(indata, outdata, width, height, depth);
      }
    }
    return outdata;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS((exports, module) => {
  var util3 = __require("util");
  var zlib = __require("zlib");
  var ChunkStream = require_chunkstream();
  var FilterAsync = require_filter_parse_async();
  var Parser = require_parser();
  var bitmapper = require_bitmapper();
  var formatNormaliser = require_format_normaliser();
  var ParserAsync = module.exports = function(options) {
    ChunkStream.call(this);
    this._parser = new Parser(options, {
      read: this.read.bind(this),
      error: this._handleError.bind(this),
      metadata: this._handleMetaData.bind(this),
      gamma: this.emit.bind(this, "gamma"),
      palette: this._handlePalette.bind(this),
      transColor: this._handleTransColor.bind(this),
      finished: this._finished.bind(this),
      inflateData: this._inflateData.bind(this),
      simpleTransparency: this._simpleTransparency.bind(this),
      headersFinished: this._headersFinished.bind(this)
    });
    this._options = options;
    this.writable = true;
    this._parser.start();
  };
  util3.inherits(ParserAsync, ChunkStream);
  ParserAsync.prototype._handleError = function(err) {
    this.emit("error", err);
    this.writable = false;
    this.destroy();
    if (this._inflate && this._inflate.destroy) {
      this._inflate.destroy();
    }
    if (this._filter) {
      this._filter.destroy();
      this._filter.on("error", function() {});
    }
    this.errord = true;
  };
  ParserAsync.prototype._inflateData = function(data) {
    if (!this._inflate) {
      if (this._bitmapInfo.interlace) {
        this._inflate = zlib.createInflate();
        this._inflate.on("error", this.emit.bind(this, "error"));
        this._filter.on("complete", this._complete.bind(this));
        this._inflate.pipe(this._filter);
      } else {
        let rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
        let imageSize = rowSize * this._bitmapInfo.height;
        let chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
        this._inflate = zlib.createInflate({ chunkSize });
        let leftToInflate = imageSize;
        let emitError = this.emit.bind(this, "error");
        this._inflate.on("error", function(err) {
          if (!leftToInflate) {
            return;
          }
          emitError(err);
        });
        this._filter.on("complete", this._complete.bind(this));
        let filterWrite = this._filter.write.bind(this._filter);
        this._inflate.on("data", function(chunk) {
          if (!leftToInflate) {
            return;
          }
          if (chunk.length > leftToInflate) {
            chunk = chunk.slice(0, leftToInflate);
          }
          leftToInflate -= chunk.length;
          filterWrite(chunk);
        });
        this._inflate.on("end", this._filter.end.bind(this._filter));
      }
    }
    this._inflate.write(data);
  };
  ParserAsync.prototype._handleMetaData = function(metaData) {
    this._metaData = metaData;
    this._bitmapInfo = Object.create(metaData);
    this._filter = new FilterAsync(this._bitmapInfo);
  };
  ParserAsync.prototype._handleTransColor = function(transColor) {
    this._bitmapInfo.transColor = transColor;
  };
  ParserAsync.prototype._handlePalette = function(palette) {
    this._bitmapInfo.palette = palette;
  };
  ParserAsync.prototype._simpleTransparency = function() {
    this._metaData.alpha = true;
  };
  ParserAsync.prototype._headersFinished = function() {
    this.emit("metadata", this._metaData);
  };
  ParserAsync.prototype._finished = function() {
    if (this.errord) {
      return;
    }
    if (!this._inflate) {
      this.emit("error", "No Inflate block");
    } else {
      this._inflate.end();
    }
  };
  ParserAsync.prototype._complete = function(filteredData) {
    if (this.errord) {
      return;
    }
    let normalisedBitmapData;
    try {
      let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
      normalisedBitmapData = formatNormaliser(bitmapData, this._bitmapInfo);
      bitmapData = null;
    } catch (ex) {
      this._handleError(ex);
      return;
    }
    this.emit("parsed", normalisedBitmapData);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS((exports, module) => {
  var constants5 = require_constants();
  module.exports = function(dataIn, width, height, options) {
    let outHasAlpha = [constants5.COLORTYPE_COLOR_ALPHA, constants5.COLORTYPE_ALPHA].indexOf(options.colorType) !== -1;
    if (options.colorType === options.inputColorType) {
      let bigEndian = function() {
        let buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, 256, true);
        return new Int16Array(buffer)[0] !== 256;
      }();
      if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
        return dataIn;
      }
    }
    let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
    let maxValue = 255;
    let inBpp = constants5.COLORTYPE_TO_BPP_MAP[options.inputColorType];
    if (inBpp === 4 && !options.inputHasAlpha) {
      inBpp = 3;
    }
    let outBpp = constants5.COLORTYPE_TO_BPP_MAP[options.colorType];
    if (options.bitDepth === 16) {
      maxValue = 65535;
      outBpp *= 2;
    }
    let outData = Buffer.alloc(width * height * outBpp);
    let inIndex = 0;
    let outIndex = 0;
    let bgColor = options.bgColor || {};
    if (bgColor.red === undefined) {
      bgColor.red = maxValue;
    }
    if (bgColor.green === undefined) {
      bgColor.green = maxValue;
    }
    if (bgColor.blue === undefined) {
      bgColor.blue = maxValue;
    }
    function getRGBA() {
      let red;
      let green;
      let blue;
      let alpha = maxValue;
      switch (options.inputColorType) {
        case constants5.COLORTYPE_COLOR_ALPHA:
          alpha = data[inIndex + 3];
          red = data[inIndex];
          green = data[inIndex + 1];
          blue = data[inIndex + 2];
          break;
        case constants5.COLORTYPE_COLOR:
          red = data[inIndex];
          green = data[inIndex + 1];
          blue = data[inIndex + 2];
          break;
        case constants5.COLORTYPE_ALPHA:
          alpha = data[inIndex + 1];
          red = data[inIndex];
          green = red;
          blue = red;
          break;
        case constants5.COLORTYPE_GRAYSCALE:
          red = data[inIndex];
          green = red;
          blue = red;
          break;
        default:
          throw new Error("input color type:" + options.inputColorType + " is not supported at present");
      }
      if (options.inputHasAlpha) {
        if (!outHasAlpha) {
          alpha /= maxValue;
          red = Math.min(Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0), maxValue);
          green = Math.min(Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0), maxValue);
          blue = Math.min(Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0), maxValue);
        }
      }
      return { red, green, blue, alpha };
    }
    for (let y = 0;y < height; y++) {
      for (let x = 0;x < width; x++) {
        let rgba = getRGBA(data, inIndex);
        switch (options.colorType) {
          case constants5.COLORTYPE_COLOR_ALPHA:
          case constants5.COLORTYPE_COLOR:
            if (options.bitDepth === 8) {
              outData[outIndex] = rgba.red;
              outData[outIndex + 1] = rgba.green;
              outData[outIndex + 2] = rgba.blue;
              if (outHasAlpha) {
                outData[outIndex + 3] = rgba.alpha;
              }
            } else {
              outData.writeUInt16BE(rgba.red, outIndex);
              outData.writeUInt16BE(rgba.green, outIndex + 2);
              outData.writeUInt16BE(rgba.blue, outIndex + 4);
              if (outHasAlpha) {
                outData.writeUInt16BE(rgba.alpha, outIndex + 6);
              }
            }
            break;
          case constants5.COLORTYPE_ALPHA:
          case constants5.COLORTYPE_GRAYSCALE: {
            let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
            if (options.bitDepth === 8) {
              outData[outIndex] = grayscale;
              if (outHasAlpha) {
                outData[outIndex + 1] = rgba.alpha;
              }
            } else {
              outData.writeUInt16BE(grayscale, outIndex);
              if (outHasAlpha) {
                outData.writeUInt16BE(rgba.alpha, outIndex + 2);
              }
            }
            break;
          }
          default:
            throw new Error("unrecognised color Type " + options.colorType);
        }
        inIndex += inBpp;
        outIndex += outBpp;
      }
    }
    return outData;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS((exports, module) => {
  var paethPredictor = require_paeth_predictor();
  function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
    for (let x = 0;x < byteWidth; x++) {
      rawData[rawPos + x] = pxData[pxPos + x];
    }
  }
  function filterSumNone(pxData, pxPos, byteWidth) {
    let sum = 0;
    let length = pxPos + byteWidth;
    for (let i = pxPos;i < length; i++) {
      sum += Math.abs(pxData[i]);
    }
    return sum;
  }
  function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
    for (let x = 0;x < byteWidth; x++) {
      let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      let val = pxData[pxPos + x] - left;
      rawData[rawPos + x] = val;
    }
  }
  function filterSumSub(pxData, pxPos, byteWidth, bpp) {
    let sum = 0;
    for (let x = 0;x < byteWidth; x++) {
      let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      let val = pxData[pxPos + x] - left;
      sum += Math.abs(val);
    }
    return sum;
  }
  function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
    for (let x = 0;x < byteWidth; x++) {
      let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      let val = pxData[pxPos + x] - up;
      rawData[rawPos + x] = val;
    }
  }
  function filterSumUp(pxData, pxPos, byteWidth) {
    let sum = 0;
    let length = pxPos + byteWidth;
    for (let x = pxPos;x < length; x++) {
      let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
      let val = pxData[x] - up;
      sum += Math.abs(val);
    }
    return sum;
  }
  function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
    for (let x = 0;x < byteWidth; x++) {
      let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      let val = pxData[pxPos + x] - (left + up >> 1);
      rawData[rawPos + x] = val;
    }
  }
  function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
    let sum = 0;
    for (let x = 0;x < byteWidth; x++) {
      let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      let val = pxData[pxPos + x] - (left + up >> 1);
      sum += Math.abs(val);
    }
    return sum;
  }
  function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
    for (let x = 0;x < byteWidth; x++) {
      let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
      let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
      rawData[rawPos + x] = val;
    }
  }
  function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
    let sum = 0;
    for (let x = 0;x < byteWidth; x++) {
      let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
      let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
      let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
      let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
      sum += Math.abs(val);
    }
    return sum;
  }
  var filters = {
    0: filterNone,
    1: filterSub,
    2: filterUp,
    3: filterAvg,
    4: filterPaeth
  };
  var filterSums = {
    0: filterSumNone,
    1: filterSumSub,
    2: filterSumUp,
    3: filterSumAvg,
    4: filterSumPaeth
  };
  module.exports = function(pxData, width, height, options, bpp) {
    let filterTypes;
    if (!("filterType" in options) || options.filterType === -1) {
      filterTypes = [0, 1, 2, 3, 4];
    } else if (typeof options.filterType === "number") {
      filterTypes = [options.filterType];
    } else {
      throw new Error("unrecognised filter types");
    }
    if (options.bitDepth === 16) {
      bpp *= 2;
    }
    let byteWidth = width * bpp;
    let rawPos = 0;
    let pxPos = 0;
    let rawData = Buffer.alloc((byteWidth + 1) * height);
    let sel = filterTypes[0];
    for (let y = 0;y < height; y++) {
      if (filterTypes.length > 1) {
        let min = Infinity;
        for (let i = 0;i < filterTypes.length; i++) {
          let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
          if (sum < min) {
            sel = filterTypes[i];
            min = sum;
          }
        }
      }
      rawData[rawPos] = sel;
      rawPos++;
      filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
      rawPos += byteWidth;
      pxPos += byteWidth;
    }
    return rawData;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/packer.js
var require_packer = __commonJS((exports, module) => {
  var constants5 = require_constants();
  var CrcStream = require_crc();
  var bitPacker = require_bitpacker();
  var filter = require_filter_pack();
  var zlib = __require("zlib");
  var Packer = module.exports = function(options) {
    this._options = options;
    options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
    options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
    options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
    options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
    options.deflateFactory = options.deflateFactory || zlib.createDeflate;
    options.bitDepth = options.bitDepth || 8;
    options.colorType = typeof options.colorType === "number" ? options.colorType : constants5.COLORTYPE_COLOR_ALPHA;
    options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants5.COLORTYPE_COLOR_ALPHA;
    if ([
      constants5.COLORTYPE_GRAYSCALE,
      constants5.COLORTYPE_COLOR,
      constants5.COLORTYPE_COLOR_ALPHA,
      constants5.COLORTYPE_ALPHA
    ].indexOf(options.colorType) === -1) {
      throw new Error("option color type:" + options.colorType + " is not supported at present");
    }
    if ([
      constants5.COLORTYPE_GRAYSCALE,
      constants5.COLORTYPE_COLOR,
      constants5.COLORTYPE_COLOR_ALPHA,
      constants5.COLORTYPE_ALPHA
    ].indexOf(options.inputColorType) === -1) {
      throw new Error("option input color type:" + options.inputColorType + " is not supported at present");
    }
    if (options.bitDepth !== 8 && options.bitDepth !== 16) {
      throw new Error("option bit depth:" + options.bitDepth + " is not supported at present");
    }
  };
  Packer.prototype.getDeflateOptions = function() {
    return {
      chunkSize: this._options.deflateChunkSize,
      level: this._options.deflateLevel,
      strategy: this._options.deflateStrategy
    };
  };
  Packer.prototype.createDeflate = function() {
    return this._options.deflateFactory(this.getDeflateOptions());
  };
  Packer.prototype.filterData = function(data, width, height) {
    let packedData = bitPacker(data, width, height, this._options);
    let bpp = constants5.COLORTYPE_TO_BPP_MAP[this._options.colorType];
    let filteredData = filter(packedData, width, height, this._options, bpp);
    return filteredData;
  };
  Packer.prototype._packChunk = function(type, data) {
    let len = data ? data.length : 0;
    let buf = Buffer.alloc(len + 12);
    buf.writeUInt32BE(len, 0);
    buf.writeUInt32BE(type, 4);
    if (data) {
      data.copy(buf, 8);
    }
    buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
    return buf;
  };
  Packer.prototype.packGAMA = function(gamma) {
    let buf = Buffer.alloc(4);
    buf.writeUInt32BE(Math.floor(gamma * constants5.GAMMA_DIVISION), 0);
    return this._packChunk(constants5.TYPE_gAMA, buf);
  };
  Packer.prototype.packIHDR = function(width, height) {
    let buf = Buffer.alloc(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = this._options.bitDepth;
    buf[9] = this._options.colorType;
    buf[10] = 0;
    buf[11] = 0;
    buf[12] = 0;
    return this._packChunk(constants5.TYPE_IHDR, buf);
  };
  Packer.prototype.packIDAT = function(data) {
    return this._packChunk(constants5.TYPE_IDAT, data);
  };
  Packer.prototype.packIEND = function() {
    return this._packChunk(constants5.TYPE_IEND, null);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS((exports, module) => {
  var util3 = __require("util");
  var Stream = __require("stream");
  var constants5 = require_constants();
  var Packer = require_packer();
  var PackerAsync = module.exports = function(opt) {
    Stream.call(this);
    let options = opt || {};
    this._packer = new Packer(options);
    this._deflate = this._packer.createDeflate();
    this.readable = true;
  };
  util3.inherits(PackerAsync, Stream);
  PackerAsync.prototype.pack = function(data, width, height, gamma) {
    this.emit("data", Buffer.from(constants5.PNG_SIGNATURE));
    this.emit("data", this._packer.packIHDR(width, height));
    if (gamma) {
      this.emit("data", this._packer.packGAMA(gamma));
    }
    let filteredData = this._packer.filterData(data, width, height);
    this._deflate.on("error", this.emit.bind(this, "error"));
    this._deflate.on("data", function(compressedData) {
      this.emit("data", this._packer.packIDAT(compressedData));
    }.bind(this));
    this._deflate.on("end", function() {
      this.emit("data", this._packer.packIEND());
      this.emit("end");
    }.bind(this));
    this._deflate.end(filteredData);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS((exports, module) => {
  var assert = __require("assert").ok;
  var zlib = __require("zlib");
  var util3 = __require("util");
  var kMaxLength = __require("buffer").kMaxLength;
  function Inflate(opts) {
    if (!(this instanceof Inflate)) {
      return new Inflate(opts);
    }
    if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
      opts.chunkSize = zlib.Z_MIN_CHUNK;
    }
    zlib.Inflate.call(this, opts);
    this._offset = this._offset === undefined ? this._outOffset : this._offset;
    this._buffer = this._buffer || this._outBuffer;
    if (opts && opts.maxLength != null) {
      this._maxLength = opts.maxLength;
    }
  }
  function createInflate(opts) {
    return new Inflate(opts);
  }
  function _close(engine, callback) {
    if (callback) {
      process.nextTick(callback);
    }
    if (!engine._handle) {
      return;
    }
    engine._handle.close();
    engine._handle = null;
  }
  Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
    if (typeof asyncCb === "function") {
      return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
    }
    let self = this;
    let availInBefore = chunk && chunk.length;
    let availOutBefore = this._chunkSize - this._offset;
    let leftToInflate = this._maxLength;
    let inOff = 0;
    let buffers = [];
    let nread = 0;
    let error;
    this.on("error", function(err) {
      error = err;
    });
    function handleChunk(availInAfter, availOutAfter) {
      if (self._hadError) {
        return;
      }
      let have = availOutBefore - availOutAfter;
      assert(have >= 0, "have should not go down");
      if (have > 0) {
        let out = self._buffer.slice(self._offset, self._offset + have);
        self._offset += have;
        if (out.length > leftToInflate) {
          out = out.slice(0, leftToInflate);
        }
        buffers.push(out);
        nread += out.length;
        leftToInflate -= out.length;
        if (leftToInflate === 0) {
          return false;
        }
      }
      if (availOutAfter === 0 || self._offset >= self._chunkSize) {
        availOutBefore = self._chunkSize;
        self._offset = 0;
        self._buffer = Buffer.allocUnsafe(self._chunkSize);
      }
      if (availOutAfter === 0) {
        inOff += availInBefore - availInAfter;
        availInBefore = availInAfter;
        return true;
      }
      return false;
    }
    assert(this._handle, "zlib binding closed");
    let res;
    do {
      res = this._handle.writeSync(flushFlag, chunk, inOff, availInBefore, this._buffer, this._offset, availOutBefore);
      res = res || this._writeState;
    } while (!this._hadError && handleChunk(res[0], res[1]));
    if (this._hadError) {
      throw error;
    }
    if (nread >= kMaxLength) {
      _close(this);
      throw new RangeError("Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes");
    }
    let buf = Buffer.concat(buffers, nread);
    _close(this);
    return buf;
  };
  util3.inherits(Inflate, zlib.Inflate);
  function zlibBufferSync(engine, buffer) {
    if (typeof buffer === "string") {
      buffer = Buffer.from(buffer);
    }
    if (!(buffer instanceof Buffer)) {
      throw new TypeError("Not a string or buffer");
    }
    let flushFlag = engine._finishFlushFlag;
    if (flushFlag == null) {
      flushFlag = zlib.Z_FINISH;
    }
    return engine._processChunk(buffer, flushFlag);
  }
  function inflateSync(buffer, opts) {
    return zlibBufferSync(new Inflate(opts), buffer);
  }
  module.exports = exports = inflateSync;
  exports.Inflate = Inflate;
  exports.createInflate = createInflate;
  exports.inflateSync = inflateSync;
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS((exports, module) => {
  var SyncReader = module.exports = function(buffer) {
    this._buffer = buffer;
    this._reads = [];
  };
  SyncReader.prototype.read = function(length, callback) {
    this._reads.push({
      length: Math.abs(length),
      allowLess: length < 0,
      func: callback
    });
  };
  SyncReader.prototype.process = function() {
    while (this._reads.length > 0 && this._buffer.length) {
      let read = this._reads[0];
      if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
        this._reads.shift();
        let buf = this._buffer;
        this._buffer = buf.slice(read.length);
        read.func.call(this, buf.slice(0, read.length));
      } else {
        break;
      }
    }
    if (this._reads.length > 0) {
      return new Error("There are some read requests waitng on finished stream");
    }
    if (this._buffer.length > 0) {
      return new Error("unrecognised content at end of stream");
    }
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS((exports) => {
  var SyncReader = require_sync_reader();
  var Filter = require_filter_parse();
  exports.process = function(inBuffer, bitmapInfo) {
    let outBuffers = [];
    let reader = new SyncReader(inBuffer);
    let filter = new Filter(bitmapInfo, {
      read: reader.read.bind(reader),
      write: function(bufferPart) {
        outBuffers.push(bufferPart);
      },
      complete: function() {}
    });
    filter.start();
    reader.process();
    return Buffer.concat(outBuffers);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS((exports, module) => {
  var hasSyncZlib = true;
  var zlib = __require("zlib");
  var inflateSync = require_sync_inflate();
  if (!zlib.deflateSync) {
    hasSyncZlib = false;
  }
  var SyncReader = require_sync_reader();
  var FilterSync = require_filter_parse_sync();
  var Parser = require_parser();
  var bitmapper = require_bitmapper();
  var formatNormaliser = require_format_normaliser();
  module.exports = function(buffer, options) {
    if (!hasSyncZlib) {
      throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
    }
    let err;
    function handleError(_err_) {
      err = _err_;
    }
    let metaData;
    function handleMetaData(_metaData_) {
      metaData = _metaData_;
    }
    function handleTransColor(transColor) {
      metaData.transColor = transColor;
    }
    function handlePalette(palette) {
      metaData.palette = palette;
    }
    function handleSimpleTransparency() {
      metaData.alpha = true;
    }
    let gamma;
    function handleGamma(_gamma_) {
      gamma = _gamma_;
    }
    let inflateDataList = [];
    function handleInflateData(inflatedData2) {
      inflateDataList.push(inflatedData2);
    }
    let reader = new SyncReader(buffer);
    let parser = new Parser(options, {
      read: reader.read.bind(reader),
      error: handleError,
      metadata: handleMetaData,
      gamma: handleGamma,
      palette: handlePalette,
      transColor: handleTransColor,
      inflateData: handleInflateData,
      simpleTransparency: handleSimpleTransparency
    });
    parser.start();
    reader.process();
    if (err) {
      throw err;
    }
    let inflateData = Buffer.concat(inflateDataList);
    inflateDataList.length = 0;
    let inflatedData;
    if (metaData.interlace) {
      inflatedData = zlib.inflateSync(inflateData);
    } else {
      let rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
      let imageSize = rowSize * metaData.height;
      inflatedData = inflateSync(inflateData, {
        chunkSize: imageSize,
        maxLength: imageSize
      });
    }
    inflateData = null;
    if (!inflatedData || !inflatedData.length) {
      throw new Error("bad png - invalid inflate data response");
    }
    let unfilteredData = FilterSync.process(inflatedData, metaData);
    inflateData = null;
    let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
    unfilteredData = null;
    let normalisedBitmapData = formatNormaliser(bitmapData, metaData);
    metaData.data = normalisedBitmapData;
    metaData.gamma = gamma || 0;
    return metaData;
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS((exports, module) => {
  var hasSyncZlib = true;
  var zlib = __require("zlib");
  if (!zlib.deflateSync) {
    hasSyncZlib = false;
  }
  var constants5 = require_constants();
  var Packer = require_packer();
  module.exports = function(metaData, opt) {
    if (!hasSyncZlib) {
      throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
    }
    let options = opt || {};
    let packer = new Packer(options);
    let chunks = [];
    chunks.push(Buffer.from(constants5.PNG_SIGNATURE));
    chunks.push(packer.packIHDR(metaData.width, metaData.height));
    if (metaData.gamma) {
      chunks.push(packer.packGAMA(metaData.gamma));
    }
    let filteredData = packer.filterData(metaData.data, metaData.width, metaData.height);
    let compressedData = zlib.deflateSync(filteredData, packer.getDeflateOptions());
    filteredData = null;
    if (!compressedData || !compressedData.length) {
      throw new Error("bad png - invalid compressed data response");
    }
    chunks.push(packer.packIDAT(compressedData));
    chunks.push(packer.packIEND());
    return Buffer.concat(chunks);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS((exports) => {
  var parse2 = require_parser_sync();
  var pack = require_packer_sync();
  exports.read = function(buffer, options) {
    return parse2(buffer, options || {});
  };
  exports.write = function(png, options) {
    return pack(png, options);
  };
});

// node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs/lib/png.js
var require_png = __commonJS((exports) => {
  var util3 = __require("util");
  var Stream = __require("stream");
  var Parser = require_parser_async();
  var Packer = require_packer_async();
  var PNGSync = require_png_sync();
  var PNG = exports.PNG = function(options) {
    Stream.call(this);
    options = options || {};
    this.width = options.width | 0;
    this.height = options.height | 0;
    this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
    if (options.fill && this.data) {
      this.data.fill(0);
    }
    this.gamma = 0;
    this.readable = this.writable = true;
    this._parser = new Parser(options);
    this._parser.on("error", this.emit.bind(this, "error"));
    this._parser.on("close", this._handleClose.bind(this));
    this._parser.on("metadata", this._metadata.bind(this));
    this._parser.on("gamma", this._gamma.bind(this));
    this._parser.on("parsed", function(data) {
      this.data = data;
      this.emit("parsed", data);
    }.bind(this));
    this._packer = new Packer(options);
    this._packer.on("data", this.emit.bind(this, "data"));
    this._packer.on("end", this.emit.bind(this, "end"));
    this._parser.on("close", this._handleClose.bind(this));
    this._packer.on("error", this.emit.bind(this, "error"));
  };
  util3.inherits(PNG, Stream);
  PNG.sync = PNGSync;
  PNG.prototype.pack = function() {
    if (!this.data || !this.data.length) {
      this.emit("error", "No data provided");
      return this;
    }
    process.nextTick(function() {
      this._packer.pack(this.data, this.width, this.height, this.gamma);
    }.bind(this));
    return this;
  };
  PNG.prototype.parse = function(data, callback) {
    if (callback) {
      let onParsed, onError;
      onParsed = function(parsedData) {
        this.removeListener("error", onError);
        this.data = parsedData;
        callback(null, this);
      }.bind(this);
      onError = function(err) {
        this.removeListener("parsed", onParsed);
        callback(err, null);
      }.bind(this);
      this.once("parsed", onParsed);
      this.once("error", onError);
    }
    this.end(data);
    return this;
  };
  PNG.prototype.write = function(data) {
    this._parser.write(data);
    return true;
  };
  PNG.prototype.end = function(data) {
    this._parser.end(data);
  };
  PNG.prototype._metadata = function(metadata) {
    this.width = metadata.width;
    this.height = metadata.height;
    this.emit("metadata", metadata);
  };
  PNG.prototype._gamma = function(gamma) {
    this.gamma = gamma;
  };
  PNG.prototype._handleClose = function() {
    if (!this._parser.writable && !this._packer.readable) {
      this.emit("close");
    }
  };
  PNG.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
    srcX |= 0;
    srcY |= 0;
    width |= 0;
    height |= 0;
    deltaX |= 0;
    deltaY |= 0;
    if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
      throw new Error("bitblt reading outside image");
    }
    if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
      throw new Error("bitblt writing outside image");
    }
    for (let y = 0;y < height; y++) {
      src.data.copy(dst.data, (deltaY + y) * dst.width + deltaX << 2, (srcY + y) * src.width + srcX << 2, (srcY + y) * src.width + srcX + width << 2);
    }
  };
  PNG.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
    PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
    return this;
  };
  PNG.adjustGamma = function(src) {
    if (src.gamma) {
      for (let y = 0;y < src.height; y++) {
        for (let x = 0;x < src.width; x++) {
          let idx = src.width * y + x << 2;
          for (let i = 0;i < 3; i++) {
            let sample = src.data[idx + i] / 255;
            sample = Math.pow(sample, 1 / 2.2 / src.gamma);
            src.data[idx + i] = Math.round(sample * 255);
          }
        }
      }
      src.gamma = 0;
    }
  };
  PNG.prototype.adjustGamma = function() {
    PNG.adjustGamma(this);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/utils.js
var require_utils2 = __commonJS((exports) => {
  function hex2rgba(hex) {
    if (typeof hex === "number") {
      hex = hex.toString();
    }
    if (typeof hex !== "string") {
      throw new Error("Color should be defined as hex string");
    }
    let hexCode = hex.slice().replace("#", "").split("");
    if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
      throw new Error("Invalid hex color: " + hex);
    }
    if (hexCode.length === 3 || hexCode.length === 4) {
      hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
        return [c, c];
      }));
    }
    if (hexCode.length === 6)
      hexCode.push("F", "F");
    const hexValue = parseInt(hexCode.join(""), 16);
    return {
      r: hexValue >> 24 & 255,
      g: hexValue >> 16 & 255,
      b: hexValue >> 8 & 255,
      a: hexValue & 255,
      hex: "#" + hexCode.slice(0, 6).join("")
    };
  }
  exports.getOptions = function getOptions(options) {
    if (!options)
      options = {};
    if (!options.color)
      options.color = {};
    const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
    const width = options.width && options.width >= 21 ? options.width : undefined;
    const scale = options.scale || 4;
    return {
      width,
      scale: width ? 4 : scale,
      margin,
      color: {
        dark: hex2rgba(options.color.dark || "#000000ff"),
        light: hex2rgba(options.color.light || "#ffffffff")
      },
      type: options.type,
      rendererOpts: options.rendererOpts || {}
    };
  };
  exports.getScale = function getScale(qrSize, opts) {
    return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
  };
  exports.getImageWidth = function getImageWidth(qrSize, opts) {
    const scale = exports.getScale(qrSize, opts);
    return Math.floor((qrSize + opts.margin * 2) * scale);
  };
  exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
    const size = qr.modules.size;
    const data = qr.modules.data;
    const scale = exports.getScale(size, opts);
    const symbolSize = Math.floor((size + opts.margin * 2) * scale);
    const scaledMargin = opts.margin * scale;
    const palette = [opts.color.light, opts.color.dark];
    for (let i = 0;i < symbolSize; i++) {
      for (let j = 0;j < symbolSize; j++) {
        let posDst = (i * symbolSize + j) * 4;
        let pxColor = opts.color.light;
        if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
          const iSrc = Math.floor((i - scaledMargin) / scale);
          const jSrc = Math.floor((j - scaledMargin) / scale);
          pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
        }
        imgData[posDst++] = pxColor.r;
        imgData[posDst++] = pxColor.g;
        imgData[posDst++] = pxColor.b;
        imgData[posDst] = pxColor.a;
      }
    }
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/png.js
var require_png2 = __commonJS((exports) => {
  var fs11 = __require("fs");
  var PNG = require_png().PNG;
  var Utils = require_utils2();
  exports.render = function render(qrData, options) {
    const opts = Utils.getOptions(options);
    const pngOpts = opts.rendererOpts;
    const size = Utils.getImageWidth(qrData.modules.size, opts);
    pngOpts.width = size;
    pngOpts.height = size;
    const pngImage = new PNG(pngOpts);
    Utils.qrToImageData(pngImage.data, qrData, opts);
    return pngImage;
  };
  exports.renderToDataURL = function renderToDataURL(qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = undefined;
    }
    exports.renderToBuffer(qrData, options, function(err, output) {
      if (err)
        cb(err);
      let url = "data:image/png;base64,";
      url += output.toString("base64");
      cb(null, url);
    });
  };
  exports.renderToBuffer = function renderToBuffer(qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = undefined;
    }
    const png = exports.render(qrData, options);
    const buffer = [];
    png.on("error", cb);
    png.on("data", function(data) {
      buffer.push(data);
    });
    png.on("end", function() {
      cb(null, Buffer.concat(buffer));
    });
    png.pack();
  };
  exports.renderToFile = function renderToFile(path17, qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = undefined;
    }
    let called = false;
    const done = (...args) => {
      if (called)
        return;
      called = true;
      cb.apply(null, args);
    };
    const stream = fs11.createWriteStream(path17);
    stream.on("error", done);
    stream.on("close", done);
    exports.renderToFileStream(stream, qrData, options);
  };
  exports.renderToFileStream = function renderToFileStream(stream, qrData, options) {
    const png = exports.render(qrData, options);
    png.pack().pipe(stream);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/utf8.js
var require_utf8 = __commonJS((exports) => {
  var Utils = require_utils2();
  var BLOCK_CHAR = {
    WW: " ",
    WB: "\u2584",
    BB: "\u2588",
    BW: "\u2580"
  };
  var INVERTED_BLOCK_CHAR = {
    BB: " ",
    BW: "\u2584",
    WW: "\u2588",
    WB: "\u2580"
  };
  function getBlockChar(top, bottom, blocks) {
    if (top && bottom)
      return blocks.BB;
    if (top && !bottom)
      return blocks.BW;
    if (!top && bottom)
      return blocks.WB;
    return blocks.WW;
  }
  exports.render = function(qrData, options, cb) {
    const opts = Utils.getOptions(options);
    let blocks = BLOCK_CHAR;
    if (opts.color.dark.hex === "#ffffff" || opts.color.light.hex === "#000000") {
      blocks = INVERTED_BLOCK_CHAR;
    }
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    let output = "";
    let hMargin = Array(size + opts.margin * 2 + 1).join(blocks.WW);
    hMargin = Array(opts.margin / 2 + 1).join(hMargin + `
`);
    const vMargin = Array(opts.margin + 1).join(blocks.WW);
    output += hMargin;
    for (let i = 0;i < size; i += 2) {
      output += vMargin;
      for (let j = 0;j < size; j++) {
        const topModule = data[i * size + j];
        const bottomModule = data[(i + 1) * size + j];
        output += getBlockChar(topModule, bottomModule, blocks);
      }
      output += vMargin + `
`;
    }
    output += hMargin.slice(0, -1);
    if (typeof cb === "function") {
      cb(null, output);
    }
    return output;
  };
  exports.renderToFile = function renderToFile(path17, qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = undefined;
    }
    const fs11 = __require("fs");
    const utf8 = exports.render(qrData, options);
    fs11.writeFile(path17, utf8, cb);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/terminal/terminal.js
var require_terminal = __commonJS((exports) => {
  exports.render = function(qrData, options, cb) {
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    const black = "\x1B[40m  \x1B[0m";
    const white = "\x1B[47m  \x1B[0m";
    let output = "";
    const hMargin = Array(size + 3).join(white);
    const vMargin = Array(2).join(white);
    output += hMargin + `
`;
    for (let i = 0;i < size; ++i) {
      output += white;
      for (let j = 0;j < size; j++) {
        output += data[i * size + j] ? black : white;
      }
      output += vMargin + `
`;
    }
    output += hMargin + `
`;
    if (typeof cb === "function") {
      cb(null, output);
    }
    return output;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/terminal/terminal-small.js
var require_terminal_small = __commonJS((exports) => {
  var backgroundWhite = "\x1B[47m";
  var backgroundBlack = "\x1B[40m";
  var foregroundWhite = "\x1B[37m";
  var foregroundBlack = "\x1B[30m";
  var reset = "\x1B[0m";
  var lineSetupNormal = backgroundWhite + foregroundBlack;
  var lineSetupInverse = backgroundBlack + foregroundWhite;
  var createPalette = function(lineSetup, foregroundWhite2, foregroundBlack2) {
    return {
      "00": reset + " " + lineSetup,
      "01": reset + foregroundWhite2 + "\u2584" + lineSetup,
      "02": reset + foregroundBlack2 + "\u2584" + lineSetup,
      10: reset + foregroundWhite2 + "\u2580" + lineSetup,
      11: " ",
      12: "\u2584",
      20: reset + foregroundBlack2 + "\u2580" + lineSetup,
      21: "\u2580",
      22: "\u2588"
    };
  };
  var mkCodePixel = function(modules, size, x, y) {
    const sizePlus = size + 1;
    if (x >= sizePlus || y >= sizePlus || y < -1 || x < -1)
      return "0";
    if (x >= size || y >= size || y < 0 || x < 0)
      return "1";
    const idx = y * size + x;
    return modules[idx] ? "2" : "1";
  };
  var mkCode = function(modules, size, x, y) {
    return mkCodePixel(modules, size, x, y) + mkCodePixel(modules, size, x, y + 1);
  };
  exports.render = function(qrData, options, cb) {
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    const inverse = !!(options && options.inverse);
    const lineSetup = options && options.inverse ? lineSetupInverse : lineSetupNormal;
    const white = inverse ? foregroundBlack : foregroundWhite;
    const black = inverse ? foregroundWhite : foregroundBlack;
    const palette = createPalette(lineSetup, white, black);
    const newLine = reset + `
` + lineSetup;
    let output = lineSetup;
    for (let y = -1;y < size + 1; y += 2) {
      for (let x = -1;x < size; x++) {
        output += palette[mkCode(data, size, x, y)];
      }
      output += palette[mkCode(data, size, size, y)] + newLine;
    }
    output += reset;
    if (typeof cb === "function") {
      cb(null, output);
    }
    return output;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/terminal.js
var require_terminal2 = __commonJS((exports) => {
  var big = require_terminal();
  var small = require_terminal_small();
  exports.render = function(qrData, options, cb) {
    if (options && options.small) {
      return small.render(qrData, options, cb);
    }
    return big.render(qrData, options, cb);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/svg-tag.js
var require_svg_tag = __commonJS((exports) => {
  var Utils = require_utils2();
  function getColorAttrib(color, attrib) {
    const alpha = color.a / 255;
    const str = attrib + '="' + color.hex + '"';
    return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
  }
  function svgCmd(cmd, x, y) {
    let str = cmd + x;
    if (typeof y !== "undefined")
      str += " " + y;
    return str;
  }
  function qrToPath(data, size, margin) {
    let path17 = "";
    let moveBy = 0;
    let newRow = false;
    let lineLength = 0;
    for (let i = 0;i < data.length; i++) {
      const col = Math.floor(i % size);
      const row = Math.floor(i / size);
      if (!col && !newRow)
        newRow = true;
      if (data[i]) {
        lineLength++;
        if (!(i > 0 && col > 0 && data[i - 1])) {
          path17 += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
          moveBy = 0;
          newRow = false;
        }
        if (!(col + 1 < size && data[i + 1])) {
          path17 += svgCmd("h", lineLength);
          lineLength = 0;
        }
      } else {
        moveBy++;
      }
    }
    return path17;
  }
  exports.render = function render(qrData, options, cb) {
    const opts = Utils.getOptions(options);
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    const qrcodesize = size + opts.margin * 2;
    const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
    const path17 = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
    const viewBox = 'viewBox="' + "0 0 " + qrcodesize + " " + qrcodesize + '"';
    const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
    const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path17 + `</svg>
`;
    if (typeof cb === "function") {
      cb(null, svgTag);
    }
    return svgTag;
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/svg.js
var require_svg = __commonJS((exports) => {
  var svgTagRenderer = require_svg_tag();
  exports.render = svgTagRenderer.render;
  exports.renderToFile = function renderToFile(path17, qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = undefined;
    }
    const fs11 = __require("fs");
    const svgTag = exports.render(qrData, options);
    const xmlStr = '<?xml version="1.0" encoding="utf-8"?>' + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + svgTag;
    fs11.writeFile(path17, xmlStr, cb);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/renderer/canvas.js
var require_canvas = __commonJS((exports) => {
  var Utils = require_utils2();
  function clearCanvas(ctx, canvas, size) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!canvas.style)
      canvas.style = {};
    canvas.height = size;
    canvas.width = size;
    canvas.style.height = size + "px";
    canvas.style.width = size + "px";
  }
  function getCanvasElement() {
    try {
      return document.createElement("canvas");
    } catch (e) {
      throw new Error("You need to specify a canvas element");
    }
  }
  exports.render = function render(qrData, canvas, options) {
    let opts = options;
    let canvasEl = canvas;
    if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
      opts = canvas;
      canvas = undefined;
    }
    if (!canvas) {
      canvasEl = getCanvasElement();
    }
    opts = Utils.getOptions(opts);
    const size = Utils.getImageWidth(qrData.modules.size, opts);
    const ctx = canvasEl.getContext("2d");
    const image = ctx.createImageData(size, size);
    Utils.qrToImageData(image.data, qrData, opts);
    clearCanvas(ctx, canvasEl, size);
    ctx.putImageData(image, 0, 0);
    return canvasEl;
  };
  exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
    let opts = options;
    if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
      opts = canvas;
      canvas = undefined;
    }
    if (!opts)
      opts = {};
    const canvasEl = exports.render(qrData, canvas, opts);
    const type = opts.type || "image/png";
    const rendererOpts = opts.rendererOpts || {};
    return canvasEl.toDataURL(type, rendererOpts.quality);
  };
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/browser.js
var require_browser2 = __commonJS((exports) => {
  var canPromise = require_can_promise();
  var QRCode = require_qrcode();
  var CanvasRenderer = require_canvas();
  var SvgRenderer = require_svg_tag();
  function renderCanvas(renderFunc, canvas, text, opts, cb) {
    const args = [].slice.call(arguments, 1);
    const argsNum = args.length;
    const isLastArgCb = typeof args[argsNum - 1] === "function";
    if (!isLastArgCb && !canPromise()) {
      throw new Error("Callback required as last argument");
    }
    if (isLastArgCb) {
      if (argsNum < 2) {
        throw new Error("Too few arguments provided");
      }
      if (argsNum === 2) {
        cb = text;
        text = canvas;
        canvas = opts = undefined;
      } else if (argsNum === 3) {
        if (canvas.getContext && typeof cb === "undefined") {
          cb = opts;
          opts = undefined;
        } else {
          cb = opts;
          opts = text;
          text = canvas;
          canvas = undefined;
        }
      }
    } else {
      if (argsNum < 1) {
        throw new Error("Too few arguments provided");
      }
      if (argsNum === 1) {
        text = canvas;
        canvas = opts = undefined;
      } else if (argsNum === 2 && !canvas.getContext) {
        opts = text;
        text = canvas;
        canvas = undefined;
      }
      return new Promise(function(resolve2, reject) {
        try {
          const data = QRCode.create(text, opts);
          resolve2(renderFunc(data, canvas, opts));
        } catch (e) {
          reject(e);
        }
      });
    }
    try {
      const data = QRCode.create(text, opts);
      cb(null, renderFunc(data, canvas, opts));
    } catch (e) {
      cb(e);
    }
  }
  exports.create = QRCode.create;
  exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
  exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
  exports.toString = renderCanvas.bind(null, function(data, _, opts) {
    return SvgRenderer.render(data, opts);
  });
});

// node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/server.js
var require_server = __commonJS((exports) => {
  var canPromise = require_can_promise();
  var QRCode = require_qrcode();
  var PngRenderer = require_png2();
  var Utf8Renderer = require_utf8();
  var TerminalRenderer = require_terminal2();
  var SvgRenderer = require_svg();
  function checkParams(text, opts, cb) {
    if (typeof text === "undefined") {
      throw new Error("String required as first argument");
    }
    if (typeof cb === "undefined") {
      cb = opts;
      opts = {};
    }
    if (typeof cb !== "function") {
      if (!canPromise()) {
        throw new Error("Callback required as last argument");
      } else {
        opts = cb || {};
        cb = null;
      }
    }
    return {
      opts,
      cb
    };
  }
  function getTypeFromFilename(path17) {
    return path17.slice((path17.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  }
  function getRendererFromType(type) {
    switch (type) {
      case "svg":
        return SvgRenderer;
      case "txt":
      case "utf8":
        return Utf8Renderer;
      case "png":
      case "image/png":
      default:
        return PngRenderer;
    }
  }
  function getStringRendererFromType(type) {
    switch (type) {
      case "svg":
        return SvgRenderer;
      case "terminal":
        return TerminalRenderer;
      case "utf8":
      default:
        return Utf8Renderer;
    }
  }
  function render(renderFunc, text, params) {
    if (!params.cb) {
      return new Promise(function(resolve2, reject) {
        try {
          const data = QRCode.create(text, params.opts);
          return renderFunc(data, params.opts, function(err, data2) {
            return err ? reject(err) : resolve2(data2);
          });
        } catch (e) {
          reject(e);
        }
      });
    }
    try {
      const data = QRCode.create(text, params.opts);
      return renderFunc(data, params.opts, params.cb);
    } catch (e) {
      params.cb(e);
    }
  }
  exports.create = QRCode.create;
  exports.toCanvas = require_browser2().toCanvas;
  exports.toString = function toString(text, opts, cb) {
    const params = checkParams(text, opts, cb);
    const type = params.opts ? params.opts.type : undefined;
    const renderer = getStringRendererFromType(type);
    return render(renderer.render, text, params);
  };
  exports.toDataURL = function toDataURL(text, opts, cb) {
    const params = checkParams(text, opts, cb);
    const renderer = getRendererFromType(params.opts.type);
    return render(renderer.renderToDataURL, text, params);
  };
  exports.toBuffer = function toBuffer(text, opts, cb) {
    const params = checkParams(text, opts, cb);
    const renderer = getRendererFromType(params.opts.type);
    return render(renderer.renderToBuffer, text, params);
  };
  exports.toFile = function toFile(path17, text, opts, cb) {
    if (typeof path17 !== "string" || !(typeof text === "string" || typeof text === "object")) {
      throw new Error("Invalid argument");
    }
    if (arguments.length < 3 && !canPromise()) {
      throw new Error("Too few arguments provided");
    }
    const params = checkParams(text, opts, cb);
    const type = params.opts.type || getTypeFromFilename(path17);
    const renderer = getRendererFromType(type);
    const renderToFile = renderer.renderToFile.bind(null, path17);
    return render(renderToFile, text, params);
  };
  exports.toFileStream = function toFileStream(stream, text, opts) {
    if (arguments.length < 2) {
      throw new Error("Too few arguments provided");
    }
    const params = checkParams(text, opts, stream.emit.bind(stream, "error"));
    const renderer = getRendererFromType("png");
    const renderToFileStream = renderer.renderToFileStream.bind(null, stream);
    render(renderToFileStream, text, params);
  };
});

// src/cli/deck.ts
var exports_deck = {};
__export(exports_deck, {
  startNodeServer: () => startNodeServer,
  runDeck: () => runDeck,
  portAvailable: () => portAvailable,
  findCaddy: () => findCaddy,
  deckConfigDefaults: () => deckConfigDefaults,
  acquireDeckProcessLock: () => acquireDeckProcessLock
});
import { createServer as createServer2, request as httpRequest } from "http";
import { readFile as readFile4, writeFile as writeFile3, mkdtemp, rm as rm2 } from "fs/promises";
import { existsSync as existsSync17, readFileSync as readFileSync10, writeFileSync as writeFileSync8, mkdirSync as mkdirSync7, mkdtempSync as mkdtempSync5, cpSync as cpSync2, rmSync as rmSync5, readdirSync as readdirSync6, chmodSync as chmodSync5, lstatSync as lstatSync3, renameSync as renameSync5, openSync as openSync4, closeSync as closeSync4, unlinkSync as unlinkSync4 } from "fs";
import { execFileSync as execFileSync4, spawn as spawn9, spawnSync as spawnSync3 } from "child_process";
import { randomBytes } from "crypto";
import path17 from "path";
import os4 from "os";
import { WebSocket as WebSocket2, WebSocketServer as WebSocketServer2 } from "ws";
function acquireDeckProcessLock(lockFile = DECK_LOCK_FILE) {
  mkdirSync7(path17.dirname(lockFile), { recursive: true });
  for (let attempt = 0;attempt < 2; attempt++) {
    const nonce = randomBytes(8).toString("hex");
    try {
      const fd = openSync4(lockFile, "wx", 384);
      try {
        writeFileSync8(fd, JSON.stringify({ pid: process.pid, nonce }));
      } finally {
        closeSync4(fd);
      }
      chmodSync5(lockFile, 384);
      let released = false;
      return {
        acquired: true,
        existingPid: null,
        release: () => {
          if (released)
            return;
          released = true;
          try {
            const owner = JSON.parse(readFileSync10(lockFile, "utf8"));
            if (owner.pid === process.pid && owner.nonce === nonce)
              unlinkSync4(lockFile);
          } catch {}
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
      let existingPid = 0;
      try {
        const owner = JSON.parse(readFileSync10(lockFile, "utf8"));
        existingPid = Number(owner.pid);
      } catch {}
      if (Number.isInteger(existingPid) && existingPid > 1) {
        try {
          process.kill(existingPid, 0);
          return { acquired: false, existingPid, release: () => {} };
        } catch (signalError) {
          if (signalError.code === "EPERM") {
            return { acquired: false, existingPid, release: () => {} };
          }
        }
      }
      try {
        unlinkSync4(lockFile);
      } catch {}
    }
  }
  return { acquired: false, existingPid: null, release: () => {} };
}
function deckRoot() {
  const bundledRoot = process.env.SPEAKEASY_DECK_ROOT?.trim();
  if (bundledRoot)
    return path17.resolve(bundledRoot);
  const checkoutRoot = path17.resolve(__dirname, "..", "..", "deck");
  if (existsSync17(path17.join(checkoutRoot, "index.html")))
    return checkoutRoot;
  return INSTALLED_DECK_DIR;
}
async function installDeckSurface(dest) {
  const ref = `v${getPackageVersion()}`;
  console.log(source_default.dim(`  Fetching the Deck surface from github.com/${REPO} @ ${ref}\u2026`));
  const workdir = mkdtempSync5(path17.join(os4.tmpdir(), "speakeasy-deck-fetch-"));
  try {
    const tarball = path17.join(workdir, "repo.tar.gz");
    await downloadTarball(ref, tarball);
    validateTarballPaths(tarball);
    execFileSync4("tar", ["-xzf", tarball, "-C", workdir], { stdio: "pipe" });
    const top = readdirSync6(workdir).find((e) => existsSync17(path17.join(workdir, e, "deck", "index.html")));
    if (!top)
      throw new Error(`no deck surface in the ${ref} tarball`);
    const src = path17.join(workdir, top, "deck");
    assertNoSymlinks(src);
    const staging = `${dest}.staging-${process.pid}`;
    rmSync5(staging, { recursive: true, force: true });
    mkdirSync7(path17.dirname(dest), { recursive: true });
    mkdirSync7(staging);
    for (const asset of ["index.html", "themes.json", "variants"]) {
      const from = path17.join(src, asset);
      if (!existsSync17(from))
        throw new Error(`release tarball is missing deck/${asset}`);
      cpSync2(from, path17.join(staging, asset), { recursive: true });
    }
    writeFileSync8(path17.join(staging, DECK_VERSION_MARKER), getPackageVersion());
    rmSync5(dest, { recursive: true, force: true });
    renameSync5(staging, dest);
  } finally {
    rmSync5(workdir, { recursive: true, force: true });
  }
}
function installedSurfaceIsCurrent(root) {
  if (!existsSync17(path17.join(root, "index.html")))
    return false;
  try {
    return readFileSync10(path17.join(root, DECK_VERSION_MARKER), "utf8").trim() === getPackageVersion();
  } catch {
    return false;
  }
}
function lanAddress() {
  for (const addrs of Object.values(os4.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal)
        return addr.address;
    }
  }
  return;
}
function deviceSlug() {
  let name = "";
  if (process.platform === "darwin") {
    try {
      name = execFileSync4("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim();
    } catch {}
  }
  if (!name)
    name = os4.hostname().replace(/\.local$/, "");
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mac";
}
function macBonjourName() {
  const slug = deviceSlug();
  return slug ? `${slug}.local` : undefined;
}
function deckToken(rotate) {
  const file = path17.join(os4.homedir(), ".config", "speakeasy", "deck-token");
  if (!rotate) {
    try {
      const st = lstatSync3(file);
      const uid = typeof process.getuid === "function" ? process.getuid() : -1;
      if (st.isFile() && !st.isSymbolicLink() && (uid === -1 || st.uid === uid)) {
        if ((st.mode & 511) !== 384)
          chmodSync5(file, 384);
        const existing = readFileSync10(file, "utf8").trim();
        if (/^[a-f0-9]{24,}$/.test(existing))
          return existing;
      }
    } catch {}
  }
  const token = randomBytes(12).toString("hex");
  try {
    const dir = path17.dirname(file);
    mkdirSync7(dir, { recursive: true });
    const tmp = path17.join(dir, `.deck-token.${process.pid}.tmp`);
    writeFileSync8(tmp, token, { mode: 384 });
    chmodSync5(tmp, 384);
    renameSync5(tmp, file);
  } catch {}
  return token;
}
function hostUrl(host, port) {
  return `http://${host}${port === 80 ? "" : `:${port}`}`;
}
async function portAvailable(port, allowPrivileged = false) {
  if (!allowPrivileged && port < 1024 && typeof process.getuid === "function" && process.getuid() !== 0)
    return false;
  const { createConnection: createConnection3, createServer: createServer3 } = await import("net");
  const accepts = async (host) => new Promise((resolve2) => {
    const socket = createConnection3({ host, port });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve2(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(250, () => done(false));
  });
  if (await accepts("127.0.0.1") || await accepts("::1"))
    return false;
  return new Promise((resolve2) => {
    const probe = createServer3();
    probe.once("error", () => resolve2(false));
    probe.listen({ port, host: "0.0.0.0", exclusive: true }, () => probe.close(() => resolve2(true)));
  });
}
async function advertiseVanity(host, port) {
  try {
    const { default: Bonjour } = await Promise.resolve().then(() => __toESM(require_dist(), 1));
    const bonjour = new Bonjour;
    const service = bonjour.publish({ name: `SpeakEasy Deck (${host})`, type: "http", port, host });
    const up = await new Promise((resolve2) => {
      service.on("up", () => resolve2(true));
      service.on("error", () => resolve2(false));
      setTimeout(() => resolve2(false), 2000).unref();
    });
    if (!up) {
      service.stop?.();
      bonjour.destroy();
      return null;
    }
    return () => {
      service.stop?.();
      bonjour.destroy();
    };
  } catch {
    return null;
  }
}
async function registerEdgeRoute(host, port) {
  try {
    const admin = "http://127.0.0.1:2019";
    const serversRes = await fetch(`${admin}/config/apps/http/servers/`, { signal: AbortSignal.timeout(1500) });
    if (!serversRes.ok)
      return null;
    const servers = await serversRes.json();
    const srv = Object.keys(servers).find((name) => (servers[name].listen ?? []).some((l) => l.endsWith(":80")));
    if (!srv)
      return null;
    await fetch(`${admin}/id/${EDGE_ROUTE_ID}`, { method: "DELETE", signal: AbortSignal.timeout(1500) }).catch(() => {});
    const res = await fetch(`${admin}/config/apps/http/servers/${srv}/routes/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        "@id": EDGE_ROUTE_ID,
        match: [{ host: [host] }],
        handle: [{ handler: "reverse_proxy", upstreams: [{ dial: `127.0.0.1:${port}` }] }],
        terminal: true
      }),
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok)
      return null;
    return () => {
      fetch(`${admin}/id/${EDGE_ROUTE_ID}`, { method: "DELETE", signal: AbortSignal.timeout(2000) }).catch(() => {});
    };
  } catch {
    return null;
  }
}
function findCaddy(runtimeExecutable = process.execPath) {
  const bundled = path17.join(path17.dirname(runtimeExecutable), "caddy");
  try {
    const stat = lstatSync3(bundled);
    if (stat.isFile() && (stat.mode & 73) !== 0)
      return bundled;
  } catch {}
  const res = spawnSync3("which", ["caddy"], { encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}
function caddyConfig(root, port, tlsHost, caCert, live) {
  const gate = live?.token ? `
		@tok query k=${live.token}` : "";
  const prox = live?.token ? " @tok" : "";
  const liveRoutes = live ? `
	route /ws* {${gate}
		reverse_proxy${prox} 127.0.0.1:${live.dataPort}
		respond 403
	}

	route /api/* {${gate}
		reverse_proxy${prox} 127.0.0.1:${live.dataPort}
		respond 403
	}

	route /audio/* {${gate}
		reverse_proxy${prox} 127.0.0.1:${live.dataPort}
		respond 403
	}
` : "";
  const caRoute = caCert ? `
	@cacert path /ca.crt
	handle @cacert {
		root * "${path17.dirname(caCert)}"
		rewrite * /root.crt
		header Content-Type application/x-x509-ca-cert
		file_server
	}
` : "";
  const tlsSite = tlsHost ? `
https://${tlsHost} {
	tls internal
	root * ${root}
	file_server

	header Cache-Control "no-store"
${liveRoutes}${caRoute}
	@healthz path /healthz
	handle @healthz {
		header Content-Type application/json
		respond \`{"ok":true,"service":"speakeasy-deck","port":${port},"tls":true}\` 200
	}

	log {
		output discard
	}
}
` : "";
  const globalOpts = tlsHost ? `{
	admin off
	auto_https disable_redirects
}
` : `{
	admin off
	auto_https off
}
`;
  return `${globalOpts}
http://:${port} {
	root * ${root}
	file_server

	header Cache-Control "no-store"
${liveRoutes}${caRoute}
	@healthz path /healthz
	handle @healthz {
		header Content-Type application/json
		respond \`{"ok":true,"service":"speakeasy-deck","port":${port}}\` 200
	}

	log {
		output discard
	}
}
${tlsSite}`;
}
function trustLocalCA(rootCert) {
  if (process.platform !== "darwin")
    return false;
  const keychain = path17.join(os4.homedir(), "Library", "Keychains", "login.keychain-db");
  const found = spawnSync3("security", ["find-certificate", "-c", "Caddy Local Authority", keychain], { stdio: "pipe" });
  if (found.status === 0)
    return true;
  const added = spawnSync3("security", ["add-trusted-cert", "-r", "trustRoot", "-k", keychain, rootCert], { stdio: "pipe" });
  return added.status === 0;
}
function caddyRootCert(expected = false) {
  const candidates = [
    path17.join(os4.homedir(), "Library", "Application Support", "Caddy", "pki", "authorities", "local", "root.crt"),
    path17.join(os4.homedir(), ".local", "share", "caddy", "pki", "authorities", "local", "root.crt")
  ];
  const existing = candidates.find((p) => existsSync17(p));
  return existing ?? (expected ? candidates[process.platform === "darwin" ? 0 : 1] : undefined);
}
async function startCaddy(caddy, root, port, tlsHost, caCert, live) {
  const dir = await mkdtemp(path17.join(os4.tmpdir(), "speakeasy-deck-"));
  const config = path17.join(dir, "Caddyfile");
  await writeFile3(config, caddyConfig(root, port, tlsHost, caCert, live));
  const child = spawn9(caddy, ["run", "--config", config], { stdio: ["ignore", "ignore", "pipe"] });
  let errBuf = "";
  child.stderr?.on("data", (d) => errBuf += d);
  const cleanup = () => rm2(dir, { recursive: true, force: true }).catch(() => {});
  const exited = new Promise((resolve2) => {
    child.once("exit", (code) => {
      cleanup();
      resolve2(code);
    });
    child.once("error", (error) => {
      errBuf += String(error);
      cleanup();
      resolve2(-1);
    });
  });
  let stopped = false;
  const escalatedStop = () => {
    if (stopped)
      return;
    stopped = true;
    child.kill("SIGINT");
    const killer = setTimeout(() => child.kill("SIGKILL"), 3000);
    killer.unref();
    exited.finally(() => clearTimeout(killer));
  };
  const deadline = Date.now() + 1e4;
  for (;; ) {
    let settled = false;
    await Promise.race([exited.then(() => settled = true), new Promise((r) => setTimeout(r, 150))]);
    if (settled) {
      throw new Error(`caddy exited before becoming ready: ${errBuf.trim() || "no output"}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (res.ok)
        break;
    } catch {}
    if (Date.now() > deadline) {
      escalatedStop();
      await Promise.race([exited, new Promise((r) => setTimeout(r, 3500))]);
      throw new Error("caddy did not become ready in 10s");
    }
  }
  return {
    engine: "caddy",
    stop: escalatedStop,
    exited
  };
}
function proxyDataRequest(req, res, live) {
  const upstream = httpRequest({
    hostname: "127.0.0.1",
    port: live.dataPort,
    method: req.method,
    path: req.url,
    headers: req.headers
  }, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(res);
  });
  upstream.once("error", () => {
    if (!res.headersSent)
      res.writeHead(502);
    res.end("Deck runtime unavailable");
  });
  req.pipe(upstream);
}
async function startNodeServer(root, port, live) {
  const proxyWss = new WebSocketServer2({ noServer: true });
  const server = createServer2(async (req, res) => {
    let pathname;
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    if (pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, service: "speakeasy-deck", port }));
      return;
    }
    if (live && (pathname.startsWith("/api/") || pathname.startsWith("/audio/"))) {
      proxyDataRequest(req, res, live);
      return;
    }
    if (pathname === "/ca.crt") {
      const cert = caddyRootCert();
      if (cert) {
        res.writeHead(200, { "content-type": "application/x-x509-ca-cert", "cache-control": "no-store" });
        res.end(await readFile4(cert));
        return;
      }
    }
    if (pathname === "/")
      pathname = "/index.html";
    const file = path17.join(root, path17.normalize(pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile4(file);
      res.writeHead(200, {
        "content-type": TYPES[path17.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  server.on("upgrade", (req, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;
    } catch {}
    if (!live || pathname !== "/ws") {
      socket.end(`HTTP/1.1 404 Not Found\r
Connection: close\r
\r
`);
      return;
    }
    const requested = new URL(req.url ?? "/ws", `http://${req.headers.host ?? "localhost"}`);
    if (live.token && requested.searchParams.get("k") !== live.token) {
      socket.end(`HTTP/1.1 403 Forbidden\r
Connection: close\r
\r
`);
      return;
    }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) {
          socket.end(`HTTP/1.1 403 Forbidden\r
Connection: close\r
\r
`);
          return;
        }
      } catch {
        socket.end(`HTTP/1.1 403 Forbidden\r
Connection: close\r
\r
`);
        return;
      }
    }
    proxyWss.handleUpgrade(req, socket, head, (client) => {
      const upstream = new WebSocket2(`ws://127.0.0.1:${live.dataPort}${req.url ?? "/ws"}`, {
        headers: { host: req.headers.host ?? `127.0.0.1:${port}` },
        ...req.headers.origin ? { origin: req.headers.origin } : {}
      });
      client.on("message", (data, isBinary) => {
        if (upstream.readyState === WebSocket2.OPEN)
          upstream.send(data, { binary: isBinary });
      });
      upstream.on("message", (data, isBinary) => {
        if (client.readyState === WebSocket2.OPEN)
          client.send(data, { binary: isBinary });
      });
      client.once("close", () => upstream.close());
      upstream.once("close", () => client.close());
      client.once("error", () => upstream.terminate());
      upstream.once("error", () => client.terminate());
    });
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve2());
  });
  return {
    engine: "built-in server",
    stop: () => {
      for (const client of proxyWss.clients)
        client.terminate();
      proxyWss.close();
      server.close();
    },
    exited: new Promise((resolve2) => server.once("close", () => resolve2(0)))
  };
}
function deckConfigDefaults(configFile = CONFIG_FILE2) {
  try {
    const raw = JSON.parse(readFileSync10(configFile, "utf8"));
    const port = typeof raw.deck?.port === "number" && raw.deck.port > 0 && raw.deck.port <= 65535 ? raw.deck.port : null;
    return { port, pair: raw.deck?.pair !== false };
  } catch {
    return { port: null, pair: true };
  }
}
function parseDeckArgs(argv) {
  const defaults = deckConfigDefaults();
  let port = defaults.port;
  let portFromFlag = false;
  let host = `speak.${deviceSlug()}.local`;
  let qr = true;
  let rotateToken = false;
  let pair = defaults.pair;
  let caddy = true;
  let mdns = true;
  let tls = true;
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") {
      const value = argv[++i];
      if (!value || !/^\d+$/.test(value)) {
        console.error("\u274C --port requires a number, e.g. --port 43211");
        process.exit(1);
      }
      port = Number(value);
      portFromFlag = true;
      if (port <= 0 || port > 65535) {
        console.error(`\u274C Invalid port: ${port}`);
        process.exit(1);
      }
    } else if (arg === "--host") {
      const value = argv[++i];
      if (!value || value.startsWith("-") || !/^[a-z0-9.-]+$/.test(value)) {
        console.error("\u274C --host requires a name like speak.air.local (lowercase letters, digits, dots, dashes)");
        process.exit(1);
      }
      host = value.endsWith(".local") ? value : `${value}.local`;
    } else if (arg === "--no-qr") {
      qr = false;
    } else if (arg === "--no-caddy") {
      caddy = false;
    } else if (arg === "--no-mdns") {
      mdns = false;
    } else if (arg === "--no-tls") {
      tls = false;
    } else if (arg === "--rotate-token") {
      rotateToken = true;
    } else if (arg === "--pair") {
      pair = true;
    } else if (arg === "--no-pair") {
      pair = false;
    } else {
      console.error(`\u274C Unknown argument: ${arg}`);
      console.error("   Usage: speakeasy deck [--port <n>] [--host <name>] [--pair|--no-pair] [--no-qr] [--no-caddy] [--no-mdns] [--no-tls]");
      process.exit(1);
    }
  }
  return { port, portFromFlag, host, qr, caddy, mdns, tls, rotateToken, pair };
}
async function runDeck(argv) {
  const args = parseDeckArgs(argv);
  const root = deckRoot();
  if (root === INSTALLED_DECK_DIR && !installedSurfaceIsCurrent(root)) {
    try {
      await installDeckSurface(root);
      console.log(source_default.dim(`  Deck surface installed at ${root}`));
    } catch (error) {
      console.error(`\u274C Could not fetch the Deck surface: ${error.message}`);
      console.error("   Check your network, install the SpeakEasy Mac app (speakeasy --app), or run from a repo checkout.");
      process.exit(1);
    }
  }
  if (!existsSync17(path17.join(root, "index.html"))) {
    console.error("\u274C Deck assets not found at", root);
    console.error("   The Deck ships with the SpeakEasy Mac app (speakeasy --app), or run from a repo checkout.");
    process.exit(1);
  }
  const processLock = acquireDeckProcessLock();
  if (!processLock.acquired) {
    const owner = processLock.existingPid ? ` (pid ${processLock.existingPid})` : "";
    console.log(`SpeakEasy Deck is already running on this Mac${owner}.`);
    return;
  }
  process.once("exit", processLock.release);
  let port;
  if (args.port !== null && args.portFromFlag) {
    if (!await portAvailable(args.port)) {
      console.error(`\u274C Port ${args.port} is already in use.`);
      process.exit(1);
    }
    port = args.port;
  } else if (args.port !== null && await portAvailable(args.port)) {
    port = args.port;
  } else if (await portAvailable(80)) {
    port = 80;
  } else {
    port = -1;
    for (let candidate = DEFAULT_PORT;candidate < DEFAULT_PORT + 10; candidate++) {
      if (await portAvailable(candidate)) {
        port = candidate;
        break;
      }
    }
    if (port === -1) {
      console.error(`\u274C No free port (80 and ${DEFAULT_PORT}\u2013${DEFAULT_PORT + 9} are all in use) \u2014 pass --port <n>.`);
      process.exit(1);
    }
  }
  const { qr, host, mdns } = args;
  const caddy = args.caddy ? findCaddy() : null;
  if (args.tls && !caddy) {
    console.error("\u274C Secure Deck startup requires the bundled Caddy helper.");
    console.error("   Reinstall SpeakEasy, or use --no-tls --no-caddy for local development only.");
    process.exit(1);
  }
  if (args.tls && !await portAvailable(443, true)) {
    console.error("\u274C Secure Deck startup could not claim HTTPS port 443.");
    console.error("   Stop the service using port 443, then start the Deck again.");
    process.exit(1);
  }
  const tlsHost = args.tls ? host : null;
  const caCert = tlsHost ? caddyRootCert(true) ?? null : null;
  const token = args.pair ? deckToken(args.rotateToken) : null;
  let dataPort = null;
  for (let candidate = port + 1;candidate <= Math.min(port + 5, 65535); candidate++) {
    if (await portAvailable(candidate)) {
      dataPort = candidate;
      break;
    }
  }
  let handle;
  try {
    handle = caddy ? await startCaddy(caddy, root, port, tlsHost, caCert, dataPort ? { dataPort, token } : null) : await startNodeServer(root, port, dataPort ? { dataPort, token } : null);
  } catch (error) {
    if (!caddy) {
      console.error("\u274C Could not start the deck server:", error.message);
      process.exit(1);
    }
    if (args.tls) {
      console.error("\u274C Secure Deck startup failed:", error.message);
      console.error("   SpeakEasy did not fall back to insecure HTTP.");
      process.exit(1);
    }
    console.error(`  \u26A0\uFE0F  Caddy failed (${error.message}) \u2014 falling back to the built-in live server.`);
    try {
      handle = await startNodeServer(root, port, dataPort ? { dataPort, token } : null);
    } catch (fallbackError) {
      console.error("\u274C Built-in server also failed:", fallbackError.message);
      process.exit(1);
    }
  }
  let runtime = null;
  let dataPlane = null;
  if (dataPort) {
    runtime = new DeckRuntime;
    try {
      dataPlane = await startDataPlane(runtime, dataPort, token);
    } catch {
      dataPlane = null;
    }
  }
  const lan = lanAddress();
  const stopVanity = mdns && lan ? await advertiseVanity(host, port) : null;
  const stopEdge = stopVanity && port !== 80 ? await registerEdgeRoute(host, port) : null;
  const tlsUrl = stopVanity && tlsHost && handle.engine === "caddy" ? `https://${host}` : null;
  const macTrusted = tlsUrl && caCert && existsSync17(caCert) ? trustLocalCA(caCert) : false;
  const bonjour = macBonjourName();
  const padUrlBase = tlsUrl ?? (stopVanity ? stopEdge ? `http://${host}` : hostUrl(host, port) : bonjour ? hostUrl(bonjour, port) : `http://${lan ?? "your-macs-ip"}:${port}`);
  const padUrl = dataPlane && token ? `${padUrlBase}#k=${token}` : padUrlBase;
  if (dataPlane) {
    writeDiscovery({
      pid: process.pid,
      port,
      dataPort: dataPlane.dataPort,
      host,
      token,
      url: padUrl
    });
  }
  console.log("");
  console.log(source_default.bold("  \uD83C\uDF9B  SpeakEasy Deck"));
  console.log("");
  console.log(`  ${source_default.dim("On this Mac")}   ${hostUrl("localhost", port)}`);
  console.log(`  ${source_default.dim("On your iPad")}  ${source_default.green(source_default.bold(padUrl))}  ${source_default.dim("\u2190 same Wi-Fi, no IP needed")}`);
  if (stopVanity && bonjour) {
    console.log(`  ${source_default.dim("Fallback")}      ${hostUrl(bonjour, port)}${lan ? ` \xB7 ${hostUrl(lan, port)}` : ""}`);
  }
  console.log("");
  console.log(source_default.bold("  Set up in three steps"));
  console.log(`  ${source_default.cyan("1.")} iPad: open the URL above in Safari \u2014 or scan the code below`);
  console.log(`  ${source_default.cyan("2.")} Share \u2192 ${source_default.bold("Add to Home Screen")} for the full-screen deck`);
  console.log(`  ${source_default.cyan("3.")} Themes: ${source_default.dim("?theme=paper|ember|flight")} \xB7 Variants: ${source_default.dim("?variant=oxide")}`);
  console.log("");
  console.log(`  ${source_default.dim(`Served by ${handle.engine} \xB7 Is it running? curl ${hostUrl("localhost", port)}/healthz`)}`);
  if (tlsUrl) {
    console.log(`  ${source_default.dim("HTTPS is on (local CA, mic-ready).")}`);
    if (macTrusted) {
      console.log(`  ${source_default.green("\u2713")} ${source_default.dim("This Mac now trusts the CA \u2014 no action needed here.")}`);
    } else {
      console.log(`  ${source_default.dim("  This Mac: run `sudo caddy trust` once to trust the CA system-wide.")}`);
    }
    console.log(`  ${source_default.dim("  iPad, one time:")}`);
    console.log(`  ${source_default.dim(`  1. Open ${stopEdge ? `http://${host}` : hostUrl(host, port)}/ca.crt and install the profile`)}`);
    console.log(`  ${source_default.dim('  2. Settings \u2192 General \u2192 About \u2192 Certificate Trust Settings \u2192 enable "Caddy Local Authority"')}`);
  }
  if (dataPlane) {
    console.log(`  ${source_default.green("\u2713")} ${source_default.dim(`Live runtime connected \u2014 the deck drives real agents and synthesis. Press Ctrl+C to stop.`)}`);
  } else {
    console.log(`  ${source_default.dim("Live runtime unavailable \u2014 deck runs demo state only. Press Ctrl+C to stop.")}`);
  }
  console.log("");
  if (qr && (lan || bonjour)) {
    try {
      const { default: QRCode } = await Promise.resolve().then(() => __toESM(require_server(), 1));
      const art = await QRCode.toString(padUrl, { type: "terminal", small: true });
      console.log(art);
    } catch {
      console.log(source_default.dim("  (QR unavailable \u2014 type the URL manually)"));
    }
  }
  await new Promise((resolve2) => {
    let stopping = false;
    const onShutdown = () => {
      stopping = true;
      dataPlane?.stop();
      runtime?.destroy();
      clearDiscovery();
      stopEdge?.();
      stopVanity?.();
      handle.stop();
      cleanup();
      resolve2();
      setTimeout(resolve2, 500).unref();
    };
    const onExit = (code) => {
      cleanup();
      dataPlane?.stop();
      runtime?.destroy();
      clearDiscovery();
      stopEdge?.();
      stopVanity?.();
      if (stopping) {
        resolve2();
        return;
      }
      console.error("");
      console.error(`  \u26A0\uFE0F  ${handle.engine} exited unexpectedly (code ${code ?? "unknown"}) \u2014 deck is no longer being served.`);
      process.exitCode = 1;
      resolve2();
    };
    const cleanup = () => {
      process.removeListener("SIGINT", onShutdown);
      process.removeListener("SIGTERM", onShutdown);
    };
    process.on("SIGINT", onShutdown);
    process.on("SIGTERM", onShutdown);
    handle.exited.then(onExit);
  });
}
var __dirname = "/Users/arach/dev/SpeakEasy/.claude/worktrees/landing-polish/src/cli", TYPES, DEFAULT_PORT = 43211, DECK_LOCK_FILE, INSTALLED_DECK_DIR, DECK_VERSION_MARKER = ".speakeasy-version", EDGE_ROUTE_ID = "speakeasy-deck";
var init_deck = __esm(() => {
  init_source();
  init_deck_runtime();
  init_deck_live();
  init_constants();
  init_plugin();
  TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".m4a": "audio/mp4"
  };
  DECK_LOCK_FILE = path17.join(os4.homedir(), ".config", "speakeasy", "deck-runtime.lock");
  INSTALLED_DECK_DIR = path17.join(CONFIG_DIR3, "deck");
});

// src/bin/speakeasy-cli.ts
init_src();

// src/cli/ui.ts
init_constants();
init_source();
function showWelcome() {
  console.log(`
+=============================================================================+
|                                                                             |
| \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557   \u2588\u2588\u2557   |
| \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2588\u2588\u2557 \u2588\u2588\u2554\u255D   |
| \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u255A\u2588\u2588\u2588\u2588\u2554\u255D    |
| \u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u255D \u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551  \u255A\u2588\u2588\u2554\u255D     |
| \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551      |
| \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D     \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D   \u255A\u2550\u255D      |
|                                                                             |
+=============================================================================+

\uD83C\uDF89 Welcome to SpeakEasy!

We didn't find a configuration file. Let's create one to get you started!

\uD83D\uDCE6 What is SpeakEasy?
   A unified text-to-speech CLI that works with multiple providers.

   Supported Providers:
   \u2022 System Voices - macOS built-in (no key needed)
   \u2022 ElevenLabs - Premium voices (\uD83D\uDD11 key required)
   \u2022 OpenAI - High quality voices (\uD83D\uDD11 key required)
   \u2022 Groq - Fast & cheap (\uD83D\uDD11 key required)
   \u2022 Gemini - Google's AI voices (\uD83D\uDD11 key required)

\uD83D\uDE80 Quick Start:
   Try it now with built-in system voices:

   ${source_default.green('speakeasy "Hello! Welcome to SpeakEasy!" --provider system')}

\uD83D\uDD27 Setup API Keys (optional):

   ${source_default.bold("ElevenLabs")} - Premium voices
   ${source_default.cyan("speakeasy --set-key elevenlabs YOUR_API_KEY")}
   Get key: ${source_default.underline("https://elevenlabs.io/app/settings/api-keys")}

   ${source_default.bold("OpenAI")} - High quality voices
   ${source_default.cyan("speakeasy --set-key openai YOUR_API_KEY")}
   Get key: ${source_default.underline("https://platform.openai.com/api-keys")}

   ${source_default.bold("Groq")} - Fast & cheap
   ${source_default.cyan("speakeasy --set-key groq YOUR_API_KEY")}
   Get key: ${source_default.underline("https://console.groq.com/keys")}

   ${source_default.bold("Gemini")} - Google's AI voices
   ${source_default.cyan("speakeasy --set-key gemini YOUR_API_KEY")}
   Get key: ${source_default.underline("https://makersuite.google.com/app/apikey")}

\uD83D\uDCBE Configuration:
   Config file: ${source_default.gray(CONFIG_FILE2)}
   Create config: ${source_default.yellow("speakeasy --config --edit")}
   View settings: ${source_default.yellow("speakeasy --config")}

\uD83E\uDE7A Need Help?
   Diagnose setup: ${source_default.yellow("speakeasy --doctor")}
   Show all options: ${source_default.yellow("speakeasy --help")}

${source_default.dim("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")}

Built with \u2764\uFE0F by Arach \u2022 https://arach.dev
`);
}
function showHelp() {
  console.log(`
\uD83D\uDDE3\uFE0F  SpeakEasy CLI - Text-to-Speech Command Line Tool

Usage:
  speakeasy [text] [options]
  speakeasy --text "Hello world" --provider openai
  speakeasy --config
  speakeasy --cache --clear

Commands:
  deck                Serve the Deck control surface on the local network
                      (first run fetches the surface from the matching release)
  plugin [host]       Install the SpeakEasy skill into an agent host
                      (no host: list hosts and what's installed)

Options:
  --text, -t          Text to speak (can be positional argument)
  --provider, -p      Provider: system, openai, elevenlabs, groq, gemini
  --voice, -v         Voice to use (depends on provider)
  --rate, -r          Speech rate (words per minute)
  --volume            Volume (0.0 to 1.0, default: 0.7)
  --instructions      Voice instructions (OpenAI only): accent, tone, style
  --interrupt, -i     Interrupt current speech
  --cache, -c         Enable caching
  --clear-cache       Clear the cache
  --config            Show current configuration
  --config --edit     Edit configuration file in default editor
  --edit              Edit configuration file (implies --config)
  --set-key <p> <key> Save API key for provider (elevenlabs, openai, groq, gemini)
  --set-default <p>   Set default provider
  --help, -h          Show this help
  --debug, -d         Enable debug logging
  --diagnose          Show configuration diagnostics
  --doctor            Run health checks and provide fixes
  --welcome           Show welcome screen (for demo/testing)
  --list              List all cache entries
  --find "text"       Find cache entries by text
  --stats             Show cache statistics
  --recent N          Show N most recent cache entries
  --id KEY            Show detailed info for specific cache entry
  --play KEY          Play cached audio by ID
  --out FILE          Save audio to file (in addition to playing)
  --silent, -s        Generate audio without playing it
  --premium           Use best available system voice (Premium > Enhanced > Standard)
  --list-voices       List available macOS system voices
  --app               Open the SpeakEasy settings app (downloads on first use)
  --update-app        Update the settings app
  --version, -V       Show the CLI version

Examples:
  speakeasy "Hello world"
  speakeasy --text "Hello world" --provider openai --voice nova
  speakeasy --text "Hello world" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL
  speakeasy --text "Hello world" --volume 0.5
  speakeasy --cache --text "Hello cached world"
  speakeasy --clear-cache
  speakeasy --list                    # List all cache entries
  speakeasy --stats                   # Show cache statistics
  speakeasy --recent 20               # Show 20 most recent
  speakeasy --find "hello world"      # Find entries containing text
  speakeasy --id abc123-def456        # Show detailed entry info
  speakeasy --play abc123-def456      # Play cached audio by ID
  speakeasy "Hello world" --out audio.mp3  # Save to file

  # Quick setup for API keys:
  speakeasy --set-key elevenlabs YOUR_API_KEY
  speakeasy --set-key openai sk-xxxxxxxxxxxx
  speakeasy --set-default elevenlabs  # Use elevenlabs by default

  # Voice steering with instructions (OpenAI only, uses gpt-4o-audio-preview):
  speakeasy "Hello!" --provider openai --instructions "Speak with a British accent"
  speakeasy "Good morning" --provider openai --instructions "Speak slowly and calmly"
  speakeasy "Welcome!" --provider openai --instructions "Sound excited and energetic"
`);
}

// src/cli/config.ts
init_constants();
import * as fs6 from "fs";
import { spawn as spawn3 } from "child_process";
function writeConfig(config) {
  fs6.mkdirSync(CONFIG_DIR3, { recursive: true, mode: 448 });
  fs6.chmodSync(CONFIG_DIR3, 448);
  fs6.writeFileSync(CONFIG_FILE2, JSON.stringify(config, null, 2), { mode: 384 });
  fs6.chmodSync(CONFIG_FILE2, 384);
}
function redactConfigSecrets(value) {
  if (Array.isArray(value))
    return value.map(redactConfigSecrets);
  if (value === null || typeof value !== "object")
    return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    /(api.?key|token|secret|password)/i.test(key) && entry ? "[configured]" : redactConfigSecrets(entry)
  ]));
}
function loadGlobalConfig2() {
  try {
    if (fs6.existsSync(CONFIG_FILE2)) {
      const configData = fs6.readFileSync(CONFIG_FILE2, "utf8");
      return JSON.parse(configData);
    }
  } catch (error) {
    console.warn("Failed to load global config:", error);
  }
  return {};
}
function hasConfig() {
  return fs6.existsSync(CONFIG_FILE2);
}
function showConfig(edit = false) {
  try {
    console.log("\uD83D\uDCCA Configuration Location:");
    console.log(`   File: ${CONFIG_FILE2}`);
    console.log("");
    if (edit) {
      if (!fs6.existsSync(CONFIG_FILE2)) {
        console.log("\uD83D\uDCDD Creating new configuration file...");
        if (!fs6.existsSync(CONFIG_DIR3)) {
          fs6.mkdirSync(CONFIG_DIR3, { recursive: true });
        }
        const defaultConfig = {
          providers: {
            system: {
              enabled: true,
              voice: "Samantha"
            }
          },
          defaults: {
            provider: DEFAULTS.provider,
            rate: DEFAULTS.rate
          },
          global: {
            tempDir: "/tmp",
            cleanup: true
          }
        };
        writeConfig(defaultConfig);
        console.log("\u2705 Created default configuration file");
      }
      const editor = process.env.EDITOR || process.env.VISUAL || "nano";
      console.log(`\uD83D\uDD27 Opening config file with ${editor}...`);
      const child = spawn3(editor, [CONFIG_FILE2], {
        stdio: "inherit",
        detached: false
      });
      child.on("exit", (code) => {
        if (code === 0) {
          console.log("\u2705 Configuration file updated");
        } else {
          console.error(`\u274C Editor exited with code ${code}`);
        }
      });
      return;
    }
    if (fs6.existsSync(CONFIG_FILE2)) {
      const configData = fs6.readFileSync(CONFIG_FILE2, "utf8");
      const config = JSON.parse(configData);
      console.log("\uD83D\uDCCB Current Configuration:");
      console.log(JSON.stringify(redactConfigSecrets(config), null, 2));
    } else {
      console.log("\uD83D\uDCCA No configuration file found");
      console.log("");
      console.log("\uD83D\uDCA1 To create a config file:");
      console.log(`   mkdir -p ${CONFIG_DIR3}`);
      console.log(`   echo '{"providers":{"system":{"voice":"Samantha"}}}' > ${CONFIG_FILE2}`);
      console.log("");
      console.log("\uD83D\uDD27 Or use: speakeasy --config --edit");
    }
  } catch (error) {
    console.error("\u274C Error reading config:", error.message);
  }
}
function diagnoseConfig() {
  try {
    const globalConfig = loadGlobalConfig2();
    console.log("\uD83D\uDD0D Configuration Diagnostics");
    console.log("");
    if (fs6.existsSync(CONFIG_FILE2)) {
      console.log("\u2705 Config file found:", CONFIG_FILE2);
    } else {
      console.log("\u274C No config file found at:", CONFIG_FILE2);
    }
    console.log("");
    console.log("\uD83D\uDCCA Settings Summary:");
    console.log(`   Default Provider: ${globalConfig.defaults?.provider || DEFAULTS.provider}`);
    console.log(`   Default Rate: ${globalConfig.defaults?.rate || DEFAULTS.rate} WPM`);
    console.log(`   Default Volume: ${((globalConfig.defaults?.volume || DEFAULTS.volume) * 100).toFixed(0)}%`);
    console.log(`   Fallback Order: ${(globalConfig.defaults?.fallbackOrder || ["system"]).join(" \u2192 ")}`);
    console.log(`   Temp Dir: ${globalConfig.global?.tempDir || "/tmp"}`);
    console.log(`   Auto-cleanup: ${globalConfig.global?.cleanup !== false}`);
    console.log("");
    console.log("\uD83D\uDD11 API Key Status:");
    const providers = [
      { name: "OpenAI", configKey: "openai", envKey: "OPENAI_API_KEY" },
      { name: "ElevenLabs", configKey: "elevenlabs", envKey: "ELEVENLABS_API_KEY" },
      { name: "Groq", configKey: "groq", envKey: "GROQ_API_KEY" },
      { name: "Gemini", configKey: "gemini", envKey: "GEMINI_API_KEY" }
    ];
    providers.forEach(({ name, configKey, envKey }) => {
      const fromConfig = globalConfig.providers?.[configKey]?.apiKey;
      const fromEnv = process.env[envKey];
      if (fromConfig && fromConfig.length > 10) {
        console.log(`   \u2705 ${name}: Available from config file`);
      } else if (fromEnv && fromEnv.length > 10) {
        console.log(`   \u2705 ${name}: Available from environment`);
      } else {
        console.log(`   \u274C ${name}: Not configured`);
        if (globalConfig.providers?.[configKey]?.enabled) {
          console.log(`      \u2192 Expected in config.providers.${configKey}.apiKey`);
        }
        console.log(`      \u2192 Or set: export ${envKey}=your_key_here`);
      }
    });
    console.log("");
    console.log("\uD83C\uDF99\uFE0F  Voice Settings:");
    console.log(`   System: ${globalConfig.providers?.system?.voice || "Samantha"}`);
    console.log(`   OpenAI: ${globalConfig.providers?.openai?.voice || "nova"}`);
    console.log(`   ElevenLabs: ${globalConfig.providers?.elevenlabs?.voiceId || "EXAVITQu4vr4xnSDxMaL"}`);
    console.log(`   Groq: ${globalConfig.providers?.groq?.voice || "nova"}`);
    console.log(`   Gemini: ${globalConfig.providers?.gemini?.model || "gemini-2.5-flash-preview-tts"}`);
    console.log("");
    console.log("\uD83D\uDCA1 Usage Tips:");
    console.log("   \u2022 Use --debug to see runtime details");
    console.log("   \u2022 Use --provider system for built-in voices (no API keys needed)");
    console.log("   \u2022 Edit ~/.config/speakeasy/settings.json to configure defaults");
  } catch (error) {
    console.error("\u274C Error reading config:", error.message);
  }
}
function setApiKey(provider, apiKey) {
  const validProviders = PROVIDERS.map((p) => p.key);
  if (!validProviders.includes(provider)) {
    console.error(`\u274C Invalid provider: ${provider}`);
    console.error("");
    console.error("Valid providers:");
    PROVIDERS.forEach((p) => {
      console.error(`   \u2022 ${p.key} (${p.name})`);
    });
    process.exit(1);
  }
  if (!apiKey || apiKey.trim().length === 0) {
    console.error("\u274C API key cannot be empty");
    process.exit(1);
  }
  try {
    if (!fs6.existsSync(CONFIG_DIR3)) {
      fs6.mkdirSync(CONFIG_DIR3, { recursive: true });
    }
    let config = {};
    if (fs6.existsSync(CONFIG_FILE2)) {
      const configData = fs6.readFileSync(CONFIG_FILE2, "utf8");
      config = JSON.parse(configData);
    }
    if (!config.providers) {
      config.providers = {};
    }
    if (!config.providers[provider]) {
      config.providers[provider] = {};
    }
    config.providers[provider].apiKey = apiKey.trim();
    config.providers[provider].enabled = true;
    writeConfig(config);
    const providerInfo = PROVIDERS.find((p) => p.key === provider);
    console.log(`\u2705 ${providerInfo?.name || provider} API key saved to config`);
    console.log("");
    console.log("\uD83C\uDF89 You can now use:");
    console.log(`   speakeasy "Hello world" --provider ${provider}`);
    console.log("");
    console.log(`\uD83D\uDCA1 To set as default provider:`);
    console.log(`   speakeasy --set-default ${provider}`);
  } catch (error) {
    console.error("\u274C Error saving API key:", error.message);
    process.exit(1);
  }
}
function setDefaultProvider(provider) {
  const validProviders = ["system", ...PROVIDERS.map((p) => p.key)];
  if (!validProviders.includes(provider)) {
    console.error(`\u274C Invalid provider: ${provider}`);
    console.error("");
    console.error("Valid providers:");
    console.error("   \u2022 system (macOS built-in)");
    PROVIDERS.forEach((p) => {
      console.error(`   \u2022 ${p.key} (${p.name})`);
    });
    process.exit(1);
  }
  try {
    if (!fs6.existsSync(CONFIG_DIR3)) {
      fs6.mkdirSync(CONFIG_DIR3, { recursive: true });
    }
    let config = {};
    if (fs6.existsSync(CONFIG_FILE2)) {
      const configData = fs6.readFileSync(CONFIG_FILE2, "utf8");
      config = JSON.parse(configData);
    }
    if (!config.defaults) {
      config.defaults = {};
    }
    config.defaults.provider = provider;
    writeConfig(config);
    console.log(`\u2705 Default provider set to: ${provider}`);
    console.log("");
    console.log("\uD83C\uDF89 Now you can simply run:");
    console.log(`   speakeasy "Hello world"`);
  } catch (error) {
    console.error("\u274C Error saving default provider:", error.message);
    process.exit(1);
  }
}

// src/cli/doctor.ts
init_constants();
import * as fs7 from "fs";
import * as path7 from "path";
import { execSync as execSync3 } from "child_process";
function runDoctor() {
  const version = getPackageVersion();
  console.log(`\uD83C\uDFE5 Speakeasy v${version} - Health Check`);
  console.log("");
  let issues = 0;
  let warnings = 0;
  console.log("\uD83D\uDD0D System Compatibility:");
  if (process.platform === "darwin") {
    console.log("   \u2705 macOS detected - system voice support available");
    try {
      execSync3("which say", { stdio: "pipe" });
      console.log("   \u2705 `say` command available");
    } catch {
      console.log("   \u274C `say` command not found");
      issues++;
    }
    try {
      execSync3("which afplay", { stdio: "pipe" });
      console.log("   \u2705 `afplay` command available");
    } catch {
      console.log("   \u274C `afplay` command not found");
      issues++;
    }
  } else {
    console.log("   \u26A0\uFE0F  Non-macOS system - system voice limited");
    warnings++;
  }
  console.log("");
  console.log("\uD83D\uDD27 Configuration Health:");
  const globalConfig = loadGlobalConfig2();
  if (fs7.existsSync(CONFIG_FILE2)) {
    console.log("   \u2705 Config file exists");
    try {
      const configData = fs7.readFileSync(CONFIG_FILE2, "utf8");
      JSON.parse(configData);
      console.log("   \u2705 Config file is valid JSON");
    } catch (error) {
      console.log(`   \u274C Config file has JSON errors: ${error.message}`);
      issues++;
    }
  } else {
    console.log("   \u274C No config file found");
    console.log("   \uD83D\uDCA1 Create: ~/.config/speakeasy/settings.json");
    issues++;
  }
  try {
    fs7.accessSync(CONFIG_DIR3, fs7.constants.R_OK | fs7.constants.W_OK);
    console.log("   \u2705 Config directory permissions OK");
  } catch {
    console.log("   \u274C Cannot read/write config directory");
    issues++;
  }
  console.log("");
  console.log("\uD83D\uDD11 API Key Configuration:");
  const providers = PROVIDERS;
  let configuredProviders = 0;
  const apiKeyUrls = {
    openai: "https://platform.openai.com/api-keys",
    elevenlabs: "https://elevenlabs.io/app/settings/api-keys",
    groq: "https://console.groq.com/keys",
    gemini: "https://makersuite.google.com/app/apikey"
  };
  providers.forEach(({ name, key, env: env2 }) => {
    const fromConfig = globalConfig.providers?.[key]?.apiKey;
    const fromEnv = process.env[env2];
    if (fromConfig && fromConfig.length > 10) {
      console.log(`   \u2705 ${name}: Configured in file`);
      configuredProviders++;
    } else if (fromEnv && fromEnv.length > 10) {
      console.log(`   \u2705 ${name}: Configured via environment`);
      configuredProviders++;
    } else {
      console.log(`   \u274C ${name}: Not configured`);
      console.log(`      Get key: ${apiKeyUrls[key]}`);
      console.log(`      Then run: speakeasy --set-key ${key} YOUR_API_KEY`);
    }
  });
  if (configuredProviders === 0 && process.platform !== "darwin") {
    console.log("   \u26A0\uFE0F  No API providers configured - limited to system voice");
    warnings++;
  }
  console.log("");
  console.log("\uD83C\uDF99\uFE0F  Voice Configuration:");
  const voices = [
    { provider: "system", voice: globalConfig.providers?.system?.voice, default: DEFAULT_VOICES.system },
    { provider: "openai", voice: globalConfig.providers?.openai?.voice, default: DEFAULT_VOICES.openai },
    { provider: "elevenlabs", voice: globalConfig.providers?.elevenlabs?.voiceId, default: DEFAULT_VOICES.elevenlabs },
    { provider: "groq", voice: globalConfig.providers?.groq?.voice, default: DEFAULT_VOICES.groq },
    { provider: "gemini", voice: globalConfig.providers?.gemini?.model, default: DEFAULT_VOICES.gemini }
  ];
  voices.forEach(({ provider, voice, default: defaultVoice }) => {
    const current = voice || defaultVoice;
    console.log(`   ${provider}: ${current}`);
  });
  console.log("");
  console.log("\uD83D\uDCE6 Cache Configuration:");
  const cacheEnabled = globalConfig.cache?.enabled;
  const cacheDir = globalConfig.cache?.dir || path7.join("/tmp", "speakeasy-cache");
  if (cacheEnabled) {
    console.log("   \u2705 Cache enabled");
    console.log(`   \uD83D\uDCC1 Cache dir: ${cacheDir}`);
    try {
      if (fs7.existsSync(cacheDir)) {
        fs7.accessSync(cacheDir, fs7.constants.R_OK | fs7.constants.W_OK);
        console.log("   \u2705 Cache directory accessible");
      } else {
        console.log("   \u26A0\uFE0F  Cache directory will be created on first use");
      }
    } catch {
      console.log("   \u274C Cannot access cache directory");
      issues++;
    }
  } else {
    console.log("   \u2139\uFE0F  Cache disabled (will be enabled with API keys)");
  }
  console.log("");
  console.log("\uD83D\uDCCB Health Summary:");
  if (issues === 0 && warnings === 0) {
    console.log("   \uD83C\uDF89 All checks passed! Speakeasy is healthy.");
  } else {
    console.log(`   ${issues > 0 ? "\u274C" : "\u26A0\uFE0F"} ${issues} issues, ${warnings} warnings found`);
    if (issues > 0) {
      console.log("");
      console.log("\uD83D\uDD27 Quick Fixes:");
      if (process.platform !== "darwin") {
        console.log("   \u2022 On non-macOS, ensure API keys are configured");
      }
      if (!fs7.existsSync(CONFIG_FILE2)) {
        console.log("   \u2022 Create config: mkdir -p ~/.config/speakeasy");
        console.log(`   \u2022 Add: echo '{"providers":{"system":{"voice":"Samantha"}}}' > ~/.config/speakeasy/settings.json`);
      }
      if (configuredProviders === 0 && process.platform !== "darwin") {
        console.log("   \u2022 Configure at least one API provider");
      }
    }
  }
  console.log("");
  console.log("\uD83D\uDCA1 Next Steps:");
  console.log('   \u2022 Run: speakeasy "Hello world" to test');
  console.log("   \u2022 Run: speakeasy --config to view raw config");
  console.log("   \u2022 Run: speakeasy --diagnose for detailed diagnostics");
}

// src/cli/cache.ts
init_src();
init_cache();
import * as fs8 from "fs";
import * as path8 from "path";
import { execSync as execSync4 } from "child_process";
async function clearCache() {
  try {
    const speaker = new SpeakEasy({});
    const stats = await speaker.getCacheStats();
    if (stats.dir) {
      const cache = new TTSCache(stats.dir, "7d");
      await cache.clear();
      console.log("\uD83D\uDDD1\uFE0F  Cache cleared successfully");
    } else {
      console.log("\u274C Cache not enabled or directory not found");
    }
  } catch (error) {
    console.error("\u274C Error clearing cache:", error.message);
  }
}
async function playCachedAudio(cacheKey) {
  try {
    const speaker = new SpeakEasy({});
    const cacheStats = await speaker.getCacheStats();
    if (!cacheStats.dir) {
      console.log("\u274C Cache not enabled or directory not found");
      return;
    }
    const cache = new TTSCache(cacheStats.dir, "7d");
    const allMetadata = await cache.getCacheMetadata();
    const entry = allMetadata.find((m) => m.cacheKey === cacheKey);
    if (!entry) {
      console.log(`\u274C Cache entry not found: ${cacheKey}`);
      return;
    }
    if (!fs8.existsSync(entry.filePath)) {
      console.log(`\u274C Audio file not found: ${entry.filePath}`);
      return;
    }
    console.log(`\uD83C\uDFB5 Playing cached audio: "${entry.originalText.substring(0, 50)}${entry.originalText.length > 50 ? "..." : ""}"`);
    console.log(`   Provider: ${entry.provider}, Voice: ${entry.voice}`);
    execSync4(`afplay "${entry.filePath}"`, { stdio: "inherit" });
  } catch (error) {
    console.error("\u274C Error playing cached audio:", error.message);
  }
}
async function listCacheEntries(options = {}) {
  try {
    const speaker = new SpeakEasy({});
    const cacheStats = await speaker.getCacheStats();
    if (!cacheStats.dir) {
      console.log("\u274C Cache not enabled or directory not found");
      return;
    }
    const cache = new TTSCache(cacheStats.dir, "7d");
    if (options.id) {
      const allMetadata = await cache.getCacheMetadata();
      const entry = allMetadata.find((m) => m.cacheKey === options.id);
      if (entry) {
        console.log("\uD83D\uDD0D Cache Entry Details");
        console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        console.log(`ID: ${entry.cacheKey}`);
        console.log(`Text: "${entry.originalText}"`);
        console.log(`Provider: ${entry.provider}`);
        console.log(`Model: ${entry.model || "unknown"}`);
        console.log(`Voice: ${entry.voice}`);
        console.log(`Rate: ${entry.rate} WPM`);
        console.log(`Size: ${(entry.fileSize / 1024).toFixed(1)} KB`);
        console.log(`Created: ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`File: ${entry.filePath}`);
        console.log(`Source: ${entry.source || "unknown"}`);
        console.log(`Session: ${entry.sessionId || "unknown"}`);
        console.log(`Directory: ${entry.workingDirectory || "unknown"}`);
        console.log(`User: ${entry.user || "unknown"}`);
        console.log(`Duration: ${entry.durationMs ? `${entry.durationMs}ms` : "unknown"}`);
        console.log(`Success: ${entry.success ? "\u2705" : "\u274C"}`);
        if (entry.errorMessage) {
          console.log(`Error: ${entry.errorMessage}`);
        }
      } else {
        console.log(`\u274C Cache entry not found: ${options.id}`);
      }
      return;
    }
    if (options.stats) {
      const stats = await cache.getStats();
      console.log("\uD83D\uDCCA Cache Statistics");
      console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
      console.log(`Total Entries: ${stats.totalEntries}`);
      console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Cache Hits: ${stats.cacheHits}`);
      console.log(`Cache Misses: ${stats.cacheMisses}`);
      console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`Avg File Size: ${(stats.avgFileSize / 1024).toFixed(1)} KB`);
      if (stats.dateRange) {
        console.log(`Date Range: ${stats.dateRange.earliest.toLocaleDateString()} - ${stats.dateRange.latest.toLocaleDateString()}`);
      }
      console.log(`
\uD83D\uDCC8 By Provider:`);
      Object.entries(stats.providers).forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });
      console.log(`
\uD83D\uDCC8 By Model:`);
      Object.entries(stats.models).forEach(([model, count]) => {
        console.log(`  ${model}: ${count}`);
      });
      console.log(`
\uD83D\uDCC8 By Source:`);
      Object.entries(stats.sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
      return;
    }
    let entries;
    if (options.recent) {
      entries = await cache.getRecent(options.recent);
    } else if (options.find) {
      entries = await cache.findByText(options.find);
    } else {
      entries = await cache.getCacheMetadata();
    }
    if (entries.length === 0) {
      console.log("\uD83D\uDCED No cache entries found");
      return;
    }
    console.log(`\uD83D\uDCCB Cache Entries (${entries.length})`);
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    entries.forEach((entry, index) => {
      console.log(`
${index + 1}. ${entry.cacheKey}`);
      console.log(`   Text: "${entry.originalText.substring(0, 50)}${entry.originalText.length > 50 ? "..." : ""}"`);
      console.log(`   Provider: ${entry.provider}`);
      console.log(`   Voice: ${entry.voice}`);
      console.log(`   Rate: ${entry.rate} WPM`);
      console.log(`   Size: ${(entry.fileSize / 1024).toFixed(1)} KB`);
      console.log(`   Created: ${new Date(entry.timestamp).toLocaleString()}`);
      console.log(`   File: ${path8.basename(entry.filePath)}`);
      if (entry.model)
        console.log(`   Model: ${entry.model}`);
    });
    console.log(`
\uD83D\uDCA1 Use --id KEY to see full details, --play KEY to play audio`);
  } catch (error) {
    console.error("\u274C Error accessing cache:", error.message);
  }
}

// src/app-manager.ts
import * as fs9 from "fs";
import { mkdtempSync } from "fs";
import * as path9 from "path";
import * as os2 from "os";
import { randomUUID as randomUUID2 } from "crypto";
import { execFileSync, spawn as spawn4, spawnSync } from "child_process";
import https from "https";
var APP_DIR = path9.join(os2.homedir(), ".speakeasy");
var APP_PATH = path9.join(APP_DIR, "SpeakEasy.app");
var VERSION_FILE = path9.join(APP_DIR, ".app-version");
var GITHUB_REPO = "arach/SpeakEasy";
var RELEASE_APP_ASSET_NAMES = ["SpeakEasy.dmg"];
var EXPECTED_DEVELOPER_TEAM_ID = "2U83JFPW66";
function isAppInstalled() {
  return fs9.existsSync(APP_PATH) && fs9.existsSync(path9.join(APP_PATH, "Contents", "MacOS", "SpeakEasy"));
}
function getInstalledVersion() {
  if (fs9.existsSync(VERSION_FILE)) {
    return fs9.readFileSync(VERSION_FILE, "utf8").trim();
  }
  return readBundleShortVersion();
}
function readBundleShortVersion() {
  const plist = path9.join(APP_PATH, "Contents", "Info.plist");
  if (!fs9.existsSync(plist))
    return null;
  try {
    const version = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", plist], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return version || null;
  } catch {
    return null;
  }
}
function reportAppLocation(onProgress, headline) {
  if (!onProgress)
    return;
  if (headline)
    onProgress(headline);
  const version = getInstalledVersion() ?? "unknown";
  onProgress(`   Version: ${version}`);
  onProgress(`   Path:    ${APP_PATH}`);
}
function ensureAppDir() {
  if (!fs9.existsSync(APP_DIR)) {
    fs9.mkdirSync(APP_DIR, { recursive: true });
  }
}
async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "speakeasy-cli" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          fetchJson(location).then(resolve).catch(reject);
          return;
        }
      }
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse JSON: ${data.substring(0, 200)}`));
        }
      });
    }).on("error", reject);
  });
}
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs9.createWriteStream(destPath);
    const request = (downloadUrl) => {
      https.get(downloadUrl, { headers: { "User-Agent": "speakeasy-cli" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            request(location);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      }).on("error", (err) => {
        fs9.unlink(destPath, () => {});
        reject(err);
      });
    };
    request(url);
  });
}
function findAppAsset(assets) {
  return assets.find((asset) => RELEASE_APP_ASSET_NAMES.includes(asset.name) || asset.name.endsWith(".dmg") && asset.name.startsWith("SpeakEasy"));
}
function verifyAppBundle(bundlePath) {
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", bundlePath], {
    stdio: "pipe"
  });
  const details = spawnSync("/usr/bin/codesign", ["--display", "--verbose=4", bundlePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (details.status !== 0) {
    throw new Error("Could not inspect the SpeakEasy app signature");
  }
  const signatureOutput = `${details.stdout}
${details.stderr}`;
  const teamIdentifier = signatureOutput.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim();
  if (teamIdentifier !== EXPECTED_DEVELOPER_TEAM_ID) {
    throw new Error(`SpeakEasy app signature has unexpected TeamIdentifier ${teamIdentifier ?? "missing"}`);
  }
}
function verifyDiskImage(dmgPath) {
  execFileSync("/usr/bin/codesign", ["--verify", "--verbose=2", dmgPath], { stdio: "pipe" });
  execFileSync("/usr/sbin/spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=4", dmgPath], { stdio: "pipe" });
}
function replaceInstalledBundle(sourceBundle) {
  const stagingPath = path9.join(APP_DIR, `.SpeakEasy.app.installing-${randomUUID2()}`);
  const backupPath = path9.join(APP_DIR, `.SpeakEasy.app.backup-${randomUUID2()}`);
  let movedExistingBundle = false;
  let installedReplacement = false;
  try {
    execFileSync("/usr/bin/ditto", [sourceBundle, stagingPath], { stdio: "pipe" });
    verifyAppBundle(stagingPath);
    if (fs9.existsSync(APP_PATH)) {
      fs9.renameSync(APP_PATH, backupPath);
      movedExistingBundle = true;
    }
    fs9.renameSync(stagingPath, APP_PATH);
    installedReplacement = true;
    if (movedExistingBundle) {
      fs9.rmSync(backupPath, { recursive: true, force: true });
    }
  } catch (error) {
    if (installedReplacement && fs9.existsSync(APP_PATH)) {
      fs9.rmSync(APP_PATH, { recursive: true, force: true });
    }
    if (movedExistingBundle && fs9.existsSync(backupPath)) {
      fs9.renameSync(backupPath, APP_PATH);
    }
    throw error;
  } finally {
    fs9.rmSync(stagingPath, { recursive: true, force: true });
    if (!movedExistingBundle) {
      fs9.rmSync(backupPath, { recursive: true, force: true });
    }
  }
}
function installBundleFromDmg(dmgPath) {
  const mountPoint = mkdtempSync(path9.join(os2.tmpdir(), "speakeasy-mount-"));
  try {
    verifyDiskImage(dmgPath);
    execFileSync("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-mountpoint", mountPoint, dmgPath], { stdio: "pipe" });
    const mountedBundle = path9.join(mountPoint, "SpeakEasy.app");
    if (!fs9.existsSync(mountedBundle)) {
      throw new Error("SpeakEasy.app not found in mounted disk image");
    }
    verifyAppBundle(mountedBundle);
    replaceInstalledBundle(mountedBundle);
  } finally {
    try {
      execFileSync("/usr/bin/hdiutil", ["detach", mountPoint, "-quiet"], { stdio: "pipe" });
    } catch {}
    fs9.rmSync(mountPoint, { recursive: true, force: true });
  }
}
async function getLatestRelease() {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    return await fetchJson(url);
  } catch {
    return null;
  }
}
async function downloadAndInstallApp(onProgress) {
  if (process.platform !== "darwin") {
    onProgress?.("\u26A0\uFE0F  Settings app is only available on macOS");
    return false;
  }
  ensureAppDir();
  onProgress?.("\uD83D\uDD0D Checking for latest release...");
  const release = await getLatestRelease();
  if (!release) {
    onProgress?.("\u274C Could not fetch release info from GitHub");
    return false;
  }
  const dmgAsset = findAppAsset(release.assets);
  if (!dmgAsset) {
    onProgress?.("\u274C No signed macOS disk image found in latest release");
    onProgress?.("   Available assets: " + release.assets.map((asset) => asset.name).join(", "));
    return false;
  }
  onProgress?.(`\uD83D\uDCE5 Downloading ${dmgAsset.name}...`);
  try {
    const tempDir = mkdtempSync(path9.join(os2.tmpdir(), "speakeasy-download-"));
    const dmgPath = path9.join(tempDir, dmgAsset.name);
    try {
      await downloadFile(dmgAsset.browser_download_url, dmgPath);
      onProgress?.("\uD83D\uDD10 Verifying signed and notarized disk image...");
      installBundleFromDmg(dmgPath);
    } finally {
      fs9.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    onProgress?.(`\u274C Install failed: ${error.message}`);
    return false;
  }
  fs9.writeFileSync(VERSION_FILE, release.tag_name);
  reportAppLocation(onProgress, `\u2705 Installed SpeakEasy.app (${release.tag_name})`);
  return true;
}
async function ensureAppInstalled(onProgress) {
  if (isAppInstalled()) {
    return true;
  }
  onProgress?.("\uD83D\uDE80 First run: Installing SpeakEasy settings app...");
  return await downloadAndInstallApp(onProgress);
}
function launchApp(onProgress) {
  if (!isAppInstalled()) {
    console.error("\u274C SpeakEasy.app is not installed");
    console.error("   Run: speakeasy --app to install and launch");
    return false;
  }
  try {
    spawn4("open", [APP_PATH], { detached: true, stdio: "ignore" }).unref();
    reportAppLocation(onProgress, "\uD83D\uDE80 Opened SpeakEasy settings app");
    return true;
  } catch (error) {
    console.error("\u274C Failed to launch app:", error.message);
    return false;
  }
}
async function updateApp(onProgress) {
  const installedVersion = getInstalledVersion();
  const release = await getLatestRelease();
  if (!release) {
    onProgress?.("\u274C Could not check for updates");
    return false;
  }
  if (installedVersion === release.tag_name) {
    reportAppLocation(onProgress, `\u2705 Already up to date (${installedVersion})`);
    return true;
  }
  onProgress?.(`\uD83D\uDCE6 Updating from ${installedVersion || "unknown"} to ${release.tag_name}...`);
  return await downloadAndInstallApp(onProgress);
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/error.js
class CommanderError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.code = code;
    this.exitCode = exitCode;
    this.nestedError = undefined;
  }
}

class InvalidArgumentError extends CommanderError {
  constructor(message) {
    super(1, "commander.invalidArgument", message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/argument.js
class Argument {
  constructor(name, description) {
    this.description = description || "";
    this.variadic = false;
    this.parseArg = undefined;
    this.defaultValue = undefined;
    this.defaultValueDescription = undefined;
    this.argChoices = undefined;
    switch (name[0]) {
      case "<":
        this.required = true;
        this._name = name.slice(1, -1);
        break;
      case "[":
        this.required = false;
        this._name = name.slice(1, -1);
        break;
      default:
        this.required = true;
        this._name = name;
        break;
    }
    if (this._name.endsWith("...")) {
      this.variadic = true;
      this._name = this._name.slice(0, -3);
    }
  }
  name() {
    return this._name;
  }
  _collectValue(value, previous) {
    if (previous === this.defaultValue || !Array.isArray(previous)) {
      return [value];
    }
    previous.push(value);
    return previous;
  }
  default(value, description) {
    this.defaultValue = value;
    this.defaultValueDescription = description;
    return this;
  }
  argParser(fn) {
    this.parseArg = fn;
    return this;
  }
  choices(values) {
    this.argChoices = values.slice();
    this.parseArg = (arg, previous) => {
      if (!this.argChoices.includes(arg)) {
        throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
      }
      if (this.variadic) {
        return this._collectValue(arg, previous);
      }
      return arg;
    };
    return this;
  }
  argRequired() {
    this.required = true;
    return this;
  }
  argOptional() {
    this.required = false;
    return this;
  }
}
function humanReadableArgName(arg) {
  const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
  return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/command.js
import { EventEmitter } from "events";
import childProcess from "child_process";
import path10 from "path";
import fs10 from "fs";
import process3 from "process";
import { stripVTControlCharacters as stripVTControlCharacters2 } from "util";

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/help.js
import { stripVTControlCharacters } from "util";

class Help {
  constructor() {
    this.helpWidth = undefined;
    this.minWidthToWrap = 40;
    this.sortSubcommands = false;
    this.sortOptions = false;
    this.showGlobalOptions = false;
  }
  prepareContext(contextOptions) {
    this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
  }
  visibleCommands(cmd) {
    const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
    const helpCommand = cmd._getHelpCommand();
    if (helpCommand && !helpCommand._hidden) {
      visibleCommands.push(helpCommand);
    }
    if (this.sortSubcommands) {
      visibleCommands.sort((a, b) => {
        return a.name().localeCompare(b.name());
      });
    }
    return visibleCommands;
  }
  compareOptions(a, b) {
    const getSortKey = (option) => {
      return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
    };
    return getSortKey(a).localeCompare(getSortKey(b));
  }
  visibleOptions(cmd) {
    const visibleOptions = cmd.options.filter((option) => !option.hidden);
    const helpOption = cmd._getHelpOption();
    if (helpOption && !helpOption.hidden) {
      const removeShort = helpOption.short && cmd._findOption(helpOption.short);
      const removeLong = helpOption.long && cmd._findOption(helpOption.long);
      if (!removeShort && !removeLong) {
        visibleOptions.push(helpOption);
      } else if (helpOption.long && !removeLong) {
        visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
      } else if (helpOption.short && !removeShort) {
        visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
      }
    }
    if (this.sortOptions) {
      visibleOptions.sort(this.compareOptions);
    }
    return visibleOptions;
  }
  visibleGlobalOptions(cmd) {
    if (!this.showGlobalOptions)
      return [];
    const globalOptions = [];
    for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
      const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
      globalOptions.push(...visibleOptions);
    }
    if (this.sortOptions) {
      globalOptions.sort(this.compareOptions);
    }
    return globalOptions;
  }
  visibleArguments(cmd) {
    if (cmd._argsDescription) {
      cmd.registeredArguments.forEach((argument) => {
        argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
      });
    }
    if (cmd.registeredArguments.find((argument) => argument.description)) {
      return cmd.registeredArguments;
    }
    return [];
  }
  subcommandTerm(cmd) {
    const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
    return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
  }
  optionTerm(option) {
    return option.flags;
  }
  argumentTerm(argument) {
    return argument.name();
  }
  longestSubcommandTermLength(cmd, helper) {
    return helper.visibleCommands(cmd).reduce((max, command) => {
      return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
    }, 0);
  }
  longestOptionTermLength(cmd, helper) {
    return helper.visibleOptions(cmd).reduce((max, option) => {
      return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
    }, 0);
  }
  longestGlobalOptionTermLength(cmd, helper) {
    return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
      return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
    }, 0);
  }
  longestArgumentTermLength(cmd, helper) {
    return helper.visibleArguments(cmd).reduce((max, argument) => {
      return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
    }, 0);
  }
  commandUsage(cmd) {
    let cmdName = cmd._name;
    if (cmd._aliases[0]) {
      cmdName = cmdName + "|" + cmd._aliases[0];
    }
    let ancestorCmdNames = "";
    for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
      ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
    }
    return ancestorCmdNames + cmdName + " " + cmd.usage();
  }
  commandDescription(cmd) {
    return cmd.description();
  }
  subcommandDescription(cmd) {
    return cmd.summary() || cmd.description();
  }
  optionDescription(option) {
    const extraInfo = [];
    if (option.argChoices) {
      extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
    }
    if (option.defaultValue !== undefined) {
      const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
      if (showDefault) {
        extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
      }
    }
    if (option.presetArg !== undefined && option.optional) {
      extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
    }
    if (option.envVar !== undefined) {
      extraInfo.push(`env: ${option.envVar}`);
    }
    if (extraInfo.length > 0) {
      const extraDescription = `(${extraInfo.join(", ")})`;
      if (option.description) {
        return `${option.description} ${extraDescription}`;
      }
      return extraDescription;
    }
    return option.description;
  }
  argumentDescription(argument) {
    const extraInfo = [];
    if (argument.argChoices) {
      extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
    }
    if (argument.defaultValue !== undefined) {
      extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
    }
    if (extraInfo.length > 0) {
      const extraDescription = `(${extraInfo.join(", ")})`;
      if (argument.description) {
        return `${argument.description} ${extraDescription}`;
      }
      return extraDescription;
    }
    return argument.description;
  }
  formatItemList(heading, items, helper) {
    if (items.length === 0)
      return [];
    return [helper.styleTitle(heading), ...items, ""];
  }
  groupItems(unsortedItems, visibleItems, getGroup) {
    const result = new Map;
    unsortedItems.forEach((item) => {
      const group = getGroup(item);
      if (!result.has(group))
        result.set(group, []);
    });
    visibleItems.forEach((item) => {
      const group = getGroup(item);
      if (!result.has(group)) {
        result.set(group, []);
      }
      result.get(group).push(item);
    });
    return result;
  }
  formatHelp(cmd, helper) {
    const termWidth = helper.padWidth(cmd, helper);
    const helpWidth = helper.helpWidth ?? 80;
    function callFormatItem(term, description) {
      return helper.formatItem(term, termWidth, description, helper);
    }
    let output = [
      `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
      ""
    ];
    const commandDescription = helper.commandDescription(cmd);
    if (commandDescription.length > 0) {
      output = output.concat([
        helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
        ""
      ]);
    }
    const argumentList = helper.visibleArguments(cmd).map((argument) => {
      return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
    });
    output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
    const optionGroups = this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:");
    optionGroups.forEach((options, group) => {
      const optionList = options.map((option) => {
        return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
      });
      output = output.concat(this.formatItemList(group, optionList, helper));
    });
    if (helper.showGlobalOptions) {
      const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
        return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
      });
      output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
    }
    const commandGroups = this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:");
    commandGroups.forEach((commands, group) => {
      const commandList = commands.map((sub) => {
        return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
      });
      output = output.concat(this.formatItemList(group, commandList, helper));
    });
    return output.join(`
`);
  }
  displayWidth(str) {
    return stripVTControlCharacters(str).length;
  }
  styleTitle(str) {
    return str;
  }
  styleUsage(str) {
    return str.split(" ").map((word) => {
      if (word === "[options]")
        return this.styleOptionText(word);
      if (word === "[command]")
        return this.styleSubcommandText(word);
      if (word[0] === "[" || word[0] === "<")
        return this.styleArgumentText(word);
      return this.styleCommandText(word);
    }).join(" ");
  }
  styleCommandDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleOptionDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleSubcommandDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleArgumentDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleDescriptionText(str) {
    return str;
  }
  styleOptionTerm(str) {
    return this.styleOptionText(str);
  }
  styleSubcommandTerm(str) {
    return str.split(" ").map((word) => {
      if (word === "[options]")
        return this.styleOptionText(word);
      if (word[0] === "[" || word[0] === "<")
        return this.styleArgumentText(word);
      return this.styleSubcommandText(word);
    }).join(" ");
  }
  styleArgumentTerm(str) {
    return this.styleArgumentText(str);
  }
  styleOptionText(str) {
    return str;
  }
  styleArgumentText(str) {
    return str;
  }
  styleSubcommandText(str) {
    return str;
  }
  styleCommandText(str) {
    return str;
  }
  padWidth(cmd, helper) {
    return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
  }
  preformatted(str) {
    return /\n[^\S\r\n]/.test(str);
  }
  formatItem(term, termWidth, description, helper) {
    const itemIndent = 2;
    const itemIndentStr = " ".repeat(itemIndent);
    if (!description)
      return itemIndentStr + term;
    const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
    const spacerWidth = 2;
    const helpWidth = this.helpWidth ?? 80;
    const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
    let formattedDescription;
    if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
      formattedDescription = description;
    } else {
      const wrappedDescription = helper.boxWrap(description, remainingWidth);
      formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
    }
    return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
  }
  boxWrap(str, width) {
    if (width < this.minWidthToWrap)
      return str;
    const rawLines = str.split(/\r\n|\n/);
    const chunkPattern = /[\s]*[^\s]+/g;
    const wrappedLines = [];
    rawLines.forEach((line) => {
      const chunks = line.match(chunkPattern);
      if (chunks === null) {
        wrappedLines.push("");
        return;
      }
      let sumChunks = [chunks.shift()];
      let sumWidth = this.displayWidth(sumChunks[0]);
      chunks.forEach((chunk) => {
        const visibleWidth = this.displayWidth(chunk);
        if (sumWidth + visibleWidth <= width) {
          sumChunks.push(chunk);
          sumWidth += visibleWidth;
          return;
        }
        wrappedLines.push(sumChunks.join(""));
        const nextChunk = chunk.trimStart();
        sumChunks = [nextChunk];
        sumWidth = this.displayWidth(nextChunk);
      });
      wrappedLines.push(sumChunks.join(""));
    });
    return wrappedLines.join(`
`);
  }
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/option.js
class Option {
  constructor(flags, description) {
    this.flags = flags;
    this.description = description || "";
    this.required = flags.includes("<");
    this.optional = flags.includes("[");
    this.variadic = /\w\.\.\.[>\]]$/.test(flags);
    this.mandatory = false;
    const optionFlags = splitOptionFlags(flags);
    this.short = optionFlags.shortFlag;
    this.long = optionFlags.longFlag;
    this.negate = false;
    if (this.long) {
      this.negate = this.long.startsWith("--no-");
    }
    this.defaultValue = undefined;
    this.defaultValueDescription = undefined;
    this.presetArg = undefined;
    this.envVar = undefined;
    this.parseArg = undefined;
    this.hidden = false;
    this.argChoices = undefined;
    this.conflictsWith = [];
    this.implied = undefined;
    this.helpGroupHeading = undefined;
  }
  default(value, description) {
    this.defaultValue = value;
    this.defaultValueDescription = description;
    return this;
  }
  preset(arg) {
    this.presetArg = arg;
    return this;
  }
  conflicts(names) {
    this.conflictsWith = this.conflictsWith.concat(names);
    return this;
  }
  implies(impliedOptionValues) {
    let newImplied = impliedOptionValues;
    if (typeof impliedOptionValues === "string") {
      newImplied = { [impliedOptionValues]: true };
    }
    this.implied = Object.assign(this.implied || {}, newImplied);
    return this;
  }
  env(name) {
    this.envVar = name;
    return this;
  }
  argParser(fn) {
    this.parseArg = fn;
    return this;
  }
  makeOptionMandatory(mandatory = true) {
    this.mandatory = !!mandatory;
    return this;
  }
  hideHelp(hide = true) {
    this.hidden = !!hide;
    return this;
  }
  _collectValue(value, previous) {
    if (previous === this.defaultValue || !Array.isArray(previous)) {
      return [value];
    }
    previous.push(value);
    return previous;
  }
  choices(values) {
    this.argChoices = values.slice();
    this.parseArg = (arg, previous) => {
      if (!this.argChoices.includes(arg)) {
        throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
      }
      if (this.variadic) {
        return this._collectValue(arg, previous);
      }
      return arg;
    };
    return this;
  }
  name() {
    if (this.long) {
      return this.long.replace(/^--/, "");
    }
    return this.short.replace(/^-/, "");
  }
  attributeName() {
    if (this.negate) {
      return camelcase(this.name().replace(/^no-/, ""));
    }
    return camelcase(this.name());
  }
  helpGroup(heading) {
    this.helpGroupHeading = heading;
    return this;
  }
  is(arg) {
    return this.short === arg || this.long === arg;
  }
  isBoolean() {
    return !this.required && !this.optional && !this.negate;
  }
}

class DualOptions {
  constructor(options) {
    this.positiveOptions = new Map;
    this.negativeOptions = new Map;
    this.dualOptions = new Set;
    options.forEach((option) => {
      if (option.negate) {
        this.negativeOptions.set(option.attributeName(), option);
      } else {
        this.positiveOptions.set(option.attributeName(), option);
      }
    });
    this.negativeOptions.forEach((value, key) => {
      if (this.positiveOptions.has(key)) {
        this.dualOptions.add(key);
      }
    });
  }
  valueFromOption(value, option) {
    const optionKey = option.attributeName();
    if (!this.dualOptions.has(optionKey))
      return true;
    const preset = this.negativeOptions.get(optionKey).presetArg;
    const negativeValue = preset !== undefined ? preset : false;
    return option.negate === (negativeValue === value);
  }
}
function camelcase(str) {
  return str.split("-").reduce((str2, word) => {
    return str2 + word[0].toUpperCase() + word.slice(1);
  });
}
function splitOptionFlags(flags) {
  let shortFlag;
  let longFlag;
  const shortFlagExp = /^-[^-]$/;
  const longFlagExp = /^--[^-]/;
  const flagParts = flags.split(/[ |,]+/).concat("guard");
  if (shortFlagExp.test(flagParts[0]))
    shortFlag = flagParts.shift();
  if (longFlagExp.test(flagParts[0]))
    longFlag = flagParts.shift();
  if (!shortFlag && shortFlagExp.test(flagParts[0]))
    shortFlag = flagParts.shift();
  if (!shortFlag && longFlagExp.test(flagParts[0])) {
    shortFlag = longFlag;
    longFlag = flagParts.shift();
  }
  if (flagParts[0].startsWith("-")) {
    const unsupportedFlag = flagParts[0];
    const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
    if (/^-[^-][^-]/.test(unsupportedFlag))
      throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
    if (shortFlagExp.test(unsupportedFlag))
      throw new Error(`${baseError}
- too many short flags`);
    if (longFlagExp.test(unsupportedFlag))
      throw new Error(`${baseError}
- too many long flags`);
    throw new Error(`${baseError}
- unrecognised flag format`);
  }
  if (shortFlag === undefined && longFlag === undefined)
    throw new Error(`option creation failed due to no flags found in '${flags}'.`);
  return { shortFlag, longFlag };
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/suggestSimilar.js
var maxDistance = 3;
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > maxDistance)
    return Math.max(a.length, b.length);
  const d = [];
  for (let i = 0;i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0;j <= b.length; j++) {
    d[0][j] = j;
  }
  for (let j = 1;j <= b.length; j++) {
    for (let i = 1;i <= a.length; i++) {
      let cost;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
      } else {
        cost = 1;
      }
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
function suggestSimilar(word, candidates) {
  if (!candidates || candidates.length === 0)
    return "";
  candidates = Array.from(new Set(candidates));
  const searchingOptions = word.startsWith("--");
  if (searchingOptions) {
    word = word.slice(2);
    candidates = candidates.map((candidate) => candidate.slice(2));
  }
  let similar = [];
  let bestDistance = maxDistance;
  const minSimilarity = 0.4;
  candidates.forEach((candidate) => {
    if (candidate.length <= 1)
      return;
    const distance = editDistance(word, candidate);
    const length = Math.max(word.length, candidate.length);
    const similarity = (length - distance) / length;
    if (similarity > minSimilarity) {
      if (distance < bestDistance) {
        bestDistance = distance;
        similar = [candidate];
      } else if (distance === bestDistance) {
        similar.push(candidate);
      }
    }
  });
  similar.sort((a, b) => a.localeCompare(b));
  if (searchingOptions) {
    similar = similar.map((candidate) => `--${candidate}`);
  }
  if (similar.length > 1) {
    return `
(Did you mean one of ${similar.join(", ")}?)`;
  }
  if (similar.length === 1) {
    return `
(Did you mean ${similar[0]}?)`;
  }
  return "";
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/lib/command.js
class Command extends EventEmitter {
  constructor(name) {
    super();
    this.commands = [];
    this.options = [];
    this.parent = null;
    this._allowUnknownOption = false;
    this._allowExcessArguments = false;
    this.registeredArguments = [];
    this._args = this.registeredArguments;
    this.args = [];
    this.rawArgs = [];
    this.processedArgs = [];
    this._scriptPath = null;
    this._name = name || "";
    this._optionValues = {};
    this._optionValueSources = {};
    this._storeOptionsAsProperties = false;
    this._actionHandler = null;
    this._executableHandler = false;
    this._executableFile = null;
    this._executableDir = null;
    this._defaultCommandName = null;
    this._exitCallback = null;
    this._aliases = [];
    this._combineFlagAndOptionalValue = true;
    this._description = "";
    this._summary = "";
    this._argsDescription = undefined;
    this._enablePositionalOptions = false;
    this._passThroughOptions = false;
    this._lifeCycleHooks = {};
    this._showHelpAfterError = false;
    this._showSuggestionAfterError = true;
    this._savedState = null;
    this._outputConfiguration = {
      writeOut: (str) => process3.stdout.write(str),
      writeErr: (str) => process3.stderr.write(str),
      outputError: (str, write) => write(str),
      getOutHelpWidth: () => process3.stdout.isTTY ? process3.stdout.columns : undefined,
      getErrHelpWidth: () => process3.stderr.isTTY ? process3.stderr.columns : undefined,
      getOutHasColors: () => useColor() ?? (process3.stdout.isTTY && process3.stdout.hasColors?.()),
      getErrHasColors: () => useColor() ?? (process3.stderr.isTTY && process3.stderr.hasColors?.()),
      stripColor: (str) => stripVTControlCharacters2(str)
    };
    this._hidden = false;
    this._helpOption = undefined;
    this._addImplicitHelpCommand = undefined;
    this._helpCommand = undefined;
    this._helpConfiguration = {};
    this._helpGroupHeading = undefined;
    this._defaultCommandGroup = undefined;
    this._defaultOptionGroup = undefined;
  }
  copyInheritedSettings(sourceCommand) {
    this._outputConfiguration = sourceCommand._outputConfiguration;
    this._helpOption = sourceCommand._helpOption;
    this._helpCommand = sourceCommand._helpCommand;
    this._helpConfiguration = sourceCommand._helpConfiguration;
    this._exitCallback = sourceCommand._exitCallback;
    this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
    this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
    this._allowExcessArguments = sourceCommand._allowExcessArguments;
    this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
    this._showHelpAfterError = sourceCommand._showHelpAfterError;
    this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
    return this;
  }
  _getCommandAndAncestors() {
    const result = [];
    for (let command = this;command; command = command.parent) {
      result.push(command);
    }
    return result;
  }
  command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
    let desc = actionOptsOrExecDesc;
    let opts = execOpts;
    if (typeof desc === "object" && desc !== null) {
      opts = desc;
      desc = null;
    }
    opts = opts || {};
    const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
    const cmd = this.createCommand(name);
    if (desc) {
      cmd.description(desc);
      cmd._executableHandler = true;
    }
    if (opts.isDefault)
      this._defaultCommandName = cmd._name;
    cmd._hidden = !!(opts.noHelp || opts.hidden);
    cmd._executableFile = opts.executableFile || null;
    if (args)
      cmd.arguments(args);
    this._registerCommand(cmd);
    cmd.parent = this;
    cmd.copyInheritedSettings(this);
    if (desc)
      return this;
    return cmd;
  }
  createCommand(name) {
    return new Command(name);
  }
  createHelp() {
    return Object.assign(new Help, this.configureHelp());
  }
  configureHelp(configuration) {
    if (configuration === undefined)
      return this._helpConfiguration;
    this._helpConfiguration = configuration;
    return this;
  }
  configureOutput(configuration) {
    if (configuration === undefined)
      return this._outputConfiguration;
    this._outputConfiguration = {
      ...this._outputConfiguration,
      ...configuration
    };
    return this;
  }
  showHelpAfterError(displayHelp = true) {
    if (typeof displayHelp !== "string")
      displayHelp = !!displayHelp;
    this._showHelpAfterError = displayHelp;
    return this;
  }
  showSuggestionAfterError(displaySuggestion = true) {
    this._showSuggestionAfterError = !!displaySuggestion;
    return this;
  }
  addCommand(cmd, opts) {
    if (!cmd._name) {
      throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
    }
    opts = opts || {};
    if (opts.isDefault)
      this._defaultCommandName = cmd._name;
    if (opts.noHelp || opts.hidden)
      cmd._hidden = true;
    this._registerCommand(cmd);
    cmd.parent = this;
    cmd._checkForBrokenPassThrough();
    return this;
  }
  createArgument(name, description) {
    return new Argument(name, description);
  }
  argument(name, description, parseArg, defaultValue) {
    const argument = this.createArgument(name, description);
    if (typeof parseArg === "function") {
      argument.default(defaultValue).argParser(parseArg);
    } else {
      argument.default(parseArg);
    }
    this.addArgument(argument);
    return this;
  }
  arguments(names) {
    names.trim().split(/ +/).forEach((detail) => {
      this.argument(detail);
    });
    return this;
  }
  addArgument(argument) {
    const previousArgument = this.registeredArguments.slice(-1)[0];
    if (previousArgument?.variadic) {
      throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
    }
    if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
      throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
    }
    this.registeredArguments.push(argument);
    return this;
  }
  helpCommand(enableOrNameAndArgs, description) {
    if (typeof enableOrNameAndArgs === "boolean") {
      this._addImplicitHelpCommand = enableOrNameAndArgs;
      if (enableOrNameAndArgs && this._defaultCommandGroup) {
        this._initCommandGroup(this._getHelpCommand());
      }
      return this;
    }
    const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
    const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
    const helpDescription = description ?? "display help for command";
    const helpCommand = this.createCommand(helpName);
    helpCommand.helpOption(false);
    if (helpArgs)
      helpCommand.arguments(helpArgs);
    if (helpDescription)
      helpCommand.description(helpDescription);
    this._addImplicitHelpCommand = true;
    this._helpCommand = helpCommand;
    if (enableOrNameAndArgs || description)
      this._initCommandGroup(helpCommand);
    return this;
  }
  addHelpCommand(helpCommand, deprecatedDescription) {
    if (typeof helpCommand !== "object") {
      this.helpCommand(helpCommand, deprecatedDescription);
      return this;
    }
    this._addImplicitHelpCommand = true;
    this._helpCommand = helpCommand;
    this._initCommandGroup(helpCommand);
    return this;
  }
  _getHelpCommand() {
    const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
    if (hasImplicitHelpCommand) {
      if (this._helpCommand === undefined) {
        this.helpCommand(undefined, undefined);
      }
      return this._helpCommand;
    }
    return null;
  }
  hook(event, listener) {
    const allowedValues = ["preSubcommand", "preAction", "postAction"];
    if (!allowedValues.includes(event)) {
      throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
    }
    if (this._lifeCycleHooks[event]) {
      this._lifeCycleHooks[event].push(listener);
    } else {
      this._lifeCycleHooks[event] = [listener];
    }
    return this;
  }
  exitOverride(fn) {
    if (fn) {
      this._exitCallback = fn;
    } else {
      this._exitCallback = (err) => {
        if (err.code !== "commander.executeSubCommandAsync") {
          throw err;
        } else {}
      };
    }
    return this;
  }
  _exit(exitCode, code, message) {
    if (this._exitCallback) {
      this._exitCallback(new CommanderError(exitCode, code, message));
    }
    process3.exit(exitCode);
  }
  action(fn) {
    const listener = (args) => {
      const expectedArgsCount = this.registeredArguments.length;
      const actionArgs = args.slice(0, expectedArgsCount);
      if (this._storeOptionsAsProperties) {
        actionArgs[expectedArgsCount] = this;
      } else {
        actionArgs[expectedArgsCount] = this.opts();
      }
      actionArgs.push(this);
      return fn.apply(this, actionArgs);
    };
    this._actionHandler = listener;
    return this;
  }
  createOption(flags, description) {
    return new Option(flags, description);
  }
  _callParseArg(target, value, previous, invalidArgumentMessage) {
    try {
      return target.parseArg(value, previous);
    } catch (err) {
      if (err.code === "commander.invalidArgument") {
        const message = `${invalidArgumentMessage} ${err.message}`;
        this.error(message, { exitCode: err.exitCode, code: err.code });
      }
      throw err;
    }
  }
  _registerOption(option) {
    const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
    if (matchingOption) {
      const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
      throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
    }
    this._initOptionGroup(option);
    this.options.push(option);
  }
  _registerCommand(command) {
    const knownBy = (cmd) => {
      return [cmd.name()].concat(cmd.aliases());
    };
    const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
    if (alreadyUsed) {
      const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
      const newCmd = knownBy(command).join("|");
      throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
    }
    this._initCommandGroup(command);
    this.commands.push(command);
  }
  addOption(option) {
    this._registerOption(option);
    const oname = option.name();
    const name = option.attributeName();
    if (option.defaultValue !== undefined) {
      this.setOptionValueWithSource(name, option.defaultValue, "default");
    }
    const handleOptionValue = (val, invalidValueMessage, valueSource) => {
      if (val == null && option.presetArg !== undefined) {
        val = option.presetArg;
      }
      const oldValue = this.getOptionValue(name);
      if (val !== null && option.parseArg) {
        val = this._callParseArg(option, val, oldValue, invalidValueMessage);
      } else if (val !== null && option.variadic) {
        val = option._collectValue(val, oldValue);
      }
      if (val == null) {
        if (option.negate) {
          val = false;
        } else if (option.isBoolean() || option.optional) {
          val = true;
        } else {
          val = "";
        }
      }
      this.setOptionValueWithSource(name, val, valueSource);
    };
    this.on("option:" + oname, (val) => {
      const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
      handleOptionValue(val, invalidValueMessage, "cli");
    });
    if (option.envVar) {
      this.on("optionEnv:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "env");
      });
    }
    return this;
  }
  _optionEx(config, flags, description, fn, defaultValue) {
    if (typeof flags === "object" && flags instanceof Option) {
      throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
    }
    const option = this.createOption(flags, description);
    option.makeOptionMandatory(!!config.mandatory);
    if (typeof fn === "function") {
      option.default(defaultValue).argParser(fn);
    } else if (fn instanceof RegExp) {
      const regex = fn;
      fn = (val, def) => {
        const m = regex.exec(val);
        return m ? m[0] : def;
      };
      option.default(defaultValue).argParser(fn);
    } else {
      option.default(fn);
    }
    return this.addOption(option);
  }
  option(flags, description, parseArg, defaultValue) {
    return this._optionEx({}, flags, description, parseArg, defaultValue);
  }
  requiredOption(flags, description, parseArg, defaultValue) {
    return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
  }
  combineFlagAndOptionalValue(combine = true) {
    this._combineFlagAndOptionalValue = !!combine;
    return this;
  }
  allowUnknownOption(allowUnknown = true) {
    this._allowUnknownOption = !!allowUnknown;
    return this;
  }
  allowExcessArguments(allowExcess = true) {
    this._allowExcessArguments = !!allowExcess;
    return this;
  }
  enablePositionalOptions(positional = true) {
    this._enablePositionalOptions = !!positional;
    return this;
  }
  passThroughOptions(passThrough = true) {
    this._passThroughOptions = !!passThrough;
    this._checkForBrokenPassThrough();
    return this;
  }
  _checkForBrokenPassThrough() {
    if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
      throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
    }
  }
  storeOptionsAsProperties(storeAsProperties = true) {
    if (this.options.length) {
      throw new Error("call .storeOptionsAsProperties() before adding options");
    }
    if (Object.keys(this._optionValues).length) {
      throw new Error("call .storeOptionsAsProperties() before setting option values");
    }
    this._storeOptionsAsProperties = !!storeAsProperties;
    return this;
  }
  getOptionValue(key) {
    if (this._storeOptionsAsProperties) {
      return this[key];
    }
    return this._optionValues[key];
  }
  setOptionValue(key, value) {
    return this.setOptionValueWithSource(key, value, undefined);
  }
  setOptionValueWithSource(key, value, source) {
    if (this._storeOptionsAsProperties) {
      this[key] = value;
    } else {
      this._optionValues[key] = value;
    }
    this._optionValueSources[key] = source;
    return this;
  }
  getOptionValueSource(key) {
    return this._optionValueSources[key];
  }
  getOptionValueSourceWithGlobals(key) {
    let source;
    this._getCommandAndAncestors().forEach((cmd) => {
      if (cmd.getOptionValueSource(key) !== undefined) {
        source = cmd.getOptionValueSource(key);
      }
    });
    return source;
  }
  _prepareUserArgs(argv, parseOptions) {
    if (argv !== undefined && !Array.isArray(argv)) {
      throw new Error("first parameter to parse must be array or undefined");
    }
    parseOptions = parseOptions || {};
    if (argv === undefined && parseOptions.from === undefined) {
      if (process3.versions?.electron) {
        parseOptions.from = "electron";
      }
      const execArgv = process3.execArgv ?? [];
      if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
        parseOptions.from = "eval";
      }
    }
    if (argv === undefined) {
      argv = process3.argv;
    }
    this.rawArgs = argv.slice();
    let userArgs;
    switch (parseOptions.from) {
      case undefined:
      case "node":
        this._scriptPath = argv[1];
        userArgs = argv.slice(2);
        break;
      case "electron":
        if (process3.defaultApp) {
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
        } else {
          userArgs = argv.slice(1);
        }
        break;
      case "user":
        userArgs = argv.slice(0);
        break;
      case "eval":
        userArgs = argv.slice(1);
        break;
      default:
        throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
    }
    if (!this._name && this._scriptPath)
      this.nameFromFilename(this._scriptPath);
    this._name = this._name || "program";
    return userArgs;
  }
  parse(argv, parseOptions) {
    this._prepareForParse();
    const userArgs = this._prepareUserArgs(argv, parseOptions);
    this._parseCommand([], userArgs);
    return this;
  }
  async parseAsync(argv, parseOptions) {
    this._prepareForParse();
    const userArgs = this._prepareUserArgs(argv, parseOptions);
    await this._parseCommand([], userArgs);
    return this;
  }
  _prepareForParse() {
    if (this._savedState === null) {
      this.options.filter((option) => option.negate && option.defaultValue === undefined && this.getOptionValue(option.attributeName()) === undefined).forEach((option) => {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(option.attributeName(), true, "default");
        }
      });
      this.saveStateBeforeParse();
    } else {
      this.restoreStateBeforeParse();
    }
  }
  saveStateBeforeParse() {
    this._savedState = {
      _name: this._name,
      _optionValues: { ...this._optionValues },
      _optionValueSources: { ...this._optionValueSources }
    };
  }
  restoreStateBeforeParse() {
    if (this._storeOptionsAsProperties)
      throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
    this._name = this._savedState._name;
    this._scriptPath = null;
    this.rawArgs = [];
    this._optionValues = { ...this._savedState._optionValues };
    this._optionValueSources = { ...this._savedState._optionValueSources };
    this.args = [];
    this.processedArgs = [];
  }
  _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
    if (fs10.existsSync(executableFile))
      return;
    const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
    const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
    throw new Error(executableMissing);
  }
  _executeSubCommand(subcommand, args) {
    args = args.slice();
    const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
    function findFile(baseDir, baseName) {
      const localBin = path10.resolve(baseDir, baseName);
      if (fs10.existsSync(localBin))
        return localBin;
      if (sourceExt.includes(path10.extname(baseName)))
        return;
      const foundExt = sourceExt.find((ext) => fs10.existsSync(`${localBin}${ext}`));
      if (foundExt)
        return `${localBin}${foundExt}`;
      return;
    }
    this._checkForMissingMandatoryOptions();
    this._checkForConflictingOptions();
    let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
    let executableDir = this._executableDir || "";
    if (this._scriptPath) {
      let resolvedScriptPath;
      try {
        resolvedScriptPath = fs10.realpathSync(this._scriptPath);
      } catch {
        resolvedScriptPath = this._scriptPath;
      }
      executableDir = path10.resolve(path10.dirname(resolvedScriptPath), executableDir);
    }
    if (executableDir) {
      let localFile = findFile(executableDir, executableFile);
      if (!localFile && !subcommand._executableFile && this._scriptPath) {
        const legacyName = path10.basename(this._scriptPath, path10.extname(this._scriptPath));
        if (legacyName !== this._name) {
          localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
        }
      }
      executableFile = localFile || executableFile;
    }
    const launchWithNode = sourceExt.includes(path10.extname(executableFile));
    let proc;
    if (process3.platform !== "win32") {
      if (launchWithNode) {
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process3.execArgv).concat(args);
        proc = childProcess.spawn(process3.argv[0], args, { stdio: "inherit" });
      } else {
        proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
      }
    } else {
      this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
      args.unshift(executableFile);
      args = incrementNodeInspectorPort(process3.execArgv).concat(args);
      proc = childProcess.spawn(process3.execPath, args, { stdio: "inherit" });
    }
    if (!proc.killed) {
      const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
      signals.forEach((signal) => {
        process3.on(signal, () => {
          if (proc.killed === false && proc.exitCode === null) {
            proc.kill(signal);
          }
        });
      });
    }
    const exitCallback = this._exitCallback;
    proc.on("close", (code) => {
      code = code ?? 1;
      if (!exitCallback) {
        process3.exit(code);
      } else {
        exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
      }
    });
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
      } else if (err.code === "EACCES") {
        throw new Error(`'${executableFile}' not executable`);
      }
      if (!exitCallback) {
        process3.exit(1);
      } else {
        const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
        wrappedError.nestedError = err;
        exitCallback(wrappedError);
      }
    });
    this.runningCommand = proc;
  }
  _dispatchSubcommand(commandName, operands, unknown) {
    const subCommand = this._findCommand(commandName);
    if (!subCommand)
      this.help({ error: true });
    subCommand._prepareForParse();
    let promiseChain;
    promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
    promiseChain = this._chainOrCall(promiseChain, () => {
      if (subCommand._executableHandler) {
        this._executeSubCommand(subCommand, operands.concat(unknown));
      } else {
        return subCommand._parseCommand(operands, unknown);
      }
    });
    return promiseChain;
  }
  _dispatchHelpCommand(subcommandName) {
    if (!subcommandName) {
      this.help();
    }
    const subCommand = this._findCommand(subcommandName);
    if (subCommand && !subCommand._executableHandler) {
      subCommand.help();
    }
    return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
  }
  _checkNumberOfArguments() {
    this.registeredArguments.forEach((arg, i) => {
      if (arg.required && this.args[i] == null) {
        this.missingArgument(arg.name());
      }
    });
    if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
      return;
    }
    if (this.args.length > this.registeredArguments.length) {
      this._excessArguments(this.args);
    }
  }
  _processArguments() {
    const myParseArg = (argument, value, previous) => {
      let parsedValue = value;
      if (value !== null && argument.parseArg) {
        const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
        parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
      }
      return parsedValue;
    };
    this._checkNumberOfArguments();
    const processedArgs = [];
    this.registeredArguments.forEach((declaredArg, index) => {
      let value = declaredArg.defaultValue;
      if (declaredArg.variadic) {
        if (index < this.args.length) {
          value = this.args.slice(index);
          if (declaredArg.parseArg) {
            value = value.reduce((processed, v) => {
              return myParseArg(declaredArg, v, processed);
            }, declaredArg.defaultValue);
          }
        } else if (value === undefined) {
          value = [];
        }
      } else if (index < this.args.length) {
        value = this.args[index];
        if (declaredArg.parseArg) {
          value = myParseArg(declaredArg, value, declaredArg.defaultValue);
        }
      }
      processedArgs[index] = value;
    });
    this.processedArgs = processedArgs;
  }
  _chainOrCall(promise, fn) {
    if (promise?.then && typeof promise.then === "function") {
      return promise.then(() => fn());
    }
    return fn();
  }
  _chainOrCallHooks(promise, event) {
    let result = promise;
    const hooks = [];
    this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
      hookedCommand._lifeCycleHooks[event].forEach((callback) => {
        hooks.push({ hookedCommand, callback });
      });
    });
    if (event === "postAction") {
      hooks.reverse();
    }
    hooks.forEach((hookDetail) => {
      result = this._chainOrCall(result, () => {
        return hookDetail.callback(hookDetail.hookedCommand, this);
      });
    });
    return result;
  }
  _chainOrCallSubCommandHook(promise, subCommand, event) {
    let result = promise;
    if (this._lifeCycleHooks[event] !== undefined) {
      this._lifeCycleHooks[event].forEach((hook) => {
        result = this._chainOrCall(result, () => {
          return hook(this, subCommand);
        });
      });
    }
    return result;
  }
  _parseCommand(operands, unknown) {
    const parsed = this.parseOptions(unknown);
    this._parseOptionsEnv();
    this._parseOptionsImplied();
    operands = operands.concat(parsed.operands);
    unknown = parsed.unknown;
    this.args = operands.concat(unknown);
    if (operands && this._findCommand(operands[0])) {
      return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
    }
    if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
      return this._dispatchHelpCommand(operands[1]);
    }
    if (this._defaultCommandName) {
      this._outputHelpIfRequested(unknown);
      return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
    }
    if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
      this.help({ error: true });
    }
    this._outputHelpIfRequested(parsed.unknown);
    this._checkForMissingMandatoryOptions();
    this._checkForConflictingOptions();
    const checkForUnknownOptions = () => {
      if (parsed.unknown.length > 0) {
        this.unknownOption(parsed.unknown[0]);
      }
    };
    const commandEvent = `command:${this.name()}`;
    if (this._actionHandler) {
      checkForUnknownOptions();
      this._processArguments();
      let promiseChain;
      promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
      promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
      if (this.parent) {
        promiseChain = this._chainOrCall(promiseChain, () => {
          this.parent.emit(commandEvent, operands, unknown);
        });
      }
      promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
      return promiseChain;
    }
    if (this.parent?.listenerCount(commandEvent)) {
      checkForUnknownOptions();
      this._processArguments();
      this.parent.emit(commandEvent, operands, unknown);
    } else if (operands.length) {
      if (this._findCommand("*")) {
        return this._dispatchSubcommand("*", operands, unknown);
      }
      if (this.listenerCount("command:*")) {
        this.emit("command:*", operands, unknown);
      } else if (this.commands.length) {
        this.unknownCommand();
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    } else if (this.commands.length) {
      checkForUnknownOptions();
      this.help({ error: true });
    } else {
      checkForUnknownOptions();
      this._processArguments();
    }
  }
  _findCommand(name) {
    if (!name)
      return;
    return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
  }
  _findOption(arg) {
    return this.options.find((option) => option.is(arg));
  }
  _checkForMissingMandatoryOptions() {
    this._getCommandAndAncestors().forEach((cmd) => {
      cmd.options.forEach((anOption) => {
        if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
          cmd.missingMandatoryOptionValue(anOption);
        }
      });
    });
  }
  _checkForConflictingLocalOptions() {
    const definedNonDefaultOptions = this.options.filter((option) => {
      const optionKey = option.attributeName();
      if (this.getOptionValue(optionKey) === undefined) {
        return false;
      }
      return this.getOptionValueSource(optionKey) !== "default";
    });
    const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
    optionsWithConflicting.forEach((option) => {
      const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
      if (conflictingAndDefined) {
        this._conflictingOption(option, conflictingAndDefined);
      }
    });
  }
  _checkForConflictingOptions() {
    this._getCommandAndAncestors().forEach((cmd) => {
      cmd._checkForConflictingLocalOptions();
    });
  }
  parseOptions(args) {
    const operands = [];
    const unknown = [];
    let dest = operands;
    function maybeOption(arg) {
      return arg.length > 1 && arg[0] === "-";
    }
    const negativeNumberArg = (arg) => {
      if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg))
        return false;
      return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
    };
    let activeVariadicOption = null;
    let activeGroup = null;
    let i = 0;
    while (i < args.length || activeGroup) {
      const arg = activeGroup ?? args[i++];
      activeGroup = null;
      if (arg === "--") {
        if (dest === unknown)
          dest.push(arg);
        dest.push(...args.slice(i));
        break;
      }
      if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
        this.emit(`option:${activeVariadicOption.name()}`, arg);
        continue;
      }
      activeVariadicOption = null;
      if (maybeOption(arg)) {
        const option = this._findOption(arg);
        if (option) {
          if (option.required) {
            const value = args[i++];
            if (value === undefined)
              this.optionMissingArgument(option);
            this.emit(`option:${option.name()}`, value);
          } else if (option.optional) {
            let value = null;
            if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
              value = args[i++];
            }
            this.emit(`option:${option.name()}`, value);
          } else {
            this.emit(`option:${option.name()}`);
          }
          activeVariadicOption = option.variadic ? option : null;
          continue;
        }
      }
      if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
        const option = this._findOption(`-${arg[1]}`);
        if (option) {
          if (option.required || option.optional && this._combineFlagAndOptionalValue) {
            this.emit(`option:${option.name()}`, arg.slice(2));
          } else {
            this.emit(`option:${option.name()}`);
            activeGroup = `-${arg.slice(2)}`;
          }
          continue;
        }
      }
      if (/^--[^=]+=/.test(arg)) {
        const index = arg.indexOf("=");
        const option = this._findOption(arg.slice(0, index));
        if (option && (option.required || option.optional)) {
          this.emit(`option:${option.name()}`, arg.slice(index + 1));
          continue;
        }
      }
      if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
        dest = unknown;
      }
      if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
        if (this._findCommand(arg)) {
          operands.push(arg);
          unknown.push(...args.slice(i));
          break;
        } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
          operands.push(arg, ...args.slice(i));
          break;
        } else if (this._defaultCommandName) {
          unknown.push(arg, ...args.slice(i));
          break;
        }
      }
      if (this._passThroughOptions) {
        dest.push(arg, ...args.slice(i));
        break;
      }
      dest.push(arg);
    }
    return { operands, unknown };
  }
  opts() {
    if (this._storeOptionsAsProperties) {
      const result = {};
      const len = this.options.length;
      for (let i = 0;i < len; i++) {
        const key = this.options[i].attributeName();
        result[key] = key === this._versionOptionName ? this._version : this[key];
      }
      return result;
    }
    return this._optionValues;
  }
  optsWithGlobals() {
    return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
  }
  error(message, errorOptions) {
    this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
    if (typeof this._showHelpAfterError === "string") {
      this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
    } else if (this._showHelpAfterError) {
      this._outputConfiguration.writeErr(`
`);
      this.outputHelp({ error: true });
    }
    const config = errorOptions || {};
    const exitCode = config.exitCode || 1;
    const code = config.code || "commander.error";
    this._exit(exitCode, code, message);
  }
  _parseOptionsEnv() {
    this.options.forEach((option) => {
      if (option.envVar && option.envVar in process3.env) {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
          if (option.required || option.optional) {
            this.emit(`optionEnv:${option.name()}`, process3.env[option.envVar]);
          } else {
            this.emit(`optionEnv:${option.name()}`);
          }
        }
      }
    });
  }
  _parseOptionsImplied() {
    const dualHelper = new DualOptions(this.options);
    const hasCustomOptionValue = (optionKey) => {
      return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
    };
    this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
      Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
        this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
      });
    });
  }
  missingArgument(name) {
    const message = `error: missing required argument '${name}'`;
    this.error(message, { code: "commander.missingArgument" });
  }
  optionMissingArgument(option) {
    const message = `error: option '${option.flags}' argument missing`;
    this.error(message, { code: "commander.optionMissingArgument" });
  }
  missingMandatoryOptionValue(option) {
    const message = `error: required option '${option.flags}' not specified`;
    this.error(message, { code: "commander.missingMandatoryOptionValue" });
  }
  _conflictingOption(option, conflictingOption) {
    const findBestOptionFromValue = (option2) => {
      const optionKey = option2.attributeName();
      const optionValue = this.getOptionValue(optionKey);
      const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
      const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
      if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
        return negativeOption;
      }
      return positiveOption || option2;
    };
    const getErrorMessage = (option2) => {
      const bestOption = findBestOptionFromValue(option2);
      const optionKey = bestOption.attributeName();
      const source = this.getOptionValueSource(optionKey);
      if (source === "env") {
        return `environment variable '${bestOption.envVar}'`;
      }
      return `option '${bestOption.flags}'`;
    };
    const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
    this.error(message, { code: "commander.conflictingOption" });
  }
  unknownOption(flag) {
    if (this._allowUnknownOption)
      return;
    let suggestion = "";
    if (flag.startsWith("--") && this._showSuggestionAfterError) {
      let candidateFlags = [];
      let command = this;
      do {
        const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
        candidateFlags = candidateFlags.concat(moreFlags);
        command = command.parent;
      } while (command && !command._enablePositionalOptions);
      suggestion = suggestSimilar(flag, candidateFlags);
    }
    const message = `error: unknown option '${flag}'${suggestion}`;
    this.error(message, { code: "commander.unknownOption" });
  }
  _excessArguments(receivedArgs) {
    if (this._allowExcessArguments)
      return;
    const expected = this.registeredArguments.length;
    const s = expected === 1 ? "" : "s";
    const received = receivedArgs.length;
    const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
    const details = receivedArgs.join(", ");
    const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${received}: ${details}.`;
    this.error(message, { code: "commander.excessArguments" });
  }
  unknownCommand() {
    const unknownName = this.args[0];
    let suggestion = "";
    if (this._showSuggestionAfterError) {
      const candidateNames = [];
      this.createHelp().visibleCommands(this).forEach((command) => {
        candidateNames.push(command.name());
        if (command.alias())
          candidateNames.push(command.alias());
      });
      suggestion = suggestSimilar(unknownName, candidateNames);
    }
    const message = `error: unknown command '${unknownName}'${suggestion}`;
    this.error(message, { code: "commander.unknownCommand" });
  }
  version(str, flags, description) {
    if (str === undefined)
      return this._version;
    this._version = str;
    flags = flags || "-V, --version";
    description = description || "output the version number";
    const versionOption = this.createOption(flags, description);
    this._versionOptionName = versionOption.attributeName();
    this._registerOption(versionOption);
    this.on("option:" + versionOption.name(), () => {
      this._outputConfiguration.writeOut(`${str}
`);
      this._exit(0, "commander.version", str);
    });
    return this;
  }
  description(str, argsDescription) {
    if (str === undefined && argsDescription === undefined)
      return this._description;
    this._description = str;
    if (argsDescription) {
      this._argsDescription = argsDescription;
    }
    return this;
  }
  summary(str) {
    if (str === undefined)
      return this._summary;
    this._summary = str;
    return this;
  }
  alias(alias) {
    if (alias === undefined)
      return this._aliases[0];
    let command = this;
    if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
      command = this.commands[this.commands.length - 1];
    }
    if (alias === command._name)
      throw new Error("Command alias can't be the same as its name");
    const matchingCommand = this.parent?._findCommand(alias);
    if (matchingCommand) {
      const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
      throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
    }
    command._aliases.push(alias);
    return this;
  }
  aliases(aliases) {
    if (aliases === undefined)
      return this._aliases;
    aliases.forEach((alias) => this.alias(alias));
    return this;
  }
  usage(str) {
    if (str === undefined) {
      if (this._usage)
        return this._usage;
      const args = this.registeredArguments.map((arg) => {
        return humanReadableArgName(arg);
      });
      return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
    }
    this._usage = str;
    return this;
  }
  name(str) {
    if (str === undefined)
      return this._name;
    this._name = str;
    return this;
  }
  helpGroup(heading) {
    if (heading === undefined)
      return this._helpGroupHeading ?? "";
    this._helpGroupHeading = heading;
    return this;
  }
  commandsGroup(heading) {
    if (heading === undefined)
      return this._defaultCommandGroup ?? "";
    this._defaultCommandGroup = heading;
    return this;
  }
  optionsGroup(heading) {
    if (heading === undefined)
      return this._defaultOptionGroup ?? "";
    this._defaultOptionGroup = heading;
    return this;
  }
  _initOptionGroup(option) {
    if (this._defaultOptionGroup && !option.helpGroupHeading)
      option.helpGroup(this._defaultOptionGroup);
  }
  _initCommandGroup(cmd) {
    if (this._defaultCommandGroup && !cmd.helpGroup())
      cmd.helpGroup(this._defaultCommandGroup);
  }
  nameFromFilename(filename) {
    this._name = path10.basename(filename, path10.extname(filename));
    return this;
  }
  executableDir(path11) {
    if (path11 === undefined)
      return this._executableDir;
    this._executableDir = path11;
    return this;
  }
  helpInformation(contextOptions) {
    const helper = this.createHelp();
    const context = this._getOutputContext(contextOptions);
    helper.prepareContext({
      error: context.error,
      helpWidth: context.helpWidth,
      outputHasColors: context.hasColors
    });
    const text = helper.formatHelp(this, helper);
    if (context.hasColors)
      return text;
    return this._outputConfiguration.stripColor(text);
  }
  _getOutputContext(contextOptions) {
    contextOptions = contextOptions || {};
    const error = !!contextOptions.error;
    let baseWrite;
    let hasColors;
    let helpWidth;
    if (error) {
      baseWrite = (str) => this._outputConfiguration.writeErr(str);
      hasColors = this._outputConfiguration.getErrHasColors();
      helpWidth = this._outputConfiguration.getErrHelpWidth();
    } else {
      baseWrite = (str) => this._outputConfiguration.writeOut(str);
      hasColors = this._outputConfiguration.getOutHasColors();
      helpWidth = this._outputConfiguration.getOutHelpWidth();
    }
    const write = (str) => {
      if (!hasColors)
        str = this._outputConfiguration.stripColor(str);
      return baseWrite(str);
    };
    return { error, write, hasColors, helpWidth };
  }
  outputHelp(contextOptions) {
    let deprecatedCallback;
    if (typeof contextOptions === "function") {
      deprecatedCallback = contextOptions;
      contextOptions = undefined;
    }
    const outputContext = this._getOutputContext(contextOptions);
    const eventContext = {
      error: outputContext.error,
      write: outputContext.write,
      command: this
    };
    this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
    this.emit("beforeHelp", eventContext);
    let helpInformation = this.helpInformation({ error: outputContext.error });
    if (deprecatedCallback) {
      helpInformation = deprecatedCallback(helpInformation);
      if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
        throw new Error("outputHelp callback must return a string or a Buffer");
      }
    }
    outputContext.write(helpInformation);
    if (this._getHelpOption()?.long) {
      this.emit(this._getHelpOption().long);
    }
    this.emit("afterHelp", eventContext);
    this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
  }
  helpOption(flags, description) {
    if (typeof flags === "boolean") {
      if (flags) {
        if (this._helpOption === null)
          this._helpOption = undefined;
        if (this._defaultOptionGroup) {
          this._initOptionGroup(this._getHelpOption());
        }
      } else {
        this._helpOption = null;
      }
      return this;
    }
    this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
    if (flags || description)
      this._initOptionGroup(this._helpOption);
    return this;
  }
  _getHelpOption() {
    if (this._helpOption === undefined) {
      this.helpOption(undefined, undefined);
    }
    return this._helpOption;
  }
  addHelpOption(option) {
    this._helpOption = option;
    this._initOptionGroup(option);
    return this;
  }
  help(contextOptions) {
    this.outputHelp(contextOptions);
    let exitCode = Number(process3.exitCode ?? 0);
    if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
      exitCode = 1;
    }
    this._exit(exitCode, "commander.help", "(outputHelp)");
  }
  addHelpText(position, text) {
    const allowedValues = ["beforeAll", "before", "after", "afterAll"];
    if (!allowedValues.includes(position)) {
      throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
    }
    const helpEvent = `${position}Help`;
    this.on(helpEvent, (context) => {
      let helpStr;
      if (typeof text === "function") {
        helpStr = text({ error: context.error, command: context.command });
      } else {
        helpStr = text;
      }
      if (helpStr) {
        context.write(`${helpStr}
`);
      }
    });
    return this;
  }
  _outputHelpIfRequested(args) {
    const helpOption = this._getHelpOption();
    const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
    if (helpRequested) {
      this.outputHelp();
      this._exit(0, "commander.helpDisplayed", "(outputHelp)");
    }
  }
}
function incrementNodeInspectorPort(args) {
  return args.map((arg) => {
    if (!arg.startsWith("--inspect")) {
      return arg;
    }
    let debugOption;
    let debugHost = "127.0.0.1";
    let debugPort = "9229";
    let match;
    if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
      debugOption = match[1];
    } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
      debugOption = match[1];
      if (/^\d+$/.test(match[3])) {
        debugPort = match[3];
      } else {
        debugHost = match[3];
      }
    } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
      debugOption = match[1];
      debugHost = match[3];
      debugPort = match[4];
    }
    if (debugOption && debugPort !== "0") {
      return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
    }
    return arg;
  });
}
function useColor() {
  if (process3.env.NO_COLOR || process3.env.FORCE_COLOR === "0" || process3.env.FORCE_COLOR === "false")
    return false;
  if (process3.env.FORCE_COLOR || process3.env.CLICOLOR_FORCE !== undefined)
    return true;
  return;
}

// node_modules/.pnpm/commander@15.0.0/node_modules/commander/index.js
var program = new Command;

// src/bin/speakeasy-cli.ts
init_constants();

// src/cli/args.ts
init_zod();
var cliSchema = exports_external.object({
  text: exports_external.string().optional(),
  provider: exports_external.enum(["system", "openai", "elevenlabs", "groq", "gemini"]).optional(),
  voice: exports_external.string().optional(),
  rate: exports_external.preprocess((v) => typeof v === "string" ? parseInt(v, 10) : v, exports_external.number().int().min(60).max(480)).optional(),
  volume: exports_external.preprocess((v) => typeof v === "string" ? parseFloat(v) : v, exports_external.number().min(0).max(1)).optional(),
  instructions: exports_external.string().optional(),
  interrupt: exports_external.boolean().optional(),
  cache: exports_external.boolean().optional(),
  clearCache: exports_external.boolean().optional(),
  config: exports_external.boolean().optional(),
  edit: exports_external.boolean().optional(),
  diagnose: exports_external.boolean().optional(),
  doctor: exports_external.boolean().optional(),
  help: exports_external.boolean().optional(),
  debug: exports_external.boolean().optional(),
  list: exports_external.boolean().optional(),
  find: exports_external.string().optional(),
  stats: exports_external.boolean().optional(),
  recent: exports_external.preprocess((v) => typeof v === "string" ? parseInt(v, 10) : v, exports_external.number().int().positive()).optional(),
  id: exports_external.string().optional(),
  play: exports_external.string().optional(),
  out: exports_external.string().optional(),
  welcome: exports_external.boolean().optional(),
  silent: exports_external.boolean().optional(),
  setKey: exports_external.string().optional(),
  setDefault: exports_external.string().optional(),
  app: exports_external.boolean().optional(),
  updateApp: exports_external.boolean().optional(),
  premium: exports_external.boolean().optional(),
  listVoices: exports_external.boolean().optional()
});
function parseAndValidate(raw) {
  const result = cliSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join(".") || "argument"}: ${i.message}`).join(`
`);
    throw new Error(`Invalid arguments:
${message}`);
  }
  return result.data;
}

// src/bin/speakeasy-cli.ts
function mirrorToDeck(text) {
  (async () => {
    try {
      const fs11 = await import("fs");
      const path18 = await import("path");
      const infoFile = path18.join(CONFIG_DIR3, "deck-listener.json");
      if (!fs11.existsSync(infoFile))
        return;
      const info = JSON.parse(fs11.readFileSync(infoFile, "utf8"));
      if (!info.dataPort)
        return;
      const query = info.token ? `?k=${encodeURIComponent(info.token)}` : "";
      await fetch(`http://127.0.0.1:${info.dataPort}/api/speak${query}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, play: false }),
        signal: AbortSignal.timeout(800)
      });
    } catch {}
  })();
}
async function run2() {
  if (process.argv.length <= 2) {
    showHelp();
    return;
  }
  if (process.argv[2] === "deck") {
    const { runDeck: runDeck2 } = await Promise.resolve().then(() => (init_deck(), exports_deck));
    await runDeck2(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === "plugin") {
    const { runPlugin: runPlugin2 } = await Promise.resolve().then(() => (init_plugin(), exports_plugin));
    await runPlugin2(process.argv.slice(3));
    return;
  }
  const program2 = new Command;
  program2.name("speakeasy").helpOption("-H, --builtin-help", "show built-in help").version(getPackageVersion(), "-V, --version", "output the version number").argument("[text]").option("-t, --text <text>").option("-p, --provider <provider>").option("-v, --voice <voice>").option("-r, --rate <rate>").option("--volume <volume>").option("--instructions <instructions>", "OpenAI: voice steering instructions (accent, tone, style)").option("-i, --interrupt").option("-c, --cache").option("--clear-cache").option("--config").option("--edit").option("-h, --help").option("-d, --debug").option("--diagnose").option("--doctor").option("--welcome").option("--list").option("--find <text>").option("--stats").option("--recent <n>").option("--id <key>").option("--play <key>").option("--out <file>").option("-s, --silent").option("--set-key <provider>").option("--set-default <provider>").option("--app", "open settings app (downloads on first use; prints version + path)").option("--update-app", "update the settings app (prints version + path)").option("--premium", "use best available system voice (Premium > Enhanced > Standard)").option("--list-voices", "list available macOS system voices");
  program2.parse(process.argv);
  const parsed = program2.opts();
  let text = parsed.text || program2.args[0] || "";
  const options = parseAndValidate({ ...parsed, text });
  if (options.help) {
    showHelp();
    return;
  }
  if (options.listVoices) {
    const voices = getAvailableVoices();
    const bestVoice = getBestVoice();
    console.log(`Available macOS System Voices:
`);
    const premium = voices.filter((v) => v.includes("(Premium)"));
    const enhanced = voices.filter((v) => v.includes("(Enhanced)"));
    const standard = voices.filter((v) => !v.includes("(Premium)") && !v.includes("(Enhanced)"));
    if (premium.length > 0) {
      console.log("\u2B50 Premium Voices:");
      premium.forEach((v) => console.log(`   ${v === bestVoice ? "\u2192 " : "  "}${v}`));
      console.log("");
    }
    if (enhanced.length > 0) {
      console.log("\u2728 Enhanced Voices:");
      enhanced.forEach((v) => console.log(`   ${v === bestVoice ? "\u2192 " : "  "}${v}`));
      console.log("");
    }
    console.log(`\uD83D\uDCE2 Standard Voices: ${standard.length} available`);
    console.log(`   (Use "say -v '?'" for full list)`);
    console.log("");
    console.log(`\uD83C\uDFAF Best available: ${bestVoice}`);
    console.log("");
    console.log("Usage:");
    console.log('   speakeasy "text" --premium           # Use best voice');
    console.log(`   speakeasy "text" --voice "${bestVoice}"   # Use specific voice`);
    return;
  }
  if ((!hasConfig() && !text && !options.config && !options.help && !options.diagnose && !options.doctor && !options.app && !options.updateApp || options.welcome) && !options.help) {
    showWelcome();
    return;
  }
  if (options.config) {
    showConfig(options.edit);
    return;
  }
  if (options.clearCache) {
    await clearCache();
    return;
  }
  if (options.diagnose) {
    diagnoseConfig();
    return;
  }
  if (options.doctor) {
    runDoctor();
    return;
  }
  if (options.setKey) {
    if (!text) {
      console.error("\u274C API key required");
      console.error("");
      console.error("Usage: speakeasy --set-key <provider> <api-key>");
      console.error("");
      console.error("Example:");
      console.error("   speakeasy --set-key elevenlabs sk-xxxxxxxxxxxx");
      process.exit(1);
    }
    setApiKey(options.setKey, text);
    return;
  }
  if (options.setDefault) {
    setDefaultProvider(options.setDefault);
    return;
  }
  if (options.updateApp) {
    await updateApp(console.log);
    return;
  }
  if (options.app) {
    if (process.platform !== "darwin") {
      console.error("\u274C Settings app is only available on macOS");
      process.exit(1);
    }
    if (!isAppInstalled()) {
      const success = await ensureAppInstalled(console.log);
      if (!success) {
        process.exit(1);
      }
    }
    if (!launchApp(console.log)) {
      process.exit(1);
    }
    return;
  }
  if (options.play) {
    await playCachedAudio(options.play);
    return;
  }
  if (options.list || options.find !== undefined || options.stats || options.recent !== undefined || options.id) {
    await listCacheEntries({
      find: options.find,
      stats: options.stats,
      recent: options.recent,
      id: options.id
    });
    return;
  }
  const isCacheCommand = options.list || options.find !== undefined || options.stats || options.recent !== undefined || options.id || options.play || options.clearCache;
  const isConfigCommand = options.config || options.diagnose || options.doctor;
  if (!text && !isCacheCommand && !isConfigCommand) {
    console.error("\u274C No text provided to speak");
    process.exit(1);
  }
  try {
    const config = {
      ...options.provider && { provider: options.provider },
      ...options.rate !== undefined && { rate: options.rate },
      volume: options.volume !== undefined ? options.volume : undefined,
      instructions: options.instructions,
      debug: options.debug || false,
      ...(options.cache || options.out) && { cache: { enabled: true } }
    };
    if (options.premium) {
      config.provider = "system";
      config.systemVoice = getBestVoice();
    }
    if (options.voice) {
      switch (config.provider) {
        case "system":
          config.systemVoice = options.voice;
          break;
        case "openai":
          config.openaiVoice = options.voice;
          break;
        case "elevenlabs":
          config.elevenlabsVoiceId = options.voice;
          break;
        case "groq":
          config.groqVoice = options.voice;
          break;
        case "gemini":
          config.geminiModel = options.voice;
          break;
      }
    }
    const speaker = new SpeakEasy(config);
    mirrorToDeck(text);
    await speaker.speak(text, { interrupt: options.interrupt, silent: options.silent });
    if (options.out) {
      try {
        const cacheStats = await speaker.getCacheStats();
        if (cacheStats.dir) {
          const { TTSCache: TTSCache2 } = await Promise.resolve().then(() => (init_cache(), exports_cache));
          const cache = new TTSCache2(cacheStats.dir, "7d");
          const recentEntries = await cache.getRecent(1);
          if (recentEntries.length > 0) {
            const latestEntry = recentEntries[0];
            const fs11 = await import("fs");
            if (fs11.existsSync(latestEntry.filePath)) {
              fs11.copyFileSync(latestEntry.filePath, options.out);
              fs11.chmodSync(options.out, 384);
              const stats = fs11.statSync(options.out);
              console.log(`\uD83D\uDCBE Audio saved to: ${options.out} (${(stats.size / 1024).toFixed(1)} KB)`);
            } else {
              console.error(`\u274C Audio file not found: ${latestEntry.filePath}`);
            }
          } else {
            console.error("\u274C No recent audio files found in cache");
          }
        } else {
          console.error("\u274C Cache not enabled - cannot save file");
        }
      } catch (error) {
        console.error("\u274C Error saving file:", error.message);
      }
    }
  } catch (error) {
    const errorMessage2 = error.message;
    const errorMsg = errorMessage2.toLowerCase();
    console.error("\u274C Error:", errorMessage2);
    console.error("");
    if (errorMsg.includes("api key") || errorMsg.includes("invalid") || errorMsg.includes("required")) {
      console.error("\uD83D\uDD11 Setup Guide:");
      console.error("");
      if (options.provider === "elevenlabs" || errorMsg.includes("elevenlabs")) {
        console.error("   ElevenLabs:");
        console.error("   1. Get API key: https://elevenlabs.io/app/settings/api-keys");
        console.error("   2. Set: export ELEVENLABS_API_KEY=your_key_here");
      } else if (options.provider === "openai" || errorMsg.includes("openai")) {
        console.error("   OpenAI:");
        console.error("   1. Get API key: https://platform.openai.com/api-keys");
        console.error("   2. Set: export OPENAI_API_KEY=your_key_here");
      } else if (options.provider === "groq" || errorMsg.includes("groq")) {
        console.error("   Groq:");
        console.error("   1. Get API key: https://console.groq.com/keys");
        console.error("   2. Set: export GROQ_API_KEY=your_key_here");
      } else if (options.provider === "gemini" || errorMsg.includes("gemini")) {
        console.error("   Gemini:");
        console.error("   1. Get API key: https://makersuite.google.com/app/apikey");
        console.error("   2. Set: export GEMINI_API_KEY=your_key_here");
      }
      console.error("");
      console.error("   \uD83D\uDDE3\uFE0F  Quick fix: Use macOS built-in voices (no API key needed)");
      console.error('   speakeasy "hello world" --provider system');
      console.error("");
      console.error("   \uD83D\uDD27 Run: speakeasy --doctor for full setup help");
    } else if (errorMsg.includes("rate limit")) {
      console.error("\u23F0 Rate Limit Exceeded");
      console.error("");
      console.error("\uD83D\uDCA1 Solutions:");
      console.error("   \u2022 Wait 60 seconds and retry");
      console.error('   \u2022 Use system voice: speakeasy "text" --provider system');
      console.error("   \u2022 Check your provider dashboard for limits");
    } else {
      console.error("\uD83D\uDCA1 Try: speakeasy --doctor for troubleshooting help");
    }
    if (options.provider !== "system") {
      console.error("");
      console.error("\uD83D\uDDE3\uFE0F  Quick fix: Use macOS built-in voices (no API key needed)");
      console.error('   speakeasy "text" --provider system');
    }
    process.exit(1);
  }
}
if (import.meta.main) {
  run2().catch(console.error);
}
