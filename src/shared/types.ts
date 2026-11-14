export type ZoneId =
  | 'entrance'
  | 'central_plaza'
  | 'food_street'
  | 'sports_ground'
  | 'dj_arena'
  | 'arcade_zone'
  | 'celebration_stage';

export type CameraMode = 'third_rear' | 'first_person' | 'third_front';

export type DanceId =
  | 'none'
  | 'normal_dance'
  | 'funny_dance'
  | 'celebration'
  | 'jump_dance'
  | 'robot_dance'
  | 'victory_dance'
  | 'wave'
  | 'clap'
  | 'laugh'
  | 'sit'
  | 'cheer';

export type OutfitCategory = 'traditional' | 'casual';

export type OutfitId =
  | 'kurta_saffron'
  | 'kurta_peacock'
  | 'kurta_printed'
  | 'nehru_royal'
  | 'sherwani_festive'
  | 'tee_carnival'
  | 'hoodie_sky'
  | 'jacket_sport';

export type HairstyleId = 'classic_short' | 'curly_puff' | 'twin_braids' | 'side_part' | 'festive_bun';

export type AccessoryId = 'sunglasses' | 'cap' | 'watch' | 'bracelet' | 'sneakers';

export interface AvatarConfig {
  skinTone: string;
  hairstyle: HairstyleId;
  hairColor: string;
  outfit: OutfitId;
  topColor: string;
  bottomColor: string;
  accessories: AccessoryId[];
}

export type FoodVisualType = 'plate' | 'bottle' | 'packet' | 'sweet' | 'cone' | 'cup' | 'floss' | 'firework';

export type FireworkEffectType = 'skyshot' | 'skyshot_multi' | 'fountain' | 'chakra' | 'crackers' | 'sutli';

export interface FoodItem {
  id: string;
  stallId: string;
  name: string;
  description: string;
  price: number;
  visualType: FoodVisualType;
  maxBites: number;
  primaryColor: string;
  secondaryColor: string;
  isDrink: boolean;
  category?: 'food' | 'firework';
  fireworkEffect?: FireworkEffectType;
}

export interface FoodStallDef {
  id: string;
  name: string;
  vendorName: string;
  greeting: string;
  x: number;
  z: number;
  rotationY: number;
  awningColorA: string;
  awningColorB: string;
  items: FoodItem[];
}

export interface InventoryEntry {
  instanceId: string;
  itemId: string;
  name: string;
  visualType: FoodVisualType;
  bitesRemaining: number;
  maxBites: number;
  primaryColor: string;
  secondaryColor: string;
  isDrink: boolean;
  category?: 'food' | 'firework';
  fireworkEffect?: FireworkEffectType;
  purchasedAt: number;
}

export interface FireworkIgnitedEvent {
  id: string;
  playerId: string;
  playerName: string;
  itemName: string;
  effect: FireworkEffectType;
  x: number;
  y: number;
  z: number;
  primaryColor: string;
  secondaryColor: string;
  timestamp: number;
}

export interface ActiveConsumeState {
  itemId: string;
  name: string;
  visualType: FoodVisualType;
  bitesRemaining: number;
  maxBites: number;
  primaryColor: string;
  secondaryColor: string;
  isDrink: boolean;
  startedAt: number;
}

export interface PlayerStats {
  arcadeWins: number;
  arcadeBestTotal: number;
  sportsScore: number;
  goalsScored: number;
  basketsScored: number;
  treasuresFound: number;
  dancesPerformed: number;
  foodsEaten: number; // tracked for Food Lover badge only, never competition rank
  passesMade: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isHost: boolean;
  online: boolean;
  muted: boolean;
  coins: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  isJumping: boolean;
  zone: ZoneId;
  dance: DanceId;
  heldBallId: string | null;
  consuming: ActiveConsumeState | null;
  avatar: AvatarConfig;
  unlockedOutfits: OutfitId[];
  inventory: InventoryEntry[];
  stats: PlayerStats;
  badges: string[];
  lastBubbleText: string | null;
  lastBubbleAt: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  text: string;
  timestamp: number;
  kind: 'chat' | 'announcement' | 'system';
}

export type LightingMode = 'festive' | 'disco' | 'golden' | 'neon_party';

export interface DjTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  keyHz: number;
  youtubeId?: string;
}

export interface DjState {
  trackId: string;
  title: string;
  youtubeId: string | null;
  youtubeUrl: string | null;
  isPlaying: boolean;
  startedAt: number; // epoch ms when playback started/resumed
  pausedOffsetSec: number;
  volume: number; // 0..100
  lightingMode: LightingMode;
  queue: DjTrack[];
}

export interface BallState {
  id: string;
  kind: 'football' | 'basketball' | 'beachball';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  holderId: string | null;
  lastKickerId: string | null;
  updatedAt: number;
}

export interface TreasureNode {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  rewardCoins: number;
  claimedBy: string | null;
  claimedByName: string | null;
}

export type ArcadeGameId =
  | 'memory_match'
  | 'tic_tac_toe'
  | 'snake'
  | 'whack_a_mole'
  | 'reaction_speed'
  | 'number_puzzle'
  | 'color_match'
  | 'quick_maths'
  | 'word_guess'
  | 'mini_racing'
  | 'ring_toss'
  | 'can_knockdown'
  | 'balloon_pop'
  | 'duck_pond'
  | 'cup_ball_toss'
  | 'dunk_tank'
  | 'high_striker'
  | 'prize_wheel'
  | 'dart_game'
  | 'feed_the_clown'
  | 'tp_toss'
  | 'matka_phod'
  | 'kite_duel'
  | 'kancha_marbles'
  | 'gilli_danda';

export interface ArcadeChallenge {
  id: string;
  gameId: ArcadeGameId;
  hostPlayerId: string;
  hostName: string;
  opponentId: string | null;
  opponentName: string | null;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  readyIds: string[];
  roundDurationSec: number;
  startedAt: number | null;
  boardState: (string | null)[];
  turnPlayerId: string | null;
  scores: Record<string, number>;
  winnerId: string | null;
}

export interface TransactionRecord {
  id: string;
  playerId: string;
  playerName: string;
  type: 'purchase' | 'reward' | 'host_grant' | 'host_deduct';
  amount: number;
  itemName: string;
  timestamp: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  reason: string;
  timestamp: number;
  resolved: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  competitionPoints: number;
  arcadeWins: number;
  sportsScore: number;
  treasuresFound: number;
  badges: string[];
}

export type EventPhase =
  | 'free_play'
  | 'opening_ceremony'
  | 'competition'
  | 'group_dance'
  | 'prize_ceremony';

export type TimeOfDay = 'day' | 'sunset' | 'night';

export interface RoomPublicState {
  code: string;
  name: string;
  maxPlayers: number;
  locked: boolean;
  chatDisabled: boolean;
  hostPlayerId: string;
  timeOfDay: TimeOfDay;
  eventPhase: EventPhase;
  groupDanceActive: DanceId | null;
  fireworksBurstAt: number;
  announcement: {
    id: string;
    text: string;
    senderName: string;
    timestamp: number;
  } | null;
  treasureHunt: {
    active: boolean;
    startedAt: number | null;
    durationSec: number;
    nodes: TreasureNode[];
  };
  dj: DjState;
  balls: BallState[];
  players: Record<string, PlayerState>;
  chat: ChatMessage[];
  arcadeChallenge: ArcadeChallenge | null;
  activeCompetition: {
    gameId: string;
    title: string;
    endsAt: number;
  } | null;
  leaderboard: LeaderboardEntry[];
  transactions: TransactionRecord[];
  reports: ReportRecord[];
}
