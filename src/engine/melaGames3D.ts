import * as THREE from 'three';
import { soundEngine } from '../audio/soundEngine';
import {
  clampMelaAim,
  computeHighStrikerScore,
  MELA_3D_BOOTHS,
  type Mela3DBoothDef,
  type Mela3DGameId,
} from '../shared/mela3d';
import type { BoxCollider2D } from './worldBuilder';
import { createSignboardTexture } from './textures';

export interface MelaGameHudSnapshot {
  gameId: Mela3DGameId;
  name: string;
  tagline: string;
  instructions: string;
  actionLabel: string;
  accent: string;
  phase: 'playing' | 'summary';
  score: number;
  attemptsLeft: number;
  maxAttempts: number;
  lastEvent: string;
  usesPowerMeter?: boolean;
  usesNumberPick?: boolean;
  powerMeter01: number;
  pickedDucks: number[];
  coinsEarned?: number;
}

interface ActiveProjectile {
  kind: 'stone' | 'ring' | 'beanbag' | 'dart';
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  settled: boolean;
  hitDone: boolean;
}

interface MatkaTarget {
  group: THREE.Group;
  ropePivot: THREE.Group;
  phase: number;
  baseZ: number;
  broken: boolean;
}

interface PegTarget {
  worldX: number;
  worldY: number;
  worldZ: number;
  points: number;
  ringed: boolean;
  bottleMat: THREE.MeshStandardMaterial;
}

interface CanTarget {
  mesh: THREE.Mesh;
  initLocalPos: THREE.Vector3;
  vx: number;
  vy: number;
  vz: number;
  rvx: number;
  rvz: number;
  knocked: boolean;
  settled: boolean;
}

interface DuckTarget {
  num: number;
  group: THREE.Group;
  angleOffset: number;
  points: number;
  picked: boolean;
  liftAnim: number;
  ringMat: THREE.MeshBasicMaterial;
}

interface BalloonTarget {
  mesh: THREE.Group;
  baseY: number;
  phase: number;
  points: number;
  popped: boolean;
}

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane();
const _hitVec = new THREE.Vector3();
const _camPosOut = new THREE.Vector3();
const _camLookOut = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function makeDuckNumberSprite(num: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FACC15';
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(0.46, 0.46, 1);
  return spr;
}

export class MelaGames3DManager {
  public readonly rootGroup = new THREE.Group();
  public readonly boothInteractPoints: Array<{ booth: Mela3DBoothDef }> = [];

  private scene: THREE.Scene;
  private activeBooth: Mela3DBoothDef | null = null;
  private phase: 'idle' | 'playing' | 'summary' = 'idle';
  private score = 0;
  private attemptsLeft = 0;
  private lastEvent = '';
  private aimX = 0;
  private aimY = 0;
  private powerMeter01 = 0;
  private strikerPuckFrac = 0;
  private strikerTargetFrac = 0;
  private strikerAnimTimer = 0;
  private malletSwingTimer = 0;
  private pendingFinishTimer = 0;
  private coinsEarned = 0;
  private hoveredDuckNum = 1;
  private pickedDucks: number[] = [];

  // Booth 3D target collections
  private matkas: MatkaTarget[] = [];
  private pegs: PegTarget[] = [];
  private cans: CanTarget[] = [];
  private canCounterGroup!: THREE.Group;
  private ducks: DuckTarget[] = [];
  private duckPoolCenter = new THREE.Vector3(-10.5, 0.65, -24.5);
  private balloons: BalloonTarget[] = [];
  private strikerPuck!: THREE.Mesh;
  private strikerMalletPivot!: THREE.Group;
  private strikerBarFill!: THREE.Mesh;
  private strikerBellMesh!: THREE.Mesh;

