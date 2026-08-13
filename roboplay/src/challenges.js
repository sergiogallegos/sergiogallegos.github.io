import { forwardKinematics, inverseKinematics } from './kinematics.js';
import { HOME_ANGLES } from './robot-engine.js';

export const TARGET_TOLERANCE_MM = 25;
export const PICKUP_TOLERANCE_MM = 120;
export const DROP_TOLERANCE_MM = 190;
export const PICK_POSITION = Object.freeze({ x: -650, y: 900, z: 350 });
export const DROP_POSITION = Object.freeze({ x: 650, y: 900, z: 350 });
export const DRAW_SQUARE_POINTS = Object.freeze([
  Object.freeze({ x: -250, y: 750, z: 450 }),
  Object.freeze({ x: 250, y: 750, z: 450 }),
  Object.freeze({ x: 250, y: 750, z: 950 }),
  Object.freeze({ x: -250, y: 750, z: 950 }),
  Object.freeze({ x: -250, y: 750, z: 450 }),
]);

const TARGET_JOINT_RANGES = [
  [-60, 60],
  [-45, 35],
  [-20, 75],
  [-55, 55],
  [10, 70],
  [-30, 30],
];

export function distanceToTarget(position, target) {
  return Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
}

export function generateReachableTarget(random = Math.random) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const jointPose = TARGET_JOINT_RANGES.map(([min, max]) => min + random() * (max - min));
    const raw = forwardKinematics(jointPose).positionMm;
    const target = {
      x: Math.round(raw.x / 10) * 10,
      y: Math.round(raw.y / 10) * 10,
      z: Math.round(raw.z / 10) * 10,
    };
    const awayFromHome = distanceToTarget(forwardKinematics(HOME_ANGLES).positionMm, target) > 180;
    const solution = inverseKinematics(target, HOME_ANGLES);
    if (awayFromHome && solution.success) return target;
  }
  return { x: -300, y: 1870, z: 280 };
}

export function starterCodeForTarget(target) {
  return [
    'robot.set_speed(40)',
    `robot.move_to(${target.x}, ${target.y}, ${target.z})`,
    'robot.say("Target reached!")',
  ].join('\n');
}

export function evaluateGripperAction({ opening, holding, tcpPosition, cubePosition, dropPosition = DROP_POSITION }) {
  if (!opening && !holding) {
    const distanceMm = distanceToTarget(tcpPosition, cubePosition);
    return distanceMm <= PICKUP_TOLERANCE_MM
      ? { event: 'picked', holding: true, placed: false, cubePosition: { ...tcpPosition }, distanceMm }
      : { event: 'missed', holding: false, placed: false, cubePosition: { ...cubePosition }, distanceMm };
  }
  if (opening && holding) {
    const distanceMm = distanceToTarget(tcpPosition, dropPosition);
    return {
      event: distanceMm <= DROP_TOLERANCE_MM ? 'placed' : 'released',
      holding: false,
      placed: distanceMm <= DROP_TOLERANCE_MM,
      cubePosition: { ...tcpPosition },
      distanceMm,
    };
  }
  return { event: 'none', holding, placed: false, cubePosition: { ...cubePosition }, distanceMm: null };
}

export function starterCodeForPickAndPlace(pick = PICK_POSITION, drop = DROP_POSITION) {
  return [
    'robot.set_speed(35)',
    'robot.gripper(True)  # open',
    `robot.move_to(${pick.x}, ${pick.y}, ${pick.z})`,
    'robot.gripper(False) # close and pick',
    'robot.wait(0.5)',
    `robot.move_to(${drop.x}, ${drop.y}, ${drop.z})`,
    'robot.gripper(True)  # release',
    'robot.say("Pick and place complete!")',
  ].join('\n');
}

function pointOnSegment(start, end, amount) {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    z: start.z + (end.z - start.z) * amount,
  };
}

export function squareDrawingScore(trail, corners = DRAW_SQUARE_POINTS, toleranceMm = 85) {
  if (!Array.isArray(trail) || trail.length < 2) return { coverage: 0, closed: false, complete: false };
  const samples = [];
  for (let edge = 0; edge < corners.length - 1; edge += 1) {
    for (let sample = 0; sample <= 5; sample += 1) {
      samples.push(pointOnSegment(corners[edge], corners[edge + 1], sample / 5));
    }
  }
  const matched = samples.filter((sample) => trail.some((point) => distanceToTarget(point, sample) <= toleranceMm)).length;
  const coverage = matched / samples.length;
  const closed = distanceToTarget(trail[0], trail[trail.length - 1]) <= 110;
  return { coverage, closed, complete: coverage >= 0.88 && closed };
}

export function starterCodeForSquare(points = DRAW_SQUARE_POINTS) {
  return [
    'robot.set_speed(30)',
    `robot.move_to(${points[0].x}, ${points[0].y}, ${points[0].z})`,
    'robot.pen_down()',
    ...points.slice(1).map((point) => `robot.move_to(${point.x}, ${point.y}, ${point.z})`),
    'robot.pen_up()',
    'robot.say("Square complete!")',
  ].join('\n');
}
