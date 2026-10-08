import { A1 } from './phrases-a1';
import { A2 } from './phrases-a2';
import type { Choreography, ChoreographyId } from './phrases';

export const CHOREOGRAPHIES: Record<ChoreographyId, Choreography> = { a1: A1, a2: A2 };

/** 감상 화면과 개발 화면의 기본 안무 */
export const CURRENT: ChoreographyId = 'a2';
/** 비교 화면에서 나란히 보여 줄 이전 안무 */
export const PREVIOUS: ChoreographyId = 'a1';
