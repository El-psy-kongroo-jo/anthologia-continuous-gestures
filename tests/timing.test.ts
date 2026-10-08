import { describe, expect, it } from 'vitest';
import { A1 } from '../src/motion/phrases-a1';
import { A2 } from '../src/motion/phrases-a2';
import { timingMetrics } from './helpers';

/**
 * A-2(현재)가 A-1(이전)보다 속도·연결감에서 나아졌는지 검사한다.
 * 이 지표는 움직임의 양과 연속성을 잴 뿐, 안무가 좋아졌다는 예술적 판단은 아니다.
 */
describe('속도와 연결감: A-2 대 A-1', () => {
  const a1 = timingMetrics(A1);
  const a2 = timingMetrics(A2);

  it('변화가 거의 없는 시간이 줄었다', () => {
    expect(a2.duration).toBeLessThan(a1.duration);
    expect(a2.still).toBeLessThan(a1.still - 0.05);
    const prepRec = (m: typeof a1) => m.phrases.reduce((s, p) => s + p.prepRecoveryStill * p.duration, 0);
    expect(prepRec(a2)).toBeLessThan(prepRec(a1) * 0.6);
  });

  it('구절 경계에서 멈추지 않고 흐른다', () => {
    a2.boundaryMin.forEach((v, i) => {
      expect(v, `경계 ${i}`).toBeGreaterThan(0.025);
      expect(v, `경계 ${i}`).toBeGreaterThan(a1.boundaryMin[i]! * 2);
    });
  });

  it('유예의 머묾은 남아 있다', () => {
    for (const p of a2.phrases) expect(p.holdMin, p.id).toBeLessThan(0.04);
  });

  it('펼치기와 회전의 주요 동작은 빠르게 오르고 길게 감속한다', () => {
    for (const id of ['open', 'turn'] as const) {
      const p2 = a2.phrases.find((p) => p.id === id)!;
      const p1 = a1.phrases.find((p) => p.id === id)!;
      expect(p2.peak, id).toBeGreaterThan(p1.peak * 1.4);
      expect(p2.peakRatio, id).toBeGreaterThan(p1.peakRatio + 0.3);
      expect(p2.rise, id).toBeLessThan(p2.fall);
    }
  });

  it('시작 후 2.5초 안에 방향 변화와 확장이 보인다', () => {
    expect(a2.entryAngleDeg).toBeGreaterThan(10);
    expect(a2.entryHand).toBeGreaterThan(0.12);
    expect(a2.entryAngleDeg).toBeGreaterThan(a1.entryAngleDeg * 5);
  });
});
