import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Backpack,
  Camera,
  Check,
  Coins,
  Compass,
  Copy,
  Crown,
  Flame,
  MessageCircle,
  Music,
  Pause,
  Send,
  Shirt,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { CARNIVAL_ZONES } from '../shared/catalog';
import { useGameStore } from '../stores/useGameStore';

interface GameHudProps {
  onInteract: () => void;
  onJump: () => void;
  onKick: () => void;
  onJoystickMove: (x: number, y: number) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  onInteract,
  onJump,
  onKick,
  onJoystickMove,
}) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const hostSecret = useGameStore((s) => s.hostSecret);
  const currentZone = useGameStore((s) => s.currentZone);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const nearbyPrompt = useGameStore((s) => s.nearbyPrompt);
  const activeNpcDialogue = useGameStore((s) => s.activeNpcDialogue);
  const toasts = useGameStore((s) => s.toasts);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const quickChatOpen = useGameStore((s) => s.quickChatOpen);
  const pointerLocked = useGameStore((s) => s.pointerLocked);

  const cycleCameraMode = useGameStore((s) => s.cycleCameraMode);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const setQuickChatOpen = useGameStore((s) => s.setQuickChatOpen);
  const setAudioMuted = useGameStore((s) => s.setAudioMuted);
  const pushToast = useGameStore((s) => s.pushToast);

  const [copied, setCopied] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (quickChatOpen) {
      window.setTimeout(() => quickInputRef.current?.focus(), 20);
    }
  }, [quickChatOpen]);

  if (!room || !localPlayerId) return null;
  const localPlayer = room.players[localPlayerId];
  if (!localPlayer) return null;

  const zoneInfo = CARNIVAL_ZONES.find((z) => z.id === currentZone);
  const onlineCount = Object.values(room.players).filter((p) => p.online).length;
  const isActuallyHost = localPlayer.isHost && Boolean(hostSecret);

  const copyInvite = () => {
    const inviteUrl = `${window.location.origin}/?room=${room.code}`;
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    pushToast(`Invite link copied for room ${room.code}!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    soundEngine.setMuted(next);
  };

  const handleJoyPointer = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.4;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const nx = dist > 2 ? (Math.cos(angle) * clamped) / maxR : 0;
    const ny = dist > 2 ? (Math.sin(angle) * clamped) / maxR : 0;
    setJoyKnob({ x: nx * 24, y: ny * 24 });
    onJoystickMove(nx, ny);
  };

  const resetJoy = () => {
    setJoyKnob({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const claimedTreasures = room.treasureHunt.nodes.filter((n) => n.claimedBy).length;
  const totalTreasures = room.treasureHunt.nodes.length;
  const fireworkCount = localPlayer.inventory.filter((i) => i.category === 'firework').length;

  const submitQuickChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickText.trim();
    if (!trimmed) {
      setQuickChatOpen(false);
      return;
    }
    const res = await socketClient.sendChat(trimmed);
    if (!res.ok) {
      pushToast(res.error || 'Could not send chat.', 'warning');
      return;
    }
    setQuickText('');
    setQuickChatOpen(false);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* FIXED CENTER CURSOR RETICLE WHEN POINTER-LOCKED */}
      {pointerLocked && activeOverlay === 'none' && !quickChatOpen && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-white bg-amber-400/90 shadow-md" />
          </div>
        </div>
      )}
      {/* TOP BAR CLUSTERS */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Room Code, Wallet & Zone */}
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-2xl border border-amber-300/40 shadow-lg text-white"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
        >
          <button
            type="button"
            onClick={copyInvite}
            aria-label={`Copy invite link for room ${room.code}`}
            className="flex items-center gap-1.5 text-xs font-mono-num font-bold text-amber-300 hover:text-amber-200 whitespace-nowrap"
          >
            <span>ROOM {room.code}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <span className="text-slate-500" aria-hidden="true">|</span>

          <div className="flex items-center gap-1.5 font-mono-num font-bold text-sm text-amber-300" aria-label="Wallet balance">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{localPlayer.coins}</span>
          </div>

          <span className="text-slate-500 hidden sm:inline" aria-hidden="true">|</span>

          <span className="hidden sm:inline text-xs font-medium text-slate-200 whitespace-nowrap">
            {zoneInfo?.name || 'Central Plaza'} · {onlineCount}/{room.maxPlayers} Friends
          </span>
        </div>

        {/* Top-Center: Announcement or Treasure Hunt Progress */}
        <div className="hidden md:flex flex-col items-center gap-1.5 max-w-md">
          {room.treasureHunt.active && (
            <div
              className="pointer-events-auto px-4 py-1.5 rounded-xl border border-amber-300 text-xs font-bold text-slate-900 shadow-md tabular-nums"
              style={{ backgroundColor: 'rgba(253, 224, 71, 0.95)' }}
            >
              Treasure Hunt Active: {claimedTreasures}/{totalTreasures} Found
            </div>
          )}
          {room.announcement && Date.now() - room.announcement.timestamp < 14000 && (
            <div
              className="px-4 py-1.5 rounded-xl border border-amber-400/50 text-xs font-semibold text-amber-100 text-center shadow"
              style={{ backgroundColor: 'rgba(124, 45, 18, 0.92)' }}
            >
              {room.announcement.senderName}: {room.announcement.text}
            </div>
          )}
        </div>

        {/* Top-Right: Camera, Leaderboard, Audio, Host Panel, Pause */}
        <div
          className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl border border-white/15 shadow-lg"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              cycleCameraMode();
            }}
            aria-label="Switch Camera Mode (F5)"
            title="Switch Camera (F5)"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-100 hover:bg-white/10 whitespace-nowrap"
          >
            <Camera className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">
              {cameraMode === 'third_rear' ? 'Rear' : cameraMode === 'first_person' ? '1st Person' : 'Selfie'}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'leaderboard' ? 'none' : 'leaderboard');
            }}
            aria-label="Leaderboard and Badges"
            className="p-2 rounded-xl text-slate-100 hover:bg-white/10"
          >
            <Award className="w-4 h-4 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              toggleMute();
            }}
            aria-label={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 rounded-xl text-slate-100 hover:bg-white/10"
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {isActuallyHost && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setOverlay(activeOverlay === 'host' ? 'none' : 'host');
              }}
              aria-label="Host Admin Dashboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">Host</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'pause' ? 'none' : 'pause');
            }}
            aria-label="Pause and Settings"
            className="p-2 rounded-xl text-slate-100 hover:bg-white/10"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATIONS (top-right stacked cleanly, never covering center) */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-4 z-20 flex flex-col gap-1.5 max-w-xs pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md border ${
                t.tone === 'success'
                  ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/40'
                  : t.tone === 'warning'
                    ? 'bg-amber-950/95 text-amber-100 border-amber-500/40'
                    : 'bg-slate-900/95 text-slate-100 border-slate-700'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* BOTTOM SECTION: NPC Dialogue, Consuming Progress, Quick Chat [T], Nearby [E] Prompt */}
      <div className="flex flex-col items-center gap-2.5">
        {/* Active Eating / Drinking Bar with Put Away */}
        {localPlayer.consuming && activeOverlay === 'none' && (
          <div
            className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-xl border border-amber-300/60 text-white shadow-lg"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.90)' }}
          >
            <span className="text-xs font-semibold text-amber-200">
              {localPlayer.consuming.visualType === 'bottle' || localPlayer.consuming.visualType === 'cup'
                ? 'Sipping'
                : 'Eating'}{' '}
              <strong className="text-white">{localPlayer.consuming.name}</strong> (
              {localPlayer.consuming.bitesRemaining}/{localPlayer.consuming.maxBites})
            </span>
            <button
              type="button"
              onClick={() => socketClient.stopConsuming()}
              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-bold text-slate-100"
            >
              Put Away
            </button>
          </div>
        )}

        {/* Quick Firework Launch Button if carrying fireworks */}
        {fireworkCount > 0 && activeOverlay === 'none' && !quickChatOpen && (
          <button
            type="button"
            onClick={() => {
              const fw = localPlayer.inventory.find((i) => i.category === 'firework');
              if (fw) {
                socketClient.igniteFirework(
                  fw.instanceId,
                  localPlayer.x + Math.sin(localPlayer.rotY) * 4.5,
                  localPlayer.z + Math.cos(localPlayer.rotY) * 4.5,
                );
              }
            }}
            className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg border border-amber-300/50"
          >
            <Flame className="w-3.5 h-3.5 text-yellow-200" />
            Light Firework [G] ({fireworkCount})
          </button>
        )}

        {/* Inline Quick Chat Bar (Press T -> Type -> Enter) */}
        {quickChatOpen && activeOverlay === 'none' && (
          <form
            onSubmit={submitQuickChat}
            className="pointer-events-auto w-full max-w-md flex items-center gap-2 p-2 rounded-2xl border border-amber-300 shadow-2xl"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
          >
            <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono-num text-[11px] font-bold shrink-0">
              CHAT
            </span>
            <input
              ref={quickInputRef}
              type="text"
              maxLength={160}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setQuickChatOpen(false);
                }
              }}
              placeholder="Type message & press Enter..."
              aria-label="Quick chat message"
              className="flex-1 bg-slate-800 text-white placeholder-slate-400 text-sm px-3 py-1.5 rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              aria-label="Send quick chat"
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
            <button
              type="button"
              onClick={() => setQuickChatOpen(false)}
              aria-label="Cancel quick chat"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Active NPC Speech Card */}
        {activeNpcDialogue && (
          <div
            className="pointer-events-auto max-w-md px-5 py-3 rounded-2xl border border-amber-300 shadow-xl text-slate-900"
            style={{ backgroundColor: 'rgba(255, 251, 242, 0.96)' }}
          >
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              {activeNpcDialogue.name} · {activeNpcDialogue.role}
            </p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">{activeNpcDialogue.text}</p>
          </div>
        )}

        {/* Proximity [E] Prompt */}
        {nearbyPrompt && activeOverlay === 'none' && (
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-lg border border-amber-200 transition-transform active:scale-95"
          >
            <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono-num text-xs">E</span>
            <span>{nearbyPrompt.label}</span>
            {nearbyPrompt.subtitle && (
              <span className="text-xs font-semibold text-slate-800">· {nearbyPrompt.subtitle}</span>
            )}
          </button>
        )}

        {/* Mobile Touch Controls Row (shown on touch/narrow viewports) */}
        <div className="w-full flex md:hidden items-end justify-between px-1 pb-1">
          {/* Virtual Joystick */}
          <div
            ref={joyBaseRef}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              handleJoyPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) handleJoyPointer(e.clientX, e.clientY);
            }}
            onPointerUp={resetJoy}
            onPointerCancel={resetJoy}
            className="pointer-events-auto relative w-24 h-24 rounded-full border-2 border-white/30 flex items-center justify-center touch-none"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          >
            <div
              className="w-10 h-10 rounded-full bg-amber-400 shadow-md"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>

          {/* Mobile Action Buttons */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onKick}
              className="w-12 h-12 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-lg"
            >
              Kick
            </button>
            <button
              type="button"
              onClick={onInteract}
              className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 text-xs font-bold shadow-lg"
            >
              Use
            </button>
            <button
              type="button"
              onClick={onJump}
              className="w-14 h-14 rounded-full bg-red-600 text-white text-xs font-bold shadow-lg"
            >
              Jump
            </button>
          </div>
        </div>

        {/* Bottom-Center Compact Action Dock */}
        <nav
          aria-label="Carnival actions"
          className="pointer-events-auto max-w-[calc(100vw-1rem)] flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 py-1 sm:p-1.5 rounded-2xl border border-white/15 shadow-xl"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.90)' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'inventory' ? 'none' : 'inventory');
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
              activeOverlay === 'inventory' ? 'bg-amber-500 text-slate-950' : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            <Backpack className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Bag ({localPlayer.inventory.length})</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'dance' ? 'none' : 'dance');
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
              activeOverlay === 'dance' ? 'bg-amber-500 text-slate-950' : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Dance</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'chat' ? 'none' : 'chat');
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
              activeOverlay === 'chat' ? 'bg-amber-500 text-slate-950' : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'avatar' ? 'none' : 'avatar');
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
              activeOverlay === 'avatar' ? 'bg-amber-500 text-slate-950' : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            <Shirt className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Outfit</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setOverlay(activeOverlay === 'zone_map' ? 'none' : 'zone_map');
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
              activeOverlay === 'zone_map' ? 'bg-amber-500 text-slate-950' : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Zones</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
