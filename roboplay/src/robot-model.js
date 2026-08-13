import * as THREE from 'three';
import { KINEMATIC_CHAIN, TCP_OFFSET } from './kinematics.js';

const ORANGE = 0xf58b32;
const ORANGE_LIGHT = 0xffad5c;
const DARK = 0x202534;
const METAL = 0x4a5266;

function roundedBox(width, height, depth, color = ORANGE) {
  const geometry = new THREE.BoxGeometry(width, height, depth, 4, 4, 4);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.18 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function jointMesh(radius, depth, axis = 'z') {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 32),
    new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.3, metalness: 0.55 }),
  );
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  return mesh;
}

export class RobotModel {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.joints = [];
    this.axisHelpers = [];
    this.gripperFingers = [];
    this.build();
  }

  build() {
    const baseMaterial = new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.34, metalness: 0.62 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.25, 48), baseMaterial);
    base.position.y = 0.125;
    base.castShadow = true;
    base.receiveShadow = true;
    this.root.add(base);

    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.045, 12, 48),
      new THREE.MeshStandardMaterial({ color: ORANGE_LIGHT, emissive: 0x321306, emissiveIntensity: 0.35 }),
    );
    baseRing.position.y = 0.27;
    baseRing.rotation.x = Math.PI / 2;
    this.root.add(baseRing);

    const j1 = new THREE.Group();
    j1.position.fromArray(KINEMATIC_CHAIN[0].offset);
    j1.add(roundedBox(0.64, 0.68, 0.6));
    j1.children[0].position.y = 0.34;
    this.root.add(j1);
    this.addJoint(j1, 0);

    const j2 = new THREE.Group();
    j2.position.fromArray(KINEMATIC_CHAIN[1].offset);
    j2.add(jointMesh(0.36, 0.72, 'z'));
    const upper = roundedBox(0.36, 1.24, 0.4, ORANGE_LIGHT);
    upper.position.y = 0.7;
    j2.add(upper);
    j1.add(j2);
    this.addJoint(j2, 1);

    const j3 = new THREE.Group();
    j3.position.fromArray(KINEMATIC_CHAIN[2].offset);
    j3.add(jointMesh(0.31, 0.6, 'z'));
    const forearm = roundedBox(0.31, 1.02, 0.34);
    forearm.position.y = 0.58;
    j3.add(forearm);
    j2.add(j3);
    this.addJoint(j3, 2);

    const j4 = new THREE.Group();
    j4.position.fromArray(KINEMATIC_CHAIN[3].offset);
    j4.add(jointMesh(0.25, 0.5, 'y'));
    const wristA = roundedBox(0.28, 0.52, 0.3, ORANGE_LIGHT);
    wristA.position.y = 0.31;
    j4.add(wristA);
    j3.add(j4);
    this.addJoint(j4, 3);

    const j5 = new THREE.Group();
    j5.position.fromArray(KINEMATIC_CHAIN[4].offset);
    j5.add(jointMesh(0.22, 0.44, 'z'));
    const wristB = roundedBox(0.24, 0.42, 0.26);
    wristB.position.y = 0.25;
    j5.add(wristB);
    j4.add(j5);
    this.addJoint(j5, 4);

    const j6 = new THREE.Group();
    j6.position.fromArray(KINEMATIC_CHAIN[5].offset);
    j6.add(jointMesh(0.19, 0.38, 'y'));
    j5.add(j6);
    this.addJoint(j6, 5);

    const tool = roundedBox(0.34, 0.16, 0.3, DARK);
    tool.position.y = 0.2;
    j6.add(tool);
    const fingerMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c2d4, metalness: 0.7, roughness: 0.25 });
    for (const x of [-0.13, 0.13]) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.07), fingerMaterial);
      finger.position.set(x, 0.4, 0);
      finger.castShadow = true;
      j6.add(finger);
      this.gripperFingers.push({ finger, side: Math.sign(x) });
    }

    this.tcp = new THREE.Group();
    this.tcp.position.fromArray(TCP_OFFSET);
    const tcpSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x18a8a2, depthTest: false }),
    );
    tcpSphere.renderOrder = 3;
    const tcpRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.012, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x18a8a2, transparent: true, opacity: 0.75, depthTest: false }),
    );
    tcpRing.rotation.x = Math.PI / 2;
    tcpRing.renderOrder = 3;
    this.tcp.add(tcpSphere, tcpRing);
    this.penTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x7b61ff, roughness: 0.4 }),
    );
    this.penTip.position.y = 0.06;
    this.penTip.visible = false;
    this.tcp.add(this.penTip);
    j6.add(this.tcp);

    this.setAngles([0, -25, 55, 0, 45, 0]);
  }

  addJoint(group, index) {
    this.joints.push({ group, axis: KINEMATIC_CHAIN[index].axis });
    const helper = new THREE.AxesHelper(0.38);
    helper.visible = false;
    helper.renderOrder = 4;
    helper.material.depthTest = false;
    group.add(helper);
    this.axisHelpers.push(helper);
  }

  setAxesVisible(visible) {
    this.axisHelpers.forEach((helper) => { helper.visible = visible; });
  }

  setAngles(angles) {
    this.joints.forEach(({ group, axis }, index) => {
      group.rotation[axis] = THREE.MathUtils.degToRad(angles[index]);
    });
  }

  setGripperOpenAmount(amount) {
    const opening = THREE.MathUtils.clamp(amount, 0, 1);
    this.gripperFingers.forEach(({ finger, side }) => {
      finger.position.x = side * THREE.MathUtils.lerp(0.065, 0.13, opening);
    });
  }

  setPenDown(down) {
    this.penTip.visible = down;
  }
}
