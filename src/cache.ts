import * as path from 'path';
import * as fs from 'fs';
import { v5 as uuidv5 } from 'uuid';
import { parseTTL, parseSize } from './cache-config';

interface CacheLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export interface CacheEntry {
  audioFilePath: string;
  provider: string;
  voice: string;
  rate: number;
  timestamp: number;
  text: string;
}

export interface CacheMetadata {
  cacheKey: string;
  originalText: string;
  provider: string;
  voice: string;
  rate: number;
  timestamp: number;
  fileSize: number;
  filePath: string;
  model?: string;
  source?: string;
  sessionId?: string;
  processId?: string;
  hostname?: string;
  user?: string;
  workingDirectory?: string;
  commandLine?: string;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  cacheHits: number;
  cacheMisses: number;
  providers: Record<string, number>;
  models: Record<string, number>;
  sources: Record<string, number>;
  dateRange: { earliest: Date; latest: Date } | null;
  avgFileSize: number;
  hitRate: number;
}

interface StoredEntry extends CacheEntry {
  fileSize: number;
  expiresAt?: number;
  model?: string;
  source?: string;
  sessionId?: string;
  processId?: string;
  hostname?: string;
  user?: string;
  workingDirectory?: string;
  commandLine?: string;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

interface MetadataStore {
  version: 1;
  entries: Record<string, StoredEntry>;
}

interface SqliteStatement {
  run: (...args: unknown[]) => void;
  get: (...args: unknown[]) => Record<string, unknown> | undefined;
  all: (...args: unknown[]) => Record<string, unknown>[];
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

const CREATE_ENTRIES_TABLE = `
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

const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_provider ON entries(provider);
  CREATE INDEX IF NOT EXISTS idx_timestamp ON entries(timestamp);
  CREATE INDEX IF NOT EXISTS idx_source ON entries(source);
  CREATE INDEX IF NOT EXISTS idx_user ON entries(user);
  CREATE INDEX IF NOT EXISTS idx_model ON entries(model);
  CREATE INDEX IF NOT EXISTS idx_success ON entries(success);
`;

type SqliteBackend = 'node' | 'bun';

function wrapNodeDatabase(db: SqliteDatabase): SqliteDatabase {
  return db;
}

function wrapBunDatabase(db: {
  run: (sql: string, ...args: unknown[]) => unknown;
  query: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => Record<string, unknown> | undefined;
    all: (...args: unknown[]) => Record<string, unknown>[];
  };
}): SqliteDatabase {
  return {
    exec: (sql: string) => {
      db.run(sql);
    },
    prepare: (sql: string) => {
      const statement = db.query(sql);
      return {
        run: (...args: unknown[]) => {
          statement.run(...args);
        },
        get: (...args: unknown[]) => statement.get(...args),
        all: (...args: unknown[]) => statement.all(...args),
      };
    },
  };
}

function detectAudioExtension(buffer: Buffer): 'mp3' | 'wav' {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    return 'wav';
  }
  if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return 'mp3';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return 'mp3';
  }
  return 'mp3';
}

function openBuiltinSqlite(dbPath: string): { db: SqliteDatabase; backend: SqliteBackend } | null {
  try {
    const specifier = ['node', 'sqlite'].join(':');
    const { DatabaseSync } = require(specifier) as { DatabaseSync: new (path: string) => SqliteDatabase };
    return { db: wrapNodeDatabase(new DatabaseSync(dbPath)), backend: 'node' };
  } catch {
    // node:sqlite is Node 22.5+ only
  }

  try {
    const specifier = ['bun', 'sqlite'].join(':');
    const { Database } = require(specifier) as {
      Database: new (path: string, options?: { create?: boolean }) => {
        run: (sql: string, ...args: unknown[]) => unknown;
        query: (sql: string) => {
          run: (...args: unknown[]) => unknown;
          get: (...args: unknown[]) => Record<string, unknown> | undefined;
          all: (...args: unknown[]) => Record<string, unknown>[];
        };
      };
    };
    return { db: wrapBunDatabase(new Database(dbPath, { create: true })), backend: 'bun' };
  } catch {
    return null;
  }
}

