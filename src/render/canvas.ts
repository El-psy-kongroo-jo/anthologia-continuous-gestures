import { CONFIG } from '../config';
import { smoothstep, v3 } from '../core/math';
import type { Side, Vec3 } from '../core/types';
import type { Body } from '../motion/body';
import type { ScreenPoint, Viewport } from './viewport';

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

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly viewport: Viewport) {
    const ctx = viewport.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.');
    this.ctx = ctx;
  }

  /** 캔버스 전체를 지운다(뷰포트가 캔버스를 나눠 써도 한 번만 부른다). */
  clear(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fbfbf9';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(this.viewport.pixelRatio, 0, 0, this.viewport.pixelRatio, 0, 0);
  }

  /** 개발용 비교 화면: 뷰포트 위쪽의 이름표와 왼쪽 경계선 */
  drawLabel(text: string): void {
    const { ctx, viewport: vp } = this;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, vp.left + vp.width / 2, vp.height - 16);
    if (vp.left > 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vp.left, 0);
      ctx.lineTo(vp.left, vp.height);
      ctx.stroke();
    }
  }

  drawBody(body: Body): void {
    const { ctx, viewport: vp } = this;
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

  /** 개발용: 기준점, 지지점, 무게 중심 */
  drawReference(body: Body): void {
    const { ctx, viewport: vp } = this;
    const u = vp.unit;
    const dot = (v: Vec3, r: number, fill: string) => {
      const p = vp.project(v);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };

    // 바닥선
    const g0 = vp.project(v3(-0.6, 0, 0));
    const g1 = vp.project(v3(0.6, 0, 0));
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y);
    ctx.lineTo(g1.x, g1.y);
    ctx.stroke();

    // 관절 기준점
    const joints: Vec3[] = [body.pelvis, body.waist, body.chest, body.neck, body.head];
    for (const s of SIDES) joints.push(body.shoulder[s], body.elbow[s], body.wrist[s], body.hip[s], body.knee[s], body.ankle[s]);
    for (const j of joints) dot(j, 2.2, 'rgba(40, 90, 200, 0.75)');

    // 지지점: 발목 아래 바닥에 하중만큼 채워진 원
    for (const s of SIDES) {
      const a = body.ankle[s];
      const ground = vp.project(v3(a.x, 0, a.z));
      const r = 0.022 * u;
      ctx.beginPath();
      ctx.arc(ground.x, ground.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 70, 40, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const load = body.load[s];
      if (load > 0.001) {
        ctx.beginPath();
        ctx.arc(ground.x, ground.y, r * Math.sqrt(load), 0, Math.PI * 2);
        ctx.fillStyle = load >= CONFIG.support.supportThreshold ? 'rgba(200, 70, 40, 0.75)' : 'rgba(200, 70, 40, 0.3)';
        ctx.fill();
      }
      // 발목에서 바닥까지의 수직선(들림 표시)
      const ap = vp.project(a);
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.moveTo(ap.x, ap.y);
      ctx.lineTo(ground.x, ground.y);
      ctx.strokeStyle = 'rgba(200, 70, 40, 0.35)';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 무게 중심과 그 바닥 투영
    const com = vp.project(body.com);
    const comGround = vp.project(v3(body.com.x, 0, body.com.z));
    ctx.strokeStyle = 'rgba(20, 140, 90, 0.55)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(com.x, com.y);
    ctx.lineTo(comGround.x, comGround.y);
    ctx.stroke();
    ctx.setLineDash([]);
    dot(body.com, 3.2, 'rgba(20, 140, 90, 0.85)');
    const k = 0.018 * u;
    ctx.beginPath();
    ctx.moveTo(comGround.x - k, comGround.y);
    ctx.lineTo(comGround.x + k, comGround.y);
    ctx.moveTo(comGround.x, comGround.y - k * 0.5);
    ctx.lineTo(comGround.x, comGround.y + k * 0.5);
    ctx.strokeStyle = 'rgba(20, 140, 90, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 골반이 향한 방향
    const fp0 = vp.project(v3(body.pelvis.x, 0.003, body.pelvis.z));
    const fp1 = vp.project(v3(body.pelvis.x + body.facing.x * 0.12, 0.003, body.pelvis.z + body.facing.z * 0.12));
    ctx.beginPath();
    ctx.moveTo(fp0.x, fp0.y);
    ctx.lineTo(fp1.x, fp1.y);
    ctx.strokeStyle = 'rgba(40, 90, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
