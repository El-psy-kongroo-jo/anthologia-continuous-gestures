/**
 * 안무 A-1 — 단계 A 첫 구현(커밋 4315d28)의 임시 안무. 비교용으로 그대로 보존한다.
 *
 * 기존 Anthologia 동작 자료 없이 PROJECT_BRIEF.md 4장의 구절 설명만으로 만든 임시안이다.
 * 각 구절이 휴식 자세(REST)에서 시작해 휴식 자세로 돌아오는 구조라서(anchorRest),
 * 구절이 개별 동작 시범처럼 끊겨 보인다는 검토를 받았다. 현재 안무는 phrases-a2.ts.
 * 이 파일의 키는 고치지 않는다.
 */
import { TAU } from '../core/math';
import type { Choreography, Phrase } from './phrases';

/**
 * 무게 옮기기
 * 왼발 버팀(밀어내기 위한 작은 준비) → 골반이 오른발 위로 이동 → 몸통이 늦게 반대로 기울며
 * 균형을 잡음 → 오른발 위에서 유예(왼쪽 뒤꿈치가 풀림) → 뒤꿈치를 내리고 가운데로 회복.
 */
const SHIFT: Phrase = {
  id: 'shift',
  title: '무게 옮기기',
  duration: 10,
  sections: [
    { name: '준비', start: 0 },
    { name: '진행', start: 1.7 },
    { name: '유예', start: 5.3 },
    { name: '회복', start: 6.9 },
  ],
  intent: '한쪽 버팀 → 골반 이동 → 몸통 기울기 → 반대쪽 회복. 몸이 공간 안에서 지탱되고 있음.',
  keys: [
    // 준비: 왼발 쪽으로 실리며 무릎을 굽혀 밀어낼 힘을 모은다.
    { t: 0.9, pose: { px: 0.03, py: -0.035, pRoll: 0.03, cLean: -0.02 } },
    { t: 1.7, pose: { px: 0.028, py: -0.042, pRoll: 0.035, cLean: -0.03, pYaw: 0, cYaw: 0, hTilt: 0.01, aLEl: 0.11, aREl: 0.14 } },
    // 진행: 골반이 먼저 오른발 위로 건너가고, 지지 다리를 펴며 솟는다.
    { t: 2.8, pose: { px: -0.045, py: -0.034, pRoll: -0.03, pz: 0.004, cLean: 0.03, hTilt: 0.01 } },
    { t: 3.6, pose: { aLEl: 0.28, aRAz: 0.45 } },
    { t: 3.8, pose: { px: -0.075, py: -0.024, pRoll: -0.08 } },
    { t: 3.9, pose: { fLLift: 0 } },
    { t: 4.0, pose: { cLean: 0.13 } },
    { t: 4.6, pose: { px: -0.084, py: -0.019, pRoll: -0.11, pYaw: -0.08, cYaw: 0.04, hTilt: -0.06, aLEb: 0.45, aREl: 0.1 } },
    { t: 4.8, pose: { fLLift: 0.03 } },
    // 감속하며 오른발 위에 자리 잡는다. 골반은 지지 발 바깥으로 기울고, 몸통은 늦게 반대로 기울어 균형을 잡는다.
    { t: 5.3, pose: { px: -0.087, py: -0.018, pRoll: -0.125, cLean: 0.2, hTilt: -0.09, fLLift: 0.035, aLEl: 0.36, aRAz: 0.5 } },
    // 유예: 거의 멈추되 완전히 굳지 않는다.
    { t: 6.4, pose: { px: -0.088, pRoll: -0.128, cLean: 0.205, fLLift: 0.035 } },
    // 회복: 뒤꿈치가 먼저 내려오고, 골반이 돌아오며, 몸통은 그 뒤에 선다.
    { t: 6.9, pose: { px: -0.088, pRoll: -0.125, pYaw: -0.08, fLLift: 0.033 } },
    { t: 7.2, pose: { cLean: 0.19 } },
    { t: 7.4, pose: { hTilt: -0.08 } },
    { t: 7.6, pose: { fLLift: 0, py: -0.026 } },
    { t: 8.2, pose: { px: -0.045 } },
    { t: 8.4, pose: { pRoll: -0.03 } },
    { t: 8.6, pose: { pYaw: 0, cYaw: 0 } },
    { t: 8.8, pose: { cLean: 0.03 } },
    { t: 9.3, pose: { px: -0.006, py: -0.013 } },
    { t: 9.4, pose: { pRoll: 0 } },
    { t: 9.5, pose: { aLEl: 0.13, aLEb: 0.3, aREl: 0.13, aRAz: 0.35 } },
    { t: 9.6, pose: { cLean: 0, hTilt: 0 } },
  ],
};

