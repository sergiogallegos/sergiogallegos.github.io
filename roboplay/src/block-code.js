export const blockPython = {
  moveJoint: (joint, degrees) => `robot.move_joint(${joint}, ${degrees})\n`,
  moveJointBy: (joint, degrees) => `robot.move_joint_by(${joint}, ${degrees})\n`,
  moveTo: (x, y, z) => `robot.move_to(${x}, ${y}, ${z})\n`,
  setSpeed: (percent) => `robot.set_speed(${percent})\n`,
  wait: (seconds) => `robot.wait(${seconds})\n`,
  say: (text) => `robot.say(${JSON.stringify(text)})\n`,
  gripper: (open) => `robot.gripper(${open ? 'True' : 'False'})\n`,
  penDown: () => 'robot.pen_down()\n',
  penUp: () => 'robot.pen_up()\n',
  home: () => 'robot.home()\n',
  print: (value) => `print(${value || "''"})\n`,
};

export function parseBlocksFile(text) {
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || !value.blocks || typeof value.blocks !== 'object') {
    throw new Error('This is not a RoboPlay block project.');
  }
  return value;
}
