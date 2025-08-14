import Keyv from 'keyv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
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
  
  // Enhanced metadata for navigation
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



export class TTSCache {
  private cache: Keyv<CacheEntry>;
  private cacheDir: string;
  private maxSize?: number;
  private logger: CacheLogger;
  private metadataDb: any;
  private statsFile: string;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(cacheDir: string, ttl: string | number = '7d', maxSize?: string | number, logger?: CacheLogger) {
    this.cacheDir = cacheDir || path.join('/tmp', 'speakeasy-cache');
    this.logger = logger || this.createDefaultLogger();
    this.statsFile = path.join(this.cacheDir, 'stats.json');
    
    this.loadStats();
    this.logger.debug('Initializing TTSCache with dir:', this.cacheDir, 'ttl:', ttl, 'maxSize:', maxSize);
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      this.logger.debug('Creating cache directory:', this.cacheDir);
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const dbPath = path.join(this.cacheDir, 'tts-cache.sqlite');
    const metadataDbPath = path.join(this.cacheDir, 'metadata.sqlite');
    this.logger.debug('Database path:', dbPath);
    this.logger.debug('Metadata DB path:', metadataDbPath);
    
    try {
      // Try to use better-sqlite3 adapter for Keyv
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      
      // Create a simple adapter for Keyv using better-sqlite3
      const store = {
        get: async (key: string) => {
          const row = db.prepare('SELECT value FROM keyv WHERE key = ?').get(key);
          if (row) {
            const data = JSON.parse(row.value);
            if (data.expires && Date.now() > data.expires) {
              db.prepare('DELETE FROM keyv WHERE key = ?').run(key);
              return undefined;
            }
            return data.value;
          }
          return undefined;
        },
        set: async (key: string, value: any) => {
          const expires = parseTTL(ttl) ? Date.now() + parseTTL(ttl) : null;
          const data = JSON.stringify({ value, expires });
          db.prepare('INSERT OR REPLACE INTO keyv (key, value) VALUES (?, ?)').run(key, data);
        },
        delete: async (key: string) => {
          db.prepare('DELETE FROM keyv WHERE key = ?').run(key);
          return true;
        },
        clear: async () => {
          db.prepare('DELETE FROM keyv').run();
        }
      };
      
      // Create keyv table if it doesn't exist
      db.prepare('CREATE TABLE IF NOT EXISTS keyv (key TEXT PRIMARY KEY, value TEXT)').run();
      
      this.cache = new Keyv({ store });
      this.metadataDb = this.initializeMetadataDb(metadataDbPath);
      this.cache.opts.ttl = parseTTL(ttl);
      this.maxSize = maxSize ? parseSize(maxSize) : undefined;
    } catch (error) {
      this.logger.warn('SQLite not available, using in-memory cache:', error);
      this.cache = new Keyv();
      this.metadataDb = null;
    }
  }

  private initializeMetadataDb(dbPath: string): any {
    try {
      const sqlite3 = require('better-sqlite3');
      const db = sqlite3(dbPath);
      
      // Create metadata table if it doesn't exist
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
      
      // Create indexes for better query performance
      db.exec(`CREATE INDEX IF NOT EXISTS idx_provider ON metadata(provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_timestamp ON metadata(timestamp)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_source ON metadata(source)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user ON metadata(user)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_model ON metadata(model)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_success ON metadata(success)`);
      
      this.logger.debug('Metadata database initialized successfully');
      return db;
    } catch (error) {
      this.logger.warn('Failed to initialize metadata database:', error);
      return null;
    }
  }

  private createDefaultLogger(): CacheLogger {
    return {
      debug: () => {}, // No logging by default
      info: console.log,
      warn: console.warn,
      error: console.error
    };
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    try {
      const entry = await this.cache.get(key);
      if (entry && this.isValidEntry(entry)) {
        // Check if audio file still exists
        if (fs.existsSync(entry.audioFilePath)) {
          this.cacheHits++;
          this.saveStats();
          return entry;
        } else {
          // File missing, remove from cache
          await this.delete(key);
        }
      }
    } catch (error) {
      console.warn('Cache retrieval error:', error);
    }
    this.cacheMisses++;
    this.saveStats();
    return undefined;
  }