/**
 * 펼치기
 * 웅크리며 응축 → 가슴이 먼저 열리고 솟음 → 팔이 뒤따라 대각선으로 펼쳐짐 → 손끝이 가장 늦게
 * 도착 → 공중에 머무는 유예 → 몸통이 먼저 돌아오고 팔과 손끝이 늦게 내려앉음.
 */
const OPEN: Phrase = {
  id: 'open',
  title: '펼치기',
  duration: 11,
  sections: [
    { name: '준비', start: 0 },
    { name: '진행', start: 2.8 },
    { name: '유예', start: 6.2 },
    { name: '회복', start: 7.8 },
  ],
  intent: '응축 → 몸통의 선행 → 팔 방향의 확장 → 말단의 지연. 동작이 중심에서 바깥으로 전달됨.',
  keys: [
    // 준비(응축): 무릎을 굽히고 몸통을 말며 팔을 앞으로 모은다. 끝으로 갈수록 느려진다.
    { t: 1.2, pose: { py: -0.05 } },
    { t: 1.4, pose: { cBend: 0.2, aLEl: 0.35, aREl: 0.33 } },
    { t: 1.6, pose: { hNod: 0.24 } },
    { t: 2.8, pose: {
      py: -0.07, pz: -0.01, pPitch: 0.05, cBend: 0.3, hNod: 0.34, cYaw: -0.12, pYaw: -0.04,
      aLEl: 0.55, aLAz: 1.35, aLEb: 1.45, aLWb: 0.3,
      aREl: 0.5, aRAz: 1.4, aREb: 1.55, aRWb: 0.3,
    } },
    // 진행: 가슴이 먼저 열리고 솟는다.
    { t: 3.2, pose: { cBend: 0.24 } },
    { t: 3.4, pose: { py: -0.06, hNod: 0.28, aLEl: 0.6, aREl: 0.55 } },
    { t: 3.6, pose: { aLAz: 1.3, aLEb: 1.35, aRAz: 1.35, aREb: 1.5 } },
    { t: 3.8, pose: { aLWb: 0.28, aRWb: 0.3 } },
    { t: 4.0, pose: { cBend: -0.04 } },
    { t: 4.2, pose: { pPitch: -0.01 } },
    { t: 4.4, pose: { cYaw: 0.16, pz: 0.008, pYaw: 0.02 } },
    { t: 4.6, pose: { py: -0.008, hNod: -0.1, px: -0.03, aLEl: 1.6, aREl: 1.3 } },
    { t: 4.8, pose: { cBend: -0.11, aLAz: 0.55, aLEb: 0.5, aRAz: 0.5, aREb: 0.55 } },
    // 팔은 가슴보다 늦게, 손끝은 팔보다 늦게 도착한다.
    { t: 5.0, pose: { aLWb: 0.1, aRWb: 0.15 } },
    { t: 5.4, pose: { cYaw: 0.2 } },
    { t: 5.6, pose: {
      py: -0.004, px: -0.045, pRoll: -0.03, cLean: 0.06, hNod: -0.14,
      aLEl: 2.15, aLAz: 0.3, aLEb: 0.16,
      aREl: 1.55, aRAz: 0.15, aREb: 0.22,
    } },
    { t: 5.8, pose: { aLWb: -0.2, aRWb: -0.12 } },
    // 유예: 아주 조금 더 뻗으며 머문다.
    { t: 7.0, pose: { cBend: -0.12 } },
    { t: 7.2, pose: { py: -0.004, aLEl: 2.22, aREl: 1.6 } },
    // 회복: 몸통이 먼저 돌아오고 팔, 손끝 순서로 내려앉는다.
    { t: 8.4, pose: { aLEl: 2.05, aREl: 1.5 } },
    { t: 8.6, pose: { cBend: -0.04, px: -0.04, aLEb: 0.25, aREb: 0.3 } },
    { t: 8.8, pose: { hNod: -0.06, py: -0.01, aLWb: -0.1, aRWb: -0.05 } },
    { t: 9.4, pose: { cYaw: 0, pYaw: 0, pRoll: 0, aLAz: 0.5, aRAz: 0.45 } },
    { t: 9.6, pose: { cBend: 0.03, cLean: 0, aLEl: 0.6, aREl: 0.45 } },
    { t: 9.8, pose: { py: -0.025, aLEb: 0.45, aREb: 0.42 } },
    { t: 10.0, pose: { hNod: 0.04, px: -0.005, aLWb: 0.3, aRWb: 0.25 } },
    { t: 10.5, pose: { aLEl: 0.15, aREl: 0.14 } },
    { t: 10.6, pose: { py: -0.014 } },
  ],
};

/**
 * 방향 바꾸기
 * 오른발로 무게를 옮기며 무릎을 굽히고 반대 방향으로 감아 준비 → 왼발을 접어 올림 →
 * 어깨가 먼저 돌기 시작하고 골반이 늦게 따라감 → 한 바퀴 회전 → 어깨가 살짝 지나쳤다가
 * 골반과 함께 감속 → 왼발을 내려 딛고 머묾 → 가운데로 회복.
 */
