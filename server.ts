import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { RoomManager } from './server/roomManager';
import type {
  ArcadeGameId,
  AvatarConfig,
  DanceId,
  EventPhase,
  LightingMode,
  TimeOfDay,
  ZoneId,
} from './src/shared/types';

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const roomManager = new RoomManager({ persist: true });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'ready' });
  });

  // Minimal room code existence check (does not leak player lists or private details)
  app.get('/api/rooms/check/:code', (req, res) => {
    const info = roomManager.roomExists(req.params.code);
    res.json(info);
  });

  io.on('connection', (socket) => {
    socket.on(
      'room:create',
      (
        payload: {
          hostName: string;
          roomName?: string;
          maxPlayers?: number;
          avatar?: Partial<AvatarConfig>;
          preferredCode?: string;
        },
        ack?: (res: unknown) => void,
      ) => {
        const res = roomManager.createRoom({ ...payload, socketId: socket.id });
        if (!res.ok) {
          ack?.(res);
          return;
        }
        socket.join(res.room.code);
        ack?.({ ok: true, room: res.room, playerId: res.player.id, session: res.session });
      },
    );

    socket.on(
      'room:join',
      (
        payload: {
          roomCode: string;
          playerName: string;
          avatar?: Partial<AvatarConfig>;
          sessionToken?: string;
          hostSecret?: string;
        },
        ack?: (res: unknown) => void,
      ) => {
        const res = roomManager.joinRoom({ ...payload, socketId: socket.id });
        if (!res.ok) {
          ack?.(res);
          return;
        }
        socket.join(res.room.code);
        ack?.({ ok: true, room: res.room, playerId: res.player.id, session: res.session });
        socket.to(res.room.code).emit('room:state', res.room);
      },
    );

    socket.on(
      'player:move',
      (payload: { x: number; y: number; z: number; rotY: number; speed: number; isJumping: boolean }) => {
        const session = roomManager.getSession(socket.id);
        if (!session) return;
        const player = roomManager.updateMovement(session, payload);
        if (!player) return;
        socket.to(session.roomCode).emit('player:moved', {
          playerId: player.id,
          x: player.x,
          y: player.y,
          z: player.z,
          rotY: player.rotY,
          speed: player.speed,
          isJumping: player.isJumping,
          zone: player.zone,
          dance: player.dance,
        });
      },
    );

    socket.on('player:avatar', (avatar: AvatarConfig, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const player = roomManager.updateAvatar(session, avatar);
      if (!player) return ack?.({ ok: false, error: 'Player not found.' });
      io.to(session.roomCode).emit('player:updated', player);
      ack?.({ ok: true, player });
    });

    socket.on('player:dance', (dance: DanceId) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return;
      const player = roomManager.setDance(session, dance);
      if (!player) return;
      io.to(session.roomCode).emit('player:updated', player);
    });

    socket.on('food:purchase', (payload: { itemId: string; quantity?: number }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.purchaseFood(session, payload.itemId, payload.quantity ?? 1);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true, player: res.player, purchasedItemName: res.purchasedItemName });
    });

    socket.on('food:consume', (payload: { instanceId: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.consumeFoodBite(session, payload.instanceId);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('player:updated', res.player);
      ack?.({ ok: true, player: res.player, finished: res.finished, itemName: res.itemName, isDrink: res.isDrink });
    });

    socket.on('food:stop', () => {
      const session = roomManager.getSession(socket.id);
      if (!session) return;
      const player = roomManager.stopConsuming(session);
      if (player) io.to(session.roomCode).emit('player:updated', player);
    });

    socket.on(
      'firework:ignite',
      (payload: { instanceId: string; x?: number; z?: number }, ack?: (res: unknown) => void) => {
        const session = roomManager.getSession(socket.id);
        if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
        const res = roomManager.igniteFirework(session, payload.instanceId, payload.x, payload.z);
        if (!res.ok) return ack?.(res);
        io.to(session.roomCode).emit('player:updated', res.player);
        io.to(session.roomCode).emit('firework:ignited', res.event);
        ack?.({
          ok: true,
          player: res.player,
          event: res.event,
          remainingUses: res.remainingUses,
        });
      },
    );

    socket.on('chat:send', (payload: { text: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.sendChat(session, payload.text);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('chat:message', { message: res.message, player: res.player });
      ack?.({ ok: true });
    });

    socket.on('chat:report', (payload: { targetPlayerId: string; reason: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.reportPlayer(session, payload.targetPlayerId, payload.reason);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('ball:pickup', (payload: { ballId: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.pickupBall(session, payload.ballId);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('balls:sync', res.balls);
      io.to(session.roomCode).emit('player:updated', res.player);
      ack?.({ ok: true });
    });

    socket.on(
      'ball:kick',
      (payload: { ballId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number }) => {
        const session = roomManager.getSession(socket.id);
        if (!session) return;
        const res = roomManager.kickOrThrowBall(session, payload);
        if (!res) return;
        io.to(session.roomCode).emit('balls:sync', res.balls);
        io.to(session.roomCode).emit('player:updated', res.player);
      },
    );

    socket.on('sports:goal', (payload: { sport: 'football' | 'basketball' }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.recordSportsGoal(session, payload.sport);
      if (!res) return ack?.({ ok: false, error: 'Failed to record score.' });
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true, rewardCoins: res.rewardCoins });
    });

    socket.on('treasure:claim', (payload: { treasureId: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.claimTreasure(session, payload.treasureId);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true, rewardCoins: res.rewardCoins, label: res.label });
    });

    socket.on(
      'arcade:score',
      (payload: { gameId: ArcadeGameId; score: number; won: boolean }, ack?: (res: unknown) => void) => {
        const session = roomManager.getSession(socket.id);
        if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
        const res = roomManager.submitArcadeScore(session, payload.gameId, payload.score, payload.won);
        if (!res.ok) return ack?.(res);
        io.to(session.roomCode).emit('room:state', res.room);
        ack?.({ ok: true, rewardCoins: res.rewardCoins, validatedScore: res.validatedScore });
      },
    );

    socket.on('arcade:ttt_create', (ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.createTicTacToeChallenge(session);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('arcade:ttt_join', (ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.joinTicTacToeChallenge(session);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('arcade:ttt_move', (payload: { cellIndex: number }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.playTicTacToeMove(session, payload.cellIndex);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    // Host Admin Actions
    socket.on('host:lock', (payload: { locked: boolean }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostSetRoomLock(session, payload.locked);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:chat_toggle', (payload: { disabled: boolean }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostSetChatDisabled(session, payload.disabled);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:mute', (payload: { targetPlayerId: string; muted: boolean }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostMutePlayer(session, payload.targetPlayerId, payload.muted);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:kick', (payload: { targetPlayerId: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostKickPlayer(session, payload.targetPlayerId);
      if (!res.ok) return ack?.(res);
      for (const kickedSid of res.kickedSocketIds) {
        io.to(kickedSid).emit('player:kicked', { reason: 'You were removed from the carnival room by the host.' });
        io.sockets.sockets.get(kickedSid)?.leave(session.roomCode);
      }
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:resolve_report', (payload: { reportId: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostResolveReport(session, payload.reportId);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:coins', (payload: { targetPlayerId: string; delta: number }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostAdjustCoins(session, payload.targetPlayerId, payload.delta);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:teleport_all', (payload: { zoneId: ZoneId }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostTeleportAll(session, payload.zoneId);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:teleported', { zoneId: payload.zoneId, players: res.room.players });
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:announce', (payload: { text: string }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostAnnounce(session, payload.text);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on(
      'host:dj',
      (
        payload: {
          trackId?: string;
          youtubeInput?: string | null;
          isPlaying?: boolean;
          volume?: number;
          lightingMode?: LightingMode;
          next?: boolean;
          prev?: boolean;
        },
        ack?: (res: unknown) => void,
      ) => {
        const session = roomManager.getSession(socket.id);
        if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
        const res = roomManager.hostUpdateDj(session, payload);
        if (!res.ok) return ack?.(res);
        io.to(session.roomCode).emit('room:state', res.room);
        ack?.({ ok: true });
      },
    );

    socket.on('host:treasure_start', (payload: { durationSec?: number }, ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostStartTreasureHunt(session, payload?.durationSec);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on('host:treasure_end', (ack?: (res: unknown) => void) => {
      const session = roomManager.getSession(socket.id);
      if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
      const res = roomManager.hostEndTreasureHunt(session);
      if (!res.ok) return ack?.(res);
      io.to(session.roomCode).emit('room:state', res.room);
      ack?.({ ok: true });
    });

    socket.on(
      'host:event',
      (
        payload: { phase?: EventPhase; groupDance?: DanceId | null; fireworks?: boolean; timeOfDay?: TimeOfDay },
        ack?: (res: unknown) => void,
      ) => {
        const session = roomManager.getSession(socket.id);
        if (!session) return ack?.({ ok: false, error: 'Not in a room.' });
        const res = roomManager.hostTriggerEvent(session, payload);
        if (!res.ok) return ack?.(res);
        io.to(session.roomCode).emit('room:state', res.room);
        ack?.({ ok: true });
      },
    );

    socket.on('disconnect', () => {
      const left = roomManager.disconnectSocket(socket.id);
      if (left) {
        const updated = roomManager.getRoom(left.roomCode);
        if (updated) {
          io.to(left.roomCode).emit('room:state', updated);
        }
      }
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`CARNIVAL multiplayer server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
