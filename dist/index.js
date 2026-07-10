"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CONFIG_FILE: () => CONFIG_FILE,
  ElevenLabsProvider: () => ElevenLabsProvider,
  GeminiProvider: () => GeminiProvider,
  GroqProvider: () => GroqProvider,
  OpenAIProvider: () => OpenAIProvider,
  PROVIDER_ORDER: () => PROVIDER_ORDER,
  SpeakEasy: () => SpeakEasy,
  SystemProvider: () => SystemProvider,
  TTSCache: () => TTSCache,
  createAdapterRegistry: () => createAdapterRegistry,
  getAvailableVoices: () => getAvailableVoices,
  getBestVoice: () => getBestVoice,
  playAudioFile: () => playAudioFile,
  playTTSResult: () => playTTSResult,
  say: () => say,
  speak: () => speak,
  stopPlayback: () => stopPlayback
});
module.exports = __toCommonJS(index_exports);
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));

// src/providers/system.ts
var import_child_process2 = require("child_process");
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

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

// src/adapters/audio.ts
var import_child_process = require("child_process");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/hud.ts
var import_fs = require("fs");
var import_fs2 = require("fs");
var HUD_PIPE_PATH = "/tmp/speakeasy-hud.fifo";
function writeToPipe(message) {
  if (!(0, import_fs2.existsSync)(HUD_PIPE_PATH)) {
    return;
  }
  try {
    const stats = (0, import_fs2.statSync)(HUD_PIPE_PATH);
    if (!stats.isFIFO()) {
      return;
    }
    const fd = (0, import_fs.openSync)(HUD_PIPE_PATH, import_fs.constants.O_WRONLY | import_fs.constants.O_NONBLOCK);
    try {
      const jsonMessage = JSON.stringify(message) + "\n";
      (0, import_fs.writeSync)(fd, jsonMessage);
    } finally {
      (0, import_fs.closeSync)(fd);
    }
  } catch {
  }
}
function notifyHUD(message) {
  writeToPipe(message);
}
function updateAudioLevel(level) {
  writeToPipe({ audioLevel: Math.max(0, Math.min(1, level)) });
}

