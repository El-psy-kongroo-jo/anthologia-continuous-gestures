import { CONFIG } from '../config';
import type { Vec3 } from '../core/types';
import { buildFlow } from '../form/flow';
import { INERTIA_DT } from '../form/inertia';
import { solveBody, type Body } from '../motion/body';
import type { Score } from '../motion/score';
import { drawFlow } from './flow';
import { drawStructure } from './structure';
import type { Viewport } from './viewport';

/**
 * 감상 모드. 모든 모드는 같은 안무 시간과 같은 몸 상태를 받아 그리기만 한다.
 * 모드에는 상태가 없으므로 전환해도 동작이 초기화되지 않는다.
 * - structure: 최소한의 구조선(단계 A의 표현)
 * - flow: 여러 선이 함께 흐르며 몸을 암시(기본 감상 모드)
 * - trace: 지나간 움직임의 궤적(아직 구현하지 않음)
 */
export type ModeId = 'structure' | 'flow';
export type FlowPresetId = 1 | 2 | 3;

export interface ModeView {
  mode: ModeId;
  preset: FlowPresetId;
}

/** 카메라 쪽을 향한 단위 벡터(viewport.project의 깊이 방향) */
function toCamera(): Vec3 {
  const { yaw, pitch } = CONFIG.camera;
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}

export function modeLabel(v: ModeView): string {
  return v.mode === 'structure' ? 'Structure' : CONFIG.flow.presets[v.preset].label;
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
