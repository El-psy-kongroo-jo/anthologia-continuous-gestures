import { add, cross, dot, length, normalize, reject, scale, smoothstep, sub, v3, vlerp } from '../core/math';
import type { Vec3 } from '../core/types';
import type { Body } from '../motion/body';
import { inertiaWeights } from './inertia';

/*
 * Flow 실험 E1: 연관된 선들의 흐름 속에서 몸과 춤의 방향이 잠시 나타났다가 풀리는 짧은 장면.
 *
 * 몇 개의 '머리'가 공간을 움직이며 짧은 띠를 끈다. 띠는 인접한 가는 선 여러 개다.
 * 띠의 폭과 말림 각은 머리가 지나간 순간의 값이 띠를 따라 함께 흘러가므로, 선들이 모이고 펼쳐지고
 * 비틀려 서로 넘어간다. 선마다 따로 흔들리지 않고, 고정된 모양 전체가 흔들리지도 않는다.
 *
 * 1. 흐름: 몸과 무관하게 모든 머리가 하나의 닫힌 경로를 시간차와 작은 간격을 두고 따른다. 그래서 띠들이
 *    하나로 엮인 흐름처럼 함께 움직인다(장면 길이 안에서 정수 바퀴라 끊김 없이 순환).
 * 2. 몸의 방향: 몸의 영향(presence)이 있는 동안만 머리의 목표가 몸에서 얻은 경로로 바뀐다.
 *    팔: 팔이 뻗는 방향을 따라 바깥으로 나갔다 돌아오는 긴 고리. 몸통·골반: 몸의 축을 도는 궤도(비틀림).
 *    관절은 선이 지나는 고정점이 아니다.
 * 3. 풀림: 영향이 줄면 목표가 다시 흐름의 경로로 바뀌어 경로·간격·방향이 함께 바뀐다.
 * 4. 여운: 머리는 목표를 관성 응답(2차 감쇠)으로 따르므로 이전 움직임의 방향을 잠시 유지하고,
 *    띠에는 직전 움직임의 모양이 남아 흘러 나간다.
 *
 * 모든 값은 장면 시간 σ의 순수 함수다. 과거 값은 다시 계산하며, 캐시는 같은 값을 재사용할 뿐이다.
 */

export interface Loop {
  center: readonly [number, number, number];
  radius: readonly [number, number, number];
  /** 장면 한 바퀴 동안 x·y·z가 도는 횟수(정수여야 끊김 없이 순환) */
  cycles: readonly [number, number, number];
  phase: readonly [number, number, number];
}

export interface StreamRibbon {
  /** 몸의 영향이 있을 때 따르는 경로 */
  body:
    | { kind: 'arm'; side: 'L' | 'R'; period: number; spread: number }
    | { kind: 'orbit'; level: 'chest' | 'pelvis'; radius: number; period: number };
  /** 몸의 영향: [나타나기 시작, 다 나타남, 풀리기 시작, 다 풀림] (장면 시간, 초) */
  presence: readonly [number, number, number, number];
  /** 공통 흐름 경로 위에서 이 띠의 머리가 늦게 따라가는 시간(초)과 비켜 있는 거리 */
  delay: number;
  offset: readonly [number, number, number];
  /** 말림 각: 기본, 흐름에 따른 변화 폭, 장면 한 바퀴 동안의 변화 횟수 */
  roll: { base: number; amp: number; cycles: number; phase: number };
  alpha: number;
}

export interface StreamConfig {
  label: string;
  /** 장면: A-2 전체 순서 안의 시작(초)과 길이(초). 길이는 grid의 정수배여야 한다 */
  scene: { from: number; length: number };
  /** 시간 격자(초) */
  grid: number;
  /** 띠의 길이(격자 칸 수): 머리가 지나온 시간만큼 띠가 남는다 */
  trail: number;
  /** 머리가 목표를 따르는 관성 응답: 과거 표본 간격(격자 칸 수)·개수, 주기(초), 감쇠 */
  inertia: { step: number; samples: number; period: number; damping: number };
  lines: number;
  /** 띠의 반폭과, 머리의 속도에 따른 폭 배율(느림 → 모임, 빠름 → 펼침) */
  width: number;
  spread: readonly [number, number];
  /** 모든 띠가 함께 따르는 흐름의 경로 */
  stream: Loop;
  ribbons: readonly StreamRibbon[];
  lineWidth: number;
  /** 띠가 뒤집혀 안쪽을 보이는 곳의 선 진하기 배율 */
  backAlpha: number;
}

