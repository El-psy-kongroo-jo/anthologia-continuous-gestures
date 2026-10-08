/*
 * 넓은 선의 장과 흐름. 몸과 무관하다.
 *
 * 장은 (u, v) ∈ [0, 1]² 의 얇은 막이다. 선은 v가 일정한 곡선(u 방향으로 흐름)이다.
 * 막 전체가 하나의 부드러운 변형(몇 개의 긴 물결의 합)을 공유하므로 이웃한 선들은 함께 휘고,
 * 물결의 위상이 v에 따라 조금씩 밀려 넓은 접힘과 간격의 변화가 생긴다. 선마다 따로 흔들리지 않는다.
 *
 * 가장자리: 각 선이 시작하고 끝나는 u는 v의 완만한 함수(이웃한 선들이 함께 물결 경계를 이룸)에
 * 선마다 다른 작은 차이를 더한 것이다. 경계는 장 안의 점이므로 안쪽과 같은 변형을 따라 움직인다.
 */

export interface SheetWave {
  /** 선에 수직인 방향의 변위(몸 단위) */
  amp: number;
  /** u, v 방향으로 장 전체에서의 반복 횟수 */
  ku: number;
  kv: number;
  phase: number;
  /** 흐름 주기 동안 이 물결이 선을 따라 지나가는 횟수(정수여야 끊김 없이 순환. 없으면 0 = 멈춤) */
  travel?: number;
}

export interface EdgeWave {
  amp: number;
  /** v 방향(장 전체 높이)에서의 반복 횟수 */
  cycles: number;
  phase: number;
  /** 흐름 주기 동안 경계의 물결이 v 방향으로 지나가는 횟수(정수) */
  travel?: number;
}

/**
 * 흐름(움직임). 없으면 정지 화면이다.
 * 물결은 선을 따라 지나가며(위상이 시간에 따라 이동), 선이 지나는 자리마다 몸의 굴곡을 다시 읽는다.
 * 바깥쪽(선의 양 끝 가까이)은 같은 물결을 조금 늦게(lag) 조금 크게(edgeAmp) 따른다. 따로 흔들리지 않는다.
 */
export interface SheetMotion {
  /** 순환 주기(초) */
  period: number;
  /** 바깥쪽의 지연(초)과 물결 배율 */
  edgeLag: number;
  edgeAmp: number;
  /** 바깥쪽으로 보는 범위: 장 중심에서의 |u - 0.5|가 [시작, 끝]일 때 0 → 1 */
  edgeZone: readonly [number, number];
}

export interface SheetConfig {
  /** 장의 중심(몸 단위, 정면에서 본 x·y)과 크기(선 방향 W, 가로지르는 방향 H) */
  center: readonly [number, number];
  size: readonly [number, number];
  /** 선의 기본 기울기(라디안, + = 오른쪽이 올라감) */
  angle: number;
  lines: number;
  /** 선 하나의 표본 수 */
  samples: number;
  waves: readonly SheetWave[];
  /** 선의 방향으로의 약한 밀림(간격과 함께 결이 앞뒤로 쏠림) */
  shear: readonly SheetWave[];
  edge: {
    /** 장의 양 끝에서 비워 두는 u의 기본 폭 */
    inset: number;
    /** 위·아래 가장자리 선이 짧아지는 정도(둥근 모서리) */
    corner: number;
    left: readonly EdgeWave[];
    right: readonly EdgeWave[];
    /** 선마다 다른 끝 위치의 차이(u) */
    jitter: number;
    /** 끝에서 옅어지는 길이(u) */
    fade: number;
    /**
     * 옅어지는 길이를 v를 따라 완만하게 바꾼다(짧은 구간은 선 끝이 읽히고, 긴 구간은 흐릿하게 사라짐).
     * [최소, 최대] 배율과 v 방향 반복 횟수, 위상. 없으면 선마다 조금 다른 고정 배율.
     */
    fadeVary?: { range: readonly [number, number]; cycles: number; phase: number };
  };
  motion?: SheetMotion;
}

