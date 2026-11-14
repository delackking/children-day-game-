import { io, type Socket } from 'socket.io-client';
import { useGameStore } from '../stores/useGameStore';
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

class CarnivalSocketClient {
  private socket: Socket | null = null;
  private lastMoveSentAt = 0;

  connect(): Socket {
    if (this.socket) return this.socket;
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      useGameStore.getState().setConnected(true);
      // Auto-rejoin if disconnected mid-session
      const st = useGameStore.getState();
      if (st.screen === 'playing' && st.room && st.sessionToken && st.localPlayerId) {
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

  emitAck<T = { ok: boolean; error?: string }>(event: string, payload?: unknown): Promise<T> {
    const socket = this.connect();
    return new Promise((resolve) => {
      if (payload === undefined) {
        socket.emit(event, (res: T) => resolve(res));
      } else {
        socket.emit(event, payload, (res: T) => resolve(res));
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
    }
    return res;
  }

  async joinRoom(payload: { roomCode: string; playerName: string; avatar: AvatarConfig }) {
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
    const now = performance.now();
    if (now - this.lastMoveSentAt < 65) return; // ~15Hz network cap (never 60Hz)
    this.lastMoveSentAt = now;
    this.socket?.emit('player:move', payload);
  }

  updateAvatar(avatar: AvatarConfig) {
    return this.emitAck('player:avatar', avatar);
  }

  setDance(dance: DanceId) {
    this.socket?.emit('player:dance', dance);
  }

  purchaseFood(itemId: string, quantity = 1) {
    return this.emitAck<{ ok: boolean; error?: string; player?: PlayerState; purchasedItemName?: string }>(
      'food:purchase',
      { itemId, quantity },
    );
  }

  consumeFoodBite(instanceId: string) {
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
    this.socket?.emit('food:stop');
  }

  igniteFirework(instanceId: string, x?: number, z?: number) {
    return this.emitAck<{
      ok: boolean;
      error?: string;
      player?: PlayerState;
      event?: FireworkIgnitedEvent;
      remainingUses?: number;
    }>('firework:ignite', { instanceId, x, z });
  }

  sendChat(text: string) {
    return this.emitAck<{ ok: boolean; error?: string }>('chat:send', { text });
  }

  reportPlayer(targetPlayerId: string, reason: string) {
    return this.emitAck('chat:report', { targetPlayerId, reason });
  }

  pickupBall(ballId: string) {
    return this.emitAck('ball:pickup', { ballId });
  }

  kickBall(payload: { ballId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }) {
    this.socket?.emit('ball:kick', payload);
  }

  recordGoal(sport: 'football' | 'basketball') {
    return this.emitAck<{ ok: boolean; rewardCoins?: number }>('sports:goal', { sport });
  }

  claimTreasure(treasureId: string) {
    return this.emitAck<{ ok: boolean; error?: string; rewardCoins?: number; label?: string }>('treasure:claim', {
      treasureId,
    });
  }

  submitArcadeScore(gameId: ArcadeGameId, score: number, won: boolean) {
    return this.emitAck<{ ok: boolean; error?: string; rewardCoins?: number; validatedScore?: number }>(
      'arcade:score',
      { gameId, score, won },
    );
  }

  createTicTacToeChallenge() {
    return this.emitAck('arcade:ttt_create');
  }

  joinTicTacToeChallenge() {
    return this.emitAck('arcade:ttt_join');
  }

  playTicTacToeMove(cellIndex: number) {
    return this.emitAck('arcade:ttt_move', { cellIndex });
  }

  // Host actions
  hostSetLock(locked: boolean) {
    return this.emitAck('host:lock', { locked });
  }
  hostToggleChat(disabled: boolean) {
    return this.emitAck('host:chat_toggle', { disabled });
  }
  hostMute(targetPlayerId: string, muted: boolean) {
    return this.emitAck('host:mute', { targetPlayerId, muted });
  }
  hostKick(targetPlayerId: string) {
    return this.emitAck('host:kick', { targetPlayerId });
  }
  hostResolveReport(reportId: string) {
    return this.emitAck('host:resolve_report', { reportId });
  }
  hostAdjustCoins(targetPlayerId: string, delta: number) {
    return this.emitAck('host:coins', { targetPlayerId, delta });
  }
  hostTeleportAll(zoneId: ZoneId) {
    return this.emitAck('host:teleport_all', { zoneId });
  }
  hostAnnounce(text: string) {
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
    return this.emitAck('host:dj', patch);
  }
  hostStartTreasure(durationSec = 180) {
    return this.emitAck('host:treasure_start', { durationSec });
  }
  hostEndTreasure() {
    return this.emitAck('host:treasure_end');
  }
  hostTriggerEvent(payload: { phase?: EventPhase; groupDance?: DanceId | null; fireworks?: boolean; timeOfDay?: TimeOfDay }) {
    return this.emitAck('host:event', payload);
  }
}

export const socketClient = new CarnivalSocketClient();
