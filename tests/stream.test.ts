import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { length, sub } from '../src/core/math';
import type { Vec3 } from '../src/core/types';
import { buildStream, type StreamStroke } from '../src/form/stream';
import { solveBody } from '../src/motion/body';
import { CHOREOGRAPHIES } from '../src/motion/choreography';
import { Score } from '../src/motion/score';

const E = CONFIG.flowE1;
const D = E.scene.length;
const score = new Score(CHOREOGRAPHIES.a2);
const bodyAt = (s: number) => solveBody(score, E.scene.from + s);
const CAMERA: Vec3 = { x: -0.4, y: 0.14, z: 0.9 };

const build = (sigma: number, presence = 1) => buildStream(E, sigma, bodyAt, CAMERA, presence);
const noBody = () => {
  throw new Error('몸의 영향이 없을 때는 몸을 읽지 않아야 한다');
};

/** 두 선 묶음의 평균 점 거리(같은 구조일 때만 의미가 있다) */
function distance(a: readonly StreamStroke[], b: readonly StreamStroke[]): number {
  const pa = a.flatMap((s) => s.points);
  const pb = b.flatMap((s) => s.points);
  expect(pa.length).toBe(pb.length);
  let sum = 0;
  for (let i = 0; i < pa.length; i++) sum += length(sub(pa[i]!, pb[i]!));
  return sum / pa.length;
}

/**
 * 두 선 묶음의 배치 차이: 한쪽의 점에서 다른 쪽의 가장 가까운 점까지 거리의 평균(양방향).
 * 띠가 앞뒤로 뒤집히는 곳에서 선이 나뉘는 개수가 달라도 비교할 수 있다.
 */
function layoutGap(a: readonly StreamStroke[], b: readonly StreamStroke[]): number {
  const pa = a.flatMap((s) => s.points);
  const pb = b.flatMap((s) => s.points);
  const one = (from: Vec3[], to: Vec3[]) => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < from.length; i += 7) {
      let best = Infinity;
      for (const q of to) best = Math.min(best, length(sub(from[i]!, q)));
      sum += best;
      n++;
    }
    return sum / n;
  };
  return (one(pa, pb) + one(pb, pa)) / 2;
}

describe('Flow 실험 E1', () => {
  it('같은 장면 시간은 같은 선을 만든다', () => {
    expect(JSON.stringify(build(6.3))).toBe(JSON.stringify(build(6.3)));
  });

  it('장면이 끊김 없이 순환하고, 프레임 사이에 튀지 않는다', () => {
    expect(distance(build(0), build(D))).toBeLessThan(1e-9);
    let worst = 0;
    for (let s = 0; s < D; s += 0.25) {
      const a = build(s);
      const b = build(s + 1 / 60);
      if (a.length === b.length && a.every((x, i) => x.points.length === b[i]!.points.length)) {
        worst = Math.max(worst, distance(a, b));
      }
    }
    // 한 프레임(1/60초) 사이 점의 평균 이동(몸 단위)
    expect(worst).toBeLessThan(0.03);
  });

  it('1. 흐름: 몸의 영향이 없으면 몸을 전혀 읽지 않는다', () => {
    for (const s of [0.5, 6.3, 11.0]) {
      const strokes = buildStream(E, s, noBody, CAMERA, 0);
      expect(strokes.length).toBeGreaterThan(0);
    }
  });

  it('2. 몸의 방향: 영향이 있는 동안 선의 배치가 흐름만의 배치와 달라진다', () => {
    expect(distance(build(1.5), build(1.5, 0))).toBeLessThan(1e-9);
    expect(layoutGap(build(6.3), build(6.3, 0))).toBeGreaterThan(0.05);
    expect(layoutGap(build(10.5), build(10.5, 0))).toBeGreaterThan(0.05);
  });

  it('3·4. 풀림과 여운: 영향이 끝난 뒤에도 잠시 직전 움직임이 남고, 이후 흐름으로 돌아간다', () => {
    // 모든 띠의 영향은 15초에 끝난다. 그 직후에는 아직 몸의 움직임이 남아 있다.
    const after = layoutGap(build(15.5), build(15.5, 0));
    expect(after).toBeGreaterThan(0.02);
    // 시간이 지나면 차이가 줄어 흐름으로 돌아간다(투명도가 아니라 위치의 변화).
    const later = layoutGap(build(18.5), build(18.5, 0));
    expect(later).toBeLessThan(after);
    for (const s of build(15.5)) expect(s.alpha).toBeGreaterThan(0.1);
  });

  it('점 수 상한과 화면 여백', () => {
    for (const s of [1.5, 6.3, 10.5, 14.7]) {
      const pts = build(s).flatMap((x) => x.points);
      expect(pts.length).toBeLessThan(8000);
      for (const p of pts) {
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(Math.abs(p.x)).toBeLessThan(1.2);
        expect(p.y).toBeGreaterThan(-0.2);
        expect(p.y).toBeLessThan(1.6);
      }
    }
  });
});
