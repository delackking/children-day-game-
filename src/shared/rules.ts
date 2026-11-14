import { ALL_SHOP_ITEMS, CARNIVAL_ZONES, WORLD_RADIUS } from './catalog';

export const MAX_CONSUME_DURATION_MS = 10000;
export const AUTO_BITE_INTERVAL_MS = 2200;
import type {
  ArcadeGameId,
  FoodItem,
  InventoryEntry,
  LeaderboardEntry,
  PlayerState,
  ZoneId,
} from './types';

const BLOCKED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'cunt',
  'idiot',
  'stupid',
  'shut up',
  'kill yourself',
  'hate you',
  'dumbass',
];

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function sanitizePlayerName(raw: string): string {
  const cleaned = raw
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  return cleaned;
}

export function filterChatMessage(raw: string): {
  allowed: boolean;
  sanitized: string;
  flagged: boolean;
  reason?: string;
} {
  // Strip any HTML tags or control characters
  const stripped = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 160);

  if (!stripped) {
    return { allowed: false, sanitized: '', flagged: false, reason: 'Message cannot be empty.' };
  }

  // Block sharing of phone numbers / email addresses for child safety
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(stripped);
  const hasPhone = /(\+?\d[\d\s-]{7,}\d)/.test(stripped);
  if (hasEmail || hasPhone) {
    return {
      allowed: false,
      sanitized: '',
      flagged: true,
      reason: 'Personal contact details (emails or phone numbers) cannot be shared in chat.',
    };
  }

  let flagged = false;
  let result = stripped;
  for (const word of BLOCKED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (regex.test(result)) {
      flagged = true;
      result = result.replace(regex, '*'.repeat(Math.min(word.length, 5)));
    }
  }

  return { allowed: true, sanitized: result, flagged };
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Direct 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = url.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function findFoodItemById(itemId: string): FoodItem | undefined {
  return ALL_SHOP_ITEMS.find((i) => i.id === itemId);
}

export function validateFoodPurchase(
  coins: number,
  itemId: string,
  quantity = 1,
): { ok: true; item: FoodItem; totalCost: number; newBalance: number } | { ok: false; error: string } {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    return { ok: false, error: 'Invalid purchase quantity.' };
  }
  const item = findFoodItemById(itemId);
  if (!item) {
    return { ok: false, error: 'Item not found.' };
  }
  const totalCost = item.price * quantity;
  if (coins < totalCost) {
    return { ok: false, error: `Not enough carnival coins (need ${totalCost}, have ${coins}).` };
  }
  return {
    ok: true,
    item,
    totalCost,
    newBalance: coins - totalCost,
  };
}

export function createInventoryEntry(item: FoodItem, instanceId: string, now = Date.now()): InventoryEntry {
  return {
    instanceId,
    itemId: item.id,
    name: item.name,
    visualType: item.visualType,
    bitesRemaining: item.maxBites,
    maxBites: item.maxBites,
    primaryColor: item.primaryColor,
    secondaryColor: item.secondaryColor,
    isDrink: item.isDrink,
    category: item.category ?? 'food',
    fireworkEffect: item.fireworkEffect,
    purchasedAt: now,
  };
}

export function consumeInventoryBite(
  inventory: InventoryEntry[],
  instanceId: string,
): {
  ok: true;
  updatedInventory: InventoryEntry[];
  finished: boolean;
  entry: InventoryEntry;
  remainingBites: number;
} | { ok: false; error: string } {
  const idx = inventory.findIndex((i) => i.instanceId === instanceId);
  if (idx === -1) {
    return { ok: false, error: 'Item is not in your inventory.' };
  }
  const target = inventory[idx];
  const nextBites = Math.max(0, target.bitesRemaining - 1);
  const updatedEntry: InventoryEntry = { ...target, bitesRemaining: nextBites };
  const updatedInventory =
    nextBites <= 0
      ? inventory.filter((i) => i.instanceId !== instanceId)
      : inventory.map((i, k) => (k === idx ? updatedEntry : i));

  return {
    ok: true,
    updatedInventory,
    finished: nextBites <= 0,
    entry: updatedEntry,
    remainingBites: nextBites,
  };
}

