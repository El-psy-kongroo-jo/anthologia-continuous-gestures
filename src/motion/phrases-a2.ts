/**
 * 안무 A-2 — 임시 안무(provisional). 현재 기본 안무.
 *
 * A-1 검토에서 받은 지적: 선의 변화량에 비해 느리고, 구절마다 휴식 자세로 돌아와 개별 동작
 * 시범처럼 보인다. A-2는 같은 세 구절과 같은 신체 구조를 쓰되 다음을 바꿨다.
 *
 * 1. 구절이 휴식 자세로 돌아오지 않는다. 각 구절의 회복이 다음 구절의 준비가 된다.
 *      방향 바꾸기의 회복(왼발로 무게가 건너감) → 무게 옮기기의 버팀(왼발)
 *      무게 옮기기의 회복(가라앉으며 팔이 앞으로 모임) → 펼치기의 응축
 *      펼치기의 회복(팔이 내려오며 반대로 감김, 오른발로 실림) → 방향 바꾸기의 준비
 *    구절 경계에는 고정된 자세가 없고, 키를 적지 않은 채널은 앞뒤 구절 사이를 흐른다.
 * 2. 준비와 회복에서 변화가 거의 없던 구간을 줄였다(34초 → 25.7초, 배속 1 기준).
 * 3. 펼치기와 회전의 주요 동작은 느린 출발 → 짧은 폭발 → 긴 감속으로 키를 배치해
 *    가속과 감속의 차이를 키웠다. 응축 직후의 짧은 머묾과 유예는 남겼다.
 * 4. 순서의 시작(무게 옮기기)은 이미 왼발에 실린 상태에서 들어와, 2.5초 안에 무게가
 *    건너가고 어깨선이 뒤집히며 자유로운 팔이 열린다.
 *
 * 작성 규칙
 * - 발 위치(fX, fZ)는 바꾸지 않는다. 발은 들림(Lift)과 접어 올림(Carry)만 쓴다.
 *   발을 들기 전에 골반(무게 중심)을 지지 발 위로 옮긴다. tests/motion.test.ts가 검사한다.
 * - 회전 채널(pYaw, cYaw)은 구절 안에서 '정면 = 0' 기준으로 적는다. 구절의 마지막 키를
 *   2π로 나눈 반올림 값만큼 다음 구절의 회전이 누적된다.
 * - 구절을 하나만 반복 재생하면 그 구절의 끝이 자기 시작으로 이어진다.
 */
import { TAU } from '../core/math';
import type { Choreography, Phrase } from './phrases';

/**
 * 무게 옮기기 (7.2초)
 * 왼발에 실린 채 들어와 → 짧게 가라앉아 밀어냄 → 골반이 오른발 위로 빠르게 건너가고 자유로운
 * 왼팔이 원심력으로 열림 → 몸통이 늦게 반대로 기울어 균형 → 오른발 위에서 유예 →
 * 뒤꿈치를 내리며 가라앉고 팔이 앞으로 모이기 시작(펼치기의 응축으로).
 */
