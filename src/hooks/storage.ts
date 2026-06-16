const STORAGE_KEY = "scrumflow-store";
const BACKUP_KEY = "scrumflow-backup";
const MAX_BACKUPS = 5;
const VERSION_KEY = "scrumflow-version";

export function loadStore<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "projects" in parsed) {
        localStorage.setItem(VERSION_KEY, new Date().toISOString());
        return parsed as T;
      }
    }
  } catch {
    console.warn("Failed to load store, trying backup...");
  }

  try {
    const backups = getBackupList();
    for (let i = backups.length - 1; i >= 0; i--) {
      const raw = localStorage.getItem(backups[i]);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && "projects" in parsed) {
          localStorage.setItem(STORAGE_KEY, raw);
          localStorage.setItem(VERSION_KEY, new Date().toISOString());
          return parsed as T;
        }
      }
    }
  } catch {
    console.warn("All backups failed");
  }

  return fallback;
}

export function saveStore(value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(VERSION_KEY, new Date().toISOString());
    return true;
  } catch (err) {
    console.warn("Failed to save, cleaning up...", err);
    cleanupStorage();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch {
      console.error("Cannot save store");
      return false;
    }
  }
}

export function createBackup(value: unknown): void {
  try {
    const timestamp = Date.now();
    const key = `${BACKUP_KEY}-${timestamp}`;
    localStorage.setItem(key, JSON.stringify(value));
    trimBackups();
  } catch (err) {
    console.warn("Backup failed:", err);
  }
}

export function exportData(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function importData(json: string): unknown {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || !("projects" in parsed)) {
    throw new Error("Format invalide");
  }
  return parsed;
}

export function getStorageInfo(): { used: number; available: number; keys: number } {
  let used = 0;
  let keys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      keys++;
      const value = localStorage.getItem(key) || "";
      used += key.length + value.length;
    }
  }
  const available = 5 * 1024 * 1024 - used;
  return { used, available, keys };
}

function getBackupList(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(BACKUP_KEY)) {
      keys.push(key);
    }
  }
  return keys.sort();
}

function trimBackups(): void {
  const keys = getBackupList();
  while (keys.length > MAX_BACKUPS) {
    const oldest = keys.shift();
    if (oldest) localStorage.removeItem(oldest);
  }
}

function cleanupStorage(): void {
  const keys = getBackupList();
  keys.forEach((k) => localStorage.removeItem(k));
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERSION_KEY);
  const keys = getBackupList();
  keys.forEach((k) => localStorage.removeItem(k));
}
