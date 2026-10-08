import { TAU } from '../core/math';
import type { Vec3 } from '../core/types';

/**
 * 공간에 놓인 하나의 부드러운 변형장.
 *
 * 모든 선이 같은 장을 샘플링하므로 이웃한 선은 거의 같은 변위를 받는다. 선마다 따로
 * 흔들리지 않고, 다발 전체가 함께 휘고 밀린다. 고정된 상수만 쓰는 결정적 함수이므로
 * 같은 위치·시간은 항상 같은 변위를 돌려준다.
 */
interface Wave {
  /** 파동 진행 방향(단위 벡터) */
  k: Vec3;
  /** 변위 방향(단위 벡터) */
  d: Vec3;
  phase: number;
  /** 주기(period) 동안의 진동 횟수. 정수여야 순환 경계에서 이어진다. */
  cycles: number;
  /** 파장 배율 */
  scale: number;
}

const n = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

const WAVES: readonly Wave[] = [
  { k: n(0.8, 0.5, 0.3), d: n(-0.3, 0.6, 0.7), phase: 0.4, cycles: 1, scale: 1 },
  { k: n(-0.4, 0.9, 0.2), d: n(0.9, 0.1, -0.4), phase: 2.1, cycles: 2, scale: 0.7 },
  { k: n(0.2, -0.3, 0.9), d: n(0.5, 0.8, 0.2), phase: 4.0, cycles: 1, scale: 1.3 },
  { k: n(0.6, -0.7, -0.4), d: n(-0.6, -0.2, 0.8), phase: 5.3, cycles: 3, scale: 0.55 },
];

/**
 * 위치 p, 시간 t에서의 변위.
 * wavelength는 몸 단위의 기본 파장, period는 시간 순환 주기(안무 한 바퀴)다.
 */
export function flowField(p: Vec3, t: number, wavelength: number, period: number): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const w of WAVES) {
    const s = Math.sin(
      (TAU / (wavelength * w.scale)) * (w.k.x * p.x + w.k.y * p.y + w.k.z * p.z) +
        (TAU * w.cycles * t) / period +
        w.phase,
    );
    x += w.d.x * s;
    y += w.d.y * s;
    z += w.d.z * s;
  }
  const norm = 1 / WAVES.length;
  return { x: x * norm, y: y * norm, z: z * norm };
}
