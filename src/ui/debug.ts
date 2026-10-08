import { CONFIG } from '../config';
import type { Clock } from '../core/clock';
import type { Body } from '../motion/body';
import { CHOREOGRAPHIES, CURRENT } from '../motion/choreography';
import type { ChoreographyId, PhraseId } from '../motion/phrases';
import type { Score } from '../motion/score';
import type { FlowPresetId, ModeId } from '../render/modes';

/** 'scene' = 검토 구간(CONFIG.review)을 전체 순서 안에서 반복 */
export type Selection = 'all' | 'scene' | PhraseId;

export type CompareId = 'none' | 'versions' | 'presets' | 'modes';

export interface DevState {
  selection: Selection;
  version: ChoreographyId;
  /** 감상 모드(표현). 바꿔도 안무 시간은 그대로다. */
  mode: ModeId;
  preset: FlowPresetId;
  /** 나란히 보기: 안무 A-1·A-2 / Flow 설정 1·2·3 / Structure·Flow */
  compare: CompareId;
  showReference: boolean;
  /** Flow 실험 E1에서 몸의 영향을 켤지(끄면 흐름만) */
  e1Body: boolean;
}

export interface ShownScore {
  score: Score;
  body: Body;
}

interface DevHooks {
  clock: Clock;
  state: DevState;
  /** 시간 슬라이더의 기준이 되는 안무 */
  getPrimary: () => Score;
  /** 화면에 쓰는 작품 시간(검토 구간이면 구간 안으로 접힌 시간) */
  viewTime: () => number;
  /** 검토 구간 [시작, 끝](초), 없으면 null */
  range: () => readonly [number, number] | null;
  /** 상태를 바꾼다. 구절이나 안무가 바뀌면 그 구절의 처음으로 돌아간다. */
  change: (patch: Partial<DevState>) => void;
}

const FRAME = 1 / 30;
const PHRASE_KEYS: Record<string, Selection> = { '0': 'all', '1': 'shift', '2': 'open', '3': 'turn', '4': 'scene' };
const COMPARE_ORDER: CompareId[] = ['none', 'presets', 'modes', 'versions'];
const MODE_ORDER: ModeId[] = ['structure', 'flow', 'flow-e1'];

/**
 * 개발용 검토 화면. URL에 ?dev가 있을 때만 만들어지며 기본 감상 화면에는 존재하지 않는다.
 *
 * 단축키: Space 재생/정지 · ←/→ 1/30초 이동(Shift: 1초) · 0 전체 · 1/2/3 구절 ·
 * M Structure → Flow → Flow 실험 E1 · B E1 몸 영향 켜기/끄기 · F Flow 설정 1→2→3 ·
 * C 비교 화면 전환 · V 안무 A-1/A-2 · R 기준점 표시
 */
export class DevPanel {
  private readonly root: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly slider: HTMLInputElement;
  private readonly readout: HTMLElement;
  private readonly loadout: HTMLElement;
  private readonly selectEl: HTMLSelectElement;
  private readonly versionEl: HTMLSelectElement;
  private readonly speedEl: HTMLSelectElement;
  private readonly refBox: HTMLInputElement;
  private readonly compareEl: HTMLSelectElement;
  private readonly modeEl: HTMLSelectElement;
  private readonly presetEl: HTMLSelectElement;
  private readonly e1BodyBox: HTMLInputElement;
  private scrubbing = false;

