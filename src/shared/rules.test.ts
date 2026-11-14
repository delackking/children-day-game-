import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeaderboard,
  clampWorldPosition,
  computeCompetitionPoints,
  consumeInventoryBite,
  createInventoryEntry,
  detectZoneAt,
  extractYouTubeVideoId,
  filterChatMessage,
  findFoodItemById,
  validateArcadeScore,
  validateFoodPurchase,
} from './rules';
import { DEFAULT_AVATAR, FOOD_STALLS } from './catalog';
import {
  clampMelaAim,
  computeHighStrikerScore,
  computeMelaRewardCoins,
  findMela3DBooth,
  MELA_3D_BOOTHS,
} from './mela3d';
import type { PlayerState } from './types';

function makePlayer(id: string, name: string, overrides?: Partial<PlayerState>): PlayerState {
  return {
    id,
    name,
    isHost: false,
    online: true,
    muted: false,
    coins: 500,
    x: 0,
    y: 0,
    z: 43,
    rotY: 0,
    speed: 0,
    isJumping: false,
    zone: 'entrance',
    dance: 'none',
    heldBallId: null,
    consuming: null,
    avatar: DEFAULT_AVATAR,
    unlockedOutfits: ['kurta_saffron', 'tee_carnival'],
    inventory: [],
    stats: {
      arcadeWins: 0,
      arcadeBestTotal: 0,
      sportsScore: 0,
      goalsScored: 0,
      basketsScored: 0,
      treasuresFound: 0,
      dancesPerformed: 0,
      foodsEaten: 0,
      passesMade: 0,
    },
    badges: [],
    lastBubbleText: null,
    lastBubbleAt: 0,
    ...overrides,
  };
}

test('catalog contains all 15 required Indian food stalls', () => {
  assert.equal(FOOD_STALLS.length, 15);
  const ids = new Set(FOOD_STALLS.map((s) => s.id));
  for (const req of [
    'pav_bhaji',
    'chole_kulche',
    'lays_snacks',
    'appy_fizz',
    'rasgulla',
    'momos',
    'golgappe',
    'samosa',
    'pizza',
    'burger',
    'ice_cream',
    'cotton_candy',
    'cold_drinks',
    'chowmein',
    'jalebi',
  ]) {
    assert.ok(ids.has(req), `Missing stall ${req}`);
  }
});

test('food purchase validation prevents negative balances and invalid items', () => {
  const ok = validateFoodPurchase(100, 'item_pav_bhaji', 2);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.totalCost, 80);
    assert.equal(ok.newBalance, 20);
  }

  const broke = validateFoodPurchase(30, 'item_pav_bhaji', 1);
  assert.equal(broke.ok, false);

  const invalid = validateFoodPurchase(500, 'nonexistent_food', 1);
  assert.equal(invalid.ok, false);
});

test('food consumption decreases bites and removes finished item', () => {
  const item = findFoodItemById('item_rasgulla')!;
  let inv = [createInventoryEntry(item, 'inst_1', 1000)];
  assert.equal(inv[0].bitesRemaining, 3);

  const b1 = consumeInventoryBite(inv, 'inst_1');
  assert.equal(b1.ok, true);
  if (b1.ok) {
    assert.equal(b1.remainingBites, 2);
    assert.equal(b1.finished, false);
    inv = b1.updatedInventory;
  }

  const b2 = consumeInventoryBite(inv, 'inst_1');
  assert.equal(b2.ok, true);
  if (b2.ok) inv = b2.updatedInventory;

  const b3 = consumeInventoryBite(inv, 'inst_1');
  assert.equal(b3.ok, true);
  if (b3.ok) {
    assert.equal(b3.finished, true);
    assert.equal(b3.updatedInventory.length, 0);
  }
});

test('chat safety filter blocks personal contact info, HTML, and masks profanity', () => {
  const emailRes = filterChatMessage('Reach me at kid@example.com');
  assert.equal(emailRes.allowed, false);

  const phoneRes = filterChatMessage('Call 9876543210 right now');
  assert.equal(phoneRes.allowed, false);

  const htmlRes = filterChatMessage('<script>alert(1)</script>Hello friends!');
  assert.equal(htmlRes.allowed, true);
  assert.equal(htmlRes.sanitized, 'alert(1)Hello friends!');

  const badRes = filterChatMessage('You are an idiot!');
  assert.equal(badRes.allowed, true);
  assert.equal(badRes.flagged, true);
  assert.ok(!badRes.sanitized.includes('idiot'));
});

test('YouTube URL parser validates official URLs and rejects invalid inputs', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=12'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://evil.example.com/hack.mp3'), null);
});

