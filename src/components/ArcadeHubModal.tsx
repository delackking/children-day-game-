import React, { useState } from 'react';
import { Gamepad2, RotateCcw, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { ARCADE_GAMES } from '../shared/catalog';
import type { ArcadeGameId } from '../shared/types';
import { useGameStore } from '../stores/useGameStore';
import {
  MemoryMatchGame,
  ReactionSpeedGame,
  SnakeGame,
  TicTacToeGame,
  WhackAMoleGame,
} from './games/ArcadeGamesSetA';
import {
  ColorMatchGame,
  MiniRacingGame,
  NumberPuzzleGame,
  QuickMathsGame,
  WordGuessGame,
} from './games/ArcadeGamesSetB';
import {
  BalloonPopGame,
  CanKnockdownGame,
  CupBallTossGame,
  DuckPondGame,
  DunkTankGame,
  RingTossGame,
} from './games/CarnivalMidwaySetA';
import {
  DartGame,
  FeedTheClownGame,
  HighStrikerGame,
  PrizeWheelGame,
  ToiletPaperTossGame,
} from './games/CarnivalMidwaySetB';
import {
  GilliDandaGame,
  KanchaMarblesGame,
  MatkaPhodGame,
  PatangKiteDuelGame,
} from './games/IndianMelaGames';

interface ArcadeHubModalProps {
  onClose: () => void;
}

export const ArcadeHubModal: React.FC<ArcadeHubModalProps> = ({ onClose }) => {
  const pushToast = useGameStore((s) => s.pushToast);
  const [selected, setSelected] = useState<ArcadeGameId | null>(null);
  const [tab, setTab] = useState<'all' | 'midway' | 'indian' | 'arcade'>('all');
  const [result, setResult] = useState<{ score: number; coins: number; won: boolean } | null>(null);
  const [runNonce, setRunNonce] = useState(0);

  const handleFinish = async (gameId: ArcadeGameId, score: number, won: boolean) => {
    const res = await socketClient.submitArcadeScore(gameId, score, won);
    if (res.ok) {
      soundEngine.playArcadeWin();
      setResult({ score: res.validatedScore ?? score, coins: res.rewardCoins ?? 10, won });
      pushToast(`Game Complete! +${res.rewardCoins} coins`, 'success');
    }
  };

  const activeDef = ARCADE_GAMES.find((g) => g.id === selected);
  const visibleGames = tab === 'all' ? ARCADE_GAMES : ARCADE_GAMES.filter((g) => g.category === tab);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.78)' }}>
      <div
        role="dialog"
        aria-label="Carnival 2D Arcade Zone"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-sky-300 shadow-2xl p-6 text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-6 h-6 text-sky-600" />
            <div>
              <h2 className="font-display text-xl font-bold">
                {activeDef ? activeDef.name : 'Carnival, Indian Mela & Arcade Games (25)'}
              </h2>
              <p className="text-xs text-slate-600">
                {activeDef ? activeDef.tagline : 'Win coins and climb the official room Leaderboard!'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Arcade"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: `All Games (${ARCADE_GAMES.length})` },
                { id: 'midway', label: 'Carnival Midway (11)' },
                { id: 'indian', label: 'Indian Mela (4)' },
                { id: 'arcade', label: 'Arcade Zone (10)' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    tab === t.id ? 'bg-sky-600 text-white' : 'bg-white border border-amber-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleGames.map((g, idx) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setResult(null);
                    setSelected(g.id);
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-amber-200 hover:border-sky-500 text-left transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {idx + 1}. {g.name}
                    </p>
                    <p className="text-xs text-slate-600">{g.tagline}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {g.category === 'indian' && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">Mela</span>
                    )}
                    {g.supportsPvp && (
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">PvP</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result ? (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-300 text-center space-y-3">
                <p className="font-display text-2xl font-bold text-slate-900">
                  {result.won ? 'Victory! Well Played!' : 'Great Attempt!'}
                </p>
                <p className="text-sm font-semibold text-slate-700 tabular-nums">
                  Validated Score: <strong>{result.score}</strong> · Reward: <strong>+{result.coins} Coins</strong>
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setRunNonce((n) => n + 1);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Play Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setResult(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    All 25 Games
                  </button>
                </div>
              </div>
            ) : (
              <div key={runNonce} className="p-4 rounded-2xl bg-white border border-amber-200">
                {selected === 'memory_match' && <MemoryMatchGame onFinish={handleFinish} />}
                {selected === 'tic_tac_toe' && <TicTacToeGame onFinish={handleFinish} />}
                {selected === 'snake' && <SnakeGame onFinish={handleFinish} />}
                {selected === 'whack_a_mole' && <WhackAMoleGame onFinish={handleFinish} />}
                {selected === 'reaction_speed' && <ReactionSpeedGame onFinish={handleFinish} />}
                {selected === 'number_puzzle' && <NumberPuzzleGame onFinish={handleFinish} />}
                {selected === 'color_match' && <ColorMatchGame onFinish={handleFinish} />}
                {selected === 'quick_maths' && <QuickMathsGame onFinish={handleFinish} />}
                {selected === 'word_guess' && <WordGuessGame onFinish={handleFinish} />}
                {selected === 'mini_racing' && <MiniRacingGame onFinish={handleFinish} />}

                {selected === 'ring_toss' && <RingTossGame onFinish={handleFinish} />}
                {selected === 'can_knockdown' && <CanKnockdownGame onFinish={handleFinish} />}
                {selected === 'balloon_pop' && <BalloonPopGame onFinish={handleFinish} />}
                {selected === 'duck_pond' && <DuckPondGame onFinish={handleFinish} />}
                {selected === 'cup_ball_toss' && <CupBallTossGame onFinish={handleFinish} />}
                {selected === 'dunk_tank' && <DunkTankGame onFinish={handleFinish} />}
                {selected === 'high_striker' && <HighStrikerGame onFinish={handleFinish} />}
                {selected === 'prize_wheel' && <PrizeWheelGame onFinish={handleFinish} />}
                {selected === 'dart_game' && <DartGame onFinish={handleFinish} />}
                {selected === 'feed_the_clown' && <FeedTheClownGame onFinish={handleFinish} />}
                {selected === 'tp_toss' && <ToiletPaperTossGame onFinish={handleFinish} />}

                {selected === 'matka_phod' && <MatkaPhodGame onFinish={handleFinish} />}
                {selected === 'kite_duel' && <PatangKiteDuelGame onFinish={handleFinish} />}
                {selected === 'kancha_marbles' && <KanchaMarblesGame onFinish={handleFinish} />}
                {selected === 'gilli_danda' && <GilliDandaGame onFinish={handleFinish} />}
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-amber-200">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setResult(null);
                }}
                className="text-xs font-bold text-sky-700 hover:underline"
              >
                &larr; Back to All Games
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Return to Carnival
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
