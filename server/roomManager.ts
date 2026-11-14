import crypto from 'node:crypto';
import {
  CARNIVAL_ZONES,
  DEFAULT_AVATAR,
  DEFAULT_DJ_PLAYLIST,
  INITIAL_BALLS,
  INITIAL_COINS,
  OUTFIT_CATALOG,
  TREASURE_SPAWN_LOCATIONS,
} from '../src/shared/catalog';
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
  MAX_CONSUME_DURATION_MS,
  normalizeRoomCode,
  sanitizePlayerName,
  validateArcadeScore,
  validateFoodPurchase,
} from '../src/shared/rules';
import type {
  ArcadeGameId,
  AvatarConfig,
  BallState,
  ChatMessage,
  DanceId,
  DjState,
  EventPhase,
  FireworkIgnitedEvent,
  LightingMode,
  PlayerState,
  RoomPublicState,
  TimeOfDay,
  ZoneId,
} from '../src/shared/types';
import { RoomPersistence, type StoredRoomRecord } from './persistence';

export interface AuthSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  hostSecret?: string;
}

export class RoomManager {
  private rooms = new Map<string, StoredRoomRecord>();
  private socketToSession = new Map<string, AuthSession>();
  private chatTimestamps = new Map<string, number[]>();
  private persistence: RoomPersistence | null;
  private initialCoins: number;

  constructor(options?: { persist?: boolean; persistenceFile?: string; initialCoins?: number }) {
    this.initialCoins = options?.initialCoins ?? Number(process.env.INITIAL_COINS || INITIAL_COINS);
    if (options?.persist !== false) {
      this.persistence = new RoomPersistence(options?.persistenceFile);
      const loaded = this.persistence.loadAll();
      for (const [code, record] of Object.entries(loaded)) {
        this.rooms.set(code, record);
      }
    } else {
      this.persistence = null;
    }
  }

  private persist(): void {
    this.persistence?.scheduleSave(this.rooms);
  }

  private createDefaultDjState(): DjState {
    const first = DEFAULT_DJ_PLAYLIST[0];
    return {
      trackId: first.id,
      title: `${first.title} — ${first.artist}`,
      youtubeId: null,
      youtubeUrl: null,
      isPlaying: false,
      startedAt: Date.now(),
      pausedOffsetSec: 0,
      volume: 65,
      lightingMode: 'festive',
      queue: [...DEFAULT_DJ_PLAYLIST],
    };
  }

