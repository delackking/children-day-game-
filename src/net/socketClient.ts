import { io, type Socket } from 'socket.io-client';
import { LocalCarnivalSession } from './localCarnival';
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

function resolveServerUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const paramServer = params.get('server')?.trim();
    if (paramServer && /^https?:\/\//i.test(paramServer)) {
      return paramServer.replace(/\/+$/, '');
    }
  } catch {
    // ignore malformed URL
  }
  const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SERVER_URL;
  if (envUrl && /^https?:\/\//i.test(envUrl.trim())) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

class CarnivalSocketClient {
  private socket: Socket | null = null;
  private lastMoveSentAt = 0;
  private probePromise: Promise<boolean> | null = null;
  private backendAvailable: boolean | null = null;
  private localSession = new LocalCarnivalSession();

  isOfflineMode(): boolean {
    return this.localSession.isActive();
  }

  private async probeBackend(): Promise<boolean> {
    if (this.backendAvailable !== null) return this.backendAvailable;
    if (this.probePromise) return this.probePromise;

    this.probePromise = (async () => {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        this.backendAvailable = false;
        return false;
      }
      const baseUrl = resolveServerUrl();
      const healthUrl = `${baseUrl}/api/health`;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(healthUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          this.backendAvailable = false;
          return false;
        }
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) {
          this.backendAvailable = false;
          return false;
        }
        const data = (await res.json()) as { ok?: boolean };
        const healthy = Boolean(data?.ok);
        this.backendAvailable = healthy;
        return healthy;
      } catch {
        this.backendAvailable = false;
        return false;
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return this.probePromise;
  }

  private openSocket(): Socket {
    if (this.socket) return this.socket;
    const baseUrl = resolveServerUrl();
    const socket = io(baseUrl || undefined, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      useGameStore.getState().setConnected(true);
      // Auto-rejoin if disconnected mid-session
      const st = useGameStore.getState();
      if (st.screen === 'playing' && st.room && st.sessionToken && st.localPlayerId && !this.localSession.isActive()) {
        const local = st.room.players[st.localPlayerId];
        socket.emit(
          'room:join',
          {
            roomCode: st.room.code,
            playerName: local?.name || 'Guest',
            sessionToken: st.sessionToken,
            hostSecret: st.hostSecret ?? undefined,
          },
          (res: { ok: boolean; room?: RoomPublicState }) => {
            if (res?.ok && res.room) {
              useGameStore.getState().setRoom(res.room);
            }
          },
        );
      }
    });

    socket.on('disconnect', () => {
      useGameStore.getState().setConnected(false);
    });

    socket.on('connect_error', () => {
      useGameStore.getState().setConnected(false);
    });

    socket.on('room:state', (room: RoomPublicState) => {
      useGameStore.getState().setRoom(room);
    });

    socket.on(
      'player:moved',
      (payload: {
        playerId: string;
        x: number;
        y: number;
        z: number;
        rotY: number;
        speed: number;
        isJumping: boolean;
        zone: ZoneId;
        dance: DanceId;
      }) => {
        if (payload.playerId === useGameStore.getState().localPlayerId) return;
        useGameStore.getState().updateRemotePlayerPos(payload);
      },
    );

    socket.on('player:updated', (player: PlayerState) => {
      useGameStore.getState().updateSinglePlayer(player);
    });

    socket.on('balls:sync', (balls: BallState[]) => {
      useGameStore.getState().updateBalls(balls);
    });

    socket.on('chat:message', (payload: { message: ChatMessage; player: PlayerState }) => {
      useGameStore.getState().appendChatMessage(payload.message, payload.player);
    });

    socket.on('firework:ignited', (ev: FireworkIgnitedEvent) => {
      useGameStore.getState().enqueueFireworkEvent(ev);
    });

    socket.on('room:teleported', (payload: { zoneId: ZoneId; players: Record<string, PlayerState> }) => {
      const st = useGameStore.getState();
      const me = st.localPlayerId ? payload.players[st.localPlayerId] : null;
      if (me) {
        st.triggerLocalTeleport(me.x, me.z);
        st.pushToast(`Host gathered everyone at ${payload.zoneId.replace(/_/g, ' ')}!`, 'info');
      }
    });

    socket.on('player:kicked', (payload: { reason: string }) => {
      useGameStore.getState().leaveRoom();
      useGameStore.getState().setErrorBanner(payload.reason);
    });

    this.socket = socket;
    return socket;
  }

  connect(): Socket | null {
    if (this.socket) return this.socket;
    if (this.backendAvailable === true) {
      return this.openSocket();
    }
    if (this.backendAvailable === null) {
      void this.probeBackend().then((ok) => {
        if (ok && !this.socket && !this.localSession.isActive()) {
          this.openSocket();
        }
      });
    }
    return null;
  }

  private async ensureLiveSocket(): Promise<Socket | null> {
    if (this.localSession.isActive()) return null;
    if (this.socket?.connected) return this.socket;
    const healthy = await this.probeBackend();
    if (!healthy) return null;
    const sock = this.openSocket();
    if (sock.connected) return sock;
    return new Promise((resolve) => {
      let settled = false;
      const done = (val: Socket | null) => {
        if (settled) return;
        settled = true;
        sock.off('connect', onConnect);
        sock.off('connect_error', onError);
        resolve(val);
      };
      const onConnect = () => done(sock);
      const onError = () => done(null);
      sock.once('connect', onConnect);
      sock.once('connect_error', onError);
      window.setTimeout(() => done(sock.connected ? sock : null), 3000);
    });
  }

  emitAck<T = { ok: boolean; error?: string }>(event: string, payload?: unknown): Promise<T> {
    const socket = this.socket;
    if (!socket) {
      return Promise.resolve({ ok: false, error: 'Server connection unavailable.' } as T);
    }
    return new Promise((resolve) => {
      let finished = false;
      const timer = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        resolve({ ok: false, error: 'Request timed out. Please try again.' } as T);
      }, 5000);
      const handleAck = (res: T) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        resolve(res);
      };
      if (payload === undefined) {
        socket.emit(event, handleAck);
      } else {
        socket.emit(event, payload, handleAck);
      }
    });
  }

  async createRoom(payload: {
    hostName: string;
    roomName?: string;
    maxPlayers?: number;
    avatar: AvatarConfig;
    preferredCode?: string;
  }) {
    this.localSession.reset();
    const sock = await this.ensureLiveSocket();
    if (sock) {
      const res = await this.emitAck<{
        ok: boolean;
        error?: string;
        room?: RoomPublicState;
        playerId?: string;
        session?: { sessionToken: string; hostSecret?: string };
      }>('room:create', payload);
      if (res.ok && res.room && res.playerId && res.session) {
        useGameStore.getState().setSessionData({
          room: res.room,
          playerId: res.playerId,
          sessionToken: res.session.sessionToken,
          hostSecret: res.session.hostSecret,
        });
        return res;
      }
      if (res.error && !res.error.includes('unavailable') && !res.error.includes('timed out')) {
        return res;
      }
    }

    // Graceful local Solo Carnival fallback when deployed on static hosting without a Node backend
    const localRes = this.localSession.createRoom(payload);
    if (localRes.ok) {
      useGameStore.getState().setConnected(true);
      useGameStore
        .getState()
        .pushToast('Solo Carnival Mode active (no live multiplayer server detected on this host).', 'info');
    }
    return localRes;
  }

  async joinRoom(payload: { roomCode: string; playerName: string; avatar: AvatarConfig }) {
    this.localSession.reset();
    const sock = await this.ensureLiveSocket();
    if (!sock) {
      return {
        ok: false,
        error:
          'No live multiplayer server is running on this host. Click Host Party to play Solo Carnival, or run the Node.js server.',
      };
    }
    const res = await this.emitAck<{
      ok: boolean;
      error?: string;
      room?: RoomPublicState;
      playerId?: string;
      session?: { sessionToken: string; hostSecret?: string };
    }>('room:join', payload);
    if (res.ok && res.room && res.playerId && res.session) {
      useGameStore.getState().setSessionData({
        room: res.room,
        playerId: res.playerId,
        sessionToken: res.session.sessionToken,
        hostSecret: res.session.hostSecret,
      });
    }
    return res;
  }

  sendMove(payload: { x: number; y: number; z: number; rotY: number; speed: number; isJumping: boolean }) {
    if (this.localSession.isActive()) {
      this.localSession.updateMove(payload);
      return;
    }
    const now = performance.now();
    if (now - this.lastMoveSentAt < 65) return; // ~15Hz network cap (never 60Hz)
    this.lastMoveSentAt = now;
    this.socket?.emit('player:move', payload);
  }

  updateAvatar(avatar: AvatarConfig) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.updateAvatar(avatar));
    return this.emitAck('player:avatar', avatar);
  }

  setDance(dance: DanceId) {
    if (this.localSession.isActive()) {
      this.localSession.setDance(dance);
      return;
    }
    this.socket?.emit('player:dance', dance);
  }

  purchaseFood(itemId: string, quantity = 1) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.purchaseFood(itemId, quantity));
    return this.emitAck<{ ok: boolean; error?: string; player?: PlayerState; purchasedItemName?: string }>(
      'food:purchase',
      { itemId, quantity },
    );
  }

  consumeFoodBite(instanceId: string) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.consumeFoodBite(instanceId));
    return this.emitAck<{
      ok: boolean;
      error?: string;
      player?: PlayerState;
      finished?: boolean;
      itemName?: string;
      isDrink?: boolean;
    }>('food:consume', { instanceId });
  }

  stopConsuming() {
    if (this.localSession.isActive()) {
      this.localSession.stopConsuming();
      return;
    }
    this.socket?.emit('food:stop');
  }

  igniteFirework(instanceId: string, x?: number, z?: number) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.igniteFirework(instanceId, x, z));
    return this.emitAck<{
      ok: boolean;
      error?: string;
      player?: PlayerState;
      event?: FireworkIgnitedEvent;
      remainingUses?: number;
    }>('firework:ignite', { instanceId, x, z });
  }

  sendChat(text: string) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.sendChat(text));
    return this.emitAck<{ ok: boolean; error?: string }>('chat:send', { text });
  }

  reportPlayer(targetPlayerId: string, reason: string) {
    if (this.localSession.isActive()) return Promise.resolve({ ok: true });
    return this.emitAck('chat:report', { targetPlayerId, reason });
  }

  pickupBall(ballId: string) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.pickupBall(ballId));
    return this.emitAck('ball:pickup', { ballId });
  }

  kickBall(payload: { ballId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }) {
    if (this.localSession.isActive()) {
      this.localSession.kickBall(payload);
      return;
    }
    this.socket?.emit('ball:kick', payload);
  }

  recordGoal(sport: 'football' | 'basketball') {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.recordGoal(sport));
    return this.emitAck<{ ok: boolean; rewardCoins?: number }>('sports:goal', { sport });
  }

  claimTreasure(treasureId: string) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.claimTreasure(treasureId));
    return this.emitAck<{ ok: boolean; error?: string; rewardCoins?: number; label?: string }>('treasure:claim', {
      treasureId,
    });
  }

  submitArcadeScore(gameId: ArcadeGameId, score: number, won: boolean) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.submitArcadeScore(gameId, score, won));
    return this.emitAck<{ ok: boolean; error?: string; rewardCoins?: number; validatedScore?: number }>(
      'arcade:score',
      { gameId, score, won },
    );
  }

  createTicTacToeChallenge() {
    if (this.localSession.isActive()) {
      return Promise.resolve({ ok: false, error: '2-player Tic Tac Toe matchmaking requires a multiplayer server.' });
    }
    return this.emitAck('arcade:ttt_create');
  }

  joinTicTacToeChallenge() {
    if (this.localSession.isActive()) {
      return Promise.resolve({ ok: false, error: '2-player Tic Tac Toe matchmaking requires a multiplayer server.' });
    }
    return this.emitAck('arcade:ttt_join');
  }

  playTicTacToeMove(cellIndex: number) {
    if (this.localSession.isActive()) {
      return Promise.resolve({ ok: false, error: '2-player Tic Tac Toe matchmaking requires a multiplayer server.' });
    }
    return this.emitAck('arcade:ttt_move', { cellIndex });
  }

  // Host actions
  hostSetLock(locked: boolean) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostSetLock(locked));
    return this.emitAck('host:lock', { locked });
  }
  hostToggleChat(disabled: boolean) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostToggleChat(disabled));
    return this.emitAck('host:chat_toggle', { disabled });
  }
  hostMute(targetPlayerId: string, muted: boolean) {
    if (this.localSession.isActive()) return Promise.resolve({ ok: true });
    return this.emitAck('host:mute', { targetPlayerId, muted });
  }
  hostKick(targetPlayerId: string) {
    if (this.localSession.isActive()) return Promise.resolve({ ok: true });
    return this.emitAck('host:kick', { targetPlayerId });
  }
  hostResolveReport(reportId: string) {
    if (this.localSession.isActive()) return Promise.resolve({ ok: true });
    return this.emitAck('host:resolve_report', { reportId });
  }
  hostAdjustCoins(targetPlayerId: string, delta: number) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostAdjustCoins(targetPlayerId, delta));
    return this.emitAck('host:coins', { targetPlayerId, delta });
  }
  hostTeleportAll(zoneId: ZoneId) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostTeleportAll(zoneId));
    return this.emitAck('host:teleport_all', { zoneId });
  }
  hostAnnounce(text: string) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostAnnounce(text));
    return this.emitAck('host:announce', { text });
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
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostUpdateDj(patch));
    return this.emitAck('host:dj', patch);
  }
  hostStartTreasure(durationSec = 180) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostStartTreasure(durationSec));
    return this.emitAck('host:treasure_start', { durationSec });
  }
  hostEndTreasure() {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostEndTreasure());
    return this.emitAck('host:treasure_end');
  }
  hostTriggerEvent(payload: { phase?: EventPhase; groupDance?: DanceId | null; fireworks?: boolean; timeOfDay?: TimeOfDay }) {
    if (this.localSession.isActive()) return Promise.resolve(this.localSession.hostTriggerEvent(payload));
    return this.emitAck('host:event', payload);
  }
}

export const socketClient = new CarnivalSocketClient();
