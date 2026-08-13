const COMMAND = /^robot\.(\w+)\s*\((.*)\)\s*;?$/;

function splitArguments(source) {
  const args = [];
  let current = '';
  let quote = null;
  for (const character of source.trim()) {
    if ((character === '"' || character === "'") && !quote) quote = character;
    else if (character === quote) quote = null;
    if (character === ',' && !quote) {
      args.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

const number = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
};

export function parseProgram(source) {
  const commands = [];
  const lines = source.split('\n');
  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return;
    const match = line.match(COMMAND);
    if (!match) throw new Error(`Line ${index + 1}: Try a command like robot.home().`);
    const [, name, argumentSource] = match;
    const args = splitArguments(argumentSource);
    try {
      if (name === 'home') {
        if (args.length) throw new Error('home does not need any values.');
        commands.push({ type: 'HOME' });
      } else if (name === 'move_joint' || name === 'move_joint_by') {
        if (args.length !== 2) throw new Error(`${name} needs a joint number and an angle.`);
        const joint = number(args[0], 'Joint') - 1;
        if (!Number.isInteger(joint) || joint < 0 || joint > 5) throw new Error('Joint must be from 1 to 6.');
        commands.push({ type: 'MOVE_JOINT', joint, degrees: number(args[1], 'Angle'), relative: name.endsWith('_by') });
      } else if (name === 'move_to') {
        if (args.length !== 3) throw new Error('move_to needs X, Y, and Z coordinates.');
        commands.push({
          type: 'MOVE_TO',
          x: number(args[0], 'X'),
          y: number(args[1], 'Y'),
          z: number(args[2], 'Z'),
        });
      } else if (name === 'set_speed') {
        if (args.length !== 1) throw new Error('set_speed needs one percentage.');
        commands.push({ type: 'SET_SPEED', percent: number(args[0], 'Speed') });
      } else if (name === 'wait') {
        if (args.length !== 1) throw new Error('wait needs a number of seconds.');
        const seconds = number(args[0], 'Wait time');
        if (seconds < 0 || seconds > 30) throw new Error('Wait time must be between 0 and 30 seconds.');
        commands.push({ type: 'WAIT', seconds });
      } else if (name === 'say') {
        if (args.length !== 1 || !/^(["']).*\1$/.test(args[0])) throw new Error('say needs text inside quotes.');
        commands.push({ type: 'SAY', text: args[0].slice(1, -1) });
      } else {
        throw new Error(`Unknown command “${name}”.`);
      }
    } catch (error) {
      throw new Error(`Line ${index + 1}: ${error.message}`);
    }
  });
  if (!commands.length) throw new Error('Add at least one robot command first.');
  return commands;
}
