import * as THREE from 'three';
import type { ActiveConsumeState, AvatarConfig, DanceId } from '../shared/types';
import { createNameTagTexture, createRadialShadowTexture } from './textures';

let sharedShadowTex: THREE.CanvasTexture | null = null;
let sharedShadowMat: THREE.MeshBasicMaterial | null = null;
function getShadowMat(): THREE.MeshBasicMaterial {
  if (!sharedShadowTex) sharedShadowTex = createRadialShadowTexture();
  if (!sharedShadowMat) {
    sharedShadowMat = new THREE.MeshBasicMaterial({
      map: sharedShadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
  }
  return sharedShadowMat;
}

const sharedStdMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getAvatarMat(
  color: string | number,
  roughness: number,
  metalness = 0,
  transparent = false,
  opacity = 1,
): THREE.MeshStandardMaterial {
  const key = `${String(color)}_${roughness}_${metalness}_${transparent}_${opacity}`;
  let m = sharedStdMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity });
    sharedStdMatCache.set(key, m);
  }
  return m;
}

const AVATAR_SHARED = {
  shadowCircle: new THREE.CircleGeometry(0.45, 12),
  torsoKurta: new THREE.CylinderGeometry(0.22, 0.26, 0.56, 10),
  torsoTee: new THREE.CylinderGeometry(0.22, 0.21, 0.56, 10),
  vest: new THREE.CylinderGeometry(0.235, 0.25, 0.48, 10),
  sash: new THREE.CylinderGeometry(0.23, 0.25, 0.1, 10),
  hood: new THREE.TorusGeometry(0.18, 0.055, 6, 10),
  btn: new THREE.SphereGeometry(0.022, 6, 6),
  head: new THREE.SphereGeometry(0.23, 12, 10),
  eyeWhite: new THREE.SphereGeometry(0.036, 6, 6),
  eye: new THREE.SphereGeometry(0.022, 6, 6),
  cheek: new THREE.SphereGeometry(0.032, 6, 6),
  smile: new THREE.TorusGeometry(0.055, 0.012, 6, 8, Math.PI),
  collar: new THREE.TorusGeometry(0.16, 0.032, 6, 10),
  sleeve: new THREE.CylinderGeometry(0.068, 0.06, 0.26, 8),
  forearm: new THREE.CylinderGeometry(0.054, 0.048, 0.22, 8),
  hand: new THREE.SphereGeometry(0.058, 8, 6),
  leg: new THREE.CylinderGeometry(0.082, 0.068, 0.56, 8),
  shoe: new THREE.BoxGeometry(0.135, 0.095, 0.23),
  sole: new THREE.BoxGeometry(0.145, 0.03, 0.24),
  hairCapShort: new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hairPuff: new THREE.SphereGeometry(0.27, 12, 8),
  hairTop: new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
  hairBraid: new THREE.CylinderGeometry(0.05, 0.035, 0.34, 6),
  hairWave: new THREE.BoxGeometry(0.28, 0.09, 0.18),
  hairBun: new THREE.SphereGeometry(0.11, 8, 6),
  lens: new THREE.BoxGeometry(0.11, 0.065, 0.03),
  bridge: new THREE.BoxGeometry(0.24, 0.018, 0.025),
  capDome: new THREE.SphereGeometry(0.245, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
  visor: new THREE.BoxGeometry(0.26, 0.025, 0.18),
  watch: new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8),
  band: new THREE.CylinderGeometry(0.058, 0.058, 0.035, 8),
  foodPlate: new THREE.CylinderGeometry(0.18, 0.14, 0.025, 10),
  foodSphere: new THREE.SphereGeometry(0.1, 8, 6),
  foodBox: new THREE.BoxGeometry(0.1, 0.05, 0.08),
  foodShell: new THREE.CylinderGeometry(0.052, 0.055, 0.24, 8),
  foodCap: new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6),
  foodPacket: new THREE.BoxGeometry(0.16, 0.2, 0.06),
  foodStripe: new THREE.BoxGeometry(0.165, 0.05, 0.065),
  foodCone: new THREE.ConeGeometry(0.055, 0.16, 8),
  eyeWhiteMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.2 }),
  eyeMat: new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.15 }),
  cheekMat: new THREE.MeshStandardMaterial({ color: '#FB7185', roughness: 0.7 }),
  smileMat: new THREE.MeshStandardMaterial({ color: '#991B1B', roughness: 0.4 }),
  soleMat: new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.5 }),
  goldMat: new THREE.MeshStandardMaterial({ color: '#FACC15', metalness: 0.8, roughness: 0.25 }),
};