const ARCADE_SCORE_CAPS: Record<ArcadeGameId, number> = {
  memory_match: 1200,
  tic_tac_toe: 300,
  snake: 2000,
  whack_a_mole: 1500,
  reaction_speed: 1000,
  number_puzzle: 1200,
  color_match: 1500,
  quick_maths: 1500,
  word_guess: 1000,
  mini_racing: 2000,
  ring_toss: 1500,
  can_knockdown: 1500,
  balloon_pop: 1500,
  duck_pond: 1500,
  cup_ball_toss: 1500,
  dunk_tank: 1500,
  high_striker: 1500,
  prize_wheel: 2000,
  dart_game: 1500,
  feed_the_clown: 1500,
  tp_toss: 1500,
  matka_phod: 1500,
  kite_duel: 1800,
  kancha_marbles: 1500,
  gilli_danda: 1800,
};

export function validateArcadeScore(
  gameId: ArcadeGameId,
  rawScore: number,
): { ok: true; score: number } | { ok: false; error: string } {
  if (!Number.isFinite(rawScore) || rawScore < 0) {
    return { ok: false, error: 'Invalid score value.' };
  }
  const maxAllowed = ARCADE_SCORE_CAPS[gameId];
  if (!maxAllowed) {
    return { ok: false, error: 'Unknown arcade game.' };
  }
  const clamped = Math.min(Math.round(rawScore), maxAllowed);
  return { ok: true, score: clamped };
}

/**
 * Competition ranking MUST NOT be influenced by food purchases or virtual coin spending.
 * Ranking relies strictly on arcade wins, sports points, and treasure hunts.
 */
export function computeCompetitionPoints(player: Pick<PlayerState, 'stats'>): number {
  const s = player.stats;
  return s.arcadeWins * 100 + s.arcadeBestTotal + s.sportsScore * 25 + s.treasuresFound * 60;
}

export function buildLeaderboard(players: PlayerState[]): LeaderboardEntry[] {
  return [...players]
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      competitionPoints: computeCompetitionPoints(p),
      arcadeWins: p.stats.arcadeWins,
      sportsScore: p.stats.sportsScore,
      treasuresFound: p.stats.treasuresFound,
      badges: [...p.badges],
    }))
    .sort((a, b) => b.competitionPoints - a.competitionPoints || a.name.localeCompare(b.name));
}

export function computePlayerBadges(player: PlayerState, leaderboard: LeaderboardEntry[]): string[] {
  const badges = new Set<string>(player.badges);
  if (player.stats.foodsEaten >= 3) badges.add('Food Lover');
  if (player.stats.dancesPerformed >= 3) badges.add('Dance King');
  if (player.stats.goalsScored >= 2 || player.stats.basketsScored >= 2) badges.add('Football Star');
  if (player.stats.treasuresFound >= 2) badges.add('Treasure Hunter');
  if (player.stats.arcadeWins >= 2) badges.add('Arcade Champion');
  if (player.stats.passesMade >= 2) badges.add('Best Team Player');
  if (leaderboard[0]?.playerId === player.id && leaderboard[0].competitionPoints >= 100) {
    badges.add('Carnival Champion');
  }
  return Array.from(badges);
}

export function detectZoneAt(x: number, z: number): ZoneId {
  let closest: ZoneId = 'central_plaza';
  let bestDist = Infinity;
  for (const zone of CARNIVAL_ZONES) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    if (d <= zone.radius && d < bestDist) {
      bestDist = d;
      closest = zone.id;
    }
  }
  return closest;
}

export function clampWorldPosition(x: number, z: number): { x: number; z: number } {
  const dist = Math.hypot(x, z);
  const maxR = WORLD_RADIUS - 3;
  if (dist > maxR && dist > 0) {
    const scale = maxR / dist;
    return { x: x * scale, z: z * scale };
  }
  return { x, z };
}
