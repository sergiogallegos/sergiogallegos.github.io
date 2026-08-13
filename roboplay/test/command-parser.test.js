import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../src/command-parser.js';

test('move_to parses millimeter coordinates into a Cartesian command', () => {
  assert.deepEqual(parseProgram('robot.move_to(-300, 1870, 280)'), [
    { type: 'MOVE_TO', x: -300, y: 1870, z: 280 },
  ]);
});

test('move_to requires exactly three numeric coordinates', () => {
  assert.throws(() => parseProgram('robot.move_to(1, 2)'), /needs X, Y, and Z/);
  assert.throws(() => parseProgram('robot.move_to(1, two, 3)'), /Y must be a number/);
});
