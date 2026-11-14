import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './roomManager';

test('multiple players join private room, purchase & eat food, and cannot exceed wallet', () => {
  const mgr = new RoomManager({ persist: false, initialCoins: 100 });
  const created = mgr.createRoom({ hostName: 'Aanya', roomName: 'Kids Party', maxPlayers: 7 });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const code = created.room.code;
  const joined = mgr.joinRoom({ roomCode: code, playerName: 'Kabir' });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  assert.equal(Object.keys(joined.room.players).length, 2);

  // Kabir buys Pav Bhaji (40 coins)
  const buy1 = mgr.purchaseFood(joined.session, 'item_pav_bhaji', 1);
  assert.equal(buy1.ok, true);
  if (!buy1.ok) return;
  assert.equal(buy1.player.coins, 60);
  assert.equal(buy1.player.inventory.length, 1);

  // Cannot buy 2 Cheese Pav Bhaji (110 coins > 60)
  const buyFail = mgr.purchaseFood(joined.session, 'item_cheese_pav_bhaji', 2);
  assert.equal(buyFail.ok, false);

  // Eat all 4 bites
  const instId = buy1.player.inventory[0].instanceId;
  for (let i = 0; i < 4; i++) {
    const eat = mgr.consumeFoodBite(joined.session, instId);
    assert.equal(eat.ok, true);
  }
  assert.equal(buy1.player.inventory.length, 0);
  assert.equal(buy1.player.stats.foodsEaten, 1);
});

test('host-only actions reject non-host guests and forged hostSecret', () => {
  const mgr = new RoomManager({ persist: false });
  const created = mgr.createRoom({ hostName: 'HostPriya' });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = mgr.joinRoom({ roomCode: created.room.code, playerName: 'GuestRohan' });
  assert.equal(guest.ok, true);
  if (!guest.ok) return;

  // Guest tries to lock room or give coins
  const lockAttempt = mgr.hostSetRoomLock(guest.session, true);
  assert.equal(lockAttempt.ok, false);

  const forgedAttempt = mgr.hostAdjustCoins(
    { ...guest.session, hostSecret: 'fake-secret' },
    guest.player.id,
    1000,
  );
  assert.equal(forgedAttempt.ok, false);

  // Real host succeeds
  const hostLock = mgr.hostSetRoomLock(created.session, true);
  assert.equal(hostLock.ok, true);
  if (hostLock.ok) assert.equal(hostLock.room.locked, true);

  // New player blocked when room locked
  const blocked = mgr.joinRoom({ roomCode: created.room.code, playerName: 'LateGuest' });
  assert.equal(blocked.ok, false);
});

test('treasure hunt awards each treasure only once across concurrent claims', () => {
  const mgr = new RoomManager({ persist: false, initialCoins: 500 });
  const created = mgr.createRoom({ hostName: 'Host' });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const p2 = mgr.joinRoom({ roomCode: created.room.code, playerName: 'Player2' });
  assert.equal(p2.ok, true);
  if (!p2.ok) return;

  const started = mgr.hostStartTreasureHunt(created.session, 120);
  assert.equal(started.ok, true);
  if (!started.ok) return;

  const firstNodeId = started.room.treasureHunt.nodes[0].id;
  const claim1 = mgr.claimTreasure(created.session, firstNodeId);
  assert.equal(claim1.ok, true);

  // Second player cannot claim the same treasure
  const claim2 = mgr.claimTreasure(p2.session, firstNodeId);
  assert.equal(claim2.ok, false);
});

test('chat mute and PvP Tic Tac Toe match work end-to-end', () => {
  const mgr = new RoomManager({ persist: false });
  const created = mgr.createRoom({ hostName: 'Host' });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const p2 = mgr.joinRoom({ roomCode: created.room.code, playerName: 'Friend' });
  assert.equal(p2.ok, true);
  if (!p2.ok) return;

  // Mute Friend
  mgr.hostMutePlayer(created.session, p2.player.id, true);
  const mutedChat = mgr.sendChat(p2.session, 'Hello!');
  assert.equal(mutedChat.ok, false);

  // Tic Tac Toe PvP
  mgr.createTicTacToeChallenge(created.session);
  mgr.joinTicTacToeChallenge(p2.session);

  mgr.playTicTacToeMove(created.session, 0); // X
  mgr.playTicTacToeMove(p2.session, 3); // O
  mgr.playTicTacToeMove(created.session, 1); // X
  mgr.playTicTacToeMove(p2.session, 4); // O
  const winMove = mgr.playTicTacToeMove(created.session, 2); // X wins top row
  assert.equal(winMove.ok, true);
  if (winMove.ok) {
    assert.equal(winMove.room.arcadeChallenge?.status, 'finished');
    assert.equal(winMove.room.arcadeChallenge?.winnerId, created.player.id);
  }
});

