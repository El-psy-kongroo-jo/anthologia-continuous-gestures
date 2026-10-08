/**
 * 안무 구절의 형식과 공통 자세.
 *
 * 안무 데이터는 모두 임시 안무(provisional)다. 기존 Anthologia 동작 자료가 아직 제공되지
 * 않았으므로 PROJECT_BRIEF.md 4장의 구절 설명만을 근거로 만들었고, 기존 작품을 분석한
 * 결과가 아니다. 자료가 제공되면 데이터 파일의 키를 그 자료에 맞춰 다시 쓴다.
 *
 * - phrases-a2.ts: 현재 안무
 * - phrases-a1.ts: 단계 A 첫 구현(비교용, 고치지 않음)
 */
import type { Pose } from '../core/types';

export type PhraseId = 'shift' | 'open' | 'turn';
export type SectionName = '준비' | '진행' | '유예' | '회복';
export type ChoreographyId = 'a1' | 'a2';

export interface PhraseKey {
  t: number;
  pose: Partial<Pose>;
}

export interface Phrase {
  id: PhraseId;
  title: string;
  /** 구절의 길이(초). 첫 가설은 6~14초. */
  duration: number;
  /** 각 부분의 시작 시각. 개발 화면과 검토에 사용한다. */
  sections: { name: SectionName; start: number }[];
  /** 이 구절에서 확인할 감각과 흐름 */
  intent: string;
  keys: PhraseKey[];
}

export interface Choreography {
  id: ChoreographyId;
  label: string;
  /**
   * true: 모든 구절이 t = 0에서 REST 자세로 시작한다(A-1 방식).
   * false: 구절 경계에 고정된 자세가 없다. 앞 구절의 마지막 키에서 다음 구절의 첫 키로
   * 곧바로 이어지므로, 키를 적지 않은 채널은 앞뒤 구절 사이를 흐른다.
   */
  anchorRest: boolean;
  phrases: Record<PhraseId, Phrase>;
  /** 전체 순서 */
  order: PhraseId[];
}

/** 무게가 대체로 가운데 있고 무릎이 살짝 풀린 휴식 자세 */
export const REST: Pose = {
  px: 0, py: -0.012, pz: 0,
  pYaw: 0, pRoll: 0, pPitch: 0,
  cYaw: 0, cLean: 0, cBend: 0.02,
  hTilt: 0, hNod: 0.04, hYaw: 0,
  aLEl: 0.13, aLAz: 0.35, aLEb: 0.3, aLWb: 0.12,
  aREl: 0.13, aRAz: 0.35, aREb: 0.3, aRWb: 0.12,
  fLX: 0.085, fLZ: 0, fLLift: 0, fLCarry: 0,
  fRX: -0.085, fRZ: 0, fRLift: 0, fRCarry: 0,
};
