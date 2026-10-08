import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { buildVeil } from '../src/form/veil';
import { sampleRelief, veilVolume } from '../src/form/veil-relief';
import { stillBody } from '../src/motion/still';

const C = CONFIG.flowE2;
const body = stillBody(C.pose);
const veil = buildVeil(C, body);

/** 몸 부피의 정면 경계 상자 */
function bodyBox() {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of veilVolume(body)) {
    const r = Math.max(t.ra, t.rb);
    for (const p of [t.a, t.b]) {
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      y0 = Math.min(y0, p.y - r);
      y1 = Math.max(y1, p.y + r);
    }
  }
  return { x0, x1, y0, y1 };
}

describe('Flow 실험 E2 · 선의 장 (고정 자세)', () => {
  it('자세: 세워진 몸. 머리 위, 골반 아래, 지지 다리는 아래로, 한 팔은 위·다른 팔은 옆', () => {
    expect(body.headTop.y).toBeGreaterThan(body.chest.y);
    expect(body.chest.y).toBeGreaterThan(body.pelvis.y);
    expect(body.pelvis.y).toBeGreaterThan(body.knee.R.y);
    expect(body.knee.R.y).toBeGreaterThan(body.ankle.R.y);
    expect(body.load.R).toBeGreaterThan(0.9);
    expect(body.handTip.L.y).toBeGreaterThan(body.headTop.y);
    expect(Math.abs(body.handTip.R.y - body.shoulder.R.y)).toBeLessThan(0.12);
    expect(body.shoulder.R.x - body.handTip.R.x).toBeGreaterThan(0.3);
  });

  it('같은 설정은 같은 선을 만든다', () => {
    const again = buildVeil(C, stillBody(C.pose));
    expect(again.lines.length).toBe(veil.lines.length);
    for (let i = 0; i < veil.lines.length; i += 17) {
      expect(Array.from(again.lines[i]!.y)).toEqual(Array.from(veil.lines[i]!.y));
      expect(Array.from(again.lines[i]!.a)).toEqual(Array.from(veil.lines[i]!.a));
    }
  });

  it('선의 장은 몸보다 훨씬 넓고, 몸 높이를 지나는 선은 몸 양쪽 바깥까지 이어진다', () => {
    const box = bodyBox();
    let minX = Infinity;
    let maxX = -Infinity;
    for (const l of veil.lines) for (const x of l.x) (minX = Math.min(minX, x)), (maxX = Math.max(maxX, x));
    expect(maxX - minX).toBeGreaterThan(2 * (box.x1 - box.x0));
    let crossing = 0;
    for (const l of veil.lines) {
      const mid = l.y[Math.floor(l.y.length / 2)]!;
      if (mid < box.y0 || mid > box.y1) continue;
      crossing++;
      expect(l.x[0]!).toBeLessThan(box.x0 - 0.12);
      expect(l.x[l.x.length - 1]!).toBeGreaterThan(box.x1 + 0.2);
    }
    expect(crossing).toBeGreaterThan(60);
  });

  it('몸의 영향은 국소적이다: 몸에서 먼 곳의 막 높이는 0', () => {
    const s = { h: 0, gx: 0, gy: 0, near: 0 };
    const box = bodyBox();
    for (const [x, y] of [
      [box.x0 - 0.5, 0.6],
      [box.x1 + 0.5, 0.6],
      [0, box.y1 + 0.5],
    ] as const) {
      sampleRelief(veil.relief, x, y, s);
      expect(s.h).toBe(0);
      expect(s.near).toBe(0);
    }
    expect(veil.relief.maxHeight).toBeGreaterThan(0.05);
  });

  it('농도: 몸 위는 진하고 먼 곳은 옅으며, 한 선을 따라 갑자기 바뀌지 않는다', () => {
    const box = bodyBox();
    const cx = (box.x0 + box.x1) / 2;
    let onSum = 0;
    let onN = 0;
    let farSum = 0;
    let farN = 0;
    let worstStep = 0;
    for (const l of veil.lines) {
      for (let s = 0; s < l.x.length; s++) {
        const a = l.a[s]!;
        expect(a).toBeLessThanOrEqual(C.tone.max + 1e-6);
        if (s > 0 && a > 0 && l.a[s - 1]! > 0) {
          // 선을 따라 지난 거리당 변화(가파르게 휜 곳에서는 표본 사이의 거리가 길다)
          const ds = Math.max(0.0035, Math.hypot(l.x[s]! - l.x[s - 1]!, l.y[s]! - l.y[s - 1]!));
          worstStep = Math.max(worstStep, Math.abs(a - l.a[s - 1]!) / ds);
        }
        if (a <= 0) continue;
        const x = l.x[s]!;
        const y = l.y[s]!;
        if (Math.abs(x - cx) < 0.08 && y > box.y0 + 0.2 && y < box.y1 - 0.3) (onSum += a), onN++;
        if (Math.abs(x - cx) > 0.65) (farSum += a), farN++;
      }
    }
    expect(onSum / onN).toBeGreaterThan(2 * (farSum / farN));
    // 몸 단위 길이당 변화: 0.01(화면에서 약 8px) 사이에 0.25 미만
    expect(worstStep).toBeLessThan(25);
  });

  it('가장자리: 선의 끝 위치가 선마다 다르되, 이웃한 선끼리는 완만하게 이어진다', () => {
    const starts = veil.lines.map((l) => l.x[0]!);
    const mean = starts.reduce((a, b) => a + b, 0) / starts.length;
    const spread = Math.sqrt(starts.reduce((a, b) => a + (b - mean) ** 2, 0) / starts.length);
    expect(spread).toBeGreaterThan(0.04);
    const steps = starts.slice(1).map((x, i) => Math.abs(x - starts[i]!));
    steps.sort((a, b) => a - b);
    expect(steps[Math.floor(steps.length / 2)]!).toBeLessThan(0.03);
  });

  it('솟은 면 뒤로 숨는 선은 일부이고, 점 수와 좌표가 유한하다', () => {
    let hidden = 0;
    let total = 0;
    for (const l of veil.lines) {
      for (let s = 0; s < l.x.length; s++) {
        total++;
        if (l.a[s] === 0) hidden++;
        expect(Number.isFinite(l.x[s]! + l.y[s]!)).toBe(true);
      }
    }
    expect(hidden / total).toBeLessThan(0.08);
    expect(total).toBeLessThan(120000);
  });
});
