import { CONFIG } from './config';
import { Clock } from './core/clock';
import { solveBody } from './motion/body';
import { CHOREOGRAPHIES, CURRENT, PREVIOUS } from './motion/choreography';
import type { ChoreographyId } from './motion/phrases';
import { Score } from './motion/score';
import { Renderer } from './render/canvas';
import { Viewport } from './render/viewport';
import type { DevState, Selection, ShownScore } from './ui/debug';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const devMode = params.has('dev');

const state: DevState = {
  selection: 'all',
  version: CURRENT,
  compare: false,
  showReference: true,
};

const makeScore = (version: ChoreographyId, selection: Selection) => {
  const c = CHOREOGRAPHIES[version];
  return new Score(c, selection === 'all' ? c.order : [selection]);
};

/** 화면에 그릴 안무와 그 영역. 비교 화면에서는 왼쪽이 이전, 오른쪽이 현재 안무다. */
interface Stage {
  score: Score;
  viewport: Viewport;
  renderer: Renderer;
}

let stages: Stage[] = [];

function build(): void {
  const entries: [ChoreographyId, { x: number; w: number }][] = state.compare
    ? [[PREVIOUS, { x: 0, w: 0.5 }], [CURRENT, { x: 0.5, w: 0.5 }]]
    : [[state.version, { x: 0, w: 1 }]];
  stages = entries.map(([version, region]) => {
    const viewport = new Viewport(canvas, region);
    viewport.resize();
    return { score: makeScore(version, state.selection), viewport, renderer: new Renderer(viewport) };
  });
}

function resize(): void {
  Viewport.fitCanvas(canvas);
  for (const s of stages) s.viewport.resize();
}

const clock = new Clock(CONFIG.clock.maxDelta);
clock.speed = CONFIG.playback.speed;
let afterFrame: ((shown: ShownScore[]) => void) | null = null;

if (devMode) {
  // 개발 화면 전용 URL 옵션:
  // phrase=shift|open|turn|all, v=a1|a2, compare, t=초, paused, speed=배속, refs=0, panel=0
  const sel = params.get('phrase');
  if (sel === 'all' || sel === 'shift' || sel === 'open' || sel === 'turn') state.selection = sel;
  const v = params.get('v');
  if (v === 'a1' || v === 'a2') state.version = v;
  state.compare = params.has('compare');
  state.showReference = params.get('refs') !== '0';
  const speed = Number(params.get('speed') ?? CONFIG.playback.devSpeed);
  clock.speed = (CONFIG.playback.devSpeeds as readonly number[]).includes(speed) ? speed : CONFIG.playback.devSpeed;
  const t = Number(params.get('t'));
  if (Number.isFinite(t)) clock.seek(t);
  if (params.has('paused')) clock.pause();

  const { DevPanel } = await import('./ui/debug');
  await import('./ui/debug.css');
  const panel = new DevPanel({
    clock,
    state,
    getPrimary: () => stages.at(-1)!.score,
    change: (patch) => {
      const restart =
        (patch.selection !== undefined && patch.selection !== state.selection) ||
        (patch.version !== undefined && patch.version !== state.version);
      Object.assign(state, patch);
      build();
      // 같은 구절을 처음부터 비교할 수 있도록 구절·안무가 바뀌면 시간을 0으로 돌린다.
      if (restart) clock.seek(0);
    },
  });
  if (params.get('panel') === '0') panel.element.hidden = true;
  afterFrame = (shown) => panel.update(shown);
}

function frame(now: number): void {
  clock.tick(now);
  const shown: ShownScore[] = [];
  stages[0]!.renderer.clear();
  for (const { score, renderer } of stages) {
    const body = solveBody(score, clock.now);
    renderer.drawBody(body);
    if (devMode && state.showReference) renderer.drawReference(body);
    if (state.compare) renderer.drawLabel(score.choreography.label);
    shown.push({ score, body });
  }
  afterFrame?.(shown);
  requestAnimationFrame(frame);
}

build();
resize();
window.addEventListener('resize', resize);
// 탭이 가려진 동안은 프레임이 멈춘다. 돌아왔을 때 긴 경과 시간을 적용하지 않는다.
document.addEventListener('visibilitychange', () => clock.resync());
requestAnimationFrame(frame);
