import { CONFIG } from '../config';
import {
  add, clamp, mul, normalize, reject, rotX, rotY, rotZ, scale, sub, v3, vlerp, apply, dot, length,
  type Mat3,
} from '../core/math';
import { SIDE_SIGN, type Pose, type Side, type Vec3 } from '../core/types';
import { clampCone, clampHinge, pelvisDropForReach, solveTwoBone } from './constraints';
import type { Score } from './score';

/** 보이지 않는 몸의 기준점과 지지 관계. 렌더러는 이 값만 읽는다. */
export interface Body {
  time: number;
  pelvis: Vec3;
  waist: Vec3;
  chest: Vec3;
  neck: Vec3;
  head: Vec3;
  headTop: Vec3;
  shoulder: Record<Side, Vec3>;
  elbow: Record<Side, Vec3>;
  wrist: Record<Side, Vec3>;
  handTip: Record<Side, Vec3>;
  hip: Record<Side, Vec3>;
  knee: Record<Side, Vec3>;
  ankle: Record<Side, Vec3>;
  /** 무게 중심(골반·가슴·머리의 가중 평균) */
  com: Vec3;
  /** 바닥 접촉 정도 0..1 */
  contact: Record<Side, number>;
  /** 하중 비율 0..1 (두 발의 합 = 1) */
  load: Record<Side, number>;
  /** 무게 중심의 바닥 투영이 지지 영역에서 벗어난 거리 */
  balanceError: number;
  /** 다리가 닿도록 골반을 내린 양(안무 작성 오류의 지표) */
  pelvisCorrection: number;
  /** 골반이 향한 방향(세계 기준 앞) */
  facing: Vec3;
}

const SIDES: readonly Side[] = ['L', 'R'];
const X = v3(1, 0, 0);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);

/** 가슴(어깨 띠)의 회전. 기울기와 굽힘은 골반 기준의 상대값을 더한다. */
function chestFrame(p: Pose): Mat3 {
  return mul(rotY(p.cYaw), mul(rotZ(p.pRoll + p.cLean), rotX(p.pPitch + p.cBend)));
}

function waistFrame(p: Pose): Mat3 {
  return mul(rotY((p.pYaw + p.cYaw) / 2), mul(rotZ(p.pRoll + p.cLean * 0.5), rotX(p.pPitch + p.cBend * 0.5)));
}

function pelvisFrame(p: Pose): Mat3 {
  return mul(rotY(p.pYaw), mul(rotZ(p.pRoll), rotX(p.pPitch)));
}

interface ArmAngles {
  el: number;
  az: number;
  eb: number;
  wb: number;
}

function armAngles(p: Pose, side: Side): ArmAngles {
  return side === 'L'
    ? { el: p.aLEl, az: p.aLAz, eb: p.aLEb, wb: p.aLWb }
    : { el: p.aREl, az: p.aRAz, eb: p.aREb, wb: p.aRWb };
}

/** 가슴 좌표계에서 팔꿈치가 굽어지는 자연스러운 방향: 앞, 약간 위, 약간 안쪽 */
function elbowBendHint(side: Side): Vec3 {
  return v3(-0.25 * SIDE_SIGN[side], 0.35, 1);
}

/** 가슴 좌표계에서의 위팔·아래팔·손 방향 */
function armLocal(a: ArmAngles, side: Side): { upper: Vec3; fore: Vec3; hand: Vec3; bend: Vec3 } {
  const s = SIDE_SIGN[side];
  const horiz = v3(s * Math.cos(a.az), 0, Math.sin(a.az));
  const upper = normalize(add(scale(Y, -Math.cos(a.el)), scale(horiz, Math.sin(a.el))));
  const bend = normalize(reject(elbowBendHint(side), upper), normalize(reject(Y, upper), Z));
  const fore = add(scale(upper, Math.cos(a.eb)), scale(bend, Math.sin(a.eb)));
  const bend2 = normalize(reject(bend, fore), bend);
  const hand = add(scale(fore, Math.cos(a.wb)), scale(bend2, Math.sin(a.wb)));
  return { upper, fore, hand, bend };
}

