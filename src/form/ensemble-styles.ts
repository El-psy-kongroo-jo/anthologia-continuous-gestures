import type { Vec3 } from '../core/types';
import type { Body } from '../motion/body';
import { placePoint, type Figure } from './ensemble';
import { veilVolume, buildReliefFromTapers } from './veil-relief';
import { buildVeil, type VeilConfig } from './veil';

/*
 * 앙상블의 추상 표현 세 가지. 모두 인물의 형태(외곽선·뼈대·얼굴)를 그리지 않는다.
 * 결과는 점마다 진하기를 가진 선(평면 좌표, 몸 단위)이다.
 *
 * (가) 궤적: 손끝·머리·골반·발이 최근 몇 초 동안 지나간 길. 몸짓의 리듬만 남는다.
 * (나) 획: 팔의 호와 몸통의 곡선을 조금씩 이전 순간들로 여러 번 덧그린 획. 다시 그리고 지운 선의 층.
 * (다) 장: 하나의 넓은 선의 장 위에 여러 인물이 작은 굴곡으로만 나타난다.
 */

export interface ToneLine {
  x: Float32Array;
  y: Float32Array;
  a: Float32Array;
}

/** 인물 f의 안무 시간 s의 몸 */
export type FigureBodyAt = (f: Figure, s: number) => Body;

export interface TraceStyle {
  /** 지나온 시간(초)과 표본 수 */
  span: number;
  samples: number;
  /** 진하기와 과거로 갈수록 옅어지는 곡선 */
  alpha: number;
  gamma: number;
}

const TRACE_POINTS: ((b: Body) => Vec3)[] = [
  (b) => b.handTip.L,
  (b) => b.handTip.R,
  (b) => b.elbow.L,
  (b) => b.elbow.R,
  (b) => b.knee.L,
  (b) => b.knee.R,
  (b) => b.headTop,
  (b) => b.pelvis,
  (b) => b.ankle.L,
  (b) => b.ankle.R,
];

export function traceLines(figs: readonly Figure[], bodyAt: FigureBodyAt, t: number, S: TraceStyle): ToneLine[] {
  const out: ToneLine[] = [];
  for (const f of figs) {
    const bodies: Body[] = [];
    for (let m = 0; m < S.samples; m++) bodies.push(bodyAt(f, t + f.offset - (S.span * m) / (S.samples - 1)));
    for (const pick of TRACE_POINTS) {
      const x = new Float32Array(S.samples);
      const y = new Float32Array(S.samples);
      const a = new Float32Array(S.samples);
      for (let m = 0; m < S.samples; m++) {
        const p = placePoint(f, pick(bodies[m]!));
        x[m] = p.x;
        y[m] = p.y;
        a[m] = S.alpha * f.sharp * Math.pow(1 - m / (S.samples - 1), S.gamma);
      }
      out.push({ x, y, a });
    }
  }
  return out;
}

export interface StrokeStyle {
  /** 덧그리는 횟수와 한 번마다 거슬러 가는 시간(초) */
  passes: number;
  lag: number;
  alpha: number;
  /** 곡선 한 마디를 나누는 수 */
  subdivide: number;
}

/** 팔의 호(손끝 → 어깨 → 목 → 반대쪽 손끝)와 몸통의 곡선(머리 → 골반). 다리는 그리지 않는다. */
const STROKE_CHAINS: ((b: Body) => Vec3[])[] = [
  (b) => [b.handTip.L, b.elbow.L, b.shoulder.L, b.neck, b.shoulder.R, b.elbow.R, b.handTip.R],
  (b) => [b.headTop, b.neck, b.chest, b.waist, b.pelvis],
];

/** 점들을 지나는 매끄러운 곡선(캣멀-롬) */
function smoothChain(pts: Vec3[], sub: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

export function strokeLines(figs: readonly Figure[], bodyAt: FigureBodyAt, t: number, S: StrokeStyle): ToneLine[] {
  const out: ToneLine[] = [];
  for (const f of figs) {
    for (let k = 0; k < S.passes; k++) {
      const b = bodyAt(f, t + f.offset - k * S.lag);
      const fade = S.alpha * f.sharp * (1 - k / S.passes) ** 1.4;
      for (const chain of STROKE_CHAINS) {
        const pts = smoothChain(chain(b).map((p) => placePoint(f, p)), S.subdivide);
        const n = pts.length;
        const x = new Float32Array(n);
        const y = new Float32Array(n);
        const a = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          x[i] = pts[i]!.x;
          y[i] = pts[i]!.y;
          // 획의 양 끝은 붓이 떨어지듯 옅어진다.
          const e = Math.min(i, n - 1 - i) / Math.max(1, n * 0.2);
          a[i] = fade * Math.min(1, e);
        }
        out.push({ x, y, a });
      }
    }
  }
  return out;
}

/** (다) 여러 인물의 부피로 만든 하나의 막 위로 같은 선의 장이 지나간다. 인물의 선명함은 굴곡의 높이가 된다. */
export function fieldLines(figs: readonly Figure[], bodyAt: FigureBodyAt, t: number, V: VeilConfig): ToneLine[] {
  const tapers = [];
  let first: Body | null = null;
  for (const f of figs) {
    const b = bodyAt(f, t + f.offset);
    first ??= b;
    const k = f.scale * (0.4 + 0.6 * f.sharp);
    for (const tp of veilVolume(b)) {
      const a = placePoint(f, tp.a);
      const bb = placePoint(f, tp.b);
      // 흐린 인물은 낮게 솟는다(부피를 줄여 막이 덜 솟게 한다).
      tapers.push({ a, b: bb, ra: tp.ra * k, rb: tp.rb * k, zc: placePoint(f, b.pelvis).z });
    }
  }
  const relief = buildReliefFromTapers(tapers, V.relief);
  return buildVeil(V, first!, 0, relief).lines;
}
