import React, { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from './ArcadeGamesSetA';

// 6. NUMBER PUZZLE (3x3 8-slide with genuine 24-step valid random shuffle)
function createShuffledBoard(): number[] {
  const b = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let zero = 8;
  let lastZero = -1;
  for (let step = 0; step < 26; step++) {
    const r = Math.floor(zero / 3);
    const c = zero % 3;
    const neighbors: number[] = [];
    if (r > 0) neighbors.push(zero - 3);
    if (r < 2) neighbors.push(zero + 3);
    if (c > 0) neighbors.push(zero - 1);
    if (c < 2) neighbors.push(zero + 1);
    const choices = neighbors.filter((n) => n !== lastZero);
    const pick = choices[Math.floor(Math.random() * choices.length)];
    b[zero] = b[pick];
    b[pick] = 0;
    lastZero = zero;
    zero = pick;
  }
  return b;
}

export const NumberPuzzleGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [tiles, setTiles] = useState<number[]>(() => createShuffledBoard());
  const [moves, setMoves] = useState(0);
  const doneRef = useRef(false);

  const moveTile = (idx: number) => {
    if (doneRef.current) return;
    const zero = tiles.indexOf(0);
    const r1 = Math.floor(idx / 3);
    const c1 = idx % 3;
    const r0 = Math.floor(zero / 3);
    const c0 = zero % 3;
    if (Math.abs(r1 - r0) + Math.abs(c1 - c0) !== 1) return;

    const next = [...tiles];
    next[zero] = tiles[idx];
    next[idx] = 0;
    const nextMoves = moves + 1;
    setTiles(next);
    setMoves(nextMoves);

    const solved = next.slice(0, 8).every((v, i) => v === i + 1);
    if (solved) {
      doneRef.current = true;
      onFinish('number_puzzle', Math.max(250, 800 - nextMoves * 12), true);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs font-bold">Arrange 1–8 in order · Moves: {moves}</p>
      <div className="grid grid-cols-3 gap-2 max-w-[210px] mx-auto">
        {tiles.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => moveTile(i)}
            className={`h-16 rounded-xl font-mono-num text-xl font-bold transition-colors ${
              t === 0 ? 'bg-slate-200' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
            }`}
          >
            {t === 0 ? '' : t}
          </button>
        ))}
      </div>
    </div>
  );
};

// 7. COLOUR MATCH (Stroop-style Rangoli challenge with randomized Stroop pairs & 1-4 hotkeys)
const COLORS = [
  { name: 'RED', hex: '#DC2626' },
  { name: 'BLUE', hex: '#2563EB' },
  { name: 'GREEN', hex: '#16A34A' },
  { name: 'GOLD', hex: '#D97706' },
];

function pickStroopPair(prevInk = -1): { w: number; ink: number } {
  const w = Math.floor(Math.random() * COLORS.length);
  let ink = Math.floor(Math.random() * COLORS.length);
  if (ink === prevInk) ink = (ink + 1 + Math.floor(Math.random() * 3)) % COLORS.length;
  return { w, ink };
}

