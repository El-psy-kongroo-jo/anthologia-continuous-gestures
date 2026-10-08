import type { Clock } from '../core/clock';
import type { Body } from '../motion/body';
import { PHRASES, type PhraseId } from '../motion/phrases';
import type { Score } from '../motion/score';

export type Selection = 'all' | PhraseId;

export interface DevState {
  selection: Selection;
  showReference: boolean;
}

interface DevHooks {
  clock: Clock;
  getScore: () => Score;
  select: (selection: Selection) => void;
  state: DevState;
}

const FRAME = 1 / 30;

/**
 * 개발용 검토 화면. URL에 ?dev가 있을 때만 만들어지며 기본 감상 화면에는 존재하지 않는다.
 *
 * 단축키: Space 재생/정지 · ←/→ 1/30초 이동(Shift: 1초) · 0 전체 · 1/2/3 구절 · R 기준점 표시
 */
export class DevPanel {
  private readonly root: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly slider: HTMLInputElement;
  private readonly readout: HTMLElement;
  private readonly loadout: HTMLElement;
  private readonly selectEl: HTMLSelectElement;
  private readonly refBox: HTMLInputElement;
  private scrubbing = false;

  constructor(private readonly hooks: DevHooks) {
    const root = document.createElement('div');
    root.className = 'dev-panel';
    root.innerHTML = `
      <div class="dev-row">
        <select data-k="sel" aria-label="안무 구절">
          <option value="all">0 · 전체 순서</option>
          <option value="shift">1 · ${PHRASES.shift.title}</option>
          <option value="open">2 · ${PHRASES.open.title}</option>
          <option value="turn">3 · ${PHRASES.turn.title}</option>
        </select>
        <button data-k="play" type="button"></button>
        <select data-k="speed" aria-label="속도">
          <option value="0.25">×0.25</option>
          <option value="0.5">×0.5</option>
          <option value="1" selected>×1</option>
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
    this.playBtn = q<HTMLButtonElement>('play');
    this.slider = q<HTMLInputElement>('t');
    this.readout = q('readout');
    this.loadout = q('load');
    this.refBox = q<HTMLInputElement>('ref');
    const speed = q<HTMLSelectElement>('speed');

    const { clock, state } = hooks;
    this.selectEl.value = state.selection;
    this.refBox.checked = state.showReference;
    speed.value = String(clock.speed);

    this.selectEl.addEventListener('change', () => hooks.select(this.selectEl.value as Selection));
    this.playBtn.addEventListener('click', () => clock.toggle());
    speed.addEventListener('change', () => (clock.speed = Number(speed.value)));
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
      switch (e.key) {
        case ' ':
          clock.toggle();
          break;
        case 'ArrowLeft':
          this.nudge(-step);
          break;
        case 'ArrowRight':
          this.nudge(step);
          break;
        case '0':
          hooks.select('all');
          break;
        case '1':
          hooks.select('shift');
          break;
        case '2':
          hooks.select('open');
          break;
        case '3':
          hooks.select('turn');
          break;
        case 'r':
        case 'R':
          state.showReference = !state.showReference;
          break;
        default:
          return;
      }
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
    const d = this.hooks.getScore().duration;
    clock.pause();
    clock.seek(Math.floor(clock.now / d) * d + cycleTime);
  }

  update(body: Body): void {
    const { clock, state } = this.hooks;
    const score = this.hooks.getScore();
    const loc = score.locate(clock.now);
    this.playBtn.textContent = clock.isPaused ? '▶ 재생' : '❚❚ 정지';
    this.selectEl.value = state.selection;
    this.refBox.checked = state.showReference;
    this.slider.max = String(score.duration);
    if (!this.scrubbing) this.slider.value = String(loc.cycleTime);
    this.readout.textContent =
      `${loc.cycleTime.toFixed(2)} / ${score.duration.toFixed(1)}s · ` +
      `${loc.phrase.title} ${loc.local.toFixed(2)}s · ${loc.section}`;
    const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
    const warn = body.pelvisCorrection > 0.003 ? ` · 골반 보정 ${body.pelvisCorrection.toFixed(3)}` : '';
    this.loadout.textContent = `하중 L ${pct(body.load.L)}  R ${pct(body.load.R)}${warn}`;
  }

  get element(): HTMLElement {
    return this.root;
  }
}
