import { add, clamp, cross, dot, length, lerp, normalize, reject, scale, smoothstep, sub, v3, vlerp } from '../core/math';
import type { Side, Vec3 } from '../core/types';
import type { Body } from '../motion/body';
import { flowField } from './field';
import { INERTIA_SAMPLES, inertiaWeights } from './inertia';
import { bodyCapsules, bodyDistance, drapeOnto, prepareVolume, type Capsule, type Distance } from './volume';

/*
 * Flow 표현의 기하: 천처럼 연속적으로 흐르는 선들 사이에서 몸이 드러나게 한다.
 *
 * 천은 폭이 넓은 긴 면(스카프·자락)이며 몸에 '걸리는 곳'들을 지나간다.
 * - 앞쪽 두 면: 자유롭게 늘어진 끝 → 들어 올린 팔 → 어깨 → 가슴을 가로질러 → 반대쪽 골반을 감고
 *   → 뒤로 끌리는 끝. 두 면은 가슴 위에서 엇갈린다.
 * - 뒤쪽 면: 목 뒤에서 등을 타고 뒤로 넓게 흐른다.
 * 선은 면의 길이 방향으로 흐르는 결이다. 면은 몸 위에 눕도록 방향을 잡고 몸 표면에 감기므로,
 * 몸의 곡면을 넘을 때 결이 휘고 표면이 돌아서는 곳에서 촘촘해져 외곽선 없이 부피가 드러난다.
 * 면들 사이(옆구리·다리·머리)로는 몸이 비치고, 보이지 않는 몸이 뒤의 결을 가려 드러난다.
 *
 * 걸린 곳은 몸을 빠르게 따르고, 자유로운 끝은 관성 응답(inertia.ts)으로 이전 움직임의 방향을
 * 잠시 유지하다 따라온다. 모든 계산은 몸 상태(과거 시점 포함)와 시간만의 순수 함수다.
 */

export type JointName =
  | 'pelvis' | 'waist' | 'chest' | 'neck' | 'head' | 'headTop'
  | 'shoulderL' | 'elbowL' | 'wristL' | 'hipL' | 'kneeL' | 'ankleL'
  | 'shoulderR' | 'elbowR' | 'wristR' | 'hipR' | 'kneeR' | 'ankleR';

/** 기준점 하나, 또는 두 기준점 사이(비율)의 점 */
export type AnchorRef = JointName | readonly [JointName, JointName, number];

/** 면의 중심선이 지나는 점 */
export interface PathAnchor {
  at: AnchorRef;
  /** 위, 몸 앞(음수면 뒤), 바깥(해당 쪽 side 방향)으로 옮기는 거리 */
  up?: number;
  forward?: number;
  out?: number;
  /** 이 점에서의 면의 폭(몸 단위) */
  width: number;
  /** 0 = 몸을 그대로 따름(걸린 곳), 1 = 관성으로 가장 늦게 따름(자유로운 끝) */
  free: number;
}

export interface SheetPreset {
  /** 바깥 방향의 기준이 되는 몸의 쪽(L·R), 가운데 면이면 null */
  side: Side | null;
  path: readonly PathAnchor[];
  /** 결(선)의 개수 */
  lines: number;
  /** 결 하나의 표본 수 */
  samples: number;
  /** 몸 표면에서 떠 있는 높이. 겹치는 면의 앞뒤를 정한다 */
  standoff: number;
  /** 자유로운 부분이 아래로 처지는 정도 */
  sag: number;
  /** 천이 모일 때 깊어지는 세로 주름(결과 나란한 주름): 진폭과 폭 전체의 주름 수 */
  folds: { amp: number; count: number };
  /** 양 끝에서 결이 엇갈려 시작·끝나는 길이(비율) */
  fadeEnds: number;
  /** 면의 양 가장자리 결이 짧아지는 정도 */
  fadeSides: number;
  alpha: number;
}

export interface FlowPreset {
  label: string;
  sheets: readonly SheetPreset[];
  /** 몸의 부피를 이어 붙이는 부드러움 */
  smooth: number;
  /** 몸 표면에서 이 거리 안의 천은 몸에 붙는다 */
  looseness: number;
  /** 몸에 붙는 정도(0..1) */
  cling: number;
  /** 몸 안으로 들어간 천을 밀어내는 정도(0..1) */
  push: number;
  /** 관성: 몸 가까운 천과 먼 천의 응답 주기(초), 감쇠(1보다 작으면 지나쳤다 돌아옴) */
  inertia: { near: number; far: number; damping: number };
  /** 공기 중의 아주 약한 공유 변형장 */
  field: { amp: number; wavelength: number };
  lineWidth: number;
  /** 접혀서 안쪽 면을 보이는 곳의 선 진하기 배율 */
  backAlpha: number;
  /** 앞의 천이 뒤의 선을 가리는 정도(0 = 모두 비침, 1 = 완전히 가림) */
  occlusion: number;
  /** 보이지 않는 몸이 뒤의 천을 가리는 정도 */
  bodyOcclusion: number;
}