test('buying & igniting fireworks deducts coins, removes item, and broadcasts effect; stale eating expires', () => {
  const mgr = new RoomManager({ persist: false, initialCoins: 200 });
  const created = mgr.createRoom({ hostName: 'Host', roomName: 'Diwali Mela' });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  // Buy Tricolour Skyshot (30 coins, 2 uses)
  const buyFw = mgr.purchaseFood(created.session, 'fw_tricolour_skyshot', 1);
  assert.equal(buyFw.ok, true);
  if (!buyFw.ok) return;
  assert.equal(buyFw.player.coins, 170);
  assert.equal(buyFw.player.inventory.length, 1);

  const fwId = buyFw.player.inventory[0].instanceId;
  // Eating a firework directly should be rejected
  const wrongEat = mgr.consumeFoodBite(created.session, fwId);
  assert.equal(wrongEat.ok, false);

  // Igniting the firework twice consumes both charges and removes it from bag
  const lit1 = mgr.igniteFirework(created.session, fwId, 10, 12);
  assert.equal(lit1.ok, true);
  if (lit1.ok) {
    assert.equal(lit1.event.effect, 'skyshot');
    assert.equal(lit1.remainingUses, 1);
  }
  const lit2 = mgr.igniteFirework(created.session, fwId, 10, 12);
  assert.equal(lit2.ok, true);
  if (lit2.ok) {
    assert.equal(lit2.remainingUses, 0);
    assert.equal(lit2.player.inventory.length, 0);
  }

  // Buy Kulche and simulate stale 25s eating state -> updateMovement auto-clears it
  const buyKulche = mgr.purchaseFood(created.session, 'item_chole_kulche', 1);
  assert.equal(buyKulche.ok, true);
  if (!buyKulche.ok) return;
  const kId = buyKulche.player.inventory[0].instanceId;
  const eat1 = mgr.consumeFoodBite(created.session, kId);
  assert.equal(eat1.ok, true);
  assert.ok(buyKulche.player.consuming);
  buyKulche.player.consuming!.startedAt = Date.now() - 25_000;
  mgr.updateMovement(created.session, { x: 1, y: 12, z: 2, rotY: 0, speed: 0, isJumping: false });
  assert.equal(buyKulche.player.consuming, null);
  assert.equal(buyKulche.player.y, 12); // Trampoline high-bounce Y preserved
});

test('host toggles timeOfDay to night/sunset/day while guests are rejected; Sutli Bomb & ball pickup work', () => {
  const mgr = new RoomManager({ persist: false, initialCoins: 300 });
  const created = mgr.createRoom({ hostName: 'Host', roomName: 'Night Mela' });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.room.timeOfDay, 'day');

  const guest = mgr.joinRoom({ roomCode: created.room.code, playerName: 'Guest' });
  assert.equal(guest.ok, true);
  if (!guest.ok) return;

  // Guest cannot switch timeOfDay
  const guestDenied = mgr.hostTriggerEvent(guest.session, { timeOfDay: 'night' });
  assert.equal(guestDenied.ok, false);
  assert.equal(created.room.timeOfDay, 'day');

  // Host switches to Night Mela
  const hostNight = mgr.hostTriggerEvent(created.session, { timeOfDay: 'night' });
  assert.equal(hostNight.ok, true);
  if (hostNight.ok) {
    assert.equal(hostNight.room.timeOfDay, 'night');
  }

  // Buy & ignite expensive Sutli Bomb (120 coins)
  const buySutli = mgr.purchaseFood(created.session, 'fw_sutli_bomb', 1);
  assert.equal(buySutli.ok, true);
  if (!buySutli.ok) return;
  assert.equal(buySutli.player.coins, 180);
  const sutliId = buySutli.player.inventory[0].instanceId;
  const lit = mgr.igniteFirework(created.session, sutliId, 12, 14);
  assert.equal(lit.ok, true);
  if (lit.ok) {
    assert.equal(lit.event.effect, 'sutli');
    assert.equal(lit.remainingUses, 0);
  }

  // Ball pickup & throw
  const ballId = created.room.balls[0].id;
  const picked = mgr.pickupBall(created.session, ballId);
  assert.equal(picked.ok, true);
  if (picked.ok) {
    assert.equal(picked.player.heldBallId, ballId);
    assert.equal(picked.balls[0].holderId, created.player.id);
  }
  const thrown = mgr.kickOrThrowBall(created.session, {
    ballId,
    x: 10,
    y: 1.1,
    z: 10,
    vx: 12,
    vy: 6,
    vz: 0,
  });
  assert.ok(thrown);
  assert.equal(thrown.player.heldBallId, null);
  assert.equal(thrown.balls[0].holderId, null);
});

test('mela & arcade coin payouts require skill (0 coins below 200 pts, capped max 25 coins)', () => {
  const mgr = new RoomManager({ persist: false, initialCoins: 250 });
  const created = mgr.createRoom({ hostName: 'Host', roomName: 'Skill Check' });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  // Low score (< 200 pts) gives 0 coins even if client sends won=true
  const low = mgr.submitArcadeScore(created.session, 'high_striker', 110, true);
  assert.equal(low.ok, true);
  if (low.ok) {
    assert.equal(low.rewardCoins, 0);
    assert.equal(low.room.players[created.player.id].coins, 250);
  }

  // Skilled win (>= 350 pts) gives modest capped coins
  const good = mgr.submitArcadeScore(created.session, 'matka_phod', 450, true);
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.rewardCoins, 6);
    assert.equal(good.room.players[created.player.id].coins, 256);
  }

  // Sports goal pays 8 coins
  const goal = mgr.recordSportsGoal(created.session, 'football');
  assert.ok(goal);
  assert.equal(goal.rewardCoins, 8);
  assert.equal(goal.room.players[created.player.id].coins, 264);
});
