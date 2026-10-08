import type { FlowPreset, SheetPreset } from './form/flow';
import type { StreamConfig } from './form/stream';
import type { VeilConfig } from './form/veil';
import type { EnsembleConfig } from './form/ensemble';
import type { StrokeStyle, TraceStyle } from './form/ensemble-styles';

/**
 * Flow 기본 표현(설정 2): 몸과 추상의 경계. 먼저 이 하나를 완성한다.
 * 모든 수치는 시각 검토용 가설이다.
 */
/** 앞쪽 면: 늘어진 끝 → 들어 올린 팔(side) → 어깨 → 가슴을 가로질러 → 반대쪽 골반을 감고 → 뒤로 끌리는 끝 */
function scarf(side: 'L' | 'R', standoff: number, alpha: number): SheetPreset {
  const o = side === 'L' ? 'R' : 'L';
  const away = side === 'L' ? -1 : 1;
  return {
    side,
    path: [
      { at: `wrist${side}`, up: 0.03, width: 0.04, free: 0.3 },
      { at: `elbow${side}`, up: 0.04, width: 0.09, free: 0.1 },
      { at: `shoulder${side}`, up: 0.04, width: 0.12, free: 0.03 },
      { at: ['chest', 'waist', 0.45], forward: 0.13, width: 0.09, free: 0.12 },
      { at: `hip${o}`, forward: 0.07, out: 0.05 * away, width: 0.15, free: 0.15 },
      { at: [`hip${o}`, `knee${o}`, 0.5], forward: -0.01, out: 0.11 * away, width: 0.24, free: 0.6 },
      { at: [`knee${o}`, `ankle${o}`, 0.3], forward: -0.2, out: 0.17 * away, width: 0.2, free: 1 },
    ],
    lines: 20,
    samples: 72,
    standoff,
    sag: 0.05,
    folds: { amp: 0.018, count: 3 },
    fadeEnds: 0.16,
    fadeSides: 0.6,
    alpha,
  };
}

/** 뒤쪽 면: 목 뒤에서 등을 타고 뒤로 넓게 흐르는 자락 */
const TRAIN: SheetPreset = {
  side: null,
  path: [
    { at: ['neck', 'chest', 0.4], up: 0.02, forward: -0.08, width: 0.2, free: 0.04 },
    { at: ['chest', 'waist', 0.5], forward: -0.13, width: 0.26, free: 0.15 },
    { at: 'pelvis', forward: -0.17, width: 0.32, free: 0.4 },
    { at: ['kneeL', 'kneeR', 0.5], forward: -0.28, width: 0.38, free: 0.8 },
    { at: ['ankleL', 'ankleR', 0.5], up: 0.03, forward: -0.42, width: 0.42, free: 1 },
  ],
  lines: 28,
  samples: 60,
  standoff: 0.01,
  sag: 0.03,
  folds: { amp: 0.025, count: 4 },
  fadeEnds: 0.3,
  fadeSides: 0.4,
  alpha: 0.42,
};

/**
 * Flow 기본 표현(설정 2): 몸과 추상의 경계. 먼저 이 하나를 완성한다.
 * 모든 수치는 시각 검토용 가설이다.
 */
const FLOW_BASE: FlowPreset = {
  label: 'Flow 2 · 경계(기본)',
  sheets: [TRAIN, scarf('R', 0.006, 0.55), scarf('L', 0.03, 0.58)],
  smooth: 0.035,
  looseness: 0.05,
  cling: 0.2,
  push: 1,
  inertia: { near: 0.12, far: 1.1, damping: 0.42 },
  field: { amp: 0.012, wavelength: 0.9 },
  lineWidth: 0.6,
  backAlpha: 0.35,
  occlusion: 1,
  bodyOcclusion: 1,
};

/**
 * 비교용 변형(아직 다듬지 않음): 기본 표현에서 몸에 붙는 정도와 관성만 바꾼다.
 * k < 0 이면 천이 몸에 더 붙어 몸이 잘 읽히고, k > 0 이면 천이 더 늘어지고 흐른다.
 */
