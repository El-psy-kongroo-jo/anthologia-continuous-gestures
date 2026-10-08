import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { buildFlow, type FlowGeometry } from '../src/form/flow';
import { INERTIA_DT, INERTIA_SAMPLES, inertiaWeights, stepResponse } from '../src/form/inertia';
import type { Vec3 } from '../src/core/types';
import { solveBody, type Body } from '../src/motion/body';
import { CHOREOGRAPHIES } from '../src/motion/choreography';
import { Score } from '../src/motion/score';

const score = new Score(CHOREOGRAPHIES.a2);
const CAMERA: Vec3 = { x: -0.4, y: 0.14, z: 0.9 };
const BASE = CONFIG.flow.presets[2];

const historyOf = (t: number) => (k: number) => solveBody(score, t - k * INERTIA_DT);

/** 몸 전체를 x 방향으로 dx만큼 옮긴 사본 */
function shifted(b: Body, dx: number): Body {
  const move = (v: unknown): unknown => {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ('x' in o && 'y' in o && 'z' in o) return { x: (o.x as number) + dx, y: o.y, z: o.z };
      return Object.fromEntries(Object.entries(o).map(([k, w]) => [k, k === 'facing' ? w : move(w)]));
    }
    return v;
  };
  return move(b) as Body;
}

const allPoints = (g: FlowGeometry) => g.sheets.flatMap((s) => s.points.flat());

describe('관성 응답', () => {
  it('가중치의 합은 1이고, 짧은 주기는 지금의 몸을 거의 그대로 따른다', () => {
    for (const period of [0.12, 0.5, 1.1]) {
      const w = inertiaWeights(period, 0.42);
      expect(w).toHaveLength(INERTIA_SAMPLES);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    }
    const near = inertiaWeights(0.12, 0.42);
    expect(near[0]! + near[1]! + near[2]!).toBeGreaterThan(0.9);
  });

  it('감쇠가 1보다 작으면 멈춘 뒤에도 잠시 같은 방향으로 지나쳤다가 돌아온다', () => {
    const peak = Math.max(...Array.from({ length: 200 }, (_, i) => stepResponse(i * 0.01, 1.1, 0.42)));
    expect(peak).toBeGreaterThan(1.05);
    expect(stepResponse(5, 1.1, 0.42)).toBeCloseTo(1, 2);
  });
});

describe('Flow 기하', () => {
  it('같은 몸과 시간은 같은 선을 만들고, 몸 상태를 바꾸지 않는다(모드 전환에 안전)', () => {
    const t = 11.3;
    const before = JSON.stringify(solveBody(score, t));
    const a = buildFlow(historyOf(t), t, score.duration, BASE, CAMERA);
    const b = buildFlow(historyOf(t), t, score.duration, BASE, CAMERA);
    expect(JSON.stringify(a.sheets)).toBe(JSON.stringify(b.sheets));
    expect(JSON.stringify(solveBody(score, t))).toBe(before);
  });

  it.each([1, 2, 3] as const)('설정 %i: 점 수 상한, 유한한 좌표, 화면 여백 안', (id) => {
    const P = CONFIG.flow.presets[id];
    for (const t of [9.5, 11.5, 18.8, 21.8]) {
      const pts = allPoints(buildFlow(historyOf(t), t, score.duration, P, CAMERA));
      expect(pts.length).toBeLessThan(8000);
      for (const p of pts) {
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(Math.abs(p.x)).toBeLessThan(1.2);
        expect(p.y).toBeGreaterThan(-0.1);
        expect(p.y).toBeLessThan(1.6);
      }
    }
  });

  /**
   * 몸이 +x로 일정하게 움직이다 지금(0초) 멈추는 가상의 이력.
   * now초 뒤의 천을, 멈춘 자리에서 정지해 있던 천과 비교한 x 차이(면별 걸린 곳·자유로운 끝).
   */
  function lagAfterStop(now: number): { contact: number; tail: number } {
    const rest = solveBody(score, 21.8);
    const speed = 0.6;
    const x = (time: number) => speed * Math.min(time, 0);
    const moving = buildFlow((k) => shifted(rest, x(now - k * INERTIA_DT)), 21.8, score.duration, BASE, CAMERA);
    const still = buildFlow(() => rest, 21.8, score.duration, BASE, CAMERA);
    // 앞쪽 면(scarf)의 가운데 결: 처음(손목 쪽, 걸린 곳)과 마지막(끌리는 끝)
    const s = 1;
    const line = (g: FlowGeometry) => g.sheets[s]!.points[g.sheets[s]!.points.length >> 1]!;
    const m = line(moving);
    const r = line(still);
    const at = (i: number) => m[i]!.x - r[i]!.x;
    return { contact: at(Math.round(m.length * 0.4)), tail: at(m.length - 1) };
  }

  it('몸 가까운 곳은 빠르게, 먼 곳은 늦게 따라온다', () => {
    const d = lagAfterStop(0);
    // 움직이는 중: 끝자락은 걸린 곳보다 훨씬 뒤처져 있다(-x).
    expect(d.tail).toBeLessThan(-0.05);
    expect(Math.abs(d.contact)).toBeLessThan(Math.abs(d.tail) / 3);
  });

  it('몸이 멈춘 뒤에도 먼 곳은 이전 방향(+x)으로 계속 가서 멈춘 자리를 지나쳤다가 돌아온다', () => {
    const tails = [0, 0.15, 0.3, 0.45, 0.6, 0.9, 1.3].map((now) => lagAfterStop(now).tail);
    // 멈춘 직후에도 같은 방향으로 움직인다.
    expect(tails[1]!).toBeGreaterThan(tails[0]! + 0.02);
    // 멈춘 자리를 지나친다(+x).
    const peak = Math.max(...tails);
    expect(peak).toBeGreaterThan(0.01);
    // 그 뒤 돌아온다.
    expect(tails.at(-1)!).toBeLessThan(peak);
  });
});
