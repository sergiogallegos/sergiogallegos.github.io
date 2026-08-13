import { forwardKinematics, inverseKinematics, JOINT_LIMITS } from './kinematics.js';

export const HOME_ANGLES = [0, -25, 55, 0, 45, 0];
export { JOINT_LIMITS };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class RobotEngine {
  constructor({ onUpdate, onStatus, onLog, onJointMoved, onCartesianTarget = () => {}, onGripper = async () => {}, onPen = () => {} }) {
    this.angles = [...HOME_ANGLES];
    this.speed = 45;
    this.queue = [];
    this.running = false;
    this.stopRequested = false;
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
    this.onLog = onLog;
    this.onJointMoved = onJointMoved;
    this.onCartesianTarget = onCartesianTarget;
    this.onGripper = onGripper;
    this.onPen = onPen;
    this.publishState();
  }

  publishState() {
    const angles = [...this.angles];
    this.onUpdate(angles, forwardKinematics(angles));
  }

  setJointImmediate(index, degrees, markMoved = true) {
    const [min, max] = JOINT_LIMITS[index];
    this.angles[index] = clamp(degrees, min, max);
    this.publishState();
    if (markMoved) this.onJointMoved(index);
  }

  async run(commands) {
    this.stop();
    this.stopRequested = false;
    this.queue = [...commands];
    this.running = true;
    this.onStatus('Running');
    while (this.queue.length && !this.stopRequested) {
      const command = this.queue.shift();
      await this.execute(command);
    }
    const wasStopped = this.stopRequested;
    this.queue = [];
    this.running = false;
    this.onStatus('Ready');
    this.onLog(wasStopped ? 'Program stopped.' : 'Program complete.', wasStopped ? 'warning' : 'success');
  }

  async execute(command) {
    if (command.type === 'SAY') {
      this.onLog(command.text, 'robot');
      return;
    }
    if (command.type === 'SET_SPEED') {
      this.speed = clamp(command.percent, 1, 100);
      this.onLog(`Speed set to ${this.speed}%.`);
      return;
    }
    if (command.type === 'WAIT') {
      await this.delay(command.seconds * 1000);
      return;
    }
    if (command.type === 'HOME') {
      await this.moveAll(HOME_ANGLES);
      return;
    }
    if (command.type === 'GRIPPER') {
      await this.onGripper(command.open);
      return;
    }
    if (command.type === 'PEN') {
      this.onPen(command.down);
      return;
    }
    if (command.type === 'MOVE_TO') {
      const target = { x: command.x, y: command.y, z: command.z };
      this.onLog(`Solving path to X ${target.x}, Y ${target.y}, Z ${target.z} mm.`);
      const solution = inverseKinematics(target, this.angles);
      this.onCartesianTarget(target, solution.success);
      if (!solution.success) {
        this.onLog(`Target is out of reach (closest solution is ${Math.round(solution.errorMm)} mm away).`, 'warning');
        return;
      }
      const starts = [...this.angles];
      solution.angles.forEach((angle, joint) => {
        if (Math.abs(angle - starts[joint]) >= 0.1) this.onJointMoved(joint);
      });
      await this.moveAll(solution.angles);
      this.onLog(`TCP reached the target within ${solution.errorMm.toFixed(1)} mm.`, 'success');
      return;
    }
    if (command.type === 'MOVE_JOINT') {
      const targets = [...this.angles];
      targets[command.joint] = command.relative
        ? targets[command.joint] + command.degrees
        : command.degrees;
      const [min, max] = JOINT_LIMITS[command.joint];
      const limited = clamp(targets[command.joint], min, max);
      if (limited !== targets[command.joint]) {
        this.onLog(`Joint ${command.joint + 1} stopped at its ${limited}° limit.`, 'warning');
      }
      targets[command.joint] = limited;
      this.onJointMoved(command.joint);
      await this.moveAll(targets);
    }
  }

  moveAll(targets) {
    const starts = [...this.angles];
    const maxDistance = Math.max(...targets.map((target, i) => Math.abs(target - starts[i])));
    const duration = Math.max(260, (maxDistance / (35 + this.speed * 1.65)) * 1000);
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const frame = (now) => {
        if (this.stopRequested) return resolve();
        const progress = Math.min(1, (now - startedAt) / duration);
        const amount = ease(progress);
        this.angles = starts.map((start, i) => start + (targets[i] - start) * amount);
        this.publishState();
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  delay(milliseconds) {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const frame = (now) => {
        if (this.stopRequested || now - startedAt >= milliseconds) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  stop() {
    this.stopRequested = true;
    this.queue = [];
  }

  reset() {
    this.stop();
    this.angles = [...HOME_ANGLES];
    this.speed = 45;
    this.publishState();
    this.onStatus('Ready');
  }
}
