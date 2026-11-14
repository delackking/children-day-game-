import RAPIER from '@dimforge/rapier3d-compat';
import { WORLD_RADIUS } from '../shared/catalog';
import type { BallState } from '../shared/types';

interface SimBall {
  id: string;
  kind: BallState['kind'];
  body: RAPIER.RigidBody | null;
  fallbackPos: { x: number; y: number; z: number };
  fallbackVel: { x: number; y: number; z: number };
}

export class SportsPhysicsEngine {
  private world: RAPIER.World | null = null;
  private balls = new Map<string, SimBall>();
  private initialized = false;

  async init(initialBalls: BallState[]): Promise<void> {
    if (this.initialized) return;
    try {
      await RAPIER.init();
      const world = new RAPIER.World({ x: 0, y: -18.0, z: 0 });

      // Ground collider
      const groundDesc = RAPIER.ColliderDesc.cuboid(WORLD_RADIUS, 0.5, WORLD_RADIUS)
        .setTranslation(0, -0.5, 0)
        .setRestitution(0.65)
        .setFriction(0.75);
      world.createCollider(groundDesc);

      // Football goalpost back & side frames (Pitch centered around x=36, z=6, size 22x30)
      const addStaticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => {
        const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(x, y, z)
          .setRestitution(0.6);
        world.createCollider(desc);
      };

      // North Goal at x=36, z=-9.5
      addStaticBox(36, 1.5, -10.2, 3.2, 1.5, 0.25);
      addStaticBox(32.8, 1.5, -9.5, 0.2, 1.5, 0.9);
      addStaticBox(39.2, 1.5, -9.5, 0.2, 1.5, 0.9);

      // South Goal at x=36, z=21.5
      addStaticBox(36, 1.5, 22.2, 3.2, 1.5, 0.25);
      addStaticBox(32.8, 1.5, 21.5, 0.2, 1.5, 0.9);
      addStaticBox(39.2, 1.5, 21.5, 0.2, 1.5, 0.9);

      // Basketball backboard at x=54, z=-8
      addStaticBox(54.2, 3.6, -8, 0.15, 0.9, 1.2);

      this.world = world;
      for (const b of initialBalls) {
        this.addBall(b);
      }
      this.initialized = true;
    } catch {
      // Fallback rigid-body kinematics if WASM fails
      for (const b of initialBalls) {
        this.balls.set(b.id, {
          id: b.id,
          kind: b.kind,
          body: null,
          fallbackPos: { x: b.x, y: b.y, z: b.z },
          fallbackVel: { x: b.vx, y: b.vy, z: b.vz },
        });
      }
      this.initialized = true;
    }
  }

  private addBall(b: BallState): void {
    let body: RAPIER.RigidBody | null = null;
    if (this.world) {
      const rbDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(b.x, Math.max(0.45, b.y), b.z)
        .setLinearDamping(0.55)
        .setAngularDamping(0.8);
      body = this.world.createRigidBody(rbDesc);
      const radius = b.kind === 'beachball' ? 0.5 : 0.42;
      const colDesc = RAPIER.ColliderDesc.ball(radius)
        .setRestitution(b.kind === 'basketball' ? 0.78 : b.kind === 'beachball' ? 0.85 : 0.68)
        .setFriction(0.6)
        .setDensity(b.kind === 'beachball' ? 0.4 : 1.0);
      this.world.createCollider(colDesc, body);
    }
    this.balls.set(b.id, {
      id: b.id,
      kind: b.kind,
      body,
      fallbackPos: { x: b.x, y: b.y, z: b.z },
      fallbackVel: { x: b.vx, y: b.vy, z: b.vz },
    });
  }

  applyNetworkSync(serverBalls: BallState[]): void {
    for (const sb of serverBalls) {
      const sim = this.balls.get(sb.id);
      if (!sim) continue;
      if (sim.body) {
        sim.body.setTranslation({ x: sb.x, y: Math.max(0.45, sb.y), z: sb.z }, true);
        sim.body.setLinvel({ x: sb.vx, y: sb.vy, z: sb.vz }, true);
      } else {
        sim.fallbackPos = { x: sb.x, y: sb.y, z: sb.z };
        sim.fallbackVel = { x: sb.vx, y: sb.vy, z: sb.vz };
      }
    }
  }

  kickBall(id: string, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const sim = this.balls.get(id);
    if (!sim) return;
    if (sim.body) {
      sim.body.setTranslation({ x, y: Math.max(0.45, y), z }, true);
      sim.body.setLinvel({ x: vx, y: vy, z: vz }, true);
    } else {
      sim.fallbackPos = { x, y, z };
      sim.fallbackVel = { x: vx, y: vy, z: vz };
    }
  }

  step(
    dt: number,
    serverBalls: BallState[],
    players: Record<string, { x: number; y: number; z: number; rotY: number }>,
  ): Map<string, { x: number; y: number; z: number; vx: number; vy: number; vz: number }> {
    const out = new Map<string, { x: number; y: number; z: number; vx: number; vy: number; vz: number }>();

    // Pin held balls to holder's hands before physics step
    for (const sb of serverBalls) {
      const sim = this.balls.get(sb.id);
      if (!sim) continue;
      if (sb.holderId && players[sb.holderId]) {
        const hp = players[sb.holderId];
        const hx = hp.x + Math.sin(hp.rotY) * 0.65;
        const hy = hp.y + 1.05;
        const hz = hp.z + Math.cos(hp.rotY) * 0.65;
        if (sim.body) {
          sim.body.setTranslation({ x: hx, y: hy, z: hz }, true);
          sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        out.set(sb.id, { x: hx, y: hy, z: hz, vx: 0, vy: 0, vz: 0 });
      }
    }

    if (this.world) {
      this.world.timestep = Math.min(0.033, dt);
      this.world.step();
    }

    for (const sb of serverBalls) {
      if (out.has(sb.id)) continue;
      const sim = this.balls.get(sb.id);
      if (!sim) continue;
      if (sim.body) {
        const t = sim.body.translation();
        const v = sim.body.linvel();
        // Keep balls within playground bounds
        if (Math.hypot(t.x, t.z) > WORLD_RADIUS - 4) {
          sim.body.setTranslation({ x: 36, y: 1.0, z: 6 }, true);
          sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        out.set(sb.id, { x: t.x, y: t.y, z: t.z, vx: v.x, vy: v.y, vz: v.z });
      } else {
        // Fallback gravity + bounce
        sim.fallbackVel.y -= 18 * dt;
        sim.fallbackPos.x += sim.fallbackVel.x * dt;
        sim.fallbackPos.y += sim.fallbackVel.y * dt;
        sim.fallbackPos.z += sim.fallbackVel.z * dt;
        if (sim.fallbackPos.y < 0.45) {
          sim.fallbackPos.y = 0.45;
          sim.fallbackVel.y = Math.abs(sim.fallbackVel.y) > 1.2 ? -sim.fallbackVel.y * 0.65 : 0;
          sim.fallbackVel.x *= 0.92;
          sim.fallbackVel.z *= 0.92;
        }
        out.set(sb.id, {
          x: sim.fallbackPos.x,
          y: sim.fallbackPos.y,
          z: sim.fallbackPos.z,
          vx: sim.fallbackVel.x,
          vy: sim.fallbackVel.y,
          vz: sim.fallbackVel.z,
        });
      }
    }
    return out;
  }

  dispose(): void {
    try {
      this.world?.free();
    } catch {
      // ignore
    }
    this.world = null;
    this.balls.clear();
  }
}
