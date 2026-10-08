import { length, normalize, sub } from '../src/core/math';
import { angleBetween } from '../src/motion/constraints';
import type { Side, Vec3 } from '../src/core/types';
import { solveBody, type Body } from '../src/motion/body';
import { CHOREOGRAPHIES } from '../src/motion/choreography';
import type { Choreography, PhraseId } from '../src/motion/phrases';
import { Score } from '../src/motion/score';

export const DT = 1 / 120;
export const SIDES: Side[] = ['L', 'R'];

export function run(score: Score, from = 0, to = score.duration): Body[] {
  const out: Body[] = [];
  for (let t = from; t <= to + 1e-9; t += DT) out.push(solveBody(score, t));
  return out;
}

/** 몸의 모든 기준점 */
export function points(b: Body): Vec3[] {
  const p = [b.pelvis, b.waist, b.chest, b.neck, b.head, b.headTop];
  for (const s of SIDES) p.push(b.shoulder[s], b.elbow[s], b.wrist[s], b.handTip[s], b.hip[s], b.knee[s], b.ankle[s]);
  return p;
}

/**
 * 몸 전체의 움직임 크기: 모든 기준점 속도의 제곱평균제곱근(몸 단위/초).
 * bodies[i]와 bodies[i+1] 사이의 값이므로 길이는 bodies.length - 1.
 */
export function rmsSpeeds(bodies: readonly Body[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bodies.length; i++) {
    const a = points(bodies[i - 1]!);
    const b = points(bodies[i]!);
    let sum = 0;
    for (let j = 0; j < a.length; j++) sum += (length(sub(b[j]!, a[j]!)) / DT) ** 2;
    out.push(Math.sqrt(sum / a.length));
  }
  return out;
}

export const sectionStart = (c: Choreography, id: PhraseId, name: string) =>
  c.phrases[id].sections.find((s) => s.name === name)!.start;

/** 검사할 순서들: 각 안무의 전체 순서와 구절 하나씩 */
export const programs: { name: string; choreography: Choreography; score: Score }[] = Object.values(CHOREOGRAPHIES).flatMap(
  (c) => [
    { name: `${c.label} 전체 순서`, choreography: c, score: new Score(c) },
    ...c.order.map((id) => ({ name: `${c.label} ${c.phrases[id].title}`, choreography: c, score: new Score(c, [id]) })),
  ],
);

const STILL = 0.03;
const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const stillFraction = (v: readonly number[]) => v.filter((x) => x < STILL).length / v.length;

/**
 * 속도·연결감 지표. 모두 배속 1 기준, 몸 단위/초.
 * - still: 몸 전체 움직임이 STILL보다 작은 시간의 비율
 * - boundaryMin: 구절 경계 ±0.4초 안의 최소 움직임(경계에서 멈추는지)
 * - phrases[].prepRecoveryStill: 준비·회복 구간의 정지 비율
 * - phrases[].holdMin: 유예 구간의 최소 움직임(머묾이 남아 있는지)
 * - phrases[].peakRatio: 진행 구간의 최대/평균 움직임(가속·감속의 대비)
 * - phrases[].rise/fall: 진행 구간 최대 움직임까지 오르는 시간과 내려오는 시간(최대의 20% 기준)
 * - entry: 순서 시작 후 2.5초 안에 어깨선 방향이 바뀐 최대 각(°)과 손끝 이동 거리
 */
export function timingMetrics(c: Choreography) {
  const s = new Score(c);
  const all = rmsSpeeds(run(s, 0, s.duration));
  const boundaryMin = s.starts.map((st) => Math.min(...rmsSpeeds(run(s, st - 0.4, st + 0.4))));
  const phrases = c.order.map((id, i) => {
    const p = c.phrases[id];
    const st = s.starts[i]!;
    const sec = (n: string) => st + sectionStart(c, id, n);
    const prepRecovery = [...rmsSpeeds(run(s, st, sec('진행'))), ...rmsSpeeds(run(s, sec('회복'), st + p.duration))];
    const prog = rmsSpeeds(run(s, sec('진행'), sec('유예')));
    const peak = Math.max(...prog);
    const ip = prog.indexOf(peak);
    let a = ip;
    while (a > 0 && prog[a]! > peak * 0.2) a--;
    let b = ip;
    while (b < prog.length - 1 && prog[b]! > peak * 0.2) b++;
    return {
      id,
      duration: p.duration,
      prepRecoveryStill: stillFraction(prepRecovery),
      holdMin: Math.min(...rmsSpeeds(run(s, sec('유예'), sec('회복')))),
      peak,
      peakRatio: peak / mean(prog),
      rise: (ip - a) * DT,
      fall: (b - ip) * DT,
    };
  });
  const b0 = solveBody(s, 0);
  const shoulderDir = (b: Body) => normalize(sub(b.shoulder.L, b.shoulder.R));
  let entryAngle = 0;
  let entryHand = 0;
  for (const b of run(s, 0, 2.5)) {
    entryAngle = Math.max(entryAngle, angleBetween(shoulderDir(b0), shoulderDir(b)));
    for (const side of SIDES) entryHand = Math.max(entryHand, length(sub(b.handTip[side], b0.handTip[side])));
  }
  return {
    duration: s.duration,
    meanSpeed: mean(all),
    still: stillFraction(all),
    boundaryMin,
    phrases,
    entryAngleDeg: (entryAngle * 180) / Math.PI,
    entryHand,
  };
}