function variant(label: string, k: number): FlowPreset {
  const s = (a: number) => Math.max(0, a * (1 + k));
  return {
    ...FLOW_BASE,
    label,
    sheets: FLOW_BASE.sheets.map((sh) => ({
      ...sh,
      sag: s(sh.sag),
      folds: { ...sh.folds, amp: s(sh.folds.amp) },
      path: sh.path.map((a) => ({ ...a, width: s(a.width), free: Math.min(1, s(a.free)) })),
    })),
    cling: Math.min(1, FLOW_BASE.cling * (1 - 0.5 * k)),
    looseness: s(FLOW_BASE.looseness * (1 - 1.5 * k)),
    inertia: { ...FLOW_BASE.inertia, far: s(FLOW_BASE.inertia.far) },
    field: { ...FLOW_BASE.field, amp: s(FLOW_BASE.field.amp) * (1 + k) },
  };
}

const FLOW_PRESETS: Record<1 | 2 | 3, FlowPreset> = {
  1: variant('Flow 1 · 몸이 읽힘(미조정)', -0.5),
  2: FLOW_BASE,
  3: variant('Flow 3 · 흐름(미조정)', 0.8),
};

/**
 * Flow 실험 E1: 연관된 선들의 흐름 속에서 몸과 춤의 방향이 잠시 나타났다가 풀리는 짧은 장면.
 * 기존 Flow(천 모델)와 별개의 실험이며, 모든 수치는 시각 검토용 가설이다.
 * 장면 시간 σ = 0은 A-2 전체 순서의 5.6초(무게 옮기기의 회복)이고, 19초 뒤 처음으로 이어진다.
 *   σ 0–3.3   흐름만(몸의 영향 없음)
 *   σ 3.3–9.4 팔이 뻗는 방향(펼치기의 폭발·유예·내려옴)
 *   σ 7.0–15  몸통·골반의 비틀림(감김·회전)
 *   σ 13–19   풀림과 여운(회전의 착지·유예 동안 몸의 영향 없이 흐름으로 돌아감)
 */
const FLOW_E1: StreamConfig = {
  label: 'Flow 실험 E1',
  scene: { from: 5.6, length: 19 },
  grid: 1 / 30,
  trail: 75,
  inertia: { step: 2, samples: 24, period: 0.8, damping: 0.5 },
  lines: 22,
  width: 0.11,
  spread: [0.45, 1.4],
  stream: { center: [0, 0.68, 0], radius: [0.4, 0.27, 0.26], cycles: [2, 3, 2], phase: [0, 0.6, 1.4] },
  ribbons: [
    {
      body: { kind: 'arm', side: 'L', period: 3.2, spread: 0.08 },
      presence: [3.3, 4.6, 7.4, 9.4],
      delay: 0,
      offset: [0, 0.04, 0],
      roll: { base: 0.3, amp: 1.0, cycles: 3, phase: 0 },
      alpha: 0.5,
    },
    {
      body: { kind: 'arm', side: 'R', period: 3.4, spread: 0.08 },
      presence: [3.5, 4.9, 7.2, 9.0],
      delay: 0.45,
      offset: [0.03, -0.02, 0.03],
      roll: { base: -0.2, amp: 1.1, cycles: 4, phase: 1.2 },
      alpha: 0.48,
    },
    {
      body: { kind: 'orbit', level: 'chest', radius: 0.2, period: 3.4 },
      presence: [7.0, 9.0, 12.6, 14.6],
      delay: 0.9,
      offset: [-0.03, 0.02, -0.02],
      roll: { base: 0.6, amp: 0.9, cycles: 2, phase: 0.6 },
      alpha: 0.48,
    },
    {
      body: { kind: 'orbit', level: 'pelvis', radius: 0.16, period: 3.8 },
      presence: [7.6, 9.6, 13.0, 15.0],
      delay: 1.35,
      offset: [0.02, -0.05, 0],
      roll: { base: -0.5, amp: 1.0, cycles: 3, phase: 2.0 },
      alpha: 0.45,
    },
  ],
  lineWidth: 0.6,
  backAlpha: 0.3,
};

