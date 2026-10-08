import type { Vec3 } from '../core/types';
import { hash01 } from './veil-sheet';

/*
 * 앙상블: 하나의 안무를 여러 인물이 서로 다른 순간에 수행하는 화면의 배치.
 *
 * Anthologia의 회화(옅은 바탕 위의 많은 작은 인물, 같은 안무의 다른 순간, 선명함과 흐림이 섞인 층)를
 * 시간 속으로 옮기기 위한 스케치 단계다. 인물의 형태를 그리지 않고 추상적으로 표현하는 여러 방식
 * (ensemble-styles)이 이 배치를 공유한다.
 *
 * 인물 i는 안무 시간 t + offset_i의 몸이며, 화면 위 자리(x, 바닥 y), 크기, 방향(몸을 돌린 각), 좌우 반전,
 * 선명함을 갖는다. 모든 값은 seed에서 정해지는 고정값이다(같은 설정은 같은 배치).
 */

export interface EnsembleConfig {
  /** 인물 수와 배치 영역(평면 좌표, 몸 단위): 중심과 크기 */
  count: number;
  seed: number;
  area: { center: readonly [number, number]; size: readonly [number, number] };
  /** 인물 키(몸 단위 1.0 기준의 배율) 범위 */
  scale: readonly [number, number];
  /** 인물 사이의 최소 거리(작은 인물 키 기준 배율) */
  spacing: number;
  /** 밀도의 치우침: 인물이 모이는 중심들(영역 안의 0..1 좌표)과 끌림 정도 0..1 */
  clusters: readonly (readonly [number, number])[];
  pull: number;
  /** 선명함 0..1의 분포: 이 비율의 인물은 선명하고, 나머지는 [min, max] 사이로 흐리다 */
  sharpShare: number;
  faint: readonly [number, number];
}

export interface Figure {
  index: number;
  /** 안무 시간에 더하는 시점 차(초) */
  offset: number;
  x: number;
  /** 바닥(발)의 높이 */
  y: number;
  scale: number;
  /** 몸을 돌린 각(라디안, 정면 = 0)과 좌우 반전 */
  yaw: number;
  mirror: 1 | -1;
  sharp: number;
}

/** 배치(안무 길이를 알아야 시점 차를 고르게 나눈다) */
export function layoutEnsemble(C: EnsembleConfig, duration: number): Figure[] {
  const [W, H] = C.area.size;
  const [cx, cy] = C.area.center;
  const figs: Figure[] = [];
  let n = 0;
  for (let tries = 0; figs.length < C.count && tries < C.count * 60; tries++) {
    const h = (k: number) => hash01(C.seed * 1000 + tries * 17 + k);
    let u = h(1);
    let v = h(2);
    // 몇 개의 중심 쪽으로 끌어 밀도에 치우침을 만든다.
    const c = C.clusters[Math.floor(h(3) * C.clusters.length)]!;
    u += (c[0] - u) * C.pull * h(4);
    v += (c[1] - v) * C.pull * h(4);
    const scale = C.scale[0] + (C.scale[1] - C.scale[0]) * h(5) ** 1.5;
    const x = cx + (u - 0.5) * W;
    const y = cy + (v - 0.5) * H - scale * 0.5;
    const minGap = C.spacing * C.scale[0];
    if (figs.some((f) => Math.hypot((f.x - x) * 0.8, f.y - y) < minGap * (0.5 + 0.5 * (f.scale + scale) / (2 * C.scale[0]))))
      continue;
    const sharp = h(6) < C.sharpShare ? 1 : C.faint[0] + (C.faint[1] - C.faint[0]) * h(7);
    figs.push({
      index: n,
      // 시점 차는 안무 전체에 고르게 퍼뜨리고, 같은 순간이 겹치지 않게 조금 어긋나게 둔다.
      offset: ((n * 0.618034 + h(8) * 0.1) % 1) * duration,
      x,
      y,
      scale,
      yaw: (h(9) - 0.5) * 1.4,
      mirror: h(10) < 0.5 ? 1 : -1,
      sharp,
    });
    n++;
  }
  // 먼 것(작은 것)부터 그리도록 크기 순으로 둔다.
  return figs.sort((a, b) => a.scale - b.scale);
}

/**
 * 인물의 몸 좌표 → 평면 좌표(x 오른쪽, y 위쪽, z 관객 쪽). 안무의 바닥 원점을 인물의 자리에 놓으므로
 * 지지 발은 미끄러지지 않고, 무게 이동은 그 자리에서 일어난다.
 */
export function placePoint(f: Figure, p: Vec3): Vec3 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const x = p.x * c + p.z * s;
  const z = -p.x * s + p.z * c;
  return { x: f.x + f.mirror * x * f.scale, y: f.y + p.y * f.scale, z: z * f.scale };
}
