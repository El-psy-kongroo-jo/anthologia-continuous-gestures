import { vlerp } from '../core/math';
import type { Vec3 } from '../core/types';
import type { Body } from '../motion/body';

/*
 * 몸의 입체적 영향: 몸 앞을 지나는 얇은 막이 몸 때문에 관객 쪽으로 솟는 높이.
 *
 * 화면에 그리지 않는다. 선의 장(veil-sheet)은 이 높이를 읽어 국소적으로 휘고(veil.ts),
 * 농도(veil-tone)는 근접도를 읽는다.
 *
 * 1. 몸의 앞면: 끝으로 갈수록 가늘어지는 둥근 막대(veilVolume)마다 정면에서 본 단면의 높이(둥근 막대의 앞면)에, 골반을 지나는
 *    중심면보다 앞으로 나온 만큼을 더한다. 겹치면 높은 쪽. 몸 전체를 받치는 받침 높이는 두지 않으므로
 *    윤곽 가까이에서 막은 거의 원래 면으로 돌아오고, 굴곡은 각 부위의 둥근 단면에서 생긴다.
 * 2. 막의 장력: 막은 몸의 윤곽에서 뚝 떨어지지 않고 정해진 기울기 이하로만 내려간다
 *    (거리 기반의 최대값 확장). 팔과 몸통 사이, 목 주변이 얕은 막으로 이어진다.
 * 3. 부드럽게: 작은 가우스 흐림으로 꼭짓점을 둥글게 하고, 크게 흐린 낮은 솟음을 더해 몸 주변의 넓은
 *    흐름도 몸을 지나며 함께 휘게 한다.
 * 근접도는 몸 영역을 크게 흐려 얻는다. 몸의 경계에서 갑자기 바뀌지 않는다.
 */

export interface ReliefConfig {
  /** 격자 한 칸(몸 단위) */
  cell: number;
  /** 몸의 경계 상자 바깥으로 둘 여유 */
  pad: number;
  /** 막이 내려가는 최대 기울기(높이/거리) */
  tension: number;
  /** 둥글게 하는 흐림의 표준편차 */
  soften: number;
  /** 근접도 흐림의 표준편차 */
  near: number;
  /** 몸의 중심면보다 앞으로 나온 부위(앞으로 뻗은 팔 등)가 더 솟는 배율 */
  depth: number;
  /** 몸의 부피(반지름) 배율 */
  thickness: number;
  /** 농도(빛을 등진 비탈)에 쓰는 기울기를 얻을 때의 흐림: 작은 주름이 아니라 큰 덩어리의 돌아섬을 따른다 */
  shade: number;
  /** 몸 주변의 넓고 낮은 솟음: 높이를 크게 흐려 더하는 표준편차와 배율. 주변의 선도 몸을 지나며 함께 휜다 */
  wide: { blur: number; gain: number };
}

/** 양 끝의 반지름이 다른 둥근 막대 */
export interface Taper {
  a: Vec3;
  b: Vec3;
  ra: number;
  rb: number;
}

/**
 * 막 아래에서 읽힐 몸의 부피(몸 단위, 키 ≈ 1.0). 뼈대가 아니라 살의 덩어리: 가는 목, 넓은 가슴,
 * 잘록해지는 허리와 넓은 골반, 가늘어지는 팔다리. 화면에 그리지 않는다. 반지름은 가설이다.
 */
