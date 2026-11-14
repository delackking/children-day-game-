import {
  CARNIVAL_ZONES,
  DEFAULT_AVATAR,
  DEFAULT_DJ_PLAYLIST,
  INITIAL_BALLS,
  INITIAL_COINS,
  OUTFIT_CATALOG,
  TREASURE_SPAWN_LOCATIONS,
} from '../shared/catalog';
import {
  buildLeaderboard,
  clampWorldPosition,
  computePlayerBadges,
  consumeInventoryBite,
  createInventoryEntry,
  detectZoneAt,
  extractYouTubeVideoId,
  filterChatMessage,
  generateRoomCode,
  normalizeRoomCode,
  sanitizePlayerName,
  validateArcadeScore,
  validateFoodPurchase,
} from '../shared/rules';
import type {
  ArcadeGameId,
  AvatarConfig,
  BallState,
  ChatMessage,
  DanceId,
  EventPhase,
  FireworkIgnitedEvent,
  LightingMode,
  PlayerState,
  RoomPublicState,
  TimeOfDay,
  ZoneId,
} from '../shared/types';
import { useGameStore } from '../stores/useGameStore';

function shortId(prefix: string): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export class LocalCarnivalSession {
  private room: RoomPublicState | null = null;
  private localPlayerId: string | null = null;

  isActive(): boolean {
    return this.room !== null && this.localPlayerId !== null;
  }

  private getContext(): { room: RoomPublicState; player: PlayerState } | null {
    if (!this.room || !this.localPlayerId) return null;
    const player = this.room.players[this.localPlayerId];
    if (!player) return null;
    return { room: this.room, player };
  }

  private syncStore(): void {
    if (!this.room) return;
    const clone: RoomPublicState = {
      ...this.room,
      players: { ...this.room.players },
      balls: this.room.balls.map((b) => ({ ...b })),
      chat: [...this.room.chat],
      leaderboard: [...this.room.leaderboard],
      transactions: [...this.room.transactions],
      treasureHunt: {
        ...this.room.treasureHunt,
        nodes: this.room.treasureHunt.nodes.map((n) => ({ ...n })),
      },
      dj: { ...this.room.dj },
    };
    this.room = clone;
    useGameStore.getState().setRoom(clone);
  }

  private refreshLeaderboard(): void {
    if (!this.room) return;
    const list = Object.values(this.room.players);
    const lb = buildLeaderboard(list);
    for (const p of list) {
      p.badges = computePlayerBadges(p, lb);
    }
    this.room.leaderboard = buildLeaderboard(list);
  }

  createRoom(payload: {
    hostName: string;
    roomName?: string;
    maxPlayers?: number;
    avatar?: Partial<AvatarConfig>;
    preferredCode?: string;
  }) {
    const cleanName = sanitizePlayerName(payload.hostName);
    if (!cleanName) {
      return { ok: false as const, error: 'Please enter a valid display name.' };
    }
    const code = payload.preferredCode ? normalizeRoomCode(payload.preferredCode) : generateRoomCode(6);
    const playerId = shortId('p');
    const sessionToken = shortId('tok');
    const hostSecret = shortId('host');
    const now = Date.now();

    const mergedAvatar: AvatarConfig = {
      ...DEFAULT_AVATAR,
      ...payload.avatar,
      accessories: payload.avatar?.accessories
        ? [...payload.avatar.accessories]
        : [...DEFAULT_AVATAR.accessories],
    };

    const player: PlayerState = {
      id: playerId,
      name: cleanName,
      isHost: true,
      online: true,
      muted: false,
      coins: INITIAL_COINS,
      x: 0,
      y: 0,
      z: 54,
      rotY: Math.PI,
      speed: 0,
      isJumping: false,
      zone: 'entrance',
      dance: 'none',
      heldBallId: null,
      consuming: null,
      avatar: mergedAvatar,
      unlockedOutfits: OUTFIT_CATALOG.map((o) => o.id),
      inventory: [],
      stats: {
        arcadeWins: 0,
        arcadeBestTotal: 0,
        sportsScore: 0,
        goalsScored: 0,
        basketsScored: 0,
        treasuresFound: 0,
        dancesPerformed: 0,
        foodsEaten: 0,
        passesMade: 0,
      },
      badges: [],
      lastBubbleText: null,
      lastBubbleAt: 0,
    };

    const firstTrack = DEFAULT_DJ_PLAYLIST[0];
    const createdRoom: RoomPublicState = {
      code,
      name: (payload.roomName || `${cleanName}'s Carnival`).trim().slice(0, 40),
      maxPlayers: Math.min(20, Math.max(2, payload.maxPlayers ?? 12)),
      locked: false,
      chatDisabled: false,
      eventPhase: 'free_play',
      timeOfDay: 'day',
      groupDanceActive: null,
      fireworksBurstAt: 0,
      hostPlayerId: playerId,
      players: { [playerId]: player },
      balls: INITIAL_BALLS.map((b) => ({ ...b, updatedAt: now })),
      chat: [
        {
          id: `sys_${now}`,
          playerId: 'system',
          playerName: 'Carnival Guide',
          isHost: true,
          text: `Welcome to ${cleanName}'s Solo Carnival Mela! All stalls, rides & 3D booths are ready.`,
          timestamp: now,
          kind: 'system',
        },
      ],
      reports: [],
      transactions: [],
      announcement: null,
      dj: {
        trackId: firstTrack.id,
        title: `${firstTrack.title} — ${firstTrack.artist}`,
        youtubeId: null,
        youtubeUrl: null,
        isPlaying: false,
        startedAt: now,
        pausedOffsetSec: 0,
        volume: 65,
        lightingMode: 'festive',
        queue: [...DEFAULT_DJ_PLAYLIST],
      },
      treasureHunt: {
        active: false,
        startedAt: 0,
        durationSec: 180,
        nodes: TREASURE_SPAWN_LOCATIONS.map((t) => ({ ...t, claimedBy: null, claimedByName: null })),
      },
      arcadeChallenge: null,
      activeCompetition: null,
      leaderboard: [],
    };
    this.room = createdRoom;
    this.localPlayerId = playerId;
    this.refreshLeaderboard();

    useGameStore.getState().setSessionData({
      room: createdRoom,
      playerId,
      sessionToken,
      hostSecret,
    });

    return {
      ok: true as const,
      room: createdRoom,
      playerId,
      session: { sessionToken, hostSecret },
    };
  }

  updateMove(payload: { x: number; y: number; z: number; rotY: number; speed: number; isJumping: boolean }): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const clamped = clampWorldPosition(payload.x, payload.z);
    ctx.player.x = clamped.x;
    ctx.player.y = Math.max(0, Math.min(35, payload.y));
    ctx.player.z = clamped.z;
    ctx.player.rotY = payload.rotY;
    ctx.player.speed = payload.speed;
    ctx.player.isJumping = payload.isJumping;
    ctx.player.zone = detectZoneAt(clamped.x, clamped.z);
    if (payload.speed > 0.35 && ctx.player.dance !== 'none') {
      ctx.player.dance = 'none';
    }
  }

  updateAvatar(avatar: AvatarConfig) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    ctx.player.avatar = {
      ...ctx.player.avatar,
      ...avatar,
      accessories: avatar.accessories ? [...avatar.accessories] : ctx.player.avatar.accessories,
    };
    this.syncStore();
    return { ok: true, player: ctx.player };
  }

  setDance(dance: DanceId): void {
    const ctx = this.getContext();
    if (!ctx) return;
    ctx.player.dance = dance;
    if (dance !== 'none') {
      ctx.player.stats.dancesPerformed += 1;
      this.refreshLeaderboard();
    }
    this.syncStore();
  }

  purchaseFood(itemId: string, quantity = 1) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const check = validateFoodPurchase(ctx.player.coins, itemId, quantity);
    if (!check.ok) return check;
    ctx.player.coins = check.newBalance;
    for (let i = 0; i < quantity; i++) {
      ctx.player.inventory.push(createInventoryEntry(check.item, shortId('inv')));
    }
    ctx.room.transactions.unshift({
      id: shortId('tx'),
      playerId: ctx.player.id,
      playerName: ctx.player.name,
      type: 'purchase',
      amount: -check.totalCost,
      itemName: `${check.item.name}${quantity > 1 ? ` x${quantity}` : ''}`,
      timestamp: Date.now(),
    });
    if (ctx.room.transactions.length > 60) {
      ctx.room.transactions = ctx.room.transactions.slice(0, 60);
    }
    this.syncStore();
    return { ok: true, player: ctx.player, purchasedItemName: check.item.name };
  }

  consumeFoodBite(instanceId: string) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const entry = ctx.player.inventory.find((i) => i.instanceId === instanceId);
    if (!entry) return { ok: false, error: 'Item is not in your inventory.' };
    if (entry.category === 'firework') {
      return { ok: false, error: 'Use Light & Burn to launch fireworks and crackers!' };
    }
    const res = consumeInventoryBite(ctx.player.inventory, instanceId);
    if (!res.ok) return res;
    ctx.player.inventory = res.updatedInventory;
    if (res.finished) {
      ctx.player.consuming = null;
      ctx.player.stats.foodsEaten += 1;
      this.refreshLeaderboard();
    } else {
      ctx.player.consuming = {
        itemId: res.entry.itemId,
        name: res.entry.name,
        visualType: res.entry.visualType,
        bitesRemaining: res.remainingBites,
        maxBites: res.entry.maxBites,
        primaryColor: res.entry.primaryColor,
        secondaryColor: res.entry.secondaryColor,
        isDrink: res.entry.isDrink,
        startedAt: Date.now(),
      };
    }
    this.syncStore();
    return {
      ok: true,
      player: ctx.player,
      finished: res.finished,
      itemName: res.entry.name,
      isDrink: res.entry.isDrink,
    };
  }

  stopConsuming(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    ctx.player.consuming = null;
    this.syncStore();
  }

  igniteFirework(instanceId: string, x?: number, z?: number) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const entry = ctx.player.inventory.find((i) => i.instanceId === instanceId);
    if (!entry || entry.category !== 'firework') {
      return { ok: false, error: 'Firework item not found in your bag.' };
    }
    const res = consumeInventoryBite(ctx.player.inventory, instanceId);
    if (!res.ok) return res;
    ctx.player.inventory = res.updatedInventory;

    const clamped = clampWorldPosition(
      Number.isFinite(x) ? Number(x) : ctx.player.x + Math.sin(ctx.player.rotY) * 2.2,
      Number.isFinite(z) ? Number(z) : ctx.player.z + Math.cos(ctx.player.rotY) * 2.2,
    );
    const event: FireworkIgnitedEvent = {
      id: shortId('fw'),
      playerId: ctx.player.id,
      playerName: ctx.player.name,
      itemName: entry.name,
      effect: entry.fireworkEffect ?? 'skyshot',
      x: clamped.x,
      y: 0.2,
      z: clamped.z,
      primaryColor: entry.primaryColor,
      secondaryColor: entry.secondaryColor,
      timestamp: Date.now(),
    };
    this.syncStore();
    useGameStore.getState().enqueueFireworkEvent(event);
    return { ok: true, player: ctx.player, event, remainingUses: res.remainingBites };
  }

  sendChat(rawText: string) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const filtered = filterChatMessage(rawText);
    if (!filtered.allowed) {
      return { ok: false, error: filtered.reason || 'Message blocked by safety filter.' };
    }
    const now = Date.now();
    const msg: ChatMessage = {
      id: `msg_${now}_${shortId('m')}`,
      playerId: ctx.player.id,
      playerName: ctx.player.name,
      isHost: ctx.player.isHost,
      text: filtered.sanitized,
      timestamp: now,
      kind: 'chat',
    };
    ctx.room.chat.push(msg);
    if (ctx.room.chat.length > 80) ctx.room.chat = ctx.room.chat.slice(-80);
    ctx.player.lastBubbleText = filtered.sanitized;
    ctx.player.lastBubbleAt = now;
    this.syncStore();
    return { ok: true };
  }

  pickupBall(ballId: string) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const ball = ctx.room.balls.find((b) => b.id === ballId);
    if (!ball) return { ok: false, error: 'Ball not found.' };
    if (ctx.player.heldBallId && ctx.player.heldBallId !== ball.id) {
      const prev = ctx.room.balls.find((b) => b.id === ctx.player.heldBallId);
      if (prev) prev.holderId = null;
    }
    ball.holderId = ctx.player.id;
    ball.vx = 0;
    ball.vy = 0;
    ball.vz = 0;
    ball.updatedAt = Date.now();
    ctx.player.heldBallId = ball.id;
    this.syncStore();
    return { ok: true };
  }

  kickBall(payload: { ballId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const ball = ctx.room.balls.find((b) => b.id === payload.ballId);
    if (!ball) return;
    ball.holderId = null;
    ball.lastKickerId = ctx.player.id;
    ball.x = payload.x;
    ball.y = Math.max(0.4, payload.y);
    ball.z = payload.z;
    ball.vx = Math.max(-28, Math.min(28, payload.vx));
    ball.vy = Math.max(-15, Math.min(22, payload.vy));
    ball.vz = Math.max(-28, Math.min(28, payload.vz));
    ball.updatedAt = Date.now();
    if (ctx.player.heldBallId === ball.id) ctx.player.heldBallId = null;
    this.syncStore();
  }

  recordGoal(sport: 'football' | 'basketball') {
    const ctx = this.getContext();
    if (!ctx) return { ok: false };
    const rewardCoins = sport === 'basketball' ? 12 : 8;
    ctx.player.stats.sportsScore += 1;
    if (sport === 'football') ctx.player.stats.goalsScored += 1;
    else ctx.player.stats.basketsScored += 1;
    ctx.player.coins += rewardCoins;
    ctx.room.transactions.unshift({
      id: shortId('tx'),
      playerId: ctx.player.id,
      playerName: ctx.player.name,
      type: 'reward',
      amount: rewardCoins,
      itemName: sport === 'football' ? 'Football Goal Bonus' : 'Basketball Hoop Bonus',
      timestamp: Date.now(),
    });
    this.refreshLeaderboard();
    this.syncStore();
    return { ok: true, rewardCoins };
  }

  claimTreasure(treasureId: string) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    if (!ctx.room.treasureHunt.active) {
      return { ok: false, error: 'Treasure Hunt is not currently active.' };
    }
    const node = ctx.room.treasureHunt.nodes.find((n) => n.id === treasureId);
    if (!node) return { ok: false, error: 'Treasure not found.' };
    if (node.claimedBy) return { ok: false, error: `Already found by ${node.claimedByName}!` };
    node.claimedBy = ctx.player.id;
    node.claimedByName = ctx.player.name;
    ctx.player.coins += node.rewardCoins;
    ctx.player.stats.treasuresFound += 1;
    ctx.room.transactions.unshift({
      id: shortId('tx'),
      playerId: ctx.player.id,
      playerName: ctx.player.name,
      type: 'reward',
      amount: node.rewardCoins,
      itemName: `Treasure: ${node.label}`,
      timestamp: Date.now(),
    });
    this.refreshLeaderboard();
    this.syncStore();
    return { ok: true, rewardCoins: node.rewardCoins, label: node.label };
  }

  submitArcadeScore(gameId: ArcadeGameId, rawScore: number, won: boolean) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const valid = validateArcadeScore(gameId, rawScore);
    if (!valid.ok) return valid;
    if (won && valid.score >= 350) ctx.player.stats.arcadeWins += 1;
    ctx.player.stats.arcadeBestTotal += Math.round(valid.score / 10);
    const rewardCoins =
      valid.score < 200
        ? 0
        : won && valid.score >= 350
          ? Math.min(25, Math.max(5, Math.floor((valid.score - 150) / 45)))
          : Math.min(12, Math.max(3, Math.floor((valid.score - 150) / 60)));
    ctx.player.coins += rewardCoins;
    if (rewardCoins > 0) {
      ctx.room.transactions.unshift({
        id: shortId('tx'),
        playerId: ctx.player.id,
        playerName: ctx.player.name,
        type: 'reward',
        amount: rewardCoins,
        itemName: `Arcade (${gameId.replace(/_/g, ' ')})`,
        timestamp: Date.now(),
      });
    }
    this.refreshLeaderboard();
    this.syncStore();
    return { ok: true, rewardCoins, validatedScore: valid.score };
  }

  hostSetLock(locked: boolean) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    ctx.room.locked = locked;
    this.syncStore();
    return { ok: true };
  }

  hostToggleChat(disabled: boolean) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    ctx.room.chatDisabled = disabled;
    this.syncStore();
    return { ok: true };
  }

  hostAdjustCoins(targetPlayerId: string, delta: number) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const target = ctx.room.players[targetPlayerId];
    if (!target) return { ok: false, error: 'Player not found.' };
    const rounded = Math.round(delta);
    target.coins = Math.max(0, Math.min(99999, target.coins + rounded));
    ctx.room.transactions.unshift({
      id: shortId('tx'),
      playerId: target.id,
      playerName: target.name,
      type: rounded >= 0 ? 'host_grant' : 'host_deduct',
      amount: rounded,
      itemName: rounded >= 0 ? 'Host Coin Gift' : 'Host Coin Adjustment',
      timestamp: Date.now(),
    });
    this.syncStore();
    return { ok: true };
  }

  hostTeleportAll(zoneId: ZoneId) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const zone = CARNIVAL_ZONES.find((z) => z.id === zoneId);
    if (!zone) return { ok: false, error: 'Zone not found.' };
    ctx.player.x = zone.spawnX;
    ctx.player.y = 0;
    ctx.player.z = zone.spawnZ;
    ctx.player.zone = zone.id;
    this.syncStore();
    useGameStore.getState().triggerLocalTeleport(zone.spawnX, zone.spawnZ);
    return { ok: true };
  }

  hostAnnounce(text: string) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, 200);
    if (!clean) return { ok: false, error: 'Announcement cannot be empty.' };
    const now = Date.now();
    ctx.room.announcement = {
      id: `ann_${now}`,
      text: clean,
      senderName: ctx.player.name,
      timestamp: now,
    };
    ctx.room.chat.push({
      id: `msg_${now}`,
      playerId: ctx.player.id,
      playerName: ctx.player.name,
      isHost: true,
      text: clean,
      timestamp: now,
      kind: 'announcement',
    });
    this.syncStore();
    return { ok: true };
  }

  hostUpdateDj(patch: {
    trackId?: string;
    youtubeInput?: string | null;
    isPlaying?: boolean;
    volume?: number;
    lightingMode?: LightingMode;
    next?: boolean;
    prev?: boolean;
  }) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const dj = ctx.room.dj;
    if (patch.youtubeInput !== undefined) {
      if (patch.youtubeInput === null || patch.youtubeInput.trim() === '') {
        dj.youtubeId = null;
        dj.youtubeUrl = null;
      } else {
        const ytId = extractYouTubeVideoId(patch.youtubeInput);
        if (!ytId) {
          return { ok: false, error: 'Please paste a valid YouTube video URL or 11-character video ID.' };
        }
        dj.youtubeId = ytId;
        dj.youtubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
        dj.title = `YouTube Party Track (${ytId})`;
        dj.pausedOffsetSec = 0;
        dj.startedAt = Date.now();
        dj.isPlaying = true;
      }
    }
    if (patch.trackId) {
      const found = dj.queue.find((t) => t.id === patch.trackId);
      if (found) {
        dj.trackId = found.id;
        dj.title = `${found.title} — ${found.artist}`;
        dj.youtubeId = null;
        dj.youtubeUrl = null;
        dj.pausedOffsetSec = 0;
        dj.startedAt = Date.now();
        dj.isPlaying = true;
      }
    }
    if (patch.next || patch.prev) {
      const idx = dj.queue.findIndex((t) => t.id === dj.trackId);
      const nextIdx = patch.next
        ? (idx + 1) % dj.queue.length
        : (idx - 1 + dj.queue.length) % dj.queue.length;
      const track = dj.queue[nextIdx];
      dj.trackId = track.id;
      dj.title = `${track.title} — ${track.artist}`;
      dj.youtubeId = null;
      dj.youtubeUrl = null;
      dj.pausedOffsetSec = 0;
      dj.startedAt = Date.now();
    }
    if (patch.isPlaying !== undefined) {
      if (patch.isPlaying && !dj.isPlaying) {
        dj.startedAt = Date.now();
        dj.isPlaying = true;
      } else if (!patch.isPlaying && dj.isPlaying) {
        dj.pausedOffsetSec += Math.max(0, (Date.now() - dj.startedAt) / 1000);
        dj.isPlaying = false;
      }
    }
    if (patch.volume !== undefined) dj.volume = Math.max(0, Math.min(100, Math.round(patch.volume)));
    if (patch.lightingMode) dj.lightingMode = patch.lightingMode;
    this.syncStore();
    return { ok: true };
  }

  hostStartTreasure(durationSec = 180) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const shuffled = [...TREASURE_SPAWN_LOCATIONS].sort(() => Math.random() - 0.5);
    ctx.room.treasureHunt = {
      active: true,
      startedAt: Date.now(),
      durationSec: Math.max(60, Math.min(600, durationSec)),
      nodes: shuffled.map((n) => ({ ...n, claimedBy: null, claimedByName: null })),
    };
    this.syncStore();
    return { ok: true };
  }

  hostEndTreasure() {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    ctx.room.treasureHunt.active = false;
    this.syncStore();
    return { ok: true };
  }

  hostTriggerEvent(payload: {
    phase?: EventPhase;
    groupDance?: DanceId | null;
    fireworks?: boolean;
    timeOfDay?: TimeOfDay;
  }) {
    const ctx = this.getContext();
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    if (payload.phase) ctx.room.eventPhase = payload.phase;
    if (payload.timeOfDay && ['day', 'sunset', 'night'].includes(payload.timeOfDay)) {
      ctx.room.timeOfDay = payload.timeOfDay;
    }
    if (payload.groupDance !== undefined) {
      ctx.room.groupDanceActive = payload.groupDance;
      if (payload.groupDance && payload.groupDance !== 'none') {
        ctx.player.dance = payload.groupDance;
      }
    }
    if (payload.fireworks) ctx.room.fireworksBurstAt = Date.now();
    this.syncStore();
    return { ok: true };
  }

  reset(): void {
    this.room = null;
    this.localPlayerId = null;
  }
}