export class TTSCache {
  private cacheDir: string;
  private dbPath: string;
  private metadataFile: string;
  private statsFile: string;
  private ttlMs: number;
  private maxSize?: number;
  private logger: CacheLogger;
  private db: SqliteDatabase | null = null;
  private sqliteBackend: SqliteBackend | null = null;
  private jsonEntries: Record<string, StoredEntry> = {};
  private useJsonFallback = false;
  private metadataLoaded = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(cacheDir: string, ttl: string | number = '7d', maxSize?: string | number, logger?: CacheLogger) {
    this.cacheDir = cacheDir || path.join('/tmp', 'speakeasy-cache');
    this.dbPath = path.join(this.cacheDir, 'cache.sqlite');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.statsFile = path.join(this.cacheDir, 'stats.json');
    this.ttlMs = parseTTL(ttl);
    this.maxSize = maxSize ? parseSize(maxSize) : undefined;
    this.logger = logger || this.createDefaultLogger();

    this.loadStats();
    this.logger.debug('Initializing TTSCache with dir:', this.cacheDir, 'ttl:', ttl, 'maxSize:', maxSize);

    if (!fs.existsSync(this.cacheDir)) {
      this.logger.debug('Creating cache directory:', this.cacheDir);
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.initializeStorage();
  }

  private createDefaultLogger(): CacheLogger {
    return {
      debug: () => {},
      info: console.log,
      warn: console.warn,
      error: console.error,
    };
  }

  private initializeStorage(): void {
    const sqlite = openBuiltinSqlite(this.dbPath);
    if (sqlite) {
      try {
        this.db = sqlite.db;
        this.sqliteBackend = sqlite.backend;
        this.db.exec(CREATE_ENTRIES_TABLE);
        this.db.exec(CREATE_INDEXES);
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.migrateJsonMetadataIfNeeded();
        this.migrateLegacySqliteIfNeeded();
        this.logger.debug(`Using ${sqlite.backend} SQLite cache at:`, this.dbPath);
        return;
      } catch (error) {
        this.logger.warn('Built-in SQLite unavailable, using JSON fallback:', error);
        this.db = null;
        this.sqliteBackend = null;
      }
    } else {
      this.logger.warn('No built-in SQLite available (Node 22.5+ or Bun), using JSON fallback');
    }

    this.useJsonFallback = true;
    this.loadJsonMetadata();
  }

  private migrateJsonMetadataIfNeeded(): void {
    if (!this.db || !fs.existsSync(this.metadataFile)) return;

    try {
      const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8')) as MetadataStore;
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
        fs.renameSync(this.metadataFile, backupPath);
        this.logger.debug(`Migrated ${imported} JSON cache entries to SQLite`);
      }
    } catch (error) {
      this.logger.warn('Failed to migrate JSON metadata to SQLite:', error);
    }
  }

  private migrateLegacySqliteIfNeeded(): void {
    if (!this.db) return;

    const legacyMetadataPath = path.join(this.cacheDir, 'metadata.sqlite');
    const legacyKeyvPath = path.join(this.cacheDir, 'tts-cache.sqlite');

    this.importLegacyMetadataDb(legacyMetadataPath);
    this.importLegacyKeyvDb(legacyKeyvPath);
  }

  private importStoredEntry(cacheKey: string, entry: StoredEntry): boolean {
    if (!this.db || this.getSqliteEntry(cacheKey)) return false;
    if (!entry.audioFilePath || !fs.existsSync(entry.audioFilePath)) return false;
    this.upsertSqliteEntry(cacheKey, entry);
    return true;
  }

