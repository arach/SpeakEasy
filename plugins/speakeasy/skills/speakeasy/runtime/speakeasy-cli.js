#!/usr/bin/env node
// @bun
var __defProp = Object.defineProperty;
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

// node_modules/uuid/dist-node/rng.js
function rng() {
  return crypto.getRandomValues(rnds8);
}
var rnds8;
var init_rng = __esm(() => {
  rnds8 = new Uint8Array(16);
});

// node_modules/uuid/dist-node/regex.js
var regex_default;
var init_regex = __esm(() => {
  regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
});

// node_modules/uuid/dist-node/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default;
var init_validate = __esm(() => {
  init_regex();
  validate_default = validate;
});

// node_modules/uuid/dist-node/stringify.js
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

// node_modules/uuid/dist-node/v4.js
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

// node_modules/uuid/dist-node/sha1.js
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

// node_modules/uuid/dist-node/parse.js
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

// node_modules/uuid/dist-node/v35.js
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

// node_modules/uuid/dist-node/v5.js
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

// node_modules/uuid/dist-node/index.js
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

// package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "@arach/speakeasy",
    version: "0.2.16",
    description: "Convenient TTS CLI for Mac \u2014 centralized credentials + configurable caching so all your apps and agents can speak.",
    homepage: "https://speakeasy.arach.dev",
    repository: {
      type: "git",
      url: "https://github.com/arach/SpeakEasy.git"
    },
    bugs: {
      url: "https://github.com/arach/SpeakEasy/issues"
    },
    private: false,
    main: "dist/index.js",
    types: "dist/index.d.ts",
    files: [
      "dist"
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
      prepublishOnly: "pnpm run build && rm -f dist/test.js dist/test.d.ts dist/test.js.map dist/test.d.ts.map",
      dev: "tsc --watch",
      test: "node dist/test.js",
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
      chalk: "^5.6.2",
      commander: "^15.0.0",
      uuid: "^14.0.1",
      zod: "^3.25.76"
    },
    devDependencies: {
      "@arach/dewey": "^0.2.0",
      "@types/node": "^22.0.0",
      tsup: "^8.5.1",
      typescript: "^5.9.3"
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

// src/index.ts
import * as fs5 from "fs";
import * as path5 from "path";

// src/providers/system.ts
import { execSync as execSync2, spawn as spawn2 } from "child_process";
import * as fs2 from "fs";
import * as path2 from "path";

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
import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// src/hud.ts
import { openSync, writeSync, closeSync, constants } from "fs";
import { existsSync, statSync } from "fs";
var HUD_PIPE_PATH = "/tmp/speakeasy-hud.fifo";
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

// src/adapters/audio.ts
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

// src/index.ts
init_cache();

// src/history.ts
init_dist_node();
import * as fs4 from "fs";
import * as path4 from "path";
var CONFIG_DIR = path4.join(__require("os").homedir(), ".config", "speakeasy");
var HISTORY_DIR = path4.join(CONFIG_DIR, "history");
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
var historyInstance = null;
function getHistory() {
  if (!historyInstance) {
    historyInstance = new NotificationHistory;
  }
  return historyInstance;
}

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

// src/adapters/registry.ts
var PROVIDER_ORDER = [
  "system",
  "openai",
  "elevenlabs",
  "groq",
  "gemini"
];
function createAdapterRegistry(config) {
  const registry = new Map;
  registry.set("system", new SystemProvider(config.systemVoice || getBestVoice()));
  registry.set("openai", new OpenAIProvider(config.apiKeys?.openai || "", config.openaiVoice || "nova", config.instructions));
  registry.set("elevenlabs", new ElevenLabsProvider(config.apiKeys?.elevenlabs || "", config.elevenlabsVoiceId || "EXAVITQu4vr4xnSDxMaL"));
  registry.set("groq", new GroqProvider(config.apiKeys?.groq || "", config.groqVoice || "tara"));
  registry.set("gemini", new GeminiProvider(config.apiKeys?.gemini || "", config.geminiModel || "gemini-2.5-flash-preview-tts"));
  return registry;
}

// src/index.ts
init_cache();
var CONFIG_DIR2 = path5.join(__require("os").homedir(), ".config", "speakeasy");
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

class SpeakEasy {
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
          await this.cache.set(cacheKey, {
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

// src/cli/constants.ts
import * as path6 from "path";
import { homedir } from "os";
var CONFIG_DIR3 = path6.join(homedir(), ".config", "speakeasy");
var CONFIG_FILE2 = path6.join(CONFIG_DIR3, "settings.json");
var PROVIDERS = [
  { name: "OpenAI", key: "openai", env: "OPENAI_API_KEY" },
  { name: "ElevenLabs", key: "elevenlabs", env: "ELEVENLABS_API_KEY" },
  { name: "Groq", key: "groq", env: "GROQ_API_KEY" },
  { name: "Gemini", key: "gemini", env: "GEMINI_API_KEY" }
];
var DEFAULT_VOICES = {
  system: "Samantha",
  openai: "nova",
  elevenlabs: "EXAVITQu4vr4xnSDxMaL",
  groq: "tara",
  gemini: "gemini-2.5-flash-preview-tts"
};
var DEFAULTS = {
  rate: 180,
  volume: 0.7,
  provider: "system"
};
var getPackageVersion = () => {
  try {
    const pkg = require_package();
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};

// node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
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
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
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
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "process";
import os from "os";
import tty from "tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = process2;
var flagForceColor;
if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
  flagForceColor = 0;
} else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
  flagForceColor = 1;
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
var supportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) })
};
var supports_color_default = supportsColor;

