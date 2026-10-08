import { smoothstep } from '../core/math';

/*
 * 선의 농도와 가장자리 처리.
 *
 * 농도는 한 선을 따라 부드럽게 변하는 세 값의 곱이다. 몸의 경계를 마스크로 쓰지 않는다.
 * - 근접도: 몸 영역을 크게 흐린 값. 먼 곳은 아주 옅은 은회색, 몸 위는 중간 회색.
 * - 간격: 선 사이가 좁아지면(굴곡이 압축되는 곳) 조금 진하게, 넓어지면(솟는 곳) 조금 옅게.
 * - 돌아섬: 막이 빛(화면 위쪽 오른편)에서 돌아서는 비탈에서는 조금 진하게, 빛을 향한 비탈은 조금 옅게.
 *   면을 채우지 않고 선의 진하기로만 둥근 부피를 돕는다.
 * - 가장자리: 선의 양 끝과 장의 위·아래 가장자리에서 서서히 사라진다(테두리 없음).
 */

export interface ToneConfig {
  /** 몸에서 먼 곳과 몸 위의 진하기(0..1) */
  far: number;
  body: number;
  /** 근접도에 대한 곡선(작을수록 몸 주변으로 넓게 진해짐) */
  nearGamma: number;
  /** 간격 비(기준 간격 / 현재 간격)에 대한 지수와 범위 */
  compress: { gamma: number; min: number; max: number };
  /** 간격 비를 선을 따라 고르게 하는 이동 평균의 반폭(표본 수) */
  smooth: number;
  /** 빛의 방향(정면 평면), 돌아선 비탈과 빛을 향한 비탈의 진하기 변화, 기준 기울기 */
  light: { direction: readonly [number, number]; shade: number; lit: number; slope: number };
  /** 장의 위·아래 가장자리에서 옅어지는 폭(v) */
  rim: number;
  /**
   * 선 끝 가까이를 조금 진하게 해서 옅은 선 끝이 읽히게 한다(테두리 선은 아님).
   * gain: 진하기 배율, width: 옅어지는 길이의 몇 배까지 영향을 주는지. 없으면 끝은 그냥 사라진다.
   */
  hem?: { gain: number; width: number };
  max: number;
}

/**
 * near: 근접도 0..1, density: 기준 간격 / 현재 간격(1 = 변화 없음), gx·gy: 막 높이의 기울기,
 * edge: 선 끝에서의 거리 / 옅어지는 길이, v: 장 안의 위치 0..1
 */
export function toneAt(
  T: ToneConfig,
  near: number,
  density: number,
  gx: number,
  gy: number,
  edge: number,
  v: number,
): number {
  const n = Math.pow(Math.max(0, Math.min(1, near)), T.nearGamma);
  const base = T.far + (T.body - T.far) * n;
  const d = Math.min(T.compress.max, Math.max(T.compress.min, density));
  const L = T.light;
  const ll = Math.hypot(L.direction[0], L.direction[1]) || 1;
  // 기울기가 빛 쪽을 향하면(오르막이 빛 쪽) 그 비탈은 빛을 등진다.
  const turn = Math.max(-1, Math.min(1, (gx * L.direction[0] + gy * L.direction[1]) / ll / L.slope));
  const light = turn > 0 ? 1 + L.shade * turn : 1 + L.lit * turn;
  const rim = smoothstep(0, T.rim, v) * smoothstep(0, T.rim, 1 - v);
  const fade = smoothstep(0, 1, edge);
  const hem = T.hem ? 1 + T.hem.gain * (1 - smoothstep(1, 1 + T.hem.width, edge)) : 1;
  return Math.min(T.max, base * Math.pow(d, T.compress.gamma) * light * rim * fade * hem);
}
