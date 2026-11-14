import React from 'react';
import { Award, Medal, Trophy, X } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

interface LeaderboardModalProps {
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);

  if (!room) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
      <div
        role="dialog"
        aria-label="Carnival Leaderboard and Achievements"
        className="w-full max-w-2xl rounded-2xl border border-amber-200 shadow-2xl p-6 text-slate-900 max-h-[88vh] overflow-y-auto"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-500" />
            <div>
              <h2 className="font-display text-xl font-bold">Carnival Leaderboard &amp; Badges</h2>
              <p className="text-xs text-slate-600">
                Rankings reflect Arcade, Sports &amp; Treasure skills only (food purchases never affect ranks).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Leaderboard"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {room.leaderboard.map((entry, idx) => {
            const isMe = entry.playerId === localPlayerId;
            return (
              <div
                key={entry.playerId}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl border ${
                  isMe ? 'border-amber-500 bg-amber-50' : 'border-amber-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-mono-num font-bold text-sm ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                            ? 'bg-orange-300 text-slate-950'
                            : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {entry.name} {isMe ? '(You)' : ''}
                    </p>
                    <p className="text-[11px] text-slate-600 tabular-nums">
                      Arcade Wins: {entry.arcadeWins} · Sports Goals: {entry.sportsScore} · Treasures: {entry.treasuresFound}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {entry.badges.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-semibold"
                    >
                      <Medal className="w-3 h-3 text-amber-600" />
                      {b}
                    </span>
                  ))}
                  <span className="font-mono-num font-bold text-base text-red-700 ml-2">
                    {entry.competitionPoints} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* My Earned Badges */}
        {localPlayerId && room.players[localPlayerId] && (
          <div className="mt-5 pt-4 border-t border-amber-200">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              Your Earned Carnival Badges
            </p>
            {room.players[localPlayerId].badges.length === 0 ? (
              <p className="text-xs text-slate-500">
                Play Arcade games, score a football goal, dance at the DJ stage, or try 3 street foods to unlock badges!
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {room.players[localPlayerId].badges.map((badge) => (
                  <span key={badge} className="px-3 py-1 rounded-lg bg-slate-900 text-amber-300 text-xs font-bold">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