// node_modules/chalk/source/utilities.js
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

// node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === undefined ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk = (...strings) => strings.join(" ");
  applyOptions(chalk, options);
  Object.setPrototypeOf(chalk, createChalk.prototype);
  return chalk;
};
function createChalk(options) {
  return chalkFactory(options);
}
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
var getModelAnsi = (model, level, type, ...arguments_) => {
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
};
var usedModels = ["rgb", "hex", "ansi256"];
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
var proto = Object.defineProperties(() => {}, {
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
var createStyler = (open, close, parent) => {
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
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
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
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// src/cli/ui.ts
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
   \u2022 System Voices - macOS, Windows, Linux (no key needed)
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
import * as fs8 from "fs";
import * as path8 from "path";
import { execSync as execSync4 } from "child_process";
init_cache();
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
import { randomUUID } from "crypto";
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
  const stagingPath = path9.join(APP_DIR, `.SpeakEasy.app.installing-${randomUUID()}`);
  const backupPath = path9.join(APP_DIR, `.SpeakEasy.app.backup-${randomUUID()}`);
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

// node_modules/commander/lib/error.js
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

// node_modules/commander/lib/argument.js
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

// node_modules/commander/lib/command.js
import { EventEmitter } from "events";
import childProcess from "child_process";
import path10 from "path";
import fs10 from "fs";
import process3 from "process";
import { stripVTControlCharacters as stripVTControlCharacters2 } from "util";

// node_modules/commander/lib/help.js
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

// node_modules/commander/lib/option.js
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

// node_modules/commander/lib/suggestSimilar.js
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

// node_modules/commander/lib/command.js
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

// node_modules/commander/index.js
var program = new Command;

// node_modules/zod/v3/external.js
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

// node_modules/zod/v3/helpers/util.js
var util;
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
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
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
var getParsedType = (data) => {
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

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
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
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};

class ZodError extends Error {
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
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
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
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
// node_modules/zod/v3/helpers/parseUtil.js
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
};
var EMPTY_PATH = [];
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
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
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
};
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
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
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

class ZodString extends ZodType {
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
}
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}

class ZodNumber extends ZodType {
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
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};

class ZodBigInt extends ZodType {
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
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};

class ZodBoolean extends ZodType {
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
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};

class ZodDate extends ZodType {
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
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};

class ZodSymbol extends ZodType {
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
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};

class ZodUndefined extends ZodType {
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
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};

class ZodNull extends ZodType {
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
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};

class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};

class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};

class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};

class ZodVoid extends ZodType {
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
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};

class ZodArray extends ZodType {
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
}
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

class ZodObject extends ZodType {
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
}
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

class ZodUnion extends ZodType {
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
}
ZodUnion.create = (types3, params) => {
  return new ZodUnion({
    options: types3,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
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
};

class ZodDiscriminatedUnion extends ZodType {
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

class ZodIntersection extends ZodType {
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
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};

class ZodTuple extends ZodType {
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
}
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

class ZodRecord extends ZodType {
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
}

class ZodMap extends ZodType {
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
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};

class ZodSet extends ZodType {
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
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};

class ZodFunction extends ZodType {
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
}

class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};

class ZodLiteral extends ZodType {
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
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}

class ZodEnum extends ZodType {
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
}
ZodEnum.create = createZodEnum;

class ZodNativeEnum extends ZodType {
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
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};

class ZodPromise extends ZodType {
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
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};

class ZodEffects extends ZodType {
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
}
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
class ZodOptional extends ZodType {
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
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};

class ZodNullable extends ZodType {
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
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};

class ZodDefault extends ZodType {
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
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};

class ZodCatch extends ZodType {
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
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};

class ZodNaN extends ZodType {
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
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");

class ZodBranded extends ZodType {
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
}

class ZodPipeline extends ZodType {
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
}

class ZodReadonly extends ZodType {
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
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
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
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
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
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;
// src/cli/args.ts
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
async function run() {
  if (process.argv.length <= 2) {
    showHelp();
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
    const errorMessage = error.message;
    const errorMsg = errorMessage.toLowerCase();
    console.error("\u274C Error:", errorMessage);
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
  run().catch(console.error);
}