const SHIFT: Phrase = {
  id: 'shift',
  title: '무게 옮기기',
  duration: 7.2,
  sections: [
    { name: '준비', start: 0 },
    { name: '진행', start: 0.7 },
    { name: '유예', start: 3.3 },
    { name: '회복', start: 4.4 },
  ],
  intent: '한쪽 버팀 → 골반 이동 → 몸통 기울기 → 반대쪽 회복. 몸이 공간 안에서 지탱되고 있음.',
  keys: [
    // 준비: 앞 구절에서 넘어온 왼발 버팀. 짧게 가라앉아 밀어낸다.
    { t: 0.2, pose: { px: 0.052, pRoll: 0.06, cLean: -0.1, hTilt: 0.04 } },
    { t: 0.45, pose: { py: -0.048 } },
    { t: 0.7, pose: { px: 0.045, pRoll: 0.055, pYaw: 0.02, cBend: 0.03, hNod: 0.05 } },
    // 진행: 골반이 먼저, 빠르게 건너간다. 가슴이 지지 발 쪽으로 돌고 자유로운 왼팔이 열린다.
    { t: 1.45, pose: { px: -0.04, py: -0.036, pRoll: -0.03, cLean: -0.02 } },
    { t: 2.0, pose: { px: -0.076, py: -0.022, pRoll: -0.09, cYaw: 0.2 } },
    { t: 2.2, pose: { aLEl: 0.85, aLAz: 0.1, aLEb: 0.45, aLWb: 0.05, aREl: 0.14, aRAz: 0.7, aREb: 0.4, aRWb: 0.12 } },
    // 몸통 기울기는 골반보다 늦다.
    { t: 2.3, pose: { cLean: 0.12, hTilt: -0.04 } },
    { t: 2.4, pose: { fLLift: 0 } },
    { t: 2.6, pose: { pYaw: -0.1 } },
    { t: 2.8, pose: { px: -0.086, py: -0.018, pRoll: -0.12, fLLift: 0.03 } },
    { t: 3.1, pose: { cLean: 0.2, hTilt: -0.09 } },
    // 열린 팔이 늦게 내려앉는다.
    { t: 3.3, pose: { aLEl: 0.5, cYaw: 0.14 } },
    // 유예: 오른발 위에서 머문다.
    { t: 4.2, pose: { px: -0.088, pRoll: -0.127, cLean: 0.205, fLLift: 0.035, cYaw: 0.12, aLEl: 0.45 } },
    // 회복: 뒤꿈치를 내리고, 가라앉으며 팔이 앞으로 모이기 시작한다(펼치기의 응축으로).
    { t: 4.6, pose: { fLLift: 0.03 } },
    { t: 4.7, pose: { hTilt: -0.07 } },
    { t: 5.0, pose: { fLLift: 0 } },
    { t: 5.4, pose: { px: -0.065, pRoll: -0.07, cLean: 0.1, pYaw: -0.04 } },
    { t: 5.6, pose: { hTilt: 0, aLEl: 0.3 } },
    { t: 6.0, pose: { aLAz: 0.85, aLEb: 0.75, aRAz: 0.85, aREl: 0.25, aREb: 0.65 } },
    { t: 6.8, pose: { px: -0.04, py: -0.045, pRoll: -0.03, cLean: 0.04, cBend: 0.14, hNod: 0.16, pYaw: 0, cYaw: 0 } },
  ],
};

/**
 * 펼치기 (9초)
 * 가라앉으며 몸통을 말고 팔을 감싸 응축 → 짧게 머묾 → 가슴이 먼저 튀어 열리고 위팔 →
 * 아래팔 → 손끝 순으로 폭발적으로 펼쳐진 뒤 길게 감속 → 공중에서 유예 →
 * 팔이 내려오며 몸이 반대로 감기고 오른발로 실림(방향 바꾸기의 준비로).
 */
