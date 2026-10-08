/**
 * 프레임 속도와 분리된 작품 시간.
 *
 * - 실제 경과 시간에 속도를 곱해 누적하므로 주사율과 무관하다.
 * - 한 프레임에 반영되는 경과 시간에 상한을 둔다. 탭 전환·디버거 정지 후
 *   긴 시간이 한꺼번에 적용되어 자세가 튀는 것을 막는다.
 * - 작품 시간은 안무를 결정하는 유일한 입력이며, 같은 시간은 항상 같은 장면을 만든다.
 */
export class Clock {
  private time: number;
  private last: number | null = null;
  private paused = false;
  speed = 1;

  constructor(
    private readonly maxDelta: number,
    startTime = 0,
  ) {
    this.time = startTime;
  }

  /** 현재 작품 시간(초). */
  get now(): number {
    return this.time;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * 실제 시각(ms, performance.now 기준)으로 한 프레임 진행한다.
   * 반환값은 이번 프레임에 반영된 작품 시간(초).
   */
  tick(realMs: number): number {
    const prev = this.last;
    this.last = realMs;
    if (prev === null || this.paused) return 0;
    const realDt = Math.min(Math.max((realMs - prev) / 1000, 0), this.maxDelta);
    const dt = realDt * this.speed;
    this.time += dt;
    return dt;
  }

  pause(): void {
    this.paused = true;
  }

  play(): void {
    this.paused = false;
    // 정지 기간을 경과 시간으로 계산하지 않는다.
    this.last = null;
  }

  toggle(): void {
    if (this.paused) this.play();
    else this.pause();
  }

  /** 탭이 가려졌다가 돌아왔을 때 등, 다음 tick의 기준 시각을 잊는다. */
  resync(): void {
    this.last = null;
  }

  seek(time: number): void {
    this.time = time;
  }

  step(dt: number): void {
    this.time += dt;
  }
}
