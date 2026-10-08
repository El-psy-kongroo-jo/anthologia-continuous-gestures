/** 3차원 벡터. 단위는 '몸 단위'(서 있는 몸의 키 ≈ 1.0). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 좌우 구분. 정면을 볼 때 몸의 왼쪽(L)이 화면 오른쪽(+x)이다. */
export type Side = 'L' | 'R';

/** 몸의 좌표계에서 L = +1, R = -1. */
export const SIDE_SIGN: Record<Side, 1 | -1> = { L: 1, R: -1 };

/**
 * 안무가 직접 기술하는 자세 채널.
 * 각도는 라디안, 거리는 몸 단위.
 *
 * - 골반(p*)과 가슴(c*)이 주된 움직임을 이끈다.
 * - 팔(a*)은 가슴 좌표계 안에서 기술되며 렌더링 전 시간차가 적용된다.
 * - 발(f*)은 바닥 위의 세계 좌표다. 하중이 실린 동안은 움직이지 않아야 한다.
 */
export interface Pose {
  /** 골반 중심의 좌우 이동 (+x = 몸의 왼쪽) */
  px: number;
  /** 골반 높이 변화 (음수 = 무릎을 굽혀 내려감) */
  py: number;
  /** 골반 앞뒤 이동 (+z = 몸의 정면) */
  pz: number;
  /** 골반의 방향 (세계 기준 회전, 연속 각도) */
  pYaw: number;
  /** 골반 좌우 기울기 (+ = 왼쪽 골반이 올라감) */
  pRoll: number;
  /** 골반 앞뒤 기울기 (+ = 앞으로 숙임) */
  pPitch: number;

  /** 가슴의 방향 (세계 기준 회전, 연속 각도). 골반과의 차이가 몸통의 비틀림이다. */
  cYaw: number;
  /** 골반 대비 몸통의 옆 기울기 (+ = 몸의 오른쪽으로 기울어짐 / 왼쪽 어깨가 올라감) */
  cLean: number;
  /** 골반 대비 몸통의 앞 굽힘 (+ = 웅크림, - = 젖힘) */
  cBend: number;

  /** 머리의 옆 기울기 */
  hTilt: number;
  /** 머리의 끄덕임 (+ = 숙임) */
  hNod: number;
  /** 가슴 대비 머리의 회전 */
  hYaw: number;

  /** 팔 들어올림: 0 = 아래로 늘어뜨림, π/2 = 수평, π = 위 */
  aLEl: number;
  /** 팔의 방위: 0 = 옆, π/2 = 앞 */
  aLAz: number;
  /** 팔꿈치 굽힘 */
  aLEb: number;
  /** 손목·손끝의 굽힘 */
  aLWb: number;
  aREl: number;
  aRAz: number;
  aREb: number;
  aRWb: number;

  /** 발 위치(바닥) x */
  fLX: number;
  /** 발 위치(바닥) z */
  fLZ: number;
  /** 뒤꿈치 들림 정도에 해당하는 발목 높이 증가 */
  fLLift: number;
  /** 0 = 바닥에 놓임, 1 = 골반에 붙어 들려 있음(회전 중 접은 다리) */
  fLCarry: number;
  fRX: number;
  fRZ: number;
  fRLift: number;
  fRCarry: number;
}

export type Channel = keyof Pose;

export const CHANNELS: readonly Channel[] = [
  'px', 'py', 'pz', 'pYaw', 'pRoll', 'pPitch',
  'cYaw', 'cLean', 'cBend',
  'hTilt', 'hNod', 'hYaw',
  'aLEl', 'aLAz', 'aLEb', 'aLWb',
  'aREl', 'aRAz', 'aREb', 'aRWb',
  'fLX', 'fLZ', 'fLLift', 'fLCarry',
  'fRX', 'fRZ', 'fRLift', 'fRCarry',
];

/** 한 바퀴씩 누적될 수 있는 연속 각도 채널. */
export const ANGULAR_CHANNELS: ReadonlySet<Channel> = new Set<Channel>(['pYaw', 'cYaw']);