const OPEN: Phrase = {
  id: 'open',
  title: '펼치기',
  duration: 9,
  sections: [
    { name: '준비', start: 0 },
    { name: '진행', start: 2.1 },
    { name: '유예', start: 4.4 },
    { name: '회복', start: 5.6 },
  ],
  intent: '응축 → 몸통의 선행 → 팔 방향의 확장 → 말단의 지연. 동작이 중심에서 바깥으로 전달됨.',
  keys: [
    // 준비(응축): 앞 구절의 가라앉음을 이어 더 작아진다.
    { t: 0.6, pose: { py: -0.055, cBend: 0.2, aLEl: 0.4, aREl: 0.35 } },
    { t: 0.8, pose: { hNod: 0.24 } },
    { t: 1.6, pose: {
      px: -0.01, py: -0.07, pz: -0.01, pRoll: 0, pPitch: 0.05, pYaw: -0.04,
      cYaw: -0.12, cLean: 0, cBend: 0.3, hNod: 0.34, hTilt: 0,
      aLEl: 0.55, aLAz: 1.35, aLEb: 1.45, aLWb: 0.3,
      aREl: 0.5, aRAz: 1.4, aREb: 1.55, aRWb: 0.3,
    } },
    // 응축의 끝에서 짧게 머문다(눌린 용수철).
    { t: 2.0, pose: { py: -0.072, cBend: 0.31 } },
    // 진행: 가슴이 먼저 출발한다.
    { t: 2.35, pose: { cBend: 0.22, py: -0.06 } },
    { t: 2.45, pose: { aLEl: 0.68, aREl: 0.62 } },
    { t: 2.5, pose: { aLAz: 1.3, aLEb: 1.35, aRAz: 1.35, aREb: 1.45 } },
    { t: 2.8, pose: { cBend: -0.06, py: -0.012, hNod: -0.06, pPitch: -0.01 } },
    // 팔의 폭발: 0.5초 동안 크게 열린다.
    { t: 2.95, pose: { aLEl: 1.75, aREl: 1.35 } },
    { t: 3.0, pose: { aLAz: 0.55, aLEb: 0.45, aRAz: 0.5, aREb: 0.5, cYaw: 0.17, pz: 0.008, pYaw: 0.02 } },
    { t: 3.1, pose: { aLWb: 0.12, aRWb: 0.15 } },
    { t: 3.3, pose: { px: -0.045, pRoll: -0.03, cLean: 0.06 } },
    { t: 3.4, pose: { cBend: -0.12, py: -0.013, hNod: -0.14 } },
    // 길게 감속하며 손끝이 마지막에 도착한다.
    { t: 3.5, pose: { aLEl: 2.1, aLAz: 0.32, aLEb: 0.2, aREl: 1.52, aRAz: 0.17, aREb: 0.24 } },
    { t: 3.8, pose: { aLWb: -0.2, aRWb: -0.12, cYaw: 0.2 } },
    { t: 4.4, pose: { aLEl: 2.18, aREl: 1.58 } },
    // 유예: 아주 조금 더 뻗으며 머문다.
    { t: 5.4, pose: { aLEl: 2.22, aREl: 1.6, cBend: -0.125, py: -0.012 } },
    // 회복: 팔이 내려오며 몸이 반대로 감기고 오른발로 실린다.
    { t: 6.2, pose: { cBend: -0.05, hNod: -0.04 } },
    { t: 6.4, pose: { aLEl: 1.95, aREl: 1.45 } },
    { t: 6.6, pose: { px: -0.07, pRoll: -0.045, cLean: 0.06 } },
    { t: 7.0, pose: { cYaw: 0, pYaw: -0.02, aLWb: 0, aRWb: 0.2 } },
    { t: 7.4, pose: { aLEl: 1.3, aLAz: 0.2, aLEb: 0.35, aREl: 1.15, aRAz: 0.9, aREb: 0.8 } },
    { t: 7.8, pose: { px: -0.083, py: -0.035, pz: 0, cBend: 0.04, hNod: 0.06 } },
    { t: 8.4, pose: {
      cYaw: -0.3, pYaw: -0.1,
      aLEl: 1.15, aLAz: 0.15, aLWb: 0.1,
      aREl: 1.1, aRAz: 1.25, aREb: 1.0, aRWb: 0.3,
    } },
    { t: 8.6, pose: { pRoll: -0.04, cLean: 0.05 } },
  ],
};

/**
 * 방향 바꾸기 (9.5초)
 * 오른발에 실려 감긴 채 들어와 → 더 감으며 무릎을 굽히고 왼발을 바깥으로 열어 접어 올림 →
 * 어깨가 먼저 튀어 나가고 골반이 늦게 따라 한 바퀴 → 어깨가 살짝 지나쳤다가 길게 감속,
 * 팔이 늦게 열리고 왼발을 내려 디딤 → 유예 → 무게가 왼발로 건너감(무게 옮기기의 버팀으로).
 */