const TURN: Phrase = {
  id: 'turn',
  title: '방향 바꾸기',
  duration: 13,
  sections: [
    { name: '준비', start: 0 },
    { name: '진행', start: 3.2 },
    { name: '유예', start: 8.0 },
    { name: '회복', start: 9.4 },
  ],
  intent: '준비 → 어깨와 골반의 시차 → 회전 → 감속. 전체가 한 덩어리로 회전하지 않음.',
  keys: [
    // 준비: 오른발로 무게를 옮기고 반대 방향으로 감는다.
    { t: 0.8, pose: { px: 0.01 } },
    { t: 1.0, pose: { py: -0.025, cYaw: 0 } },
    { t: 1.4, pose: { pYaw: 0 } },
    { t: 2.0, pose: { px: -0.08, py: -0.04, pRoll: -0.04, cLean: 0.05, fLLift: 0 } },
    { t: 2.2, pose: { cYaw: -0.35 } },
    { t: 2.4, pose: { fLCarry: 0 } },
    { t: 2.6, pose: {
      px: -0.085, pYaw: -0.16, fLLift: 0.03,
      aREl: 1.1, aRAz: 1.25, aREb: 1.0, aRWb: 0.3,
      aLEl: 1.15, aLAz: 0.15, aLEb: 0.35, aLWb: 0.1,
    } },
    { t: 2.8, pose: { pRoll: -0.03 } },
    { t: 3.0, pose: { py: -0.05, cYaw: -0.48 } },
    { t: 3.1, pose: { fLCarry: 1 } },
    { t: 3.2, pose: { pYaw: -0.2 } },
    // 진행: 어깨(가슴)가 먼저 출발하고 골반이 늦게 따라온다.
    { t: 3.6, pose: { py: -0.035, hYaw: 0.15 } },
    { t: 3.7, pose: { cYaw: -0.2 } },
    { t: 3.9, pose: { pYaw: -0.1 } },
    { t: 4.2, pose: {
      aLEl: 0.95, aLAz: 1.0, aLEb: 0.95, aLWb: 0.05,
      aREl: 0.95, aRAz: 1.2, aREb: 1.0, aRWb: 0.05,
    } },
    { t: 4.4, pose: { py: -0.015 } },
    { t: 4.6, pose: { cYaw: 1.5 } },
    { t: 4.8, pose: { pYaw: 1.1 } },
    { t: 5.6, pose: { cYaw: 3.8 } },
    { t: 5.8, pose: { pYaw: 3.4 } },
    { t: 6.6, pose: { cYaw: 5.8 } },
    { t: 6.8, pose: { pYaw: 5.6, hYaw: 0.1 } },
    { t: 7.0, pose: { py: -0.015, fLCarry: 1 } },
    // 감속: 어깨가 살짝 지나쳤다가 돌아오고, 팔이 원심력에 늦게 열린다.
    { t: 7.3, pose: { cYaw: TAU + 0.1 } },
    { t: 7.6, pose: {
      pYaw: TAU - 0.03,
      aLEl: 1.2, aLAz: 0.25, aLEb: 0.3, aLWb: -0.05,
      aREl: 0.95, aRAz: 0.75, aREb: 0.5, aRWb: 0.1,
    } },
    { t: 7.8, pose: { py: -0.035, fLCarry: 0, fLLift: 0.02 } },
    { t: 8.0, pose: { cYaw: TAU + 0.03, hYaw: 0 } },
    { t: 8.3, pose: { fLLift: 0 } },
    // 유예: 내려 딛은 채 머문다.
    { t: 8.6, pose: { py: -0.03, pYaw: TAU } },
    { t: 9.0, pose: { cYaw: TAU, aLEl: 1.25 } },
    // 회복
    { t: 9.4, pose: { px: -0.084, pRoll: -0.03, cLean: 0.05 } },
    { t: 10.0, pose: { aLEl: 1.0, aREl: 0.8 } },
    { t: 10.8, pose: { px: -0.03, py: -0.02, pRoll: -0.01, cLean: 0.02, aLEb: 0.4, aREb: 0.45 } },
    { t: 11.6, pose: { aLEl: 0.3, aLAz: 0.35, aREl: 0.25, aRAz: 0.4, aRWb: 0.15 } },
    { t: 12.0, pose: { px: -0.004, py: -0.012, pRoll: 0, cLean: 0 } },
    { t: 12.4, pose: { aLEl: 0.13, aLEb: 0.3, aREl: 0.13, aRAz: 0.35, aREb: 0.3, aRWb: 0.12, aLWb: 0.12 } },
  ],
};

export const A1: Choreography = {
  id: 'a1',
  label: 'A-1 이전',
  anchorRest: true,
  phrases: { shift: SHIFT, open: OPEN, turn: TURN },
  order: ['shift', 'open', 'turn'],
};
