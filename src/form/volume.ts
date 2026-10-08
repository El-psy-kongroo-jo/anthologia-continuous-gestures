import type { Vec3 } from '../core/types';
import type { Body } from '../motion/body';

/**
 * 보이지 않는 몸의 부피. 뼈대 위에 둥근 막대(캡슐)를 둘러 천이 걸리고 미끄러질 표면을 만든다.
 * 화면에는 그리지 않는다. 반지름은 몸 단위(키 ≈ 1.0)의 가설이다.
 * 손은 넣지 않는다: 천이 손을 둥글게 감싸면 혹처럼 보인다. 천은 손목·팔에 걸린다.
 */
export interface Capsule {
  a: Vec3;
  b: Vec3;
  r: number;
}

export function bodyCapsules(b: Body): Capsule[] {
  const c = (a: Vec3, bb: Vec3, r: number): Capsule => ({ a, b: bb, r });
  return [
    c(b.pelvis, b.waist, 0.1),
    c(b.waist, b.chest, 0.105),
    c(b.hip.L, b.hip.R, 0.085),
    c(b.shoulder.L, b.shoulder.R, 0.05),
    c(b.chest, b.neck, 0.075),
    c(b.neck, b.head, 0.035),
    c(b.head, b.headTop, 0.068),
    c(b.shoulder.L, b.elbow.L, 0.042),
    c(b.elbow.L, b.wrist.L, 0.034),
    c(b.shoulder.R, b.elbow.R, 0.042),
    c(b.elbow.R, b.wrist.R, 0.034),
    c(b.hip.L, b.knee.L, 0.065),
    c(b.knee.L, b.ankle.L, 0.045),
    c(b.hip.R, b.knee.R, 0.065),
    c(b.knee.R, b.ankle.R, 0.045),
  ];
}

/** 계산용으로 미리 펼쳐 둔 캡슐들(할당 없이 반복 계산하기 위해 숫자 배열로 둔다). */
export interface BodyVolume {
  capsules: Capsule[];
  n: number;
  ax: Float64Array;
  ay: Float64Array;
  az: Float64Array;
  dx: Float64Array;
  dy: Float64Array;
  dz: Float64Array;
  invLen2: Float64Array;
  r: Float64Array;
  /** 캡슐을 감싸는 구(중심, 반지름): 멀리 있는 캡슐을 빠르게 건너뛰는 데 쓴다 */
  cx: Float64Array;
  cy: Float64Array;
  cz: Float64Array;
  bound: Float64Array;
  /** 캡슐마다의 거리와 표면 바깥 방향(계산 중 임시 저장) */
  d: Float64Array;
  nx: Float64Array;
  ny: Float64Array;
  nz: Float64Array;
}

export function prepareVolume(capsules: Capsule[]): BodyVolume {
  const n = capsules.length;
  const f = () => new Float64Array(n);
  const v: BodyVolume = {
    capsules, n,
    ax: f(), ay: f(), az: f(), dx: f(), dy: f(), dz: f(), invLen2: f(), r: f(),
    cx: f(), cy: f(), cz: f(), bound: f(),
    d: f(), nx: f(), ny: f(), nz: f(),
  };
  capsules.forEach((c, i) => {
    v.ax[i] = c.a.x;
    v.ay[i] = c.a.y;
    v.az[i] = c.a.z;
    v.dx[i] = c.b.x - c.a.x;
    v.dy[i] = c.b.y - c.a.y;
    v.dz[i] = c.b.z - c.a.z;
    const l2 = v.dx[i]! ** 2 + v.dy[i]! ** 2 + v.dz[i]! ** 2;
    v.invLen2[i] = l2 > 1e-12 ? 1 / l2 : 0;
    v.r[i] = c.r;
    v.cx[i] = (c.a.x + c.b.x) / 2;
    v.cy[i] = (c.a.y + c.b.y) / 2;
    v.cz[i] = (c.a.z + c.b.z) / 2;
    v.bound[i] = Math.sqrt(l2) / 2 + c.r;
  });
  return v;
}

/** bodyDistance의 결과(재사용 가능한 객체에 쓴다) */
export interface Distance {
  d: number;
  gx: number;
  gy: number;
  gz: number;
}

