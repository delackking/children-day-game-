import * as THREE from 'three';
import { ALL_STALLS, CARNIVAL_ZONES, TRAMPOLINE_PADS, WORLD_RADIUS } from '../shared/catalog';
import type { LightingMode, TimeOfDay } from '../shared/types';
import { createNpcMesh, type NpcManager } from './npcManager';
import {
  createBasketballCourtTexture,
  createCobblestoneTexture,
  createGlowHaloTexture,
  createGrassTexture,
  createPitchTexture,
  createRadialShadowTexture,
  createRangoliTexture,
  createSignboardTexture,
} from './textures';

export interface BoxCollider2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TrampolineVisual {
  id: string;
  group: THREE.Group;
  matMesh: THREE.Mesh;
  bounceVelocity: number;
  bounceOffset: number;
}

export interface WorldHandles {
  colliders: BoxCollider2D[];
  cameraOccluders: THREE.Object3D[];
  ferrisWheelRotor: THREE.Group;
  ferrisGondolas: THREE.Group[];
  fountainWater: THREE.Mesh;
  djDiscoBall: THREE.Mesh;
  djSpotLights: THREE.PointLight[];
  djScreenMat: THREE.MeshStandardMaterial;
  danceFloorTiles: THREE.MeshStandardMaterial[];
  ballMeshes: Map<string, THREE.Group>;
  treasureMeshes: Map<string, THREE.Group>;
  trampolines: Map<string, TrampolineVisual>;
  arcadePositions: { x: number; z: number }[];
  ferrisBoardPos: { x: number; z: number };
  djBoothPos: { x: number; z: number };
  celebrationStagePos: { x: number; z: number };
  updateDynamicWorld: (
    elapsed: number,
    dt: number,
    djPlaying: boolean,
    lighting: LightingMode,
    timeOfDay: TimeOfDay,
  ) => void;
  updateZoneCulling: (px: number, pz: number, lowGraphics: boolean) => void;
  triggerTrampolineBounce: (id: string) => void;
  disposeWorld: () => void;
}

