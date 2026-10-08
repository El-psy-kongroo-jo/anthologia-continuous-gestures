import type { FlowPreset, SheetPreset } from './form/flow';

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