/**
 * Flow 실험 E2: 선의 장(정지 화면 검토). 레퍼런스 드로잉의 '넓은 선의 장 아래에서 몸이 선을 솟게
 * 하는' 관계를 한 개의 고정 자세로 검토한다. 움직임은 아직 없다. 모든 수치는 가설이다.
 *
 * 자세: 서 있는 몸. 머리 위, 골반 아래, 오른 다리(화면 왼쪽)로 지지하고 왼 다리는 접어 든다.
 * 왼팔(화면 오른쪽)은 위로, 오른팔(화면 왼쪽)은 옆으로 펼친 비대칭.
 */
const FLOW_E2: VeilConfig = {
  label: 'Flow 실험 E2 · 선의 장',
  pose: {
    px: -0.05, py: -0.01, pRoll: 0.07, pPitch: -0.02,
    cYaw: 0.12, cLean: 0.13, cBend: -0.06,
    hTilt: -0.12, hNod: -0.06, hYaw: 0.15,
    aLEl: 2.55, aLAz: 0.12, aLEb: 0.3, aLWb: 0.15,
    aREl: 1.5, aRAz: 0.12, aREb: 0.35, aRWb: 0.2,
    fRX: -0.06, fRZ: 0, fRLift: 0,
    fLX: 0.16, fLZ: -0.12, fLLift: 0.22, fLCarry: 0,
  },
  relief: {
    cell: 0.006, pad: 0.45, tension: 3.0, soften: 0.012, shade: 0.03, near: 0.1, depth: 0.6, thickness: 1.1,
    wide: { blur: 0.07, gain: 0.1 },
  },
  sheet: {
    center: [-0.08, 0.6],
    size: [1.72, 1.1],
    angle: 0.1,
    lines: 100,
    samples: 520,
    waves: [
      { amp: 0.07, ku: 0.7, kv: 0.35, phase: 2.1 },
      { amp: 0.04, ku: 1.5, kv: 0.6, phase: 0 },
      { amp: 0.035, ku: 2.1, kv: 0.25, phase: 4.0 },
      { amp: 0.02, ku: 2.7, kv: -0.9, phase: 1.3 },
      { amp: 0.008, ku: 4.3, kv: 1.7, phase: 0.4 },
    ],
    shear: [{ amp: 0.02, ku: 0.8, kv: 1.2, phase: 0.7 }],
    edge: {
      inset: 0.035,
      corner: 0.06,
      left: [
        { amp: 0.035, cycles: 1.3, phase: 0.5 },
        { amp: 0.015, cycles: 3.1, phase: 2.0 },
      ],
      right: [
        { amp: 0.04, cycles: 1.1, phase: 2.4 },
        { amp: 0.014, cycles: 2.7, phase: 0.3 },
      ],
      jitter: 0.018,
      fade: 0.03,
    },
  },
  lift: { amount: 0.75, column: 0.0012 },
  tone: { far: 0.2, body: 0.78, nearGamma: 0.8, compress: { gamma: 0.6, min: 0.6, max: 1.7 },
    smooth: 5,
    light: { direction: [0.6, 0.8], shade: 0.7, lit: 0.35, slope: 1.2 },
    rim: 0.03, max: 0.85 },
  frame: { center: [0, 0.6], size: [1.98, 1.32] },
  lineWidth: 0.85,
  color: '28, 28, 28',
};

