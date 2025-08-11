import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SpeakEasy } from '../index';
import { TTSCache, CacheMetadata } from '../cache';

export async function clearCache(): Promise<void> {
  try {
    const speaker = new SpeakEasy({});
    const stats = await speaker.getCacheStats();
    if (stats.dir) {
      const cache = new TTSCache(stats.dir, '7d');
      await cache.clear();
      console.log('🗑️  Cache cleared successfully');
    } else {
      console.log('❌ Cache not enabled or directory not found');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', (error as Error).message);
  }
}

export async function playCachedAudio(cacheKey: string): Promise<void> {
  try {
    const speaker = new SpeakEasy({});
    const cacheStats = await speaker.getCacheStats();

    if (!cacheStats.dir) {
      console.log('❌ Cache not enabled or directory not found');
      return;
    }

    const cache = new TTSCache(cacheStats.dir, '7d');
    const allMetadata = await cache.getCacheMetadata();
    const entry = allMetadata.find((m) => m.cacheKey === cacheKey);

    if (!entry) {
      console.log(`❌ Cache entry not found: ${cacheKey}`);
      return;
    }

    if (!fs.existsSync(entry.filePath)) {
      console.log(`❌ Audio file not found: ${entry.filePath}`);
      return;
    }

    console.log(`🎵 Playing cached audio: "${entry.originalText.substring(0, 50)}${entry.originalText.length > 50 ? '...' : ''}"`);
    console.log(`   Provider: ${entry.provider}, Voice: ${entry.voice}`);

    execSync(`afplay "${entry.filePath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Error playing cached audio:', (error as Error).message);
  }
}

export async function listCacheEntries(options: {
  find?: string;
  stats?: boolean;
  recent?: number;
  id?: string;
} = {}): Promise<void> {
  try {
    const speaker = new SpeakEasy({});
    const cacheStats = await speaker.getCacheStats();

    if (!cacheStats.dir) {
      console.log('❌ Cache not enabled or directory not found');
      return;
    }

    const cache = new TTSCache(cacheStats.dir, '7d');

    if (options.id) {
      const allMetadata = await cache.getCacheMetadata();
      const entry = allMetadata.find((m) => m.cacheKey === options.id);

      if (entry) {
        console.log('🔍 Cache Entry Details');
        console.log('═════════════════════');
        console.log(`ID: ${entry.cacheKey}`);
        console.log(`Text: "${entry.originalText}"`);
        console.log(`Provider: ${entry.provider}`);
        console.log(`Model: ${entry.model || 'unknown'}`);
        console.log(`Voice: ${entry.voice}`);
        console.log(`Rate: ${entry.rate} WPM`);
        console.log(`Size: ${(entry.fileSize / 1024).toFixed(1)} KB`);
        console.log(`Created: ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`File: ${entry.filePath}`);
        console.log(`Source: ${entry.source || 'unknown'}`);
        console.log(`Session: ${entry.sessionId || 'unknown'}`);
        console.log(`Directory: ${entry.workingDirectory || 'unknown'}`);
        console.log(`User: ${entry.user || 'unknown'}`);
        console.log(`Duration: ${entry.durationMs ? `${entry.durationMs}ms` : 'unknown'}`);
        console.log(`Success: ${entry.success ? '✅' : '❌'}`);
        if (entry.errorMessage) {
          console.log(`Error: ${entry.errorMessage}`);
        }
      } else {
        console.log(`❌ Cache entry not found: ${options.id}`);
      }
      return;
    }

    if (options.stats) {
      const stats = await cache.getStats();
      console.log('📊 Cache Statistics');
      console.log('══════════════════');
      console.log(`Total Entries: ${stats.totalEntries}`);
      console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Cache Hits: ${stats.cacheHits}`);
      console.log(`Cache Misses: ${stats.cacheMisses}`);
      console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`Avg File Size: ${(stats.avgFileSize / 1024).toFixed(1)} KB`);

      if (stats.dateRange) {
        console.log(`Date Range: ${stats.dateRange.earliest.toLocaleDateString()} - ${stats.dateRange.latest.toLocaleDateString()}`);
      }

      console.log('\n📈 By Provider:');
      Object.entries(stats.providers).forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });

      console.log('\n📈 By Model:');
      Object.entries(stats.models).forEach(([model, count]) => {
        console.log(`  ${model}: ${count}`);
      });

      console.log('\n📈 By Source:');
      Object.entries(stats.sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
      return;
    }

    let entries: CacheMetadata[];

    if (options.recent) {
      entries = await cache.getRecent(options.recent);
    } else if (options.find) {
      entries = await cache.findByText(options.find);
    } else {
      entries = await cache.getCacheMetadata();
    }

    if (entries.length === 0) {
      console.log('📭 No cache entries found');
      return;
    }

    console.log(`📋 Cache Entries (${entries.length})`);
    console.log('═══════════════════════');

    entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.cacheKey}`);
      console.log(`   Text: "${entry.originalText.substring(0, 50)}${entry.originalText.length > 50 ? '...' : ''}"`);
      console.log(`   Provider: ${entry.provider}`);
      console.log(`   Voice: ${entry.voice}`);
      console.log(`   Rate: ${entry.rate} WPM`);
      console.log(`   Size: ${(entry.fileSize / 1024).toFixed(1)} KB`);
      console.log(`   Created: ${new Date(entry.timestamp).toLocaleString()}`);
      console.log(`   File: ${path.basename(entry.filePath)}`);
      if (entry.model) console.log(`   Model: ${entry.model}`);
    });

    console.log(`\n💡 Use --id KEY to see full details, --play KEY to play audio`);
  } catch (error) {
    console.error('❌ Error accessing cache:', (error as Error).message);
  }
}


