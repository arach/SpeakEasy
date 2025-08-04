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
var src_exports = {};
__export(src_exports, {
  CONFIG_FILE: () => CONFIG_FILE,
  ElevenLabsProvider: () => ElevenLabsProvider,
  GroqProvider: () => GroqProvider,
  OpenAIProvider: () => OpenAIProvider,
  SpeakEasy: () => SpeakEasy,
  SystemProvider: () => SystemProvider,
  TTSCache: () => TTSCache,
  say: () => say,
  speak: () => speak
});
module.exports = __toCommonJS(src_exports);
var import_child_process5 = require("child_process");
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));

// src/providers/system.ts
var import_child_process = require("child_process");
var SystemProvider = class {
  voice;
  constructor(voice = "Samantha") {
    this.voice = voice;
  }
  async speak(config) {
    try {
      const volume = config.volume !== void 0 ? config.volume : 0.7;
      const tempFile = `${config.tempDir}/system_speech_${Date.now()}.aiff`;
      try {
        const sayCommand = `say -v ${this.voice} -r ${config.rate} -o "${tempFile}" "${config.text.replace(/"/g, '\\"')}"`;
        (0, import_child_process.execSync)(sayCommand);
        const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
        const playCommand = `afplay${volumeFlag} "${tempFile}"`;
        (0, import_child_process.execSync)(playCommand);
        const fs6 = require("fs");
        if (fs6.existsSync(tempFile)) {
          fs6.unlinkSync(tempFile);
        }
      } catch (error) {
        const fs6 = require("fs");
        if (fs6.existsSync(tempFile)) {
          fs6.unlinkSync(tempFile);
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`System TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return true;
  }
  getErrorMessage(error) {
    return `System voice failed: ${error.message}. Ensure 'say' command is available.`;
  }
};

// src/providers/openai.ts
var import_child_process2 = require("child_process");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_node_fetch = __toESM(require("node-fetch"));
var OpenAIProvider = class {
  apiKey;
  voice;
  constructor(apiKey = "", voice = "nova") {
    this.apiKey = apiKey;
    this.voice = voice;
  }
  async speak(config) {
    const audioBuffer = await this.generateAudio(config);
    if (audioBuffer) {
      const tempFile = path.join(config.tempDir, `speech_${Date.now()}.mp3`);
      fs.writeFileSync(tempFile, audioBuffer);
      const volume = config.volume !== void 0 ? config.volume : 0.7;
      const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
      (0, import_child_process2.execSync)(`afplay${volumeFlag} "${tempFile}"`);
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
  async generateAudio(config) {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }
    try {
      const response = await (0, import_node_fetch.default)("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: this.voice,
          input: config.text,
          speed: config.rate / 200
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.`);
        } else if (response.status === 429) {
          throw new Error(`OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.`);
        }
        throw new Error(`OpenAI API error: ${response.status}. Check your API key and rate limits.`);
      }
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`OpenAI TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  getErrorMessage(error) {
    if (error.message.includes("Invalid API key")) {
      return "\u{1F511} Invalid OpenAI API key. Get yours at: https://platform.openai.com/api-keys";
    }
    if (error.message.includes("Rate limit")) {
      return '\u23F0 OpenAI rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `OpenAI TTS failed: ${error.message}`;
  }
};

// src/providers/elevenlabs.ts
var import_child_process3 = require("child_process");
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var import_node_fetch2 = __toESM(require("node-fetch"));
var ElevenLabsProvider = class {
  apiKey;
  voiceId;
  constructor(apiKey = "", voiceId = "EXAVITQu4vr4xnSDxMaL") {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }
  async speak(config) {
    const audioBuffer = await this.generateAudio(config);
    if (audioBuffer) {
      const tempFile = path2.join(config.tempDir, `speech_${Date.now()}.mp3`);
      fs2.writeFileSync(tempFile, audioBuffer);
      const volume = config.volume !== void 0 ? config.volume : 0.7;
      const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
      (0, import_child_process3.execSync)(`afplay${volumeFlag} "${tempFile}"`);
      if (fs2.existsSync(tempFile)) {
        fs2.unlinkSync(tempFile);
      }
    }
  }
  async generateAudio(config) {
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key is required");
    }
    const BALANCED = 0.5;
    const NATURAL = 0.5;
    try {
      const response = await (0, import_node_fetch2.default)(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey
        },
        body: JSON.stringify({
          text: config.text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: BALANCED,
            similarity_boost: NATURAL
          }
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("ElevenLabs API error: Invalid API key");
        } else if (response.status === 429) {
          throw new Error("ElevenLabs API error: Rate limit exceeded");
        }
        if (response.status === 403) {
          throw new Error(`ElevenLabs API error: Access forbidden - check your API key permissions`);
        } else if (response.status === 422) {
          throw new Error(`ElevenLabs API error: Invalid voice ID or parameters - check your configuration`);
        }
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  getErrorMessage(error) {
    if (error.message.includes("Invalid API key")) {
      return "\u{1F511} Invalid ElevenLabs API key. Get yours at: https://elevenlabs.io/app/settings/api-keys";
    }
    if (error.message.includes("Access forbidden")) {
      return "\u{1F512} ElevenLabs access forbidden. Ensure your API key has TTS permissions";
    }
    if (error.message.includes("Rate limit")) {
      return '\u23F0 ElevenLabs rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `ElevenLabs TTS failed: ${error.message}`;
  }
};

// src/providers/groq.ts
var import_child_process4 = require("child_process");
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var import_node_fetch3 = __toESM(require("node-fetch"));
var GroqProvider = class {
  apiKey;
  voice;
  constructor(apiKey = "", voice = "Celeste-PlayAI") {
    this.apiKey = apiKey;
    this.voice = voice;
  }
  async speak(config) {
    const audioBuffer = await this.generateAudio(config);
    if (audioBuffer) {
      const tempFile = path3.join(config.tempDir, `speech_${Date.now()}.mp3`);
      fs3.writeFileSync(tempFile, audioBuffer);
      const volume = config.volume !== void 0 ? config.volume : 0.7;
      const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
      (0, import_child_process4.execSync)(`afplay${volumeFlag} "${tempFile}"`);
      if (fs3.existsSync(tempFile)) {
        fs3.unlinkSync(tempFile);
      }
    }
  }
  async generateAudio(config) {
    if (!this.apiKey) {
      throw new Error("Groq API key is required");
    }
    try {
      const response = await (0, import_node_fetch3.default)("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "playai-tts",
          voice: this.voice,
          input: config.text,
          speed: config.rate / 200
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Groq API error: Invalid API key");
        } else if (response.status === 429) {
          throw new Error("Groq API error: Rate limit exceeded");
        }
        throw new Error(`Groq API error: ${response.status}`);
      }
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`Groq TTS failed: ${error}`);
    }
  }
  validateConfig() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }
  getErrorMessage(error) {
    if (error.message.includes("Invalid API key")) {
      return "\u{1F511} Invalid Groq API key. Get yours at: https://console.groq.com/keys";
    }
    if (error.message.includes("Rate limit")) {
      return '\u23F0 Groq rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `Groq TTS failed: ${error.message}`;
  }
};

// src/cache.ts
var import_keyv = __toESM(require("keyv"));
var path4 = __toESM(require("path"));
var fs4 = __toESM(require("fs"));
var import_uuid = require("uuid");

// src/cache-config.ts
function parseTTL(ttl) {
  if (typeof ttl === "number")
    return ttl;
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
var TTSCache = class {
  cache;
  cacheDir;
  maxSize;
  logger;
  metadataDb;
  statsFile;
  cacheHits = 0;
  cacheMisses = 0;
  constructor(cacheDir, ttl = "7d", maxSize, logger) {
    this.cacheDir = cacheDir || path4.join("/tmp", "speakeasy-cache");
    this.logger = logger || this.createDefaultLogger();
    this.statsFile = path4.join(this.cacheDir, "stats.json");
    this.loadStats();
    this.logger.debug("Initializing TTSCache with dir:", this.cacheDir, "ttl:", ttl, "maxSize:", maxSize);
    if (!fs4.existsSync(this.cacheDir)) {
      this.logger.debug("Creating cache directory:", this.cacheDir);
      fs4.mkdirSync(this.cacheDir, { recursive: true });
    }
    const dbPath = path4.join(this.cacheDir, "tts-cache.sqlite");
    const metadataDbPath = path4.join(this.cacheDir, "metadata.sqlite");
    this.logger.debug("Database path:", dbPath);
    this.logger.debug("Metadata DB path:", metadataDbPath);
    try {
      const KeyvSqlite = require("@keyv/sqlite");
      this.cache = new import_keyv.default({ store: new KeyvSqlite(dbPath) });
      this.metadataDb = this.initializeMetadataDb(metadataDbPath);
      this.cache.opts.ttl = parseTTL(ttl);
      this.maxSize = maxSize ? parseSize(maxSize) : void 0;
    } catch (error) {
      this.logger.warn("SQLite not available, using in-memory cache:", error);
      this.cache = new import_keyv.default();
      this.metadataDb = null;
    }
  }
  initializeMetadataDb(dbPath) {
    try {
      const sqlite3 = require("better-sqlite3");
      const db = sqlite3(dbPath);
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS metadata (
          cache_key TEXT PRIMARY KEY,
          original_text TEXT NOT NULL,
          provider TEXT NOT NULL,
          voice TEXT NOT NULL,
          rate INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          file_size INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          model TEXT,
          source TEXT,
          session_id TEXT,
          process_id TEXT,
          hostname TEXT,
          user TEXT,
          working_directory TEXT,
          command_line TEXT,
          duration_ms INTEGER,
          success BOOLEAN DEFAULT TRUE,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      db.exec(createTableSQL);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_provider ON metadata(provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_timestamp ON metadata(timestamp)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_source ON metadata(source)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user ON metadata(user)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_model ON metadata(model)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_success ON metadata(success)`);
      this.logger.debug("Metadata database initialized successfully");
      return db;
    } catch (error) {
      this.logger.warn("Failed to initialize metadata database:", error);
      return null;
    }
  }
  createDefaultLogger() {
    return {
      debug: () => {
      },
      // No logging by default
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }
  async get(key) {
    try {
      const entry = await this.cache.get(key);
      if (entry && this.isValidEntry(entry)) {
        if (fs4.existsSync(entry.audioFilePath)) {
          this.cacheHits++;
          this.saveStats();
          return entry;
        } else {
          await this.delete(key);
        }
      }
    } catch (error) {
      console.warn("Cache retrieval error:", error);
    }
    this.cacheMisses++;
    this.saveStats();
    return void 0;
  }
  loadStats() {
    try {
      if (fs4.existsSync(this.statsFile)) {
        const data = fs4.readFileSync(this.statsFile, "utf8");
        const stats = JSON.parse(data);
        this.cacheHits = stats.cacheHits || 0;
        this.cacheMisses = stats.cacheMisses || 0;
      }
    } catch (error) {
      this.logger.warn("Error loading stats:", error);
    }
  }
  saveStats() {
    try {
      const stats = {
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        timestamp: Date.now()
      };
      fs4.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
      this.logger.warn("Error saving stats:", error);
    }
  }
  async set(key, entry, audioBuffer, options) {
    try {
      const audioFilePath = path4.join(this.cacheDir, `${key}.mp3`);
      fs4.writeFileSync(audioFilePath, audioBuffer);
      const timestamp = Date.now();
      const cacheEntry = {
        ...entry,
        audioFilePath,
        timestamp
      };
      const cacheResult = await this.cache.set(key, cacheEntry);
      const metadata = {
        cacheKey: key,
        originalText: entry.text,
        provider: entry.provider,
        voice: entry.voice,
        rate: entry.rate,
        timestamp,
        fileSize: audioBuffer.length,
        filePath: audioFilePath,
        // Enhanced metadata
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
      await this.addMetadata(metadata);
      this.logger.debug("Cache entry stored:", metadata);
      return cacheResult;
    } catch (error) {
      this.logger.warn("Cache storage error:", error);
      return false;
    }
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
    if (process.env.NODE_ENV === "test")
      return "test";
    return "api";
  }
  getSessionId() {
    return `${Date.now()}-${process.pid}`;
  }
  async addMetadata(metadata) {
    if (!this.metadataDb) {
      this.logger.warn("Metadata database not available");
      return;
    }
    try {
      const insertSQL = `
        INSERT OR REPLACE INTO metadata (
          cache_key, original_text, provider, voice, rate, timestamp,
          file_size, file_path, model, source, session_id, process_id,
          hostname, user, working_directory, command_line, duration_ms,
          success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const stmt = this.metadataDb.prepare(insertSQL);
      stmt.run(
        metadata.cacheKey,
        metadata.originalText,
        metadata.provider,
        metadata.voice,
        metadata.rate,
        metadata.timestamp,
        metadata.fileSize,
        metadata.filePath,
        metadata.model,
        metadata.source,
        metadata.sessionId,
        metadata.processId,
        metadata.hostname,
        metadata.user,
        metadata.workingDirectory,
        metadata.commandLine,
        metadata.durationMs,
        metadata.success ? 1 : 0,
        metadata.errorMessage
      );
      this.logger.debug("Metadata stored in SQLite:", metadata.cacheKey);
    } catch (error) {
      this.logger.warn("Metadata storage error:", error);
      throw error;
    }
  }
  async getMetadataFromDb(cacheKey) {
    if (!this.metadataDb)
      return null;
    try {
      const selectSQL = `
        SELECT * FROM metadata WHERE cache_key = ?
      `;
      const stmt = this.metadataDb.prepare(selectSQL);
      const row = stmt.get(cacheKey);
      if (!row)
        return null;
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
    } catch (error) {
      this.logger.warn("Metadata retrieval error:", error);
      return null;
    }
  }
  async deleteMetadata(cacheKey) {
    if (!this.metadataDb)
      return;
    try {
      const deleteSQL = `DELETE FROM metadata WHERE cache_key = ?`;
      const stmt = this.metadataDb.prepare(deleteSQL);
      stmt.run(cacheKey);
      this.logger.debug("Metadata deleted from SQLite:", cacheKey);
    } catch (error) {
      this.logger.warn("Metadata deletion error:", error);
      throw error;
    }
  }
  loadMetadataIndex() {
    if (!this.metadataDb)
      return [];
    try {
      const selectSQL = `SELECT * FROM metadata ORDER BY timestamp DESC`;
      const stmt = this.metadataDb.prepare(selectSQL);
      const rows = stmt.all();
      return rows.map((row) => ({
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
      }));
    } catch (error) {
      this.logger.warn("Error loading metadata index:", error);
      return [];
    }
  }
  async getCacheMetadata() {
    return this.search({});
  }
  async findByText(text) {
    return this.search({ text });
  }
  async findByProvider(provider) {
    return this.search({ provider });
  }
  async search(options = {}) {
    if (!this.metadataDb) {
      return this.loadMetadataIndex();
    }
    try {
      let whereConditions = [];
      let params = [];
      if (options.text) {
        whereConditions.push("original_text LIKE ?");
        params.push(`%${options.text}%`);
      }
      if (options.provider) {
        whereConditions.push("provider = ?");
        params.push(options.provider);
      }
      if (options.model) {
        whereConditions.push("model = ?");
        params.push(options.model);
      }
      if (options.source) {
        whereConditions.push("source = ?");
        params.push(options.source);
      }
      if (options.fromDate) {
        whereConditions.push("timestamp >= ?");
        params.push(options.fromDate.getTime());
      }
      if (options.toDate) {
        whereConditions.push("timestamp <= ?");
        params.push(options.toDate.getTime());
      }
      if (options.minSize !== void 0) {
        whereConditions.push("file_size >= ?");
        params.push(options.minSize);
      }
      if (options.maxSize !== void 0) {
        whereConditions.push("file_size <= ?");
        params.push(options.maxSize);
      }
      if (options.success !== void 0) {
        whereConditions.push("success = ?");
        params.push(options.success ? 1 : 0);
      }
      if (options.workingDirectory) {
        whereConditions.push("working_directory LIKE ?");
        params.push(`%${options.workingDirectory}%`);
      }
      if (options.user) {
        whereConditions.push("user = ?");
        params.push(options.user);
      }
      if (options.sessionId) {
        whereConditions.push("session_id = ?");
        params.push(options.sessionId);
      }
      let sql = "SELECT * FROM metadata";
      if (whereConditions.length > 0) {
        sql += " WHERE " + whereConditions.join(" AND ");
      }
      sql += " ORDER BY timestamp DESC";
      if (options.limit) {
        sql += " LIMIT ?";
        params.push(options.limit);
        if (options.offset) {
          sql += " OFFSET ?";
          params.push(options.offset);
        }
      }
      const stmt = this.metadataDb.prepare(sql);
      const rows = stmt.all(...params);
      return rows.map((row) => ({
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
      }));
    } catch (error) {
      this.logger.warn("Search error:", error);
      throw error;
    }
  }
  async getStats() {
    if (!this.metadataDb) {
      const metadata = this.loadMetadataIndex();
      return this.calculateStatsFromMetadata(metadata);
    }
    try {
      const countStmt = this.metadataDb.prepare("SELECT COUNT(*) as count, SUM(file_size) as total_size FROM metadata");
      const countResult = countStmt.get();
      if (!countResult || countResult.count === 0) {
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
      const dateStmt = this.metadataDb.prepare("SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest FROM metadata");
      const dateResult = dateStmt.get();
      const providerStmt = this.metadataDb.prepare("SELECT provider, COUNT(*) as count FROM metadata GROUP BY provider");
      const providerRows = providerStmt.all();
      const providers = {};
      providerRows.forEach((row) => {
        providers[row.provider] = row.count;
      });
      const modelStmt = this.metadataDb.prepare("SELECT model, COUNT(*) as count FROM metadata GROUP BY model");
      const modelRows = modelStmt.all();
      const models = {};
      modelRows.forEach((row) => {
        models[row.model || "unknown"] = row.count;
      });
      const sourceStmt = this.metadataDb.prepare("SELECT source, COUNT(*) as count FROM metadata GROUP BY source");
      const sourceRows = sourceStmt.all();
      const sources = {};
      sourceRows.forEach((row) => {
        sources[row.source || "unknown"] = row.count;
      });
      return {
        totalEntries: countResult.count,
        totalSize: countResult.total_size || 0,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        providers,
        models,
        sources,
        dateRange: {
          earliest: new Date(dateResult.earliest),
          latest: new Date(dateResult.latest)
        },
        avgFileSize: (countResult.total_size || 0) / countResult.count,
        hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
      };
    } catch (error) {
      this.logger.warn("Stats error:", error);
      const metadata = this.loadMetadataIndex();
      return this.calculateStatsFromMetadata(metadata);
    }
  }
  calculateStatsFromMetadata(metadata) {
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
        earliest: new Date(Math.min(...metadata.map((e) => e.timestamp))),
        latest: new Date(Math.max(...metadata.map((e) => e.timestamp)))
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
  async getRecent(limit = 10) {
    if (!this.metadataDb) {
      const metadata = this.loadMetadataIndex();
      return metadata.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }
    try {
      const sql = `SELECT * FROM metadata ORDER BY timestamp DESC LIMIT ?`;
      const stmt = this.metadataDb.prepare(sql);
      const rows = stmt.all(limit);
      return rows.map((row) => ({
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
      }));
    } catch (error) {
      this.logger.warn("Recent error:", error);
      throw error;
    }
  }
  async delete(key) {
    try {
      const entry = await this.cache.get(key);
      if (entry && entry.audioFilePath) {
        if (fs4.existsSync(entry.audioFilePath)) {
          fs4.unlinkSync(entry.audioFilePath);
        }
      }
      if (this.metadataDb) {
        try {
          const deleteSQL = `DELETE FROM metadata WHERE cache_key = ?`;
          const stmt = this.metadataDb.prepare(deleteSQL);
          stmt.run(key);
          this.logger.debug("Metadata deleted from SQLite:", key);
        } catch (error) {
          this.logger.warn("Metadata deletion error:", error);
        }
      }
      return await this.cache.delete(key);
    } catch (error) {
      console.warn("Cache deletion error:", error);
      return false;
    }
  }
  async clear() {
    try {
      const files = fs4.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".mp3")) {
          fs4.unlinkSync(path4.join(this.cacheDir, file));
        }
      }
      if (this.metadataDb) {
        try {
          this.metadataDb.exec("DELETE FROM metadata");
          this.logger.debug("Metadata table cleared");
        } catch (error) {
          this.logger.warn("Error clearing metadata table:", error);
        }
      }
      await this.cache.clear();
    } catch (error) {
      console.warn("Cache clear error:", error);
    }
  }
  async cleanup(maxAge) {
    try {
      const cutoff = Date.now() - (maxAge || 7 * 24 * 60 * 60 * 1e3);
      if (this.metadataDb) {
        try {
          const selectStmt = this.metadataDb.prepare("SELECT cache_key, file_path FROM metadata WHERE timestamp < ?");
          const oldEntries = selectStmt.all(cutoff);
          for (const entry of oldEntries) {
            if (fs4.existsSync(entry.file_path)) {
              fs4.unlinkSync(entry.file_path);
            }
          }
          const deleteStmt = this.metadataDb.prepare("DELETE FROM metadata WHERE timestamp < ?");
          deleteStmt.run(cutoff);
          for (const entry of oldEntries) {
            await this.cache.delete(entry.cache_key);
          }
          this.logger.debug(`Cleaned up ${oldEntries.length} old cache entries`);
        } catch (error) {
          this.logger.warn("SQLite cleanup error:", error);
          await this.cleanupFileBased(cutoff);
        }
      } else {
        await this.cleanupFileBased(cutoff);
      }
    } catch (error) {
      console.warn("Cache cleanup error:", error);
    }
  }
  async cleanupFileBased(cutoff) {
    try {
      const files = fs4.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".mp3")) {
          const filePath = path4.join(this.cacheDir, file);
          const stats = fs4.statSync(filePath);
          if (stats.mtime.getTime() < cutoff) {
            fs4.unlinkSync(filePath);
            const key = file.replace(".mp3", "");
            await this.cache.delete(key);
          }
        }
      }
    } catch (error) {
      console.warn("File-based cleanup error:", error);
    }
  }
  isValidEntry(entry) {
    return entry && typeof entry.audioFilePath === "string" && typeof entry.provider === "string" && typeof entry.voice === "string" && typeof entry.rate === "number" && typeof entry.timestamp === "number" && typeof entry.text === "string";
  }
  generateCacheKey(text, provider, voice, rate) {
    const normalizedText = text.trim().toLowerCase();
    const keyData = `${normalizedText}|${provider}|${voice}|${rate}`;
    return (0, import_uuid.v5)(keyData, "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  }
  getCacheDir() {
    return this.cacheDir;
  }
};

// src/index.ts
var CONFIG_DIR = path5.join(require("os").homedir(), ".config", "speakeasy");
var CONFIG_FILE = path5.join(CONFIG_DIR, "settings.json");
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
var SpeakEasy = class {
  config;
  providers;
  isPlaying = false;
  queue = [];
  cache;
  useCache = false;
  debug = false;
  constructor(config) {
    const globalConfig = loadGlobalConfig();
    this.config = {
      provider: config.provider || globalConfig.defaults?.provider || "system",
      systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || "Samantha",
      openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || "nova",
      elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.providers?.elevenlabs?.voiceId || "EXAVITQu4vr4xnSDxMaL",
      rate: config.rate || globalConfig.defaults?.rate || 180,
      volume: config.volume !== void 0 ? config.volume : globalConfig.defaults?.volume !== void 0 ? globalConfig.defaults.volume : 0.7,
      debug: config.debug || false,
      apiKeys: {
        openai: config.apiKeys?.openai || globalConfig.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || "",
        elevenlabs: config.apiKeys?.elevenlabs || globalConfig.providers?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY || "",
        groq: config.apiKeys?.groq || globalConfig.providers?.groq?.apiKey || process.env.GROQ_API_KEY || ""
      },
      tempDir: config.tempDir || globalConfig.global?.tempDir || "/tmp"
    };
    const cacheConfig = config.cache || globalConfig.cache;
    const hasApiKeys = !!(this.config.apiKeys?.openai || this.config.apiKeys?.elevenlabs || this.config.apiKeys?.groq);
    const cacheEnabled = cacheConfig?.enabled ?? (hasApiKeys && this.config.provider !== "system");
    this.useCache = cacheEnabled;
    if (this.useCache) {
      const cacheDir = cacheConfig?.dir || path5.join(this.config.tempDir || "/tmp", "speakeasy-cache");
      this.cache = new TTSCache(
        cacheDir,
        cacheConfig?.ttl || "7d",
        cacheConfig?.maxSize
      );
    }
    this.providers = /* @__PURE__ */ new Map();
    this.initializeProviders();
    this.debug = this.config.debug || false;
    if (this.debug) {
      this.printConfigDiagnostics();
    }
  }
  initializeProviders() {
    this.providers.set("system", new SystemProvider(this.config.systemVoice || "Samantha"));
    this.providers.set("openai", new OpenAIProvider(this.config.apiKeys?.openai || "", this.config.openaiVoice || "nova"));
    this.providers.set("elevenlabs", new ElevenLabsProvider(this.config.apiKeys?.elevenlabs || "", this.config.elevenlabsVoiceId || "EXAVITQu4vr4xnSDxMaL"));
    this.providers.set("groq", new GroqProvider(this.config.apiKeys?.groq || ""));
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
      await this.speakText(text);
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
  async speakText(text) {
    const requestedProvider = this.config.provider || "system";
    if (this.debug) {
      console.log(`\u{1F50D} Requested provider: ${requestedProvider}`);
      console.log(`\u{1F50D} Text: "${text}"`);
    }
    const requestedProviderInstance = this.providers.get(requestedProvider);
    if (requestedProvider !== "system" && requestedProviderInstance) {
      if (!requestedProviderInstance.validateConfig()) {
        const providerName = requestedProvider.charAt(0).toUpperCase() + requestedProvider.slice(1);
        let envVarHelp = "";
        switch (requestedProvider) {
          case "openai":
            envVarHelp = "export OPENAI_API_KEY=your_key_here";
            break;
          case "elevenlabs":
            envVarHelp = "export ELEVENLABS_API_KEY=your_key_here";
            break;
          case "groq":
            envVarHelp = "export GROQ_API_KEY=your_key_here";
            break;
        }
        throw new Error(
          `${providerName} API key is required. ${envVarHelp ? `Run: ${envVarHelp}` : ""}`
        );
      }
    }
    const providers = ["system", "openai", "elevenlabs", "groq"];
    let lastError = null;
    for (const providerName of providers) {
      if (providerName === requestedProvider || lastError) {
        try {
          const provider = this.providers.get(providerName);
          if (provider && provider.validateConfig()) {
            const voice = this.getVoiceForProvider(providerName);
            const rate = this.config.rate || 180;
            const volume = this.config.volume !== void 0 ? this.config.volume : 0.7;
            const tempDir = this.config.tempDir || "/tmp";
            if (this.debug) {
              console.log(`\u2705 Using provider: ${providerName}`);
              console.log(`\u{1F399}\uFE0F  Voice/model: ${voice}`);
              console.log(`\u26A1 Rate: ${rate} WPM`);
              console.log(`\u{1F50A} Volume: ${(volume * 100).toFixed(0)}%`);
            }
            if (this.useCache && providerName !== "system" && this.cache) {
              const cacheKey = this.cache.generateCacheKey(text, providerName, voice, rate);
              const cachedEntry = await this.cache.get(cacheKey);
              if (cachedEntry) {
                if (this.debug) {
                  console.log(`\u{1F4E6} Using cached audio from: ${cachedEntry.audioFilePath}`);
                }
                await this.playCachedAudio(cachedEntry.audioFilePath);
                return;
              }
            }
            let audioBuffer = null;
            if (providerName === "system") {
              if (this.debug) {
                console.log(`\u{1F399}\uFE0F  Using system voice: ${voice}`);
              }
              await provider.speak({
                text,
                rate,
                tempDir,
                voice,
                volume,
                apiKey: this.getApiKeyForProvider(providerName) || ""
              });
              return;
            } else {
              const generateMethod = provider.generateAudio;
              if (generateMethod) {
                audioBuffer = await generateMethod.call(provider, {
                  text,
                  rate,
                  tempDir,
                  voice,
                  volume,
                  apiKey: this.getApiKeyForProvider(providerName) || ""
                });
              } else {
                await provider.speak({
                  text,
                  rate,
                  tempDir,
                  voice,
                  volume,
                  apiKey: this.getApiKeyForProvider(providerName) || ""
                });
                return;
              }
            }
            if (this.useCache && providerName !== "system" && this.cache && audioBuffer) {
              const cacheKey = this.cache.generateCacheKey(text, providerName, voice, rate);
              const startTime = Date.now();
              await this.cache.set(cacheKey, {
                provider: providerName,
                voice,
                rate,
                text
              }, audioBuffer, {
                model: this.inferModel(providerName),
                durationMs: Date.now() - startTime,
                success: true
              });
              const tempFile = path5.join(tempDir, `speech_${Date.now()}.mp3`);
              fs5.writeFileSync(tempFile, audioBuffer);
              const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
              (0, import_child_process5.execSync)(`afplay${volumeFlag} "${tempFile}"`);
              if (fs5.existsSync(tempFile)) {
                fs5.unlinkSync(tempFile);
              }
            } else if (audioBuffer) {
              const tempFile = path5.join(tempDir, `speech_${Date.now()}.mp3`);
              if (this.debug) {
                console.log(`\u{1F3B5} Playing generated audio: ${tempFile}`);
              }
              fs5.writeFileSync(tempFile, audioBuffer);
              const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
              (0, import_child_process5.execSync)(`afplay${volumeFlag} "${tempFile}"`);
              if (fs5.existsSync(tempFile)) {
                fs5.unlinkSync(tempFile);
              }
            }
            return;
          }
        } catch (error) {
          console.warn(`${providerName} provider failed:`, error);
          lastError = error;
          continue;
        }
      }
    }
    if (lastError) {
      if (requestedProvider !== "system") {
        const providerName = requestedProvider.charAt(0).toUpperCase() + requestedProvider.slice(1);
        let helpText = "";
        if (lastError.message.includes("API key")) {
          switch (requestedProvider) {
            case "openai":
              helpText = "Get your API key: https://platform.openai.com/api-keys";
              break;
            case "elevenlabs":
              helpText = "Get your API key: https://elevenlabs.io/app/settings/api-keys";
              break;
            case "groq":
              helpText = "Get your API key: https://console.groq.com/keys";
              break;
          }
        }
        throw new Error(
          `${providerName} failed: ${lastError.message}${helpText ? `
\u{1F4A1} ${helpText}` : ""}
\u{1F5E3}\uFE0F  Try: speakeasy --text "hello world" --provider system`
        );
      }
      throw new Error(`All providers failed. Last error: ${lastError.message}`);
    }
    const systemProvider = this.providers.get("system");
    if (systemProvider) {
      try {
        if (this.debug) {
          console.log(`\u{1F5E3}\uFE0F  Falling back to system voice: ${this.config.systemVoice || "Samantha"}`);
        }
        await systemProvider.speak({
          text,
          rate: this.config.rate || 180,
          tempDir: this.config.tempDir || "/tmp",
          voice: this.config.systemVoice || "Samantha",
          volume: this.config.volume !== void 0 ? this.config.volume : 0.7
        });
      } catch (error) {
        throw new Error(`System voice failed: ${error}. Ensure you're on macOS.`);
      }
    }
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
    console.log("\u{1F511} API Key Status:");
    const providers = [
      { name: "OpenAI", key: "openai", env: "OPENAI_API_KEY" },
      { name: "ElevenLabs", key: "elevenlabs", env: "ELEVENLABS_API_KEY" },
      { name: "Groq", key: "groq", env: "GROQ_API_KEY" }
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
  async playCachedAudio(audioFilePath) {
    const { execSync: execSync6 } = require("child_process");
    const volume = this.config.volume !== void 0 ? this.config.volume : 0.7;
    const volumeFlag = volume !== 1 ? ` -v ${volume}` : "";
    execSync6(`afplay${volumeFlag} "${audioFilePath}"`, { stdio: "inherit" });
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
        return "Celeste-PlayAI";
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
      default:
        return "";
    }
  }
  inferModel(provider) {
    switch (provider) {
      case "openai":
        return "tts-1";
      case "elevenlabs":
        return "eleven_multilingual_v2";
      case "groq":
        return "tts-1-hd";
      case "system":
        return "macOS-system";
      default:
        return provider;
    }
  }
  stopSpeaking() {
    try {
      (0, import_child_process5.execSync)('pkill -f "say|afplay"', { stdio: "ignore" });
    } catch (error) {
    }
  }
  getCacheStats() {
    return Promise.resolve({
      size: 0,
      // Keyv doesn't provide easy way to get size
      dir: this.cache?.getCacheDir()
    });
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
  GroqProvider,
  OpenAIProvider,
  SpeakEasy,
  SystemProvider,
  TTSCache,
  say,
  speak
});
