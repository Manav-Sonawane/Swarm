import { CONFIG } from '../config';

export class SimClock {
  private simTime: number = 19 * 3600; // start at 19:00 (7:00 PM) sim time
  private speed: number = CONFIG.DEFAULT_SIM_SPEED;
  private running: boolean = false;
  private seed: number = CONFIG.DEFAULT_SEED;
  private initialSimTime: number = 19 * 3600;

  constructor(seed: number = CONFIG.DEFAULT_SEED) {
    this.seed = seed;
  }

  public tick(realDtSec: number): number {
    if (!this.running) return 0;
    const simDtSec = realDtSec * this.speed;
    this.simTime += simDtSec;
    return simDtSec;
  }

  public getSimTime(): number {
    return this.simTime;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getSeed(): number {
    return this.seed;
  }

  public start(): void {
    this.running = true;
  }

  public pause(): void {
    this.running = false;
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(1, Math.min(30, speed));
  }

  public setSeed(seed: number): void {
    this.seed = seed;
  }

  public reset(): void {
    this.simTime = this.initialSimTime;
    this.running = false;
  }
}
