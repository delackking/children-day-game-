import React, { useState } from 'react';
import {
  Coins,
  Crown,
  Lock,
  Megaphone,
  Moon,
  Music,
  ShieldAlert,
  Sparkles,
  Sun,
  Sunrise,
  Trophy,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { CARNIVAL_ZONES, DANCE_LIST, DEFAULT_DJ_PLAYLIST } from '../shared/catalog';
import type { DanceId, EventPhase, LightingMode, TimeOfDay, ZoneId } from '../shared/types';
import { useGameStore } from '../stores/useGameStore';

interface HostDashboardModalProps {
  onClose: () => void;
}

type HostTab = 'room' | 'players' | 'dj' | 'economy' | 'events';

export const HostDashboardModal: React.FC<HostDashboardModalProps> = ({ onClose }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const hostSecret = useGameStore((s) => s.hostSecret);
  const pushToast = useGameStore((s) => s.pushToast);

  const [tab, setTab] = useState<HostTab>('room');
  const [announceText, setAnnounceText] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [teleportZone, setTeleportZone] = useState<ZoneId>('central_plaza');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!room || !localPlayerId) return null;
  const me = room.players[localPlayerId];
  if (!me?.isHost || !hostSecret) return null;

  const playersList = Object.values(room.players);

  const notify = (res: { ok: boolean; error?: string }, okText: string) => {
    if (!res.ok) {
      setStatusMsg(res.error || 'Action failed');
    } else {
      setStatusMsg(okText);
      pushToast(okText, 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5" style={{ backgroundColor: 'rgba(15, 23, 42, 0.78)' }}>
      <div
        role="dialog"
        aria-label="Host Admin Control Panel"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-amber-300 shadow-2xl overflow-hidden text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-lg font-bold">Host Event Control Center</h2>
              <p className="text-[11px] text-slate-300">
                Room Code: <span className="font-mono-num font-bold text-amber-300">{room.code}</span> · {playersList.filter((p) => p.online).length}/{room.maxPlayers} Online
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Host Panel"
            className="p-2 rounded-xl hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 px-6 py-3 bg-amber-100/70 border-b border-amber-200">
          {[
            { id: 'room', label: 'Room & Teleport', icon: Lock },
            { id: 'players', label: 'Players & Safety', icon: Users },
            { id: 'dj', label: 'DJ & YouTube', icon: Music },
            { id: 'economy', label: 'Coins & Log', icon: Coins },
            { id: 'events', label: 'Games & Ceremony', icon: Sparkles },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as HostTab)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                  tab === t.id ? 'bg-slate-900 text-amber-300' : 'bg-white text-slate-700 hover:bg-amber-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {statusMsg && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-xl bg-amber-100 border border-amber-300 text-xs font-semibold text-amber-950">
            {statusMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* A. ROOM CONTROL & ANNOUNCEMENTS */}
          {tab === 'room' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-3">
                <h3 className="text-sm font-bold">Room Access &amp; Chat</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await socketClient.hostSetLock(!room.locked);
                      notify(res, room.locked ? 'Room unlocked!' : 'Room locked to new guests.');
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold ${
                      room.locked ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {room.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {room.locked ? 'Room Locked (Click to Unlock)' : 'Room Open (Click to Lock)'}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await socketClient.hostToggleChat(!room.chatDisabled);
                      notify(res, room.chatDisabled ? 'Party chat enabled!' : 'Party chat paused for guests.');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                      room.chatDisabled ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'
                    }`}
                  >
                    {room.chatDisabled ? 'Chat Disabled (Enable)' : 'Disable Guest Chat'}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-700 mb-2">Carnival Sky &amp; Night Mela Lights</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'day' as TimeOfDay, label: 'Day Mela', icon: Sun, activeCls: 'bg-sky-600 text-white border-sky-700' },
                      { id: 'sunset' as TimeOfDay, label: 'Sunset', icon: Sunrise, activeCls: 'bg-orange-500 text-white border-orange-600' },
                      { id: 'night' as TimeOfDay, label: 'Night Lights', icon: Moon, activeCls: 'bg-indigo-900 text-amber-300 border-indigo-950' },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = (room.timeOfDay || 'day') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={async () => {
                            soundEngine.playClick();
                            const res = await socketClient.hostTriggerEvent({ timeOfDay: opt.id });
                            notify(
                              res,
                              opt.id === 'night'
                                ? 'Night Mela mode activated! All carnival lights are glowing!'
                                : opt.id === 'sunset'
                                  ? 'Golden Sunset sky activated!'
                                  : 'Bright Morning Mela sky activated!',
                            );
                          }}
                          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            active ? opt.activeCls : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-700 mb-2">Gather Everyone to a Zone</p>
                  <div className="flex gap-2">
                    <select
                      aria-label="Select zone to teleport everyone"
                      value={teleportZone}
                      onChange={(e) => setTeleportZone(e.target.value as ZoneId)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    >
                      {CARNIVAL_ZONES.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await socketClient.hostTeleportAll(teleportZone);
                        notify(res, `Teleported all players to ${teleportZone.replace(/_/g, ' ')}!`);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                    >
                      Teleport All
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-red-600" />
                  Global Stage Announcement
                </h3>
                <textarea
                  rows={3}
                  maxLength={180}
                  value={announceText}
                  onChange={(e) => setAnnounceText(e.target.value)}
                  placeholder="Announce prize winners, dance party, or snack break..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!announceText.trim()) return;
                    const res = await socketClient.hostAnnounce(announceText);
                    if (res.ok) setAnnounceText('');
                    notify(res, 'Announcement broadcast to everyone!');
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  Broadcast Announcement
                </button>
              </div>
            </div>
          )}

          {/* B. PLAYER MANAGEMENT & MODERATION */}
          {tab === 'players' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {playersList.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-amber-200"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {p.name} {p.isHost ? '(Host)' : ''} ·{' '}
                        <span className={p.online ? 'text-emerald-700' : 'text-slate-400'}>
                          {p.online ? 'Online' : 'Offline'}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 tabular-nums">
                        Zone: {p.zone.replace(/_/g, ' ')} · Wallet: {p.coins} coins · Bag: {p.inventory.length} items
                      </p>
                    </div>
                    {!p.isHost && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await socketClient.hostMute(p.id, !p.muted);
                            notify(res, p.muted ? `Unmuted ${p.name}` : `Muted ${p.name}`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            p.muted ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {p.muted ? 'Unmute' : 'Mute'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await socketClient.hostKick(p.id);
                            notify(res, `Removed ${p.name} from room.`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                        >
                          Kick
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200">
                <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Safety Reports ({room.reports.filter((r) => !r.resolved).length} Open)
                </h3>
                {room.reports.length === 0 ? (
                  <p className="text-xs text-slate-500">No player reports filed in this session.</p>
                ) : (
                  <div className="space-y-2">
                    {room.reports.map((rep) => (
                      <div key={rep.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <div>
                          <p className="font-bold">
                            {rep.reporterName} reported {rep.targetPlayerName}
                          </p>
                          <p className="text-slate-600">{rep.reason}</p>
                        </div>
                        {!rep.resolved ? (
                          <button
                            type="button"
                            onClick={() => socketClient.hostResolveReport(rep.id)}
                            className="px-2.5 py-1 rounded bg-slate-900 text-white font-bold"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-bold">Resolved</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C. DJ & YOUTUBE CONTROL */}
          {tab === 'dj' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-3">
                <h3 className="text-sm font-bold">DJ Playback &amp; Built-in Tracks</h3>
                <p className="text-xs text-slate-600">
                  Now Playing: <strong>{room.dj.title}</strong>
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => socketClient.hostUpdateDj({ prev: true })}
                    className="px-3 py-2 rounded-xl bg-slate-200 text-xs font-bold"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => socketClient.hostUpdateDj({ isPlaying: !room.dj.isPlaying })}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                  >
                    {room.dj.isPlaying ? 'Pause Music' : 'Play Music'}
                  </button>
                  <button
                    type="button"
                    onClick={() => socketClient.hostUpdateDj({ next: true })}
                    className="px-3 py-2 rounded-xl bg-slate-200 text-xs font-bold"
                  >
                    Next
                  </button>
                </div>

                <div>
                  <label htmlFor="dj-volume" className="block text-xs font-bold text-slate-700 mb-1">
                    Stage Volume: {room.dj.volume}%
                  </label>
                  <input
                    id="dj-volume"
                    type="range"
                    min={0}
                    max={100}
                    value={room.dj.volume}
                    onChange={(e) => socketClient.hostUpdateDj({ volume: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  {DEFAULT_DJ_PLAYLIST.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => socketClient.hostUpdateDj({ trackId: t.id })}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border ${
                        room.dj.trackId === t.id && !room.dj.youtubeId
                          ? 'bg-amber-100 border-amber-400 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {t.title} — {t.artist}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-4">
                <div>
                  <h3 className="text-sm font-bold mb-1">Official YouTube Party Link</h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Paste a kid-friendly YouTube video URL or 11-char ID to sync playback via the official YouTube Player.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeInput}
                      onChange={(e) => setYoutubeInput(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await socketClient.hostUpdateDj({ youtubeInput });
                        notify(res, 'Synced YouTube track to all players!');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 text-amber-300 text-xs font-bold"
                    >
                      Load Video
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-700 mb-2">Stage Party Lighting Mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['festive', 'disco', 'golden', 'neon_party'] as LightingMode[]).map((lm) => (
                      <button
                        key={lm}
                        type="button"
                        onClick={() => socketClient.hostUpdateDj({ lightingMode: lm })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold capitalize border ${
                          room.dj.lightingMode === lm
                            ? 'bg-purple-700 text-white border-purple-800'
                            : 'bg-slate-50 text-slate-800 border-slate-200'
                        }`}
                      >
                        {lm.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D. ECONOMY & TRANSACTIONS */}
          {tab === 'economy' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {playersList.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-amber-200"
                  >
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-xs font-mono-num text-amber-700 font-bold">{p.coins} Coins</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await socketClient.hostAdjustCoins(p.id, 100);
                          notify(res, `Gave +100 coins to ${p.name}!`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                      >
                        +100 Coins
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await socketClient.hostAdjustCoins(p.id, -50);
                          notify(res, `Deducted 50 coins from ${p.name}.`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-xs font-bold"
                      >
                        -50 Coins
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200">
                <h3 className="text-sm font-bold mb-2">Recent Room Transactions</h3>
                <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                  {room.transactions.length === 0 ? (
                    <p className="text-slate-500">No transactions yet.</p>
                  ) : (
                    room.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span>
                          <strong>{tx.playerName}</strong> · {tx.itemName}
                        </span>
                        <span className={`font-mono-num font-bold ${tx.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* E. GAMES, TREASURE HUNT & CEREMONY */}
          {tab === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  Treasure Hunt Controls
                </h3>
                <p className="text-xs text-slate-600">
                  Spawns 7 hidden treasures across all carnival zones. Each treasure rewards coins once!
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await socketClient.hostStartTreasure(180);
                      notify(res, 'Treasure Hunt started! 7 treasures hidden across the carnival!');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    {room.treasureHunt.active ? 'Restart Treasure Hunt' : 'Start Treasure Hunt'}
                  </button>
                  {room.treasureHunt.active && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await socketClient.hostEndTreasure();
                        notify(res, 'Treasure Hunt ended.');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold"
                    >
                      End Hunt
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-3">
                <h3 className="text-sm font-bold">Celebration Stage &amp; Fireworks</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      soundEngine.playFirework();
                      const res = await socketClient.hostTriggerEvent({ fireworks: true });
                      notify(res, 'Launched Grand Stage Fireworks!');
                    }}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                  >
                    Launch Fireworks!
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await socketClient.hostTriggerEvent({
                        phase: 'group_dance',
                        groupDance: 'normal_dance' as DanceId,
                      });
                      notify(res, 'Synchronised Group Dance launched for all players!');
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold"
                  >
                    Start Group Dance
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-700 mb-1.5">Event Ceremony Phase</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'free_play', label: 'Free Play' },
                        { id: 'opening_ceremony', label: 'Opening' },
                        { id: 'competition', label: 'Competition' },
                        { id: 'prize_ceremony', label: 'Prize Ceremony' },
                      ] as { id: EventPhase; label: string }[]
                    ).map((ph) => (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => socketClient.hostTriggerEvent({ phase: ph.id })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          room.eventPhase === ph.id
                            ? 'bg-slate-900 text-amber-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ph.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-700 mb-1.5">Group Dance Routine</p>
                  <select
                    aria-label="Choose group dance"
                    value={room.groupDanceActive || 'none'}
                    onChange={(e) =>
                      socketClient.hostTriggerEvent({ groupDance: e.target.value as DanceId })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    <option value="none">Stop Group Dance</option>
                    {DANCE_LIST.filter((d) => d.category === 'dance').map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
