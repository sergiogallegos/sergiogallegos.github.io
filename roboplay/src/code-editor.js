import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view';

const robotCompletions = [
  { label: 'robot.move_joint', type: 'function', apply: 'robot.move_joint(1, 45)', detail: 'Move one joint to an angle' },
  { label: 'robot.move_joint_by', type: 'function', apply: 'robot.move_joint_by(1, 10)', detail: 'Move one joint relatively' },
  { label: 'robot.move_to', type: 'function', apply: 'robot.move_to(0, 1600, 300)', detail: 'Move TCP to X, Y, Z in mm' },
  { label: 'robot.set_speed', type: 'function', apply: 'robot.set_speed(40)', detail: 'Set motion speed from 1–100%' },
  { label: 'robot.wait', type: 'function', apply: 'robot.wait(1)', detail: 'Wait for seconds' },
  { label: 'robot.say', type: 'function', apply: 'robot.say("Hello!")', detail: 'Write to the robot console' },
  { label: 'robot.gripper', type: 'function', apply: 'robot.gripper(True)', detail: 'Open or close the gripper' },
  { label: 'robot.pen_down', type: 'function', apply: 'robot.pen_down()', detail: 'Start drawing the TCP trail' },
  { label: 'robot.pen_up', type: 'function', apply: 'robot.pen_up()', detail: 'Stop drawing the TCP trail' },
  { label: 'robot.home', type: 'function', apply: 'robot.home()', detail: 'Return to the home pose' },
];

function robotCompletion(context) {
  const word = context.matchBefore(/[\w.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  if (!word.text.startsWith('robot') && !context.explicit) return null;
  return { from: word.from, options: robotCompletions, validFor: /^[\w.]*$/ };
}

const setErrorLine = StateEffect.define();
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(decorations, transaction) {
    decorations = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue;
      if (!effect.value) decorations = Decoration.none;
      else {
        const line = transaction.state.doc.line(Math.min(effect.value, transaction.state.doc.lines));
        decorations = Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)]);
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const portfolioTheme = EditorView.theme({
  '&': { height: '100%', color: '#1d1d1f', backgroundColor: '#fff', fontSize: '11px' },
  '.cm-scroller': { fontFamily: "'DM Mono', ui-monospace, monospace", lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { padding: '10px 4px', caretColor: '#0071e3' },
  '.cm-gutters': { backgroundColor: '#f5f5f7', color: '#86868b', borderRight: '1px solid #d2d2d7' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#f5f5f7' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#cce4ff' },
  '.cm-cursor': { borderLeftColor: '#0071e3' },
  '.cm-error-line': { backgroundColor: '#fff0f0', boxShadow: 'inset 3px 0 0 #d70015' },
  '.cm-tooltip-autocomplete': { border: '1px solid #d2d2d7', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.1)' },
});

export function createCodeEditor({ parent, initialValue, onChange }) {
  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), drawSelection(), dropCursor(),
      EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }), python(),
      autocompletion({ override: [robotCompletion], activateOnTyping: true }), highlightActiveLine(),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
      errorLineField, portfolioTheme,
      EditorView.updateListener.of((update) => { if (update.docChanged) onChange?.(update.state.doc.toString()); }),
    ],
  });
  const view = new EditorView({ state, parent });

  return {
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, effects: setErrorLine.of(null) });
    },
    focus: () => view.focus(),
    highlightErrorLine(line) { view.dispatch({ effects: setErrorLine.of(line) }); },
    clearError() { view.dispatch({ effects: setErrorLine.of(null) }); },
  };
}
