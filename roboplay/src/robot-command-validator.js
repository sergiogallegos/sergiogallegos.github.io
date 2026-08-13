const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
};

export function validateRobotCommands(commands) {
  if (!Array.isArray(commands)) throw new Error('Python returned an invalid robot command queue.');
  return commands.map((command) => {
    if (!command || typeof command !== 'object') throw new Error('Python returned an invalid robot command.');
    if (command.type === 'HOME') return { type: 'HOME' };
    if (command.type === 'GRIPPER') return { type: 'GRIPPER', open: Boolean(command.open) };
    if (command.type === 'PEN') return { type: 'PEN', down: Boolean(command.down) };
    if (command.type === 'SAY') return { type: 'SAY', text: String(command.text) };
    if (command.type === 'SET_SPEED') return { type: 'SET_SPEED', percent: finite(command.percent, 'Speed') };
    if (command.type === 'WAIT') {
      const seconds = finite(command.seconds, 'Wait time');
      if (seconds < 0 || seconds > 30) throw new Error('Wait time must be between 0 and 30 seconds.');
      return { type: 'WAIT', seconds };
    }
    if (command.type === 'MOVE_TO') {
      return {
        type: 'MOVE_TO',
        x: finite(command.x, 'X'),
        y: finite(command.y, 'Y'),
        z: finite(command.z, 'Z'),
      };
    }
    if (command.type === 'MOVE_JOINT') {
      if (!Number.isInteger(command.joint) || command.joint < 0 || command.joint > 5) {
        throw new Error('Joint must be from 1 to 6.');
      }
      return {
        type: 'MOVE_JOINT',
        joint: command.joint,
        degrees: finite(command.degrees, 'Angle'),
        relative: Boolean(command.relative),
      };
    }
    throw new Error(`Python returned unknown robot command “${String(command.type)}”.`);
  });
}
