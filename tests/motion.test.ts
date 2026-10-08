import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { distance, length, normalize, sub } from '../src/core/math';
import { angleBetween } from '../src/motion/constraints';
import type { Vec3 } from '../src/core/types';
import { distributeLoad, solveBody, type Body } from '../src/motion/body';
import { CHOREOGRAPHIES } from '../src/motion/choreography';
import { Score } from '../src/motion/score';
import { DT, SIDES, points, programs, run, sectionStart } from './helpers';

const B = CONFIG.body;
const ALL = Object.values(CHOREOGRAPHIES);

// 순환 경계를 지나도록 한 주기 + 1초를 검사한다.
const samples = new Map(programs.map(({ name, score }) => [name, run(score, -0.5, score.duration + 1)]));

describe('안무 구절의 구조', () => {
  it.each(ALL.flatMap((c) => Object.values(c.phrases).map((p) => ({ ...p, label: `${c.label} ${p.title}` }))))(
    '$label: 6~14초, 준비·진행·유예·회복 순서', (p) => {
    expect(p.duration).toBeGreaterThanOrEqual(6);
    expect(p.duration).toBeLessThanOrEqual(14);
    expect(p.sections.map((s) => s.name)).toEqual(['준비', '진행', '유예', '회복']);
    expect(p.sections[0]!.start).toBe(0);
    for (let i = 1; i < p.sections.length; i++) expect(p.sections[i]!.start).toBeGreaterThan(p.sections[i - 1]!.start);
    expect(p.sections.at(-1)!.start).toBeLessThan(p.duration);
  });

  it.each(ALL)('$label: 시간 위치를 구절과 부분으로 찾는다', (c) => {
    const s = new Score(c);
    const P = c.phrases;
    expect(s.duration).toBeCloseTo(P.shift.duration + P.open.duration + P.turn.duration, 9);
    const loc = s.locate(P.shift.duration + 3);
    expect(loc.phrase.id).toBe('open');
    expect(loc.local).toBeCloseTo(3, 9);
    expect(loc.section).toBe('진행');
    expect(s.locate(s.duration + 0.1).phrase.id).toBe('shift');
    expect(s.locate(-0.1).phrase.id).toBe('turn');
  });
});

