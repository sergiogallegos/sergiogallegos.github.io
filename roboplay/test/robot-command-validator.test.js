import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRobotCommands } from '../src/robot-command-validator.js';

test('valid Python robot commands are normalized', () => {
  assert.deepEqual(validateRobotCommands([
    { type: 'MOVE_JOINT', joint: 0, degrees: 45, relative: 0 },
    { type: 'MOVE_TO', x: 1, y: 2, z: 3 },
    { type: 'SAY', text: 42 },
    { type: 'GRIPPER', open: 1 },
    { type: 'PEN', down: 1 },
  ]), [
    { type: 'MOVE_JOINT', joint: 0, degrees: 45, relative: false },
    { type: 'MOVE_TO', x: 1, y: 2, z: 3 },
    { type: 'SAY', text: '42' },
    { type: 'GRIPPER', open: true },
    { type: 'PEN', down: true },
  ]);
});

test('invalid bridge commands cannot reach the robot engine', () => {
  assert.throws(() => validateRobotCommands([{ type: 'MOVE_TO', x: NaN, y: 0, z: 0 }]), /finite/);
  assert.throws(() => validateRobotCommands([{ type: 'MOVE_JOINT', joint: 9, degrees: 0 }]), /Joint/);
  assert.throws(() => validateRobotCommands([{ type: 'FLY' }]), /unknown robot command/);
});
