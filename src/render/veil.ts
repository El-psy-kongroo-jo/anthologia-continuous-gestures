import type { Veil, VeilConfig } from '../form/veil';
import type { Viewport } from './viewport';

/** 진하기를 나누는 단계 수: 같은 단계의 선분을 한 경로로 모아 그린다. */
const LEVELS = 40;

/**
 * Flow 실험 E2 그리기. 장의 영역(config.frame)을 뷰포트에 맞추고, 선분마다 진하기를 달리한다.
 * 정면에서 본 평면 좌표(몸 단위, y 위쪽)를 그대로 쓴다.
 */
export function veilFrame(vp: Viewport, C: VeilConfig): { cx: number; cy: number; fx: number; fy: number; scale: number } {
  const [fw, fh] = C.frame.size;
  const [fx, fy] = C.frame.center;
  return { cx: vp.left + vp.width / 2, cy: vp.height / 2, fx, fy, scale: Math.min(vp.width / fw, vp.height / fh) };
}

export function drawVeil(ctx: CanvasRenderingContext2D, vp: Viewport, veil: Veil, C: VeilConfig): void {
  drawToneLines(ctx, vp, veil.lines, C.frame, C.tone.max, C.lineWidth, C.color);
}

/**
 * 점마다 진하기가 다른 선들을 그린다(평면 좌표, 몸 단위, y 위쪽). frame 영역을 뷰포트에 맞춘다.
 * 진하기 0인 점이 끼인 선분은 그리지 않는다.
 */
export function drawToneLines(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  lines: readonly { x: Float32Array; y: Float32Array; a: Float32Array }[],
  frame: VeilConfig['frame'],
  maxA: number,
  lineWidth: number,
  color: string,
): void {
  const { cx, cy, fx, fy, scale } = veilFrame(vp, { frame } as VeilConfig);
  const paths: Path2D[] = [];
  for (let l = 0; l < LEVELS; l++) paths.push(new Path2D());
  for (const line of lines) {
    const { x, y, a } = line;
    let level = -1;
    let path: Path2D | null = null;
    for (let s = 0; s + 1 < x.length; s++) {
      // 한쪽 끝이 가려졌으면 그 선분은 그리지 않는다.
      const alpha = Math.min(a[s]!, a[s + 1]!) > 0 ? 0.5 * (a[s]! + a[s + 1]!) : 0;
      const l = Math.min(LEVELS - 1, Math.round((alpha / maxA) * (LEVELS - 1)));
      const x0 = cx + (x[s]! - fx) * scale;
      const y0 = cy - (y[s]! - fy) * scale;
      if (l <= 0) {
        level = -1;
        continue;
      }
      if (l !== level) {
        path = paths[l]!;
        path.moveTo(x0, y0);
        level = l;
      }
      path!.lineTo(cx + (x[s + 1]! - fx) * scale, cy - (y[s + 1]! - fy) * scale);
    }
  }
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  for (let l = 1; l < LEVELS; l++) {
    ctx.strokeStyle = `rgba(${color}, ${((l / (LEVELS - 1)) * maxA).toFixed(3)})`;
    ctx.stroke(paths[l]!);
  }
  ctx.restore();
}
