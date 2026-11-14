import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import type { ArcadeGameId } from '../../shared/types';

interface GameProps {
  onFinish: (gameId: ArcadeGameId, score: number, won: boolean) => void;
}

// 7. High Striker (Mallet Bell)
export const HighStrikerGame: React.FC<GameProps> = ({ onFinish }) => {
  const [swingsLeft, setSwingsLeft] = useState(3);
  const [gauge, setGauge] = useState(0);
  const [bestHit, setBestHit] = useState(0);
  const [score, setScore] = useState(0);
  const [bellRang, setBellRang] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      setGauge(Math.round(50 + Math.sin(t * 4.4) * 50));
    }, 25);
    return () => clearInterval(id);
  }, []);

  const swingMallet = () => {
    if (doneRef.current || swingsLeft <= 0) return;
    const hit = gauge;
    setBestHit((b) => Math.max(b, hit));
    const rang = hit >= 88;
    const pts = rang ? 500 : hit * 4;
    const nextScore = score + pts;
    setScore(nextScore);
    if (rang) {
      soundEngine.playBellRing();
      setBellRang(true);
    } else {
      soundEngine.playKick();
    }
    const nextSwings = swingsLeft - 1;
    setSwingsLeft(nextSwings);
    if (nextSwings <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('high_striker', nextScore, nextScore >= 800), 650);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Swings Left: {swingsLeft}</span>
        <span>Best Hit: {bestHit}%</span>
        <span>Score: {score}</span>
      </div>
      <div className="flex items-center justify-center gap-6 py-3">
        <div className="relative w-14 h-52 rounded-xl bg-slate-900 border-4 border-amber-400 flex flex-col justify-end p-1">
          <div
            className={`absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg border-2 ${
              bellRang ? 'bg-amber-400 border-white animate-ping' : 'bg-amber-500 border-amber-200'
            }`}
          >
            🔔
          </div>
          <div
            className="w-full rounded-lg bg-gradient-to-t from-emerald-500 via-amber-400 to-red-600 transition-all duration-150"
            style={{ height: `${bestHit}%` }}
          />
        </div>
        <div className="w-48 space-y-2">
          <p className="text-xs font-bold text-slate-600">Strike near 100% to Ring the Bell (+500)!</p>
          <div className="h-6 rounded-full bg-slate-200 overflow-hidden border border-slate-400">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-amber-400 to-red-600"
              style={{ width: `${gauge}%` }}
            />
          </div>
          <p className="text-lg font-black text-red-600 tabular-nums">{gauge}%</p>
        </div>
      </div>
      <button
        type="button"
        onClick={swingMallet}
        disabled={swingsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
      >
        SMASH MALLET!
      </button>
    </div>
  );
};