/**
 * Flow 실험 E2 · 흐름: E2의 같은 고정 자세 위로 선의 물결과 바깥 경계만 흐르는 짧은 순환(몸은 움직이지 않는다).
 * 정지 E2(FLOW_E2)는 비교용으로 그대로 두고, 이 설정에서 세 가지를 조정했다.
 * 1. 주변 선을 옅게(far), 몸 위는 그대로 읽히게. 근접도는 넓게 흐려 경계에서 갑자기 바뀌지 않는다.
 * 2. 좁은 능선 대신 넓은 곡면: 단면 모양(profile)을 완만하게, 장력을 낮추고 더 부드럽게, 간격에 따른 진함을 줄인다.
 * 3. 가장자리: 옅어지는 길이를 v를 따라 완만히 바꿔 일부 구간은 옅은 선 끝이 읽히게(hem), 선마다의 차이는 줄여
 *    이웃한 끝이 함께 넓은 물결을 이루게 한다.
 * 흐름: 모든 물결이 주기 10초 동안 정수 번 선을 따라 지나간다. 바깥쪽은 같은 물결을 늦고 조금 크게 따른다.
 */
const FLOW_E2M: VeilConfig = {
  ...FLOW_E2,
  label: 'Flow 실험 E2 · 흐름(몸 고정)',
  relief: {
    cell: 0.006, pad: 0.45, tension: 2.4, soften: 0.016, shade: 0.04, near: 0.1, depth: 0.6, thickness: 1.15,
    profile: 0.7,
    wide: { blur: 0.07, gain: 0.1 },
  },
  sheet: {
    ...FLOW_E2.sheet,
    waves: [
      // 가장 긴 물결도 장을 정확히 한 번 가로지르게 해서, 지나가는 동안 장 전체가 오르내리지 않게 한다.
      { amp: 0.07, ku: 1.0, kv: 0.35, phase: 2.1, travel: 1 },
      { amp: 0.04, ku: 1.5, kv: 0.6, phase: 0, travel: 2 },
      { amp: 0.035, ku: 2.1, kv: 0.25, phase: 4.0, travel: 2 },
      { amp: 0.02, ku: 2.7, kv: -0.9, phase: 1.3, travel: 3 },
      { amp: 0.008, ku: 4.3, kv: 1.7, phase: 0.4, travel: 4 },
    ],
    shear: [{ amp: 0.02, ku: 0.8, kv: 1.2, phase: 0.7, travel: 1 }],
    edge: {
      inset: 0.035,
      corner: 0.06,
      left: [
        { amp: 0.03, cycles: 0.9, phase: 0.5, travel: 1 },
        { amp: 0.012, cycles: 2.2, phase: 2.0, travel: 1 },
      ],
      right: [
        { amp: 0.035, cycles: 0.8, phase: 2.4, travel: 1 },
        { amp: 0.012, cycles: 2.0, phase: 0.3, travel: 2 },
      ],
      jitter: 0.005,
      fade: 0.03,
      fadeVary: { range: [0.35, 1.8], cycles: 2.3, phase: 0.4 },
    },
    motion: { period: 10, edgeLag: 0.6, edgeAmp: 0.25, edgeZone: [0.3, 0.5] },
  },
  lift: { amount: 0.75, column: 0.0012 },
  tone: {
    far: 0.085, body: 0.8, nearGamma: 0.85, compress: { gamma: 0.5, min: 0.7, max: 1.35 },
    smooth: 6,
    light: { direction: [0.6, 0.8], shade: 0.6, lit: 0.3, slope: 1.2 },
    rim: 0.03, max: 0.85,
    hem: { gain: 1.3, width: 2.5 },
  },
  frame: { center: [0, 0.62], size: [2.02, 1.4] },
};

/**
 * 앙상블 스케치: 하나의 안무를 여러 인물이 서로 다른 순간에 추는 화면을 추상적으로 표현하는 세 방식.
 * Anthologia 회화(옅은 바탕의 많은 작은 인물, 같은 안무의 다른 순간, 선명함과 흐림의 층)를 시간 속으로
 * 옮기는 방향을 확인하기 위한 정지 화면 스케치다. 안무는 아직 A-2(임시안, 덧배기춤과 무관)다.
 */
