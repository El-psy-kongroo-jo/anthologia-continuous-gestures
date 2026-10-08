import { CONFIG } from '../config';
import { smoothstep } from '../core/math';
import type { StreamStroke } from '../form/stream';
import type { Viewport } from './viewport';

/** Flow 실험 E1을 그린다. 선 하나는 한 번의 꺾은선 획이며, 몸 중심보다 뒤의 선은 조금 옅다. */
export function drawStream(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  strokes: readonly StreamStroke[],
  lineWidth: number,
  centerDepth: number,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.5, lineWidth * (vp.unit / 600));
  for (const s of strokes) {
    const pts = s.points.map((p) => vp.project(p));
    const behind = smoothstep(0, 0.3, centerDepth - pts[pts.length >> 1]!.depth);
    ctx.strokeStyle = `rgba(${CONFIG.flow.color}, ${s.alpha * (1 - 0.35 * behind)})`;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    ctx.stroke();
  }
}
