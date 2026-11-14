import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalCarnivalSession } from './localCarnival';

test('LocalCarnivalSession supports full solo carnival flow without backend', () => {
  const local = new LocalCarnivalSession();
  const created = local.createRoom({
    hostName: 'Aarav',
    roomName: 'Static Host Mela',
    maxPlayers: 7,
  });
  assert.equal(created.ok, true);
  assert.equal(local.isActive(), true);
  if (!created.ok || !created.room) return;

  const startCoins = created.room.players[created.playerId].coins;
  assert.ok(startCoins >= 250);

  // Buy and ignite Sutli Bomb locally
  const buy = local.purchaseFood('fw_sutli_bomb', 1);
  assert.equal(buy.ok, true);
  if (!buy.ok || !buy.player) return;
  const fw = buy.player.inventory.find((i) => i.itemId === 'fw_sutli_bomb');
  assert.ok(fw);
  const lit = local.igniteFirework(fw.instanceId, 10, 12);
  assert.equal(lit.ok, true);

  // Submit low Mela score -> 0 coins; high score -> capped reward
  const lowScore = local.submitArcadeScore('high_striker', 110, false);
  assert.equal(lowScore.ok, true);
  if (lowScore.ok) assert.equal(lowScore.rewardCoins, 0);

  const highScore = local.submitArcadeScore('high_striker', 450, true);
  assert.equal(highScore.ok, true);
  if (highScore.ok && typeof highScore.rewardCoins === 'number') {
    assert.ok(highScore.rewardCoins > 0 && highScore.rewardCoins <= 25);
  }

  // Chat and Night mode toggle work offline
  const chat = local.sendChat('Happy Children Day!');
  assert.equal(chat.ok, true);
  const night = local.hostTriggerEvent({ timeOfDay: 'night' });
  assert.equal(night.ok, true);
});
