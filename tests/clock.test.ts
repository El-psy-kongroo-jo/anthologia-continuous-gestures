import { describe, expect, it } from 'vitest';
import { Clock } from '../src/core/clock';

describe('Clock', () => {
  it('주사율과 무관하게 실제 경과 시간만큼 진행한다', () => {
    const at60 = new Clock(0.1);
    const at144 = new Clock(0.1);
    for (let i = 0; i <= 60; i++) at60.tick((i * 1000) / 60);
    for (let i = 0; i <= 144; i++) at144.tick((i * 1000) / 144);
    expect(at60.now).toBeCloseTo(1, 9);
    expect(at144.now).toBeCloseTo(1, 9);
  });

  it('긴 공백(탭 전환 등)은 한 프레임의 상한만큼만 반영한다', () => {
    const c = new Clock(1 / 15);
    c.tick(0);
    c.tick(30_000);
    expect(c.now).toBeCloseTo(1 / 15, 9);
  });

  it('resync 후에는 공백 시간을 반영하지 않는다', () => {
    const c = new Clock(1);
    c.tick(0);
    c.tick(500);
    c.resync();
    c.tick(10_000);
    expect(c.now).toBeCloseTo(0.5, 9);
  });

  it('정지 중에는 진행하지 않고, 재개 시 정지 기간을 건너뛴다', () => {
    const c = new Clock(1);
    c.tick(0);
    c.tick(200);
    c.pause();
    c.tick(5_000);
    expect(c.now).toBeCloseTo(0.2, 9);
    c.play();
    c.tick(6_000);
    c.tick(6_100);
    expect(c.now).toBeCloseTo(0.3, 9);
  });

  it('속도와 탐색', () => {
    const c = new Clock(1);
    c.speed = 0.5;
    c.tick(0);
    c.tick(1000);
    expect(c.now).toBeCloseTo(0.5, 9);
    c.seek(12.25);
    expect(c.now).toBe(12.25);
    c.step(-0.25);
    expect(c.now).toBe(12);
  });
});
