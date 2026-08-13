import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import { pythonGenerator } from 'blockly/python';
import { blockPython, parseBlocksFile } from './block-code.js';

Blockly.setLocale(En);

export const BLOCKS_STORAGE_KEY = 'roboplay.blocks.v1';

const ROBOT_HUE = 210;
const MOTION_HUE = 25;

Blockly.defineBlocksWithJsonArray([
  {
    type: 'robot_move_joint',
    message0: 'move joint %1 to %2 degrees',
    args0: [
      { type: 'field_number', name: 'JOINT', value: 1, min: 1, max: 6, precision: 1 },
      { type: 'field_number', name: 'DEGREES', value: 45, min: -180, max: 180, precision: 1 },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: MOTION_HUE,
    tooltip: 'Move one robot joint to an absolute angle.',
  },
  {
    type: 'robot_move_joint_by',
    message0: 'move joint %1 by %2 degrees',
    args0: [
      { type: 'field_number', name: 'JOINT', value: 1, min: 1, max: 6, precision: 1 },
      { type: 'field_number', name: 'DEGREES', value: 10, min: -180, max: 180, precision: 1 },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: MOTION_HUE,
    tooltip: 'Move one robot joint relative to its current angle.',
  },
  {
    type: 'robot_move_to',
    message0: 'move tool to X %1 Y %2 Z %3 mm',
    args0: [
      { type: 'field_number', name: 'X', value: -300, precision: 10 },
      { type: 'field_number', name: 'Y', value: 1870, precision: 10 },
      { type: 'field_number', name: 'Z', value: 280, precision: 10 },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: MOTION_HUE,
    tooltip: 'Move the tool center point to an XYZ position in millimeters.',
  },
  {
    type: 'robot_set_speed',
    message0: 'set robot speed to %1 %%',
    args0: [{ type: 'field_number', name: 'PERCENT', value: 40, min: 1, max: 100, precision: 1 }],
    previousStatement: null,
    nextStatement: null,
    colour: ROBOT_HUE,
    tooltip: 'Set robot motion speed from 1 to 100 percent.',
  },
  {
    type: 'robot_wait',
    message0: 'wait %1 seconds',
    args0: [{ type: 'field_number', name: 'SECONDS', value: 1, min: 0, max: 30, precision: 0.1 }],
    previousStatement: null,
    nextStatement: null,
    colour: ROBOT_HUE,
    tooltip: 'Wait before the next robot command.',
  },
  {
    type: 'robot_say',
    message0: 'robot says %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello!' }],
    previousStatement: null,
    nextStatement: null,
    colour: ROBOT_HUE,
    tooltip: 'Write a message to the robot console.',
  },
  {
    type: 'robot_gripper',
    message0: '%1 gripper',
    args0: [{
      type: 'field_dropdown',
      name: 'STATE',
      options: [['open', 'OPEN'], ['close', 'CLOSE']],
    }],
    previousStatement: null,
    nextStatement: null,
    colour: ROBOT_HUE,
    tooltip: 'Open the gripper or close it to pick up a nearby object.',
  },
  {
    type: 'robot_pen_down',
    message0: 'pen down',
    previousStatement: null,
    nextStatement: null,
    colour: 285,
    tooltip: 'Start drawing with the tool center point.',
  },
  {
    type: 'robot_pen_up',
    message0: 'pen up',
    previousStatement: null,
    nextStatement: null,
    colour: 285,
    tooltip: 'Stop drawing with the tool center point.',
  },
  {
    type: 'python_print',
    message0: 'print %1',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null,
    nextStatement: null,
    colour: 270,
    tooltip: 'Print a value in the Python console.',
  },
  {
    type: 'robot_home',
    message0: 'return robot home',
    previousStatement: null,
    nextStatement: null,
    colour: ROBOT_HUE,
    tooltip: 'Return all joints to the home pose.',
  },
]);

pythonGenerator.forBlock.robot_move_joint = (block) => blockPython.moveJoint(block.getFieldValue('JOINT'), block.getFieldValue('DEGREES'));
pythonGenerator.forBlock.robot_move_joint_by = (block) => blockPython.moveJointBy(block.getFieldValue('JOINT'), block.getFieldValue('DEGREES'));
pythonGenerator.forBlock.robot_move_to = (block) => blockPython.moveTo(block.getFieldValue('X'), block.getFieldValue('Y'), block.getFieldValue('Z'));
pythonGenerator.forBlock.robot_set_speed = (block) => blockPython.setSpeed(block.getFieldValue('PERCENT'));
pythonGenerator.forBlock.robot_wait = (block) => blockPython.wait(block.getFieldValue('SECONDS'));
pythonGenerator.forBlock.robot_say = (block) => blockPython.say(block.getFieldValue('TEXT'));
pythonGenerator.forBlock.robot_gripper = (block) => blockPython.gripper(block.getFieldValue('STATE') === 'OPEN');
pythonGenerator.forBlock.robot_pen_down = blockPython.penDown;
pythonGenerator.forBlock.robot_pen_up = blockPython.penUp;
pythonGenerator.forBlock.robot_home = blockPython.home;
pythonGenerator.forBlock.python_print = (block, generator) => {
  const value = generator.valueToCode(block, 'VALUE', 99) || "''";
  return blockPython.print(value);
};

const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Robot motion',
      colour: String(MOTION_HUE),
      contents: [
        { kind: 'block', type: 'robot_move_joint' },
        { kind: 'block', type: 'robot_move_joint_by' },
        { kind: 'block', type: 'robot_move_to' },
        { kind: 'block', type: 'robot_home' },
      ],
    },
    {
      kind: 'category',
      name: 'Robot actions',
      colour: String(ROBOT_HUE),
      contents: [
        { kind: 'block', type: 'robot_set_speed' },
        { kind: 'block', type: 'robot_wait' },
        { kind: 'block', type: 'robot_say' },
        { kind: 'block', type: 'robot_gripper' },
        { kind: 'block', type: 'robot_pen_down' },
        { kind: 'block', type: 'robot_pen_up' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: '120',
      contents: [
        {
          kind: 'block', type: 'controls_repeat_ext',
          inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 3 } } } },
        },
        { kind: 'block', type: 'controls_for' },
      ],
    },
    { kind: 'category', name: 'Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
    {
      kind: 'category',
      name: 'Values',
      colour: '230',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 10 } },
        { kind: 'block', type: 'text', fields: { TEXT: 'Hello from blocks!' } },
        { kind: 'block', type: 'python_print' },
      ],
    },
  ],
};