const TAU = Math.PI * 2;

/** 선 번호 → 0..1의 고정된 값(무작위처럼 보이지만 항상 같다) */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface SheetPoint {
  x: number;
  y: number;
}

/** 바깥쪽 정도 0..1 (선의 양 끝 가까이에서 1) */
function outerWeight(M: SheetMotion, u: number): number {
  const d = Math.abs(u - 0.5);
  const [a, b] = M.edgeZone;
  const x = Math.min(1, Math.max(0, (d - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** 물결의 시간 위상(주기 안의 이동). 정지 화면이면 0 */
function travelPhase(S: SheetConfig, travel: number | undefined, time: number): number {
  const M = S.motion;
  if (!M || !travel) return 0;
  return (TAU * travel * time) / M.period;
}

/** 장의 점 (u, v) → 평면 위치(흐름 변형 포함, 몸의 영향 제외). time은 흐름 주기 안의 초 */
export function sheetPoint(S: SheetConfig, u: number, v: number, out: SheetPoint, time = 0): SheetPoint {
  const [W, H] = S.size;
  const M = S.motion;
  const outer = M ? outerWeight(M, u) : 0;
  const tt = M ? time - M.edgeLag * outer : 0;
  const gain = M ? 1 + M.edgeAmp * outer : 1;
  let n = 0;
  for (const w of S.waves) {
    n += w.amp * gain * Math.sin(TAU * (w.ku * u + w.kv * v) + w.phase - travelPhase(S, w.travel, tt));
  }
  let t = 0;
  for (const w of S.shear) {
    t += w.amp * Math.sin(TAU * (w.ku * u + w.kv * v) + w.phase - travelPhase(S, w.travel, tt));
  }
  const a = (u - 0.5) * W + t;
  const b = (v - 0.5) * H + n;
  const c = Math.cos(S.angle);
  const s = Math.sin(S.angle);
  out.x = S.center[0] + a * c - b * s;
  out.y = S.center[1] + a * s + b * c;
  return out;
}

export interface LineSpan {
  v: number;
  u0: number;
  u1: number;
  /** 양 끝의 옅어지는 길이 */
  fade0: number;
  fade1: number;
}

function edgeOffset(S: SheetConfig, waves: readonly EdgeWave[], v: number, time: number): number {
  let e = 0;
  for (const w of waves) e += w.amp * Math.sin(TAU * w.cycles * v + w.phase - travelPhase(S, w.travel, time));
  return e;
}

/** 선 i의 v와 시작·끝. 경계의 물결은 안쪽 흐름과 같은 지연(edgeLag)으로 움직인다 */
export function lineSpan(S: SheetConfig, i: number, time = 0): LineSpan {
  const E = S.edge;
  const v = S.lines > 1 ? i / (S.lines - 1) : 0.5;
  const c = 2 * v - 1;
  const corner = E.corner * c ** 4;
  const j0 = (hash01(i) - 0.5) * 2 * E.jitter;
  const j1 = (hash01(i + 1000) - 0.5) * 2 * E.jitter;
  const te = S.motion ? time - S.motion.edgeLag : 0;
  const u0 = E.inset + corner + edgeOffset(S, E.left, v, te) + j0;
  const u1 = 1 - E.inset - corner * 0.7 + edgeOffset(S, E.right, v, te) + j1;
  const F = E.fadeVary;
  const vary = (phase: number) =>
    F ? F.range[0] + (F.range[1] - F.range[0]) * (0.5 + 0.5 * Math.sin(TAU * F.cycles * v + phase)) : 1;
  return {
    v,
    u0,
    u1,
    fade0: E.fade * (F ? vary(F.phase) : 0.7 + 0.6 * hash01(i + 2000)),
    fade1: E.fade * (F ? vary(F.phase + 2.1) : 0.7 + 0.6 * hash01(i + 3000)),
  };
}
