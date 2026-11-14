import fs from 'node:fs';
import path from 'node:path';
import type { RoomPublicState } from '../src/shared/types';

export interface StoredRoomRecord {
  publicState: RoomPublicState;
  hostSecret: string;
  playerTokens: Record<string, string>; // playerId -> sessionToken
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'carnival-rooms.json');

export class RoomPersistence {
  private filePath: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(filePath = DATA_FILE) {
    this.filePath = filePath;
  }

  loadAll(): Record<string, StoredRoomRecord> {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      if (!raw.trim()) return {};
      const parsed = JSON.parse(raw) as Record<string, StoredRoomRecord>;
      // Mark all loaded players offline initially until sockets reconnect
      for (const room of Object.values(parsed)) {
        for (const player of Object.values(room.publicState.players)) {
          player.online = false;
        }
      }
      return parsed;
    } catch {
      return {};
    }
  }

  scheduleSave(rooms: Map<string, StoredRoomRecord>): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveNow(rooms);
    }, 250);
  }

  saveNow(rooms: Map<string, StoredRoomRecord>): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const obj: Record<string, StoredRoomRecord> = {};
      for (const [code, rec] of rooms.entries()) {
        obj[code] = rec;
      }
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(obj), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch {
      // Ignore write failures in read-only test environments
    }
  }
}
