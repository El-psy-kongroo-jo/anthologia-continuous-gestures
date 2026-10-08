import { describe, expect, it } from 'vitest';
import { Track } from '../src/motion/track';

const deriv = (tr: Track, t: number, h = 1e-5) => (tr.value(t + h) - tr.value(t - h)) / (2 * h);

describe('Track', () => {
  const keys = [
    { t: 0, v: 0 },
    { t: 1, v: 1 },
    { t: 2, v: 1 },
    { t: 3, v: -0.5 },
  ];
  const tr = new Track(keys, 4);

  it('키 값을 정확히 지난다', () => {
    for (const k of keys) expect(tr.value(k.t)).toBeCloseTo(k.v, 12);
  });

  it('키 사이에서 값이 넘치지 않는다(단조 보간)', () => {
    for (let t = 0; t < 4; t += 0.001) {
      const v = tr.value(t);
      expect(v).toBeLessThanOrEqual(1 + 1e-12);
      expect(v).toBeGreaterThanOrEqual(-0.5 - 1e-12);
    }
    // 같은 값이 이어지는 구간은 정지
    expect(tr.value(1.5)).toBeCloseTo(1, 12);
  });

  it('주기 경계에서 값과 속도가 연속이다', () => {
    const T = 4;
    expect(tr.value(T - 1e-9)).toBeCloseTo(tr.value(T), 6);
    expect(deriv(tr, T - 1e-3)).toBeCloseTo(deriv(tr, T + 1e-3), 1);
    expect(tr.value(-1)).toBeCloseTo(tr.value(3), 12);
  });

  it('누적 회전(cycleDelta)이 주기마다 더해지고 경계에서 이어진다', () => {
    const spin = new Track([{ t: 0, v: 0 }, { t: 2, v: Math.PI * 2 }], 4, Math.PI * 2);
    expect(spin.value(4)).toBeCloseTo(Math.PI * 2, 12);
    expect(spin.value(6)).toBeCloseTo(Math.PI * 4, 12);
    expect(spin.value(4 - 1e-9)).toBeCloseTo(spin.value(4), 6);
    // 보간 중 역회전하지 않는다.
    let prev = spin.value(0);
    for (let t = 0; t < 12; t += 0.01) {
      const v = spin.value(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  it('잘못된 키를 거부한다', () => {
    expect(() => new Track([], 1)).toThrow();
    expect(() => new Track([{ t: 1, v: 0 }], 1)).toThrow();
    expect(() => new Track([{ t: 0.5, v: 0 }, { t: 0.5, v: 1 }], 1)).toThrow();
  });
});