function chainBlocks(blocks) {
  return blocks.reduceRight((next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }), null);
}

export const BLOCK_STARTERS = {
  wake: {
    name: 'Challenge 01 · Wake up',
    state: {
      blocks: { languageVersion: 0, blocks: [chainBlocks([
        { type: 'robot_set_speed', x: 35, y: 35, fields: { PERCENT: 40 } },
        { type: 'robot_move_joint', fields: { JOINT: 1, DEGREES: 35 } },
        { type: 'robot_move_joint', fields: { JOINT: 2, DEGREES: 20 } },
        { type: 'robot_move_joint', fields: { JOINT: 3, DEGREES: -25 } },
        { type: 'robot_move_joint', fields: { JOINT: 4, DEGREES: 45 } },
        { type: 'robot_move_joint', fields: { JOINT: 5, DEGREES: 30 } },
        { type: 'robot_move_joint', fields: { JOINT: 6, DEGREES: 60 } },
        { type: 'robot_home' },
      ])] },
    },
  },
  hello: {
    name: 'Hello, robot',
    state: {
      blocks: { languageVersion: 0, blocks: [{
        type: 'python_print', x: 35, y: 35,
        inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: 'Hello from blocks!' } } } },
        next: { block: { type: 'robot_move_joint', fields: { JOINT: 1, DEGREES: 35 }, next: { block: { type: 'robot_home' } } } },
      }] },
    },
  },
  loop: {
    name: 'Repeat a movement',
    state: {
      blocks: { languageVersion: 0, blocks: [{
        type: 'robot_set_speed', x: 35, y: 35, fields: { PERCENT: 40 },
        next: { block: {
          type: 'controls_repeat_ext',
          inputs: {
            TIMES: { shadow: { type: 'math_number', fields: { NUM: 3 } } },
            DO: { block: { type: 'robot_move_joint_by', fields: { JOINT: 1, DEGREES: 20 }, next: { block: { type: 'robot_wait', fields: { SECONDS: 0.5 } } } } },
          },
          next: { block: { type: 'robot_home' } },
        } },
      }] },
    },
  },
  target: {
    name: 'Challenge 02 · Touch target',
    state: {
      blocks: { languageVersion: 0, blocks: [{
        type: 'robot_set_speed', x: 35, y: 35, fields: { PERCENT: 40 },
        next: { block: { type: 'robot_move_to', fields: { X: -300, Y: 1870, Z: 280 }, next: { block: { type: 'robot_say', fields: { TEXT: 'Target reached!' } } } } },
      }] },
    },
  },
  pick: {
    name: 'Challenge 03 · Pick and place',
    state: {
      blocks: { languageVersion: 0, blocks: [{
        type: 'robot_set_speed', x: 35, y: 35, fields: { PERCENT: 35 },
        next: { block: {
          type: 'robot_gripper', fields: { STATE: 'OPEN' },
          next: { block: {
            type: 'robot_move_to', fields: { X: -650, Y: 900, Z: 350 },
            next: { block: {
              type: 'robot_gripper', fields: { STATE: 'CLOSE' },
              next: { block: {
                type: 'robot_move_to', fields: { X: 650, Y: 900, Z: 350 },
                next: { block: {
                  type: 'robot_gripper', fields: { STATE: 'OPEN' },
                  next: { block: { type: 'robot_say', fields: { TEXT: 'Pick and place complete!' } } },
                } },
              } },
            } },
          } },
        } },
      }] },
    },
  },
  square: {
    name: 'Challenge 04 · Draw a square',
    state: {
      blocks: { languageVersion: 0, blocks: [chainBlocks([
        { type: 'robot_set_speed', x: 35, y: 35, fields: { PERCENT: 30 } },
        { type: 'robot_move_to', fields: { X: -250, Y: 750, Z: 450 } },
        { type: 'robot_pen_down' },
        { type: 'robot_move_to', fields: { X: 250, Y: 750, Z: 450 } },
        { type: 'robot_move_to', fields: { X: 250, Y: 750, Z: 950 } },
        { type: 'robot_move_to', fields: { X: -250, Y: 750, Z: 950 } },
        { type: 'robot_move_to', fields: { X: -250, Y: 750, Z: 450 } },
        { type: 'robot_pen_up' },
        { type: 'robot_say', fields: { TEXT: 'Square complete!' } },
      ])] },
    },
  },
};

