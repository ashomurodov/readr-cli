import fs from 'fs';
import path from 'path';
import os from 'os';
import { Store } from './types.js';

const STORE_PATH = path.join(os.homedir(), '.reading-cli', 'data.json');

const DEFAULT_STORE: Store = {
  books: [],
  sessions: [],
};

export function loadStore(): Store {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
      return DEFAULT_STORE;
    }
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveStore(store: Store): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
