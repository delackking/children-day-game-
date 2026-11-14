import { create } from 'zustand';
import type { MelaGameHudSnapshot } from '../engine/melaGames3D';
import { DEFAULT_AVATAR } from '../shared/catalog';
import type {
  AvatarConfig,
  CameraMode,
  DanceId,
  FireworkIgnitedEvent,
  FoodStallDef,
  RoomPublicState,
  ZoneId,
} from '../shared/types';

export type ActiveOverlay =
  | 'none'
  | 'avatar'
  | 'food_stall'
  | 'inventory'
  | 'chat'
  | 'dance'
  | 'arcade'
  | 'leaderboard'
  | 'host'
  | 'pause'
  | 'zone_map';

export interface ToastNotice {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warning';
}

export interface NearbyPrompt {
  kind: 'stall' | 'npc' | 'arcade' | 'mela_3d' | 'ferris' | 'ball' | 'treasure' | 'dj' | 'stage';
  id: string;
  label: string;
  subtitle?: string;
}

interface GameStoreState {
  screen: 'title' | 'playing';
  connected: boolean;
  room: RoomPublicState | null;
  localPlayerId: string | null;
  hostSecret: string | null;
  sessionToken: string | null;
  draftAvatar: AvatarConfig;
  cameraMode: CameraMode;
  activeOverlay: ActiveOverlay;
  activeStall: FoodStallDef | null;
  activeNpcDialogue: { name: string; role: string; text: string } | null;
  nearbyPrompt: NearbyPrompt | null;
  currentZone: ZoneId;
  lowGraphics: boolean;
  audioMuted: boolean;
  quickChatOpen: boolean;
  pointerLocked: boolean;
  fireworkQueue: FireworkIgnitedEvent[];
  localYoutubeId: string | null;
  localYoutubeTitle: string | null;
  toasts: ToastNotice[];
  errorBanner: string | null;
  teleportNonce: { x: number; z: number; nonce: number } | null;
  activeMelaGame: MelaGameHudSnapshot | null;

  setConnected: (connected: boolean) => void;
  setSessionData: (payload: {
    room: RoomPublicState;
    playerId: string;
    sessionToken: string;
    hostSecret?: string;
  }) => void;
  setRoom: (room: RoomPublicState) => void;
  updateRemotePlayerPos: (payload: {
    playerId: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    speed: number;
    isJumping: boolean;
    zone: ZoneId;
    dance: DanceId;
  }) => void;
  updateSinglePlayer: (player: RoomPublicState['players'][string]) => void;
  updateBalls: (balls: RoomPublicState['balls']) => void;
  appendChatMessage: (msg: RoomPublicState['chat'][number], player: RoomPublicState['players'][string]) => void;
  setDraftAvatar: (avatar: AvatarConfig) => void;
  cycleCameraMode: () => void;
  setCameraMode: (mode: CameraMode) => void;
  setOverlay: (overlay: ActiveOverlay) => void;
  openStall: (stall: FoodStallDef) => void;
  setNpcDialogue: (d: { name: string; role: string; text: string } | null) => void;
  setNearbyPrompt: (p: NearbyPrompt | null) => void;
  setCurrentZone: (z: ZoneId) => void;
  setLowGraphics: (low: boolean) => void;
  setAudioMuted: (muted: boolean) => void;
  setQuickChatOpen: (open: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  enqueueFireworkEvent: (ev: FireworkIgnitedEvent) => void;
  drainFireworkEvents: () => FireworkIgnitedEvent[];
  setLocalYoutube: (id: string | null, title: string | null) => void;
  pushToast: (text: string, tone?: 'info' | 'success' | 'warning') => void;
  setErrorBanner: (err: string | null) => void;
  triggerLocalTeleport: (x: number, z: number) => void;
  setActiveMelaGame: (snap: MelaGameHudSnapshot | null) => void;
  leaveRoom: () => void;
}

const CAMERA_CYCLE: CameraMode[] = ['third_rear', 'first_person', 'third_front'];

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'title',
  connected: false,
  room: null,
  localPlayerId: null,
  hostSecret: null,
  sessionToken: null,
  draftAvatar: { ...DEFAULT_AVATAR },
  cameraMode: 'third_rear',
  activeOverlay: 'none',
  activeStall: null,
  activeNpcDialogue: null,
  nearbyPrompt: null,
  currentZone: 'entrance',
  lowGraphics: false,
  audioMuted: false,
  quickChatOpen: false,
  pointerLocked: false,
  fireworkQueue: [],
  localYoutubeId: null,
  localYoutubeTitle: null,
  toasts: [],
  errorBanner: null,
  teleportNonce: null,
  activeMelaGame: null,