export const ColorMatchGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [prompt, setPrompt] = useState(() => pickStroopPair());
  const doneRef = useRef(false);

  const answer = (idx: number) => {
    if (doneRef.current) return;
    const correct = idx === prompt.ink;
    const nextScore = correct ? score + 100 : score;
    setScore(nextScore);
    if (round + 1 >= 8) {
      doneRef.current = true;
      onFinish('color_match', nextScore, nextScore >= 500);
    } else {
      setRound((r) => r + 1);
      setPrompt(pickStroopPair(prompt.ink));
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-bold">Round {round + 1}/8 · Pick the INK COLOR (Score: {score})</p>
      <p className="font-display text-4xl font-extrabold" style={{ color: COLORS[prompt.ink].hex }}>
        {COLORS[prompt.w].name}
      </p>
      <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
        {COLORS.map((c, idx) => (
          <button
            key={c.name}
            type="button"
            onClick={() => answer(idx)}
            className="py-2.5 rounded-xl text-white text-xs font-bold shadow hover:opacity-95"
            style={{ backgroundColor: c.hex }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// 8. QUICK MATHS (+, -, × with guaranteed 4 distinct options)
export const QuickMathsGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [q, setQ] = useState(() => makeMathQ());
  const doneRef = useRef(false);

  function makeMathQ() {
    const ops = ['+', '-', '×'] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = 4 + Math.floor(Math.random() * 14);
    let b = 2 + Math.floor(Math.random() * 11);
    let ans = a + b;
    if (op === '-') {
      if (b > a) [a, b] = [b, a];
      ans = a - b;
    } else if (op === '×') {
      a = 2 + Math.floor(Math.random() * 9);
      b = 2 + Math.floor(Math.random() * 9);
      ans = a * b;
    }
    const set = new Set<number>([ans]);
    while (set.size < 4) {
      const delta = (Math.floor(Math.random() * 9) - 4) || 3;
      const cand = Math.max(0, ans + delta);
      set.add(cand);
    }
    const opts = Array.from(set).sort(() => Math.random() - 0.5);
    return { text: `${a} ${op} ${b} = ?`, ans, opts };
  }

  const pick = (val: number) => {
    if (doneRef.current) return;
    const nextScore = val === q.ans ? score + 120 : score;
    setScore(nextScore);
    if (round + 1 >= 6) {
      doneRef.current = true;
      onFinish('quick_maths', nextScore, nextScore >= 480);
    } else {
      setRound((r) => r + 1);
      setQ(makeMathQ());
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-bold">Question {round + 1}/6 · Score: {score}</p>
      <p className="font-mono-num text-3xl font-extrabold text-slate-900">{q.text}</p>
      <div className="grid grid-cols-2 gap-2.5 max-w-xs mx-auto">
        {q.opts.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pick(o)}
            className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-num font-bold text-lg"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
};

// 9. WORD GUESS (True 5-letter Carnival Words + Accurate Duplicate-Safe Wordle Coloring)
const WORDS_5 = ['LOTUS', 'MANGO', 'PARTY', 'STAGE', 'DANCE', 'MUSIC', 'PRIZE', 'LIGHT', 'SWEET', 'SPARK'];

function scoreWordleGuess(guess: string, target: string): Array<'exact' | 'present' | 'miss'> {
  const result: Array<'exact' | 'present' | 'miss'> = Array(5).fill('miss');
  const pool: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'exact';
    } else {
      pool[target[i]] = (pool[target[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'exact') continue;
    const ch = guess[i];
    if (pool[ch] && pool[ch] > 0) {
      result[i] = 'present';
      pool[ch]--;
    }
  }
  return result;
}

export const WordGuessGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [target] = useState(() => WORDS_5[Math.floor(Math.random() * WORDS_5.length)]);
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = guess.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    if (clean.length < 5) {
      setNote('Enter a 5-letter word!');
      return;
    }
    setNote(null);
    const next = [...attempts, clean];
    setAttempts(next);
    setGuess('');
    if (clean === target) {
      onFinish('word_guess', Math.max(300, 850 - next.length * 90), true);
    } else if (next.length >= 5) {
      setNote(`The word was ${target}!`);
      onFinish('word_guess', 140, false);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs font-bold">Guess the 5-letter Carnival Word (LOTUS / MANGO / DANCE / STAGE / MUSIC / PRIZE / SWEET)</p>
      <div className="space-y-1.5">
        {attempts.map((a, r) => {
          const states = scoreWordleGuess(a, target);
          return (
            <div key={r} className="flex justify-center gap-1.5">
              {a.split('').map((ch, c) => (
                <span
                  key={c}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono-num font-bold text-white ${
                    states[c] === 'exact'
                      ? 'bg-emerald-600'
                      : states[c] === 'present'
                        ? 'bg-amber-500'
                        : 'bg-slate-600'
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      {note && <p className="text-xs font-bold text-amber-800">{note}</p>}
      <form onSubmit={submit} className="flex justify-center gap-2">
        <input
          ref={inputRef}
          type="text"
          maxLength={5}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="5 letters"
          className="w-32 px-3 py-2 rounded-xl border border-slate-300 text-center font-mono-num uppercase font-bold"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-amber-300 text-xs font-bold">
          Check
        </button>
      </form>
    </div>
  );
};

// 10. MINI RACING (Stable useRef loop — steering no longer resets timer; A/D/Left/Right keys supported)
export const MiniRacingGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [lane, setLane] = useState(1);
  const [obstacleLane, setObstacleLane] = useState(0);
  const [obsY, setObsY] = useState(0);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);

  const laneRef = useRef(1);
  const obsLaneRef = useRef(0);
  const obsYRef = useRef(0);
  const scoreRef = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const steer = (delta: number) => {
    laneRef.current = Math.max(0, Math.min(2, laneRef.current + delta));
    setLane(laneRef.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        steer(-1);
      } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        steer(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!alive) return;
    const t = window.setInterval(() => {
      const nextY = obsYRef.current + 1;
      if (nextY >= 4) {
        if (obsLaneRef.current === laneRef.current) {
          obsYRef.current = 4;
          setObsY(4);
          setAlive(false);
          finishRef.current('mini_racing', scoreRef.current, scoreRef.current >= 240);
          return;
        }
        scoreRef.current += 60;
        setScore(scoreRef.current);
        obsYRef.current = 0;
        obsLaneRef.current = Math.floor(Math.random() * 3);
        setObsY(0);
        setObstacleLane(obsLaneRef.current);
      } else {
        obsYRef.current = nextY;
        setObsY(nextY);
      }
    }, 260);
    return () => clearInterval(t);
  }, [alive]);

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs font-bold tabular-nums">Mela Speedway · Score: {score} · A/D or Arrows</p>
      <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto bg-slate-800 p-3 rounded-xl">
        {Array.from({ length: 15 }).map((_, idx) => {
          const r = Math.floor(idx / 3);
          const c = idx % 3;
          const isCar = r === 4 && c === lane;
          const isCone = r === obsY && c === obstacleLane;
          return (
            <div
              key={idx}
              className={`h-8 rounded flex items-center justify-center text-lg ${
                isCar ? 'bg-amber-400' : isCone ? 'bg-red-500' : 'bg-slate-700'
              }`}
            >
              {isCar ? '🏎️' : isCone ? '🚧' : ''}
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => steer(-1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          Steer Left
        </button>
        <button
          type="button"
          onClick={() => steer(1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          Steer Right
        </button>
      </div>
    </div>
  );
};