export interface StreamStroke {
  points: Vec3[];
  alpha: number;
}

/** 장면 시간(초)에서 몸을 주는 함수 */
export type BodyAtScene = (sigma: number) => Body;

const mod = (a: number, m: number) => ((a % m) + m) % m;
const TAU = Math.PI * 2;

export function presenceAt(p: StreamRibbon['presence'], s: number): number {
  return smoothstep(p[0], p[1], s) * (1 - smoothstep(p[2], p[3], s));
}

function loopAt(l: Loop, s: number, D: number): Vec3 {
  const c = (i: 0 | 1 | 2) => l.center[i] + l.radius[i] * Math.sin((TAU * l.cycles[i] * s) / D + l.phase[i]);
  return v3(c(0), c(1), c(2));
}

/** 몸에서 얻는 경로 위의 점(장면 시간 s) */
function bodyPath(r: StreamRibbon, b: Body, s: number): Vec3 {
  const spec = r.body;
  if (spec.kind === 'arm') {
    const side = spec.side;
    const root = vlerp(b.chest, b.shoulder[side], 0.5);
    const reach = sub(b.handTip[side], b.shoulder[side]);
    const len = length(reach) * 1.3 + 0.05;
    const dir = normalize(reach, v3(side === 'L' ? 1 : -1, 0, 0));
    const perp = normalize(cross(dir, b.facing), v3(0, 1, 0));
    const a = (TAU * s) / spec.period;
    // 팔이 뻗는 방향으로 나갔다가 옆으로 돌아오는 긴 고리
    return add(add(root, scale(dir, len * (0.5 - 0.5 * Math.cos(a)))), scale(perp, spec.spread * Math.sin(a)));
  }
  const center = spec.level === 'chest' ? b.chest : vlerp(b.pelvis, b.waist, 0.3);
  const [l, rr] = spec.level === 'chest' ? [b.shoulder.L, b.shoulder.R] : [b.hip.L, b.hip.R];
  // 몸의 축을 도는 궤도: 어깨선(골반선)의 방향을 기준각으로 삼아 몸이 돌면 함께 돈다.
  const base = Math.atan2(l.z - rr.z, l.x - rr.x);
  const a = base + (TAU * s) / spec.period;
  return add(center, v3(spec.radius * Math.cos(a), 0.03 * Math.sin(2 * a), spec.radius * Math.sin(a)));
}

/** 몸에서 얻는 말림 각: 팔은 펼칠수록 정면으로(결이 벌어짐), 몸통은 어깨·골반의 비틀림만큼 */
function bodyRoll(r: StreamRibbon, b: Body): number {
  if (r.body.kind === 'arm') {
    const open = smoothstep(0.2, 0.9, length(sub(b.wrist.L, b.wrist.R)));
    return (1 - open) * 1.2;
  }
  const a = Math.atan2(b.shoulder.L.z - b.shoulder.R.z, b.shoulder.L.x - b.shoulder.R.x);
  const c = Math.atan2(b.hip.L.z - b.hip.R.z, b.hip.L.x - b.hip.R.x);
  return 2 * Math.atan2(Math.sin(a - c), Math.cos(a - c));
}

interface HeadState {
  p: Vec3;
  roll: number;
}

/**
 * 장면 시간 σ의 E1 선들을 만든다.
 * bodyAt(s)는 장면 시간 s의 몸, toCamera는 카메라 쪽 단위 벡터, presenceScale은 몸 영향의 배율
 * (0이면 몸 없이 흐름만 — 작업 순서 1의 확인용)이다.
 */