const ENSEMBLE: EnsembleConfig = {
  count: 26,
  seed: 7,
  area: { center: [0, 0], size: [6, 3.6] },
  scale: [0.42, 0.95],
  spacing: 0.55,
  clusters: [
    [0.3, 0.6],
    [0.68, 0.4],
    [0.5, 0.5],
  ],
  pull: 0.45,
  sharpShare: 0.3,
  faint: [0.3, 0.65],
};
const ENSEMBLE_FRAME = { center: [0, 0.1] as const, size: [6.9, 4.6] as const };
const ENSEMBLE_TRACE: TraceStyle = { span: 5, samples: 120, alpha: 0.85, gamma: 1.1 };
const ENSEMBLE_STROKE: StrokeStyle = { passes: 12, lag: 0.16, alpha: 0.6, subdivide: 6 };
const ENSEMBLE_FIELD: VeilConfig = {
  ...FLOW_E2M,
  label: '앙상블 · 장',
  relief: {
    cell: 0.008, pad: 0.3, tension: 2.4, soften: 0.012, shade: 0.03, near: 0.12, depth: 0.6, thickness: 1.2,
    profile: 0.7,
    wide: { blur: 0.06, gain: 0.1 },
  },
  sheet: {
    ...FLOW_E2M.sheet,
    center: [0, 0.1],
    size: [6.3, 3.9],
    angle: 0.06,
    lines: 170,
    samples: 1100,
    waves: [
      { amp: 0.16, ku: 1.0, kv: 0.35, phase: 2.1 },
      { amp: 0.09, ku: 1.8, kv: 0.6, phase: 0 },
      { amp: 0.05, ku: 3.1, kv: -0.5, phase: 4.0 },
      { amp: 0.02, ku: 5.3, kv: 1.3, phase: 1.3 },
    ],
    shear: [{ amp: 0.05, ku: 0.8, kv: 1.2, phase: 0.7 }],
    motion: undefined,
  },
  lift: { amount: 0.9, column: 0.004 },
  frame: ENSEMBLE_FRAME,
  lineWidth: 0.75,
};