  private importLegacyMetadataDb(legacyPath: string): void {
    if (!this.db || !fs.existsSync(legacyPath)) return;

    try {
      const legacy = openBuiltinSqlite(legacyPath);
      if (!legacy) return;

      const rows = legacy.db.prepare('SELECT * FROM metadata').all();
      let imported = 0;

      for (const row of rows) {
        const cacheKey = row.cache_key as string;
        const storedEntry: StoredEntry = {
          audioFilePath: row.file_path as string,
          provider: row.provider as string,
          voice: row.voice as string,
          rate: row.rate as number,
          timestamp: row.timestamp as number,
          text: row.original_text as string,
          fileSize: row.file_size as number,
          model: row.model as string | undefined,
          source: row.source as string | undefined,
          sessionId: row.session_id as string | undefined,
          processId: row.process_id as string | undefined,
          hostname: row.hostname as string | undefined,
          user: row.user as string | undefined,
          workingDirectory: row.working_directory as string | undefined,
          commandLine: row.command_line as string | undefined,
          durationMs: row.duration_ms as number | undefined,
          success: row.success === 1,
          errorMessage: row.error_message as string | undefined,
        };

        if (this.importStoredEntry(cacheKey, storedEntry)) {
          imported++;
        }
      }

      if (imported > 0) {
        fs.renameSync(legacyPath, `${legacyPath}.migrated`);
        this.logger.debug(`Migrated ${imported} entries from legacy metadata.sqlite`);
      }
    } catch (error) {
      this.logger.warn('Legacy metadata.sqlite migration failed:', error);
    }
  }

  private importLegacyKeyvDb(legacyPath: string): void {
    if (!this.db || !fs.existsSync(legacyPath)) return;

    try {
      const legacy = openBuiltinSqlite(legacyPath);
      if (!legacy) return;

      const rows = legacy.db.prepare('SELECT key, value FROM keyv').all();
      let imported = 0;

      for (const row of rows) {
        const cacheKey = row.key as string;
        if (this.getSqliteEntry(cacheKey)) continue;

        const parsed = JSON.parse(row.value as string) as { value?: CacheEntry; expires?: number };
        const entry = parsed.value;
        if (!entry || !this.isValidEntry(entry)) continue;
        if (parsed.expires && Date.now() > parsed.expires) continue;
        if (!fs.existsSync(entry.audioFilePath)) continue;

        const storedEntry: StoredEntry = {
          ...entry,
          fileSize: fs.statSync(entry.audioFilePath).size,
        };

        if (this.importStoredEntry(cacheKey, storedEntry)) {
          imported++;
        }
      }

      if (imported > 0) {
        fs.renameSync(legacyPath, `${legacyPath}.migrated`);
        this.logger.debug(`Migrated ${imported} entries from legacy tts-cache.sqlite`);
      }
    } catch (error) {
      this.logger.warn('Legacy tts-cache.sqlite migration failed:', error);
    }
  }

  private ensureMetadataLoaded(): void {
    if (!this.metadataLoaded && this.useJsonFallback) {
      this.loadJsonMetadata();
    }
  }