export function createBlocksEditor({ parent, preview, initialState, onChange }) {
  const workspace = Blockly.inject(parent, {
    toolbox,
    renderer: 'zelos',
    trashcan: true,
    sounds: false,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 1.25, minScale: 0.45, scaleSpeed: 1.1 },
    grid: { spacing: 20, length: 2, colour: '#d2d2d7', snap: true },
    theme: Blockly.Theme.defineTheme('roboplay', {
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#ffffff',
        toolboxBackgroundColour: '#f5f5f7',
        toolboxForegroundColour: '#1d1d1f',
        flyoutBackgroundColour: '#ffffff',
        flyoutForegroundColour: '#1d1d1f',
        flyoutOpacity: 1,
        scrollbarColour: '#86868b',
        insertionMarkerColour: '#0071e3',
        insertionMarkerOpacity: 0.35,
      },
    }),
  });

  let saveTimer = null;
  let closeFlyoutFrame = null;

  const closeFlyoutWhenDropFinishes = () => {
    cancelAnimationFrame(closeFlyoutFrame);
    const close = () => {
      if (workspace.isDragging()) {
        closeFlyoutFrame = requestAnimationFrame(close);
        return;
      }
      workspace.getToolbox()?.clearSelection();
    };
    closeFlyoutFrame = requestAnimationFrame(close);
  };

  const update = (event) => {
    if (event && event.isUiEvent) return;
    if (event?.type === Blockly.Events.BLOCK_CREATE) closeFlyoutWhenDropFinishes();
    const code = pythonGenerator.workspaceToCode(workspace).trim();
    preview.textContent = code || '# Add blocks to generate Python.';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onChange?.(Blockly.serialization.workspaces.save(workspace), code), 350);
  };
  workspace.addChangeListener(update);

  function loadState(state) {
    Blockly.Events.disable();
    try {
      workspace.clear();
      if (state) Blockly.serialization.workspaces.load(state, workspace);
    } finally {
      Blockly.Events.enable();
    }
    workspace.clearUndo();
    Blockly.svgResize(workspace);
    update();
  }

  loadState(initialState || BLOCK_STARTERS.hello.state);

  return {
    getCode: () => pythonGenerator.workspaceToCode(workspace),
    getState: () => Blockly.serialization.workspaces.save(workspace),
    setState: loadState,
    clear: () => loadState(null),
    resize: () => Blockly.svgResize(workspace),
    dispose: () => {
      cancelAnimationFrame(closeFlyoutFrame);
      workspace.dispose();
    },
  };
}

export { parseBlocksFile };