export interface AvatarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  heldFoodGroup: THREE.Group;
  nameSprite: THREE.Sprite;
  configHash: string;
  tagHash: string;
  consumeHash: string;
  gaitPhase: number;
}

function makeHairMesh(hairstyle: AvatarConfig['hairstyle'], hairMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  if (hairstyle === 'classic_short') {
    const cap = new THREE.Mesh(AVATAR_SHARED.hairCapShort, hairMat);
    cap.position.y = 0.03;
    g.add(cap);
  } else if (hairstyle === 'curly_puff') {
    const puff = new THREE.Mesh(AVATAR_SHARED.hairPuff, hairMat);
    puff.position.set(0, 0.08, -0.02);
    puff.scale.set(1.05, 0.9, 1.05);
    g.add(puff);
  } else if (hairstyle === 'twin_braids') {
    const top = new THREE.Mesh(AVATAR_SHARED.hairTop, hairMat);
    top.position.y = 0.02;
    g.add(top);
    for (const side of [-1, 1]) {
      const braid = new THREE.Mesh(AVATAR_SHARED.hairBraid, hairMat);
      braid.position.set(side * 0.22, -0.1, -0.04);
      braid.rotation.z = side * 0.18;
      g.add(braid);
    }
  } else if (hairstyle === 'side_part') {
    const cap = new THREE.Mesh(AVATAR_SHARED.hairCapShort, hairMat);
    cap.position.y = 0.03;
    g.add(cap);
    const wave = new THREE.Mesh(AVATAR_SHARED.hairWave, hairMat);
    wave.position.set(0.05, 0.2, 0.1);
    wave.rotation.z = -0.18;
    g.add(wave);
  } else {
    const cap = new THREE.Mesh(AVATAR_SHARED.hairTop, hairMat);
    cap.position.y = 0.02;
    g.add(cap);
    const bun = new THREE.Mesh(AVATAR_SHARED.hairBun, hairMat);
    bun.position.set(0, 0.27, -0.04);
    g.add(bun);
  }
  return g;
}

function buildHeldFoodMesh(consuming: ActiveConsumeState): THREE.Group {
  const g = new THREE.Group();
  const ratio = Math.max(0.2, consuming.bitesRemaining / Math.max(1, consuming.maxBites));

  if (consuming.visualType === 'plate') {
    const plate = new THREE.Mesh(AVATAR_SHARED.foodPlate, getAvatarMat(0xf8fafc, 0.25, 0.1));
    g.add(plate);

    const food = new THREE.Mesh(AVATAR_SHARED.foodSphere, getAvatarMat(consuming.primaryColor, 0.75));
    food.scale.set(1.2 * ratio, 0.55 * ratio, 1.2 * ratio);
    food.position.y = 0.035;
    g.add(food);

    const side = new THREE.Mesh(AVATAR_SHARED.foodBox, getAvatarMat(consuming.secondaryColor, 0.8));
    side.scale.set(ratio, 0.9, 1);
    side.position.set(0.06, 0.035, 0.03);
    g.add(side);
  } else if (consuming.visualType === 'bottle' || consuming.visualType === 'cup') {
    const shell = new THREE.Mesh(AVATAR_SHARED.foodShell, getAvatarMat(0xe2e8f0, 0.12, 0, true, 0.55));
    shell.position.y = 0.12;
    g.add(shell);

    const liquid = new THREE.Mesh(AVATAR_SHARED.foodShell, getAvatarMat(consuming.primaryColor, 0.2));
    liquid.scale.set(0.84, 0.8 * ratio, 0.84);
    liquid.position.y = 0.02 + 0.095 * ratio;
    g.add(liquid);

    const cap = new THREE.Mesh(AVATAR_SHARED.foodCap, getAvatarMat(consuming.secondaryColor, 0.35));
    cap.position.y = 0.25;
    g.add(cap);
  } else if (consuming.visualType === 'packet') {
    const pkt = new THREE.Mesh(AVATAR_SHARED.foodPacket, getAvatarMat(consuming.primaryColor, 0.45));
    pkt.scale.set(1, 0.55 + 0.45 * ratio, 0.4 + 0.6 * ratio);
    pkt.position.y = 0.11;
    g.add(pkt);
    const stripe = new THREE.Mesh(AVATAR_SHARED.foodStripe, getAvatarMat(consuming.secondaryColor, 0.4));
    stripe.position.y = 0.12;
    g.add(stripe);
  } else if (consuming.visualType === 'cone' || consuming.visualType === 'floss' || consuming.visualType === 'firework') {
    const cone = new THREE.Mesh(AVATAR_SHARED.foodCone, getAvatarMat(consuming.secondaryColor, 0.8));
    cone.rotation.x = consuming.visualType === 'firework' ? 0 : Math.PI;
    cone.position.y = consuming.visualType === 'firework' ? 0.18 : 0.06;
    g.add(cone);

    const scoop = new THREE.Mesh(AVATAR_SHARED.foodSphere, getAvatarMat(consuming.primaryColor, 0.7));
    scoop.scale.setScalar(0.85 * ratio + 0.15);
    scoop.position.y = consuming.visualType === 'firework' ? 0.06 : 0.16;
    g.add(scoop);
  } else {
    const sweet = new THREE.Mesh(AVATAR_SHARED.foodSphere, getAvatarMat(consuming.primaryColor, 0.55));
    sweet.scale.setScalar(0.8 * ratio + 0.2);
    sweet.position.y = 0.07;
    g.add(sweet);
  }

  return g;
}

