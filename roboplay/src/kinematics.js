import * as THREE from 'three';

export const KINEMATIC_CHAIN = [
  { axis: 'y', offset: [0, 0.28, 0] },
  { axis: 'z', offset: [0, 0.72, 0] },
  { axis: 'z', offset: [0, 1.32, 0] },
  { axis: 'y', offset: [0, 1.08, 0] },
  { axis: 'z', offset: [0, 0.58, 0] },
  { axis: 'y', offset: [0, 0.48, 0] },
];

export const TCP_OFFSET = [0, 0.58, 0];
export const MODEL_UNIT_MM = 400;
export const JOINT_LIMITS = [
  [-170, 170],
  [-95, 95],
  [-135, 135],
  [-180, 180],
  [-120, 120],
  [-180, 180],
];

const axisVector = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function transformForJoint(definition, degrees) {
  const translation = new THREE.Matrix4().makeTranslation(...definition.offset);
  const rotation = new THREE.Matrix4().makeRotationAxis(
    axisVector[definition.axis],
    THREE.MathUtils.degToRad(degrees),
  );
  return translation.multiply(rotation);
}

export function forwardKinematics(angles) {
  if (!Array.isArray(angles) || angles.length !== KINEMATIC_CHAIN.length) {
    throw new Error('Forward kinematics requires exactly six joint angles.');
  }

  const transform = new THREE.Matrix4();
  const jointFrames = [];
  KINEMATIC_CHAIN.forEach((definition, index) => {
    transform.multiply(transformForJoint(definition, angles[index]));
    jointFrames.push(transform.clone());
  });

  const tcpTransform = transform.clone().multiply(new THREE.Matrix4().makeTranslation(...TCP_OFFSET));
  const position = new THREE.Vector3().setFromMatrixPosition(tcpTransform);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(tcpTransform).normalize();
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');

  return {
    position: { x: position.x, y: position.y, z: position.z },
    positionMm: {
      x: position.x * MODEL_UNIT_MM,
      y: position.y * MODEL_UNIT_MM,
      z: position.z * MODEL_UNIT_MM,
    },
    orientation: {
      roll: THREE.MathUtils.radToDeg(euler.x),
      pitch: THREE.MathUtils.radToDeg(euler.y),
      yaw: THREE.MathUtils.radToDeg(euler.z),
    },
    quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
    jointFrames: jointFrames.map((matrix) => matrix.toArray()),
    matrix: tcpTransform.toArray(),
  };
}

export function formatJointProgram(angles) {
  return angles
    .map((angle, index) => `robot.move_joint(${index + 1}, ${Number(angle.toFixed(1))})`)
    .join('\n');
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function positionVector(angles) {
  const { position } = forwardKinematics(angles);
  return new THREE.Vector3(position.x, position.y, position.z);
}

function solveFromSeed(target, seed, options) {
  const angles = seed.map((angle, index) => clamp(angle, ...JOINT_LIMITS[index]));
  const epsilon = 1e-4;
  const epsilonDegrees = THREE.MathUtils.radToDeg(epsilon);
  let best = { angles: [...angles], error: Infinity };

  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    const current = positionVector(angles);
    const errorVector = target.clone().sub(current);
    const error = errorVector.length();
    if (error < best.error) best = { angles: [...angles], error };
    if (error <= options.tolerance) {
      return { success: true, angles, errorMm: error * MODEL_UNIT_MM, iterations: iteration };
    }

    const jacobian = [[], [], []];
    for (let joint = 0; joint < angles.length; joint += 1) {
      const perturbed = [...angles];
      perturbed[joint] += epsilonDegrees;
      const displaced = positionVector(perturbed).sub(current).multiplyScalar(1 / epsilon);
      jacobian[0][joint] = displaced.x;
      jacobian[1][joint] = displaced.y;
      jacobian[2][joint] = displaced.z;
    }

    const a = [[], [], []];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        a[row][column] = jacobian[row].reduce(
          (sum, value, joint) => sum + value * jacobian[column][joint],
          row === column ? options.damping ** 2 : 0,
        );
      }
    }

    const inverse = new THREE.Matrix3().set(
      a[0][0], a[0][1], a[0][2],
      a[1][0], a[1][1], a[1][2],
      a[2][0], a[2][1], a[2][2],
    ).invert();
    const correction = errorVector.clone().applyMatrix3(inverse);
    const delta = angles.map((_, joint) => (
      jacobian[0][joint] * correction.x
      + jacobian[1][joint] * correction.y
      + jacobian[2][joint] * correction.z
    ));
    const largestStep = Math.max(...delta.map(Math.abs));
    const scale = largestStep > options.maxStep ? options.maxStep / largestStep : 1;
    angles.forEach((angle, joint) => {
      angles[joint] = clamp(
        angle + THREE.MathUtils.radToDeg(delta[joint] * scale),
        ...JOINT_LIMITS[joint],
      );
    });
  }

  return { success: false, angles: best.angles, errorMm: best.error * MODEL_UNIT_MM, iterations: options.maxIterations };
}

export function inverseKinematics(targetMm, initialAngles, configuration = {}) {
  const values = ['x', 'y', 'z'].map((axis) => Number(targetMm?.[axis]));
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Inverse kinematics requires finite X, Y, and Z coordinates.');
  }
  if (!Array.isArray(initialAngles) || initialAngles.length !== 6) {
    throw new Error('Inverse kinematics requires six initial joint angles.');
  }

  const options = {
    maxIterations: configuration.maxIterations ?? 220,
    tolerance: (configuration.toleranceMm ?? 2) / MODEL_UNIT_MM,
    damping: configuration.damping ?? 0.045,
    maxStep: THREE.MathUtils.degToRad(configuration.maxStepDegrees ?? 7),
  };
  const target = new THREE.Vector3(...values.map((value) => value / MODEL_UNIT_MM));
  const seeds = [
    initialAngles,
    [0, -25, 55, 0, 45, 0],
    [0, 20, -45, 0, 20, 0],
  ];
  let best = null;
  for (const seed of seeds) {
    const result = solveFromSeed(target, seed, options);
    if (result.success) return result;
    if (!best || result.errorMm < best.errorMm) best = result;
  }
  return best;
}