export function veilVolume(b: Body): Taper[] {
  const t = (a: Vec3, bb: Vec3, ra: number, rb = ra): Taper => ({ a, b: bb, ra, rb });
  const rib = vlerp(b.waist, b.chest, 0.45);
  const list: Taper[] = [
    t(b.head, vlerp(b.head, b.headTop, 0.35), 0.072, 0.07),
    t(b.neck, b.head, 0.04, 0.042),
    t(b.pelvis, b.waist, 0.112, 0.094),
    t(b.waist, rib, 0.094, 0.112),
    t(rib, b.chest, 0.112, 0.104),
    t(b.chest, b.neck, 0.08, 0.042),
    t(b.hip.L, b.hip.R, 0.095),
    t(b.shoulder.L, b.shoulder.R, 0.052),
  ];
  for (const s of ['L', 'R'] as const) {
    list.push(
      t(b.shoulder[s], b.elbow[s], 0.058, 0.042),
      t(b.elbow[s], b.wrist[s], 0.04, 0.03),
      t(b.wrist[s], b.handTip[s], 0.024, 0.014),
      t(b.hip[s], b.knee[s], 0.09, 0.056),
      t(b.knee[s], b.ankle[s], 0.054, 0.032),
    );
  }
  return list;
}

export interface Relief {
  x0: number;
  y0: number;
  cell: number;
  nx: number;
  ny: number;
  /** 막의 높이(0 = 몸의 영향 없음) */
  h: Float32Array;
  /** 몸에 대한 근접도 0..1 */
  near: Float32Array;
  /** 농도용 기울기(격자점에서의 중앙 차분) */
  gx: Float32Array;
  gy: Float32Array;
  maxHeight: number;
}

function blur(src: Float32Array, nx: number, ny: number, sigmaCells: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigmaCells * 3));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp(-(i * i) / (2 * sigmaCells * sigmaCells));
  for (let i = 0; i < k.length; i++) k[i]! /= sum;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = Math.min(nx - 1, Math.max(0, x + i));
        s += src[y * nx + xx]! * k[i + r]!;
      }
      tmp[y * nx + x] = s;
    }
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const yy = Math.min(ny - 1, Math.max(0, y + i));
        s += tmp[yy * nx + x]! * k[i + r]!;
      }
      out[y * nx + x] = s;
    }
  }
  return out;
}

