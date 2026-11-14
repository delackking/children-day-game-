import React from 'react';
import { Coins, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import type { MelaGameHudSnapshot } from '../engine/melaGames3D';
import type { Mela3DGameId } from '../shared/mela3d';

interface MelaGameHudProps {
  game: MelaGameHudSnapshot;
  onAction: () => void;
  onPickDuck: (num: number) => void;
  onReplay: (id: Mela3DGameId) => void;
  onExit: () => void;
}

export const MelaGameHud: React.FC<MelaGameHudProps> = ({
  game,
  onAction,
  onPickDuck,
  onReplay,
  onExit,
}) => {
  const meterPct = Math.round(game.powerMeter01 * 100);
  const isBellZone = game.powerMeter01 >= 0.93;

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5"
      data-testid="mela-3d-hud"
    >
      {/* Top Booth Scoreboard Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className="pointer-events-auto flex items-center gap-4 px-4 py-2.5 rounded-2xl border border-amber-300/60 text-white shadow-xl"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.90)' }}
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              LIVE 3D MELA BOOTH
            </span>
            <h2 className="font-display text-base sm:text-lg font-extrabold leading-tight">
              {game.name}
            </h2>
          </div>

          <span className="text-slate-600" aria-hidden="true">|</span>

          <div className="text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Score</p>
            <p className="font-mono-num text-lg font-extrabold text-amber-300" data-testid="mela-3d-score">
              {game.score}
            </p>
          </div>

          <div className="text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Tries Left</p>
            <p className="font-mono-num text-lg font-extrabold text-sky-300" data-testid="mela-3d-attempts">
              {game.attemptsLeft}/{game.maxAttempts}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExit}
          aria-label="Exit 3D Mela Booth"
          className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-white/20 text-xs font-bold shadow-lg"
        >
          <X className="w-4 h-4 text-rose-400" />
          Exit Booth [Esc]
        </button>
      </div>

      {/* Center-Top Live Event Callout or Summary Card */}
      {game.phase === 'summary' ? (
        <div className="self-center pointer-events-auto w-full max-w-sm rounded-2xl border-2 border-amber-300 p-5 text-center text-white shadow-2xl" style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}>
          <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <h3 className="font-display text-xl font-extrabold">{game.name} Complete!</h3>
          <p className="font-mono-num text-3xl font-black text-amber-300 mt-1">{game.score} pts</p>
          {typeof game.coinsEarned === 'number' && game.coinsEarned > 0 ? (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold">
              <Coins className="w-3.5 h-3.5" />+{game.coinsEarned} Carnival Coins Earned!
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-300">Score 200+ pts to earn Carnival Coins!</p>
          )}
          <div className="flex items-center justify-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={() => onReplay(game.gameId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm"
            >
              Walk Fairground
            </button>
          </div>
        </div>
      ) : (
        <div className="self-center flex flex-col items-center gap-2 mb-auto mt-3">
          <div
            className="px-3.5 py-1.5 rounded-xl border border-amber-300/40 text-xs font-semibold text-amber-100 shadow"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
          >
            {game.lastEvent || game.instructions}
          </div>
        </div>
      )}

      {/* Bottom Controls Bar (leaves center 3D scene completely clear) */}
      {game.phase === 'playing' && (
        <div className="self-center pointer-events-auto flex flex-col items-center gap-2.5 max-w-lg w-full">
          {game.usesPowerMeter && (
            <div
              className="w-full max-w-xs px-3.5 py-2 rounded-xl border border-white/20 text-white shadow-lg"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.90)' }}
            >
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span>STRENGTH METER</span>
                <span className={isBellZone ? 'text-amber-300 animate-pulse' : 'text-emerald-300'}>
                  {isBellZone ? 'BELL ZONE!' : `${meterPct}%`}
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-slate-800 overflow-hidden relative border border-white/15">
                <div
                  className="h-full transition-none"
                  style={{
                    width: `${meterPct}%`,
                    backgroundColor: isBellZone ? '#FACC15' : '#22C55E',
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 right-0 w-[7%] border-l-2 border-white/80"
                  style={{ backgroundColor: 'rgba(250, 204, 21, 0.28)' }}
                />
              </div>
            </div>
          )}

          {game.usesNumberPick && (
            <div
              className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 rounded-2xl border border-white/20 shadow-lg"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.90)' }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const picked = game.pickedDucks.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={picked}
                    onClick={() => onPickDuck(n)}
                    className={`px-3 py-1.5 rounded-xl font-mono-num text-xs font-extrabold transition-colors ${
                      picked
                        ? 'bg-emerald-700/50 text-emerald-200 line-through cursor-not-allowed'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    }`}
                  >
                    Duck #{n}
                  </button>
                );
              })}
            </div>
          )}

          <div
            className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 rounded-2xl border border-white/15 text-xs text-slate-200 shadow-xl"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.90)' }}
          >
            <span className="hidden sm:inline text-slate-300">
              {game.usesNumberPick
                ? 'Click a 3D Duck or press 1–6'
                : game.usesPowerMeter
                  ? 'Click or Press Space at peak!'
                  : 'Aim with Mouse or WASD · Click / Space'}
            </span>
            <button
              type="button"
              onClick={onAction}
              data-testid="mela-3d-action-btn"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {game.actionLabel} [Space]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