  constructor(private readonly hooks: DevHooks) {
    const phrases = CHOREOGRAPHIES[CURRENT].phrases;
    const root = document.createElement('div');
    root.className = 'dev-panel';
    root.innerHTML = `
      <div class="dev-row">
        <select data-k="sel" aria-label="안무 구절">
          <option value="all">0 · 전체 순서</option>
          <option value="shift">1 · ${phrases.shift.title}</option>
          <option value="open">2 · ${phrases.open.title}</option>
          <option value="turn">3 · ${phrases.turn.title}</option>
          <option value="scene">4 · 검토: ${CONFIG.review.label}</option>
        </select>
        <select data-k="ver" aria-label="안무 버전">
          ${Object.values(CHOREOGRAPHIES).map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="dev-row">
        <select data-k="mode" aria-label="표현">
          <option value="structure">Structure</option>
          <option value="flow">Flow(천 모델)</option>
          <option value="flow-e1">Flow 실험 E1</option>
        </select>
        <label><input data-k="e1body" type="checkbox" /> E1 몸 영향</label>
        <select data-k="preset" aria-label="Flow 설정">
          ${([1, 2, 3] as const).map((n) => `<option value="${n}">${CONFIG.flow.presets[n].label}</option>`).join('')}
        </select>
        <select data-k="cmp" aria-label="나란히 비교">
          <option value="none">비교 없음</option>
          <option value="presets">비교: Flow 1·2·3</option>
          <option value="modes">비교: Structure·Flow·E1</option>
          <option value="versions">비교: 안무 A-1·A-2</option>
        </select>
      </div>
      <div class="dev-row">
        <button data-k="play" type="button"></button>
        <select data-k="speed" aria-label="속도">
          ${CONFIG.playback.devSpeeds.map((v) => `<option value="${v}">×${v}</option>`).join('')}
        </select>
        <label><input data-k="ref" type="checkbox" /> 기준점</label>
      </div>
      <div class="dev-row">
        <button data-k="b1" type="button" title="Shift+←">−1s</button>
        <button data-k="bf" type="button" title="←">−1f</button>
        <input data-k="t" type="range" min="0" step="0.001" aria-label="시간" />
        <button data-k="ff" type="button" title="→">+1f</button>
        <button data-k="f1" type="button" title="Shift+→">+1s</button>
      </div>
      <div class="dev-row dev-text" data-k="readout"></div>
      <div class="dev-row dev-text" data-k="load"></div>
    `;
    document.body.appendChild(root);
    this.root = root;
    const q = <T extends HTMLElement>(k: string) => root.querySelector(`[data-k="${k}"]`) as T;
    this.selectEl = q<HTMLSelectElement>('sel');
    this.versionEl = q<HTMLSelectElement>('ver');
    this.compareEl = q<HTMLSelectElement>('cmp');
    this.modeEl = q<HTMLSelectElement>('mode');
    this.presetEl = q<HTMLSelectElement>('preset');
    this.e1BodyBox = q<HTMLInputElement>('e1body');
    this.playBtn = q<HTMLButtonElement>('play');
    this.speedEl = q<HTMLSelectElement>('speed');
    this.slider = q<HTMLInputElement>('t');
    this.readout = q('readout');
    this.loadout = q('load');
    this.refBox = q<HTMLInputElement>('ref');

    const { clock, state } = hooks;
    this.selectEl.addEventListener('change', () => hooks.change({ selection: this.selectEl.value as Selection }));
    this.versionEl.addEventListener('change', () => hooks.change({ version: this.versionEl.value as ChoreographyId }));
    this.compareEl.addEventListener('change', () => hooks.change({ compare: this.compareEl.value as CompareId }));
    this.modeEl.addEventListener('change', () => hooks.change({ mode: this.modeEl.value as ModeId }));
    this.presetEl.addEventListener('change', () => hooks.change({ preset: Number(this.presetEl.value) as FlowPresetId }));
    this.e1BodyBox.addEventListener('change', () => hooks.change({ e1Body: this.e1BodyBox.checked }));
    this.playBtn.addEventListener('click', () => clock.toggle());
    this.speedEl.addEventListener('change', () => (clock.speed = Number(this.speedEl.value)));
    this.refBox.addEventListener('change', () => (state.showReference = this.refBox.checked));
    this.slider.addEventListener('pointerdown', () => (this.scrubbing = true));
    this.slider.addEventListener('pointerup', () => (this.scrubbing = false));
    this.slider.addEventListener('input', () => this.seekCycle(Number(this.slider.value)));
    q('b1').addEventListener('click', () => this.nudge(-1));
    q('bf').addEventListener('click', () => this.nudge(-FRAME));
    q('ff').addEventListener('click', () => this.nudge(FRAME));
    q('f1').addEventListener('click', () => this.nudge(1));

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const step = e.shiftKey ? 1 : FRAME;
      const phrase = PHRASE_KEYS[e.key];
      if (phrase) hooks.change({ selection: phrase });
      else if (e.key === ' ') clock.toggle();
      else if (e.key === 'ArrowLeft') this.nudge(-step);
      else if (e.key === 'ArrowRight') this.nudge(step);
      else if (e.key === 'v' || e.key === 'V') hooks.change({ version: state.version === 'a1' ? 'a2' : 'a1' });
      else if (e.key === 'c' || e.key === 'C')
        hooks.change({ compare: COMPARE_ORDER[(COMPARE_ORDER.indexOf(state.compare) + 1) % COMPARE_ORDER.length]! });
      else if (e.key === 'm' || e.key === 'M')
        hooks.change({ mode: MODE_ORDER[(MODE_ORDER.indexOf(state.mode) + 1) % MODE_ORDER.length]! });
      else if (e.key === 'b' || e.key === 'B') hooks.change({ e1Body: !state.e1Body });
      else if (e.key === 'f' || e.key === 'F') hooks.change({ preset: ((state.preset % 3) + 1) as FlowPresetId });
      else if (e.key === 'r' || e.key === 'R') state.showReference = !state.showReference;
      else return;
      e.preventDefault();
    });
  }

  /** 시간 이동은 정지 상태에서 하는 것이 검토에 편하므로 함께 정지한다. */
  private nudge(dt: number): void {
    this.hooks.clock.pause();
    this.hooks.clock.step(dt);
  }

  private seekCycle(value: number): void {
    const { clock } = this.hooks;
    const range = this.hooks.range();
    clock.pause();
    if (range) {
      clock.seek(range[0] + value);
      return;
    }
    const d = this.hooks.getPrimary().duration;
    clock.seek(Math.floor(clock.now / d) * d + value);
  }

  update(shown: readonly ShownScore[]): void {
    const { clock, state } = this.hooks;
    const primary = this.hooks.getPrimary();
    const now = this.hooks.viewTime();
    const range = this.hooks.range();
    const loc = primary.locate(now);
    this.playBtn.textContent = clock.isPaused ? '▶ 재생' : '❚❚ 정지';
    this.selectEl.value = state.selection;
    this.versionEl.value = state.version;
    this.versionEl.disabled = state.compare === 'versions';
    this.compareEl.value = state.compare;
    this.modeEl.value = state.mode;
    this.modeEl.disabled = state.compare === 'presets' || state.compare === 'modes';
    this.presetEl.value = String(state.preset);
    this.presetEl.disabled = state.compare === 'presets';
    this.e1BodyBox.checked = state.e1Body;
    this.refBox.checked = state.showReference;
    this.speedEl.value = String(clock.speed);
    this.slider.max = String(range ? range[1] - range[0] : primary.duration);
    if (!this.scrubbing) this.slider.value = String(range ? now - range[0] : loc.cycleTime);

    const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
    const lines: string[] = [];
    const loads: string[] = [];
    for (const { score, body } of shown) {
      const l = score.locate(now);
      lines.push(
        `${score.choreography.label} · ${l.cycleTime.toFixed(2)} / ${score.duration.toFixed(1)}s · ` +
          `${l.phrase.title} ${l.local.toFixed(2)}s · ${l.section}`,
      );
      const warn = body.pelvisCorrection > 0.003 ? ` · 골반 보정 ${body.pelvisCorrection.toFixed(3)}` : '';
      loads.push(`${score.choreography.label} 하중 L ${pct(body.load.L)}  R ${pct(body.load.R)}${warn}`);
    }
    this.readout.textContent = lines.join('\n');
    this.loadout.textContent = loads.join('\n');
  }

  get element(): HTMLElement {
    return this.root;
  }
}