export function createAvatarRig(config: AvatarConfig, name: string, isHost: boolean): AvatarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Contact shadow disc grounded at y = 0.015 (shared material across all avatars)
  const shadow = new THREE.Mesh(AVATAR_SHARED.shadowCircle, getShadowMat());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  root.add(shadow);

  const rig: AvatarRig = {
    root,
    bodyGroup,
    headGroup: new THREE.Group(),
    leftArmPivot: new THREE.Group(),
    rightArmPivot: new THREE.Group(),
    leftLegPivot: new THREE.Group(),
    rightLegPivot: new THREE.Group(),
    heldFoodGroup: new THREE.Group(),
    nameSprite: new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createNameTagTexture(name, isHost ? '★ HOST' : null, null),
        transparent: true,
        depthWrite: false,
      }),
    ),
    configHash: '',
    tagHash: `${name}_${isHost}_`,
    consumeHash: '',
    gaitPhase: 0,
  };

  rig.nameSprite.position.set(0, 2.08, 0);
  rig.nameSprite.scale.set(1.65, 0.62, 1);
  root.add(rig.nameSprite);

  rebuildAvatarMeshes(rig, config);
  return rig;
}

export function rebuildAvatarMeshes(rig: AvatarRig, config: AvatarConfig): void {
  const hash = JSON.stringify(config);
  if (rig.configHash === hash) return;
  rig.configHash = hash;

  while (rig.bodyGroup.children.length > 0) {
    rig.bodyGroup.remove(rig.bodyGroup.children[0]);
  }

  const skinMat = getAvatarMat(config.skinTone, 0.68);
  const topMat = getAvatarMat(config.topColor, 0.72);
  const bottomMat = getAvatarMat(config.bottomColor, 0.78);
  const hairMat = getAvatarMat(config.hairColor, 0.85);
  const shoeMat = getAvatarMat(config.accessories.includes('sneakers') ? '#38BDF8' : '#334155', 0.4);

  const isKurta =
    config.outfit.startsWith('kurta') || config.outfit === 'nehru_royal' || config.outfit === 'sherwani_festive';

  const torso = new THREE.Mesh(
    isKurta ? AVATAR_SHARED.torsoKurta : AVATAR_SHARED.torsoTee,
    topMat,
  );
  torso.position.y = 0.94;
  torso.castShadow = true;
  rig.bodyGroup.add(torso);

  const collar = new THREE.Mesh(
    AVATAR_SHARED.collar,
    isKurta ? AVATAR_SHARED.goldMat : topMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.21;
  rig.bodyGroup.add(collar);

  if (config.outfit === 'nehru_royal' || config.outfit === 'sherwani_festive') {
    const vest = new THREE.Mesh(
      AVATAR_SHARED.vest,
      getAvatarMat(config.outfit === 'sherwani_festive' ? '#92400E' : '#1E293B', 0.55),
    );
    vest.position.y = 0.95;
    rig.bodyGroup.add(vest);

    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(AVATAR_SHARED.btn, AVATAR_SHARED.goldMat);
      btn.position.set(0, 1.08 - i * 0.11, 0.245);
      rig.bodyGroup.add(btn);
    }
  } else if (config.outfit === 'kurta_printed') {
    const sash = new THREE.Mesh(AVATAR_SHARED.sash, getAvatarMat('#FDE047', 0.6));
    sash.position.y = 0.74;
    rig.bodyGroup.add(sash);
  } else if (config.outfit === 'hoodie_sky') {
    const hood = new THREE.Mesh(AVATAR_SHARED.hood, topMat);
    hood.rotation.x = Math.PI / 2;
    hood.position.set(0, 1.2, -0.05);
    rig.bodyGroup.add(hood);
  }

  // Head group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.44, 0);
  rig.headGroup = headGroup;
  rig.bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(AVATAR_SHARED.head, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Expressive Eyes & Rosy Cheeks
  for (const sx of [-0.08, 0.08]) {
    const sclera = new THREE.Mesh(AVATAR_SHARED.eyeWhite, AVATAR_SHARED.eyeWhiteMat);
    sclera.position.set(sx, 0.02, 0.195);
    sclera.scale.set(1, 1.15, 0.5);
    headGroup.add(sclera);

    const eye = new THREE.Mesh(AVATAR_SHARED.eye, AVATAR_SHARED.eyeMat);
    eye.position.set(sx, 0.02, 0.212);
    headGroup.add(eye);

    const cheek = new THREE.Mesh(AVATAR_SHARED.cheek, AVATAR_SHARED.cheekMat);
    cheek.position.set(sx * 1.55, -0.04, 0.192);
    cheek.scale.set(1, 0.65, 0.45);
    headGroup.add(cheek);
  }

  // Smile
  const smile = new THREE.Mesh(AVATAR_SHARED.smile, AVATAR_SHARED.smileMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.055, 0.212);
  headGroup.add(smile);

  // Hair
  headGroup.add(makeHairMesh(config.hairstyle, hairMat));

  // Accessories: Sunglasses & Cap (reusing pooled geometries & materials)
  if (config.accessories.includes('sunglasses')) {
    const frameMat = AVATAR_SHARED.eyeMat;
    const lensMat = getAvatarMat('#0284C7', 0.1, 0.8);
    for (const sx of [-0.08, 0.08]) {
      const lens = new THREE.Mesh(AVATAR_SHARED.lens, lensMat);
      lens.position.set(sx, 0.02, 0.225);
      headGroup.add(lens);
    }
    const bridge = new THREE.Mesh(AVATAR_SHARED.bridge, frameMat);
    bridge.position.set(0, 0.04, 0.225);
    headGroup.add(bridge);
  }

  if (config.accessories.includes('cap')) {
    const capDome = new THREE.Mesh(AVATAR_SHARED.capDome, getAvatarMat('#DC2626', 0.6));
    capDome.position.y = 0.05;
    headGroup.add(capDome);
    const visor = new THREE.Mesh(AVATAR_SHARED.visor, getAvatarMat('#FACC15', 0.5));
    visor.position.set(0, 0.08, 0.2);
    headGroup.add(visor);
  }

  // Arms
  const makeArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 1.15, 0);
    const sleeve = new THREE.Mesh(AVATAR_SHARED.sleeve, topMat);
    sleeve.position.y = -0.13;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const forearm = new THREE.Mesh(AVATAR_SHARED.forearm, skinMat);
    forearm.position.y = -0.35;
    pivot.add(forearm);

    const hand = new THREE.Mesh(AVATAR_SHARED.hand, skinMat);
    hand.position.y = -0.47;
    pivot.add(hand);

    if (side === -1 && config.accessories.includes('watch')) {
      const watch = new THREE.Mesh(AVATAR_SHARED.watch, AVATAR_SHARED.goldMat);
      watch.position.y = -0.4;
      pivot.add(watch);
    }
    if (side === 1 && config.accessories.includes('bracelet')) {
      const band = new THREE.Mesh(AVATAR_SHARED.band, getAvatarMat('#EC4899', 0.4));
      band.position.y = -0.41;
      pivot.add(band);
    }
    return pivot;
  };

  rig.leftArmPivot = makeArm(-1);
  rig.rightArmPivot = makeArm(1);
  rig.bodyGroup.add(rig.leftArmPivot);
  rig.bodyGroup.add(rig.rightArmPivot);

  // Held food socket attached to right hand
  rig.heldFoodGroup = new THREE.Group();
  rig.heldFoodGroup.position.set(0, -0.48, 0.14);
  rig.rightArmPivot.add(rig.heldFoodGroup);

  // Legs
  const makeLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, 0.66, 0);
    const leg = new THREE.Mesh(AVATAR_SHARED.leg, bottomMat);
    leg.position.y = -0.28;
    leg.castShadow = true;
    pivot.add(leg);

    const shoe = new THREE.Mesh(AVATAR_SHARED.shoe, shoeMat);
    shoe.position.set(0, -0.59, 0.04);
    shoe.castShadow = true;
    pivot.add(shoe);

    const sole = new THREE.Mesh(AVATAR_SHARED.sole, AVATAR_SHARED.soleMat);
    sole.position.set(0, -0.64, 0.04);
    pivot.add(sole);
    return pivot;
  };

  rig.leftLegPivot = makeLeg(-1);
  rig.rightLegPivot = makeLeg(1);
  rig.bodyGroup.add(rig.leftLegPivot);
  rig.bodyGroup.add(rig.rightLegPivot);
}

