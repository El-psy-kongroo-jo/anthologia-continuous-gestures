import { CONFIG } from '../config';
import type { Clock } from '../core/clock';
import type { Body } from '../motion/body';
import { CHOREOGRAPHIES, CURRENT } from '../motion/choreography';
import type { ChoreographyId, PhraseId } from '../motion/phrases';
import type { Score } from '../motion/score';

export type Selection = 'all' | PhraseId;

export interface DevState {
  selection: Selection;
  version: ChoreographyId;
  /** 이전 안무(A-1)와 현재 안무(A-2)를 좌우로 나란히 보기 */
  compare: boolean;
  showReference: boolean;
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
  /** 상태를 바꾼다. 구절이나 안무가 바뀌면 그 구절의 처음으로 돌아간다. */
  change: (patch: Partial<DevState>) => void;
}

const FRAME = 1 / 30;
const PHRASE_KEYS: Record<string, Selection> = { '0': 'all', '1': 'shift', '2': 'open', '3': 'turn' };

/**
 * 개발용 검토 화면. URL에 ?dev가 있을 때만 만들어지며 기본 감상 화면에는 존재하지 않는다.
 *
 * 단축키: Space 재생/정지 · ←/→ 1/30초 이동(Shift: 1초) · 0 전체 · 1/2/3 구절 ·
 * V 안무 A-1/A-2 전환 · C 나란히 비교 · R 기준점 표시
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
  private readonly compareBox: HTMLInputElement;
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
        </select>
        <select data-k="ver" aria-label="안무 버전">
          ${Object.values(CHOREOGRAPHIES).map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>
        <label><input data-k="cmp" type="checkbox" /> 나란히 비교</label>
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
    this.compareBox = q<HTMLInputElement>('cmp');
    this.playBtn = q<HTMLButtonElement>('play');
    this.speedEl = q<HTMLSelectElement>('speed');
    this.slider = q<HTMLInputElement>('t');
    this.readout = q('readout');
    this.loadout = q('load');
    this.refBox = q<HTMLInputElement>('ref');

    const { clock, state } = hooks;
    this.selectEl.addEventListener('change', () => hooks.change({ selection: this.selectEl.value as Selection }));
    this.versionEl.addEventListener('change', () => hooks.change({ version: this.versionEl.value as ChoreographyId }));
    this.compareBox.addEventListener('change', () => hooks.change({ compare: this.compareBox.checked }));
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
      else if (e.key === 'c' || e.key === 'C') hooks.change({ compare: !state.compare });
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

  private seekCycle(cycleTime: number): void {
    const { clock } = this.hooks;
    const d = this.hooks.getPrimary().duration;
    clock.pause();
    clock.seek(Math.floor(clock.now / d) * d + cycleTime);
  }

  update(shown: readonly ShownScore[]): void {
    const { clock, state } = this.hooks;
    const primary = this.hooks.getPrimary();
    const loc = primary.locate(clock.now);
    this.playBtn.textContent = clock.isPaused ? '▶ 재생' : '❚❚ 정지';
    this.selectEl.value = state.selection;
    this.versionEl.value = state.version;
    this.versionEl.disabled = state.compare;
    this.compareBox.checked = state.compare;
    this.refBox.checked = state.showReference;
    this.speedEl.value = String(clock.speed);
    this.slider.max = String(primary.duration);
    if (!this.scrubbing) this.slider.value = String(loc.cycleTime);

    const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
    const lines: string[] = [];
    const loads: string[] = [];
    for (const { score, body } of shown) {
      const l = score.locate(clock.now);
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
