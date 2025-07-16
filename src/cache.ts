import Keyv from 'keyv';
import KeyvSQLite from '@keyv/sqlite';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
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

export class TTSCache {
  private cache: Keyv<CacheEntry>;
  private cacheDir: string;
  private maxSize?: number;
  private logger: CacheLogger;

  constructor(cacheDir: string, ttl: string | number = '7d', maxSize?: string | number, logger?: CacheLogger) {
    this.cacheDir = cacheDir || path.join('/tmp', 'speakeasy-cache');
    this.logger = logger || this.createDefaultLogger();
    
    this.logger.debug('Initializing TTSCache with dir:', this.cacheDir, 'ttl:', ttl, 'maxSize:', maxSize);
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      this.logger.debug('Creating cache directory:', this.cacheDir);
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const dbPath = path.join(this.cacheDir, 'tts-cache.sqlite');
    this.logger.debug('Database path:', dbPath);
    this.cache = new Keyv({ store: new KeyvSQLite(`sqlite://${dbPath}`) });
    
    // Set configurable TTL
    this.cache.opts.ttl = parseTTL(ttl);
    this.maxSize = maxSize ? parseSize(maxSize) : undefined;
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
          return entry;
        } else {
          // File missing, remove from cache
          await this.delete(key);
        }
      }
    } catch (error) {
      console.warn('Cache retrieval error:', error);
    }
    return undefined;
  }

  async set(key: string, entry: Omit<CacheEntry, 'timestamp' | 'audioFilePath'>, audioBuffer: Buffer): Promise<boolean> {
    try {
      // Save audio file
      const audioFilePath = path.join(this.cacheDir, `${key}.mp3`);
      fs.writeFileSync(audioFilePath, audioBuffer);

      const cacheEntry: CacheEntry = {
        ...entry,
        audioFilePath,
        timestamp: Date.now(),
      };
      
      return await this.cache.set(key, cacheEntry);
    } catch (error) {
      console.warn('Cache storage error:', error);
      return false;
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
    
    // Use SHA-256 for consistent hashing
    return crypto.createHash('sha256').update(keyData).digest('hex').slice(0, 16);
  }

  getCacheDir(): string {
    return this.cacheDir;
  }
}