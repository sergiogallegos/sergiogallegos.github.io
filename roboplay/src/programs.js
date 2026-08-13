export const PROGRAM_STORAGE_KEY = 'roboplay.program.v1';

export const DEFAULT_PROGRAM = `print("Hello from real Python!")
robot.set_speed(45)
robot.say("Starting wake-up sequence!")
robot.move_joint(1, 35)
robot.move_joint(2, 20)
robot.move_joint(3, -25)
robot.move_joint(4, 45)
robot.move_joint(5, 30)
robot.move_joint(6, 60)
robot.wait(0.5)
robot.home()
# Try next: robot.move_to(-300, 1870, 280)`;

export const STARTER_PROGRAMS = {
  hello: {
    name: 'Hello, robot',
    code: `name = "RoboPlay"
print(f"Hello from {name}!")
robot.say("The robot can speak too.")
robot.move_joint(1, 35)
robot.wait(0.5)
robot.home()`,
  },
  wake: {
    name: 'Challenge 01 · Wake up',
    code: DEFAULT_PROGRAM,
  },
  cartesian: {
    name: 'Challenge 02 · Touch target',
    code: `robot.set_speed(40)
robot.move_to(-300, 1870, 280)
robot.say("Target reached!")
robot.wait(0.5)
robot.home()`,
  },
  pick: {
    name: 'Challenge 03 · Pick and place',
    code: `robot.set_speed(35)
robot.gripper(True)
robot.move_to(-650, 900, 350)
robot.gripper(False)
robot.wait(0.5)
robot.move_to(650, 900, 350)
robot.gripper(True)
robot.say("Pick and place complete!")`,
  },
  square: {
    name: 'Challenge 04 · Draw a square',
    code: `robot.set_speed(30)
robot.move_to(-250, 750, 450)
robot.pen_down()
robot.move_to(250, 750, 450)
robot.move_to(250, 750, 950)
robot.move_to(-250, 750, 950)
robot.move_to(-250, 750, 450)
robot.pen_up()
robot.say("Square complete!")`,
  },
  limits: {
    name: 'Test joint limits',
    code: `robot.set_speed(35)
robot.say("The engine will clamp this safely.")
robot.move_joint(2, 140)
robot.wait(0.5)
robot.home()`,
  },
};

export function safeProgramFilename(value = 'roboplay-program') {
  const cleaned = value.trim().replace(/\.py$/i, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${cleaned || 'roboplay-program'}.py`;
}

export function errorLineFromMessage(message) {
  const match = String(message).match(/^Line (\d+):/m) || String(message).match(/File "<exec>", line (\d+)/);
  return match ? Number(match[1]) : null;
}