describe.each(programs)('몸의 제약 — $name', ({ name, score }) => {
  const bodies = samples.get(name)!;

  it('팔다리와 몸통의 길이가 변하지 않는다', () => {
    for (const b of bodies) {
      for (const s of SIDES) {
        expect(distance(b.hip[s], b.knee[s])).toBeCloseTo(B.thigh, 9);
        expect(distance(b.knee[s], b.ankle[s])).toBeCloseTo(B.shin, 9);
        expect(distance(b.shoulder[s], b.elbow[s])).toBeCloseTo(B.upperArm, 9);
        expect(distance(b.elbow[s], b.wrist[s])).toBeCloseTo(B.forearm, 9);
        expect(distance(b.wrist[s], b.handTip[s])).toBeCloseTo(B.hand, 9);
      }
      expect(distance(b.pelvis, b.waist)).toBeCloseTo(B.spine / 2, 9);
      expect(distance(b.waist, b.chest)).toBeCloseTo(B.spine / 2, 9);
    }
  });

  it('하중이 실린 발은 미끄러지지 않는다', () => {
    let checked = 0;
    for (let i = 1; i < bodies.length; i++) {
      const a = bodies[i - 1]!;
      const b = bodies[i]!;
      for (const s of SIDES) {
        if (a.load[s] >= 0.15 && b.load[s] >= 0.15) {
          expect(distance(a.ankle[s], b.ankle[s]), `${name} t=${b.time.toFixed(3)} ${s}`).toBeLessThan(1e-9);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(bodies.length);
  });

  it('발은 하중이 빠진 뒤에만 바닥을 떠난다', () => {
    for (const b of bodies) {
      // 접촉과 무관하게 무게 중심 위치만으로 나눈 몫
      const share = distributeLoad(b.com, b.ankle, { L: 1, R: 1 }).load;
      for (const s of SIDES) {
        if (b.contact[s] < 0.999) expect(share[s], `${name} t=${b.time.toFixed(3)} ${s}`).toBeLessThan(0.2);
      }
    }
  });

  it('한 발로 설 때 무게 중심이 지지하는 발 위에 있다', () => {
    let maxErr = 0;
    for (const b of bodies) {
      if (b.contact.L < 0.5 || b.contact.R < 0.5) maxErr = Math.max(maxErr, b.balanceError);
    }
    expect(maxErr).toBeLessThan(0.03);
  });

  it('안무가 다리 길이 안에서 쓰여 있다(골반 보정이 작다)', () => {
    const maxCorrection = Math.max(...bodies.map((b) => b.pelvisCorrection));
    expect(maxCorrection).toBeLessThan(0.004);
  });

  it('구절 경계와 순환 경계를 포함해 기준점이 튀지 않는다', () => {
    let maxSpeed = 0;
    let maxAccel = 0;
    for (let i = 2; i < bodies.length; i++) {
      const p0 = points(bodies[i - 2]!);
      const p1 = points(bodies[i - 1]!);
      const p2 = points(bodies[i]!);
      for (let j = 0; j < p1.length; j++) {
        const v1 = length(sub(p1[j]!, p0[j]!)) / DT;
        const v2 = sub(p2[j]!, p1[j]!);
        const a = length(sub(v2, sub(p1[j]!, p0[j]!))) / (DT * DT);
        maxSpeed = Math.max(maxSpeed, v1);
        maxAccel = Math.max(maxAccel, a);
      }
    }
    // 몸 단위/초. 키 1.0인 몸에서 3.0/s는 매우 빠른 손끝 움직임에 해당한다.
    expect(maxSpeed).toBeLessThan(3);
    expect(maxAccel).toBeLessThan(60);
  });

  it('같은 시간은 같은 장면을 만든다(탐색·재현)', () => {
    for (const t of [0.37, 4.2, score.duration * 0.73]) {
      const a = points(solveBody(score, t));
      const b = points(solveBody(score, t));
      const c = points(solveBody(score, t + score.duration));
      for (let j = 0; j < a.length; j++) {
        expect(distance(a[j]!, b[j]!)).toBe(0);
        expect(distance(a[j]!, c[j]!)).toBeLessThan(1e-9);
      }
    }
  });
});

describe.each(ALL)('구절이 보여야 할 감각 — $label', (c) => {
  const start = (id: 'shift' | 'open' | 'turn', name: string) => sectionStart(c, id, name);
  /** 값이 구간 첫 값에서 최댓값까지 절반 도달한 시각 */
  const halfRise = (bs: Body[], f: (b: Body) => number) => {
    const v = bs.map(f);
    const lo = v[0]!;
    const hi = Math.max(...v);
    return bs[v.findIndex((x) => x >= (lo + hi) / 2)]!.time;
  };
  /** 마디의 방향이 구간 끝의 방향까지 절반(각도 기준) 바뀐 시각 */
  const halfTurn = (bs: Body[], f: (b: Body) => Vec3) => {
    const d = bs.map((b) => normalize(f(b)));
    const end = d.at(-1)!;
    const a0 = angleBetween(d[0]!, end);
    return bs[d.findIndex((x) => angleBetween(x, end) <= a0 / 2)]!.time;
  };

  it('무게 옮기기: 한 발로 완전히 건너가고, 몸통 기울기는 골반 이동보다 늦다', () => {
    const score = new Score(c, ['shift']);
    const bs = run(score, 0, c.phrases.shift.duration);
    expect(Math.max(...bs.map((b) => b.load.R))).toBeGreaterThan(0.95);
    // 단순한 좌우 흔들림이 아니라 높낮이 변화가 함께 있다.
    const ys = bs.map((b) => b.pelvis.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.015);
    // 진행 구간: 골반의 이동보다 어깨 띠의 기울기가 늦게 절반에 이른다.
    const prog = run(score, start('shift', '진행'), start('shift', '유예') + 1);
    const pelvis = halfRise(prog, (b) => -b.pelvis.x);
    const tilt = halfRise(prog, (b) => b.shoulder.L.y - b.shoulder.R.y);
    expect(tilt - pelvis).toBeGreaterThan(0.5);
  });

  it('펼치기: 몸통 → 위팔 → 아래팔 → 손끝 순서로 펼쳐진다', () => {
    const score = new Score(c, ['open']);
    const bs = run(score, start('open', '진행'), start('open', '유예') + 0.6);
    for (const s of SIDES) {
      const spine = halfTurn(bs, (b) => sub(b.neck, b.pelvis));
      const upper = halfTurn(bs, (b) => sub(b.elbow[s], b.shoulder[s]));
      const fore = halfTurn(bs, (b) => sub(b.wrist[s], b.elbow[s]));
      const hand = halfTurn(bs, (b) => sub(b.handTip[s], b.wrist[s]));
      expect(upper - spine, s).toBeGreaterThan(0.3);
      expect(fore - upper, s).toBeGreaterThan(0.1);
      expect(hand - fore, s).toBeGreaterThan(0.1);
    }
  });

  it('방향 바꾸기: 어깨가 골반보다 먼저 돌고, 한 바퀴를 돌아 같은 방향에 선다', () => {
    const score = new Score(c, ['turn']);
    const crossing = (ch: 'cYaw' | 'pYaw', v: number) => {
      for (let t = 0; t < c.phrases.turn.duration; t += DT) if (score.sample(t)[ch] >= v) return t;
      return Infinity;
    };
    for (const v of [Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      expect(crossing('pYaw', v) - crossing('cYaw', v)).toBeGreaterThan(0.1);
    }
    // 회전 중(골반이 뒤를 볼 때) 왼발은 들려 있고 오른발 하나로 버틴다.
    const mid = solveBody(score, crossing('pYaw', Math.PI));
    expect(mid.contact.L).toBe(0);
    expect(mid.load.R).toBe(1);
    const landed = score.sample(start('turn', '유예'));
    expect(Math.cos(landed.pYaw)).toBeCloseTo(1, 3);
  });
});
