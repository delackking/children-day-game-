import type { ArcadeGameId } from './types';

export type Mela3DGameId =
  | 'matka_phod'
  | 'ring_toss'
  | 'can_knockdown'
  | 'high_striker'
  | 'duck_pond'
  | 'balloon_pop';

export interface Mela3DBoothDef {
  id: Mela3DGameId;
  name: string;
  tagline: string;
  instructions: string;
  actionLabel: string;
  accent: string;
  boothX: number;
  boothZ: number;
  /** -1 for West row (player faces -X toward booth), +1 for East row (player faces +X toward booth) */
  facingX: -1 | 1;
  standX: number;
  standZ: number;
  standRotY: number;
  maxAttempts: number;
  usesNumberPick?: boolean;
  usesPowerMeter?: boolean;
}

export const MELA_3D_BOOTHS: Mela3DBoothDef[] = [
  {
    id: 'matka_phod',
    name: 'Matka Phod (Dahi Handi)',
    tagline: 'Smash fast-swinging clay handis in 3D!',
    instructions: 'Lead the fast-swinging matka with Mouse or WASD, then Click or press Space to sling!',
    actionLabel: 'Sling Stone',
    accent: '#D97706',
    boothX: -20.5,
    boothZ: -19.5,
    facingX: -1,
    standX: -16.8,
    standZ: -19.5,
    standRotY: -Math.PI / 2,
    maxAttempts: 4,
  },
  {
    id: 'ring_toss',
    name: 'Ring Toss (Hoopla)',
    tagline: 'Precision-land rings onto bottle necks!',
    instructions: 'Aim dead-center over a bottle neck (wind adds slight drift) and Click or Space to toss!',
    actionLabel: 'Toss Ring',
    accent: '#EC4899',
    boothX: -20.5,
    boothZ: -24.5,
    facingX: -1,
    standX: -16.8,
    standZ: -24.5,
    standRotY: -Math.PI / 2,
    maxAttempts: 5,
  },
  {
    id: 'can_knockdown',
    name: 'Can Knockdown',
    tagline: 'Topple the 6-can stack in just 3 throws!',
    instructions: 'Hit the lower-center base cleanly in 3 throws! Click or press Space to throw!',
    actionLabel: 'Throw Beanbag',
    accent: '#EA580C',
    boothX: -20.5,
    boothZ: -29.5,
    facingX: -1,
    standX: -16.8,
    standZ: -29.5,
    standRotY: -Math.PI / 2,
    maxAttempts: 3,
  },
  {
    id: 'high_striker',
    name: 'High Striker Bell',
    tagline: 'Time the turbo meter to ring the top bell!',
    instructions: 'Catch the blazing strength meter in the top 7% Bell Zone! Under 62% scores 0!',
    actionLabel: 'Swing Mallet!',
    accent: '#DC2626',
    boothX: -10.5,
    boothZ: -19.5,
    facingX: 1,
    standX: -14.2,
    standZ: -19.5,
    standRotY: Math.PI / 2,
    maxAttempts: 3,
    usesPowerMeter: true,
  },
  {
    id: 'duck_pond',
    name: 'Duck Pond Match',
    tagline: 'Pick 2 lucky fast-swimming ducks (watch for duds)!',
    instructions: 'Click 2 swimming 3D ducks (or press 1–6) — some ducks hold 0 pts!',
    actionLabel: 'Pick Highlighted Duck',
    accent: '#EAB308',
    boothX: -10.5,
    boothZ: -24.5,
    facingX: 1,
    standX: -14.2,
    standZ: -24.5,
    standRotY: Math.PI / 2,
    maxAttempts: 2,
    usesNumberPick: true,
  },
  {
    id: 'balloon_pop',
    name: 'Balloon Pop Darts',
    tagline: 'Pop swaying 3D balloons with 5 sharp darts!',
    instructions: 'Track the swaying balloons carefully with 5 darts and Click or press Space!',
    actionLabel: 'Throw Dart',
    accent: '#EF4444',
    boothX: -10.5,
    boothZ: -29.5,
    facingX: 1,
    standX: -14.2,
    standZ: -29.5,
    standRotY: Math.PI / 2,
    maxAttempts: 5,
  },
];

export function findMela3DBooth(id: ArcadeGameId | string): Mela3DBoothDef | undefined {
  return MELA_3D_BOOTHS.find((b) => b.id === id);
}

export function clampMelaAim(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

export function computeHighStrikerScore(meter01: number): {
  score: number;
  tier: string;
  isBell: boolean;
  heightFraction: number;
} {
  const m = Math.max(0, Math.min(1, meter01));
  if (m >= 0.93) {
    return { score: 450, tier: 'BELL RINGER! MEGA HIT!', isBell: true, heightFraction: 1.0 };
  }
  if (m >= 0.8) {
    return { score: 220, tier: 'Super Strong!', isBell: false, heightFraction: 0.78 };
  }
  if (m >= 0.62) {
    return { score: 110, tier: 'Solid Swing!', isBell: false, heightFraction: 0.56 };
  }
  return { score: 0, tier: 'Too Weak! 0 pts!', isBell: false, heightFraction: Math.max(0.15, m * 0.65) };
}

export function computeMelaRewardCoins(score: number): number {
  if (score < 200) return 0;
  return Math.min(25, Math.max(3, Math.floor((score - 150) / 45)));
}
