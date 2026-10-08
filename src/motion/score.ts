import { CONFIG } from '../config';
import { mod, TAU } from '../core/math';
import { ANGULAR_CHANNELS, CHANNELS, type Channel, type Pose } from '../core/types';
import { REST, type Choreography, type Phrase, type PhraseId, type SectionName } from './phrases';
import { Track, type Key } from './track';

export interface Location {
  /** 순서 안에서의 시간 [0, duration) */
  cycleTime: number;
  phrase: Phrase;
  /** 구절 안에서의 시간 */
  local: number;
  section: SectionName;
}

/**
 * 구절들을 정해진 순서로 이어 붙인 순환 안무.
 * 작품 시간 t → 자세는 순수 함수이므로, 같은 t는 언제나 같은 자세를 만든다.
 *
 * 모든 구절의 키를 채널별로 한 곡선에 모은다. 구절 경계에도 같은 곡선이 이어지므로
 * 위치와 속도가 연속이다. choreography.anchorRest이면 각 구절의 t = 0에 REST 키를 둔다.
 */
export class Score {
  readonly duration: number;
  readonly phrases: readonly Phrase[];
  readonly starts: readonly number[];
  private readonly tracks: Record<Channel, Track>;
  private readonly breathPeriod: number;

  constructor(
    readonly choreography: Choreography,
    order: readonly PhraseId[] = choreography.order,
  ) {
    if (order.length === 0) throw new Error('Score: 구절이 없습니다.');
    this.phrases = order.map((id) => choreography.phrases[id]);
    const starts: number[] = [];
    let acc = 0;
    for (const p of this.phrases) {
      starts.push(acc);
      acc += p.duration;
    }
    this.starts = starts;
    this.duration = acc;

    const keys = {} as Record<Channel, Key[]>;
    for (const ch of CHANNELS) keys[ch] = [];
    const angleOffset = {} as Record<Channel, number>;
    for (const ch of CHANNELS) angleOffset[ch] = 0;

    this.phrases.forEach((phrase, i) => {
      const start = starts[i]!;
      for (const ch of CHANNELS) {
        const local: Key[] = phrase.keys
          .filter((k) => k.pose[ch] !== undefined)
          .map((k) => ({ t: k.t, v: k.pose[ch]! }));
        const minT = choreography.anchorRest ? 0 : -1e-9;
        if (local.some((k) => k.t <= minT || k.t >= phrase.duration)) {
          throw new Error(`Score: ${phrase.id}.${ch}의 키가 구절 범위를 벗어났습니다.`);
        }
        if (choreography.anchorRest) local.unshift({ t: 0, v: REST[ch] });
        const offset = angleOffset[ch];
        for (const k of local) keys[ch].push({ t: start + k.t, v: k.v + offset });
        if (ANGULAR_CHANNELS.has(ch) && local.length > 0) {
          // 회전은 구절마다 '정면 = 0' 기준으로 적는다. 마지막 키가 가리키는 바퀴 수만큼 누적한다.
          const last = local.reduce((a, b) => (b.t > a.t ? b : a)).v;
          const turns = Math.round(last / TAU);
          if (Math.abs(last - turns * TAU) > Math.PI / 2) {
            throw new Error(`Score: ${phrase.id}.${ch}의 마지막 방향(${last.toFixed(2)})이 정면에서 너무 멉니다.`);
          }
          angleOffset[ch] += turns * TAU;
        }
      }
    });

    // 어느 구절에도 키가 없는 채널은 REST로 고정한다.
    for (const ch of CHANNELS) if (keys[ch].length === 0) keys[ch].push({ t: 0, v: REST[ch] });

    const tracks = {} as Record<Channel, Track>;
    for (const ch of CHANNELS) tracks[ch] = new Track(keys[ch], this.duration, angleOffset[ch]);
    this.tracks = tracks;

    // 호흡 주기를 순서 길이의 약수로 맞춰, 자세가 순서 안의 시간만으로 결정되게 한다.
    const n = Math.max(1, Math.round(this.duration / CONFIG.breath.period));
    this.breathPeriod = this.duration / n;
  }

  /** 작품 시간 t의 자세(호흡 포함) */
  sample(t: number): Pose {
    const pose = {} as Pose;
    for (const ch of CHANNELS) pose[ch] = this.tracks[ch].value(t);
    const b = Math.sin((TAU * t) / this.breathPeriod);
    pose.cBend += CONFIG.breath.chestBend * b;
    pose.py -= CONFIG.breath.pelvisDrop * (0.5 + 0.5 * b);
    return pose;
  }

  locate(t: number): Location {
    const cycleTime = mod(t, this.duration);
    let i = this.phrases.length - 1;
    while (i > 0 && this.starts[i]! > cycleTime) i--;
    const phrase = this.phrases[i]!;
    const local = cycleTime - this.starts[i]!;
    let section = phrase.sections[0]!.name;
    for (const s of phrase.sections) if (local >= s.start) section = s.name;
    return { cycleTime, phrase, local, section };
  }
}