// 8. Spin the Prize Wheel
export const PrizeWheelGame: React.FC<GameProps> = ({ onFinish }) => {
  const wedges = [
    { label: '500 JACKPOT', pts: 500, color: '#F59E0B' },
    { label: '100', pts: 100, color: '#EF4444' },
    { label: '300', pts: 300, color: '#10B981' },
    { label: '150', pts: 150, color: '#0284C7' },
    { label: '400', pts: 400, color: '#EC4899' },
    { label: '200', pts: 200, color: '#8B5CF6' },
  ];
  const [spinsLeft, setSpinsLeft] = useState(3);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [score, setScore] = useState(0);
  const [lastWin, setLastWin] = useState('Spin the colourful prize wheel!');
  const doneRef = useRef(false);

  const spin = () => {
    if (spinning || spinsLeft <= 0 || doneRef.current) return;
    soundEngine.playClick();
    setSpinning(true);
    const chosenIdx = Math.floor(Math.random() * wedges.length);
    const sliceDeg = 360 / wedges.length;
    const extraSpins = 360 * 4;
    const targetOffset = (360 - (chosenIdx * sliceDeg + sliceDeg / 2)) % 360;
    const nextAngle = angle - (angle % 360) + extraSpins + targetOffset;
    setAngle(nextAngle);

    window.setTimeout(() => {
      const prize = wedges[chosenIdx];
      soundEngine.playCoin();
      const nextScore = score + prize.pts;
      setScore(nextScore);
      setLastWin(`Landed on ${prize.label}! (+${prize.pts})`);
      setSpinning(false);
      const nextSpins = spinsLeft - 1;
      setSpinsLeft(nextSpins);
      if (nextSpins <= 0 && !doneRef.current) {
        doneRef.current = true;
        window.setTimeout(() => onFinish('prize_wheel', nextScore, nextScore >= 700), 650);
      }
    }, 1500);
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Spins Left: {spinsLeft}</span>
        <span className="text-purple-700">{lastWin}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative flex justify-center py-2">
        <div className="absolute top-0 z-10 text-xl">▼</div>
        <div
          className="w-48 h-48 rounded-full border-4 border-amber-300 shadow-xl transition-transform ease-out"
          style={{
            transform: `rotate(${angle}deg)`,
            transitionDuration: '1450ms',
            background: `conic-gradient(${wedges
              .map((w, i) => `${w.color} ${(i * 100) / 6}% ${((i + 1) * 100) / 6}%`)
              .join(', ')})`,
          }}
        />
      </div>
      <div className="flex justify-center flex-wrap gap-1.5 text-[10px] font-bold">
        {wedges.map((w) => (
          <span key={w.label} className="px-2 py-0.5 rounded text-white" style={{ backgroundColor: w.color }}>
            {w.label}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={spin}
        disabled={spinning || spinsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50"
      >
        {spinning ? 'Spinning...' : 'Spin Prize Wheel!'}
      </button>
    </div>
  );
};

// 9. Dart Game (Bullseye Darts)
export const DartGame: React.FC<GameProps> = ({ onFinish }) => {
  const [darts, setDarts] = useState(6);
  const [score, setScore] = useState(0);
  const [aim, setAim] = useState({ x: 50, y: 50 });
  const [hits, setHits] = useState<{ x: number; y: number; pts: number }[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      setAim({
        x: 50 + Math.sin(t * 2.5) * 32,
        y: 50 + Math.cos(t * 3.1) * 32,
      });
    }, 30);
    return () => clearInterval(id);
  }, []);

  const throwDart = () => {
    if (doneRef.current || darts <= 0) return;
    const dist = Math.hypot(aim.x - 50, aim.y - 50);
    const pts = dist < 9 ? 250 : dist < 20 ? 150 : dist < 34 ? 80 : 30;
    soundEngine.playPop();
    const nextScore = score + pts;
    setScore(nextScore);
    setHits((prev) => [...prev, { x: aim.x, y: aim.y, pts }]);
    const nextDarts = darts - 1;
    setDarts(nextDarts);
    if (nextDarts <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('dart_game', nextScore, nextScore >= 600), 550);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Darts: {darts}</span>
        <span className="text-emerald-700">Center Bullseye = 250 pts!</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative mx-auto w-52 h-52 rounded-full bg-slate-900 border-4 border-emerald-400 flex items-center justify-center overflow-hidden">
        <div className="w-36 h-36 rounded-full border-4 border-white/60 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-amber-300" />
          </div>
        </div>
        {hits.map((h, i) => (
          <div
            key={i}
            style={{ left: `${h.x}%`, top: `${h.y}%`, transform: 'translate(-50%, -50%)' }}
            className="absolute w-3 h-3 rounded-full bg-amber-300 border border-slate-900"
          />
        ))}
        <div
          style={{ left: `${aim.x}%`, top: `${aim.y}%`, transform: 'translate(-50%, -50%)' }}
          className="absolute w-6 h-6 rounded-full border-2 border-yellow-300 pointer-events-none"
        />
      </div>
      <button
        type="button"
        onClick={throwDart}
        disabled={darts <= 0}
        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
      >
        Throw Dart!
      </button>
    </div>
  );
};

// 10. Feed the Clown
export const FeedTheClownGame: React.FC<GameProps> = ({ onFinish }) => {
  const [balls, setBalls] = useState(8);
  const [score, setScore] = useState(0);
  const [clownX, setClownX] = useState(50);
  const [mouthOpen, setMouthOpen] = useState(true);
  const [msg, setMsg] = useState('Aim for center when the clown glides by with mouth open!');
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      setClownX(50 + Math.sin(t * 2.3) * 34);
      setMouthOpen(Math.sin(t * 4.5) > -0.35);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const tossBall = () => {
    if (doneRef.current || balls <= 0) return;
    const hit = mouthOpen && Math.abs(clownX - 50) <= 13;
    let nextScore = score;
    if (hit) {
      soundEngine.playCoin();
      nextScore += 200;
      setScore(nextScore);
      setMsg('YUM! Direct hit into the clown’s mouth! +200');
    } else {
      soundEngine.playClick();
      setMsg('Missed the open mouth! Watch center alignment.');
    }
    const nextBalls = balls - 1;
    setBalls(nextBalls);
    if (nextBalls <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('feed_the_clown', nextScore, nextScore >= 600), 450);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Balls: {balls}</span>
        <span className="text-amber-700">{msg}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-48 rounded-2xl bg-amber-50 border-2 border-amber-300 overflow-hidden flex items-center justify-center">
        <div
          style={{ left: `${clownX}%`, transform: 'translateX(-50%)' }}
          className="absolute top-6 w-24 h-28 rounded-2xl bg-rose-500 border-4 border-yellow-300 flex flex-col items-center justify-center shadow-lg"
        >
          <span className="text-xl">🤡</span>
          <div
            className={`mt-1 w-12 rounded-b-full bg-slate-900 border-2 border-white transition-all ${
              mouthOpen ? 'h-7' : 'h-1.5'
            }`}
          />
        </div>
        <div className="absolute bottom-3 w-8 h-8 rounded-full border-2 border-dashed border-red-500" />
      </div>
      <button
        type="button"
        onClick={tossBall}
        disabled={balls <= 0}
        className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold"
      >
        Feed Ball Center!
      </button>
    </div>
  );
};

// 11. Toilet Paper Toss (Wind-compensated)
export const ToiletPaperTossGame: React.FC<GameProps> = ({ onFinish }) => {
  const [rolls, setRolls] = useState(6);
  const [score, setScore] = useState(0);
  const [wind, setWind] = useState(14);
  const [aim, setAim] = useState(50);
  const [msg, setMsg] = useState('Compensate aim opposite the fan breeze!');
  const doneRef = useRef(false);

  const tossRoll = () => {
    if (doneRef.current || rolls <= 0) return;
    // Wind pushes roll sideways: landingX = aim + wind
    const landingX = aim + wind;
    const dist = Math.abs(landingX - 50);
    let pts = 0;
    if (dist <= 9) {
      pts = 250;
      soundEngine.playCoin();
      setMsg('SWISH! Right inside the bin! +250');
    } else if (dist <= 18) {
      pts = 100;
      soundEngine.playPop();
      setMsg('Rim bounce in! +100');
    } else {
      soundEngine.playClick();
      setMsg(`Blew past bin! (Landed ${Math.round(landingX)} vs 50)`);
    }
    const nextScore = score + pts;
    setScore(nextScore);
    const nextRolls = rolls - 1;
    setRolls(nextRolls);
    setWind(Math.round((Math.random() - 0.5) * 44));
    if (nextRolls <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('tp_toss', nextScore, nextScore >= 600), 550);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>TP Rolls: {rolls}</span>
        <span className="text-sky-700">
          Fan Wind: {wind === 0 ? 'Calm' : wind > 0 ? `Right -> +${wind}` : `<- Left ${wind}`}
        </span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-40 rounded-2xl bg-slate-100 border-2 border-slate-300 flex flex-col justify-between p-4">
        <div className="mx-auto w-20 h-16 rounded-b-xl bg-slate-700 border-4 border-slate-400 text-white text-xs font-bold flex items-center justify-center">
          TARGET BIN
        </div>
        <p className="text-xs font-semibold text-slate-600">{msg}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold">Aim:</span>
          <input
            type="range"
            min={10}
            max={90}
            value={aim}
            onChange={(e) => setAim(Number(e.target.value))}
            className="flex-1 accent-slate-800"
          />
          <span className="text-xs font-mono-num font-bold w-8">{aim}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={tossRoll}
        disabled={rolls <= 0}
        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold"
      >
        Toss TP Roll! 🧻
      </button>
    </div>
  );
};
