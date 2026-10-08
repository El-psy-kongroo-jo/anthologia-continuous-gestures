import { CONFIG } from '../config';
import { smoothstep } from '../core/math';
import type { FlowGeometry, FlowPreset } from '../form/flow';
import type { ScreenPoint, Viewport } from './viewport';

/** 가림 처리 단위: 천을 이만큼의 행·열 조각으로 나눠 먼 것부터 그린다. */
const PATCH_ROWS = 4;
const PATCH_COLS = 6;
/** 몸에 닿은 천이 몸에 가려지지 않도록 몸을 이만큼 뒤로 보고 정렬한다(몸 단위). */
const BODY_DEPTH_BIAS = 0.04;
const BACKGROUND = '251, 251, 249';

/** 선마다 다른 끊김 문턱: 끝단과 가장자리에서 선이 엇갈려 풀어진다. */
const fadeThreshold = (i: number) => 0.05 + 0.9 * ((0.5 + i * 0.618034) % 1);

interface Item {
  depth: number;
  draw: () => void;
}

/**
 * Flow 표현을 그린다(화가 알고리즘).
 * 천을 작은 조각으로 나눠 깊이 순서로 그리고, 각 조각은 먼저 배경색으로 뒤를 덮은 뒤 자기 결을 그린다.
 * 그래서 앞의 천이 뒤의 선을 가리고(occlusion), 보이지 않는 몸도 뒤의 천을 가린다(bodyOcclusion).
 * 덮는 면은 배경색이므로 윤곽이나 채운 면으로 보이지 않고, 선이 끊기는 곳으로만 드러난다.
 */
export function drawFlow(ctx: CanvasRenderingContext2D, vp: Viewport, geo: FlowGeometry, preset: FlowPreset): void {
  const items: Item[] = [];
  const lineWidth = Math.max(0.5, preset.lineWidth * (vp.unit / 600));

  for (const sheet of geo.sheets) {
    const proj: ScreenPoint[][] = sheet.points.map((row) => row.map((p) => vp.project(p)));
    const R = proj.length;
    const M = proj[0]!.length;
    for (let r0 = 0; r0 < R - 1; r0 += PATCH_ROWS) {
      const r1 = Math.min(R - 1, r0 + PATCH_ROWS);
      for (let c0 = 0; c0 < M - 1; c0 += PATCH_COLS) {
        const c1 = Math.min(M - 1, c0 + PATCH_COLS);
        const corners = [proj[r0]![c0]!, proj[r0]![c1]!, proj[r1]![c0]!, proj[r1]![c1]!];
        const depth = corners.reduce((a, p) => a + p.depth, 0) / 4;
        const fade = (sheet.fade[r0]![c0]! + sheet.fade[r0]![c1]! + sheet.fade[r1]![c0]! + sheet.fade[r1]![c1]!) / 4;
        const front = sheet.front[(r0 + r1) >> 1]![(c0 + c1) >> 1]!;
        const lineAlpha = sheet.alpha * (front ? 1 : preset.backAlpha);
        const cover = preset.occlusion * smoothstep(0.15, 0.7, fade);
        items.push({
          depth,
          draw: () => {
            if (cover > 0.01) {
              ctx.beginPath();
              for (let c = c0; c <= c1; c++) ctx.lineTo(proj[r0]![c]!.x, proj[r0]![c]!.y);
              for (let r = r0 + 1; r <= r1; r++) ctx.lineTo(proj[r]![c1]!.x, proj[r]![c1]!.y);
              for (let c = c1 - 1; c >= c0; c--) ctx.lineTo(proj[r1]![c]!.x, proj[r1]![c]!.y);
              for (let r = r1 - 1; r > r0; r--) ctx.lineTo(proj[r]![c0]!.x, proj[r]![c0]!.y);
              ctx.closePath();
              ctx.fillStyle = `rgba(${BACKGROUND}, ${cover})`;
              ctx.fill();
            }
            ctx.strokeStyle = `rgba(${CONFIG.flow.color}, ${lineAlpha})`;
            ctx.lineWidth = lineWidth;
            // 선은 행(r)마다 하나, 열(c) 방향으로 흐른다.
            ctx.beginPath();
            for (let r = r0; r <= r1; r++) {
              const threshold = fadeThreshold(r);
              let drawing = false;
              for (let c = c0; c <= c1; c++) {
                const p = proj[r]![c]!;
                if (sheet.fade[r]![c]! < threshold) {
                  drawing = false;
                  continue;
                }
                if (drawing) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
                drawing = true;
              }
            }
            ctx.stroke();
          },
        });
      }
    }
  }

  // 보이지 않는 몸: 배경색의 둥근 막대로 뒤의 천을 가린다.
  if (preset.bodyOcclusion > 0) {
    for (const c of geo.body) {
      const a = vp.project(c.a);
      const b = vp.project(c.b);
      const mid = vp.project({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2, z: (c.a.z + c.b.z) / 2 });
      items.push({
        depth: mid.depth - BODY_DEPTH_BIAS,
        draw: () => {
          ctx.strokeStyle = `rgba(${BACKGROUND}, ${preset.bodyOcclusion})`;
          ctx.lineWidth = 2 * c.r * vp.unit;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        },
      });
    }
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  items.sort((p, q) => p.depth - q.depth);
  for (const it of items) it.draw();
}
