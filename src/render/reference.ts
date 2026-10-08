import { CONFIG } from '../config';
import { v3 } from '../core/math';
import type { Side, Vec3 } from '../core/types';
import type { Body } from '../motion/body';
import type { VeilConfig } from '../form/veil';
import { veilFrame } from './veil';
import type { Viewport } from './viewport';

const SIDES: readonly Side[] = ['L', 'R'];

/**
 * 개발용 기준 표시: 관절 기준점, 지지점과 하중, 무게 중심, 골반 방향.
 * 감상 모드(Structure·Flow)와 별개로 개발 화면에서만 그 위에 겹쳐 그린다.
 */
export function drawReference(ctx: CanvasRenderingContext2D, vp: Viewport, body: Body): void {
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

/**
 * Flow 실험 E2의 개발용 기준 표시: 선을 솟게 한 고정 자세의 관절을 E2의 정면 평면에 겹쳐 그린다.
 * E2는 정면에서 본 평면이므로 3/4 시점의 기준 표시와 따로 둔다.
 */
export function drawVeilReference(ctx: CanvasRenderingContext2D, vp: Viewport, body: Body, C: VeilConfig): void {
  const { cx, cy, fx, fy, scale } = veilFrame(vp, C);
  const at = (v: Vec3) => [cx + (v.x - fx) * scale, cy - (v.y - fy) * scale] as const;
  const bones: [Vec3, Vec3][] = [
    [body.pelvis, body.waist],
    [body.waist, body.chest],
    [body.chest, body.neck],
    [body.neck, body.headTop],
    [body.shoulder.L, body.shoulder.R],
    [body.hip.L, body.hip.R],
  ];
  for (const s of SIDES) {
    bones.push([body.shoulder[s], body.elbow[s]], [body.elbow[s], body.wrist[s]], [body.wrist[s], body.handTip[s]]);
    bones.push([body.hip[s], body.knee[s]], [body.knee[s], body.ankle[s]]);
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 90, 200, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [a, b] of bones) {
    const [ax, ay] = at(a);
    const [bx, by] = at(b);
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();
  ctx.restore();
}