export function disposeAvatarRig(rig: AvatarRig): void {
  const mat = rig.nameSprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
}

export function updateAvatarAppearanceAndState(
  rig: AvatarRig,
  params: {
    name: string;
    isHost: boolean;
    bubbleText: string | null;
    bubbleAt: number;
    consuming: ActiveConsumeState | null;
    avatar: AvatarConfig;
  },
): void {
  rebuildAvatarMeshes(rig, params.avatar);

  // Show speech bubble for 6 seconds after chat
  const showBubble = params.bubbleText && Date.now() - params.bubbleAt < 6500 ? params.bubbleText : null;
  const tagKey = `${params.name}_${params.isHost}_${showBubble ?? ''}`;
  if (rig.tagHash !== tagKey) {
    rig.tagHash = tagKey;
    const mat = rig.nameSprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = createNameTagTexture(params.name, params.isHost ? '★ HOST' : null, showBubble);
    mat.needsUpdate = true;
  }

  // Update held food mesh when eating/drinking
  const cKey = params.consuming ? `${params.consuming.itemId}_${params.consuming.bitesRemaining}` : 'none';
  if (rig.consumeHash !== cKey) {
    rig.consumeHash = cKey;
    while (rig.heldFoodGroup.children.length > 0) {
      rig.heldFoodGroup.remove(rig.heldFoodGroup.children[0]);
    }
    if (params.consuming) {
      rig.heldFoodGroup.add(buildHeldFoodMesh(params.consuming));
    }
  }
}

