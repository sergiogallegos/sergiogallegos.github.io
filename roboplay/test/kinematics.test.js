import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardKinematics, formatJointProgram, inverseKinematics, JOINT_LIMITS } from '../src/kinematics.js';
import { HOME_ANGLES } from '../src/robot-engine.js';

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test('zero pose places the TCP on the positive Y axis', () => {
  const pose = forwardKinematics([0, 0, 0, 0, 0, 0]);
  closeTo(pose.position.x, 0);
  closeTo(pose.position.y, 5.04);
  closeTo(pose.position.z, 0);
  closeTo(pose.quaternion.w, 1);
});

test('joint 1 rotates the arm orientation around the Y axis', () => {
  const pose = forwardKinematics([90, 0, 0, 0, 0, 0]);
  closeTo(pose.position.x, 0);
  closeTo(pose.position.y, 5.04);
  closeTo(pose.position.z, 0);
  closeTo(pose.orientation.pitch, 90, 1e-7);
});

test('joint 2 bends the arm in the XY plane', () => {
  const pose = forwardKinematics([0, 90, 0, 0, 0, 0]);
  closeTo(pose.position.x, -4.04);
  closeTo(pose.position.y, 1);
  closeTo(pose.position.z, 0);
});

test('home pose produces finite position and normalized orientation', () => {
  const pose = forwardKinematics(HOME_ANGLES);
  Object.values(pose.position).forEach((value) => assert.ok(Number.isFinite(value)));
  const q = pose.quaternion;
  closeTo(Math.hypot(q.x, q.y, q.z, q.w), 1);
});

test('copy pose output includes all six rounded joint values', () => {
  const program = formatJointProgram([1.25, -2, 3, 4, 5, 6]);
  assert.equal(program.split('\n').length, 6);
  assert.match(program, /robot\.move_joint\(1, 1\.3\)/);
  assert.match(program, /robot\.move_joint\(6, 6\)/);
});

test('forward kinematics rejects incomplete joint data', () => {
  assert.throws(() => forwardKinematics([0, 0]), /exactly six/);
});

test('inverse kinematics recovers a generated reachable TCP target', () => {
  const target = forwardKinematics([35, -10, 30, 25, 20, 0]).positionMm;
  const result = inverseKinematics(target, HOME_ANGLES);
  assert.equal(result.success, true);
  assert.ok(result.errorMm <= 2);
  result.angles.forEach((angle, index) => {
    assert.ok(angle >= JOINT_LIMITS[index][0] && angle <= JOINT_LIMITS[index][1]);
  });
});

test('inverse kinematics rejects an unreachable Cartesian target', () => {
  const result = inverseKinematics({ x: 5000, y: 5000, z: 5000 }, HOME_ANGLES);
  assert.equal(result.success, false);
  assert.ok(result.errorMm > 1000);
});

test('inverse kinematics validates Cartesian coordinates', () => {
  assert.throws(
    () => inverseKinematics({ x: 'nope', y: 0, z: 0 }, HOME_ANGLES),
    /finite X, Y, and Z/,
  );
});
