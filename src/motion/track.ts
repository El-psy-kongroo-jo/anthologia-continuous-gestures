import { mod } from '../core/math';

export interface Key {
  t: number;
  v: number;
}

/**
 * 한 채널의 순환 키프레임 곡선.
 *
 * - 단조 3차 에르미트 보간(Fritsch–Butland 기울기)으로 키 사이에서 값이 넘치지 않는다.
 *   같은 값이 이어지는 구간은 정지가 되고, 극값에서는 속도가 0이 되어 자연스럽게 감속한다.
 * - 주기 period마다 값이 cycleDelta만큼 누적된다(한 바퀴 회전 등). 주기 경계에서도
 *   값과 속도가 연속이다.
 * - 순수 함수이므로 시간 탐색과 재현이 항상 일치한다.
 */
export class Track {
  private readonly ts: number[];
  private readonly vs: number[];
  private readonly ms: number[];

  constructor(
    keys: readonly Key[],
    readonly period: number,
    readonly cycleDelta = 0,
  ) {
    if (keys.length === 0) throw new Error('Track: 키가 없습니다.');
    if (!(period > 0)) throw new Error('Track: 주기는 0보다 커야 합니다.');
    const sorted = [...keys].sort((a, b) => a.t - b.t);
    for (let i = 0; i < sorted.length; i++) {
      const k = sorted[i]!;
      if (k.t < 0 || k.t >= period) throw new Error(`Track: 키 시간 ${k.t}이 [0, ${period}) 밖에 있습니다.`);
      if (i > 0 && k.t - sorted[i - 1]!.t < 1e-6) throw new Error(`Track: 같은 시간 ${k.t}에 키가 겹칩니다.`);
    }

    const n = sorted.length;
    const first = sorted[0]!;
    const last = sorted[n - 1]!;
    // 앞뒤로 이전·다음 주기의 키를 하나씩 덧붙여 경계를 연속으로 만든다.
    const ext: Key[] = [
      { t: last.t - period, v: last.v - cycleDelta },
      ...sorted,
      { t: first.t + period, v: first.v + cycleDelta },
    ];
    this.ts = ext.map((k) => k.t);
    this.vs = ext.map((k) => k.v);

    const tangent = (i: number): number => {
      // i는 ext 기준 1..n (실제 키). 양 끝의 덧붙인 키가 순환 이웃 역할을 한다.
      const h0 = this.ts[i]! - this.ts[i - 1]!;
      const h1 = this.ts[i + 1]! - this.ts[i]!;
      const d0 = (this.vs[i]! - this.vs[i - 1]!) / h0;
      const d1 = (this.vs[i + 1]! - this.vs[i]!) / h1;
      if (d0 === 0 || d1 === 0 || Math.sign(d0) !== Math.sign(d1)) return 0;
      return (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
    };

    const ms = new Array<number>(n + 2);
    for (let i = 1; i <= n; i++) ms[i] = tangent(i);
    ms[0] = ms[n]!;
    ms[n + 1] = ms[1]!;
    this.ms = ms;
  }

  value(t: number): number {
    const cycle = Math.floor(t / this.period);
    const local = mod(t, this.period);
    return this.local(local) + cycle * this.cycleDelta;
  }

  private local(t: number): number {
    const ts = this.ts;
    // 이진 탐색: ts[lo] <= t < ts[lo+1]
    let lo = 0;
    let hi = ts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid]! <= t) lo = mid;
      else hi = mid;
    }
    const t0 = ts[lo]!;
    const t1 = ts[lo + 1]!;
    const h = t1 - t0;
    const u = (t - t0) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const v0 = this.vs[lo]!;
    const v1 = this.vs[lo + 1]!;
    const m0 = this.ms[lo]! * h;
    const m1 = this.ms[lo + 1]! * h;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1;
  }
}
