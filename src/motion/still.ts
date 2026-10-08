import type { Pose } from '../core/types';
import { solveBody, type Body } from './body';
import { REST, type Choreography } from './phrases';
import { Score } from './score';

/**
 * 고정된 한 자세의 몸. 안무 순서 대신 같은 자세만 담은 한 구절을 만들어 기존 몸 계산(발 고정,
 * 다리 길이, 팔의 역기구학)을 그대로 거친다. 정지 화면 검토용이며 안무가 아니다.
 */
export function stillBody(pose: Partial<Pose>): Body {
  const full = { ...REST, ...pose };
  const choreography: Choreography = {
    id: 'a2',
    label: '고정 자세',
    anchorRest: false,
    order: ['shift'],
    phrases: {
      shift: {
        id: 'shift',
        title: '고정 자세',
        duration: 2,
        sections: [{ name: '유예', start: 0 }],
        intent: '정지 화면 검토',
        keys: [
          { t: 0, pose: full },
          { t: 1, pose: full },
        ],
      },
    } as Choreography['phrases'],
  };
  return solveBody(new Score(choreography), 0);
}