// src/adapters/audio.ts
function extensionForFormat(format) {
  return format;
}
function playAudioFile(filePath, volume = 1) {
  return new Promise((resolve, reject) => {
    const volumeArgs = volume !== 1 ? ["-v", volume.toString()] : [];
    const afplay = (0, import_child_process.spawn)("afplay", [...volumeArgs, filePath]);
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
  const tempFile = path.join(
    tempDir,
    `speech_${Date.now()}.${extensionForFormat(result.format)}`
  );
  fs.writeFileSync(tempFile, result.audio);
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
    (0, import_child_process.execSync)('pkill -f "say|afplay"', { stdio: "ignore" });
  } catch {
  }
}

// src/providers/system.ts
var PREFERRED_VOICES = [
  "Ava (Premium)",
  "Evan (Enhanced)",
  "Zoe (Premium)",
  "Samantha (Enhanced)",
  "Samantha"
];
var cachedVoices = null;
function getAvailableVoices() {
  if (cachedVoices) return cachedVoices;
  try {
    const output = (0, import_child_process2.execSync)('say -v "?"', { encoding: "utf-8" });
    cachedVoices = output.split("\n").filter((line) => line.trim()).map((line) => {
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
  const englishPremium = available.find(
    (v) => v.includes("(Premium)") && (v.includes("en_") || !v.includes("_"))
  );
  if (englishPremium) return englishPremium;
  const englishEnhanced = available.find(
    (v) => v.includes("(Enhanced)") && (v.includes("en_") || !v.includes("_"))
  );
  if (englishEnhanced) return englishEnhanced;
  return "Samantha";
}
var SystemProvider = class {
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
};
function runSay(args) {
  return new Promise((resolve, reject) => {
    const proc = (0, import_child_process2.spawn)("say", args);
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

// src/cache.ts
var path3 = __toESM(require("path"));
var fs3 = __toESM(require("fs"));
var import_uuid = require("uuid");

// src/cache-config.ts
function parseTTL(ttl) {
  if (typeof ttl === "number") return ttl;
  const units = {
    "ms": 1,
    "s": 1e3,
    "m": 60 * 1e3,
    "h": 60 * 60 * 1e3,
    "d": 24 * 60 * 60 * 1e3,
    "w": 7 * 24 * 60 * 60 * 1e3,
    "M": 30 * 24 * 60 * 60 * 1e3,
    "y": 365 * 24 * 60 * 60 * 1e3
  };
  const match = ttl.toString().match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (!(unit in units)) {
    throw new Error(`Invalid TTL unit: ${unit}. Use: ${Object.keys(units).join(", ")}`);
  }
  return value * units[unit];
}
function parseSize(size) {
  if (typeof size === "number") return size;
  const units = {
    "B": 1,
    "KB": 1024,
    "MB": 1024 * 1024,
    "GB": 1024 * 1024 * 1024,
    "b": 1,
    "kb": 1024,
    "mb": 1024 * 1024,
    "gb": 1024 * 1024 * 1024
  };
  const match = size.toString().match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match) throw new Error(`Invalid size format: ${size}`);
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (!(unit in units)) {
    throw new Error(`Invalid size unit: ${unit}. Use: ${Object.keys(units).join(", ")}`);
  }
  return value * units[unit];
}

// src/cache.ts
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
`;
var CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_provider ON entries(provider);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON entries(timestamp);
  CREATE INDEX IF NOT EXISTS idx_source ON entries(source);
  CREATE INDEX IF NOT EXISTS idx_user ON entries(user);
  CREATE INDEX IF NOT EXISTS idx_model ON entries(model);
  CREATE INDEX IF NOT EXISTS idx_success ON entries(success);
`;
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
    const { DatabaseSync } = require(specifier);
    return { db: wrapNodeDatabase(new DatabaseSync(dbPath)), backend: "node" };
  } catch {
  }
  try {
    const specifier = ["bun", "sqlite"].join(":");
    const { Database } = require(specifier);
    return { db: wrapBunDatabase(new Database(dbPath, { create: true })), backend: "bun" };
  } catch {
    return null;
  }
}
var TTSCache = class {
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
    this.maxSize = maxSize ? parseSize(maxSize) : void 0;
    this.logger = logger || this.createDefaultLogger();
    this.loadStats();
    this.logger.debug("Initializing TTSCache with dir:", this.cacheDir, "ttl:", ttl, "maxSize:", maxSize);
    if (!fs3.existsSync(this.cacheDir)) {
      this.logger.debug("Creating cache directory:", this.cacheDir);
      fs3.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.initializeStorage();
  }
  createDefaultLogger() {
    return {
      debug: () => {
      },
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
    if (!this.db || !fs3.existsSync(this.metadataFile)) return;
    try {
      const data = JSON.parse(fs3.readFileSync(this.metadataFile, "utf8"));
      const entries = Object.entries(data.entries || {});
      if (entries.length === 0) return;
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
    if (!this.db) return;
    const legacyMetadataPath = path3.join(this.cacheDir, "metadata.sqlite");
    const legacyKeyvPath = path3.join(this.cacheDir, "tts-cache.sqlite");
    this.importLegacyMetadataDb(legacyMetadataPath);
    this.importLegacyKeyvDb(legacyKeyvPath);
  }
  importStoredEntry(cacheKey, entry) {
    if (!this.db || this.getSqliteEntry(cacheKey)) return false;
    if (!entry.audioFilePath || !fs3.existsSync(entry.audioFilePath)) return false;
    this.upsertSqliteEntry(cacheKey, entry);
    return true;
  }
  importLegacyMetadataDb(legacyPath) {
    if (!this.db || !fs3.existsSync(legacyPath)) return;
    try {
      const legacy = openBuiltinSqlite(legacyPath);
      if (!legacy) return;
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
    if (!this.db || !fs3.existsSync(legacyPath)) return;
    try {
      const legacy = openBuiltinSqlite(legacyPath);
      if (!legacy) return;
      const rows = legacy.db.prepare("SELECT key, value FROM keyv").all();
      let imported = 0;
      for (const row of rows) {
        const cacheKey = row.key;
        if (this.getSqliteEntry(cacheKey)) continue;
        const parsed = JSON.parse(row.value);
        const entry = parsed.value;
        if (!entry || !this.isValidEntry(entry)) continue;
        if (parsed.expires && Date.now() > parsed.expires) continue;
        if (!fs3.existsSync(entry.audioFilePath)) continue;
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
    fs3.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs3.renameSync(tempFile, this.metadataFile);
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
      }, null, 2));
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
      expiresAt: row.expires_at == null ? void 0 : row.expires_at,
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
    return entry.expiresAt !== void 0 && Date.now() > entry.expiresAt;
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
    if (process.argv[1]?.includes("speakeasy-cli")) return "cli";
    if (process.env.NODE_ENV === "test") return "test";
    return "api";
  }
  getSessionId() {
    return `${Date.now()}-${process.pid}`;
  }
  upsertSqliteEntry(cacheKey, entry) {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (
        cache_key, original_text, provider, voice, rate, timestamp,
        file_size, file_path, expires_at, model, source, session_id,
        process_id, hostname, user, working_directory, command_line,
        duration_ms, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      cacheKey,
      entry.text,
      entry.provider,
      entry.voice,
      entry.rate,
      entry.timestamp,
      entry.fileSize,
      entry.audioFilePath,
      entry.expiresAt ?? null,
      entry.model ?? null,
      entry.source ?? null,
      entry.sessionId ?? null,
      entry.processId ?? null,
      entry.hostname ?? null,
      entry.user ?? null,
      entry.workingDirectory ?? null,
      entry.commandLine ?? null,
      entry.durationMs ?? null,
      entry.success === false ? 0 : 1,
      entry.errorMessage ?? null
    );
  }
  getSqliteEntry(cacheKey) {
    if (!this.db) return void 0;
    const row = this.db.prepare("SELECT * FROM entries WHERE cache_key = ?").get(cacheKey);
    return row ? this.rowToStoredEntry(row) : void 0;
  }
  deleteSqliteEntry(cacheKey) {
    if (!this.db) return;
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
    if (!this.maxSize) return;
    const entries = this.useJsonFallback ? Object.entries(this.jsonEntries).map(([cacheKey, entry]) => ({ cacheKey, entry })) : (this.db?.prepare("SELECT cache_key, file_size, timestamp FROM entries ORDER BY timestamp ASC").all() || []).map((row) => ({
      cacheKey: row.cache_key,
      entry: { fileSize: row.file_size }
    }));
    let totalSize = entries.reduce((sum, item) => sum + (item.entry.fileSize || 0), 0);
    if (totalSize <= this.maxSize) return;
    for (const item of entries) {
      if (totalSize <= this.maxSize) break;
      const entry = this.useJsonFallback ? this.jsonEntries[item.cacheKey] : this.getSqliteEntry(item.cacheKey);
      if (!entry) continue;
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
    if (options.minSize !== void 0) {
      where.push("file_size >= ?");
      params.push(options.minSize);
    }
    if (options.maxSize !== void 0) {
      where.push("file_size <= ?");
      params.push(options.maxSize);
    }
    if (options.success !== void 0) {
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
    if (options.limit !== void 0) {
      sql += " LIMIT ?";
      params.push(options.limit);
      if (options.offset !== void 0) {
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
    if (options.provider) results = results.filter((entry) => entry.provider === options.provider);
    if (options.model) results = results.filter((entry) => entry.model === options.model);
    if (options.source) results = results.filter((entry) => entry.source === options.source);
    if (options.fromDate) results = results.filter((entry) => entry.timestamp >= options.fromDate.getTime());
    if (options.toDate) results = results.filter((entry) => entry.timestamp <= options.toDate.getTime());
    if (options.minSize !== void 0) results = results.filter((entry) => entry.fileSize >= options.minSize);
    if (options.maxSize !== void 0) results = results.filter((entry) => entry.fileSize <= options.maxSize);
    if (options.success !== void 0) results = results.filter((entry) => entry.success === options.success);
    if (options.workingDirectory) {
      const needle = options.workingDirectory.toLowerCase();
      results = results.filter((entry) => entry.workingDirectory?.toLowerCase().includes(needle));
    }
    if (options.user) results = results.filter((entry) => entry.user === options.user);
    if (options.sessionId) results = results.filter((entry) => entry.sessionId === options.sessionId);
    if (options.offset) results = results.slice(options.offset);
    if (options.limit) results = results.slice(0, options.limit);
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
    return void 0;
  }
  async set(key, entry, audioBuffer, options) {
    try {
      const extension = options?.extension || detectAudioExtension(audioBuffer);
      const audioFilePath = path3.join(this.cacheDir, `${key}.${extension}`);
      fs3.writeFileSync(audioFilePath, audioBuffer);
      const timestamp = Date.now();
      const storedEntry = {
        ...entry,
        audioFilePath,
        timestamp,
        fileSize: audioBuffer.length,
        expiresAt: this.ttlMs ? timestamp + this.ttlMs : void 0,
        model: options?.model || this.inferModel(entry.provider, entry.voice),
        source: options?.source || this.getSource(),
        sessionId: this.getSessionId(),
        processId: process.pid.toString(),
        hostname: require("os").hostname(),
        user: require("os").userInfo().username,
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
    if (!this.db) return [];
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
      const cutoff = Date.now() - (maxAge || 7 * 24 * 60 * 60 * 1e3);
      if (this.useJsonFallback) {
        this.ensureMetadataLoaded();
        for (const [key, entry] of Object.entries(this.jsonEntries)) {
          if (entry.timestamp < cutoff) {
            this.deleteEntry(key, entry);
          }
        }
        return;
      }
      if (!this.db) return;
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
    return (0, import_uuid.v5)(keyData, "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
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
    if (this.useJsonFallback) return "json";
    return this.sqliteBackend || "json";
  }
};

// src/history.ts
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_uuid2 = require("uuid");
var CONFIG_DIR = path4.join(require("os").homedir(), ".config", "speakeasy");
var HISTORY_DIR = path4.join(CONFIG_DIR, "history");
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}
function getHistoryFile(date = /* @__PURE__ */ new Date()) {
  const { year, week } = getWeekNumber(date);
  const weekStr = week.toString().padStart(2, "0");
  return path4.join(HISTORY_DIR, `history-${year}-W${weekStr}.json`);
}
var NotificationHistory = class {
  entries = [];
  currentFile;
  constructor() {
    this.currentFile = getHistoryFile();
    this.ensureDir();
    this.load();
  }
  ensureDir() {
    if (!fs4.existsSync(HISTORY_DIR)) {
      fs4.mkdirSync(HISTORY_DIR, { recursive: true });
    }
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
    const newFile = getHistoryFile();
    if (newFile !== this.currentFile) {
      this.currentFile = newFile;
      this.entries = [];
    }
    try {
      this.ensureDir();
      fs4.writeFileSync(this.currentFile, JSON.stringify(this.entries, null, 2));
    } catch (error) {
      console.warn("Failed to save history:", error);
    }
  }
  add(entry) {
    const id = (0, import_uuid2.v4)();
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
  // Get all history across all week files (for UI display)
  getAllHistory() {
    const allEntries = [];
    try {
      if (!fs4.existsSync(HISTORY_DIR)) return allEntries;
      const files = fs4.readdirSync(HISTORY_DIR).filter((f) => f.startsWith("history-") && f.endsWith(".json")).sort().reverse();
      for (const file of files) {
        try {
          const data = fs4.readFileSync(path4.join(HISTORY_DIR, file), "utf8");
          const entries = JSON.parse(data);
          allEntries.push(...entries);
        } catch {
        }
      }
    } catch (error) {
      console.warn("Failed to read history files:", error);
    }
    return allEntries.sort((a, b) => b.timestamp - a.timestamp);
  }
  getHistoryDir() {
    return HISTORY_DIR;
  }
};
var historyInstance = null;
function getHistory() {
  if (!historyInstance) {
    historyInstance = new NotificationHistory();
  }
  return historyInstance;
}

// src/providers/openai.ts
var OpenAIProvider = class {
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
          throw new Error(
            "OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable."
          );
        }
        if (response.status === 429) {
          throw new Error(
            "OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency."
          );
        }
        throw new Error(
          `OpenAI API error: ${response.status}. Check your API key and rate limits.`
        );
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
          throw new Error(
            "OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable."
          );
        }
        if (response.status === 429) {
          throw new Error(
            "OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency."
          );
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
      return "\u{1F511} Invalid OpenAI API key. Get yours at: https://platform.openai.com/api-keys";
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
};

// src/providers/elevenlabs.ts
var ElevenLabsProvider = class {
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
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
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
        }
      );
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
          throw new Error(
            "ElevenLabs API error: Access forbidden - check your API key permissions"
          );
        }
        if (response.status === 422) {
          throw new Error(
            "ElevenLabs API error: Invalid voice ID or parameters - check your configuration"
          );
        }
        if (response.status === 404) {
          throw new Error(
            `ElevenLabs API error: Voice ID "${voiceId}" not found. Use a valid voice ID (e.g., EXAVITQu4vr4xnSDxMaL) not a voice name`
          );
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
      return "\u{1F511} Invalid ElevenLabs API key. Get yours at: https://elevenlabs.io/app/settings/api-keys";
    }
    if (message.includes("Access forbidden")) {
      return "\u{1F512} ElevenLabs access forbidden. Ensure your API key has TTS permissions";
    }
    if (message.includes("Rate limit")) {
      return '\u23F0 ElevenLabs rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    if (message.includes("not found")) {
      return '\u{1F50A} Invalid ElevenLabs voice ID. Use a voice ID like "EXAVITQu4vr4xnSDxMaL", not a name like "nova". Find voice IDs at: https://elevenlabs.io/app/voice-library';
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
};

// src/providers/groq.ts
var GroqProvider = class {
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
          throw new Error(
            `Groq API error: Bad request - ${errorBody || "check voice name and parameters"}`
          );
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
      return "\u{1F511} Invalid Groq API key. Get yours at: https://console.groq.com/keys";
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
};

// src/providers/gemini.ts
var GeminiProvider = class {
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
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
        }
      );
      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const error = JSON.parse(errorData);
          errorMessage = error.error?.message || errorMessage;
        } catch {
        }
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
        throw new Error(
          "Gemini API error: Invalid API key. Check your GEMINI_API_KEY environment variable."
        );
      }
      if (error.message?.includes("quota") || error.message?.includes("rate") || error.message?.includes("Rate limit")) {
        throw new Error(
          "Gemini API error: Rate limit exceeded. Try again later or reduce request frequency."
        );
      }
      if (error.message?.includes("model")) {
        throw new Error(
          `Gemini API error: Model '${this.model}' may not support audio generation. Try 'gemini-2.5-flash-preview-tts' or check available models.`
        );
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
      sampleRate: 24e3,
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
      return "\u{1F511} Invalid Gemini API key. Get yours at: https://aistudio.google.com/apikey";
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
};

// src/adapters/registry.ts
var PROVIDER_ORDER = [
  "system",
  "openai",
  "elevenlabs",
  "groq",
  "gemini"
];
function createAdapterRegistry(config) {
  const registry = /* @__PURE__ */ new Map();
  registry.set("system", new SystemProvider(config.systemVoice || getBestVoice()));
  registry.set(
    "openai",
    new OpenAIProvider(
      config.apiKeys?.openai || "",
      config.openaiVoice || "nova",
      config.instructions
    )
  );
  registry.set(
    "elevenlabs",
    new ElevenLabsProvider(
      config.apiKeys?.elevenlabs || "",
      config.elevenlabsVoiceId || "EXAVITQu4vr4xnSDxMaL"
    )
  );
  registry.set(
    "groq",
    new GroqProvider(config.apiKeys?.groq || "", config.groqVoice || "tara")
  );
  registry.set(
    "gemini",
    new GeminiProvider(
      config.apiKeys?.gemini || "",
      config.geminiModel || "gemini-2.5-flash-preview-tts"
    )
  );
  return registry;
}

// src/index.ts
var CONFIG_DIR2 = path5.join(require("os").homedir(), ".config", "speakeasy");
var CONFIG_FILE = path5.join(CONFIG_DIR2, "settings.json");
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
var API_KEY_HELP = {
  openai: "export OPENAI_API_KEY=your_key_here",
  elevenlabs: "export ELEVENLABS_API_KEY=your_key_here",
  groq: "export GROQ_API_KEY=your_key_here",
  gemini: "export GEMINI_API_KEY=your_key_here"
};
var API_KEY_URLS = {
  openai: "https://platform.openai.com/api-keys",
  elevenlabs: "https://elevenlabs.io/app/settings/api-keys",
  groq: "https://console.groq.com/keys",
  gemini: "https://makersuite.google.com/app/apikey"
};
var SpeakEasy = class {
  config;
  adapters;
  isPlaying = false;
  queue = [];
  cache;
  useCache = false;
  debug = false;
  hudEnabled = false;
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
      volume: config.volume !== void 0 ? config.volume : globalConfig.defaults?.volume !== void 0 ? globalConfig.defaults.volume : 0.7,
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
    if (this.queue.length === 0) return;
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
    if (this.debug) {
      console.log(`\u{1F50D} Requested provider: ${requestedId}`);
      console.log(`\u{1F50D} Text: "${text}"`);
      if (silent) console.log(`\u{1F507} Silent mode: audio will not be played`);
    }
    const requestedAdapter = this.adapters.get(requestedId);
    if (requestedId !== "system" && requestedAdapter && !requestedAdapter.validate()) {
      const providerName = requestedId.charAt(0).toUpperCase() + requestedId.slice(1);
      const envVarHelp = API_KEY_HELP[requestedId];
      throw new Error(
        `${providerName} API key is required.${envVarHelp ? ` Run: ${envVarHelp}` : ""}`
      );
    }
    let lastError = null;
    for (const providerId of PROVIDER_ORDER) {
      if (providerId !== requestedId && !lastError) continue;
      const adapter = this.adapters.get(providerId);
      if (!adapter?.validate()) continue;
      try {
        const request = this.buildRequest(text, providerId);
        if (this.debug) {
          console.log(`\u2705 Using provider: ${providerId}`);
          console.log(`\u{1F399}\uFE0F  Voice/model: ${request.voice}`);
          console.log(`\u26A1 Rate: ${request.rate} WPM`);
          console.log(`\u{1F50A} Volume: ${(request.volume * 100).toFixed(0)}%`);
        }
        if (this.useCache && adapter.capabilities.cacheable && this.cache) {
          const cacheKey = this.cache.generateCacheKey(
            text,
            providerId,
            request.voice,
            request.rate,
            adapter.capabilities.instructions ? request.instructions : void 0
          );
          const cachedEntry = await this.cache.get(cacheKey);
          if (cachedEntry) {
            console.log("(already cached)");
            if (this.debug) {
              console.log(`\u{1F4E6} Using cached audio from: ${cachedEntry.audioFilePath}`);
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
          const cacheKey = this.cache.generateCacheKey(
            text,
            providerId,
            request.voice,
            request.rate,
            adapter.capabilities.instructions ? request.instructions : void 0
          );
          await this.cache.set(
            cacheKey,
            {
              provider: providerId,
              voice: request.voice,
              rate: request.rate,
              text
            },
            result.audio,
            {
              model: result.model ?? providerId,
              durationMs: Date.now() - startTime,
              success: true,
              extension: result.format
            }
          );
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
        const helpUrl = lastError.message.includes("API key") ? API_KEY_URLS[requestedId] : void 0;
        throw new Error(
          `${providerName} failed: ${lastError.message}${helpUrl ? `
\u{1F4A1} Get your API key: ${helpUrl}` : ""}
\u{1F5E3}\uFE0F  Try: speakeasy --text "hello world" --provider system`
        );
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
      volume: this.config.volume !== void 0 ? this.config.volume : 0.7,
      tempDir: this.config.tempDir || "/tmp",
      apiKey: this.getApiKeyForProvider(providerId) || void 0,
      instructions: providerId === "openai" ? this.config.instructions : void 0
    };
  }
  printConfigDiagnostics() {
    console.log("\u{1F50D} Debug mode enabled");
    console.log("\u{1F4CA} Current Configuration:");
    console.log(`   Provider: ${this.config.provider}`);
    console.log(`   Rate: ${this.config.rate} WPM`);
    console.log(`   Volume: ${((this.config.volume || 0.7) * 100).toFixed(0)}%`);
    console.log(`   System Voice: ${this.config.systemVoice}`);
    console.log(`   OpenAI Voice: ${this.config.openaiVoice}`);
    console.log(`   ElevenLabs Voice: ${this.config.elevenlabsVoiceId}`);
    console.log(`   Gemini Model: ${this.config.geminiModel}`);
    if (this.config.instructions) {
      console.log(
        `   Instructions: "${this.config.instructions.substring(0, 50)}${this.config.instructions.length > 50 ? "..." : ""}"`
      );
    }
    console.log("\u{1F511} API Key Status:");
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
    console.log("\u{1F4E6} Cache Status:");
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
    if (!this.hudEnabled) return;
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
      throw new Error(
        "Cache is not enabled. Configure cache.enabled or use an API provider with keys present."
      );
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
};
var say = (text, provider) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text argument is required for say()");
  }
  return new SpeakEasy(provider ? { provider } : {}).speak(text);
};
var speak = (text, options) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text argument is required for speak()");
  }
  const { provider, volume, ...speakOptions } = options || {};
  const config = { provider, volume };
  return new SpeakEasy(config).speak(text, speakOptions);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIG_FILE,
  ElevenLabsProvider,
  GeminiProvider,
  GroqProvider,
  OpenAIProvider,
  PROVIDER_ORDER,
  SpeakEasy,
  SystemProvider,
  TTSCache,
  createAdapterRegistry,
  getAvailableVoices,
  getBestVoice,
  playAudioFile,
  playTTSResult,
  say,
  speak,
  stopPlayback
});