export function buildCarnivalWorld(
  scene: THREE.Scene,
  maxAnisotropy: number,
  npcManager: NpcManager,
): WorldHandles {
  const colliders: BoxCollider2D[] = [];
  const cameraOccluders: THREE.Object3D[] = [];
  const shadowTex = createRadialShadowTexture();

  const addCollider = (cx: number, cz: number, hx: number, hz: number) => {
    colliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };

  // Sky dome gradients (Day / Sunset / Starry Night)
  const makeSkyTex = (stops: [number, string][]) => {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    for (const [pos, col] of stops) g.addColorStop(pos, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  };
  const skyDayTex = makeSkyTex([
    [0, '#1E40AF'],
    [0.45, '#60A5FA'],
    [0.85, '#FDE68A'],
    [1, '#FDBA74'],
  ]);
  const skySunsetTex = makeSkyTex([
    [0, '#1E1B4B'],
    [0.42, '#9D174D'],
    [0.75, '#F97316'],
    [1, '#FDE047'],
  ]);
  const skyNightTex = makeSkyTex([
    [0, '#020617'],
    [0.5, '#0F172A'],
    [0.85, '#1E1B4B'],
    [1, '#312E81'],
  ]);
  const skyGeo = new THREE.SphereGeometry(220, 14, 10);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyDayTex, side: THREE.BackSide, fog: false });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // Twinkling Starfield for Sunset & Starry Night Mela
  const starCount = 160;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.44;
    const r = 190;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 8;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: '#FEF9C3', size: 1.5, transparent: true, opacity: 0, fog: false });
  const starPoints = new THREE.Points(starGeo, starMat);
  scene.add(starPoints);

  // Lush Grass Terrain extending past playable radius
  const grassTex = createGrassTexture(maxAnisotropy);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_RADIUS + 50, 32),
    new THREE.MeshStandardMaterial({ map: grassTex, color: 0xffffff, roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Cobblestone Plaza & Pathways (offset +0.025 on Y to prevent Z-fighting)
  const cobbleTex = createCobblestoneTexture(maxAnisotropy);
  const roadMat = new THREE.MeshStandardMaterial({ map: cobbleTex, color: 0xffffff, roughness: 0.85 });

  const centralDisc = new THREE.Mesh(new THREE.CylinderGeometry(18, 18.4, 0.05, 36), roadMat);
  centralDisc.position.y = 0.025;
  centralDisc.receiveShadow = true;
  scene.add(centralDisc);

  const addRoadStrip = (x1: number, z1: number, x2: number, z2: number, width: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(x2 - x1, z2 - z1);
    const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, len), roadMat);
    road.position.set((x1 + x2) / 2, 0.022, (z1 + z2) / 2);
    road.rotation.y = angle;
    road.receiveShadow = true;
    scene.add(road);
  };

  addRoadStrip(0, 56, 0, -40, 6.5); // Main North-South Spine
  addRoadStrip(-42, 0, 38, 0, 6.0); // Main East-West Spine
  addRoadStrip(-32, 26, -32, -26, 6.2); // Food Street Promenade
  addRoadStrip(0, -34, -30, -34, 5.0); // DJ -> Arcade
  addRoadStrip(0, -34, 32, -34, 5.0); // DJ -> Celebration Stage

  // =========================================================
  // A. GRAND ENTRANCE (0, 48)
  // =========================================================
  const entranceGroup = new THREE.Group();
  entranceGroup.position.set(0, 0, 49);
  scene.add(entranceGroup);

  const pillarMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#FACC15', metalness: 0.78, roughness: 0.25 });
  const creamMat = new THREE.MeshStandardMaterial({ color: '#FFFBEB', roughness: 0.75 });

  for (const side of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.6), creamMat);
    base.position.set(side * 4.5, 0.3, 0);
    base.castShadow = true;
    entranceGroup.add(base);

    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 5.2, 14), pillarMat);
    col.position.set(side * 4.5, 3.0, 0);
    col.castShadow = true;
    entranceGroup.add(col);
    cameraOccluders.push(col);
    addCollider(side * 4.5, 49, 0.9, 0.9);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 10), goldMat);
    dome.position.set(side * 4.5, 5.9, 0);
    entranceGroup.add(dome);
  }

  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.4, 0.9), pillarMat);
  archBeam.position.set(0, 5.6, 0);
  archBeam.castShadow = true;
  entranceGroup.add(archBeam);

  const marqueeTex = createSignboardTexture(
    'CARNIVAL',
    "THE VIRTUAL CHILDREN'S DAY",
    '#B91C1C',
    '#F59E0B',
    maxAnisotropy,
  );
  const marqueeMat = new THREE.MeshStandardMaterial({ map: marqueeTex, color: 0xffffff, roughness: 0.35 });
  for (const faceZ of [0.47, -0.47]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.2), marqueeMat);
    sign.position.set(0, 5.8, faceZ);
    if (faceZ < 0) sign.rotation.y = Math.PI;
    entranceGroup.add(sign);
  }

  // Balloon clusters at entrance
  const balloonColors = ['#EF4444', '#F59E0B', '#10B981', '#0284C7', '#EC4899'];
  for (const side of [-1, 1]) {
    for (let b = 0; b < 5; b++) {
      const balloon = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 10),
        new THREE.MeshStandardMaterial({ color: balloonColors[b], roughness: 0.25 }),
      );
      balloon.position.set(side * 5.6 + Math.cos(b) * 0.4, 3.8 + b * 0.35, Math.sin(b) * 0.4);
      balloon.scale.set(1, 1.18, 1);
      entranceGroup.add(balloon);
    }
  }

  // Welcome & Instructions Board beside Entrance
  const infoBoardGroup = new THREE.Group();
  infoBoardGroup.position.set(6.8, 0, 44);
  infoBoardGroup.rotation.y = -0.45;
  const boardPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.4, 10), goldMat);
  boardPost.position.y = 1.2;
  infoBoardGroup.add(boardPost);
  const boardTex = createSignboardTexture(
    'WELCOME FRIENDS!',
    'WASD Move · SPACE Jump · E Interact · F5 Cam',
    '#1E3A5F',
    '#0F172A',
    maxAnisotropy,
  );
  const boardPanel = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.5, 0.16),
    new THREE.MeshStandardMaterial({ map: boardTex, color: 0xffffff, roughness: 0.4 }),
  );
  boardPanel.position.y = 2.2;
  infoBoardGroup.add(boardPanel);
  scene.add(infoBoardGroup);
  addCollider(6.8, 44, 1.8, 0.6);

  // =========================================================
  // B. CENTRAL PLAZA (Lotus Fountain + Giant Ferris Wheel Landmark)
  // =========================================================
  const fountainGroup = new THREE.Group();
  scene.add(fountainGroup);

  const basinOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.7, 0.7, 24),
    new THREE.MeshStandardMaterial({ color: '#F1F5F9', roughness: 0.55 }),
  );
  basinOuter.position.y = 0.35;
  basinOuter.receiveShadow = true;
  basinOuter.castShadow = true;
  fountainGroup.add(basinOuter);
  addCollider(0, 0, 4.6, 4.6);

  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(4.0, 4.0, 0.15, 24),
    new THREE.MeshStandardMaterial({ color: '#06B6D4', roughness: 0.12, metalness: 0.25 }),
  );
  fountainWater.position.y = 0.66;
  fountainGroup.add(fountainWater);

  const midTier = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 2.2, 16), creamMat);
  midTier.position.y = 1.4;
  fountainGroup.add(midTier);

  const lotusBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.6, 0.45, 16), goldMat);
  lotusBowl.position.y = 2.4;
  fountainGroup.add(lotusBowl);

  const topFinial = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), goldMat);
  topFinial.position.y = 3.25;
  fountainGroup.add(topFinial);

  // Colourful Indian Rangoli Mandala around Central Fountain
  const rangoliTex = createRangoliTexture(maxAnisotropy);
  const rangoliRing = new THREE.Mesh(
    new THREE.RingGeometry(4.75, 9.2, 36),
    new THREE.MeshBasicMaterial({ map: rangoliTex, transparent: true, opacity: 0.92, depthWrite: false }),
  );
  rangoliRing.rotation.x = -Math.PI / 2;
  rangoliRing.position.y = 0.056;
  fountainGroup.add(rangoliRing);

  // Giant Ferris Wheel Landmark behind Central Plaza at (15, 0, -14)
  const ferrisGroup = new THREE.Group();
  ferrisGroup.position.set(16, 0, -16);
  ferrisGroup.rotation.y = -0.55;
  scene.add(ferrisGroup);

  const supportMat = new THREE.MeshStandardMaterial({ color: '#E11D48', metalness: 0.5, roughness: 0.35 });
  for (const side of [-1.4, 1.4]) {
    for (const tilt of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 11.5, 10), supportMat);
      leg.position.set(tilt * 6, 5.4, side);
      leg.rotation.z = tilt;
      leg.castShadow = true;
      ferrisGroup.add(leg);
    }
  }
  addCollider(16, -16, 4.5, 2.6);

  const ferrisWheelRotor = new THREE.Group();
  ferrisWheelRotor.position.set(0, 10.2, 0);
  ferrisGroup.add(ferrisWheelRotor);

  for (const zOff of [-1.0, 1.0]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.16, 10, 32), goldMat);
    rim.position.z = zOff;
    ferrisWheelRotor.add(rim);
  }
  const ferrisGondolas: THREE.Group[] = [];
  const gondolaColors = ['#F59E0B', '#DC2626', '#10B981', '#0284C7', '#EC4899', '#8B5CF6'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 15.2, 6), goldMat);
    spoke.rotation.z = a;
    ferrisWheelRotor.add(spoke);

    const gondola = new THREE.Group();
    gondola.position.set(Math.cos(a) * 7.6, Math.sin(a) * 7.6, 0);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.95, 1.25),
      new THREE.MeshStandardMaterial({ color: gondolaColors[i % gondolaColors.length], roughness: 0.45 }),
    );
    cabin.position.y = -0.65;
    gondola.add(cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.45, 4), goldMat);
    roof.position.y = 0.05;
    roof.rotation.y = Math.PI / 4;
    gondola.add(roof);
    ferrisWheelRotor.add(gondola);
    ferrisGondolas.push(gondola);
  }

  // 36 Spinning Giant Ferris Wheel Rim LEDs (InstancedMesh)
  const ferrisLedCount = 36;
  const ferrisLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ferrisLedInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 6), ferrisLedMat, ferrisLedCount);
  const ferrisLedDummy = new THREE.Object3D();
  const ferrisLedColor = new THREE.Color();
  const ferrisLedPalette = [0xfacc15, 0xec4899, 0x38bdf8, 0x22c55e, 0xf97316, 0xa855f7];
  for (let i = 0; i < ferrisLedCount; i++) {
    const a = (i / ferrisLedCount) * Math.PI * 2;
    ferrisLedDummy.position.set(Math.cos(a) * 7.6, Math.sin(a) * 7.6, i % 2 === 0 ? 1.16 : -1.16);
    ferrisLedDummy.updateMatrix();
    ferrisLedInst.setMatrixAt(i, ferrisLedDummy.matrix);
    ferrisLedColor.setHex(ferrisLedPalette[i % ferrisLedPalette.length]);
    ferrisLedInst.setColorAt(i, ferrisLedColor);
  }
  ferrisWheelRotor.add(ferrisLedInst);

  // Ferris Wheel Boarding Deck & Ride Sign
  const ferrisDeck = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.35, 2.8),
    new THREE.MeshStandardMaterial({ color: '#991B1B', roughness: 0.6 }),
  );
  ferrisDeck.position.set(16, 0.175, -10.8);
  ferrisDeck.receiveShadow = true;
  scene.add(ferrisDeck);
  const ferrisSignTex = createSignboardTexture('GIANT FERRIS WHEEL', 'PRESS E TO RIDE SKY-HIGH!', '#E11D48', '#FACC15', maxAnisotropy);
  const ferrisSign = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.15, 0.18),
    new THREE.MeshStandardMaterial({ map: ferrisSignTex, color: 0xffffff }),
  );
  ferrisSign.position.set(16, 2.2, -9.8);
  scene.add(ferrisSign);
  const ferrisPoleL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), goldMat);
  ferrisPoleL.position.set(14.3, 1.1, -9.8);
  scene.add(ferrisPoleL);
  const ferrisPoleR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), goldMat);
  ferrisPoleR.position.set(17.7, 1.1, -9.8);
  scene.add(ferrisPoleR);

  // Colourful Spinning Merry-Go-Round Carousel at (-14, 0, 26)
  const carouselGroup = new THREE.Group();
  carouselGroup.position.set(-14, 0, 26);
  scene.add(carouselGroup);
  const carouselBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.8, 0.35, 20),
    new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.5 }),
  );
  carouselBase.position.y = 0.175;
  carouselBase.receiveShadow = true;
  carouselGroup.add(carouselBase);
  const carouselRotor = new THREE.Group();
  carouselGroup.add(carouselRotor);
  const carouselMast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.4, 12), goldMat);
  carouselMast.position.y = 2.2;
  carouselRotor.add(carouselMast);
  const carouselCanopy = new THREE.Mesh(
    new THREE.ConeGeometry(4.0, 1.8, 12),
    new THREE.MeshStandardMaterial({ color: '#EC4899', roughness: 0.4 }),
  );
  carouselCanopy.position.y = 4.6;
  carouselRotor.add(carouselCanopy);
  const ponyColors = ['#FACC15', '#38BDF8', '#EF4444', '#22C55E', '#A855F7', '#F97316'];
  const ponyPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6);
  const ponyBodyGeo = new THREE.BoxGeometry(0.55, 0.42, 1.05);
  const carouselPonies: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 2.55;
    const pz = Math.sin(a) * 2.55;
    const pole = new THREE.Mesh(ponyPoleGeo, goldMat);
    pole.position.set(px, 2.0, pz);
    carouselRotor.add(pole);
    const pony = new THREE.Mesh(
      ponyBodyGeo,
      new THREE.MeshStandardMaterial({ color: ponyColors[i], roughness: 0.35 }),
    );
    pony.position.set(px, 1.35 + (i % 2) * 0.35, pz);
    pony.rotation.y = -a;
    carouselRotor.add(pony);
    carouselPonies.push(pony);
  }
  addCollider(-14, 26, 3.6, 3.6);

  // Park benches & ornate streetlights around Central Plaza (shared geometries)
  const benchWoodMat = new THREE.MeshStandardMaterial({ color: '#92400E', roughness: 0.78 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.65, roughness: 0.35 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#FEF08A', emissive: '#FACC15', emissiveIntensity: 1.2 });

  const benchSeatGeo = new THREE.BoxGeometry(2.0, 0.12, 0.65);
  const benchBackGeo = new THREE.BoxGeometry(2.0, 0.55, 0.1);
  const benchLegGeo = new THREE.BoxGeometry(0.1, 0.5, 0.55);
  const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.13, 3.8, 8);
  const lampBulbGeo = new THREE.SphereGeometry(0.24, 10, 8);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    const bx = Math.cos(a) * 11.5;
    const bz = Math.sin(a) * 11.5;
    const bench = new THREE.Group();
    bench.position.set(bx, 0, bz);
    bench.rotation.y = -a + Math.PI / 2;
    const seat = new THREE.Mesh(benchSeatGeo, benchWoodMat);
    seat.position.y = 0.5;
    bench.add(seat);
    const back = new THREE.Mesh(benchBackGeo, benchWoodMat);
    back.position.set(0, 0.8, -0.28);
    bench.add(back);
    for (const lx of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(benchLegGeo, ironMat);
      leg.position.set(lx, 0.25, 0);
      bench.add(leg);
    }
    scene.add(bench);

    // Streetlight next to bench
    const lampX = Math.cos(a + 0.18) * 14.5;
    const lampZ = Math.sin(a + 0.18) * 14.5;
    const pole = new THREE.Mesh(lampPoleGeo, ironMat);
    pole.position.set(lampX, 1.9, lampZ);
    scene.add(pole);
    const bulb = new THREE.Mesh(lampBulbGeo, bulbMat);
    bulb.position.set(lampX, 3.9, lampZ);
    scene.add(bulb);
  }

  // Directional Zone Signpost in Central Plaza
  const signpost = new THREE.Group();
  signpost.position.set(-7.5, 0, 7.5);
  const spPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.3, 10), ironMat);
  spPole.position.y = 1.65;
  signpost.add(spPole);
  const dirLabels = [
    { text: '<- FOOD STREET', y: 2.9, rot: 0.2, col: '#DC2626' },
    { text: 'SPORTS GROUND ->', y: 2.45, rot: -0.2, col: '#16A34A' },
    { text: 'DJ & ARCADE ^', y: 2.0, rot: 0, col: '#7C3AED' },
  ];
  const dirPlankGeo = new THREE.BoxGeometry(2.3, 0.42, 0.1);
  for (const dl of dirLabels) {
    const tex = createSignboardTexture(dl.text, 'CARNIVAL MAP', dl.col, '#1E293B', maxAnisotropy);
    const plank = new THREE.Mesh(
      dirPlankGeo,
      new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff }),
    );
    plank.position.y = dl.y;
    plank.rotation.y = dl.rot;
    signpost.add(plank);
  }
  scene.add(signpost);

  // =========================================================
  // C. INDIAN FOOD STREET & PATAKHA BAZAAR (All 16 Stalls + Vendors, shared geometries)
  // =========================================================
  const foodStreetGroup = new THREE.Group();
  scene.add(foodStreetGroup);

  const woodCounterMat = new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.78 });
  const counterTopMat = new THREE.MeshStandardMaterial({ color: '#FDE68A', roughness: 0.35 });
  const stallBaseGeo = new THREE.BoxGeometry(3.8, 1.05, 2.2);
  const stallTopGeo = new THREE.BoxGeometry(4.0, 0.12, 2.45);
  const stallPostGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8);
  const stallAwningGeo = new THREE.BoxGeometry(0.84, 0.16, 2.75);
  const stallSignGeo = new THREE.BoxGeometry(3.5, 0.95, 0.12);
  const stallTrayGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.06, 10);
  const stallSampleGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const stallLanternGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const stallMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const getStallMat = (color: string, roughness = 0.68) => {
    const key = `${color}_${roughness}`;
    let m = stallMatCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness });
      stallMatCache.set(key, m);
    }
    return m;
  };

  for (const stall of ALL_STALLS) {
    const g = new THREE.Group();
    g.position.set(stall.x, 0, stall.z);
    g.rotation.y = stall.rotationY;

    const base = new THREE.Mesh(stallBaseGeo, getStallMat(stall.awningColorA, 0.72));
    base.position.set(0, 0.525, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);
    cameraOccluders.push(base);

    const counterTop = new THREE.Mesh(stallTopGeo, counterTopMat);
    counterTop.position.set(0, 1.08, 0.1);
    g.add(counterTop);

    for (const px of [-1.75, 1.75]) {
      for (const pz of [-0.95, 0.95]) {
        const post = new THREE.Mesh(stallPostGeo, woodCounterMat);
        post.position.set(px, 2.2, pz);
        g.add(post);
      }
    }

    for (let s = 0; s < 5; s++) {
      const strip = new THREE.Mesh(
        stallAwningGeo,
        getStallMat(s % 2 === 0 ? stall.awningColorA : stall.awningColorB, 0.65),
      );
      strip.position.set(-1.68 + s * 0.84, 3.38, 0.08);
      strip.rotation.x = 0.14;
      strip.castShadow = true;
      g.add(strip);
    }

    const signTex = createSignboardTexture(
      stall.name,
      `₹ ${stall.items[0]?.price ?? 25} Coins · Press E`,
      stall.awningColorA,
      '#1E293B',
      maxAnisotropy,
    );
    const signMesh = new THREE.Mesh(
      stallSignGeo,
      new THREE.MeshStandardMaterial({ map: signTex, color: 0xffffff, roughness: 0.4 }),
    );
    signMesh.position.set(0, 3.85, 1.15);
    g.add(signMesh);

    const tray = new THREE.Mesh(stallTrayGeo, goldMat);
    tray.position.set(-0.7, 1.17, 0.72);
    g.add(tray);
    const sampleFood = new THREE.Mesh(
      stallSampleGeo,
      getStallMat(stall.items[0]?.primaryColor || '#F59E0B', 0.5),
    );
    sampleFood.scale.set(1.1, 0.6, 1.1);
    sampleFood.position.set(-0.7, 1.25, 0.72);
    g.add(sampleFood);

    const lantern = new THREE.Mesh(stallLanternGeo, bulbMat);
    lantern.position.set(1.3, 3.1, 1.1);
    g.add(lantern);

    const vendor = createNpcMesh(
      stall.vendorName,
      stall.id === 'patakha_bazaar' ? 'FIREWORKS' : 'VENDOR',
      stall.awningColorA,
      stall.awningColorB,
      shadowTex,
    );
    vendor.group.position.set(0, 0, -0.55);
    g.add(vendor.group);

    const wx = stall.x - Math.sin(stall.rotationY) * 0.55;
    const wz = stall.z - Math.cos(stall.rotationY) * 0.55;
    npcManager.registerVendorNpc(
      stall.vendorName,
      stall.greeting,
      vendor.group,
      vendor.head,
      vendor.rightArm,
      vendor.leftLeg,
      vendor.rightLeg,
      wx,
      wz,
    );

    if (stall.id === 'patakha_bazaar') {
      scene.add(g); // Close to plaza/entrance crossroads so always visible
    } else {
      foodStreetGroup.add(g);
    }
    const rotCos = Math.abs(Math.cos(stall.rotationY));
    const hx = rotCos > 0.5 ? 2.1 : 1.3;
    const hz = rotCos > 0.5 ? 1.3 : 2.1;
    addCollider(stall.x, stall.z, hx, hz);
  }

  // =========================================================
  // D. SPORTS GROUND + BOUNCY TRAMPOLINES
  // =========================================================
  const sportsGroup = new THREE.Group();
  scene.add(sportsGroup);
  const pitchTex = createPitchTexture(maxAnisotropy);
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 32),
    new THREE.MeshStandardMaterial({ map: pitchTex, color: 0xffffff, roughness: 0.9 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(36, 0.04, 6);
  pitch.receiveShadow = true;
  sportsGroup.add(pitch);

  const postMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.35, metalness: 0.25 });
  const netMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    wireframe: true,
    transparent: true,
    opacity: 0.65,
  });

  for (const goalZ of [-9.5, 21.5]) {
    const dir = goalZ < 0 ? -1 : 1;
    const goalGroup = new THREE.Group();
    goalGroup.position.set(36, 0, goalZ);

    for (const gx of [-3.2, 3.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8, 8), postMat);
      post.position.set(gx, 1.4, 0);
      post.castShadow = true;
      goalGroup.add(post);
    }
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.55, 8), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 2.8, 0);
    goalGroup.add(crossbar);

    const netBack = new THREE.Mesh(new THREE.BoxGeometry(6.3, 2.7, 1.3), netMat);
    netBack.position.set(0, 1.35, dir * 0.7);
    goalGroup.add(netBack);

    sportsGroup.add(goalGroup);
  }

  // Basketball Court beside Football Pitch at (48, -8)
  const bballTex = createBasketballCourtTexture(maxAnisotropy);
  const bballCourt = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({ map: bballTex, color: 0xffffff, roughness: 0.8 }),
  );
  bballCourt.rotation.x = -Math.PI / 2;
  bballCourt.position.set(49, 0.045, -8);
  bballCourt.receiveShadow = true;
  sportsGroup.add(bballCourt);

  const hoopGroup = new THREE.Group();
  hoopGroup.position.set(54.2, 0, -8);
  const hoopPole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 4.0, 8), ironMat);
  hoopPole.position.y = 2.0;
  hoopGroup.add(hoopPole);
  const backboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 1.5, 2.2),
    new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3 }),
  );
  backboard.position.set(-0.25, 3.6, 0);
  hoopGroup.add(backboard);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.045, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#EA580C', metalness: 0.5, roughness: 0.3 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-0.75, 3.15, 0);
  hoopGroup.add(rim);
  sportsGroup.add(hoopGroup);
  addCollider(54.2, -8, 0.6, 0.6);

  // 3 Bouncy Colourful Carnival Trampolines
  const trampolines = new Map<string, TrampolineVisual>();
  const trampLegGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.42, 6);
  for (const pad of TRAMPOLINE_PADS) {
    const tg = new THREE.Group();
    tg.position.set(pad.x, 0, pad.z);

    const frameRim = new THREE.Mesh(
      new THREE.TorusGeometry(pad.radius, 0.18, 8, 22),
      new THREE.MeshStandardMaterial({ color: pad.color, roughness: 0.35, metalness: 0.35 }),
    );
    frameRim.rotation.x = Math.PI / 2;
    frameRim.position.y = 0.42;
    frameRim.castShadow = true;
    tg.add(frameRim);

    const matMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.radius - 0.1, pad.radius - 0.1, 0.08, 20),
      new THREE.MeshStandardMaterial({
        color: '#0F172A',
        emissive: pad.color,
        emissiveIntensity: 0.18,
        roughness: 0.65,
      }),
    );
    matMesh.position.y = 0.42;
    matMesh.receiveShadow = true;
    tg.add(matMesh);

    const starRing = new THREE.Mesh(
      new THREE.RingGeometry(pad.radius * 0.35, pad.radius * 0.55, 16),
      new THREE.MeshBasicMaterial({ color: '#FACC15', side: THREE.DoubleSide }),
    );
    starRing.rotation.x = -Math.PI / 2;
    starRing.position.y = 0.045;
    matMesh.add(starRing);

    for (let l = 0; l < 6; l++) {
      const a = (l / 6) * Math.PI * 2;
      const leg = new THREE.Mesh(trampLegGeo, ironMat);
      leg.position.set(Math.cos(a) * (pad.radius - 0.12), 0.21, Math.sin(a) * (pad.radius - 0.12));
      tg.add(leg);
    }

    scene.add(tg);
    trampolines.set(pad.id, {
      id: pad.id,
      group: tg,
      matMesh,
      bounceVelocity: 0,
      bounceOffset: 0,
    });
  }

  // Interactive Physics Ball Meshes
  const ballMeshes = new Map<string, THREE.Group>();
  const makeBall = (id: string, colorA: string, colorB: string, radius: number) => {
    const bg = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 14),
      new THREE.MeshStandardMaterial({ color: colorA, roughness: 0.45 }),
    );
    sphere.castShadow = true;
    bg.add(sphere);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.99, 0.028, 6, 18),
      new THREE.MeshStandardMaterial({ color: colorB, roughness: 0.5 }),
    );
    bg.add(band);
    scene.add(bg);
    ballMeshes.set(id, bg);
  };
  makeBall('ball_football_1', '#FFFFFF', '#0F172A', 0.42);
  makeBall('ball_football_2', '#FEF08A', '#1E293B', 0.42);
  makeBall('ball_basketball_1', '#EA580C', '#1C1917', 0.42);
  makeBall('ball_beach_1', '#EC4899', '#38BDF8', 0.5);

  // =========================================================
  // E. DJ & DANCE ARENA (0, -36)
  // =========================================================
  const djGroup = new THREE.Group();
  djGroup.position.set(0, 0, -36);
  scene.add(djGroup);

  const stageBase = new THREE.Mesh(
    new THREE.BoxGeometry(14, 1.1, 6.5),
    new THREE.MeshStandardMaterial({ color: '#1E1B4B', roughness: 0.6 }),
  );
  stageBase.position.set(0, 0.55, -3.5);
  stageBase.castShadow = true;
  stageBase.receiveShadow = true;
  djGroup.add(stageBase);
  addCollider(0, -39.5, 7.0, 3.3);
  cameraOccluders.push(stageBase);

  // DJ Console Booth
  const consoleBox = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.1, 1.3),
    new THREE.MeshStandardMaterial({ color: '#312E81', metalness: 0.4, roughness: 0.4 }),
  );
  consoleBox.position.set(0, 1.65, -2.1);
  djGroup.add(consoleBox);

  // Twin Speaker Stacks
  const speakerMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.7 });
  const coneMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.5, roughness: 0.35 });
  for (const sx of [-5.2, 5.2]) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 1.5), speakerMat);
    cab.position.set(sx, 2.7, -2.8);
    djGroup.add(cab);
    for (const wy of [2.1, 3.2]) {
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.15, 16), coneMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(sx, wy, -2.02);
      djGroup.add(woofer);
    }
  }

  // Animated LED Backdrop Screen
  const ledTex = createSignboardTexture('DJ PARTY ARENA', 'PRESS V TO DANCE!', '#4C1D95', '#EC4899', maxAnisotropy);
  const djScreenMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    color: 0xffffff,
    emissive: '#7C3AED',
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });
  const ledScreen = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.4, 0.25), djScreenMat);
  ledScreen.position.set(0, 3.3, -5.8);
  djGroup.add(ledScreen);

  // Overhead Truss & Disco Ball
  for (const tx of [-6.4, 6.4]) {
    const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.5, 8), ironMat);
    truss.position.set(tx, 3.8, -0.5);
    djGroup.add(truss);
  }
  const topTruss = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.25, 0.25), ironMat);
  topTruss.position.set(0, 6.5, -0.5);
  djGroup.add(topTruss);

  const djDiscoBall = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.85, 1),
    new THREE.MeshStandardMaterial({ color: '#F8FAFC', metalness: 0.95, roughness: 0.12 }),
  );
  djDiscoBall.position.set(0, 5.4, 2.8);
  djGroup.add(djDiscoBall);

  // Glowing Checkerboard Dance Floor
  const danceFloorTiles: THREE.MeshStandardMaterial[] = [];
  const tileColors = ['#7C3AED', '#EC4899', '#F59E0B', '#06B6D4'];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = 0; gz < 4; gz++) {
      const col = tileColors[(Math.abs(gx) + gz) % tileColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.2,
        roughness: 0.25,
      });
      danceFloorTiles.push(mat);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 2.1), mat);
      tile.position.set(gx * 2.2, 0.035, 1.5 + gz * 2.2);
      tile.receiveShadow = true;
      djGroup.add(tile);
    }
  }

  // DJ Party PointLights (capped at 3 dynamic lights for performance)
  const djSpotLights: THREE.PointLight[] = [
    new THREE.PointLight('#EC4899', 6, 22, 1.5),
    new THREE.PointLight('#38BDF8', 6, 22, 1.5),
    new THREE.PointLight('#FACC15', 6, 22, 1.5),
  ];
  djSpotLights[0].position.set(-4, 5.2, -34);
  djSpotLights[1].position.set(4, 5.2, -34);
  djSpotLights[2].position.set(0, 5.8, -31);
  djSpotLights.forEach((l) => scene.add(l));

  // =========================================================
  // F. ARCADE ZONE (-30, -34)
  // =========================================================
  const arcadeGroup = new THREE.Group();
  arcadeGroup.position.set(-30, 0, -34);
  scene.add(arcadeGroup);

  const arcadeFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 9.8, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.65 }),
  );
  arcadeFloor.position.y = 0.04;
  arcadeFloor.receiveShadow = true;
  arcadeGroup.add(arcadeFloor);

  const arcadeSignTex = createSignboardTexture('ARCADE PAVILION', '10 MINI-GAMES · PRESS E', '#0284C7', '#4F46E5', maxAnisotropy);
  const arcadeHeader = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 1.4, 0.4),
    new THREE.MeshStandardMaterial({ map: arcadeSignTex, color: 0xffffff }),
  );
  arcadeHeader.position.set(0, 4.2, -4.5);
  arcadeGroup.add(arcadeHeader);

  const arcadePositions: { x: number; z: number }[] = [];
  const cabColors = ['#EF4444', '#F59E0B', '#10B981', '#0284C7', '#8B5CF6'];
  for (let i = 0; i < 5; i++) {
    const cx = -5.2 + i * 2.6;
    const cz = -3.8;
    const cab = new THREE.Group();
    cab.position.set(cx, 0, cz);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 2.15, 1.05),
      new THREE.MeshStandardMaterial({ color: cabColors[i], roughness: 0.45 }),
    );
    body.position.y = 1.08;
    body.castShadow = true;
    cab.add(body);
    const crt = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.65),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0EA5E9', emissiveIntensity: 0.7 }),
    );
    crt.position.set(0, 1.45, 0.54);
    cab.add(crt);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.14, 0.45), ironMat);
    deck.position.set(0, 1.02, 0.62);
    cab.add(deck);
    arcadeGroup.add(cab);

    const wx = -30 + cx;
    const wz = -34 + cz;
    arcadePositions.push({ x: wx, z: wz });
    addCollider(wx, wz, 0.7, 0.7);
  }

  // F2. 3D Mela Games Fairground is constructed dynamically by MelaGames3DManager at x = -20.5 / -10.5, z = -19.5 .. -29.5

  // =========================================================
  // G. GRAND CELEBRATION STAGE (32, -34)
  // =========================================================
  const celebGroup = new THREE.Group();
  celebGroup.position.set(32, 0, -34);
  celebGroup.rotation.y = -0.35;
  scene.add(celebGroup);

  const dais = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.9, 7),
    new THREE.MeshStandardMaterial({ color: '#B45309', roughness: 0.55 }),
  );
  dais.position.y = 0.45;
  dais.castShadow = true;
  dais.receiveShadow = true;
  celebGroup.add(dais);
  addCollider(32, -34, 5.5, 3.5);

  const podium = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.25, 1.0), creamMat);
  podium.position.set(0, 1.5, 1.6);
  celebGroup.add(podium);

  const trophyCup = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.18, 0.65, 14), goldMat);
  trophyCup.position.set(2.4, 1.35, 1.5);
  celebGroup.add(trophyCup);

  const celebSignTex = createSignboardTexture(
    'GRAND CELEBRATION STAGE',
    'PRIZES · ANNOUNCEMENTS · FIREWORKS',
    '#D97706',
    '#991B1B',
    maxAnisotropy,
  );
  const celebBanner = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 2.2, 0.28),
    new THREE.MeshStandardMaterial({ map: celebSignTex, color: 0xffffff }),
  );
  celebBanner.position.set(0, 3.2, -2.8);
  celebGroup.add(celebBanner);

  // =========================================================
  // TREASURE CHEST MESHES (Hidden/Activated by Host)
  // =========================================================
  const treasureMeshes = new Map<string, THREE.Group>();
  // Pre-build reusable treasure pool keyed when room state updates
  const treasureSeeds = [
    'tr_1',
    'tr_2',
    'tr_3',
    'tr_4',
    'tr_5',
    'tr_6',
    'tr_7',
  ];
  for (const tid of treasureSeeds) {
    const tg = new THREE.Group();
    tg.visible = false;
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.52, 0.52),
      new THREE.MeshStandardMaterial({ color: '#B45309', roughness: 0.45 }),
    );
    chest.position.y = 0.26;
    tg.add(chest);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.55), goldMat);
    band.position.y = 0.42;
    tg.add(band);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0284C7', emissiveIntensity: 0.9 }),
    );
    gem.position.y = 0.85;
    tg.add(gem);
    scene.add(tg);
    treasureMeshes.set(tid, tg);
  }

  // =========================================================
  // NATURAL PERIMETER TREES, COLOURFUL BUNTING FLAGS & MARIGOLD CLUSTERS (InstancedMesh)
  // =========================================================
  const treeCount = 44;
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.8, 8);
  const crownGeo = new THREE.ConeGeometry(1.9, 3.6, 10);
  const trunkInst = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.9 }),
    treeCount,
  );
  const crownInst = new THREE.InstancedMesh(
    crownGeo,
    new THREE.MeshStandardMaterial({ color: '#22C55E', roughness: 0.82 }),
    treeCount,
  );
  crownInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2;
    const r = WORLD_RADIUS - 7 + ((i % 3) - 1) * 3.5;
    const tx = Math.cos(a) * r;
    const tz = Math.sin(a) * r;
    const scale = 0.85 + (i % 5) * 0.12;

    dummy.position.set(tx, 1.4 * scale, tz);
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 3.9 * scale, tz);
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);
    cColor.setHSL(0.32 + (i % 4) * 0.015, 0.58, 0.42);
    crownInst.setColorAt(i, cColor);
  }
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst);
  scene.add(crownInst);

  // Festive overhead triangular bunting flags across Plaza & Pathways (1 single draw call!)
  const buntingSpans: Array<[number, number, number, number, number]> = [
    [0, 48, 0, 18, 4.7],
    [-28, 22, -28, -22, 4.6],
    [-18, 0, -30, 0, 4.6],
    [16, 0, 28, 0, 4.6],
    [0, -18, 0, -32, 4.8],
    [7, 17, 17, 7, 4.5],
  ];
  const flagsPerSpan = 22;
  const totalFlags = buntingSpans.length * flagsPerSpan;
  const flagGeo = new THREE.ConeGeometry(0.24, 0.52, 3);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const flagInst = new THREE.InstancedMesh(flagGeo, flagMat, totalFlags);
  const festivePalette = [0xef4444, 0xfacc15, 0x10b981, 0x06b6d4, 0xec4899, 0x8b5cf6, 0xf97316];
  let flagIdx = 0;
  for (const [x1, z1, x2, z2, yTop] of buntingSpans) {
    const yaw = Math.atan2(x2 - x1, z2 - z1);
    for (let f = 0; f < flagsPerSpan; f++) {
      const t = (f + 0.5) / flagsPerSpan;
      const fx = THREE.MathUtils.lerp(x1, x2, t);
      const fz = THREE.MathUtils.lerp(z1, z2, t);
      const sag = Math.sin(t * Math.PI) * 0.85;
      dummy.position.set(fx, yTop - sag, fz);
      dummy.rotation.set(Math.PI, yaw, 0);
      dummy.scale.set(1, 1, 0.35);
      dummy.updateMatrix();
      flagInst.setMatrixAt(flagIdx, dummy.matrix);
      cColor.setHex(festivePalette[flagIdx % festivePalette.length]);
      flagInst.setColorAt(flagIdx, cColor);
      flagIdx++;
    }
  }
  flagInst.computeBoundingSphere();
  scene.add(flagInst);

  // Vibrant Marigold & Rose Flower Clusters along paths (1 single draw call!)
  const flowerCount = 54;
  const flowerGeo = new THREE.DodecahedronGeometry(0.32, 0);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  const flowerPalette = [0xf59e0b, 0xec4899, 0xf97316, 0xeab308, 0xa855f7];
  for (let i = 0; i < flowerCount; i++) {
    const a = (i / flowerCount) * Math.PI * 2;
    const rad = i % 3 === 0 ? 16.5 : i % 3 === 1 ? 26 : 38;
    let fx = Math.cos(a) * rad + Math.sin(i * 1.7) * 1.4;
    let fz = Math.sin(a) * rad + Math.cos(i * 1.3) * 1.4;
    if (fx >= -22.5 && fx <= -8.5 && fz >= -33.5 && fz <= -13.5) {
      fx = -6.8;
    }
    dummy.position.set(fx, 0.22, fz);
    dummy.rotation.set(0, i * 0.6, 0);
    const sc = 0.8 + (i % 4) * 0.25;
    dummy.scale.set(sc, 0.75 * sc, sc);
    dummy.updateMatrix();
    flowerInst.setMatrixAt(i, dummy.matrix);
    cColor.setHex(flowerPalette[i % flowerPalette.length]);
    flowerInst.setColorAt(i, cColor);
  }
  flowerInst.computeBoundingSphere();
  scene.add(flowerInst);

  // Subtle decorative zone marker rings so each area is inviting
  for (const z of CARNIVAL_ZONES) {
    if (z.id === 'entrance' || z.id === 'central_plaza') continue;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 24),
      new THREE.MeshStandardMaterial({
        color: z.color,
        emissive: z.color,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(z.spawnX, 0.055, z.spawnZ);
    scene.add(ring);
  }

  // Full-Fledged Night Mela Illumination: Pathway Streetlamps + Fairy String Bulbs + Ground Diyas + Light Pools
  const glowTex = createGlowHaloTexture();
  const extraLampCoords: Array<[number, number]> = [
    [-4.8, 22], [4.8, 22], [-4.8, 34], [4.8, 34], [-4.8, 44], [4.8, 44],
    [-27, -18], [-27, -6], [-27, 6], [-27, 18],
    [-19, -18], [-25, -27], [-13, -27],
    [24, -4], [24, 14], [26, -24], [14, 18], [-14, 21],
  ];
  const melaLampPoleInst = new THREE.InstancedMesh(lampPoleGeo, ironMat, extraLampCoords.length);
  const melaLampBulbMat = new THREE.MeshBasicMaterial({ color: '#FEF08A' });
  const melaLampBulbInst = new THREE.InstancedMesh(lampBulbGeo, melaLampBulbMat, extraLampCoords.length);
  const glowPoolGeo = new THREE.CircleGeometry(4.2, 14);
  const glowPoolMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowPoolInst = new THREE.InstancedMesh(glowPoolGeo, glowPoolMat, extraLampCoords.length + 6);
  for (let i = 0; i < extraLampCoords.length; i++) {
    const [lx, lz] = extraLampCoords[i];
    dummy.position.set(lx, 1.9, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    melaLampPoleInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 3.9, lz);
    dummy.updateMatrix();
    melaLampBulbInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 0.06, lz);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    glowPoolInst.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.53;
    dummy.position.set(Math.cos(a) * 14.5, 0.06, Math.sin(a) * 14.5);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(1.15, 1.15, 1.15);
    dummy.updateMatrix();
    glowPoolInst.setMatrixAt(extraLampCoords.length + i, dummy.matrix);
  }
  melaLampPoleInst.computeBoundingSphere();
  melaLampBulbInst.computeBoundingSphere();
  glowPoolInst.computeBoundingSphere();
  scene.add(melaLampPoleInst);
  scene.add(melaLampBulbInst);
  scene.add(glowPoolInst);

  // Twinkling Fairy String Bulbs along bunting spans & Entrance Arch
  const fairyBulbGeo = new THREE.SphereGeometry(0.11, 6, 6);
  const fairyBulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const fairyCoords: Array<[number, number, number, number]> = [];
  for (const [x1, z1, x2, z2, yTop] of buntingSpans) {
    for (let f = 0; f < 16; f++) {
      const t = (f + 0.5) / 16;
      const fx = THREE.MathUtils.lerp(x1, x2, t);
      const fz = THREE.MathUtils.lerp(z1, z2, t);
      const sag = Math.sin(t * Math.PI) * 0.85;
      fairyCoords.push([fx, yTop - sag + 0.16, fz, festivePalette[f % festivePalette.length]]);
    }
  }
  // Entrance Arch + Celebration Stage String Bulbs
  for (let i = -5; i <= 5; i++) {
    fairyCoords.push([i * 0.9, 6.45, 49.45, festivePalette[Math.abs(i) % festivePalette.length]]);
    fairyCoords.push([32 + i * 0.9, 4.5, -36.6, i % 2 === 0 ? 0xfacc15 : 0xf97316]);
  }
  const fairyInst = new THREE.InstancedMesh(fairyBulbGeo, fairyBulbMat, fairyCoords.length);
  for (let i = 0; i < fairyCoords.length; i++) {
    const [fx, fy, fz, hex] = fairyCoords[i];
    dummy.position.set(fx, fy, fz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    fairyInst.setMatrixAt(i, dummy.matrix);
    cColor.setHex(hex);
    fairyInst.setColorAt(i, cColor);
  }
  fairyInst.computeBoundingSphere();
  scene.add(fairyInst);

  // Brass Diwali/Mela Diyas around Lotus Fountain Rangoli & Entrance
  const diyaCount = 24;
  const diyaMat = new THREE.MeshBasicMaterial({ color: '#FDE047' });
  const diyaInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 6), diyaMat, diyaCount);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 9.3, 0.14, Math.sin(a) * 9.3);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 0.7, 1);
    dummy.updateMatrix();
    diyaInst.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -4.5 : 4.5;
    const zOff = 47.5 + (i % 4) * 1.1;
    dummy.position.set(side, 0.16, zOff);
    dummy.scale.set(1.2, 0.8, 1.2);
    dummy.updateMatrix();
    diyaInst.setMatrixAt(16 + i, dummy.matrix);
  }
  diyaInst.computeBoundingSphere();
  scene.add(diyaInst);

  // 3 Strategic Warm Mela PointLights for Night Illumination (Plaza, Food Street, Entrance/Midway)
  const melaNightLights = [
    new THREE.PointLight('#FBBF24', 0, 46, 1.2),
    new THREE.PointLight('#FB923C', 0, 44, 1.2),
    new THREE.PointLight('#FDE047', 0, 42, 1.2),
  ];
  melaNightLights[0].position.set(0, 8, 2);
  melaNightLights[1].position.set(-28, 7, 0);
  melaNightLights[2].position.set(4, 7, 36);
  melaNightLights.forEach((l) => scene.add(l));

  // Distance-based Zone Culling Groups to minimize active draw calls & RAM pressure
  const zoneCullList: Array<{ group: THREE.Group; cx: number; cz: number; radius: number }> = [
    { group: foodStreetGroup, cx: -32, cz: 0, radius: 34 },
    { group: sportsGroup, cx: 40, cz: 2, radius: 28 },
    { group: arcadeGroup, cx: -30, cz: -34, radius: 20 },
    { group: djGroup, cx: 0, cz: -36, radius: 22 },
    { group: celebGroup, cx: 32, cz: -34, radius: 20 },
  ];

  let lastAppliedTod: TimeOfDay = 'day';

  return {
    colliders,
    cameraOccluders,
    ferrisWheelRotor,
    ferrisGondolas,
    fountainWater,
    djDiscoBall,
    djSpotLights,
    djScreenMat,
    danceFloorTiles,
    ballMeshes,
    treasureMeshes,
    trampolines,
    arcadePositions,
    ferrisBoardPos: { x: 16, z: -10.8 },
    djBoothPos: { x: 0, z: -36 },
    celebrationStagePos: { x: 32, z: -34 },
    triggerTrampolineBounce(id: string) {
      const tr = trampolines.get(id);
      if (tr) tr.bounceVelocity = -5.5;
    },
    updateZoneCulling(px: number, pz: number, lowGraphics: boolean) {
      const maxDist = lowGraphics ? 44 : 66;
      for (const z of zoneCullList) {
        const d = Math.hypot(px - z.cx, pz - z.cz) - z.radius;
        z.group.visible = d < maxDist;
      }
    },
    updateDynamicWorld(elapsed, dt, djPlaying, lighting, timeOfDay) {
      if (timeOfDay !== lastAppliedTod) {
        lastAppliedTod = timeOfDay;
        skyMat.map = timeOfDay === 'night' ? skyNightTex : timeOfDay === 'sunset' ? skySunsetTex : skyDayTex;
        skyMat.needsUpdate = true;
      }

      const isNight = timeOfDay === 'night';
      const isSunset = timeOfDay === 'sunset';
      starMat.opacity = isNight ? 0.85 + Math.sin(elapsed * 2.2) * 0.15 : isSunset ? 0.35 : 0;
      glowPoolMat.opacity = isNight ? 0.52 : isSunset ? 0.28 : 0.06;
      bulbMat.emissiveIntensity = isNight ? 2.4 : isSunset ? 1.7 : 0.8;
      diyaInst.visible = isNight || isSunset;
      fairyInst.visible = true;
      ferrisLedInst.visible = true;

      if (isNight || isSunset) {
        const flicker = 1 + Math.sin(elapsed * 7.5) * 0.08;
        melaNightLights[0].intensity = (isNight ? 28 : 12) * flicker;
        melaNightLights[1].intensity = (isNight ? 24 : 10) * flicker;
        melaNightLights[2].intensity = (isNight ? 24 : 10) * flicker;
        // Cycle Ferris Wheel LED rainbow at night
        const step = Math.floor(elapsed * 4);
        for (let i = 0; i < ferrisLedCount; i++) {
          ferrisLedColor.setHex(ferrisLedPalette[(i + step) % ferrisLedPalette.length]);
          ferrisLedInst.setColorAt(i, ferrisLedColor);
        }
        if (ferrisLedInst.instanceColor) ferrisLedInst.instanceColor.needsUpdate = true;
      } else {
        melaNightLights[0].intensity = 0;
        melaNightLights[1].intensity = 0;
        melaNightLights[2].intensity = 0;
      }
      // Ferris wheel gentle rotation + vertical gondola leveling
      ferrisWheelRotor.rotation.z += dt * 0.18;
      for (const g of ferrisGondolas) {
        g.rotation.z = -ferrisWheelRotor.rotation.z;
      }

      // Merry-Go-Round Carousel gentle rotation + pony bobbing
      carouselRotor.rotation.y += dt * 0.65;
      carouselPonies.forEach((pony, idx) => {
        pony.position.y = 1.4 + Math.sin(elapsed * 3.2 + idx * 1.1) * 0.28;
      });

      // Fountain ripple pulse
      fountainWater.scale.setScalar(1 + Math.sin(elapsed * 2.5) * 0.015);

      // Trampoline spring oscillation
      for (const tr of trampolines.values()) {
        if (Math.abs(tr.bounceOffset) > 0.001 || Math.abs(tr.bounceVelocity) > 0.001) {
          const springForce = -110 * tr.bounceOffset - 9 * tr.bounceVelocity;
          tr.bounceVelocity += springForce * dt;
          tr.bounceOffset += tr.bounceVelocity * dt;
          tr.matMesh.position.y = 0.42 + tr.bounceOffset;
          tr.matMesh.scale.y = Math.max(0.6, 1 + tr.bounceOffset * 1.4);
        } else {
          tr.matMesh.position.y = 0.42;
          tr.matMesh.scale.y = 1;
        }
      }

      // Disco ball spin & party lights
      djDiscoBall.rotation.y += dt * (djPlaying ? 1.8 : 0.4);
      const speedMult = djPlaying ? 3.5 : 0.9;
      djSpotLights.forEach((light, idx) => {
        const phase = elapsed * speedMult + idx * 2.1;
        light.intensity = djPlaying ? 6 + Math.sin(phase * 2) * 3 : 2.5;
        if (lighting === 'disco') {
          light.color.setHSL(((elapsed * 0.25 + idx * 0.33) % 1), 0.95, 0.55);
        } else if (lighting === 'golden') {
          light.color.setHex(idx % 2 === 0 ? 0xfacc15 : 0xf97316);
        } else if (lighting === 'neon_party') {
          light.color.setHex(idx === 0 ? 0x06b6d4 : idx === 1 ? 0xec4899 : 0x8b5cf6);
        } else {
          light.color.setHex(idx === 0 ? 0xf59e0b : idx === 1 ? 0xdc2626 : 0x38bdf8);
        }
      });

      // Dance floor tile glow
      danceFloorTiles.forEach((mat, idx) => {
        const beat = Math.sin(elapsed * (djPlaying ? 7 : 2) + idx * 0.7) * 0.5 + 0.5;
        mat.emissiveIntensity = djPlaying ? 0.2 + beat * 0.65 : 0.15;
      });
    },
    disposeWorld() {
      const disposedGeo = new Set<THREE.BufferGeometry>();
      const disposedMat = new Set<THREE.Material>();
      const disposedTex = new Set<THREE.Texture>();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
          const renderObj = obj as THREE.Mesh | THREE.Points;
          if (renderObj.geometry && !disposedGeo.has(renderObj.geometry)) {
            disposedGeo.add(renderObj.geometry);
            renderObj.geometry.dispose();
          }
          const mats = Array.isArray(renderObj.material) ? renderObj.material : [renderObj.material];
          for (const mat of mats) {
            if (!mat || disposedMat.has(mat)) continue;
            disposedMat.add(mat);
            const std = mat as THREE.MeshStandardMaterial;
            if (std.map && !disposedTex.has(std.map)) {
              disposedTex.add(std.map);
              std.map.dispose();
            }
            mat.dispose();
          }
        }
      });
      for (const extraTex of [skyDayTex, skySunsetTex, skyNightTex, glowTex, shadowTex]) {
        if (!disposedTex.has(extraTex)) {
          disposedTex.add(extraTex);
          extraTex.dispose();
        }
      }
    },
  };
}