  private loadStats(): void {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        const stats = JSON.parse(data);
        this.cacheHits = stats.cacheHits || 0;
        this.cacheMisses = stats.cacheMisses || 0;
      }
    } catch (error) {
      this.logger.warn('Error loading stats:', error);
    }
  }

  private saveStats(): void {
    try {
      const stats = {
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        timestamp: Date.now(),
      };
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
      this.logger.warn('Error saving stats:', error);
    }
  }

  async set(key: string, entry: Omit<CacheEntry, 'timestamp' | 'audioFilePath'>, audioBuffer: Buffer, options?: {
    model?: string;
    source?: string;
    durationMs?: number;
    success?: boolean;
    errorMessage?: string;
  }): Promise<boolean> {
    try {
      // Save audio file
      const audioFilePath = path.join(this.cacheDir, `${key}.mp3`);
      fs.writeFileSync(audioFilePath, audioBuffer);

      const timestamp = Date.now();
      const cacheEntry: CacheEntry = {
        ...entry,
        audioFilePath,
        timestamp,
      };
      
      // Store main cache entry
      const cacheResult = await this.cache.set(key, cacheEntry);
      
      // Store metadata for reverse lookup
      const metadata: CacheMetadata = {
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
        hostname: require('os').hostname(),
        user: require('os').userInfo().username,
        workingDirectory: process.cwd(),
        commandLine: process.argv.join(' '),
        durationMs: options?.durationMs,
        success: options?.success ?? true,
        errorMessage: options?.errorMessage,
      };
      
      await this.addMetadata(metadata);
      
      this.logger.debug('Cache entry stored:', metadata);
      return cacheResult;
    } catch (error) {
      this.logger.warn('Cache storage error:', error);
      return false;
    }
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
    // Determine if this came from CLI, API, or programmatic usage
    if (process.argv[1]?.includes('speakeasy-cli')) return 'cli';
    if (process.env.NODE_ENV === 'test') return 'test';
    return 'api';
  }

  private getSessionId(): string {
    // Create a session ID based on process start time
    return `${Date.now()}-${process.pid}`;
  }

  private async addMetadata(metadata: CacheMetadata): Promise<void> {
    if (!this.metadataDb) {
      this.logger.warn('Metadata database not available');
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
      
      this.logger.debug('Metadata stored in SQLite:', metadata.cacheKey);
    } catch (error) {
      this.logger.warn('Metadata storage error:', error);
      throw error;
    }
  }

  private async getMetadataFromDb(cacheKey: string): Promise<CacheMetadata | null> {
    if (!this.metadataDb) return null;

    try {
      const selectSQL = `
        SELECT * FROM metadata WHERE cache_key = ?
      `;
      const stmt = this.metadataDb.prepare(selectSQL);
      const row = stmt.get(cacheKey);
      
      if (!row) return null;
      
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
      this.logger.warn('Metadata retrieval error:', error);
      return null;
    }
  }

  private async deleteMetadata(cacheKey: string): Promise<void> {
    if (!this.metadataDb) return;

    try {
      const deleteSQL = `DELETE FROM metadata WHERE cache_key = ?`;
      const stmt = this.metadataDb.prepare(deleteSQL);
      stmt.run(cacheKey);
      this.logger.debug('Metadata deleted from SQLite:', cacheKey);
    } catch (error) {
      this.logger.warn('Metadata deletion error:', error);
      throw error;
    }
  }

  private loadMetadataIndex(): CacheMetadata[] {
    if (!this.metadataDb) return [];

    try {
      const selectSQL = `SELECT * FROM metadata ORDER BY timestamp DESC`;
      const stmt = this.metadataDb.prepare(selectSQL);
      const rows = stmt.all();
      
      return rows.map((row: any) => ({
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
      this.logger.warn('Error loading metadata index:', error);
      return [];
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata[]> {
    return this.search({});
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
    if (!this.metadataDb) {
      return this.loadMetadataIndex(); // Fallback to in-memory
    }

    try {
      let whereConditions: string[] = [];
      let params: any[] = [];

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
      if (options.minSize !== undefined) {
        whereConditions.push("file_size >= ?");
        params.push(options.minSize);
      }
      if (options.maxSize !== undefined) {
        whereConditions.push("file_size <= ?");
        params.push(options.maxSize);
      }
      if (options.success !== undefined) {
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

      return rows.map((row: any) => ({
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
      this.logger.warn('Search error:', error);
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    if (!this.metadataDb) {
      const metadata = this.loadMetadataIndex();
      return this.calculateStatsFromMetadata(metadata);
    }

    try {
      // Get count and size info
      const countStmt = this.metadataDb.prepare('SELECT COUNT(*) as count, SUM(file_size) as total_size FROM metadata');
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
          hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
        };
      }

      // Get date range
      const dateStmt = this.metadataDb.prepare('SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest FROM metadata');
      const dateResult = dateStmt.get();

      // Get provider counts
      const providerStmt = this.metadataDb.prepare('SELECT provider, COUNT(*) as count FROM metadata GROUP BY provider');
      const providerRows = providerStmt.all();
      const providers: Record<string, number> = {};
      providerRows.forEach((row: any) => {
        providers[row.provider] = row.count;
      });

      // Get model counts
      const modelStmt = this.metadataDb.prepare('SELECT model, COUNT(*) as count FROM metadata GROUP BY model');
      const modelRows = modelStmt.all();
      const models: Record<string, number> = {};
      modelRows.forEach((row: any) => {
        models[row.model || 'unknown'] = row.count;
      });

      // Get source counts
      const sourceStmt = this.metadataDb.prepare('SELECT source, COUNT(*) as count FROM metadata GROUP BY source');
      const sourceRows = sourceStmt.all();
      const sources: Record<string, number> = {};
      sourceRows.forEach((row: any) => {
        sources[row.source || 'unknown'] = row.count;
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
          latest: new Date(dateResult.latest),
        },
        avgFileSize: (countResult.total_size || 0) / countResult.count,
        hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
      };
    } catch (error) {
      this.logger.warn('Stats error:', error);
      // Fallback to in-memory calculation
      const metadata = this.loadMetadataIndex();
      return this.calculateStatsFromMetadata(metadata);
    }
  }

  private calculateStatsFromMetadata(metadata: CacheMetadata[]): CacheStats {
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

    const stats = {
      totalEntries: metadata.length,
      totalSize: metadata.reduce((sum, entry) => sum + entry.fileSize, 0),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providers: {} as Record<string, number>,
      models: {} as Record<string, number>,
      sources: {} as Record<string, number>,
      dateRange: {
        earliest: new Date(Math.min(...metadata.map(e => e.timestamp))),
        latest: new Date(Math.max(...metadata.map(e => e.timestamp))),
      },
      avgFileSize: metadata.reduce((sum, entry) => sum + entry.fileSize, 0) / metadata.length,
      hitRate: this.cacheHits + this.cacheMisses > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
    };

    metadata.forEach((entry: CacheMetadata) => {
      stats.providers[entry.provider] = (stats.providers[entry.provider] || 0) + 1;
      stats.models[entry.model || 'unknown'] = (stats.models[entry.model || 'unknown'] || 0) + 1;
      stats.sources[entry.source || 'unknown'] = (stats.sources[entry.source || 'unknown'] || 0) + 1;
    });

    return stats;
  }

  async getRecent(limit: number = 10): Promise<CacheMetadata[]> {
    if (!this.metadataDb) {
      const metadata = this.loadMetadataIndex();
      return metadata
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    }

    try {
      const sql = `SELECT * FROM metadata ORDER BY timestamp DESC LIMIT ?`;
      const stmt = this.metadataDb.prepare(sql);
      const rows = stmt.all(limit);

      return rows.map((row: any) => ({
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
      this.logger.warn('Recent error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const entry = await this.cache.get(key);
      if (entry && entry.audioFilePath) {
        // Delete audio file
        if (fs.existsSync(entry.audioFilePath)) {
          fs.unlinkSync(entry.audioFilePath);
        }
      }
      
      // Delete metadata from SQLite
      if (this.metadataDb) {
        try {
          const deleteSQL = `DELETE FROM metadata WHERE cache_key = ?`;
          const stmt = this.metadataDb.prepare(deleteSQL);
          stmt.run(key);
          this.logger.debug('Metadata deleted from SQLite:', key);
        } catch (error) {
          this.logger.warn('Metadata deletion error:', error);
        }
      }
      
      return await this.cache.delete(key);
    } catch (error) {
      console.warn('Cache deletion error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      // Delete all audio files in cache directory
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.mp3')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      
      // Clear SQLite metadata
      if (this.metadataDb) {
        try {
          this.metadataDb.exec('DELETE FROM metadata');
          this.logger.debug('Metadata table cleared');
        } catch (error) {
          this.logger.warn('Error clearing metadata table:', error);
        }
      }
      
      // Reset cache stats
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.saveStats();
      
      await this.cache.clear();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  async cleanup(maxAge?: number): Promise<void> {
    try {
      const cutoff = Date.now() - (maxAge || 7 * 24 * 60 * 60 * 1000);
      
      if (this.metadataDb) {
        // Use SQLite for efficient cleanup
        try {
          // Find old metadata entries
          const selectStmt = this.metadataDb.prepare('SELECT cache_key, file_path FROM metadata WHERE timestamp < ?');
          const oldEntries = selectStmt.all(cutoff);
          
          // Delete old audio files
          for (const entry of oldEntries) {
            if (fs.existsSync(entry.file_path)) {
              fs.unlinkSync(entry.file_path);
            }
          }
          
          // Delete old metadata entries from SQLite
          const deleteStmt = this.metadataDb.prepare('DELETE FROM metadata WHERE timestamp < ?');
          deleteStmt.run(cutoff);
          
          // Delete corresponding cache entries
          for (const entry of oldEntries) {
            await this.cache.delete(entry.cache_key);
          }
          
          this.logger.debug(`Cleaned up ${oldEntries.length} old cache entries`);
        } catch (error) {
          this.logger.warn('SQLite cleanup error:', error);
          // Fallback to file-based cleanup
          await this.cleanupFileBased(cutoff);
        }
      } else {
        // Fallback to file-based cleanup
        await this.cleanupFileBased(cutoff);
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  private async cleanupFileBased(cutoff: number): Promise<void> {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.mp3')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < cutoff) {
            fs.unlinkSync(filePath);
            // Remove corresponding cache entry
            const key = file.replace('.mp3', '');
            await this.cache.delete(key);
          }
        }
      }
    } catch (error) {
      console.warn('File-based cleanup error:', error);
    }
  }

  private isValidEntry(entry: any): entry is CacheEntry {
    return (
      entry &&
      typeof entry.audioFilePath === 'string' &&
      typeof entry.provider === 'string' &&
      typeof entry.voice === 'string' &&
      typeof entry.rate === 'number' &&
      typeof entry.timestamp === 'number' &&
      typeof entry.text === 'string'
    );
  }

  generateCacheKey(text: string, provider: string, voice: string, rate: number): string {
    // Create a deterministic cache key based on content and parameters
    const normalizedText = text.trim().toLowerCase();
    const keyData = `${normalizedText}|${provider}|${voice}|${rate}`;
    
    // Use UUID v5 for deterministic, collision-resistant keys (128 bits)
    return uuidv5(keyData, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  }

  getCacheDir(): string {
    return this.cacheDir;
  }
}