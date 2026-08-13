import test from 'node:test';
import assert from 'node:assert/strict';
import { blockPython, parseBlocksFile } from '../src/block-code.js';

test('robot blocks map one-to-one onto the shared Python API', () => {
  assert.equal(blockPython.moveJoint(2, 45), 'robot.move_joint(2, 45)\n');
  assert.equal(blockPython.moveJointBy(3, -10), 'robot.move_joint_by(3, -10)\n');
  assert.equal(blockPython.moveTo(-300, 1870, 280), 'robot.move_to(-300, 1870, 280)\n');
  assert.equal(blockPython.setSpeed(40), 'robot.set_speed(40)\n');
  assert.equal(blockPython.wait(0.5), 'robot.wait(0.5)\n');
  assert.equal(blockPython.say('hello "robot"'), 'robot.say("hello \\"robot\\"")\n');
  assert.equal(blockPython.gripper(true), 'robot.gripper(True)\n');
  assert.equal(blockPython.gripper(false), 'robot.gripper(False)\n');
  assert.equal(blockPython.penDown(), 'robot.pen_down()\n');
  assert.equal(blockPython.penUp(), 'robot.pen_up()\n');
  assert.equal(blockPython.home(), 'robot.home()\n');
  assert.equal(blockPython.print("'hello'"), "print('hello')\n");
});

test('block project import accepts workspace JSON and rejects unrelated JSON', () => {
  const state = { blocks: { languageVersion: 0, blocks: [] } };
  assert.deepEqual(parseBlocksFile(JSON.stringify(state)), state);
  assert.throws(() => parseBlocksFile('{"hello":"world"}'), /not a RoboPlay block project/);
  assert.throws(() => parseBlocksFile('invalid'), SyntaxError);
});
