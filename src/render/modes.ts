import { CONFIG } from '../config';
import type { Vec3 } from '../core/types';
import { buildFlow } from '../form/flow';
import { buildStream } from '../form/stream';
import { buildVeil, type Veil } from '../form/veil';
import { stillBody } from '../motion/still';
import { mod } from '../core/math';
import { INERTIA_DT } from '../form/inertia';
import { solveBody, type Body } from '../motion/body';
import type { Score } from '../motion/score';
import { drawFlow } from './flow';
import { drawStream } from './stream';
import { drawVeil } from './veil';
import { drawStructure } from './structure';
import type { Viewport } from './viewport';

/**
 * 감상 모드. 모든 모드는 같은 안무 시간과 같은 몸 상태를 받아 그리기만 한다.
 * 모드에는 상태가 없으므로 전환해도 동작이 초기화되지 않는다.
 * - structure: 최소한의 구조선(단계 A의 표현)
 * - flow: 여러 선이 함께 흐르며 몸을 암시(기본 감상 모드, 현재는 천 모델)
 * - flow-e1: Flow 실험 E1(연관된 선들의 흐름 속에서 몸의 방향이 잠시 나타났다 풀림). 개발 화면에서만
 * - flow-e2: Flow 실험 E2(넓은 선의 장 아래에서 몸이 선을 솟게 함). 지금은 고정 자세의 정지 화면. 개발 화면에서만
 * - trace: 지나간 움직임의 궤적(아직 구현하지 않음)
 */
export type ModeId = 'structure' | 'flow' | 'flow-e1' | 'flow-e2';
export type FlowPresetId = 1 | 2 | 3;

export interface ModeView {
  mode: ModeId;
  preset: FlowPresetId;
  /** Flow 실험 E1에서 몸의 영향 배율(0이면 몸 없이 흐름만) */
  presence?: number;
}

/** 카메라 쪽을 향한 단위 벡터(viewport.project의 깊이 방향) */
function toCamera(): Vec3 {
  const { yaw, pitch } = CONFIG.camera;
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}

let veilCache: Veil | null = null;
/** E2의 고정 자세와 선의 장(같은 설정이면 항상 같으므로 한 번만 계산한다) */
export function stillVeil(): Veil {
  veilCache ??= buildVeil(CONFIG.flowE2, stillBody(CONFIG.flowE2.pose));
  return veilCache;
}

export function modeLabel(v: ModeView): string {
  if (v.mode === 'structure') return 'Structure';
  if (v.mode === 'flow-e2') return CONFIG.flowE2.label;
  if (v.mode === 'flow-e1') return CONFIG.flowE1.label + (v.presence === 0 ? ' · 몸 영향 없음' : '');
  return CONFIG.flow.presets[v.preset].label;
}

export function drawMode(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  view: ModeView,
  score: Score,
  t: number,
  body: Body,
): void {
  if (view.mode === 'structure') {
    drawStructure(ctx, vp, body);
    return;
  }
  if (view.mode === 'flow-e2') {
    // 정지 화면 검토 단계: 안무 시간과 무관한 고정 자세. 기하는 한 번 계산해 재사용한다.
    drawVeil(ctx, vp, stillVeil(), CONFIG.flowE2);
    return;
  }
  if (view.mode === 'flow-e1') {
    // E1은 자기 장면 시간으로 순환한다. score는 A-2 전체 순서여야 한다(main.ts가 맞춘다).
    const E = CONFIG.flowE1;
    const sigma = mod(t - E.scene.from, E.scene.length);
    const bodyAtScene = (s: number) => solveBody(score, E.scene.from + s);
    const strokes = buildStream(E, sigma, bodyAtScene, toCamera(), view.presence ?? 1);
    const centerDepth = vp.project({ x: 0, y: 0.7, z: 0 }).depth;
    drawStream(ctx, vp, strokes, E.lineWidth, centerDepth);
    return;
  }
  const preset = CONFIG.flow.presets[view.preset];
  // 관성은 같은 안무의 과거 몸들에서 얻는다(기억하지 않고 다시 계산한다).
  const history = new Map<number, Body>([[0, body]]);
  const bodyAt = (k: number) => {
    let b = history.get(k);
    if (!b) {
      b = solveBody(score, t - k * INERTIA_DT);
      history.set(k, b);
    }
    return b;
  };
  drawFlow(ctx, vp, buildFlow(bodyAt, t, score.duration, preset, toCamera()), preset);
}