/** 천 한 장의 격자 points[k][i]: 결 k마다 i 방향(면의 길이 방향)으로 이어진다. */
export interface FlowSheet {
  points: Vec3[][];
  /** 0..1, 문턱보다 낮으면 그 점에서 결이 끊긴다 */
  fade: number[][];
  /** 그 점에서 천의 바깥면이 카메라를 향하는지 */
  front: boolean[][];
  alpha: number;
}

export interface FlowGeometry {
  sheets: FlowSheet[];
  /** 가림에 쓰는 보이지 않는 몸 */
  body: Capsule[];
}

const UP = v3(0, 1, 0);
/** 천이 놓일 수 있는 가장 낮은 높이(바닥) */
const FLOOR = 0.004;

function joint(b: Body, name: JointName): Vec3 {
  switch (name) {
    case 'pelvis': return b.pelvis;
    case 'waist': return b.waist;
    case 'chest': return b.chest;
    case 'neck': return b.neck;
    case 'head': return b.head;
    case 'headTop': return b.headTop;
    case 'shoulderL': return b.shoulder.L;
    case 'elbowL': return b.elbow.L;
    case 'wristL': return b.wrist.L;
    case 'hipL': return b.hip.L;
    case 'kneeL': return b.knee.L;
    case 'ankleL': return b.ankle.L;
    case 'shoulderR': return b.shoulder.R;
    case 'elbowR': return b.elbow.R;
    case 'wristR': return b.wrist.R;
    case 'hipR': return b.hip.R;
    case 'kneeR': return b.knee.R;
    case 'ankleR': return b.ankle.R;
  }
}

function resolve(b: Body, ref: AnchorRef): Vec3 {
  if (typeof ref === 'string') return joint(b, ref);
  const [a, c, k] = ref;
  return vlerp(joint(b, a), joint(b, c), k);
}

/** 한 시점의 몸에서 면의 중심선이 지나는 점들 */
function anchorsAt(b: Body, S: SheetPreset): Vec3[] {
  const left = v3(b.facing.z, 0, -b.facing.x);
  const out = S.side === 'R' ? scale(left, -1) : left;
  return S.path.map((a) =>
    add(
      add(add(resolve(b, a.at), scale(UP, a.up ?? 0)), scale(b.facing, a.forward ?? 0)),
      scale(out, a.out ?? 0),
    ),
  );
}

const catmull = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);

/** 매개변수 g(0..n-1)에서 점들을 지나는 매끄러운 곡선의 위치 */
function curveAt(pts: readonly Vec3[], g: number): Vec3 {
  const n = pts.length;
  const P = (i: number): Vec3 =>
    i < 0 ? sub(scale(pts[0]!, 2), pts[1]!) : i >= n ? sub(scale(pts[n - 1]!, 2), pts[n - 2]!) : pts[i]!;
  const i = Math.min(n - 2, Math.floor(g));
  const u = g - i;
  const [a, b, c, d] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
  return v3(catmull(a.x, b.x, c.x, d.x, u), catmull(a.y, b.y, c.y, d.y, u), catmull(a.z, b.z, c.z, d.z, u));
}

const scalarAt = (vals: readonly number[], g: number) => {
  const n = vals.length;
  const v = (i: number) => vals[Math.min(n - 1, Math.max(0, i))]!;
  const i = Math.min(n - 2, Math.floor(g));
  return catmull(v(i - 1), v(i), v(i + 1), v(i + 2), g - i);
};

/** 관성 응답을 미리 계산해 둘 자유도 단계. 점마다 이웃 단계 사이를 보간한다. */
const LEVELS = [0, 1 / 3, 2 / 3, 1];

/** 몸이 얼마나 펼쳐졌는지(0 = 손목이 모임, 1 = 크게 벌림) */
export function openness(b: Body): number {
  return smoothstep(0.2, 0.9, length(sub(b.wrist.L, b.wrist.R)));
}

/**
 * Flow 기하를 만든다.
 * bodyAt(k)는 k·INERTIA_DT초 전의 몸이며 bodyAt(0)이 지금의 몸이다.
 * t는 작품 시간, period는 변형장의 순환 주기, toCamera는 카메라 쪽 단위 벡터다.
 */