export function animateAvatarRig(
  rig: AvatarRig,
  dt: number,
  elapsed: number,
  state: { speed: number; isJumping: boolean; dance: DanceId; hasConsuming: boolean; holdingBall?: boolean },
): void {
  const { speed, isJumping, dance, hasConsuming, holdingBall } = state;

  // Reset base transforms smoothly
  let targetBodyY = 0;
  let targetBodyRotZ = 0;
  let targetBodyRotY = 0;
  let lLegX = 0;
  let rLegX = 0;
  let lArmX = 0;
  let rArmX = 0;
  let lArmZ = 0.08;
  let rArmZ = -0.08;

  if (isJumping) {
    lArmX = -2.4;
    rArmX = -2.4;
    lLegX = 0.35;
    rLegX = -0.35;
  } else if (speed > 0.25) {
    rig.gaitPhase += dt * (speed > 6.5 ? 12 : 8.5);
    const swing = Math.sin(rig.gaitPhase) * (speed > 6.5 ? 0.85 : 0.55);
    lLegX = swing;
    rLegX = -swing;
    lArmX = -swing * 0.85;
    rArmX = hasConsuming ? -1.1 : swing * 0.85;
    targetBodyY = Math.abs(Math.cos(rig.gaitPhase)) * 0.05;
  } else if (dance !== 'none') {
    const t = elapsed * 5.2;
    switch (dance) {
      case 'normal_dance':
        targetBodyY = Math.abs(Math.sin(t * 1.4)) * 0.14;
        lArmX = -1.9 + Math.sin(t) * 0.4;
        rArmX = -1.9 - Math.sin(t) * 0.4;
        lLegX = Math.sin(t) * 0.35;
        rLegX = -Math.sin(t) * 0.35;
        break;
      case 'funny_dance':
        targetBodyRotZ = Math.sin(t * 1.6) * 0.22;
        lArmZ = 1.2 + Math.sin(t * 2) * 0.5;
        rArmZ = -1.2 - Math.sin(t * 2) * 0.5;
        break;
      case 'celebration':
      case 'victory_dance':
        targetBodyY = Math.abs(Math.sin(t * 1.8)) * 0.22;
        targetBodyRotY = (elapsed * 3.5) % (Math.PI * 2);
        lArmX = -2.6;
        rArmX = -2.6;
        break;
      case 'jump_dance':
        targetBodyY = Math.max(0, Math.sin(t * 1.7)) * 0.32;
        lArmX = -2.1;
        rArmX = -2.1;
        break;
      case 'robot_dance': {
        const snap = Math.round(Math.sin(t) * 2) / 2;
        lArmX = -1.4 * snap;
        rArmX = 1.4 * snap;
        targetBodyRotZ = snap * 0.12;
        break;
      }
      case 'wave':
        rArmX = -2.5;
        rArmZ = -0.3 + Math.sin(t * 1.6) * 0.35;
        break;
      case 'clap':
        lArmX = -1.2;
        rArmX = -1.2;
        lArmZ = -0.35 + Math.abs(Math.sin(t * 2.2)) * 0.25;
        rArmZ = 0.35 - Math.abs(Math.sin(t * 2.2)) * 0.25;
        break;
      case 'laugh':
        targetBodyY = Math.sin(t * 3) * 0.05;
        rig.headGroup.rotation.x = -0.18 + Math.sin(t * 3) * 0.1;
        break;
      case 'sit':
        targetBodyY = -0.35;
        lLegX = -1.35;
        rLegX = -1.35;
        break;
      case 'cheer':
        targetBodyY = Math.abs(Math.sin(t * 1.5)) * 0.12;
        lArmX = -2.4 + Math.sin(t * 2) * 0.3;
        rArmX = -2.4 - Math.sin(t * 2) * 0.3;
        break;
    }
  } else {
    // Gentle breathing idle
    targetBodyY = Math.sin(elapsed * 2.1) * 0.015;
    rig.headGroup.rotation.x = Math.sin(elapsed * 1.4) * 0.03;
  }

  if (holdingBall) {
    // Both arms reach forward & inward to hold/cradle the sports ball in hands
    lArmX = -1.18;
    rArmX = -1.18;
    lArmZ = -0.22;
    rArmZ = 0.22;
  } else if (hasConsuming) {
    // Bring right hand food/drink toward mouth
    rArmX = -1.25 + Math.sin(elapsed * 6.5) * 0.28;
    rArmZ = 0.25;
  }

  const damp = 1 - Math.exp(-14 * dt);
  rig.bodyGroup.position.y = THREE.MathUtils.lerp(rig.bodyGroup.position.y, targetBodyY, damp);
  rig.bodyGroup.rotation.z = THREE.MathUtils.lerp(rig.bodyGroup.rotation.z, targetBodyRotZ, damp);
  rig.bodyGroup.rotation.y = dance === 'celebration' || dance === 'victory_dance'
    ? targetBodyRotY
    : THREE.MathUtils.lerp(rig.bodyGroup.rotation.y, 0, damp);
  rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.x, lLegX, damp);
  rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.x, rLegX, damp);
  rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.x, lArmX, damp);
  rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.x, rArmX, damp);
  rig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.z, lArmZ, damp);
  rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.z, rArmZ, damp);
}