  private createNewPlayer(id: string, name: string, isHost: boolean, avatar?: Partial<AvatarConfig>): PlayerState {
    const mergedAvatar: AvatarConfig = {
      ...DEFAULT_AVATAR,
      ...avatar,
      accessories: avatar?.accessories ? [...avatar.accessories] : [...DEFAULT_AVATAR.accessories],
    };
    return {
      id,
      name,
      isHost,
      online: true,
      muted: false,
      coins: this.initialCoins,
      x: (Math.random() - 0.5) * 3,
      y: 0,
      z: 54 + (Math.random() - 0.5) * 1.5,
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
  }

  private refreshLeaderboard(room: RoomPublicState): void {
    room.leaderboard = buildLeaderboard(Object.values(room.players));
    for (const player of Object.values(room.players)) {
      player.badges = computePlayerBadges(player, room.leaderboard);
    }
  }

  createRoom(params: {
    hostName: string;
    roomName?: string;
    maxPlayers?: number;
    avatar?: Partial<AvatarConfig>;
    preferredCode?: string;
    socketId?: string;
  }): { ok: true; room: RoomPublicState; player: PlayerState; session: AuthSession } | { ok: false; error: string } {
    const cleanName = sanitizePlayerName(params.hostName);
    if (!cleanName) {
      return { ok: false, error: 'Please enter a valid player name.' };
    }

    let code = params.preferredCode ? normalizeRoomCode(params.preferredCode) : generateRoomCode();
    if (!code || code.length < 4) code = generateRoomCode();
    if (this.rooms.has(code) && params.preferredCode) {
      // Allow re-creating deterministic demo room only if everyone is offline
      const existing = this.rooms.get(code)!;
      const anyOnline = Object.values(existing.publicState.players).some((p) => p.online);
      if (anyOnline) {
        code = generateRoomCode();
      } else {
        this.rooms.delete(code);
      }
    }
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const hostId = `pl_${crypto.randomUUID().slice(0, 8)}`;
    const sessionToken = crypto.randomUUID();
    const hostSecret = crypto.randomUUID();
    const maxPlayers = Math.min(20, Math.max(2, Math.round(params.maxPlayers ?? 12)));
    const hostPlayer = this.createNewPlayer(hostId, cleanName, true, params.avatar);

    const roomState: RoomPublicState = {
      code,
      name: (params.roomName || `${cleanName}'s Children's Day Mela`).slice(0, 48),
      maxPlayers,
      locked: false,
      chatDisabled: false,
      hostPlayerId: hostId,
      timeOfDay: 'day',
      eventPhase: 'free_play',
      groupDanceActive: null,
      fireworksBurstAt: 0,
      announcement: {
        id: `ann_${Date.now()}`,
        text: `Welcome to ${cleanName}'s Children's Day Carnival! Explore Food Street, Sports Ground, DJ Stage & Arcade!`,
        senderName: cleanName,
        timestamp: Date.now(),
      },
      treasureHunt: {
        active: false,
        startedAt: null,
        durationSec: 180,
        nodes: [],
      },
      dj: this.createDefaultDjState(),
      balls: INITIAL_BALLS.map((b) => ({ ...b, updatedAt: Date.now() })),
      players: { [hostId]: hostPlayer },
      chat: [
        {
          id: `msg_${Date.now()}`,
          playerId: 'system',
          playerName: 'Carnival Guide',
          isHost: true,
          text: `Room ${code} created! Share the code or invite link with up to ${maxPlayers} friends.`,
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
      arcadeChallenge: null,
      activeCompetition: null,
      leaderboard: [],
      transactions: [],
      reports: [],
    };

    this.refreshLeaderboard(roomState);

    const record: StoredRoomRecord = {
      publicState: roomState,
      hostSecret,
      playerTokens: { [hostId]: sessionToken },
    };
    this.rooms.set(code, record);

    const session: AuthSession = { roomCode: code, playerId: hostId, sessionToken, hostSecret };
    if (params.socketId) {
      this.socketToSession.set(params.socketId, session);
    }
    this.persist();
    return { ok: true, room: roomState, player: hostPlayer, session };
  }

  joinRoom(params: {
    roomCode: string;
    playerName: string;
    avatar?: Partial<AvatarConfig>;
    sessionToken?: string;
    hostSecret?: string;
    socketId?: string;
  }): { ok: true; room: RoomPublicState; player: PlayerState; session: AuthSession } | { ok: false; error: string } {
    const code = normalizeRoomCode(params.roomCode);
    const record = this.rooms.get(code);
    if (!record) {
      return { ok: false, error: 'Room code not found. Double-check the code or ask your host.' };
    }

    const room = record.publicState;

    // Reconnection via valid sessionToken
    if (params.sessionToken) {
      const matchedId = Object.entries(record.playerTokens).find(([, tok]) => tok === params.sessionToken)?.[0];
      if (matchedId && room.players[matchedId]) {
        const existingPlayer = room.players[matchedId];
        existingPlayer.online = true;
        const isValidHost = existingPlayer.isHost && params.hostSecret === record.hostSecret;
        const session: AuthSession = {
          roomCode: code,
          playerId: matchedId,
          sessionToken: params.sessionToken,
          hostSecret: isValidHost ? record.hostSecret : undefined,
        };
        if (params.socketId) {
          this.socketToSession.set(params.socketId, session);
        }
        this.persist();
        return { ok: true, room, player: existingPlayer, session };
      }
    }

    if (room.locked) {
      return { ok: false, error: 'This carnival room is currently locked by the host.' };
    }

    const activeCount = Object.values(room.players).filter((p) => p.online).length;
    if (activeCount >= room.maxPlayers) {
      return { ok: false, error: `Room is full (${room.maxPlayers} players max).` };
    }

    const cleanName = sanitizePlayerName(params.playerName);
    if (!cleanName) {
      return { ok: false, error: 'Please enter a valid player name.' };
    }

    const playerId = `pl_${crypto.randomUUID().slice(0, 8)}`;
    const sessionToken = crypto.randomUUID();
    const player = this.createNewPlayer(playerId, cleanName, false, params.avatar);
    room.players[playerId] = player;
    record.playerTokens[playerId] = sessionToken;

    room.chat.push({
      id: `msg_${Date.now()}_${playerId}`,
      playerId: 'system',
      playerName: 'Carnival Guide',
      isHost: false,
      text: `${cleanName} arrived at the Grand Entrance!`,
      timestamp: Date.now(),
      kind: 'system',
    });
    if (room.chat.length > 80) room.chat = room.chat.slice(-80);
    this.refreshLeaderboard(room);

    const session: AuthSession = { roomCode: code, playerId, sessionToken };
    if (params.socketId) {
      this.socketToSession.set(params.socketId, session);
    }
    this.persist();
    return { ok: true, room, player, session };
  }

  getRoom(code: string): RoomPublicState | null {
    return this.rooms.get(normalizeRoomCode(code))?.publicState ?? null;
  }

  roomExists(code: string): { exists: boolean; locked: boolean; playerCount: number; maxPlayers: number; name?: string } {
    const rec = this.rooms.get(normalizeRoomCode(code));
    if (!rec) return { exists: false, locked: false, playerCount: 0, maxPlayers: 0 };
    const r = rec.publicState;
    return {
      exists: true,
      locked: r.locked,
      playerCount: Object.values(r.players).filter((p) => p.online).length,
      maxPlayers: r.maxPlayers,
      name: r.name,
    };
  }

  getSession(socketId: string): AuthSession | undefined {
    return this.socketToSession.get(socketId);
  }

  disconnectSocket(socketId: string): { roomCode: string; playerId: string; playerName: string } | null {
    const session = this.socketToSession.get(socketId);
    if (!session) return null;
    this.socketToSession.delete(socketId);
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const player = rec.publicState.players[session.playerId];
    if (!player) return null;
    player.online = false;
    player.speed = 0;
    // Drop any held ball safely
    if (player.heldBallId) {
      const ball = rec.publicState.balls.find((b) => b.id === player.heldBallId);
      if (ball) {
        ball.holderId = null;
        ball.x = player.x;
        ball.y = 0.5;
        ball.z = player.z;
      }
      player.heldBallId = null;
    }
    this.persist();
    return { roomCode: session.roomCode, playerId: session.playerId, playerName: player.name };
  }

  private verifyHost(roomCode: string, playerId: string, hostSecret?: string): StoredRoomRecord | null {
    const rec = this.rooms.get(roomCode);
    if (!rec) return null;
    if (rec.publicState.hostPlayerId !== playerId) return null;
    if (!hostSecret || hostSecret !== rec.hostSecret) return null;
    return rec;
  }

  updateMovement(
    session: AuthSession,
    payload: { x: number; y: number; z: number; rotY: number; speed: number; isJumping: boolean },
  ): PlayerState | null {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const player = rec.publicState.players[session.playerId];
    if (!player) return null;

    const clamped = clampWorldPosition(
      Number.isFinite(payload.x) ? payload.x : player.x,
      Number.isFinite(payload.z) ? payload.z : player.z,
    );
    player.x = clamped.x;
    player.y = Math.max(0, Math.min(24, Number.isFinite(payload.y) ? payload.y : 0));
    player.z = clamped.z;
    player.rotY = Number.isFinite(payload.rotY) ? payload.rotY : player.rotY;
    player.speed = Math.max(0, Math.min(22, Number.isFinite(payload.speed) ? payload.speed : 0));
    player.isJumping = Boolean(payload.isJumping);
    player.zone = detectZoneAt(player.x, player.z);
    if (player.speed > 0.4 && player.dance !== 'none') {
      player.dance = 'none';
    }
    if (player.consuming && Date.now() - player.consuming.startedAt > MAX_CONSUME_DURATION_MS) {
      player.consuming = null;
    }
    return player;
  }

  updateAvatar(session: AuthSession, avatar: AvatarConfig): PlayerState | null {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const player = rec.publicState.players[session.playerId];
    if (!player) return null;
    player.avatar = {
      skinTone: avatar.skinTone,
      hairstyle: avatar.hairstyle,
      hairColor: avatar.hairColor,
      outfit: avatar.outfit,
      topColor: avatar.topColor,
      bottomColor: avatar.bottomColor,
      accessories: [...avatar.accessories].slice(0, 5),
    };
    this.persist();
    return player;
  }

  setDance(session: AuthSession, dance: DanceId): PlayerState | null {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const player = rec.publicState.players[session.playerId];
    if (!player) return null;
    player.dance = dance;
    if (dance !== 'none') {
      player.stats.dancesPerformed += 1;
      this.refreshLeaderboard(rec.publicState);
    }
    this.persist();
    return player;
  }

  purchaseFood(
    session: AuthSession,
    itemId: string,
    quantity = 1,
  ):
    | { ok: true; player: PlayerState; room: RoomPublicState; purchasedItemName: string }
    | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const player = rec.publicState.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };

    const check = validateFoodPurchase(player.coins, itemId, quantity);
    if (!check.ok) return check;

    player.coins = check.newBalance;
    for (let i = 0; i < quantity; i++) {
      const entry = createInventoryEntry(check.item, `inv_${crypto.randomUUID().slice(0, 8)}`);
      player.inventory.push(entry);
    }

    rec.publicState.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      playerId: player.id,
      playerName: player.name,
      type: 'purchase',
      amount: -check.totalCost,
      itemName: `${check.item.name}${quantity > 1 ? ` x${quantity}` : ''}`,
      timestamp: Date.now(),
    });
    if (rec.publicState.transactions.length > 60) {
      rec.publicState.transactions = rec.publicState.transactions.slice(0, 60);
    }