  setConnected: (connected) => set({ connected }),

  setSessionData: ({ room, playerId, sessionToken, hostSecret }) => {
    if (typeof document !== 'undefined') document.body.dataset.state = 'playing';
    const local = room.players[playerId];
    set({
      screen: 'playing',
      room,
      localPlayerId: playerId,
      sessionToken,
      hostSecret: hostSecret ?? null,
      draftAvatar: local ? { ...local.avatar } : get().draftAvatar,
      errorBanner: null,
      activeOverlay: 'none',
    });
  },

  setRoom: (room) => {
    const pid = get().localPlayerId;
    const local = pid ? room.players[pid] : null;
    set({
      room,
      currentZone: local ? local.zone : get().currentZone,
    });
  },

  updateRemotePlayerPos: (payload) => {
    const room = get().room;
    if (!room) return;
    const existing = room.players[payload.playerId];
    if (!existing) return;
    const updatedPlayer = {
      ...existing,
      x: payload.x,
      y: payload.y,
      z: payload.z,
      rotY: payload.rotY,
      speed: payload.speed,
      isJumping: payload.isJumping,
      zone: payload.zone,
      dance: payload.dance,
    };
    set({
      room: {
        ...room,
        players: {
          ...room.players,
          [payload.playerId]: updatedPlayer,
        },
      },
    });
  },

  updateSinglePlayer: (player) => {
    const room = get().room;
    if (!room) return;
    set({
      room: {
        ...room,
        players: {
          ...room.players,
          [player.id]: player,
        },
      },
    });
  },

  updateBalls: (balls) => {
    const room = get().room;
    if (!room) return;
    set({ room: { ...room, balls } });
  },

  appendChatMessage: (msg, player) => {
    const room = get().room;
    if (!room) return;
    const exists = room.chat.some((m) => m.id === msg.id);
    const nextChat = exists ? room.chat : [...room.chat, msg].slice(-80);
    set({
      room: {
        ...room,
        chat: nextChat,
        players: {
          ...room.players,
          [player.id]: player,
        },
      },
    });
  },

  setDraftAvatar: (draftAvatar) => set({ draftAvatar }),

  cycleCameraMode: () => {
    const cur = get().cameraMode;
    const next = CAMERA_CYCLE[(CAMERA_CYCLE.indexOf(cur) + 1) % CAMERA_CYCLE.length];
    set({ cameraMode: next });
    get().pushToast(
      next === 'third_rear'
        ? 'Camera: Third-Person Rear'
        : next === 'first_person'
          ? 'Camera: First-Person View'
          : 'Camera: Front Selfie View',
      'info',
    );
  },

  setCameraMode: (cameraMode) => set({ cameraMode }),

  setOverlay: (activeOverlay) => set({ activeOverlay }),

  openStall: (stall) => set({ activeStall: stall, activeOverlay: 'food_stall' }),

  setNpcDialogue: (activeNpcDialogue) => set({ activeNpcDialogue }),

  setNearbyPrompt: (nearbyPrompt) => set({ nearbyPrompt }),

  setCurrentZone: (currentZone) => set({ currentZone }),

  setLowGraphics: (lowGraphics) => set({ lowGraphics }),

  setAudioMuted: (audioMuted) => set({ audioMuted }),

  setQuickChatOpen: (quickChatOpen) => set({ quickChatOpen }),

  setPointerLocked: (pointerLocked) => set({ pointerLocked }),

  enqueueFireworkEvent: (ev) =>
    set((s) => ({ fireworkQueue: [...s.fireworkQueue.slice(-15), ev] })),

  drainFireworkEvents: () => {
    const q = get().fireworkQueue;
    if (q.length > 0) set({ fireworkQueue: [] });
    return q;
  },

  setLocalYoutube: (localYoutubeId, localYoutubeTitle) => set({ localYoutubeId, localYoutubeTitle }),

  pushToast: (text, tone = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3400);
  },

  setErrorBanner: (errorBanner) => set({ errorBanner }),

  triggerLocalTeleport: (x, z) =>
    set({ teleportNonce: { x, z, nonce: Date.now() }, activeOverlay: 'none' }),

  setActiveMelaGame: (activeMelaGame) => set({ activeMelaGame }),

  leaveRoom: () => {
    if (typeof document !== 'undefined') document.body.dataset.state = 'title';
    set({
      screen: 'title',
      room: null,
      localPlayerId: null,
      hostSecret: null,
      sessionToken: null,
      activeOverlay: 'none',
      activeStall: null,
      activeNpcDialogue: null,
      activeMelaGame: null,
    });
  },
}));