  private loadJsonMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8')) as MetadataStore;
        this.jsonEntries = data.entries || {};
      } else {
        this.jsonEntries = {};
      }
    } catch (error) {
      this.logger.warn('Error loading JSON metadata, starting fresh:', error);
      this.jsonEntries = {};
    }
    this.metadataLoaded = true;
  }

  private saveJsonMetadata(): void {
    const data: MetadataStore = { version: 1, entries: this.jsonEntries };
    const tempFile = `${this.metadataFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, this.metadataFile);
  }

  private loadStats(): void {
    try {
      if (fs.existsSync(this.statsFile)) {
        const stats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
        this.cacheHits = stats.cacheHits || 0;
        this.cacheMisses = stats.cacheMisses || 0;
      }
    } catch (error) {
      this.logger.warn('Error loading stats:', error);
    }
  }

  private saveStats(): void {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify({
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        timestamp: Date.now(),
      }, null, 2));
    } catch (error) {
      this.logger.warn('Error saving stats:', error);
    }
  }

  private rowToStoredEntry(row: Record<string, unknown>): StoredEntry {
    return {
      audioFilePath: row.file_path as string,
      provider: row.provider as string,
      voice: row.voice as string,
      rate: row.rate as number,
      timestamp: row.timestamp as number,
      text: row.original_text as string,
      fileSize: row.file_size as number,
      expiresAt: row.expires_at == null ? undefined : (row.expires_at as number),
      model: row.model as string | undefined,
      source: row.source as string | undefined,
      sessionId: row.session_id as string | undefined,
      processId: row.process_id as string | undefined,
      hostname: row.hostname as string | undefined,
      user: row.user as string | undefined,
      workingDirectory: row.working_directory as string | undefined,
      commandLine: row.command_line as string | undefined,
      durationMs: row.duration_ms as number | undefined,
      success: row.success === 1,
      errorMessage: row.error_message as string | undefined,
    };
  }

  private rowToMetadata(row: Record<string, unknown>): CacheMetadata {
    return {
      cacheKey: row.cache_key as string,
      originalText: row.original_text as string,
      provider: row.provider as string,
      voice: row.voice as string,
      rate: row.rate as number,
      timestamp: row.timestamp as number,
      fileSize: row.file_size as number,
      filePath: row.file_path as string,
      model: row.model as string | undefined,
      source: row.source as string | undefined,
      sessionId: row.session_id as string | undefined,
      processId: row.process_id as string | undefined,
      hostname: row.hostname as string | undefined,
      user: row.user as string | undefined,
      workingDirectory: row.working_directory as string | undefined,
      commandLine: row.command_line as string | undefined,
      durationMs: row.duration_ms as number | undefined,
      success: row.success === 1,
      errorMessage: row.error_message as string | undefined,
    };
  }

  private toMetadata(cacheKey: string, entry: StoredEntry): CacheMetadata {
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
      errorMessage: entry.errorMessage,
    };
  }

  private isExpired(entry: StoredEntry): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }

  private isValidEntry(entry: unknown): entry is CacheEntry {
    return (
      !!entry &&
      typeof (entry as CacheEntry).audioFilePath === 'string' &&
      typeof (entry as CacheEntry).provider === 'string' &&
      typeof (entry as CacheEntry).voice === 'string' &&
      typeof (entry as CacheEntry).rate === 'number' &&
      typeof (entry as CacheEntry).timestamp === 'number' &&
      typeof (entry as CacheEntry).text === 'string'
    );
  }

  private inferModel(provider: string, voice: string): string {
    switch (provider) {
      case 'openai': return 'tts-1';
      case 'elevenlabs': return 'eleven_multilingual_v2';
      case 'groq': return 'tts-1-hd';
      case 'system': return `macOS-${voice}`;
      default: return provider;
    }
  }

  private getSource(): string {
    if (process.argv[1]?.includes('speakeasy-cli')) return 'cli';
    if (process.env.NODE_ENV === 'test') return 'test';
    return 'api';
  }

  private getSessionId(): string {
    return `${Date.now()}-${process.pid}`;
  }

  private upsertSqliteEntry(cacheKey: string, entry: StoredEntry): void {
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
      entry.errorMessage ?? null,
    );
  }

  private getSqliteEntry(cacheKey: string): StoredEntry | undefined {
    if (!this.db) return undefined;
    const row = this.db.prepare('SELECT * FROM entries WHERE cache_key = ?').get(cacheKey);
    return row ? this.rowToStoredEntry(row) : undefined;
  }

  private deleteSqliteEntry(cacheKey: string): void {
    if (!this.db) return;
    this.db.prepare('DELETE FROM entries WHERE cache_key = ?').run(cacheKey);
  }

  private deleteEntry(cacheKey: string, entry?: StoredEntry): void {
    const resolved = entry || (this.useJsonFallback ? this.jsonEntries[cacheKey] : this.getSqliteEntry(cacheKey));
    if (resolved?.audioFilePath && fs.existsSync(resolved.audioFilePath)) {
      fs.unlinkSync(resolved.audioFilePath);
    }

    if (this.useJsonFallback) {
      delete this.jsonEntries[cacheKey];
      this.saveJsonMetadata();
    } else {
      this.deleteSqliteEntry(cacheKey);
    }
  }

  private enforceMaxSize(): void {
    if (!this.maxSize) return;

    const entries = this.useJsonFallback
      ? Object.entries(this.jsonEntries).map(([cacheKey, entry]) => ({ cacheKey, entry }))
      : (this.db?.prepare('SELECT cache_key, file_size, timestamp FROM entries ORDER BY timestamp ASC').all() || [])
          .map((row) => ({
            cacheKey: row.cache_key as string,
            entry: { fileSize: row.file_size as number },
          }));

    let totalSize = entries.reduce((sum, item) => sum + (item.entry.fileSize || 0), 0);
    if (totalSize <= this.maxSize) return;

    for (const item of entries) {
      if (totalSize <= this.maxSize) break;
      const entry = this.useJsonFallback
        ? this.jsonEntries[item.cacheKey]
        : this.getSqliteEntry(item.cacheKey);
      if (!entry) continue;
      totalSize -= entry.fileSize;
      this.deleteEntry(item.cacheKey, entry);
    }
  }

  private buildSearchQuery(options: {
    text?: string;
    provider?: string;
    model?: string;
    source?: string;
    fromDate?: Date;
    toDate?: Date;
    minSize?: number;
    maxSize?: number;
    success?: boolean;
    workingDirectory?: string;
    user?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): { sql: string; params: unknown[] } {
    const where: string[] = [];
    const params: unknown[] = [];

    if (options.text) {
      where.push('original_text LIKE ?');
      params.push(`%${options.text}%`);
    }
    if (options.provider) {
      where.push('provider = ?');
      params.push(options.provider);
    }
    if (options.model) {
      where.push('model = ?');
      params.push(options.model);
    }
    if (options.source) {
      where.push('source = ?');
      params.push(options.source);
    }
    if (options.fromDate) {
      where.push('timestamp >= ?');
      params.push(options.fromDate.getTime());
    }
    if (options.toDate) {
      where.push('timestamp <= ?');
      params.push(options.toDate.getTime());
    }
    if (options.minSize !== undefined) {
      where.push('file_size >= ?');
      params.push(options.minSize);
    }
    if (options.maxSize !== undefined) {
      where.push('file_size <= ?');
      params.push(options.maxSize);
    }
    if (options.success !== undefined) {
      where.push('success = ?');
      params.push(options.success ? 1 : 0);
    }
    if (options.workingDirectory) {
      where.push('working_directory LIKE ?');
      params.push(`%${options.workingDirectory}%`);
    }
    if (options.user) {
      where.push('user = ?');
      params.push(options.user);
    }
    if (options.sessionId) {
      where.push('session_id = ?');
      params.push(options.sessionId);
    }

    let sql = 'SELECT * FROM entries';
    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }
    sql += ' ORDER BY timestamp DESC';

    if (options.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    return { sql, params };
  }

  private filterJsonMetadata(options: {
    text?: string;
    provider?: string;
    model?: string;
    source?: string;
    fromDate?: Date;
    toDate?: Date;
    minSize?: number;
    maxSize?: number;
    success?: boolean;
    workingDirectory?: string;
    user?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  } = {}): CacheMetadata[] {
    this.ensureMetadataLoaded();
    let results = Object.entries(this.jsonEntries)
      .map(([cacheKey, entry]) => this.toMetadata(cacheKey, entry))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (options.text) {
      const needle = options.text.toLowerCase();
      results = results.filter((entry) => entry.originalText.toLowerCase().includes(needle));
    }
    if (options.provider) results = results.filter((entry) => entry.provider === options.provider);
    if (options.model) results = results.filter((entry) => entry.model === options.model);
    if (options.source) results = results.filter((entry) => entry.source === options.source);
    if (options.fromDate) results = results.filter((entry) => entry.timestamp >= options.fromDate!.getTime());
    if (options.toDate) results = results.filter((entry) => entry.timestamp <= options.toDate!.getTime());
    if (options.minSize !== undefined) results = results.filter((entry) => entry.fileSize >= options.minSize!);
    if (options.maxSize !== undefined) results = results.filter((entry) => entry.fileSize <= options.maxSize!);
    if (options.success !== undefined) results = results.filter((entry) => entry.success === options.success);
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

  private calculateStats(metadata: CacheMetadata[]): CacheStats {
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
        hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
      };
    }

    const stats: CacheStats = {
      totalEntries: metadata.length,
      totalSize: metadata.reduce((sum, entry) => sum + entry.fileSize, 0),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providers: {},
      models: {},
      sources: {},
      dateRange: {
        earliest: new Date(Math.min(...metadata.map((entry) => entry.timestamp))),
        latest: new Date(Math.max(...metadata.map((entry) => entry.timestamp))),
      },
      avgFileSize: metadata.reduce((sum, entry) => sum + entry.fileSize, 0) / metadata.length,
      hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
    };

    metadata.forEach((entry) => {
      stats.providers[entry.provider] = (stats.providers[entry.provider] || 0) + 1;
      stats.models[entry.model || 'unknown'] = (stats.models[entry.model || 'unknown'] || 0) + 1;
      stats.sources[entry.source || 'unknown'] = (stats.sources[entry.source || 'unknown'] || 0) + 1;
    });

    return stats;
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    try {
      const entry = this.useJsonFallback
        ? (this.ensureMetadataLoaded(), this.jsonEntries[key])
        : this.getSqliteEntry(key);

      if (entry && this.isValidEntry(entry)) {
        if (this.isExpired(entry)) {
          this.deleteEntry(key, entry);
        } else if (fs.existsSync(entry.audioFilePath)) {
          this.cacheHits++;
          this.saveStats();
          return entry;
        } else {
          this.deleteEntry(key, entry);
        }
      }
    } catch (error) {
      console.warn('Cache retrieval error:', error);
    }

    this.cacheMisses++;
    this.saveStats();
    return undefined;
  }

  async set(
    key: string,
    entry: Omit<CacheEntry, 'timestamp' | 'audioFilePath'>,
    audioBuffer: Buffer,
    options?: {
      model?: string;
      source?: string;
      durationMs?: number;
      success?: boolean;
      errorMessage?: string;
      extension?: 'mp3' | 'wav';
    }
  ): Promise<boolean> {
    try {
      const extension = options?.extension || detectAudioExtension(audioBuffer);
      const audioFilePath = path.join(this.cacheDir, `${key}.${extension}`);
      fs.writeFileSync(audioFilePath, audioBuffer);

      const timestamp = Date.now();
      const storedEntry: StoredEntry = {
        ...entry,
        audioFilePath,
        timestamp,
        fileSize: audioBuffer.length,
        expiresAt: this.ttlMs ? timestamp + this.ttlMs : undefined,
        model: options?.model || this.inferModel(entry.provider, entry.voice),
        source: options?.source || this.getSource(),
        sessionId: this.getSessionId(),
        processId: process.pid.toString(),
        hostname: require('os').hostname(),
        user: require('os').userInfo().username,
        workingDirectory: process.cwd(),
        commandLine: process.argv.join(' '),
        durationMs: options?.durationMs,
        success: options?.success ?? true,
        errorMessage: options?.errorMessage,
      };

      if (this.useJsonFallback) {
        this.ensureMetadataLoaded();
        this.jsonEntries[key] = storedEntry;
        this.saveJsonMetadata();
      } else {
        this.upsertSqliteEntry(key, storedEntry);
      }

      this.enforceMaxSize();
      this.logger.debug('Cache entry stored:', this.toMetadata(key, storedEntry));
      return true;
    } catch (error) {
      this.logger.warn('Cache storage error:', error);
      return false;
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata[]> {
    return this.search();
  }

  async findByText(text: string): Promise<CacheMetadata[]> {
    return this.search({ text });
  }

  async findByProvider(provider: string): Promise<CacheMetadata[]> {
    return this.search({ provider });
  }

  async search(options: {
    text?: string;
    provider?: string;
    model?: string;
    source?: string;
    fromDate?: Date;
    toDate?: Date;
    minSize?: number;
    maxSize?: number;
    success?: boolean;
    workingDirectory?: string;
    user?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CacheMetadata[]> {
    if (this.useJsonFallback) {
      return this.filterJsonMetadata(options);
    }

    if (!this.db) return [];

    const { sql, params } = this.buildSearchQuery(options);
    return this.db.prepare(sql).all(...params).map((row) => this.rowToMetadata(row));
  }

  async getStats(): Promise<CacheStats> {
    if (this.useJsonFallback) {
      return this.calculateStats(this.filterJsonMetadata());
    }

    if (!this.db) {
      return this.calculateStats([]);
    }

    const countRow = this.db.prepare('SELECT COUNT(*) AS count, SUM(file_size) AS total_size FROM entries').get();
    const count = (countRow?.count as number) || 0;
    if (count === 0) {
      return this.calculateStats([]);
    }

    const dateRow = this.db.prepare('SELECT MIN(timestamp) AS earliest, MAX(timestamp) AS latest FROM entries').get();
    const providers: Record<string, number> = {};
    const models: Record<string, number> = {};
    const sources: Record<string, number> = {};

    this.db.prepare('SELECT provider, COUNT(*) AS count FROM entries GROUP BY provider').all()
      .forEach((row) => { providers[row.provider as string] = row.count as number; });
    this.db.prepare('SELECT model, COUNT(*) AS count FROM entries GROUP BY model').all()
      .forEach((row) => { models[(row.model as string) || 'unknown'] = row.count as number; });
    this.db.prepare('SELECT source, COUNT(*) AS count FROM entries GROUP BY source').all()
      .forEach((row) => { sources[(row.source as string) || 'unknown'] = row.count as number; });

    const totalSize = (countRow?.total_size as number) || 0;

    return {
      totalEntries: count,
      totalSize,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providers,
      models,
      sources,
      dateRange: {
        earliest: new Date(dateRow?.earliest as number),
        latest: new Date(dateRow?.latest as number),
      },
      avgFileSize: totalSize / count,
      hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
    };
  }

  async getRecent(limit: number = 10): Promise<CacheMetadata[]> {
    return this.search({ limit });
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.deleteEntry(key);
      return true;
    } catch (error) {
      console.warn('Cache deletion error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      for (const file of fs.readdirSync(this.cacheDir)) {
        if (file.endsWith('.mp3') || file.endsWith('.wav')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }

      if (this.useJsonFallback) {
        this.jsonEntries = {};
        this.saveJsonMetadata();
      } else if (this.db) {
        this.db.exec('DELETE FROM entries');
      }

      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.saveStats();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  async cleanup(maxAge?: number): Promise<void> {
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

      if (!this.db) return;

      const oldEntries = this.db
        .prepare('SELECT cache_key, file_path FROM entries WHERE timestamp < ?')
        .all(cutoff);

      for (const row of oldEntries) {
        const cacheKey = row.cache_key as string;
        const filePath = row.file_path as string;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        this.deleteSqliteEntry(cacheKey);
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  generateCacheKey(text: string, provider: string, voice: string, rate: number): string {
    const normalizedText = text.trim().toLowerCase();
    const keyData = `${normalizedText}|${provider}|${voice}|${rate}`;
    return uuidv5(keyData, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  }

  getCacheDir(): string {
    return this.cacheDir;
  }

  getEntryCount(): number {
    if (this.useJsonFallback) {
      this.ensureMetadataLoaded();
      return Object.keys(this.jsonEntries).length;
    }

    const row = this.db?.prepare('SELECT COUNT(*) AS count FROM entries').get();
    return (row?.count as number) || 0;
  }

  usesSqlite(): boolean {
    return !this.useJsonFallback && this.db !== null;
  }

  getSqliteBackend(): SqliteBackend | 'json' {
    if (this.useJsonFallback) return 'json';
    return this.sqliteBackend || 'json';
  }
}