    this.persist();
    return {
      ok: true,
      player,
      room: rec.publicState,
      purchasedItemName: check.item.name,
    };
  }

  consumeFoodBite(
    session: AuthSession,
    instanceId: string,
  ): { ok: true; player: PlayerState; finished: boolean; itemName: string; isDrink: boolean } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const player = rec.publicState.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };

    const entry = player.inventory.find((i) => i.instanceId === instanceId);
    if (!entry) return { ok: false, error: 'Item is not in your inventory.' };
    if (entry.category === 'firework') {
      return { ok: false, error: 'Use Light & Burn to launch fireworks and crackers!' };
    }

    const res = consumeInventoryBite(player.inventory, instanceId);
    if (!res.ok) return res;

    player.inventory = res.updatedInventory;
    if (res.finished) {
      player.consuming = null;
      player.stats.foodsEaten += 1;
      this.refreshLeaderboard(rec.publicState);
    } else {
      player.consuming = {
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

    this.persist();
    return {
      ok: true,
      player,
      finished: res.finished,
      itemName: res.entry.name,
      isDrink: res.entry.isDrink,
    };
  }

  igniteFirework(
    session: AuthSession,
    instanceId: string,
    x?: number,
    z?: number,
  ):
    | { ok: true; player: PlayerState; event: FireworkIgnitedEvent; remainingUses: number }
    | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const player = rec.publicState.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };

    const entry = player.inventory.find((i) => i.instanceId === instanceId);
    if (!entry || entry.category !== 'firework') {
      return { ok: false, error: 'Firework item not found in your bag.' };
    }

    const res = consumeInventoryBite(player.inventory, instanceId);
    if (!res.ok) return res;

    player.inventory = res.updatedInventory;
    const clamped = clampWorldPosition(
      Number.isFinite(x) ? Number(x) : player.x + Math.sin(player.rotY) * 2.2,
      Number.isFinite(z) ? Number(z) : player.z + Math.cos(player.rotY) * 2.2,
    );

    const event: FireworkIgnitedEvent = {
      id: `fw_${crypto.randomUUID().slice(0, 8)}`,
      playerId: player.id,
      playerName: player.name,
      itemName: entry.name,
      effect: entry.fireworkEffect ?? 'skyshot',
      x: clamped.x,
      y: 0.2,
      z: clamped.z,
      primaryColor: entry.primaryColor,
      secondaryColor: entry.secondaryColor,
      timestamp: Date.now(),
    };

    this.persist();
    return {
      ok: true,
      player,
      event,
      remainingUses: res.remainingBites,
    };
  }

  stopConsuming(session: AuthSession): PlayerState | null {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const player = rec.publicState.players[session.playerId];
    if (!player) return null;
    player.consuming = null;
    return player;
  }

  sendChat(
    session: AuthSession,
    rawText: string,
  ): { ok: true; message: ChatMessage; player: PlayerState } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const player = room.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };

    if (room.chatDisabled && !player.isHost) {
      return { ok: false, error: 'Chat is currently paused by the host.' };
    }
    if (player.muted && !player.isHost) {
      return { ok: false, error: 'You have been muted by the host.' };
    }

    // Rate limit: max 5 messages per 8 seconds
    const now = Date.now();
    const recent = (this.chatTimestamps.get(player.id) || []).filter((t) => now - t < 8000);
    if (recent.length >= 5) {
      return { ok: false, error: 'Slow down a moment before sending another message!' };
    }
    recent.push(now);
    this.chatTimestamps.set(player.id, recent);

    const filtered = filterChatMessage(rawText);
    if (!filtered.allowed) {
      return { ok: false, error: filtered.reason || 'Message blocked by safety filter.' };
    }

    const msg: ChatMessage = {
      id: `msg_${now}_${crypto.randomUUID().slice(0, 5)}`,
      playerId: player.id,
      playerName: player.name,
      isHost: player.isHost,
      text: filtered.sanitized,
      timestamp: now,
      kind: 'chat',
    };
    room.chat.push(msg);
    if (room.chat.length > 80) room.chat = room.chat.slice(-80);

    player.lastBubbleText = filtered.sanitized;
    player.lastBubbleAt = now;
    this.persist();
    return { ok: true, message: msg, player };
  }

  reportPlayer(
    session: AuthSession,
    targetPlayerId: string,
    reason: string,
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const reporter = room.players[session.playerId];
    const target = room.players[targetPlayerId];
    if (!reporter || !target) return { ok: false, error: 'Player not found.' };

    room.reports.unshift({
      id: `rep_${crypto.randomUUID().slice(0, 8)}`,
      reporterId: reporter.id,
      reporterName: reporter.name,
      targetPlayerId: target.id,
      targetPlayerName: target.name,
      reason: reason.slice(0, 140) || 'Inappropriate behavior',
      timestamp: Date.now(),
      resolved: false,
    });
    this.persist();
    return { ok: true, room };
  }

  // Ball & Sports Sync
  pickupBall(session: AuthSession, ballId: string): { ok: true; balls: BallState[]; player: PlayerState } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const player = rec.publicState.players[session.playerId];
    const ball = rec.publicState.balls.find((b) => b.id === ballId);
    if (!player || !ball) return { ok: false, error: 'Ball not found.' };
    if (ball.holderId && ball.holderId !== player.id) {
      return { ok: false, error: 'Another player is holding this ball.' };
    }
    // Release any currently held ball first
    if (player.heldBallId && player.heldBallId !== ball.id) {
      const prev = rec.publicState.balls.find((b) => b.id === player.heldBallId);
      if (prev) prev.holderId = null;
    }
    ball.holderId = player.id;
    ball.vx = 0;
    ball.vy = 0;
    ball.vz = 0;
    ball.updatedAt = Date.now();
    player.heldBallId = ball.id;
    return { ok: true, balls: rec.publicState.balls, player };
  }

  kickOrThrowBall(
    session: AuthSession,
    payload: { ballId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number },
  ): { balls: BallState[]; player: PlayerState } | null {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const player = rec.publicState.players[session.playerId];
    const ball = rec.publicState.balls.find((b) => b.id === payload.ballId);
    if (!player || !ball) return null;

    if (ball.lastKickerId && ball.lastKickerId !== player.id) {
      const prevKicker = rec.publicState.players[ball.lastKickerId];
      if (prevKicker) {
        prevKicker.stats.passesMade += 1;
      }
    }

    ball.holderId = null;
    ball.lastKickerId = player.id;
    ball.x = payload.x;
    ball.y = Math.max(0.4, payload.y);
    ball.z = payload.z;
    ball.vx = Math.max(-28, Math.min(28, payload.vx));
    ball.vy = Math.max(-15, Math.min(22, payload.vy));
    ball.vz = Math.max(-28, Math.min(28, payload.vz));
    ball.updatedAt = Date.now();
    if (player.heldBallId === ball.id) {
      player.heldBallId = null;
    }
    this.refreshLeaderboard(rec.publicState);
    return { balls: rec.publicState.balls, player };
  }

  recordSportsGoal(
    session: AuthSession,
    sport: 'football' | 'basketball',
  ): { room: RoomPublicState; rewardCoins: number } | null {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return null;
    const room = rec.publicState;
    const player = room.players[session.playerId];
    if (!player) return null;

    const rewardCoins = sport === 'basketball' ? 12 : 8;
    player.stats.sportsScore += 1;
    if (sport === 'football') player.stats.goalsScored += 1;
    else player.stats.basketsScored += 1;
    player.coins += rewardCoins;

    room.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      playerId: player.id,
      playerName: player.name,
      type: 'reward',
      amount: rewardCoins,
      itemName: sport === 'football' ? 'Football Goal Bonus' : 'Basketball Hoop Bonus',
      timestamp: Date.now(),
    });
    this.refreshLeaderboard(room);
    this.persist();
    return { room, rewardCoins };
  }

  // Treasure Hunt
  claimTreasure(
    session: AuthSession,
    treasureId: string,
  ): { ok: true; room: RoomPublicState; rewardCoins: number; label: string } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const player = room.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };
    if (!room.treasureHunt.active) {
      return { ok: false, error: 'Treasure Hunt is not currently active.' };
    }
    const node = room.treasureHunt.nodes.find((n) => n.id === treasureId);
    if (!node) return { ok: false, error: 'Treasure not found.' };
    if (node.claimedBy) {
      return { ok: false, error: `Already found by ${node.claimedByName}!` };
    }

    node.claimedBy = player.id;
    node.claimedByName = player.name;
    player.coins += node.rewardCoins;
    player.stats.treasuresFound += 1;

    room.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      playerId: player.id,
      playerName: player.name,
      type: 'reward',
      amount: node.rewardCoins,
      itemName: `Treasure: ${node.label}`,
      timestamp: Date.now(),
    });
    this.refreshLeaderboard(room);
    this.persist();
    return { ok: true, room, rewardCoins: node.rewardCoins, label: node.label };
  }

  // Arcade Mini-Games & Matchmaking
  submitArcadeScore(
    session: AuthSession,
    gameId: ArcadeGameId,
    rawScore: number,
    won: boolean,
  ): { ok: true; room: RoomPublicState; rewardCoins: number; validatedScore: number } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const player = room.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };

    const valid = validateArcadeScore(gameId, rawScore);
    if (!valid.ok) return valid;

    if (won && valid.score >= 350) player.stats.arcadeWins += 1;
    player.stats.arcadeBestTotal += Math.round(valid.score / 10);
    const rewardCoins =
      valid.score < 200
        ? 0
        : won && valid.score >= 350
          ? Math.min(25, Math.max(5, Math.floor((valid.score - 150) / 45)))
          : Math.min(12, Math.max(3, Math.floor((valid.score - 150) / 60)));
    player.coins += rewardCoins;

    if (rewardCoins > 0) {
      room.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        playerId: player.id,
        playerName: player.name,
        type: 'reward',
        amount: rewardCoins,
        itemName: `Arcade (${gameId.replace(/_/g, ' ')})`,
        timestamp: Date.now(),
      });
    }

    this.refreshLeaderboard(room);
    this.persist();
    return { ok: true, room, rewardCoins, validatedScore: valid.score };
  }

  createTicTacToeChallenge(session: AuthSession): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const player = room.players[session.playerId];
    if (!player) return { ok: false, error: 'Player not found.' };

    room.arcadeChallenge = {
      id: `ch_${crypto.randomUUID().slice(0, 6)}`,
      gameId: 'tic_tac_toe',
      hostPlayerId: player.id,
      hostName: player.name,
      opponentId: null,
      opponentName: null,
      status: 'waiting',
      readyIds: [player.id],
      roundDurationSec: 60,
      startedAt: null,
      boardState: Array(9).fill(null),
      turnPlayerId: player.id,
      scores: { [player.id]: 0 },
      winnerId: null,
    };
    this.persist();
    return { ok: true, room };
  }

  joinTicTacToeChallenge(session: AuthSession): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const player = room.players[session.playerId];
    const ch = room.arcadeChallenge;
    if (!player || !ch) return { ok: false, error: 'No active challenge.' };
    if (ch.hostPlayerId === player.id) return { ok: false, error: 'Waiting for another player to join.' };
    if (ch.opponentId && ch.opponentId !== player.id) return { ok: false, error: 'Match already has two players.' };

    ch.opponentId = player.id;
    ch.opponentName = player.name;
    ch.scores[player.id] = 0;
    if (!ch.readyIds.includes(player.id)) ch.readyIds.push(player.id);
    ch.status = 'playing';
    ch.startedAt = Date.now();
    ch.turnPlayerId = ch.hostPlayerId;
    this.persist();
    return { ok: true, room };
  }

  playTicTacToeMove(
    session: AuthSession,
    cellIndex: number,
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.rooms.get(session.roomCode);
    if (!rec) return { ok: false, error: 'Room not found.' };
    const room = rec.publicState;
    const ch = room.arcadeChallenge;
    if (!ch || ch.status !== 'playing') return { ok: false, error: 'Match is not active.' };
    if (ch.turnPlayerId !== session.playerId) return { ok: false, error: 'Not your turn.' };
    if (cellIndex < 0 || cellIndex > 8 || ch.boardState[cellIndex] !== null) {
      return { ok: false, error: 'Invalid square.' };
    }

    const mark = session.playerId === ch.hostPlayerId ? 'X' : 'O';
    ch.boardState[cellIndex] = mark;

    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    let won = false;
    for (const [a, b, c] of lines) {
      if (ch.boardState[a] && ch.boardState[a] === ch.boardState[b] && ch.boardState[a] === ch.boardState[c]) {
        won = true;
        break;
      }
    }

    if (won) {
      ch.status = 'finished';
      ch.winnerId = session.playerId;
      const winner = room.players[session.playerId];
      if (winner) {
        winner.stats.arcadeWins += 1;
        winner.stats.arcadeBestTotal += 100;
        winner.coins += 40;
      }
      this.refreshLeaderboard(room);
    } else if (ch.boardState.every((c) => c !== null)) {
      ch.status = 'finished';
      ch.winnerId = 'draw';
    } else {
      ch.turnPlayerId = session.playerId === ch.hostPlayerId ? ch.opponentId : ch.hostPlayerId;
    }
    this.persist();
    return { ok: true, room };
  }

  // HOST-ONLY ADMIN ACTIONS (server-verified hostSecret!)
  hostSetRoomLock(session: AuthSession, locked: boolean): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    rec.publicState.locked = locked;
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostSetChatDisabled(
    session: AuthSession,
    disabled: boolean,
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    rec.publicState.chatDisabled = disabled;
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostMutePlayer(
    session: AuthSession,
    targetPlayerId: string,
    muted: boolean,
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const target = rec.publicState.players[targetPlayerId];
    if (!target || target.isHost) return { ok: false, error: 'Cannot mute this player.' };
    target.muted = muted;
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostKickPlayer(
    session: AuthSession,
    targetPlayerId: string,
  ): { ok: true; room: RoomPublicState; kickedSocketIds: string[] } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const target = rec.publicState.players[targetPlayerId];
    if (!target || target.isHost) return { ok: false, error: 'Cannot kick host or missing player.' };

    delete rec.publicState.players[targetPlayerId];
    delete rec.playerTokens[targetPlayerId];
    const kickedSocketIds: string[] = [];
    for (const [sid, s] of this.socketToSession.entries()) {
      if (s.roomCode === session.roomCode && s.playerId === targetPlayerId) {
        kickedSocketIds.push(sid);
        this.socketToSession.delete(sid);
      }
    }
    this.refreshLeaderboard(rec.publicState);
    this.persist();
    return { ok: true, room: rec.publicState, kickedSocketIds };
  }

  hostResolveReport(session: AuthSession, reportId: string): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const rep = rec.publicState.reports.find((r) => r.id === reportId);
    if (rep) rep.resolved = true;
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostAdjustCoins(
    session: AuthSession,
    targetPlayerId: string,
    delta: number,
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const target = rec.publicState.players[targetPlayerId];
    if (!target) return { ok: false, error: 'Player not found.' };
    const rounded = Math.round(delta);
    target.coins = Math.max(0, Math.min(99999, target.coins + rounded));
    rec.publicState.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      playerId: target.id,
      playerName: target.name,
      type: rounded >= 0 ? 'host_grant' : 'host_deduct',
      amount: rounded,
      itemName: rounded >= 0 ? 'Host Coin Gift' : 'Host Coin Adjustment',
      timestamp: Date.now(),
    });
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostTeleportAll(session: AuthSession, zoneId: ZoneId): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const zone = CARNIVAL_ZONES.find((z) => z.id === zoneId);
    if (!zone) return { ok: false, error: 'Zone not found.' };
    const players = Object.values(rec.publicState.players);
    players.forEach((p, idx) => {
      const angle = (idx / Math.max(1, players.length)) * Math.PI * 2;
      p.x = zone.spawnX + Math.cos(angle) * 2.5;
      p.y = 0;
      p.z = zone.spawnZ + Math.sin(angle) * 2.5;
      p.zone = zone.id;
    });
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostAnnounce(session: AuthSession, text: string): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const host = rec.publicState.players[session.playerId];
    const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, 200);
    if (!clean) return { ok: false, error: 'Announcement cannot be empty.' };

    const now = Date.now();
    rec.publicState.announcement = {
      id: `ann_${now}`,
      text: clean,
      senderName: host?.name || 'Host',
      timestamp: now,
    };
    rec.publicState.chat.push({
      id: `msg_${now}`,
      playerId: session.playerId,
      playerName: host?.name || 'Host',
      isHost: true,
      text: clean,
      timestamp: now,
      kind: 'announcement',
    });
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostUpdateDj(
    session: AuthSession,
    patch: {
      trackId?: string;
      youtubeInput?: string | null;
      isPlaying?: boolean;
      volume?: number;
      lightingMode?: LightingMode;
      next?: boolean;
      prev?: boolean;
    },
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const dj = rec.publicState.dj;

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

    if (patch.volume !== undefined) {
      dj.volume = Math.max(0, Math.min(100, Math.round(patch.volume)));
    }
    if (patch.lightingMode) {
      dj.lightingMode = patch.lightingMode;
    }

    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostStartTreasureHunt(
    session: AuthSession,
    durationSec = 180,
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };

    const shuffled = [...TREASURE_SPAWN_LOCATIONS].sort(() => Math.random() - 0.5);
    rec.publicState.treasureHunt = {
      active: true,
      startedAt: Date.now(),
      durationSec: Math.max(60, Math.min(600, durationSec)),
      nodes: shuffled.map((n) => ({
        ...n,
        claimedBy: null,
        claimedByName: null,
      })),
    };
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostEndTreasureHunt(session: AuthSession): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    rec.publicState.treasureHunt.active = false;
    this.persist();
    return { ok: true, room: rec.publicState };
  }

  hostTriggerEvent(
    session: AuthSession,
    payload: { phase?: EventPhase; groupDance?: DanceId | null; fireworks?: boolean; timeOfDay?: TimeOfDay },
  ): { ok: true; room: RoomPublicState } | { ok: false; error: string } {
    const rec = this.verifyHost(session.roomCode, session.playerId, session.hostSecret);
    if (!rec) return { ok: false, error: 'Host authorization required.' };
    const room = rec.publicState;

    if (payload.phase) room.eventPhase = payload.phase;
    if (payload.timeOfDay && ['day', 'sunset', 'night'].includes(payload.timeOfDay)) {
      room.timeOfDay = payload.timeOfDay;
    }
    if (payload.groupDance !== undefined) {
      room.groupDanceActive = payload.groupDance;
      if (payload.groupDance && payload.groupDance !== 'none') {
        for (const p of Object.values(room.players)) {
          p.dance = payload.groupDance;
        }
      }
    }
    if (payload.fireworks) {
      room.fireworksBurstAt = Date.now();
    }
    this.persist();
    return { ok: true, room };
  }
}