test('leaderboard ranking ignores food spending and ranks strictly on competitions', () => {
  const foodie = makePlayer('p1', 'Aarav', {
    coins: 0,
    stats: {
      arcadeWins: 0,
      arcadeBestTotal: 0,
      sportsScore: 0,
      goalsScored: 0,
      basketsScored: 0,
      treasuresFound: 0,
      dancesPerformed: 5,
      foodsEaten: 25,
      passesMade: 0,
    },
  });
  const champ = makePlayer('p2', 'Diya', {
    coins: 500,
    stats: {
      arcadeWins: 2,
      arcadeBestTotal: 300,
      sportsScore: 4,
      goalsScored: 2,
      basketsScored: 0,
      treasuresFound: 1,
      dancesPerformed: 1,
      foodsEaten: 0,
      passesMade: 1,
    },
  });

  assert.equal(computeCompetitionPoints(foodie), 0);
  const board = buildLeaderboard([foodie, champ]);
  assert.equal(board[0].playerId, 'p2');
  assert.equal(board[1].playerId, 'p1');
});

test('arcade score validation clamps excessive scores and rejects negatives', () => {
  const bad = validateArcadeScore('snake', -50);
  assert.equal(bad.ok, false);
  const capped = validateArcadeScore('snake', 999999);
  assert.equal(capped.ok, true);
  if (capped.ok) assert.equal(capped.score, 2000);
});

test('world bounds and zone detection resolve accurately', () => {
  assert.equal(detectZoneAt(0, 43), 'entrance');
  assert.equal(detectZoneAt(-32, 0), 'food_street');
  assert.equal(detectZoneAt(36, 6), 'sports_ground');
  const clamped = clampWorldPosition(200, 0);
  assert.ok(clamped.x < 90);
});

test('firework catalog items preserve category and validate coin purchases', () => {
  const skyshot = findFoodItemById('fw_tricolour_skyshot');
  assert.ok(skyshot);
  assert.equal(skyshot.category, 'firework');
  assert.equal(skyshot.fireworkEffect, 'skyshot');

  const buy = validateFoodPurchase(200, 'fw_tricolour_skyshot', 1);
  assert.equal(buy.ok, true);
  if (buy.ok) {
    const entry = createInventoryEntry(buy.item, 'fw_1', 1000);
    assert.equal(entry.category, 'firework');
    assert.equal(entry.fireworkEffect, 'skyshot');
  }
});

test('new carnival midway and Indian mela games validate and clamp scores', () => {
  const matka = validateArcadeScore('matka_phod', 1200);
  assert.equal(matka.ok, true);
  if (matka.ok) assert.equal(matka.score, 1200);

  const gilli = validateArcadeScore('gilli_danda', 5000);
  assert.equal(gilli.ok, true);
  if (gilli.ok) assert.equal(gilli.score, 1800);

  const ring = validateArcadeScore('ring_toss', 900);
  assert.equal(ring.ok, true);
  if (ring.ok) assert.equal(ring.score, 900);
});

test('Sutli Bomb is expensive and retains sutli effect metadata', () => {
  const sutli = findFoodItemById('fw_sutli_bomb');
  assert.ok(sutli);
  assert.equal(sutli.price, 120);
  assert.equal(sutli.category, 'firework');
  assert.equal(sutli.fireworkEffect, 'sutli');

  const buy = validateFoodPurchase(250, 'fw_sutli_bomb', 1);
  assert.equal(buy.ok, true);
  if (buy.ok) {
    assert.equal(buy.newBalance, 130);
    const entry = createInventoryEntry(buy.item, 'fw_sutli_1', 1000);
    assert.equal(entry.fireworkEffect, 'sutli');
  }
});

test('3D Mela booths cover 6 distinct non-overlapping in-world fairground games', () => {
  assert.equal(MELA_3D_BOOTHS.length, 6);
  const ids = new Set(MELA_3D_BOOTHS.map((b) => b.id));
  assert.equal(ids.size, 6);
  const matka = findMela3DBooth('matka_phod');
  assert.ok(matka);
  assert.equal(matka.standX, -16.8);

  assert.equal(clampMelaAim(2.5), 1);
  assert.equal(clampMelaAim(-3.2), -1);
  assert.equal(clampMelaAim(Number.NaN), 0);

  const bell = computeHighStrikerScore(0.95);
  assert.equal(bell.isBell, true);
  assert.equal(bell.score, 450);

  const weak = computeHighStrikerScore(0.55);
  assert.equal(weak.isBell, false);
  assert.equal(weak.score, 0);

  const solid = computeHighStrikerScore(0.7);
  assert.equal(solid.isBell, false);
  assert.equal(solid.score, 110);

  assert.equal(computeMelaRewardCoins(0), 0);
  assert.equal(computeMelaRewardCoins(150), 0);
  assert.equal(computeMelaRewardCoins(450), 6);
  assert.equal(computeMelaRewardCoins(3000), 25);
});
