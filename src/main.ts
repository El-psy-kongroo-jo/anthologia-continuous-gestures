import { CONFIG } from './config';
import { Clock } from './core/clock';
import { mod } from './core/math';
import { solveBody, type Body } from './motion/body';
import { CHOREOGRAPHIES, CURRENT, PREVIOUS } from './motion/choreography';
import type { ChoreographyId } from './motion/phrases';
import { Score } from './motion/score';
import { drawMode, modeLabel, stillVeil, type ModeView } from './render/modes';
import { drawReference, drawVeilReference } from './render/reference';
import { Surface } from './render/surface';
import { Viewport } from './render/viewport';
import type { DevState, ShownScore } from './ui/debug';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const surface = new Surface(canvas);
const params = new URLSearchParams(location.search);
const devMode = params.has('dev');

const state: DevState = {
  selection: devMode ? 'scene' : 'all',
  version: CURRENT,
  mode: CONFIG.viewing.mode,
  preset: CONFIG.flow.defaultPreset,
  compare: 'none',
  showReference: false,
  e1Body: true,
};

/** 화면 한 칸: 어떤 안무를 어떤 표현으로 어디에 그리는지 */
interface Panel {
  score: Score;
  view: ModeView;
  viewport: Viewport;
  label: string;
}

let panels: Panel[] = [];
/** 검토 구간: 화면 시간을 [시작, 끝) 안에서 반복한다. */
let range: readonly [number, number] | null = null;

/** 검토 구간의 시작·끝(전체 순서 안의 초). 구절 시각과 여유로 정한다. */
function reviewRange(score: Score): readonly [number, number] {
  const at = (r: { phrase: string; section: string; offset: number }) => {
    const i = score.phrases.findIndex((p) => p.id === r.phrase);
    const sec = score.phrases[i]!.sections.find((x) => x.name === r.section)!;
    return score.starts[i]! + sec.start + r.offset;
  };
  return [at(CONFIG.review.from), at(CONFIG.review.to)];
}

const viewTime = (t: number) => (range ? range[0] + mod(t - range[0], range[1] - range[0]) : t);

/**
 * 화면 구성을 만든다. 안무가 같은 칸들은 같은 Score를 공유하므로 매 프레임 같은 몸을 그린다.
 * 비교 화면: versions = A-1 | A-2, presets = Flow 1 | 2 | 3, modes = Structure | Flow | Flow 실험 E1.
 * Flow 실험 E1은 A-2 전체 순서 위의 자기 장면을 쓰므로 항상 A-2 전체 순서의 Score를 받는다.
 */
function build(): void {
  const scores = new Map<string, Score>();
  const scoreOf = (id: ChoreographyId, whole: boolean) => {
    const key = `${id}:${whole}`;
    let s = scores.get(key);
    if (!s) {
      const c = CHOREOGRAPHIES[id];
      const sel = state.selection;
      s = new Score(c, whole || sel === 'all' || sel === 'scene' ? c.order : [sel]);
      scores.set(key, s);
    }
    return s;
  };
  const presence = state.e1Body ? 1 : 0;
  const view: ModeView = { mode: state.mode, preset: state.preset, presence };
  const entries: { id: ChoreographyId; view: ModeView }[] =
    state.compare === 'versions'
      ? [{ id: PREVIOUS, view }, { id: CURRENT, view }]
      : state.compare === 'presets'
        ? ([1, 2, 3] as const).map((preset) => ({ id: state.version, view: { mode: 'flow', preset } }))
        : state.compare === 'modes'
          ? [
              { id: state.version, view: { mode: 'structure', preset: state.preset } },
              { id: state.version, view: { mode: 'flow', preset: state.preset } },
              { id: CURRENT, view: { mode: 'flow-e1', preset: state.preset, presence } },
            ]
          : [{ id: view.mode === 'flow-e1' ? CURRENT : state.version, view }];
  const w = 1 / entries.length;
  panels = entries.map(({ id, view }, i) => {
    const viewport = new Viewport(canvas, { x: i * w, w });
    viewport.resize();
    const label = state.compare === 'versions' ? `${CHOREOGRAPHIES[id].label} · ${modeLabel(view)}` : modeLabel(view);
    const whole = view.mode === 'flow-e1' && state.selection !== 'scene';
    return { score: scoreOf(id, whole), view, viewport, label };
  });
  // Flow 실험 E1 하나만 볼 때는 E1의 장면을 반복한다.
  const E = CONFIG.flowE1.scene;
  range =
    state.mode === 'flow-e1' && state.compare === 'none'
      ? [E.from, E.from + E.length]
      : state.selection === 'scene'
        ? reviewRange(panels.at(-1)!.score)
        : null;
}