const TURN: Phrase = {
  id: 'turn',
  title: '방향 바꾸기',
  duration: 9.5,
  sections: [
    { name: '준비', start: 0 },
    { name: '진행', start: 1.3 },
    { name: '유예', start: 5.2 },
    { name: '회복', start: 6.2 },
  ],
  intent: '준비 → 어깨와 골반의 시차 → 회전 → 감속. 전체가 한 덩어리로 회전하지 않음.',
  keys: [
    // 준비: 더 감고 가라앉으며 왼발을 들어 접는다.
    { t: 0.3, pose: { px: -0.086 } },
    { t: 0.5, pose: { fLLift: 0, fLCarry: 0 } },
    { t: 0.8, pose: { py: -0.05, cYaw: -0.48, fLLift: 0.03 } },
    { t: 1.0, pose: { pYaw: -0.2, pRoll: -0.03 } },
    { t: 1.1, pose: { fLCarry: 1 } },
    { t: 1.3, pose: { cYaw: -0.47 } },
    // 진행: 어깨가 먼저, 느리게 출발했다가 폭발적으로 돈다.
    { t: 1.55, pose: { cYaw: -0.3, py: -0.045, hYaw: 0.15 } },
    { t: 1.75, pose: { pYaw: -0.1 } },
    { t: 2.0, pose: {
      aLEl: 0.95, aLAz: 1.0, aLEb: 0.95, aLWb: 0.05,
      aREl: 0.95, aRAz: 1.2, aREb: 1.0, aRWb: 0.05,
    } },
    { t: 2.1, pose: { cYaw: 1.6, py: -0.02 } },
    { t: 2.35, pose: { pYaw: 1.0 } },
    { t: 2.8, pose: { cYaw: 4.2 } },
    { t: 3.1, pose: { pYaw: 3.6 } },
    { t: 3.6, pose: { cYaw: 5.9, hYaw: 0.1 } },
    { t: 3.9, pose: { pYaw: 5.6, py: -0.018, fLCarry: 1 } },
    // 감속: 어깨가 살짝 지나쳤다가 돌아오고, 팔이 늦게 열리며 왼발을 내려 딛는다.
    { t: 4.3, pose: { cYaw: TAU + 0.12 } },
    { t: 4.6, pose: {
      pYaw: TAU - 0.03, py: -0.04, fLCarry: 0, fLLift: 0.02,
      aLEl: 1.2, aLAz: 0.25, aLEb: 0.3, aLWb: -0.05,
      aREl: 0.95, aRAz: 0.75, aREb: 0.5, aRWb: 0.1,
    } },
    { t: 5.0, pose: { cYaw: TAU + 0.04, hYaw: 0, fLLift: 0 } },
    { t: 5.2, pose: { pYaw: TAU } },
    // 유예
    { t: 5.8, pose: { aLEl: 1.25, py: -0.036 } },
    { t: 6.0, pose: { cYaw: TAU } },
    // 회복: 무게가 왼발로 건너가며 팔이 내려온다.
    { t: 6.2, pose: { px: -0.085, pRoll: -0.03, cLean: 0.05 } },
    { t: 7.0, pose: { aLEl: 0.9, aREl: 0.7 } },
    { t: 7.6, pose: { px: -0.01, py: -0.03, pRoll: 0, cLean: 0 } },
    { t: 8.4, pose: { aLEl: 0.28, aLAz: 0.35, aLEb: 0.4, aLWb: 0.12, aREl: 0.25, aRAz: 0.35, aREb: 0.45, aRWb: 0.15 } },
    { t: 9.0, pose: { px: 0.04, py: -0.033, pRoll: 0.05, cLean: -0.08, hTilt: 0.03, cBend: 0.03 } },
    // 왼발로 실리며 가슴이 살짝 감긴다. 무게 옮기기에서 반대로 풀린다.
    { t: 9.2, pose: { cYaw: TAU - 0.12, pYaw: TAU - 0.04 } },
  ],
};

export const A2: Choreography = {
  id: 'a2',
  label: 'A-2 현재',
  anchorRest: false,
  phrases: { shift: SHIFT, open: OPEN, turn: TURN },
  order: ['shift', 'open', 'turn'],
};