/**
 * 몸 표면까지의 부드러운 부호 거리와 그 기울기(표면 바깥 방향)를 out에 쓴다.
 * 캡슐들의 거리를 지수형 부드러운 최소로 합쳐, 팔과 몸통이 만나는 곳도 매끄러운 한 표면이 된다.
 * smooth는 이어 붙이는 부드러움(몸 단위)이다.
 */
export function bodyDistance(px: number, py: number, pz: number, v: BodyVolume, smooth: number, out: Distance): Distance {
  let minD = Infinity;
  const cutoff = 8 * smooth;
  for (let i = 0; i < v.n; i++) {
    // 감싸는 구까지의 거리가 지금까지의 최소보다 충분히 멀면 이 캡슐은 결과에 영향이 없다.
    const qx = px - v.cx[i]!;
    const qy = py - v.cy[i]!;
    const qz = pz - v.cz[i]!;
    const lower = Math.sqrt(qx * qx + qy * qy + qz * qz) - v.bound[i]!;
    if (lower - minD > cutoff) {
      v.d[i] = Infinity;
      continue;
    }
    const ox = px - v.ax[i]!;
    const oy = py - v.ay[i]!;
    const oz = pz - v.az[i]!;
    let k = (ox * v.dx[i]! + oy * v.dy[i]! + oz * v.dz[i]!) * v.invLen2[i]!;
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    const ex = ox - v.dx[i]! * k;
    const ey = oy - v.dy[i]! * k;
    const ez = oz - v.dz[i]! * k;
    const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const d = dist - v.r[i]!;
    v.d[i] = d;
    if (dist > 1e-9) {
      v.nx[i] = ex / dist;
      v.ny[i] = ey / dist;
      v.nz[i] = ez / dist;
    } else {
      v.nx[i] = 0;
      v.ny[i] = 0;
      v.nz[i] = 0;
    }
    if (d < minD) minD = d;
  }
  let sum = 0;
  let gx = 0;
  let gy = 0;
  let gz = 0;
  for (let i = 0; i < v.n; i++) {
    const rel = v.d[i]! - minD;
    if (rel > cutoff) continue;
    const w = Math.exp(-rel / smooth);
    sum += w;
    gx += v.nx[i]! * w;
    gy += v.ny[i]! * w;
    gz += v.nz[i]! * w;
  }
  const g = Math.sqrt(gx * gx + gy * gy + gz * gz);
  out.d = minD - smooth * Math.log(sum);
  if (g > 1e-9) {
    out.gx = gx / g;
    out.gy = gy / g;
    out.gz = gz / g;
  } else {
    out.gx = 0;
    out.gy = 0;
    out.gz = 1;
  }
  return out;
}

const scratch: Distance = { d: 0, gx: 0, gy: 0, gz: 1 };

/**
 * 점을 몸 표면 쪽으로 옮긴다.
 * - 몸 안에 들어간 점은 표면 밖으로 밀어낸다(push 비율만큼).
 * - 표면에서 looseness 안쪽의 점은 표면으로 끌어당긴다(cling 비율만큼, 가까울수록 강하게).
 * 천이 몸에 걸리고 감기는 효과이며, 끌려 붙은 곳에서 몸의 실루엣이 드러난다.
 * 끌림은 looseness 경계에서 기울기가 이어지도록 줄어들어 선이 꺾이지 않는다.
 * standoff만큼 부푼 표면을 기준으로 하므로, 겹치는 천은 standoff로 앞뒤 층을 나눈다.
 */
export function drapeOnto(
  p: Vec3,
  v: BodyVolume,
  smooth: number,
  push: number,
  cling: number,
  looseness: number,
  standoff = 0,
): Vec3 {
  let x = p.x;
  let y = p.y;
  let z = p.z;
  for (let pass = 0; pass < 2; pass++) {
    const r = bodyDistance(x, y, z, v, smooth, scratch);
    const d = r.d - standoff;
    let move = 0;
    if (d < 0) move = -d * push;
    else if (d < looseness) {
      const k = 1 - d / looseness;
      move = -d * cling * k * k;
    }
    x += r.gx * move;
    y += r.gy * move;
    z += r.gz * move;
    // 한 번 옮긴 거리가 작으면 표면의 기울기가 거의 같으므로 다시 계산하지 않는다.
    if (Math.abs(move) < 0.015) break;
  }
  return { x, y, z };
}
