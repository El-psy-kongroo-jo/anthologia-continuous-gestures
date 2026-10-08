import { add, cross, dot, length, normalize, reject, scale, sub } from '../core/math';
import type { Vec3 } from '../core/types';

/**
 * 두 마디 사지의 역기구학. 마디 길이는 항상 l1, l2로 유지된다.
 * 목표가 닿지 않으면 그 방향으로 최대 길이까지만 뻗는다(사지가 늘어나지 않는다).
 * pole은 무릎·팔꿈치가 굽어질 방향의 힌트다.
 */
export function solveTwoBone(
  root: Vec3,
  target: Vec3,
  l1: number,
  l2: number,
  pole: Vec3,
  maxExtension: number,
): { mid: Vec3; end: Vec3; reached: boolean } {
  const toTarget = sub(target, root);
  const want = length(toTarget);
  const maxReach = (l1 + l2) * maxExtension;
  const minReach = Math.abs(l1 - l2) + 1e-6;
  const d = Math.min(Math.max(want, minReach), maxReach);
  const dir = normalize(toTarget, { x: 0, y: -1, z: 0 });
  const end = add(root, scale(dir, d));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let bend = reject(pole, dir);
  if (length(bend) < 1e-6) bend = reject({ x: 0, y: 0, z: 1 }, dir);
  bend = normalize(bend, { x: 0, y: 0, z: 1 });
  const mid = add(add(root, scale(dir, a)), scale(bend, h));
  return { mid, end, reached: Math.abs(d - want) < 1e-9 };
}

/**
 * 바닥을 딛고 있는 발이 미끄러지지 않도록, 다리가 닿을 때까지 골반을 낮추는 양을 구한다.
 * 발을 끌어오는 대신 골반을 조정하므로 지지점은 고정된다.
 * 반환값은 골반을 내려야 하는 높이(≥ 0).
 */
export function pelvisDropForReach(
  hips: readonly Vec3[],
  ankles: readonly Vec3[],
  maxReach: number,
): number {
  let drop = 0;
  for (let i = 0; i < hips.length; i++) {
    const hip = hips[i]!;
    const ankle = ankles[i]!;
    const dh = Math.hypot(hip.x - ankle.x, hip.z - ankle.z);
    const allowed = Math.sqrt(Math.max(0, maxReach * maxReach - dh * dh));
    drop = Math.max(drop, hip.y - ankle.y - allowed);
  }
  return drop;
}

/**
 * 경첩 관절(팔꿈치) 제약.
 * child 방향이 natural 굽힘 방향의 반대로 꺾이지 않게 하고(과신전 방지),
 * 최대 굽힘 각도를 넘지 않게 한다. parent, natural은 단위 벡터.
 */
export function clampHinge(parent: Vec3, child: Vec3, natural: Vec3, maxBend: number): Vec3 {
  const along = dot(child, parent);
  let side = reject(child, parent);
  const back = dot(side, natural);
  if (back < 0) side = sub(side, scale(natural, back));
  const sideLen = length(side);
  let angle = Math.atan2(sideLen, along);
  if (angle > maxBend) angle = maxBend;
  if (sideLen < 1e-9) return along >= 0 ? parent : normalize(add(scale(parent, Math.cos(angle)), scale(natural, Math.sin(angle))), parent);
  const sideDir = scale(side, 1 / sideLen);
  return add(scale(parent, Math.cos(angle)), scale(sideDir, Math.sin(angle)));
}

/** 부모 방향에 대해 child가 maxAngle 이상 꺾이지 않게 한다(방향 무관). */
export function clampCone(parent: Vec3, child: Vec3, maxAngle: number): Vec3 {
  const along = dot(child, parent);
  const side = reject(child, parent);
  const sideLen = length(side);
  const angle = Math.atan2(sideLen, along);
  if (angle <= maxAngle || sideLen < 1e-9) return normalize(child, parent);
  return add(scale(parent, Math.cos(maxAngle)), scale(side, Math.sin(maxAngle) / sideLen));
}

/** 두 단위 벡터 사이의 각 */
export const angleBetween = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b));
