import React, { useEffect, useState } from 'react';
import { Sparkles, Users, KeyRound, Shirt } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { normalizeRoomCode } from '../shared/rules';
import { useGameStore } from '../stores/useGameStore';

interface WelcomeOverlayProps {
  onOpenAvatarBeforeJoin: () => void;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onOpenAvatarBeforeJoin }) => {
  const draftAvatar = useGameStore((s) => s.draftAvatar);
  const errorBanner = useGameStore((s) => s.errorBanner);
  const setErrorBanner = useGameStore((s) => s.setErrorBanner);

  const [mode, setMode] = useState<'create' | 'join'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') ? 'join' : 'create';
  });
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState("Children's Day Mela");
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeRoomCode(params.get('room') || '');
  });
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [submitting, setSubmitting] = useState(false);

  const handleEnter = async () => {
    if (submitting) return;
    const cleanName = playerName.trim();
    if (!cleanName) {
      setErrorBanner('Please enter your name before entering the carnival.');
      return;
    }
    setErrorBanner(null);
    setSubmitting(true);
    soundEngine.playClick();

    if (mode === 'create') {
      const res = await socketClient.createRoom({
        hostName: cleanName,
        roomName: roomName.trim() || `${cleanName}'s Carnival`,
        maxPlayers,
        avatar: draftAvatar,
      });
      if (!res.ok) setErrorBanner(res.error || 'Could not create room.');
    } else {
      const code = normalizeRoomCode(roomCode);
      if (code.length < 4) {
        setErrorBanner('Please enter a valid room code (4–8 characters).');
        setSubmitting(false);
        return;
      }
      const res = await socketClient.joinRoom({
        roomCode: code,
        playerName: cleanName,
        avatar: draftAvatar,
      });
      if (!res.ok) setErrorBanner(res.error || 'Could not join room.');
    }
    setSubmitting(false);
  };

  // Support ?autostart=1 for automated testing and instant solo/host launch
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      socketClient.createRoom({
        hostName: 'Aarav',
        roomName: "Children's Day Grand Mela",
        maxPlayers: 12,
        avatar: useGameStore.getState().draftAvatar,
        preferredCode: 'MELA26',
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        handleEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 pointer-events-none">
      {/* Top Left Bespoke Emblem Lockup */}
      <div className="flex items-start justify-between">
        <div
          className="pointer-events-auto rounded-2xl px-5 py-4 shadow-xl border border-amber-300/60"
          style={{ backgroundColor: 'rgba(20, 36, 59, 0.92)' }}
        >
          <svg
            viewBox="0 0 360 88"
            className="w-64 sm:w-80 h-auto"
            aria-label="CARNIVAL — The Virtual Children's Day"
          >
            <defs>
              <linearGradient id="festiveGold" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#FB7185" />
              </linearGradient>
            </defs>
            {/* Bunting Flags */}
            <polygon points="8,6 28,6 18,22" fill="#DC2626" />
            <polygon points="32,6 52,6 42,22" fill="#FACC15" />
            <polygon points="56,6 76,6 66,22" fill="#10B981" />
            <polygon points="80,6 100,6 90,22" fill="#38BDF8" />
            <polygon points="104,6 124,6 114,22" fill="#EC4899" />
            <polygon points="128,6 148,6 138,22" fill="#F59E0B" />
            <text
              x="8"
              y="58"
              fill="url(#festiveGold)"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="40"
              letterSpacing="2"
            >
              CARNIVAL
            </text>
            <text
              x="10"
              y="78"
              fill="#E2E8F0"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
              fontSize="13"
              letterSpacing="1.4"
            >
              THE VIRTUAL CHILDREN&apos;S DAY
            </text>
          </svg>
        </div>
      </div>

      {/* Main Entry Card anchored bottom-left/center leaving right 3D vista open */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
        <div
          className="pointer-events-auto w-full max-w-md rounded-2xl p-6 shadow-2xl border border-amber-200"
          style={{ backgroundColor: 'rgba(255, 251, 242, 0.97)' }}
        >
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-amber-100/80 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setErrorBanner(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'create'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-700 hover:bg-amber-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Host Party
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setErrorBanner(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'join'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-700 hover:bg-amber-200/60'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Join Code
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="player-name-input" className="block text-xs font-bold text-slate-700 mb-1">
                Your Name
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Aarav, Diya, Kabir"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {mode === 'create' ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="room-name-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Carnival Room Name
                  </label>
                  <input
                    id="room-name-input"
                    type="text"
                    maxLength={40}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="max-players-select" className="block text-xs font-bold text-slate-700 mb-1">
                    Capacity
                  </label>
                  <select
                    id="max-players-select"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={7}>7 Kids</option>
                    <option value={12}>12 Kids</option>
                    <option value={20}>20 Kids</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="room-code-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Private Room Code
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  maxLength={8}
                  value={roomCode}
                  onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                  placeholder="Enter 6-letter code"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono-num text-base font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {errorBanner && (
              <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorBanner}
              </p>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenAvatarBeforeJoin}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold whitespace-nowrap shrink-0"
              >
                <Shirt className="w-4 h-4 text-amber-600" />
                Outfit
              </button>
              <button
                type="button"
                data-start="true"
                disabled={submitting}
                onClick={handleEnter}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-display font-bold text-base shadow-md transition-colors whitespace-nowrap"
              >
                <Users className="w-4 h-4" />
                {submitting ? 'Entering...' : mode === 'create' ? 'Create & Enter Carnival' : 'Join Carnival'}
              </button>
            </div>
          </div>
        </div>

        {/* Clean single-line control hint */}
        <p
          className="text-xs sm:text-sm font-medium text-amber-50 px-4 py-2 rounded-xl"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.78)' }}
        >
          WASD Move · Space Jump · E Interact · F Kick/Throw · F5 Camera · V Dance · B Bag
        </p>
      </div>
    </div>
  );
};
