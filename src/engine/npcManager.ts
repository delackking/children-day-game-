import * as THREE from 'three';
import { CARNIVAL_NPCS, type NpcDefinition } from '../shared/catalog';
import { createNameTagTexture, createRadialShadowTexture } from './textures';

export interface ActiveNpc {
  def: NpcDefinition;
  group: THREE.Group;
  head: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  patrolT: number;
  dialogueIndex: number;
  isVendor?: boolean;
  vendorGreeting?: string;
}

const NPC_SHARED = {
  shadowGeo: new THREE.CircleGeometry(0.42, 12),
  torsoGeo: new THREE.CylinderGeometry(0.22, 0.24, 0.56, 10),
  headGeo: new THREE.SphereGeometry(0.22, 12, 10),
  eyeGeo: new THREE.SphereGeometry(0.025, 6, 6),
  hatGeo: new THREE.CylinderGeometry(0.22, 0.24, 0.14, 10),
  armGeo: new THREE.CylinderGeometry(0.06, 0.05, 0.45, 8),
  legGeo: new THREE.CylinderGeometry(0.075, 0.065, 0.58, 8),
  skinMat: new THREE.MeshStandardMaterial({ color: '#D89A6C', roughness: 0.7 }),
  pantMat: new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.8 }),
  eyeMat: new THREE.MeshStandardMaterial({ color: '#0F172A' }),
};

const npcMatCache = new Map<string, THREE.MeshStandardMaterial>();
let npcShadowMat: THREE.MeshBasicMaterial | null = null;
function getNpcStdMat(color: string, roughness: number): THREE.MeshStandardMaterial {
  const key = `${color}_${roughness}`;
  let m = npcMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness });
    npcMatCache.set(key, m);
  }
  return m;
}

export function createNpcMesh(
  name: string,
  roleLabel: string,
  shirtColor: string,
  hatColor: string,
  shadowTex: THREE.CanvasTexture,
): {
  group: THREE.Group;
  head: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
} {
  const group = new THREE.Group();
  if (!npcShadowMat) {
    npcShadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false });
  }

  const shadow = new THREE.Mesh(NPC_SHARED.shadowGeo, npcShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  const shirtMat = getNpcStdMat(shirtColor, 0.75);

  const torso = new THREE.Mesh(NPC_SHARED.torsoGeo, shirtMat);
  torso.position.y = 0.94;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Group();
  head.position.y = 1.44;
  group.add(head);

  const headBall = new THREE.Mesh(NPC_SHARED.headGeo, NPC_SHARED.skinMat);
  headBall.castShadow = true;
  head.add(headBall);

  for (const sx of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(NPC_SHARED.eyeGeo, NPC_SHARED.eyeMat);
    eye.position.set(sx, 0.02, 0.195);
    head.add(eye);
  }

  const hat = new THREE.Mesh(NPC_SHARED.hatGeo, getNpcStdMat(hatColor, 0.6));
  hat.position.y = 0.17;
  head.add(hat);

  const makeArm = (side: -1 | 1) => {
    const p = new THREE.Group();
    p.position.set(side * 0.27, 1.15, 0);
    const arm = new THREE.Mesh(NPC_SHARED.armGeo, shirtMat);
    arm.position.y = -0.22;
    p.add(arm);
    group.add(p);
    return p;
  };
  const leftArm = makeArm(-1);
  leftArm.rotation.z = 0.08;
  const rightArm = makeArm(1);
  rightArm.rotation.z = -0.08;

  const makeLeg = (side: -1 | 1) => {
    const p = new THREE.Group();
    p.position.set(side * 0.1, 0.65, 0);
    const leg = new THREE.Mesh(NPC_SHARED.legGeo, NPC_SHARED.pantMat);
    leg.position.y = -0.29;
    p.add(leg);
    group.add(p);
    return p;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createNameTagTexture(name, roleLabel, null),
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.position.set(0, 2.02, 0);
  sprite.scale.set(1.5, 0.55, 1);
  group.add(sprite);

  return { group, head, rightArm, leftLeg, rightLeg };
}

export class NpcManager {
  npcs: ActiveNpc[] = [];
  private shadowTex: THREE.CanvasTexture;

  constructor() {
    this.shadowTex = createRadialShadowTexture();
  }

  spawnRoamers(scene: THREE.Scene): void {
    const roleMap: Record<NpcDefinition['role'], string> = {
      security: 'SECURITY',
      welcome: 'WELCOME',
      ticket: 'TICKETS',
      game_op: 'ARCADE',
      announcer: 'STAGE MC',
      decorator: 'GUIDE',
    };

    for (const def of CARNIVAL_NPCS) {
      const built = createNpcMesh(def.name, roleMap[def.role], def.shirtColor, def.hatColor, this.shadowTex);
      built.group.position.set(def.x, 0, def.z);
      scene.add(built.group);
      this.npcs.push({
        def,
        ...built,
        patrolT: Math.random() * Math.PI * 2,
        dialogueIndex: 0,
      });
    }
  }

  registerVendorNpc(
    name: string,
    greeting: string,
    group: THREE.Group,
    head: THREE.Object3D,
    rightArm: THREE.Object3D,
    leftLeg: THREE.Object3D,
    rightLeg: THREE.Object3D,
    x: number,
    z: number,
  ): void {
    this.npcs.push({
      def: {
        id: `vendor_${name}`,
        name,
        role: 'welcome',
        zone: 'food_street',
        x,
        z,
        shirtColor: '#F59E0B',
        hatColor: '#DC2626',
        dialogue: [greeting],
      },
      group,
      head,
      rightArm,
      leftLeg,
      rightLeg,
      patrolT: 0,
      dialogueIndex: 0,
      isVendor: true,
      vendorGreeting: greeting,
    });
  }

  update(dt: number, elapsed: number, playerX: number, playerZ: number): void {
    for (const npc of this.npcs) {
      const d = Math.hypot(playerX - npc.group.position.x, playerZ - npc.group.position.z);
      if (d > 48 && npc.isVendor) continue;

      if (!npc.isVendor && npc.def.patrolX !== undefined && npc.def.patrolZ !== undefined && d > 5.5) {
        npc.patrolT += dt * 0.45;
        const alpha = (Math.sin(npc.patrolT) + 1) * 0.5;
        const nx = THREE.MathUtils.lerp(npc.def.x, npc.def.patrolX, alpha);
        const nz = THREE.MathUtils.lerp(npc.def.z, npc.def.patrolZ, alpha);
        const dx = nx - npc.group.position.x;
        const dz = nz - npc.group.position.z;
        if (Math.hypot(dx, dz) > 0.002) {
          npc.group.rotation.y = Math.atan2(dx, dz);
        }
        npc.group.position.set(nx, 0, nz);
        if (d < 46) {
          const swing = Math.sin(elapsed * 6) * 0.45;
          npc.leftLeg.rotation.x = swing;
          npc.rightLeg.rotation.x = -swing;
        }
      } else {
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
      }

      // Face nearby visitor & wave warmly
      if (d < 6.5) {
        const targetYaw = Math.atan2(playerX - npc.group.position.x, playerZ - npc.group.position.z);
        if (!npc.isVendor) {
          npc.group.rotation.y = targetYaw;
        }
        npc.rightArm.rotation.x = -2.2;
        npc.rightArm.rotation.z = -0.3 + Math.sin(elapsed * 6) * 0.25;
      } else if (d < 36) {
        npc.rightArm.rotation.x = THREE.MathUtils.lerp(npc.rightArm.rotation.x, 0, 1 - Math.exp(-8 * dt));
        npc.rightArm.rotation.z = -0.08;
      }
    }
  }
}
