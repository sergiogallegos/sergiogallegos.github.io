import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROGRAM, errorLineFromMessage, safeProgramFilename, STARTER_PROGRAMS } from '../src/programs.js';

test('default and starter programs contain executable robot commands', () => {
  assert.match(DEFAULT_PROGRAM, /robot\.move_joint/);
  Object.values(STARTER_PROGRAMS).forEach((program) => assert.match(program.code, /robot\./));
});

test('program filenames are safe and always use the Python extension', () => {
  assert.equal(safeProgramFilename('My Robot Demo.py'), 'My-Robot-Demo.py');
  assert.equal(safeProgramFilename('***'), 'roboplay-program.py');
});

test('parser error messages expose a highlightable line number', () => {
  assert.equal(errorLineFromMessage('Line 4: unknown command'), 4);
  assert.equal(errorLineFromMessage('  File "<exec>", line 7, in <module>'), 7);
  assert.equal(errorLineFromMessage('No commands'), null);
});