/**
 * 작품 시간 t의 몸을 계산한다.
 *
 * - 골반·몸통·다리는 t의 자세를 쓴다(움직임을 이끄는 부분).
 * - 머리와 팔의 각 마디는 CONFIG.lag만큼 이전 시점의 몸통·팔 자세에서 방향을 가져온다.
 *   위치는 현재의 부모 관절에서 이어지므로 길이는 변하지 않고, 말단만 늦게 따라온다.
 * - 바닥을 딛은 발은 안무에 적힌 위치에 고정되고, 다리가 닿지 않으면 골반을 낮춘다.
 */
export function solveBody(score: Score, t: number): Body {
  const B = CONFIG.body;
  const L = CONFIG.lag;
  const p = score.sample(t);

  // --- 골반과 발 ---
  const pelvisR = pelvisFrame(p);
  const yawR = rotY(p.pYaw);
  let pelvis = v3(p.px, B.pelvisHeight + p.py, p.pz);
  const hipLocal = (side: Side) => v3(SIDE_SIGN[side] * B.hipHalfWidth, 0, 0);
  const foot = (side: Side) =>
    side === 'L'
      ? { x: p.fLX, z: p.fLZ, lift: p.fLLift, carry: clamp(p.fLCarry, 0, 1) }
      : { x: p.fRX, z: p.fRZ, lift: p.fRLift, carry: clamp(p.fRCarry, 0, 1) };
  const planted = (side: Side) => {
    const f = foot(side);
    return v3(f.x, B.ankleHeight + f.lift, f.z);
  };
  const carried = (side: Side, pel: Vec3) =>
    add(pel, apply(yawR, v3(SIDE_SIGN[side] * B.carry.x, B.carry.y, B.carry.z)));

  const maxReach = (B.thigh + B.shin) * B.maxLegExtension;
  // 바닥에 놓인 발(완전히 들린 발 제외)이 닿도록 골반을 낮춘다.
  const reachHips: Vec3[] = [];
  const reachAnkles: Vec3[] = [];
  for (const side of SIDES) {
    if (foot(side).carry < 1) {
      reachHips.push(add(pelvis, apply(pelvisR, hipLocal(side))));
      reachAnkles.push(planted(side));
    }
  }
  const pelvisCorrection = pelvisDropForReach(reachHips, reachAnkles, maxReach);
  pelvis = sub(pelvis, v3(0, pelvisCorrection, 0));

  const hip = {} as Record<Side, Vec3>;
  const knee = {} as Record<Side, Vec3>;
  const ankle = {} as Record<Side, Vec3>;
  const contact = {} as Record<Side, number>;
  const facing = apply(yawR, Z);
  for (const side of SIDES) {
    const f = foot(side);
    hip[side] = add(pelvis, apply(pelvisR, hipLocal(side)));
    const target = vlerp(planted(side), carried(side, pelvis), f.carry);
    // 무릎은 골반이 향한 앞쪽, 약간 바깥으로 굽는다. 들어 올린 다리는 바깥으로 열어
    // 지지 다리와 겹치지 않게 한다.
    const outward = scale(apply(yawR, X), SIDE_SIGN[side]);
    const pole = add(scale(facing, 1 - 0.6 * f.carry), scale(outward, 0.12 + 0.8 * f.carry));
    const leg = solveTwoBone(hip[side], target, B.thigh, B.shin, pole, B.maxLegExtension);
    knee[side] = leg.mid;
    ankle[side] = leg.end;
    contact[side] = (1 - f.carry) * (1 - clamp(f.lift / CONFIG.support.liftForNoContact, 0, 1));
  }

  // --- 몸통 ---
  const waistR = waistFrame(p);
  const chestR = chestFrame(p);
  const waist = add(pelvis, apply(waistR, v3(0, B.spine / 2, 0)));
  const chest = add(waist, apply(chestR, v3(0, B.spine / 2, 0)));
  const neck = add(chest, apply(chestR, v3(0, B.shoulderRise, 0)));

  // 머리: 몸통보다 늦게 따라온다.
  const pH = score.sample(t - L.head);
  const headR = mul(chestFrame(pH), mul(rotY(pH.hYaw), mul(rotZ(pH.hTilt), rotX(pH.hNod))));
  const head = add(neck, apply(headR, v3(0, B.neck, 0)));
  const headTop = add(head, apply(headR, v3(0, B.headTop, 0)));

  // --- 팔: 위팔 → 아래팔 → 손끝 순으로 늦게 따라온다. ---
  const pUA = score.sample(t - L.upperArm);
  const pFA = score.sample(t - L.forearm);
  const pHA = score.sample(t - L.hand);
  const chestUA = chestFrame(pUA);
  const chestFA = chestFrame(pFA);
  const chestHA = chestFrame(pHA);

  const shoulder = {} as Record<Side, Vec3>;
  const elbow = {} as Record<Side, Vec3>;
  const wrist = {} as Record<Side, Vec3>;
  const handTip = {} as Record<Side, Vec3>;
  for (const side of SIDES) {
    shoulder[side] = add(chest, apply(chestR, v3(SIDE_SIGN[side] * B.shoulderHalfWidth, B.shoulderRise, 0)));
    const upper = apply(chestUA, armLocal(armAngles(pUA, side), side).upper);
    elbow[side] = add(shoulder[side], scale(upper, B.upperArm));

    const foreRaw = apply(chestFA, armLocal(armAngles(pFA, side), side).fore);
    const natural = normalize(reject(apply(chestR, elbowBendHint(side)), upper), normalize(reject(Y, upper), Z));
    const fore = clampHinge(upper, foreRaw, natural, B.maxElbowBend);
    wrist[side] = add(elbow[side], scale(fore, B.forearm));

    const handRaw = apply(chestHA, armLocal(armAngles(pHA, side), side).hand);
    const hand = clampCone(fore, handRaw, B.maxHandBend);
    handTip[side] = add(wrist[side], scale(hand, B.hand));
  }

  // --- 무게 중심과 하중 ---
  const M = CONFIG.mass;
  const com = scale(add(add(scale(pelvis, M.pelvis), scale(chest, M.chest)), scale(head, M.head)), 1 / (M.pelvis + M.chest + M.head));
  const { load, balanceError } = distributeLoad(com, ankle, contact);

  return {
    time: t,
    pelvis, waist, chest, neck, head, headTop,
    shoulder, elbow, wrist, handTip,
    hip, knee, ankle,
    com, contact, load, balanceError, pelvisCorrection, facing,
  };
}