function resize(): void {
  Viewport.fitCanvas(canvas);
  for (const p of panels) p.viewport.resize();
}

const clock = new Clock(CONFIG.clock.maxDelta);
clock.speed = CONFIG.playback.speed;
let afterFrame: ((shown: ShownScore[]) => void) | null = null;

if (devMode) {
  // 개발 화면 전용 URL 옵션:
  // phrase=shift|open|turn|all, v=a1|a2, mode=structure|flow|flow-e1|flow-e2, preset=1|2|3, presence=0,
  // compare=versions|presets|modes, t=초, paused, speed=배속, refs=1, panel=0
  const sel = params.get('phrase');
  if (sel === 'all' || sel === 'scene' || sel === 'shift' || sel === 'open' || sel === 'turn') state.selection = sel;
  const v = params.get('v');
  if (v === 'a1' || v === 'a2') state.version = v;
  const mode = params.get('mode');
  if (mode === 'structure' || mode === 'flow' || mode === 'flow-e1' || mode === 'flow-e2') state.mode = mode;
  // Flow 실험 E1: presence=0이면 몸의 영향 없이 흐름만 본다(작업 순서 1의 확인용).
  state.e1Body = params.get('presence') !== '0';
  const preset = Number(params.get('preset'));
  if (preset === 1 || preset === 2 || preset === 3) state.preset = preset;
  const compare = params.get('compare');
  if (compare === 'versions' || compare === 'presets' || compare === 'modes') state.compare = compare;
  else if (compare === '') state.compare = 'versions';
  state.showReference = params.get('refs') === '1';
  const speed = Number(params.get('speed') ?? CONFIG.playback.devSpeed);
  clock.speed = (CONFIG.playback.devSpeeds as readonly number[]).includes(speed) ? speed : CONFIG.playback.devSpeed;
  build();
  const t = Number(params.get('t'));
  // 검토 구간에서 t는 구간 시작으로부터의 초다.
  if (params.has('t') && Number.isFinite(t)) clock.seek((range ? range[0] : 0) + t);
  else if (range) clock.seek(range[0]);
  if (params.has('paused')) clock.pause();

  const { DevPanel } = await import('./ui/debug');
  await import('./ui/debug.css');
  const panel = new DevPanel({
    clock,
    state,
    getPrimary: () => panels.at(-1)!.score,
    viewTime: () => viewTime(clock.now),
    range: () => range,
    change: (patch) => {
      const restart =
        (patch.selection !== undefined && patch.selection !== state.selection) ||
        (patch.version !== undefined && patch.version !== state.version);
      Object.assign(state, patch);
      build();
      // 같은 구절을 처음부터 비교할 수 있도록 구절·안무가 바뀌면 처음(검토 구간이면 구간 시작)으로 돌린다.
      // 표현(모드·Flow 설정·비교 화면)만 바뀌면 시간은 그대로 이어진다.
      if (restart) clock.seek(range ? range[0] : 0);
    },
  });
  if (params.get('panel') === '0') panel.element.hidden = true;
  afterFrame = (shown) => panel.update(shown);
}

function frame(now: number): void {
  clock.tick(now);
  const t = viewTime(clock.now);
  const bodies = new Map<Score, Body>();
  surface.clear();
  for (const p of panels) {
    let body = bodies.get(p.score);
    if (!body) {
      body = solveBody(p.score, t);
      bodies.set(p.score, body);
    }
    surface.begin(p.viewport);
    drawMode(surface.ctx, p.viewport, p.view, p.score, t, body);
    if (devMode && state.showReference) {
      if (p.view.mode === 'flow-e2') drawVeilReference(surface.ctx, p.viewport, stillVeil().body, CONFIG.flowE2);
      else drawReference(surface.ctx, p.viewport, body);
    }
    if (panels.length > 1) surface.drawLabel(p.viewport, p.label);
  }
  afterFrame?.([...bodies].map(([score, body]) => ({ score, body })));
  requestAnimationFrame(frame);
}

if (!devMode) build();
resize();
window.addEventListener('resize', resize);
// 탭이 가려진 동안은 프레임이 멈춘다. 돌아왔을 때 긴 경과 시간을 적용하지 않는다.
document.addEventListener('visibilitychange', () => clock.resync());
requestAnimationFrame(frame);
