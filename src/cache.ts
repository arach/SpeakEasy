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
  private metadataStore: Keyv<CacheMetadata>;
  private metadataFile: string;
  private statsFile: string;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(cacheDir: string, ttl: string | number = '7d', maxSize?: string | number, logger?: CacheLogger) {
    this.cacheDir = cacheDir || path.join('/tmp', 'speakeasy-cache');
    this.logger = logger || this.createDefaultLogger();
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.statsFile = path.join(this.cacheDir, 'stats.json');
    
    this.loadStats();
    this.logger.debug('Initializing TTSCache with dir:', this.cacheDir, 'ttl:', ttl, 'maxSize:', maxSize);
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      this.logger.debug('Creating cache directory:', this.cacheDir);
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const dbPath = path.join(this.cacheDir, 'tts-cache.sqlite');
    this.logger.debug('Database path:', dbPath);
    
    try {
      const KeyvSqlite = require('@keyv/sqlite');
      this.cache = new Keyv({ store: new KeyvSqlite(dbPath) });
      this.metadataStore = new Keyv({ store: new KeyvSqlite(path.join(this.cacheDir, 'metadata.sqlite')) });
      this.cache.opts.ttl = parseTTL(ttl);
      this.maxSize = maxSize ? parseSize(maxSize) : undefined;
    } catch (error) {
      this.logger.warn('SQLite not available, using in-memory cache:', error);
      this.cache = new Keyv();
      this.metadataStore = new Keyv();
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
    try {
      await this.metadataStore.set(metadata.cacheKey, metadata);
      
      // Also update JSON index for backwards compatibility
      const existing = this.loadMetadataIndex();
      const index = existing.findIndex(e => e.cacheKey === metadata.cacheKey);
      if (index >= 0) {
        existing[index] = metadata;
      } else {
        existing.push(metadata);
      }
      this.saveMetadataIndex(existing);
    } catch (error) {
      this.logger.warn('Metadata storage error:', error);
      throw error;
    }
  }

  private loadMetadataIndex(): CacheMetadata[] {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.warn('Error loading metadata index:', error);
    }
    return [];
  }

  private saveMetadataIndex(metadata: CacheMetadata[]): void {
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      this.logger.warn('Error saving metadata index:', error);
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata[]> {
    try {
      // For now, use the JSON-based approach which works with existing files
      return this.loadMetadataIndex();
    } catch (error) {
      this.logger.warn('Metadata retrieval error:', error);
      return [];
    }
  }

  async findByText(text: string): Promise<CacheMetadata[]> {
    try {
      const allMetadata = await this.getCacheMetadata();
      return allMetadata.filter(entry => 
        entry.originalText.toLowerCase().includes(text.toLowerCase())
      );
    } catch (error) {
      this.logger.warn('Find by text error:', error);
      throw error;
    }
  }

  async findByProvider(provider: string): Promise<CacheMetadata[]> {
    try {
      const allMetadata = await this.getCacheMetadata();
      return allMetadata.filter(entry => entry.provider === provider);
    } catch (error) {
      this.logger.warn('Find by provider error:', error);
      throw error;
    }
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
  } = {}): Promise<CacheMetadata[]> {
    try {
      const metadata = this.loadMetadataIndex();
      
      return metadata.filter(entry => {
        if (options.text && !entry.originalText.toLowerCase().includes(options.text.toLowerCase())) {
          return false;
        }
        if (options.provider && entry.provider !== options.provider) {
          return false;
        }
        if (options.model && entry.model !== options.model) {
          return false;
        }
        if (options.source && entry.source !== options.source) {
          return false;
        }
        if (options.fromDate && entry.timestamp < options.fromDate.getTime()) {
          return false;
        }
        if (options.toDate && entry.timestamp > options.toDate.getTime()) {
          return false;
        }
        if (options.minSize && entry.fileSize < options.minSize) {
          return false;
        }
        if (options.maxSize && entry.fileSize > options.maxSize) {
          return false;
        }
        if (options.success !== undefined && entry.success !== options.success) {
          return false;
        }
        if (options.workingDirectory && !entry.workingDirectory?.includes(options.workingDirectory)) {
          return false;
        }
        if (options.user && entry.user !== options.user) {
          return false;
        }
        if (options.sessionId && entry.sessionId !== options.sessionId) {
          return false;
        }
        return true;
      });
    } catch (error) {
      this.logger.warn('Search error:', error);
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const metadata = this.loadMetadataIndex();
      
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

      // Count by provider
      metadata.forEach(entry => {
        stats.providers[entry.provider] = (stats.providers[entry.provider] || 0) + 1;
        stats.models[entry.model || 'unknown'] = (stats.models[entry.model || 'unknown'] || 0) + 1;
        stats.sources[entry.source || 'unknown'] = (stats.sources[entry.source || 'unknown'] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.warn('Stats error:', error);
      throw error;
    }
  }

  async getRecent(limit: number = 10): Promise<CacheMetadata[]> {
    try {
      const metadata = this.loadMetadataIndex();
      return metadata
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
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
      
      // Delete metadata
      await this.deleteMetadata(key);
      
      return await this.cache.delete(key);
    } catch (error) {
      console.warn('Cache deletion error:', error);
      return false;
    }
  }

  private async deleteMetadata(key: string): Promise<void> {
    try {
      await this.metadataStore.delete(key);
    } catch (error) {
      this.logger.warn('Metadata deletion error:', error);
      throw error;
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
      await this.cache.clear();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  async cleanup(maxAge?: number): Promise<void> {
    try {
      const cutoff = Date.now() - (maxAge || 7 * 24 * 60 * 60 * 1000);
      
      // This is a simple approach - delete files older than maxAge
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
      console.warn('Cache cleanup error:', error);
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