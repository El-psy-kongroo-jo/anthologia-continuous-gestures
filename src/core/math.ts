import type { Vec3 } from './types';

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** 음수에서도 항상 [0, m) 범위를 돌려주는 나머지. */
export const mod = (a: number, m: number): number => ((a % m) + m) % m;

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const normalize = (a: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : fallback;
};
export const vlerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});
/** a에서 n 방향 성분을 제거한다 (n은 단위 벡터). */
export const reject = (a: Vec3, n: Vec3): Vec3 => sub(a, scale(n, dot(a, n)));

/** 3x3 회전 행렬. 열 벡터 x, y, z가 회전된 좌표축이다. */
export interface Mat3 {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

export const apply = (m: Mat3, v: Vec3): Vec3 => ({
  x: m.x.x * v.x + m.y.x * v.y + m.z.x * v.z,
  y: m.x.y * v.x + m.y.y * v.y + m.z.y * v.z,
  z: m.x.z * v.x + m.y.z * v.y + m.z.z * v.z,
});

/** a · b (b를 먼저 적용한 뒤 a). */
export const mul = (a: Mat3, b: Mat3): Mat3 => ({ x: apply(a, b.x), y: apply(a, b.y), z: apply(a, b.z) });

/** 세로축(y) 회전. 0일 때 정면은 +z. */
export const rotY = (t: number): Mat3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: v3(c, 0, -s), y: v3(0, 1, 0), z: v3(s, 0, c) };
};
/** 앞뒤축(z) 회전. 양수일 때 +x 쪽이 올라간다. */
export const rotZ = (t: number): Mat3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: v3(c, s, 0), y: v3(-s, c, 0), z: v3(0, 0, 1) };
};
/** 좌우축(x) 회전. 양수일 때 위쪽(+y)이 앞(+z)으로 숙여진다. */
export const rotX = (t: number): Mat3 => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: v3(1, 0, 0), y: v3(0, c, s), z: v3(0, -s, c) };
};
