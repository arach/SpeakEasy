import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speakeasy');
const HISTORY_DIR = path.join(CONFIG_DIR, 'history');

export interface HistoryEntry {
  id: string;
  text: string;
  provider: string;
  timestamp: number;
  cached: boolean;
}

function getWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function getHistoryFile(date: Date = new Date()): string {
  const { year, week } = getWeekNumber(date);
  const weekStr = week.toString().padStart(2, '0');
  return path.join(HISTORY_DIR, `history-${year}-W${weekStr}.json`);
}

export class NotificationHistory {
  private entries: HistoryEntry[] = [];
  private currentFile: string;

  constructor() {
    this.currentFile = getHistoryFile();
    this.ensureDir();
    this.load();
  }

  private ensureDir(): void {
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.currentFile)) {
        const data = fs.readFileSync(this.currentFile, 'utf8');
        this.entries = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load history:', error);
      this.entries = [];
    }
  }

  private save(): void {
    // Check if we've crossed into a new week
    const newFile = getHistoryFile();
    if (newFile !== this.currentFile) {
      this.currentFile = newFile;
      this.entries = []; // Start fresh for new week
    }

    try {
      this.ensureDir();
      fs.writeFileSync(this.currentFile, JSON.stringify(this.entries, null, 2));
    } catch (error) {
      console.warn('Failed to save history:', error);
    }
  }

  add(entry: Omit<HistoryEntry, 'id'>): string {
    const id = uuidv4();
    const fullEntry: HistoryEntry = { id, ...entry };

    // Add to beginning (most recent first)
    this.entries.unshift(fullEntry);

    // Trim to max entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.save();
    return id;
  }

  getAll(): HistoryEntry[] {
    return [...this.entries];
  }

  getRecent(limit: number = 20): HistoryEntry[] {
    return this.entries.slice(0, limit);
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  getById(id: string): HistoryEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  // Get all history across all week files (for UI display)
  getAllHistory(): HistoryEntry[] {
    const allEntries: HistoryEntry[] = [];

    try {
      if (!fs.existsSync(HISTORY_DIR)) return allEntries;

      const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('history-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Most recent weeks first

      for (const file of files) {
        try {
          const data = fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8');
          const entries: HistoryEntry[] = JSON.parse(data);
          allEntries.push(...entries);
        } catch {
          // Skip corrupted files
        }
      }
    } catch (error) {
      console.warn('Failed to read history files:', error);
    }

    // Sort by timestamp descending (most recent first)
    return allEntries.sort((a, b) => b.timestamp - a.timestamp);
  }

  getHistoryDir(): string {
    return HISTORY_DIR;
  }
}

// Singleton instance for shared use
let historyInstance: NotificationHistory | null = null;

export function getHistory(): NotificationHistory {
  if (!historyInstance) {
    historyInstance = new NotificationHistory();
  }
  return historyInstance;
}

export { HISTORY_DIR };
