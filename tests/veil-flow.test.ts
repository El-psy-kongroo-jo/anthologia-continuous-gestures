import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { buildVeil, type Veil } from '../src/form/veil';
import { buildRelief } from '../src/form/veil-relief';
import { lineSpan, sheetPoint } from '../src/form/veil-sheet';
import { stillBody } from '../src/motion/still';

const C = CONFIG.flowE2m;
const P = C.sheet.motion!.period;
const body = stillBody(C.pose);
const relief = buildRelief(body, C.relief);
const at = (t: number) => buildVeil(C, body, t, relief);

/** 같은 선 번호·같은 표본 번호끼리의 평균 거리(선의 표본 수가 같은 선만) */
function meanShift(a: Veil, b: Veil): number {
  let sum = 0;
  let n = 0;
  a.lines.forEach((la, i) => {
    const lb = b.lines[i]!;
    const m = Math.min(la.x.length, lb.x.length);
    for (let s = 0; s < m; s += 5) {
      sum += Math.hypot(la.x[s]! - lb.x[s]!, la.y[s]! - lb.y[s]!);
      n++;
    }
  });
  return sum / n;
}

describe('Flow 실험 E2 · 흐름(몸 고정)', () => {
  it('몸은 고정: 흐름 시간과 무관하게 같은 몸과 같은 막 높이를 쓴다', () => {
    expect(at(0).body).toBe(at(4).body);
    expect(at(0).relief).toBe(at(4).relief);
  });

  it('주기의 끝과 시작이 이어지고, 같은 시간은 같은 선을 만든다', () => {
    expect(meanShift(at(0), at(P))).toBeLessThan(1e-6);
    expect(Array.from(at(3.3).lines[40]!.y)).toEqual(Array.from(at(3.3).lines[40]!.y));
  });

  it('프레임 사이(1/60초)의 이동은 작고, 시간이 지나면 분명히 움직인다', () => {
    let worst = 0;
    for (let t = 0; t < P; t += 0.5) worst = Math.max(worst, meanShift(at(t), at(t + 1 / 60)));
    expect(worst).toBeLessThan(0.004);
    expect(meanShift(at(0), at(P / 4))).toBeGreaterThan(0.02);
  });

  it('장 전체가 통째로 이동하지 않는다: 모든 점의 평균 위치는 거의 그대로다', () => {
    const centroid = (v: Veil) => {
      let x = 0;
      let y = 0;
      let n = 0;
      for (const l of v.lines) for (let s = 0; s < l.x.length; s++) (x += l.x[s]!), (y += l.y[s]!), n++;
      return [x / n, y / n] as const;
    };
    // 점들은 제각각 움직이지만(물결이 지나감) 평균 위치의 변화는 그보다 훨씬 작다.
    const c0 = centroid(at(0));
    for (const t of [2, 4, 6, 8]) {
      const c = centroid(at(t));
      const whole = Math.hypot(c[0] - c0[0], c[1] - c0[1]);
      expect(whole).toBeLessThan(0.03);
      expect(meanShift(at(0), at(t))).toBeGreaterThan(2 * whole);
    }
  });

  it('선이 지나는 자리마다 몸의 굴곡에 반응한다: 몸 위 같은 선의 휘는 양이 시간에 따라 달라진다', () => {
    // 선 하나가 몸 위를 지날 때 받는 솟음의 합(정지 화면의 흐름 변형을 뺀 값)은 시간마다 달라야 한다.
    const p = { x: 0, y: 0 };
    const lift = (t: number, i: number) => {
      const v = at(t);
      const l = v.lines[i]!;
      const span = lineSpan(C.sheet, i, t);
      let sum = 0;
      for (let s = 0; s < l.y.length; s++) {
        const u = span.u0 + ((span.u1 - span.u0) * s) / (l.y.length - 1);
        sheetPoint(C.sheet, u, span.v, p, t);
        sum += l.y[s]! - p.y;
      }
      return sum / l.y.length;
    };
    const values = [0, 2.5, 5, 7.5].map((t) => lift(t, 50));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.0005);
    for (const v of values) expect(v).toBeGreaterThan(0);
  });

  it('바깥 경계는 안쪽 흐름보다 늦게 따른다(같은 물결, 지연)', () => {
    // 장 중심과 바깥쪽에서 같은 시간 이동량이 다르고, 바깥쪽은 지연만큼 이전 모양을 따른다.
    const M = C.sheet.motion!;
    const p = { x: 0, y: 0 };
    const q = { x: 0, y: 0 };
    sheetPoint(C.sheet, 0.02, 0.5, p, 5);
    const noLag = { ...C.sheet, motion: { ...M, edgeLag: 0 } };
    sheetPoint(noLag, 0.02, 0.5, q, 5 - M.edgeLag);
    // 크기 배율 차이를 빼면 지연된 시간의 모양과 같은 위상이다(완전히 같지는 않으므로 근사)
    expect(Math.abs(p.y - q.y)).toBeLessThan(0.05);
  });
});
