import test from "node:test";
import assert from "node:assert/strict";

import {
  addStroke,
  clearBoard,
  createBoardState,
  deserializeBoard,
  redo,
  serializeBoard,
  strokeWidth,
  undo,
} from "../src/board-model.js";

const stroke = {
  tool: "pen",
  color: "#17223b",
  size: 4,
  pressureSensitive: true,
  points: [
    { x: 10, y: 20, pressure: 0.5 },
    { x: 12, y: 22, pressure: 0.8 },
  ],
};

test("adds, undoes, and redoes a stroke", () => {
  const state = createBoardState();
  assert.equal(addStroke(state, stroke), true);
  assert.equal(state.strokes.length, 1);
  assert.equal(undo(state), true);
  assert.equal(state.strokes.length, 0);
  assert.equal(redo(state), true);
  assert.equal(state.strokes[0], stroke);
});

test("clear is reversible", () => {
  const state = createBoardState([stroke]);
  assert.equal(clearBoard(state), true);
  assert.equal(state.strokes.length, 0);
  assert.equal(undo(state), true);
  assert.deepEqual(state.strokes, [stroke]);
  assert.equal(redo(state), true);
  assert.equal(state.strokes.length, 0);
});

test("a new edit discards the redo branch", () => {
  const state = createBoardState();
  addStroke(state, stroke);
  undo(state);
  addStroke(state, { ...stroke, color: "#df5b57" });
  assert.equal(redo(state), false);
});

test("serializes valid drawings and rejects invalid storage", () => {
  assert.deepEqual(deserializeBoard(serializeBoard([stroke])), [stroke]);
  assert.deepEqual(deserializeBoard("not json"), []);
  assert.deepEqual(deserializeBoard(JSON.stringify({ version: 99, strokes: [stroke] })), []);
  assert.deepEqual(deserializeBoard(JSON.stringify({ version: 1, strokes: [{ nope: true }] })), []);
});

test("pressure changes pen width but not eraser width", () => {
  assert.ok(strokeWidth(stroke, 0.9) > strokeWidth(stroke, 0.1));
  assert.equal(strokeWidth({ ...stroke, tool: "eraser", size: 24 }, 0.1), 24);
});