  // 3D Aim Reticle & Active Projectiles
  private reticleGroup: THREE.Group;
  private projectiles: ActiveProjectile[] = [];
  private settledRingMeshes: THREE.Object3D[] = [];
  private standPadRings = new Map<Mela3DGameId, THREE.MeshBasicMaterial>();
  private stoneGeo = new THREE.DodecahedronGeometry(0.14, 0);
  private stoneMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.7 });
  private ringGeo = new THREE.TorusGeometry(0.24, 0.042, 8, 18);
  private beanbagGeo = new THREE.SphereGeometry(0.18, 12, 10);
  private beanbagMat = new THREE.MeshStandardMaterial({ color: '#EC4899', roughness: 0.75 });
  private dartShaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8);
  private dartShaftMat = new THREE.MeshStandardMaterial({ color: '#FACC15', metalness: 0.6, roughness: 0.3 });
  private dartTipGeo = new THREE.ConeGeometry(0.04, 0.1, 8);
  private dartTipMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', metalness: 0.8 });
  private ringMats = [0xfacc15, 0xec4899, 0x10b981, 0x38bdf8].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }),
  );

  private onHudChange: (snap: MelaGameHudSnapshot | null) => void;
  private onCompleteGame: (gameId: Mela3DGameId, score: number) => Promise<number>;
  private onParticles: (x: number, y: number, z: number, count: number, colorHex: number) => void;
  private lastHudMeterPush = 0;

  constructor(
    scene: THREE.Scene,
    maxAnisotropy: number,
    colliders: BoxCollider2D[],
    cameraOccluders: THREE.Object3D[],
    callbacks: {
      onHudChange: (snap: MelaGameHudSnapshot | null) => void;
      onCompleteGame: (gameId: Mela3DGameId, score: number) => Promise<number>;
      onParticles: (x: number, y: number, z: number, count: number, colorHex: number) => void;
    },
  ) {
    this.scene = scene;
    this.onHudChange = callbacks.onHudChange;
    this.onCompleteGame = callbacks.onCompleteGame;
    this.onParticles = callbacks.onParticles;

    this.reticleGroup = new THREE.Group();
    const outerReticle = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.25, 24),
      new THREE.MeshBasicMaterial({ color: '#FACC15', side: THREE.DoubleSide, depthTest: false }),
    );
    const innerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 14),
      new THREE.MeshBasicMaterial({ color: '#EF4444', side: THREE.DoubleSide, depthTest: false }),
    );
    this.reticleGroup.add(outerReticle, innerDot);
    this.reticleGroup.visible = false;
    this.reticleGroup.renderOrder = 10;
    this.scene.add(this.reticleGroup);

    this.buildFairground(maxAnisotropy, colliders, cameraOccluders);
    this.scene.add(this.rootGroup);
  }

  private buildFairground(
    maxAnisotropy: number,
    colliders: BoxCollider2D[],
    cameraOccluders: THREE.Object3D[],
  ): void {
    const addCollider = (cx: number, cz: number, hx: number, hz: number) => {
      colliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
    };

    const goldMat = new THREE.MeshStandardMaterial({ color: '#FACC15', metalness: 0.75, roughness: 0.25 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.75 });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#FFFBEB', roughness: 0.65 });

    // 1. Fairground Promenade Floor & Connecting Path from Central Plaza
    const floorMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85 });
    const plazaFloor = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.05, 17.5), floorMat);
    plazaFloor.position.set(-15.5, 0.025, -24.2);
    plazaFloor.receiveShadow = true;
    this.rootGroup.add(plazaFloor);

    const pathStrip = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.04, 11.5), floorMat);
    pathStrip.position.set(-15.5, 0.022, -13.0);
    pathStrip.receiveShadow = true;
    this.rootGroup.add(pathStrip);

    // 2. Fairground Entrance Archway at (-15.5, 0, -13.8) with tall 5.2m clearance
    const archGroup = new THREE.Group();
    archGroup.position.set(-15.5, 0, -13.8);
    const archPillarMat = new THREE.MeshStandardMaterial({ color: '#EC4899', roughness: 0.5 });
    for (const sx of [-3.6, 3.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 5.2, 10), archPillarMat);
      p.position.set(sx, 2.6, 0);
      p.castShadow = true;
      archGroup.add(p);
      addCollider(-15.5 + sx, -13.8, 0.45, 0.45);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), goldMat);
      cap.position.set(sx, 5.35, 0);
      archGroup.add(cap);
    }
    const archSignTex = createSignboardTexture(
      'MELA GAMES FAIRGROUND',
      '6 LIVE 3D BOOTHS · WALK UP & PRESS E!',
      '#DB2777',
      '#F59E0B',
      maxAnisotropy,
    );
    const archBanner = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 1.3, 0.28),
      new THREE.MeshStandardMaterial({ map: archSignTex, color: 0xffffff, roughness: 0.35 }),
    );
    archBanner.position.set(0, 5.2, 0);
    archGroup.add(archBanner);
    this.rootGroup.add(archGroup);

    // Overhead Fairground Fairy Light Bulbs (InstancedMesh)
    const bulbGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bulbPalette = [0xfacc15, 0xec4899, 0x38bdf8, 0x22c55e, 0xf97316];
    const fairyZRows = [-19.5, -24.5, -29.5];
    const bulbsPerRow = 12;
    const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, fairyZRows.length * bulbsPerRow);
    const bDummy = new THREE.Object3D();
    const bCol = new THREE.Color();
    let bIdx = 0;
    for (const zRow of fairyZRows) {
      for (let i = 0; i < bulbsPerRow; i++) {
        const t = i / (bulbsPerRow - 1);
        const bx = THREE.MathUtils.lerp(-19.5, -11.5, t);
        const by = 4.35 - Math.sin(t * Math.PI) * 0.6;
        bDummy.position.set(bx, by, zRow);
        bDummy.updateMatrix();
        bulbInst.setMatrixAt(bIdx, bDummy.matrix);
        bCol.setHex(bulbPalette[bIdx % bulbPalette.length]);
        bulbInst.setColorAt(bIdx, bCol);
        bIdx++;
      }
    }
    bulbInst.computeBoundingSphere();
    this.rootGroup.add(bulbInst);

    // 3. Build all 6 Live 3D Mela Game Booths
    for (const booth of MELA_3D_BOOTHS) {
      this.boothInteractPoints.push({ booth });

      // Glowing ground standing pad
      const padMat = new THREE.MeshBasicMaterial({ color: booth.accent, side: THREE.DoubleSide });
      const padRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 24), padMat);
      padRing.rotation.x = -Math.PI / 2;
      padRing.position.set(booth.standX, 0.06, booth.standZ);
      this.rootGroup.add(padRing);
      this.standPadRings.set(booth.id, padMat);

      const g = new THREE.Group();
      g.position.set(booth.boothX, 0, booth.boothZ);
      // Local +Z faces into the Fairground corridor toward the player!
      g.rotation.y = booth.facingX === -1 ? Math.PI / 2 : -Math.PI / 2;
      this.rootGroup.add(g);
      addCollider(booth.boothX, booth.boothZ, 1.35, 1.75);

      const accentMat = new THREE.MeshStandardMaterial({ color: booth.accent, roughness: 0.5 });

      // Shared booth header sign
      const signTex = createSignboardTexture(
        booth.name.toUpperCase(),
        'PRESS E TO PLAY IN 3D!',
        booth.accent,
        '#0F172A',
        maxAnisotropy,
      );
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.85, 0.16),
        new THREE.MeshStandardMaterial({ map: signTex, color: 0xffffff, roughness: 0.35 }),
      );

      if (booth.id === 'matka_phod') {
        // Bamboo/Crimson gantry frame + 3 swinging terracotta clay pots
        for (const px of [-1.45, 1.45]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.6, 10), accentMat);
          post.position.set(px, 1.8, 0);
          post.castShadow = true;
          g.add(post);
          cameraOccluders.push(post);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.22, 0.26), darkWoodMat);
        beam.position.set(0, 3.55, 0);
        g.add(beam);
        signMesh.position.set(0, 4.15, 0.08);
        g.add(signMesh);

        const clayMat = new THREE.MeshStandardMaterial({ color: '#C2410C', roughness: 0.7 });
        const ropeMat = new THREE.MeshStandardMaterial({ color: '#FDE68A', roughness: 0.9 });
        this.matkas = [];
        const xs = [-0.95, 0, 0.95];
        xs.forEach((lx, idx) => {
          const pivot = new THREE.Group();
          pivot.position.set(lx, 3.45, 0);
          g.add(pivot);

          const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.25, 6), ropeMat);
          rope.position.y = -0.62;
          pivot.add(rope);

          const pot = new THREE.Group();
          pot.position.set(0, -1.35, 0);
          const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), clayMat);
          body.scale.set(1.05, 0.92, 1.05);
          body.castShadow = true;
          const neck = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 14), creamMat);
          neck.rotation.x = Math.PI / 2;
          neck.position.y = 0.26;
          const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16), goldMat);
          band.rotation.x = Math.PI / 2;
          pot.add(body, neck, band);
          pivot.add(pot);

          this.matkas.push({
            group: pot,
            ropePivot: pivot,
            phase: idx * 2.1,
            baseZ: booth.boothZ + (booth.facingX === -1 ? -lx : lx),
            broken: false,
          });
        });
      } else if (booth.id === 'ring_toss') {
        // Striped counter + 3x3 prize bottles
        const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.85, 1.9), accentMat);
        base.position.set(0, 0.425, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);
        cameraOccluders.push(base);

        const deck = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.1, 2.05), creamMat);
        deck.position.set(0, 0.88, 0);
        g.add(deck);

        for (const px of [-1.5, 1.5]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), darkWoodMat);
          post.position.set(px, 2.2, -0.75);
          g.add(post);
        }
        signMesh.position.set(0, 3.6, -0.75);
        g.add(signMesh);

        this.pegs = [];
        const bottleColors = ['#EF4444', '#10B981', '#06B6D4', '#8B5CF6', '#FACC15'];
        let bCount = 0;
        for (let row = -1; row <= 1; row++) {
          for (let col = -1; col <= 1; col++) {
            const isCenter = row === 0 && col === 0;
            const bMat = new THREE.MeshStandardMaterial({
              color: isCenter ? '#FACC15' : bottleColors[bCount % 4],
              roughness: 0.25,
              metalness: isCenter ? 0.65 : 0.15,
            });
            const lx = col * 0.82;
            const lz = row * 0.56;
            const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.45, 10), bMat);
            bottle.position.set(lx, 1.15, lz);
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.24, 10), bMat);
            neck.position.set(lx, 1.48, lz);
            g.add(bottle, neck);

            const wp = new THREE.Vector3(lx, 1.56, lz).applyAxisAngle(_up, g.rotation.y);
            this.pegs.push({
              worldX: booth.boothX + wp.x,
              worldY: 1.56,
              worldZ: booth.boothZ + wp.z,
              points: isCenter ? 250 : Math.abs(row) + Math.abs(col) === 1 ? 150 : 100,
              ringed: false,
              bottleMat: bMat,
            });
            bCount++;
          }
        }
      } else if (booth.id === 'can_knockdown') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.95, 1.6), accentMat);
        base.position.set(0, 0.475, 0);
        base.castShadow = true;
        g.add(base);
        cameraOccluders.push(base);

        const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.1, 1.75), creamMat);
        top.position.set(0, 1.0, 0);
        g.add(top);

        const backWall = new THREE.Mesh(
          new THREE.BoxGeometry(3.3, 2.2, 0.18),
          new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.7 }),
        );
        backWall.position.set(0, 2.1, -0.78);
        g.add(backWall);

        signMesh.position.set(0, 3.5, -0.7);
        g.add(signMesh);

        this.canCounterGroup = g;
        this.cans = [];
        const canGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.36, 12);
        const canCols = ['#EF4444', '#FACC15', '#06B6D4', '#10B981', '#EC4899', '#F97316'];
        // 3 + 2 + 1 Pyramid
        const coords: Array<[number, number]> = [
          [-0.4, 1.23],
          [0, 1.23],
          [0.4, 1.23],
          [-0.2, 1.59],
          [0.2, 1.59],
          [0, 1.95],
        ];
        coords.forEach(([cx, cy], idx) => {
          const can = new THREE.Mesh(
            canGeo,
            new THREE.MeshStandardMaterial({ color: canCols[idx % canCols.length], metalness: 0.45, roughness: 0.35 }),
          );
          can.position.set(cx, cy, 0.05);
          can.castShadow = true;
          g.add(can);
          this.cans.push({
            mesh: can,
            initLocalPos: new THREE.Vector3(cx, cy, 0.05),
            vx: 0,
            vy: 0,
            vz: 0,
            rvx: 0,
            rvz: 0,
            knocked: false,
            settled: false,
          });
        });
      } else if (booth.id === 'high_striker') {
        // Tall 5.4m High Striker Tower + Anvil + Mallet + Brass Puck + Top Bell
        const basePad = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 1.8), darkWoodMat);
        basePad.position.set(0, 0.18, 0.35);
        g.add(basePad);

        const anvil = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.25, 14), accentMat);
        anvil.position.set(0, 0.45, 0.55);
        g.add(anvil);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.85, 5.2, 0.36), accentMat);
        tower.position.set(0, 2.6, -0.35);
        tower.castShadow = true;
        g.add(tower);
        cameraOccluders.push(tower);

        const trackRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 4.5, 0.08),
          new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.4 }),
        );
        trackRail.position.set(0, 2.75, -0.14);
        g.add(trackRail);

        // Glowing progress bar along the right side of the tower
        this.strikerBarFill = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 4.3, 0.08),
          new THREE.MeshBasicMaterial({ color: '#22C55E' }),
        );
        this.strikerBarFill.position.set(0.3, 2.75, -0.14);
        g.add(this.strikerBarFill);

        this.strikerPuck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), goldMat);
        this.strikerPuck.rotation.x = Math.PI / 2;
        this.strikerPuck.position.set(0, 0.7, -0.06);
        g.add(this.strikerPuck);

        this.strikerBellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), goldMat);
        this.strikerBellMesh.position.set(0, 5.35, -0.2);
        g.add(this.strikerBellMesh);

        // Big Wooden Mallet Pivoting near anvil
        this.strikerMalletPivot = new THREE.Group();
        this.strikerMalletPivot.position.set(0.55, 0.65, 0.55);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 8), darkWoodMat);
        handle.position.set(-0.25, 0.5, 0);
        handle.rotation.z = 0.5;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 12), darkWoodMat);
        head.rotation.x = Math.PI / 2;
        head.position.set(-0.5, 0.95, 0);
        this.strikerMalletPivot.add(handle, head);
        this.strikerMalletPivot.rotation.z = -0.35;
        g.add(this.strikerMalletPivot);

        signMesh.position.set(0, 6.15, -0.35);
        g.add(signMesh);
      } else if (booth.id === 'duck_pond') {
        // Raised turquoise water pond with 6 numbered yellow rubber ducks swimming in a circle
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.82, 0.68, 24), accentMat);
        rim.position.set(0, 0.34, 0);
        rim.castShadow = true;
        g.add(rim);
        cameraOccluders.push(rim);

        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(1.52, 1.52, 0.14, 24),
          new THREE.MeshStandardMaterial({ color: '#06B6D4', roughness: 0.15, metalness: 0.2 }),
        );
        water.position.set(0, 0.65, 0);
        g.add(water);

        for (const px of [-1.45, 1.45]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.7, 8), darkWoodMat);
          post.position.set(px, 1.35, -1.35);
          g.add(post);
        }
        signMesh.position.set(0, 2.95, -1.35);
        g.add(signMesh);

        this.duckPoolCenter.set(booth.boothX, 0.68, booth.boothZ);
        this.ducks = [];
        const duckMat = new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.35 });
        const beakMat = new THREE.MeshStandardMaterial({ color: '#F97316', roughness: 0.45 });
        const duckVals = [100, 150, 250, 100, 200, 120];
        for (let i = 0; i < 6; i++) {
          const dg = new THREE.Group();
          dg.userData.duckNum = i + 1;
          const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), duckMat);
          body.scale.set(1.25, 0.85, 0.95);
          body.userData.duckNum = i + 1;
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), duckMat);
          head.position.set(0.16, 0.18, 0);
          head.userData.duckNum = i + 1;
          const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 8), beakMat);
          beak.rotation.z = -Math.PI / 2;
          beak.position.set(0.3, 0.17, 0);
          beak.userData.duckNum = i + 1;
          const selMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide });
          const selRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.3, 16), selMat);
          selRing.rotation.x = -Math.PI / 2;
          selRing.position.y = 0.03;
          const numSpr = makeDuckNumberSprite(i + 1);
          numSpr.position.set(0, 0.56, 0);
          dg.add(body, head, beak, selRing, numSpr);
          this.scene.add(dg);

          this.ducks.push({
            num: i + 1,
            group: dg,
            angleOffset: (i / 6) * Math.PI * 2,
            points: duckVals[i],
            picked: false,
            liftAnim: 0,
            ringMat: selMat,
          });
        }
      } else if (booth.id === 'balloon_pop') {
        const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), accentMat);
        counter.position.set(0, 0.45, 0.35);
        g.add(counter);

        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 2.4, 0.22),
          new THREE.MeshStandardMaterial({ color: '#1E1B4B', roughness: 0.7 }),
        );
        wall.position.set(0, 2.05, -0.55);
        wall.castShadow = true;
        g.add(wall);
        cameraOccluders.push(wall);

        signMesh.position.set(0, 3.7, -0.55);
        g.add(signMesh);

        this.balloons = [];
        const bCols = ['#EF4444', '#FACC15', '#06B6D4', '#22C55E', '#EC4899', '#A855F7', '#F97316', '#38BDF8', '#FACC15'];
        let idx = 0;
        for (let row = 0; row < 3; row++) {
          for (let col = -1; col <= 1; col++) {
            const bg = new THREE.Group();
            const isGold = row === 1 && col === 0;
            const bMesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.26, 12, 10),
              new THREE.MeshStandardMaterial({
                color: isGold ? '#FACC15' : bCols[idx % bCols.length],
                roughness: 0.25,
                metalness: isGold ? 0.45 : 0.1,
              }),
            );
            bMesh.scale.set(1, 1.2, 1);
            const knot = new THREE.Mesh(
              new THREE.ConeGeometry(0.06, 0.08, 6),
              new THREE.MeshStandardMaterial({ color: bCols[idx % bCols.length] }),
            );
            knot.position.y = -0.32;
            bg.add(bMesh, knot);
            const baseY = 1.35 + row * 0.65;
            bg.position.set(col * 0.88, baseY, -0.3);
            g.add(bg);
            this.balloons.push({
              mesh: bg,
              baseY,
              phase: idx * 0.9,
              points: isGold ? 200 : 100,
              popped: false,
            });
            idx++;
          }
        }
      }
    }
  }

  public isActive(): boolean {
    return this.activeBooth !== null;
  }

  public getActiveBooth(): Mela3DBoothDef | null {
    return this.activeBooth;
  }

  public startGame(gameId: Mela3DGameId): boolean {
    const booth = MELA_3D_BOOTHS.find((b) => b.id === gameId);
    if (!booth) return false;

    this.clearActiveProjectiles();
    this.activeBooth = booth;
    this.phase = 'playing';
    this.score = 0;
    this.attemptsLeft = booth.maxAttempts;
    this.aimX = 0;
    this.aimY = 0;
    this.powerMeter01 = 0.5;
    this.strikerPuckFrac = 0;
    this.strikerTargetFrac = 0;
    this.strikerAnimTimer = 0;
    this.malletSwingTimer = 0;
    this.pendingFinishTimer = 0;
    this.coinsEarned = 0;
    this.hoveredDuckNum = 1;
    this.pickedDucks = [];
    this.lastEvent = booth.instructions;

    this.resetBoothTargets(gameId);
    this.reticleGroup.visible = !booth.usesPowerMeter && !booth.usesNumberPick;
    this.updateReticleTransform(0);
    this.emitHud();
    return true;
  }

  private resetBoothTargets(gameId: Mela3DGameId): void {
    if (gameId === 'matka_phod') {
      for (const m of this.matkas) {
        m.broken = false;
        m.group.visible = true;
      }
    } else if (gameId === 'ring_toss') {
      for (const p of this.pegs) {
        p.ringed = false;
      }
    } else if (gameId === 'can_knockdown') {
      for (const c of this.cans) {
        c.knocked = false;
        c.settled = false;
        c.vx = 0;
        c.vy = 0;
        c.vz = 0;
        c.rvx = 0;
        c.rvz = 0;
        c.mesh.position.copy(c.initLocalPos);
        c.mesh.rotation.set(0, 0, 0);
      }
    } else if (gameId === 'high_striker') {
      this.strikerPuck.position.y = 0.7;
      this.strikerMalletPivot.rotation.z = -0.35;
    } else if (gameId === 'duck_pond') {
      const prizes = [0, 50, 0, 120, 220, 75].sort(() => Math.random() - 0.5);
      this.ducks.forEach((d, idx) => {
        d.picked = false;
        d.liftAnim = 0;
        d.points = prizes[idx];
      });
    } else if (gameId === 'balloon_pop') {
      for (const b of this.balloons) {
        b.popped = false;
        b.mesh.visible = true;
      }
    }
  }

  public exitGame(): void {
    this.clearActiveProjectiles();
    this.activeBooth = null;
    this.phase = 'idle';
    this.reticleGroup.visible = false;
    this.onHudChange(null);
  }

  private clearActiveProjectiles(): void {
    for (const pr of this.projectiles) {
      this.scene.remove(pr.mesh);
    }
    this.projectiles = [];
    for (const sm of this.settledRingMeshes) {
      this.scene.remove(sm);
    }
    this.settledRingMeshes = [];
  }

  public getCameraFraming(): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
    const b = this.activeBooth;
    if (!b) return null;
    if (b.id === 'high_striker') {
      _camPosOut.set(b.standX - b.facingX * 1.4, 2.35, b.standZ + b.facingX * 0.45);
      _camLookOut.set(b.boothX, 2.65, b.boothZ);
    } else if (b.id === 'duck_pond') {
      _camPosOut.set(b.standX + b.facingX * 0.1, 2.4, b.standZ);
      _camLookOut.set(b.boothX, 0.72, b.boothZ);
    } else {
      _camPosOut.set(b.standX + b.facingX * 0.2, 1.85, b.standZ);
      _camLookOut.set(b.boothX, b.id === 'can_knockdown' ? 1.55 : 1.9, b.boothZ);
    }
    return { pos: _camPosOut, look: _camLookOut };
  }

  public onAimDelta(dxNorm: number, dyNorm: number): void {
    if (!this.activeBooth || this.phase !== 'playing') return;
    this.aimX = clampMelaAim(this.aimX + dxNorm);
    this.aimY = clampMelaAim(this.aimY + dyNorm);
  }

  public onPointerMove(clientX: number, clientY: number, camera: THREE.Camera, rect: DOMRect): void {
    if (!this.activeBooth || this.phase !== 'playing') return;
    _ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    _ray.setFromCamera(_ndc, camera);

    const b = this.activeBooth;
    if (b.id === 'duck_pond') {
      const duckGroups = this.ducks.filter((d) => !d.picked).map((d) => d.group);
      const hits = _ray.intersectObjects(duckGroups, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj.userData.duckNum === undefined) obj = obj.parent;
        if (obj?.userData.duckNum) {
          this.hoveredDuckNum = obj.userData.duckNum;
        }
      }
      return;
    }

    _forward.set(b.facingX, 0, 0);
    _right.crossVectors(_forward, _up);

    if (b.id === 'ring_toss') {
      // Intersect horizontal table plane at y = 1.48
      _plane.set(_up, -1.48);
      if (_ray.ray.intersectPlane(_plane, _hitVec)) {
        const dx = _hitVec.x - b.boothX;
        const dz = _hitVec.z - b.boothZ;
        const horiz = dx * _right.x + dz * _right.z;
        const depth = dx * _forward.x + dz * _forward.z;
        this.aimX = clampMelaAim(horiz / 1.1);
        this.aimY = clampMelaAim(-depth / 0.8);
      }
    } else {
      // Intersect vertical target plane at x = b.boothX
      _plane.set(new THREE.Vector3(-b.facingX, 0, 0), b.facingX * b.boothX);
      if (_ray.ray.intersectPlane(_plane, _hitVec)) {
        const dz = _hitVec.z - b.boothZ;
        const horiz = dz * _right.z;
        const centerY = b.id === 'can_knockdown' ? 1.55 : b.id === 'matka_phod' ? 2.1 : 2.0;
        const spanY = b.id === 'can_knockdown' ? 0.8 : 0.95;
        this.aimX = clampMelaAim(horiz / 1.35);
        this.aimY = clampMelaAim((_hitVec.y - centerY) / spanY);
      }
    }
  }

  public onPrimaryAction(clientX?: number, clientY?: number, camera?: THREE.Camera, rect?: DOMRect): void {
    if (!this.activeBooth || this.phase !== 'playing') return;
    if (this.attemptsLeft <= 0) return;

    if (clientX !== undefined && clientY !== undefined && camera && rect) {
      this.onPointerMove(clientX, clientY, camera, rect);
    }

    const b = this.activeBooth;
    if (b.id === 'duck_pond') {
      this.pickDuck(this.hoveredDuckNum);
      return;
    }

    if (b.id === 'high_striker') {
      if (this.strikerAnimTimer > 0.15) return;
      this.attemptsLeft--;
      const res = computeHighStrikerScore(this.powerMeter01);
      this.score += res.score;
      this.strikerTargetFrac = res.heightFraction;
      this.strikerPuckFrac = 0.05;
      this.strikerAnimTimer = 0.95;
      this.malletSwingTimer = 0.4;
      this.lastEvent = `${res.tier} (+${res.score} pts)`;
      soundEngine.playKick();
      if (res.isBell) {
        window.setTimeout(() => {
          soundEngine.playBellRing();
          this.onParticles(b.boothX, 5.4, b.boothZ, 26, 0xfacc15);
        }, 280);
      }
      if (this.attemptsLeft <= 0) {
        this.pendingFinishTimer = 1.05;
      }
      this.emitHud();
      return;
    }

    // Projectile booths: matka_phod, ring_toss, can_knockdown, balloon_pop
    this.attemptsLeft--;
    const target = this.getReticleWorldTarget();
    const startX = b.standX + b.facingX * 0.45;
    const startY = 1.42;
    const startZ = b.standZ;

    const flightTime = b.id === 'balloon_pop' ? 0.34 : b.id === 'ring_toss' ? 0.58 : 0.45;
    const g = b.id === 'balloon_pop' ? 4.5 : 11.5;
    const windX = b.id === 'ring_toss' ? (Math.random() - 0.5) * 0.22 : 0;
    const windZ = b.id === 'ring_toss' ? (Math.random() - 0.5) * 0.22 : 0;
    const vx = (target.x + windX - startX) / flightTime;
    const vz = (target.z + windZ - startZ) / flightTime;
    const vy = (target.y - startY + 0.5 * g * flightTime * flightTime) / flightTime;

    let mesh: THREE.Object3D;
    let kind: ActiveProjectile['kind'];
    if (b.id === 'matka_phod') {
      kind = 'stone';
      mesh = new THREE.Mesh(this.stoneGeo, this.stoneMat);
      soundEngine.playClick();
    } else if (b.id === 'ring_toss') {
      kind = 'ring';
      mesh = new THREE.Mesh(this.ringGeo, this.ringMats[this.attemptsLeft % this.ringMats.length]);
      mesh.rotation.x = Math.PI / 2;
      soundEngine.playClick();
    } else if (b.id === 'can_knockdown') {
      kind = 'beanbag';
      mesh = new THREE.Mesh(this.beanbagGeo, this.beanbagMat);
      soundEngine.playKick();
    } else {
      kind = 'dart';
      const dg = new THREE.Group();
      const shaft = new THREE.Mesh(this.dartShaftGeo, this.dartShaftMat);
      shaft.rotation.z = b.facingX * (Math.PI / 2);
      const tip = new THREE.Mesh(this.dartTipGeo, this.dartTipMat);
      tip.rotation.z = -b.facingX * (Math.PI / 2);
      tip.position.x = b.facingX * 0.2;
      dg.add(shaft, tip);
      mesh = dg;
      soundEngine.playClick();
    }

    mesh.position.set(startX, startY, startZ);
    this.scene.add(mesh);
    this.projectiles.push({
      kind,
      mesh,
      x: startX,
      y: startY,
      z: startZ,
      vx,
      vy,
      vz,
      age: 0,
      maxAge: flightTime + 0.65,
      settled: false,
      hitDone: false,
    });

    this.lastEvent = `${b.actionLabel} thrown!`;
    this.emitHud();
  }

  public pickDuck(duckNum: number): void {
    if (!this.activeBooth || this.activeBooth.id !== 'duck_pond' || this.phase !== 'playing') return;
    if (this.attemptsLeft <= 0) return;

    let duck = this.ducks.find((d) => d.num === duckNum && !d.picked);
    if (!duck) {
      duck = this.ducks.find((d) => !d.picked);
    }
    if (!duck) return;

    duck.picked = true;
    duck.liftAnim = 1.0;
    this.attemptsLeft--;
    this.pickedDucks = [...this.pickedDucks, duck.num];
    this.score += duck.points;
    soundEngine.playSplash();
    if (duck.points > 0) {
      window.setTimeout(() => soundEngine.playCoin(), 140);
      this.onParticles(duck.group.position.x, duck.group.position.y + 0.35, duck.group.position.z, 14, 0xfacc15);
      this.lastEvent = `Duck #${duck.num} revealed +${duck.points} pts!`;
    } else {
      this.lastEvent = `Duck #${duck.num} was empty! 0 pts!`;
    }

    if (this.attemptsLeft <= 0) {
      this.pendingFinishTimer = 0.85;
    }
    this.emitHud();
  }

  private getReticleWorldTarget(): THREE.Vector3 {
    const b = this.activeBooth!;
    _forward.set(b.facingX, 0, 0);
    _right.crossVectors(_forward, _up);
    if (b.id === 'ring_toss') {
      return new THREE.Vector3(
        b.boothX + _right.x * (this.aimX * 1.1) - _forward.x * (this.aimY * 0.72),
        1.55,
        b.boothZ + _right.z * (this.aimX * 1.1) - _forward.z * (this.aimY * 0.72),
      );
    }
    const centerY = b.id === 'can_knockdown' ? 1.55 : b.id === 'matka_phod' ? 2.1 : 2.0;
    const spanY = b.id === 'can_knockdown' ? 0.72 : 0.92;
    return new THREE.Vector3(
      b.boothX,
      centerY + this.aimY * spanY,
      b.boothZ + _right.z * (this.aimX * 1.28),
    );
  }

  private updateReticleTransform(elapsed: number): void {
    if (!this.activeBooth || !this.reticleGroup.visible) return;
    const b = this.activeBooth;
    const target = this.getReticleWorldTarget();
    if (b.id === 'ring_toss') {
      this.reticleGroup.position.set(target.x, 1.62, target.z);
      this.reticleGroup.rotation.set(-Math.PI / 2, 0, elapsed * 2);
    } else {
      this.reticleGroup.position.set(b.boothX - b.facingX * 0.42, target.y, target.z);
      this.reticleGroup.rotation.set(0, b.facingX === -1 ? Math.PI / 2 : -Math.PI / 2, elapsed * 2);
    }
  }

  public update(dt: number, elapsed: number): void {
    // 1. Always animate idle world Mela props cleanly (fast-swinging matkas, swimming ducks, swaying balloons)
    for (const m of this.matkas) {
      if (!m.broken) {
        m.ropePivot.rotation.x = Math.sin(elapsed * 3.5 + m.phase) * 0.3;
      }
    }
    for (const d of this.ducks) {
      const ang = elapsed * 1.45 + d.angleOffset;
      const r = 0.96;
      const dx = this.duckPoolCenter.x + Math.cos(ang) * r;
      const dz = this.duckPoolCenter.z + Math.sin(ang) * r;
      if (d.liftAnim > 0) {
        d.liftAnim = Math.max(0, d.liftAnim - dt * 1.3);
      }
      const liftY = d.picked ? 0.35 + Math.sin(d.liftAnim * Math.PI) * 0.45 : Math.sin(elapsed * 3.5 + d.angleOffset) * 0.03;
      d.group.position.set(dx, this.duckPoolCenter.y + liftY, dz);
      d.group.rotation.y = -ang + Math.PI / 2;
      const isHovered = this.activeBooth?.id === 'duck_pond' && this.hoveredDuckNum === d.num && !d.picked;
      d.ringMat.color.setHex(d.picked ? 0x22c55e : isHovered ? 0xfacc15 : 0xffffff);
      d.ringMat.opacity = d.picked ? 0.55 : isHovered ? 1 : 0.45;
    }
    for (const b of this.balloons) {
      if (!b.popped) {
        b.mesh.position.y = b.baseY + Math.sin(elapsed * 4.4 + b.phase) * 0.11;
        b.mesh.rotation.z = Math.sin(elapsed * 3.2 + b.phase) * 0.14;
      }
    }

    // Update knocked tumbling tin cans
    for (const c of this.cans) {
      if (c.knocked && !c.settled) {
        c.vy -= 14 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z += c.vz * dt;
        c.mesh.rotation.x += c.rvx * dt;
        c.mesh.rotation.z += c.rvz * dt;
        if (c.mesh.position.y <= 0.18) {
          c.mesh.position.y = 0.18;
          c.settled = true;
        }
      }
    }

    if (!this.activeBooth || this.phase !== 'playing') return;

    // 2. Blazing High Striker Meter & Puck/Mallet Animation
    if (this.activeBooth.id === 'high_striker') {
      if (this.strikerAnimTimer <= 0) {
        this.powerMeter01 = 0.5 + 0.5 * Math.sin(elapsed * 8.0);
        this.strikerBarFill.scale.y = Math.max(0.06, this.powerMeter01);
        this.strikerBarFill.position.y = 0.6 + this.powerMeter01 * 2.15;
        (this.strikerBarFill.material as THREE.MeshBasicMaterial).color.setHex(
          this.powerMeter01 >= 0.93 ? 0xfacc15 : this.powerMeter01 >= 0.62 ? 0x22c55e : 0x38bdf8,
        );
        if (elapsed - this.lastHudMeterPush > 0.08) {
          this.lastHudMeterPush = elapsed;
          this.emitHud();
        }
      } else {
        this.strikerAnimTimer = Math.max(0, this.strikerAnimTimer - dt);
        this.strikerPuckFrac = THREE.MathUtils.lerp(this.strikerPuckFrac, this.strikerTargetFrac, Math.min(1, dt * 10));
        this.strikerPuck.position.y = 0.7 + this.strikerPuckFrac * 4.4;
      }
      if (this.malletSwingTimer > 0) {
        this.malletSwingTimer = Math.max(0, this.malletSwingTimer - dt);
        const t = 1 - this.malletSwingTimer / 0.4;
        this.strikerMalletPivot.rotation.z = t < 0.4 ? THREE.MathUtils.lerp(-0.35, 1.25, t / 0.4) : THREE.MathUtils.lerp(1.25, -0.35, (t - 0.4) / 0.6);
      }
    }

    this.updateReticleTransform(elapsed);

    // 3. Step 3D Projectiles & Tightened Hit Detection
    const b = this.activeBooth;
    const g = b.id === 'balloon_pop' ? 4.5 : 11.5;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.age += dt;
      if (!pr.settled) {
        pr.vy -= g * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.z += pr.vz * dt;
        pr.mesh.position.set(pr.x, pr.y, pr.z);
        if (pr.kind === 'ring') {
          pr.mesh.rotation.z += dt * 9;
        } else if (pr.kind === 'stone' || pr.kind === 'beanbag') {
          pr.mesh.rotation.x += dt * 7;
        }

        // Tighter hit checks by booth
        if (!pr.hitDone && b.id === 'matka_phod') {
          for (const m of this.matkas) {
            if (m.broken) continue;
            m.group.getWorldPosition(_hitVec);
            if (_hitVec.distanceTo(pr.mesh.position) < 0.43) {
              m.broken = true;
              m.group.visible = false;
              pr.hitDone = true;
              pr.settled = true;
              this.score += 200;
              soundEngine.playPotBreak();
              this.onParticles(_hitVec.x, _hitVec.y, _hitVec.z, 20, 0xf97316);
              const allBroken = this.matkas.every((x) => x.broken);
              if (allBroken) {
                this.score += 150;
                this.lastEvent = 'ALL 3 MATKAS SMASHED! +350 pts Bonus!';
                this.pendingFinishTimer = 0.7;
              } else {
                this.lastEvent = 'SMASH! Clay Matka cracked! +200 pts';
              }
              this.emitHud();
              break;
            }
          }
        } else if (!pr.hitDone && b.id === 'balloon_pop') {
          for (const bl of this.balloons) {
            if (bl.popped) continue;
            bl.mesh.getWorldPosition(_hitVec);
            if (_hitVec.distanceTo(pr.mesh.position) < 0.34) {
              bl.popped = true;
              bl.mesh.visible = false;
              pr.hitDone = true;
              pr.settled = true;
              this.score += bl.points;
              soundEngine.playPop();
              this.onParticles(_hitVec.x, _hitVec.y, _hitVec.z, 16, 0xec4899);
              this.lastEvent = `POP! +${bl.points} pts!`;
              if (this.balloons.every((x) => x.popped)) {
                this.score += 150;
                this.lastEvent = 'ALL BALLOONS POPPED! +150 Bonus!';
                this.pendingFinishTimer = 0.65;
              }
              this.emitHud();
              break;
            }
          }
        } else if (!pr.hitDone && b.id === 'can_knockdown') {
          let knockedNow = 0;
          for (const c of this.cans) {
            if (c.knocked) continue;
            c.mesh.getWorldPosition(_hitVec);
            if (_hitVec.distanceTo(pr.mesh.position) < 0.44) {
              c.knocked = true;
              knockedNow++;
              c.vx = (Math.random() - 0.5) * 5.0;
              c.vy = 2.8 + Math.random() * 2.2;
              c.vz = 2.6 + Math.random() * 2.2;
              c.rvx = (Math.random() - 0.5) * 12;
              c.rvz = (Math.random() - 0.5) * 12;
            }
          }
          if (knockedNow > 0) {
            pr.hitDone = true;
            this.score += knockedNow * 85;
            soundEngine.playPotBreak();
            this.onParticles(pr.x, pr.y, pr.z, 14, 0xfacc15);
            const allDown = this.cans.every((c) => c.knocked);
            if (allDown) {
              this.score += 200;
              this.lastEvent = `PYRAMID CLEARED! +${knockedNow * 85 + 200} pts!`;
              this.pendingFinishTimer = 0.85;
            } else {
              this.lastEvent = `Knocked ${knockedNow} can${knockedNow > 1 ? 's' : ''}! +${knockedNow * 85} pts`;
            }
            this.emitHud();
          }
        } else if (!pr.hitDone && b.id === 'ring_toss' && pr.vy < 0 && pr.y <= 1.68) {
          for (const p of this.pegs) {
            if (p.ringed) continue;
            const dXZ = Math.hypot(pr.x - p.worldX, pr.z - p.worldZ);
            if (dXZ < 0.23) {
              p.ringed = true;
              pr.hitDone = true;
              pr.settled = true;
              pr.mesh.position.set(p.worldX, 1.32, p.worldZ);
              pr.mesh.rotation.set(Math.PI / 2, 0, 0);
              this.score += p.points;
              soundEngine.playCoin();
              this.onParticles(p.worldX, 1.55, p.worldZ, 16, 0xfacc15);
              this.lastEvent = `RINGED A BOTTLE! +${p.points} pts!`;
              this.settledRingMeshes.push(pr.mesh);
              this.projectiles.splice(i, 1);
              this.emitHud();
              break;
            }
          }
          if (pr.hitDone) continue;
        }

        if (pr.y <= 0.14) {
          pr.y = 0.14;
          pr.settled = true;
        }
      }

      if (pr.age >= pr.maxAge) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Finish round when attempts exhausted and projectiles settled
    if (this.pendingFinishTimer > 0) {
      this.pendingFinishTimer -= dt;
      if (this.pendingFinishTimer <= 0) {
        this.finishRound();
      }
    } else if (this.attemptsLeft <= 0 && this.projectiles.length === 0) {
      this.finishRound();
    }
  }

  private finishRound(): void {
    if (!this.activeBooth || this.phase !== 'playing') return;
    this.phase = 'summary';
    this.reticleGroup.visible = false;
    const finishedBooth = this.activeBooth;
    const finalScore = this.score;
    soundEngine.playArcadeWin();
    this.lastEvent = finalScore > 0 ? `Great Mela Play! Final Score: ${finalScore}` : 'Good try! Have another go!';
    this.emitHud();

    this.onCompleteGame(finishedBooth.id, finalScore).then((coins) => {
      if (this.activeBooth?.id === finishedBooth.id && this.phase === 'summary') {
        this.coinsEarned = coins;
        this.emitHud();
      }
    });
  }

  private emitHud(): void {
    if (!this.activeBooth) {
      this.onHudChange(null);
      return;
    }
    this.onHudChange({
      gameId: this.activeBooth.id,
      name: this.activeBooth.name,
      tagline: this.activeBooth.tagline,
      instructions: this.activeBooth.instructions,
      actionLabel: this.activeBooth.actionLabel,
      accent: this.activeBooth.accent,
      phase: this.phase === 'summary' ? 'summary' : 'playing',
      score: this.score,
      attemptsLeft: this.attemptsLeft,
      maxAttempts: this.activeBooth.maxAttempts,
      lastEvent: this.lastEvent,
      usesPowerMeter: this.activeBooth.usesPowerMeter,
      usesNumberPick: this.activeBooth.usesNumberPick,
      powerMeter01: this.powerMeter01,
      pickedDucks: this.pickedDucks,
      coinsEarned: this.coinsEarned,
    });
  }

  public dispose(): void {
    this.clearActiveProjectiles();
    this.ducks.forEach((d) => {
      d.group.traverse((child) => {
        if ((child as THREE.Sprite).isSprite) {
          const mat = (child as THREE.Sprite).material as THREE.SpriteMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
      this.scene.remove(d.group);
    });
    this.scene.remove(this.reticleGroup);
    for (const geo of [this.stoneGeo, this.ringGeo, this.beanbagGeo, this.dartShaftGeo, this.dartTipGeo]) {
      geo.dispose();
    }
    for (const mat of [this.stoneMat, this.beanbagMat, this.dartShaftMat, this.dartTipMat, ...this.ringMats]) {
      mat.dispose();
    }
  }
}
