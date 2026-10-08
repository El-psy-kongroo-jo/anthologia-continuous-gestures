/**
 * 천의 관성: 몸에서 먼 천이 '이전 움직임의 방향을 잠시 유지하다 따라오는' 응답.
 *
 * 몸의 위치를 2차 감쇠계(질량-용수철)의 입력으로 보고, 그 출력을 과거 몸 상태들의
 * 가중 합으로 계산한다. 가중치는 계의 계단 응답에서 얻으므로 합이 1이고, 멈춘 몸 앞에서는
 * 천도 멈춘다. 감쇠가 1보다 작으면 몸이 멈추거나 방향을 바꿀 때 천이 조금 지나쳤다가 돌아온다.
 *
 * 누적 상태 없이 '과거 시점의 몸을 다시 계산'해 쓰므로 시간 탐색과 재현이 그대로 유지된다.
 */

/** 과거 표본 간격(초)과 개수: 약 1.4초 전까지 본다. */
export const INERTIA_DT = 0.06;
export const INERTIA_SAMPLES = 24;

/** 계단 입력에 대한 2차 감쇠계의 응답(0에서 출발해 1로 수렴) */
export function stepResponse(t: number, period: number, damping: number): number {
  if (t <= 0) return 0;
  const w = (2 * Math.PI) / period;
  const z = Math.min(damping, 0.999);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t));
}

/**
 * 과거 표본 k(시간 k·dt 전)에 곱할 가중치. 합은 정확히 1이다.
 * period가 표본 간격보다 충분히 짧으면 거의 현재 몸만 따른다.
 */
export function inertiaWeights(period: number, damping: number, dt = INERTIA_DT, samples = INERTIA_SAMPLES): number[] {
  const w: number[] = [];
  let prev = 0;
  for (let k = 0; k < samples; k++) {
    const edge = k === samples - 1 ? 1 : stepResponse((k + 0.5) * dt, period, damping);
    w.push(edge - prev);
    prev = edge;
  }
  return w;
}