export function buildStream(
  C: StreamConfig,
  sigma: number,
  bodyAt: BodyAtScene,
  toCamera: Vec3,
  presenceScale = 1,
): StreamStroke[] {
  const D = C.scene.length;
  const g = C.grid;
  const weights = inertiaWeights(C.inertia.period, C.inertia.damping, C.inertia.step * g, C.inertia.samples);
  const n0 = Math.floor(sigma / g);
  const frac = sigma / g - n0;

  // 격자 시각 n의 몸(장면 안에서 순환)
  const bodies = new Map<number, Body>();
  const bodyAtGrid = (n: number) => {
    const k = mod(n, Math.round(D / g));
    let b = bodies.get(k);
    if (!b) {
      b = bodyAt(k * g);
      bodies.set(k, b);
    }
    return b;
  };

  const strokes: StreamStroke[] = [];
  for (const r of C.ribbons) {
    // 격자 시각 n에서 머리가 향하는 목표(흐름 경로와 몸 경로를 몸의 영향만큼 섞음)
    const targets = new Map<number, HeadState>();
    const target = (n: number): HeadState => {
      let h = targets.get(n);
      if (h) return h;
      const s = mod(n * g, D);
      const e = presenceAt(r.presence, s) * presenceScale;
      const flowP = add(loopAt(C.stream, s - r.delay, D), v3(...r.offset));
      const flowRoll = r.roll.base + r.roll.amp * Math.sin((TAU * r.roll.cycles * s) / D + r.roll.phase);
      if (e <= 0) h = { p: flowP, roll: flowRoll };
      else {
        const b = bodyAtGrid(n);
        h = { p: vlerp(flowP, bodyPath(r, b, s), e), roll: flowRoll + e * bodyRoll(r, b) };
      }
      targets.set(n, h);
      return h;
    };
    // 머리: 목표의 관성 응답
    const heads = new Map<number, HeadState>();
    const head = (n: number): HeadState => {
      let h = heads.get(n);
      if (h) return h;
      let p = v3();
      let roll = 0;
      for (let k = 0; k < weights.length; k++) {
        const w = weights[k]!;
        if (w === 0) continue;
        const tk = target(n - k * C.inertia.step);
        p = add(p, scale(tk.p, w));
        roll += tk.roll * w;
      }
      h = { p, roll };
      heads.set(n, h);
      return h;
    };

    // 띠의 중심선: 머리가 지나온 자리. 이웃한 두 격자 시각 사이를 보간해 프레임 사이도 이어진다.
    const M = C.trail;
    const center: Vec3[] = [];
    const roll: number[] = [];
    const speed: number[] = [];
    for (let m = 0; m <= M + 1; m++) {
      const a = head(n0 - m);
      const b = head(n0 + 1 - m);
      center.push(vlerp(a.p, b.p, frac));
      roll.push(a.roll + (b.roll - a.roll) * frac);
    }
    for (let m = 0; m <= M; m++) speed.push(length(sub(center[m]!, center[m + 1]!)) / g);

    const half: number[] = [];
    const across: Vec3[] = [];
    const front: boolean[] = [];
    let prevT = v3(0, 1, 0);
    for (let m = 0; m <= M; m++) {
      // 접선은 넓은 범위에서 구하고, 머리가 거의 멈춰 방향이 불분명하면 앞의 접선을 잇는다.
      const d = sub(center[Math.max(0, m - 3)]!, center[Math.min(M + 1, m + 3)]!);
      const T = length(d) > 1e-4 ? normalize(d, prevT) : prevT;
      prevT = T;
      const a = normalize(reject(toCamera, T), v3(1, 0, 0));
      const bb = cross(T, a);
      const c = Math.cos(roll[m]!);
      let w = add(scale(bb, c), scale(a, Math.sin(roll[m]!)));
      // 이웃한 표본 사이에서 폭 방향이 갑자기 뒤집히지 않게 잇는다.
      if (m > 0 && dot(w, across[m - 1]!) < 0) w = scale(w, -1);
      across.push(w);
      front.push(c >= 0);
      // 머리와 꼬리에서 좁아지는 렌즈 모양, 빠르게 지날수록 결이 벌어진다.
      const taper = Math.sin((Math.PI * (m + 0.5)) / (M + 1)) ** 0.8;
      const fast = smoothstep(0.08, 1.0, speed[m]!);
      half.push(C.width * taper * (C.spread[0] + (C.spread[1] - C.spread[0]) * fast));
    }

    for (let i = 0; i < C.lines; i++) {
      const x = -1 + (2 * i) / (C.lines - 1);
      // 꼬리 쪽에서 결이 하나씩 엇갈려 끝난다.
      const end = M - Math.round(M * 0.25 * ((0.5 + i * 0.618034) % 1));
      let run: Vec3[] = [];
      let runFront = front[0]!;
      const flush = () => {
        if (run.length > 1) strokes.push({ points: run, alpha: r.alpha * (runFront ? 1 : C.backAlpha) });
        run = [];
      };
      for (let m = 0; m <= end; m++) {
        if (run.length > 0 && front[m] !== runFront) {
          const last = run[run.length - 1]!;
          flush();
          run = [last];
        }
        runFront = front[m]!;
        run.push(add(center[m]!, scale(across[m]!, half[m]! * x)));
      }
      flush();
    }
  }
  return strokes;
}