/**
 * 무게 중심의 바닥 투영을 두 발 사이에 놓고 하중을 나눈다.
 * 바닥에서 떨어진 발은 하중을 받지 않는다.
 */
export function distributeLoad(
  com: Vec3,
  ankle: Record<Side, Vec3>,
  contact: Record<Side, number>,
): { load: Record<Side, number>; balanceError: number } {
  const g = (v: Vec3) => v3(v.x, 0, v.z);
  const c = g(com);
  const a = g(ankle.R);
  const b = g(ankle.L);
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const s = len2 > 1e-12 ? clamp(dot(sub(c, a), ab) / len2, 0, 1) : 0.5;
  const wL = s * contact.L;
  const wR = (1 - s) * contact.R;
  const total = wL + wR;
  const load = total > 1e-9 ? { L: wL / total, R: wR / total } : { L: 0, R: 0 };

  // 지지 영역: 두 발이 모두 닿아 있으면 두 발 사이의 선분, 한 발이면 그 발.
  const distToSegment = () => length(sub(c, add(a, scale(ab, s))));
  let balanceError: number;
  if (contact.L > 0.5 && contact.R > 0.5) balanceError = distToSegment();
  else if (contact.L > 0.5) balanceError = length(sub(c, b));
  else if (contact.R > 0.5) balanceError = length(sub(c, a));
  else balanceError = Infinity;
  return { load, balanceError };
}