export function buildFlow(
  bodyAt: (k: number) => Body,
  t: number,
  period: number,
  P: FlowPreset,
  toCamera: Vec3,
): FlowGeometry {
  const body = bodyAt(0);
  const capsules = bodyCapsules(body);
  const volume = prepareVolume(capsules);
  const dist: Distance = { d: 0, gx: 0, gy: 0, gz: 1 };
  const history: Body[] = [];
  for (let k = 0; k < INERTIA_SAMPLES; k++) history.push(k === 0 ? body : bodyAt(k));
  const weights = LEVELS.map((f) => inertiaWeights(lerp(P.inertia.near, P.inertia.far, f), P.inertia.damping));
  // 주름은 천이 모일수록(응축) 깊어진다. 시간에 따라 흐르는 파동이 아니다.
  const gather = 1 - openness(body);
  const core = vlerp(body.pelvis, body.chest, 0.5);

  const sheets = P.sheets.map((S) => {
    const past = history.map((b) => anchorsAt(b, S));
    const n = S.path.length;
    // 자유도 단계마다 관성 응답으로 거른 중심선의 점들
    const filtered = weights.map((w) =>
      Array.from({ length: n }, (_, a) => {
        let p = v3();
        for (let k = 0; k < w.length; k++) if (w[k] !== 0) p = add(p, scale(past[k]![a]!, w[k]!));
        return p;
      }),
    );
    const frees = S.path.map((a) => a.free);
    const widths = S.path.map((a) => a.width);

    // 중심선: 점마다 자유도에 맞는 관성 단계를 섞는다.
    const M = S.samples;
    const center: Vec3[] = [];
    const free: number[] = [];
    const width: number[] = [];
    for (let i = 0; i < M; i++) {
      const g = (i / (M - 1)) * (n - 1);
      const f = clamp(scalarAt(frees, g), 0, 1);
      const lv = f * (LEVELS.length - 1);
      const l = Math.min(LEVELS.length - 2, Math.floor(lv));
      let c = vlerp(curveAt(filtered[l]!, g), curveAt(filtered[l + 1]!, g), lv - l);
      c = add(c, scale(UP, -S.sag * f));
      center.push(c);
      free.push(f);
      width.push(Math.max(0, scalarAt(widths, g)));
    }

    // 폭 방향: 몸 가까이에서는 몸 표면 위에 눕고(표면 법선과 수직), 멀어지면 몸의 앞을 향해 펼쳐진다.
    const across: Vec3[] = [];
    const normals: Vec3[] = [];
    for (let i = 0; i < M; i++) {
      const T = normalize(sub(center[Math.min(M - 1, i + 1)]!, center[Math.max(0, i - 1)]!), UP);
      const c = center[i]!;
      const { d, gx, gy, gz } = bodyDistance(c.x, c.y, c.z, volume, P.smooth, dist);
      const ref = normalize(vlerp(v3(gx, gy, gz), body.facing, smoothstep(0.02, 0.18, d)), body.facing);
      const N = normalize(reject(ref, T), body.facing);
      normals.push(N);
      across.push(normalize(cross(T, N), v3(1, 0, 0)));
    }
    // 이웃한 표본 사이에서 폭 방향이 뒤집히지 않게 이어 준다.
    for (let i = 1; i < M; i++) {
      if (dot(across[i]!, across[i - 1]!) < 0) {
        across[i] = scale(across[i]!, -1);
        normals[i] = scale(normals[i]!, -1);
      }
    }

    const K = S.lines;
    const points: Vec3[][] = [];
    const fade: number[][] = [];
    for (let k = 0; k < K; k++) {
      const x = -1 + (2 * k) / (K - 1);
      const line: Vec3[] = [];
      const lineFade: number[] = [];
      for (let i = 0; i < M; i++) {
        const s = i / (M - 1);
        const hw = width[i]! / 2;
        let p = add(center[i]!, scale(across[i]!, hw * x));
        const fold = Math.sin(Math.PI * x * S.folds.count) * S.folds.amp * (0.3 + 0.7 * gather) * (0.4 + 0.6 * free[i]!);
        p = add(p, scale(normals[i]!, fold));
        const air = P.field.amp * free[i]!;
        if (air > 1e-4) p = add(p, scale(flowField(p, t, P.field.wavelength, period), air));
        // 몸에 걸고 감는다. 늦게 따라오는 천도 지금의 몸을 뚫지 않는다.
        p = drapeOnto(p, volume, P.smooth, P.push, P.cling * (1 - 0.7 * free[i]!), P.looseness, S.standoff);
        // 바닥에 닿은 천은 바닥 위에 놓인다.
        if (p.y < FLOOR) p = v3(p.x, FLOOR, p.z);
        line.push(p);
        const ends = smoothstep(0, S.fadeEnds, s) * (1 - smoothstep(1 - S.fadeEnds, 1, s));
        const sides = 1 - S.fadeSides * smoothstep(0.6, 1, Math.abs(x)) * (1 - 4 * s * (1 - s));
        lineFade.push(ends * sides);
      }
      points.push(line);
      fade.push(lineFade);
    }

    // 천의 바깥면(몸에서 먼 쪽)이 카메라를 향하는지
    const normalAt = (k: number, i: number) => {
      const row = points[k]!;
      const along = sub(row[Math.min(M - 1, i + 1)]!, row[Math.max(0, i - 1)]!);
      const side = sub(points[Math.min(K - 1, k + 1)]![i]!, points[Math.max(0, k - 1)]![i]!);
      return cross(along, side);
    };
    let orient = 0;
    for (let k = 1; k < K - 1; k += 3) {
      for (let i = 1; i < M - 1; i += 3) orient += dot(normalAt(k, i), sub(points[k]![i]!, core));
    }
    const sign = orient >= 0 ? 1 : -1;
    const front = points.map((row, k) => row.map((_, i) => sign * dot(normalAt(k, i), toCamera) >= 0));
    return { points, fade, front, alpha: S.alpha };
  });
  return { sheets, body: capsules };
}
