import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { layoutEnsemble } from '../src/form/ensemble';
import { strokeLines, traceLines } from '../src/form/ensemble-styles';
import { solveBody } from '../src/motion/body';
import { CHOREOGRAPHIES } from '../src/motion/choreography';
import { Score } from '../src/motion/score';

const E = CONFIG.ensemble;
const score = new Score(CHOREOGRAPHIES.a2);
const figs = layoutEnsemble(E.layout, score.duration);
const bodyAt = (_f: unknown, s: number) => solveBody(score, s);

describe('앙상블 스케치', () => {
  it('정해진 수의 인물이 영역 안에 겹치지 않게 놓이고, 같은 설정은 같은 배치', () => {
    expect(figs.length).toBe(E.layout.count);
    expect(JSON.stringify(layoutEnsemble(E.layout, score.duration))).toBe(JSON.stringify(figs));
    const [W, H] = E.layout.area.size;
    for (const f of figs) {
      expect(Math.abs(f.x - E.layout.area.center[0])).toBeLessThanOrEqual(W / 2);
      expect(Math.abs(f.y - E.layout.area.center[1])).toBeLessThanOrEqual(H / 2 + 1);
    }
  });

  it('인물들은 같은 안무의 서로 다른 순간에 있다', () => {
    const offsets = figs.map((f) => f.offset).sort((a, b) => a - b);
    expect(offsets[0]!).toBeGreaterThanOrEqual(0);
    expect(offsets.at(-1)!).toBeLessThan(score.duration);
    expect(offsets.at(-1)! - offsets[0]!).toBeGreaterThan(score.duration * 0.8);
  });

  it('궤적·획은 유한한 좌표와 0..1의 진하기를 가진 선을 만든다', () => {
    for (const lines of [traceLines(figs, bodyAt, 4, E.trace), strokeLines(figs, bodyAt, 4, E.stroke)]) {
      expect(lines.length).toBeGreaterThan(figs.length);
      for (const l of lines) {
        for (let i = 0; i < l.x.length; i++) {
          expect(Number.isFinite(l.x[i]! + l.y[i]!)).toBe(true);
          expect(l.a[i]!).toBeGreaterThanOrEqual(0);
          expect(l.a[i]!).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
