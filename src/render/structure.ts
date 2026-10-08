import { CONFIG } from '../config';
import { smoothstep, v3 } from '../core/math';
import type { Side, Vec3 } from '../core/types';
import type { Body } from '../motion/body';
import type { ScreenPoint, Viewport } from './viewport';

/*
 * Structure 표현: 최소한의 구조선 7개로 몸과 안무를 드러낸다.
 * 단계 A의 기본 표현이었고, 최종 작품의 Structure 감상 모드로 쓰기 위해 보존한다.
 */

const SIDES: readonly Side[] = ['L', 'R'];

/**
 * 점들을 지나는 열린 곡선.
 * 접선 방향은 이웃 점에서 얻되, 제어점 거리는 해당 구간 길이에 비례시켜
 * 짧은 마디(손끝 등) 옆에서 곡선이 부풀거나 고리를 만들지 않게 한다.
 */
function curveThrough(ctx: CanvasRenderingContext2D, pts: readonly ScreenPoint[], k: number): void {
  if (pts.length < 2) return;
  const unit = (ax: number, ay: number) => {
    const l = Math.hypot(ax, ay);
    return l > 1e-9 ? { x: ax / l, y: ay / l } : { x: 0, y: 0 };
  };
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) * k;
    const t1 = unit(p2.x - p0.x, p2.y - p0.y);
    const t2 = unit(p3.x - p1.x, p3.y - p1.y);
    ctx.bezierCurveTo(p1.x + t1.x * len, p1.y + t1.y * len, p2.x - t2.x * len, p2.y - t2.y * len, p2.x, p2.y);
  }
}

/** 선분 a→b의 연장선 위 점 */
const extend = (a: Vec3, b: Vec3, k: number): Vec3 => v3(b.x + (b.x - a.x) * k, b.y + (b.y - a.y) * k, b.z + (b.z - a.z) * k);

/**
 * 단계 A의 최소 구조선 7개.
 * 몸의 외곽이 아니라 중심축, 어깨·골반의 방향, 팔다리의 방향만 남긴다.
 */
export function structuralLines(b: Body): Vec3[][] {
  return [
    // 1. 중심축: 골반 → 허리 → 가슴 → 목 → 머리 끝
    [b.pelvis, b.waist, b.chest, b.neck, b.head, b.headTop],
    // 2. 어깨 띠
    [b.shoulder.L, b.neck, b.shoulder.R],
    // 3. 골반 띠(양쪽으로 조금 넘친다)
    [extend(b.hip.R, b.hip.L, 0.25), b.pelvis, extend(b.hip.L, b.hip.R, 0.25)],
    // 4–5. 팔: 어깨 → 팔꿈치 → 손목 → 손끝 방향
    ...SIDES.map((s) => [b.shoulder[s], b.elbow[s], b.wrist[s], b.handTip[s]]),
    // 6–7. 다리: 고관절 → 무릎 → 발목
    ...SIDES.map((s) => [b.hip[s], b.knee[s], b.ankle[s]]),
  ];
}

/** 구조선 7개를 그린다. 몸의 상태(body)만 읽고 아무것도 기억하지 않는다. */
export function drawStructure(ctx: CanvasRenderingContext2D, vp: Viewport, body: Body): void {
  const C = CONFIG.line;
  const pelvisDepth = vp.project(body.pelvis).depth;
  const width = Math.max(1, C.width * (vp.unit / 600));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of structuralLines(body)) {
    const pts = line.map((v) => vp.project(v));
    const depth = pts.reduce((a, p) => a + p.depth, 0) / pts.length;
    // 몸 뒤쪽의 선은 조금 옅고 가늘게: 회전할 때 앞뒤가 읽히도록.
    const behind = smoothstep(0, 0.12, pelvisDepth - depth);
    ctx.strokeStyle = `rgba(${C.color}, ${C.alpha * (1 - C.depthFade * behind)})`;
    ctx.lineWidth = width * (1 - 0.2 * behind);
    ctx.beginPath();
    curveThrough(ctx, pts, C.roundness);
    ctx.stroke();
  }
}
