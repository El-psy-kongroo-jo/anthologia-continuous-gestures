import { CONFIG } from './config';
import { Clock } from './core/clock';
import { solveBody } from './motion/body';
import { DEFAULT_ORDER, PHRASES, type PhraseId } from './motion/phrases';
import { Score } from './motion/score';
import { Renderer } from './render/canvas';
import { Viewport } from './render/viewport';
import type { Body } from './motion/body';
import type { Selection } from './ui/debug';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const viewport = new Viewport(canvas);
const renderer = new Renderer(viewport);
const params = new URLSearchParams(location.search);
const devMode = params.has('dev');

const orderFor = (s: Selection): PhraseId[] => (s === 'all' ? DEFAULT_ORDER : [s]);

const state = {
  selection: 'all' as Selection,
  showReference: true,
};
let score = new Score(orderFor(state.selection));
const clock = new Clock(CONFIG.clock.maxDelta);

let afterFrame: ((body: Body) => void) | null = null;

if (devMode) {
  // 개발 화면 전용 URL 옵션: phrase=shift|open|turn|all, t=초, paused, refs=0, panel=0
  const sel = params.get('phrase');
  if (sel === 'all' || (sel !== null && sel in PHRASES)) state.selection = sel as Selection;
  state.showReference = params.get('refs') !== '0';
  score = new Score(orderFor(state.selection));
  const t = Number(params.get('t'));
  if (Number.isFinite(t)) clock.seek(t);
  if (params.has('paused')) clock.pause();

  const { DevPanel } = await import('./ui/debug');
  await import('./ui/debug.css');
  const panel = new DevPanel({
    clock,
    state,
    getScore: () => score,
    select: (s) => {
      state.selection = s;
      score = new Score(orderFor(s));
      clock.seek(0);
    },
  });
  if (params.get('panel') === '0') panel.element.hidden = true;
  afterFrame = (body) => panel.update(body);
}

function frame(now: number): void {
  clock.tick(now);
  const body = solveBody(score, clock.now);
  renderer.clear();
  renderer.drawBody(body);
  if (devMode && state.showReference) renderer.drawReference(body);
  afterFrame?.(body);
  requestAnimationFrame(frame);
}

viewport.resize();
window.addEventListener('resize', () => viewport.resize());
// 탭이 가려진 동안은 프레임이 멈춘다. 돌아왔을 때 긴 경과 시간을 적용하지 않는다.
document.addEventListener('visibilitychange', () => clock.resync());
requestAnimationFrame(frame);
