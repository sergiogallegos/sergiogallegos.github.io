import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAW_SQUARE_POINTS, DROP_POSITION, PICK_POSITION, distanceToTarget, evaluateGripperAction,
  generateReachableTarget, squareDrawingScore, starterCodeForPickAndPlace, starterCodeForSquare, starterCodeForTarget,
} from '../src/challenges.js';
import { forwardKinematics, inverseKinematics } from '../src/kinematics.js';
import { HOME_ANGLES } from '../src/robot-engine.js';

function seededRandom(seed = 123456) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test('generated challenge targets are reachable from home', () => {
  const random = seededRandom();
  for (let index = 0; index < 25; index += 1) {
    const target = generateReachableTarget(random);
    const solution = inverseKinematics(target, HOME_ANGLES);
    assert.equal(solution.success, true, `target ${JSON.stringify(target)} should be reachable`);
    assert.ok(solution.errorMm <= 2);
  }
});

test('distance to target is calculated in millimeters', () => {
  assert.equal(distanceToTarget({ x: 0, y: 0, z: 0 }, { x: 30, y: 40, z: 0 }), 50);
});

test('starter code contains the generated Cartesian target', () => {
  const code = starterCodeForTarget({ x: -300, y: 1870, z: 280 });
  assert.match(code, /robot\.move_to\(-300, 1870, 280\)/);
});

test('gripper picks only when the TCP is close enough', () => {
  const picked = evaluateGripperAction({
    opening: false, holding: false, tcpPosition: { ...PICK_POSITION }, cubePosition: { ...PICK_POSITION },
  });
  assert.equal(picked.event, 'picked');
  assert.equal(picked.holding, true);

  const missed = evaluateGripperAction({
    opening: false, holding: false, tcpPosition: { x: 0, y: 0, z: 0 }, cubePosition: { ...PICK_POSITION },
  });
  assert.equal(missed.event, 'missed');
  assert.equal(missed.holding, false);
});

test('opening the gripper in the drop zone completes placement', () => {
  const result = evaluateGripperAction({
    opening: true, holding: true, tcpPosition: { ...DROP_POSITION }, cubePosition: { ...DROP_POSITION },
  });
  assert.equal(result.event, 'placed');
  assert.equal(result.placed, true);
  assert.equal(result.holding, false);
});

test('pick-and-place starter uses both gripper states and reachable positions', () => {
  const code = starterCodeForPickAndPlace();
  assert.match(code, /robot\.gripper\(False\)/);
  assert.match(code, /robot\.gripper\(True\)/);
  assert.equal(inverseKinematics(PICK_POSITION, HOME_ANGLES).success, true);
  assert.equal(inverseKinematics(DROP_POSITION, HOME_ANGLES).success, true);
});

test('square scoring accepts a covered closed path', () => {
  const trail = [];
  for (let edge = 0; edge < DRAW_SQUARE_POINTS.length - 1; edge += 1) {
    const start = DRAW_SQUARE_POINTS[edge];
    const end = DRAW_SQUARE_POINTS[edge + 1];
    for (let step = 0; step <= 10; step += 1) {
      trail.push({
        x: start.x + (end.x - start.x) * step / 10,
        y: start.y + (end.y - start.y) * step / 10,
        z: start.z + (end.z - start.z) * step / 10,
      });
    }
  }
  const score = squareDrawingScore(trail);
  assert.equal(score.complete, true);
  assert.equal(score.closed, true);
  assert.equal(score.coverage, 1);
});

test('square scoring accepts the simulator joint-interpolated starter path', () => {
  let angles = inverseKinematics(DRAW_SQUARE_POINTS[0], HOME_ANGLES).angles;
  const trail = [forwardKinematics(angles).positionMm];
  for (const target of DRAW_SQUARE_POINTS.slice(1)) {
    const solution = inverseKinematics(target, angles);
    for (let step = 1; step <= 50; step += 1) {
      const amount = step / 50;
      const interpolated = angles.map((angle, joint) => angle + (solution.angles[joint] - angle) * amount);
      trail.push(forwardKinematics(interpolated).positionMm);
    }
    angles = solution.angles;
  }
  assert.equal(squareDrawingScore(trail).complete, true);
});

test('square scoring rejects an open or partial drawing', () => {
  const score = squareDrawingScore(DRAW_SQUARE_POINTS.slice(0, 2));
  assert.equal(score.complete, false);
  assert.equal(score.closed, false);
  assert.ok(score.coverage < 0.5);
});

test('square starter toggles the pen and uses reachable corners', () => {
  const code = starterCodeForSquare();
  assert.match(code, /robot\.pen_down\(\)/);
  assert.match(code, /robot\.pen_up\(\)/);
  DRAW_SQUARE_POINTS.forEach((point) => assert.equal(inverseKinematics(point, HOME_ANGLES).success, true));
});