export const CONFIG = {
  body: {
    /** 서 있을 때 골반 중심의 높이(발목 높이 + 다리 길이 - 약간의 여유). */
    pelvisHeight: 0.525,
    hipHalfWidth: 0.055,
    thigh: 0.245,
    shin: 0.24,
    /** 바닥에서 발목 기준점까지의 높이 */
    ankleHeight: 0.04,
    spine: 0.24,
    neck: 0.1,
    /** 머리 중심에서 머리 끝까지 */
    headTop: 0.08,
    shoulderHalfWidth: 0.105,
    /** 가슴 기준점 대비 어깨의 높이 */
    shoulderRise: 0.035,
    upperArm: 0.165,
    forearm: 0.15,
    /** 손목에서 손끝 방향을 암시하는 짧은 연장 */
    hand: 0.065,
    /** 다리가 완전히 펴지지 않도록 남겨 두는 비율 */
    maxLegExtension: 0.995,
    /** 팔꿈치 최대 굽힘 */
    maxElbowBend: 2.6,
    /** 회전 중 접은 다리의 발목 위치(골반 좌표계, x는 해당 쪽 부호를 곱한다) */
    carry: { x: 0.04, y: -0.4, z: 0.05 },
    /** 손끝 방향이 아래팔에서 꺾일 수 있는 최대 각 */
    maxHandBend: 0.7,
  },

  /**
   * 몸통이 이끌고 말단이 따라오는 시간차.
   * 각 부위의 방향을 이 시간만큼 이전 시점의 몸통·팔 자세에서 가져온다.
   */
  lag: {
    head: 0.16,
    upperArm: 0.1,
    forearm: 0.22,
    hand: 0.36,
  },

  /** 무게 중심 계산용 질량 비율(골반·가슴·머리) */
  mass: { pelvis: 0.5, chest: 0.36, head: 0.14 },

  support: {
    /** 이 정도 높이까지 들리면 발이 바닥 접촉을 잃은 것으로 본다. */
    liftForNoContact: 0.012,
    /** 하중이 이 값 이상이면 지지 발로 표시한다(개발 화면). */
    supportThreshold: 0.6,
  },

  /** 정지 구간에서도 몸이 완전히 굳지 않도록 하는 아주 작은 호흡. */
  breath: {
    period: 4.6,
    chestBend: 0.006,
    pelvisDrop: 0.0015,
  },

  camera: {
    /**
     * 몸을 비스듬히(3/4) 보는 각. 정면에서는 무릎 굽힘·몸통의 말림·회전 준비가
     * 화면 깊이 방향으로 사라지므로, 좌우 이동이 충분히 읽히는 범위에서 돌려 둔다.
     */
    yaw: 0.42,
    /** 약간 내려다보는 시점: 앞뒤 깊이가 위아래 차이로 드러난다. */
    pitch: 0.14,
    /** 약한 원근(몸 단위 거리). 클수록 평행 투영에 가깝다. */
    distance: 7,
  },

  view: {
    /** 화면 높이 대비 몸 높이 */
    heightFraction: 0.6,
    /** 화면 너비 대비 몸이 차지할 수 있는 최대 폭(팔을 펼친 폭 ≈ 1.0) */
    widthFraction: 0.78,
    /** 화면 높이 대비 바닥선 위치 */
    groundAt: 0.8,
    maxPixelRatio: 2,
  },

  line: {
    color: '26, 26, 24',
    /** 몸 높이 1.0이 600px일 때의 선 굵기(px) */
    width: 1.5,
    alpha: 0.86,
    /** 몸 뒤쪽으로 갈수록 옅어지는 정도 */
    depthFade: 0.35,
    /** 관절을 지나는 곡선의 둥글기(0 = 꺾은선) */
    roundness: 0.28,
  },

  clock: {
    /** 한 프레임에 반영되는 최대 경과 시간 */
    maxDelta: 1 / 15,
  },

  /** Flow 실험 E1(기존 Flow와 별개, 개발 화면에서만) */
  flowE1: FLOW_E1,
  flowE2: FLOW_E2,
  flowE2m: FLOW_E2M,
  ensemble: {
    layout: ENSEMBLE,
    frame: ENSEMBLE_FRAME,
    trace: ENSEMBLE_TRACE,
    stroke: ENSEMBLE_STROKE,
    field: ENSEMBLE_FIELD,
    lineWidth: 0.8,
    color: '28, 28, 28',
  },

  flow: {
    presets: FLOW_PRESETS,
    /** 감상 화면의 Flow 설정 */
    defaultPreset: 2 as 1 | 2 | 3,
    color: '20, 20, 18',
  },

  /**
   * 감상 화면: A-2 전체 순서를 Flow 기본 표현으로 보여 준다.
   * 이전 화면(Structure)으로 돌아가려면 mode: 'structure'.
   */
  viewing: {
    mode: 'flow' as 'structure' | 'flow',
  },

  /**
   * 개발 화면의 검토 구간: A-2 전체 순서에서 '팔을 펼침 → 방향 전환 → 잠깐 멈춤'.
   * 펼치기의 진행 직전부터 방향 바꾸기의 유예가 끝날 때까지를 반복한다(구절 시각 기준 여유, 초).
   */
  review: {
    label: '펼침 → 방향 전환 → 멈춤',
    from: { phrase: 'open', section: '진행', offset: -0.3 },
    to: { phrase: 'turn', section: '회복', offset: 0.4 },
  },

  playback: {
    /** 감상 화면의 재생 배속 */
    speed: 1,
    /** 개발 화면의 시작 배속(비교 검토용). ?dev&speed=1 처럼 주소로 바꿀 수 있다. */
    devSpeed: 1.5,
    /** 개발 화면에서 고를 수 있는 배속 */
    devSpeeds: [0.25, 0.5, 1, 1.25, 1.5, 2],
  },
} as const;