export function buildRelief(body: Body, C: ReliefConfig): Relief {
  const caps = veilVolume(body).map((c) => ({ ...c, ra: c.ra * C.thickness, rb: c.rb * C.thickness, r: Math.max(c.ra, c.rb) * C.thickness }));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const zc = body.pelvis.z;
  for (const c of caps) {
    for (const p of [c.a, c.b]) {
      minX = Math.min(minX, p.x - c.r);
      maxX = Math.max(maxX, p.x + c.r);
      minY = Math.min(minY, p.y - c.r);
      maxY = Math.max(maxY, p.y + c.r);
    }
  }
  const cell = C.cell;
  const x0 = minX - C.pad;
  const y0 = minY - C.pad;
  const nx = Math.ceil((maxX - minX + 2 * C.pad) / cell) + 1;
  const ny = Math.ceil((maxY - minY + 2 * C.pad) / cell) + 1;

  // 1. 앞면 높이
  const front = new Float32Array(nx * ny);
  const inside = new Float32Array(nx * ny);
  for (const c of caps) {
    const ax = c.a.x;
    const ay = c.a.y;
    const dx = c.b.x - ax;
    const dy = c.b.y - ay;
    const dz = c.b.z - c.a.z;
    const len2 = dx * dx + dy * dy;
    const i0 = Math.max(0, Math.floor((Math.min(ax, c.b.x) - c.r - x0) / cell));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, c.b.x) + c.r - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(ay, c.b.y) - c.r - y0) / cell));
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, c.b.y) + c.r - y0) / cell));
    for (let j = j0; j <= j1; j++) {
      const py = y0 + j * cell;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + i * cell;
        const t = len2 > 1e-12 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
        const ex = px - (ax + t * dx);
        const ey = py - (ay + t * dy);
        const d2 = ex * ex + ey * ey;
        const rt = c.ra + (c.rb - c.ra) * t;
        const r2 = rt * rt;
        if (d2 >= r2) continue;
        const z = Math.max(0, (c.a.z + t * dz - zc) * C.depth) + Math.sqrt(r2 - d2);
        const k = j * nx + i;
        if (z > front[k]!) front[k] = z;
        inside[k] = 1;
      }
    }
  }

  // 2. 막의 장력: h(p) = max_q (front(q) - tension·|p - q|). 8방향 두 번 훑기(근사 거리)
  const h = Float32Array.from(front);
  const s1 = C.tension * cell;
  const s2 = s1 * Math.SQRT2;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      let v = h[k]!;
      if (i > 0) v = Math.max(v, h[k - 1]! - s1);
      if (j > 0) {
        v = Math.max(v, h[k - nx]! - s1);
        if (i > 0) v = Math.max(v, h[k - nx - 1]! - s2);
        if (i < nx - 1) v = Math.max(v, h[k - nx + 1]! - s2);
      }
      h[k] = v;
    }
  }
  for (let j = ny - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i;
      let v = h[k]!;
      if (i < nx - 1) v = Math.max(v, h[k + 1]! - s1);
      if (j < ny - 1) {
        v = Math.max(v, h[k + nx]! - s1);
        if (i < nx - 1) v = Math.max(v, h[k + nx + 1]! - s2);
        if (i > 0) v = Math.max(v, h[k + nx - 1]! - s2);
      }
      h[k] = Math.max(0, v);
    }
  }

  // 3. 둥글게, 그리고 근접도
  const soft = blur(h, nx, ny, C.soften / cell);
  const wide = blur(h, nx, ny, C.wide.blur / cell);
  for (let k = 0; k < soft.length; k++) soft[k] = soft[k]! + C.wide.gain * wide[k]!;
  const nearRaw = blur(inside, nx, ny, C.near / cell);
  let maxNear = 0;
  let maxHeight = 0;
  for (let k = 0; k < nearRaw.length; k++) {
    maxNear = Math.max(maxNear, nearRaw[k]!);
    maxHeight = Math.max(maxHeight, soft[k]!);
  }
  for (let k = 0; k < nearRaw.length; k++) nearRaw[k] = Math.min(1, nearRaw[k]! / (0.6 * maxNear));
  const broad = blur(soft, nx, ny, C.shade / cell);
  const gx = new Float32Array(nx * ny);
  const gy = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const l = i > 0 ? k - 1 : k;
      const r = i < nx - 1 ? k + 1 : k;
      const d = j > 0 ? k - nx : k;
      const u = j < ny - 1 ? k + nx : k;
      gx[k] = (broad[r]! - broad[l]!) / ((r - l) * cell);
      gy[k] = (broad[u]! - broad[d]!) / (((u - d) / nx) * cell);
    }
  }
  return { x0, y0, cell, nx, ny, h: soft, near: nearRaw, gx, gy, maxHeight };
}

export interface ReliefSample {
  h: number;
  /** 농도용 기울기(큰 덩어리의 돌아섬) */
  gx: number;
  gy: number;
  near: number;
}

/** 격자 바깥은 몸의 영향이 없다(여유를 충분히 두어 경계에서 값이 0에 가깝다). */
export function sampleRelief(R: Relief, x: number, y: number, out: ReliefSample): ReliefSample {
  const fx = (x - R.x0) / R.cell;
  const fy = (y - R.y0) / R.cell;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= R.nx - 1 || j >= R.ny - 1) {
    out.h = 0;
    out.gx = 0;
    out.gy = 0;
    out.near = 0;
    return out;
  }
  const tx = fx - i;
  const ty = fy - j;
  const k = j * R.nx + i;
  const H = R.h;
  const h00 = H[k]!;
  const h10 = H[k + 1]!;
  const h01 = H[k + R.nx]!;
  const h11 = H[k + R.nx + 1]!;
  out.h = (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
  const lerp2 = (A: Float32Array) =>
    (A[k]! * (1 - tx) + A[k + 1]! * tx) * (1 - ty) + (A[k + R.nx]! * (1 - tx) + A[k + R.nx + 1]! * tx) * ty;
  out.gx = lerp2(R.gx);
  out.gy = lerp2(R.gy);
  out.near = lerp2(R.near);
  return out;
}
