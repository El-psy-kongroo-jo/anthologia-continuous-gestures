import type { Body } from '../motion/body';
import { buildRelief, sampleRelief, type Relief, type ReliefConfig, type ReliefSample } from './veil-relief';
import { lineSpan, sheetPoint, type SheetConfig, type SheetPoint } from './veil-sheet';
import { toneAt, type ToneConfig } from './veil-tone';
import type { Pose } from '../core/types';

/*
 * Flow 실험 E2: 선의 장.
 *
 * 몸보다 훨씬 넓은 하나의 연속된 선의 장(veil-sheet)이 몸 앞을 지나고, 몸 때문에 솟은 막의 높이
 * (veil-relief)만큼 선이 국소적으로 밀려 휜다. 선은 몸의 재료가 아니라 몸 위를 지나가는 흐름이며,
 * 몸 바깥의 선과 몸 위의 선은 같은 선이다. 외곽선·뼈대·면 채우기는 없다.
 *
 * 높이 → 화면: 무대 위의 몸을 약간 아래에서 올려다보는 시점이라, 막이 관객 쪽으로 솟은 만큼 선을
 * 화면 위로 민다. 선은 굴곡 위에서 위로 휘어 솟고(∩), 굴곡의 아랫면에서는 벌어지며(밝은 부피)
 * 윗면에서는 모인다(진해짐). 윗면이 더 가파르면 솟은 면이 그 위의 선을 가린다(숨은 선 제거:
 * 아래쪽 선부터 처리하며 화면 열마다 지금까지의 가장 높은 선을 기억하고, 그보다 아래에 오는 뒤쪽 선의
 * 점은 그리지 않는다). 가려진 선은 굴곡 뒤로 숨었다가 다시 나와 이어진다.
 */

export interface VeilConfig {
  label: string;
  /** 고정 자세(REST에 덮어쓰는 채널) */
  pose: Partial<Pose>;
  relief: ReliefConfig;
  sheet: SheetConfig;
  /** 높이 → 화면 위쪽 변위의 배율, 숨은 선 판정의 열 너비(몸 단위) */
  lift: { amount: number; column: number };
  tone: ToneConfig;
  /** 화면에 맞출 영역(몸 단위): 중심과 크기 */
  frame: { center: readonly [number, number]; size: readonly [number, number] };
  lineWidth: number;
  color: string;
}

export interface VeilLine {
  x: Float32Array;
  y: Float32Array;
  /** 점마다의 진하기 */
  a: Float32Array;
}

export interface Veil {
  /** 선을 솟게 한 몸(화면에 그리지 않는다. 개발용 기준 표시에 쓴다) */
  body: Body;
  lines: VeilLine[];
  relief: Relief;
  /** 실제로 쓴 높이 → 변위 배율 */
  lift: number;
  /** 선 사이 간격 비(기준 / 현재)의 범위 */
  density: { min: number; max: number };
}

/**
 * 선의 장을 만든다. time은 흐름 주기 안의 초(정지 화면이면 0). 몸이 고정이면 relief를 미리 만들어
 * 넘겨 매 프레임 다시 계산하지 않는다. 같은 입력은 항상 같은 선을 만든다.
 */
export function buildVeil(C: VeilConfig, body: Body, time = 0, relief: Relief = buildRelief(body, C.relief)): Veil {
  const S = C.sheet;
  const k = C.lift.amount;

  const p: SheetPoint = { x: 0, y: 0 };
  const q: SheetPoint = { x: 0, y: 0 };
  const rs: ReliefSample = { h: 0, gx: 0, gy: 0, near: 0 };
  // 이웃한 선까지의 v 간격(간격 비를 재기 위한 작은 차)
  const dv = 0.25 / Math.max(1, S.lines - 1);
  const baseGap = dv * S.size[1];

  const lines: VeilLine[] = [];
  let dMin = Infinity;
  let dMax = 0;
  for (let i = 0; i < S.lines; i++) {
    const span = lineSpan(S, i, time);
    const N = Math.max(2, Math.round(S.samples * (span.u1 - span.u0)));
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    const a = new Float32Array(N);
    const ny = new Float32Array(N);
    const nxs = new Float32Array(N);
    const near = new Float32Array(N);
    const gxs = new Float32Array(N);
    const gys = new Float32Array(N);
    for (let s = 0; s < N; s++) {
      const u = span.u0 + ((span.u1 - span.u0) * s) / (N - 1);
      sheetPoint(S, u, span.v, p, time);
      sampleRelief(relief, p.x, p.y, rs);
      x[s] = p.x;
      y[s] = p.y + k * rs.h;
      near[s] = rs.near;
      gxs[s] = rs.gx;
      gys[s] = rs.gy;
      sheetPoint(S, u, span.v + dv, q, time);
      sampleRelief(relief, q.x, q.y, rs);
      nxs[s] = q.x;
      ny[s] = q.y + k * rs.h;
    }
    const dens = new Float32Array(N);
    for (let s = 0; s < N; s++) {
      // 이웃한 선까지의 거리(선의 접선에 수직인 성분). 선이 접혀 넘어가는 곳은 아주 촘촘한 것으로 본다.
      const s0 = Math.max(0, s - 1);
      const s1 = Math.min(N - 1, s + 1);
      let tx = x[s1]! - x[s0]!;
      let ty = y[s1]! - y[s0]!;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const gap = (nxs[s]! - x[s]!) * -ty + (ny[s]! - y[s]!) * tx;
      const density = baseGap / Math.max(1e-6, gap);
      dMin = Math.min(dMin, density);
      dMax = Math.max(dMax, density);
      dens[s] = Math.min(C.tone.compress.max, Math.max(C.tone.compress.min, density));
    }
    // 간격에 따른 진하기는 선을 따라 고르게 이어지도록 이웃 표본과 평균한다(접히는 곳의 갑작스러운 진함 방지).
    const smooth = smoothAlong(dens, C.tone.smooth);
    for (let s = 0; s < N; s++) {
      const u = span.u0 + ((span.u1 - span.u0) * s) / (N - 1);
      const edge = Math.min((u - span.u0) / span.fade0, (span.u1 - u) / span.fade1);
      a[s] = toneAt(C.tone, near[s]!, smooth[s]!, gxs[s]!, gys[s]!, edge, span.v);
    }
    lines.push({ x, y, a });
  }
  hideOccluded(lines, C.lift.column);
  return { body, lines, relief, lift: k, density: { min: dMin, max: dMax } };
}

/** 선을 따라 앞뒤 r개 표본의 이동 평균 */
function smoothAlong(src: Float32Array, r: number): Float32Array {
  const n = src.length;
  const out = new Float32Array(n);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + src[i]!;
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - r);
    const hi = Math.min(n - 1, i + r);
    out[i] = (prefix[hi + 1]! - prefix[lo]!) / (hi - lo + 1);
  }
  return out;
}

/**
 * 숨은 선 제거. 선 번호가 작을수록 장의 아래쪽이다. 아래쪽 선부터 처리하며 열마다 지금까지 지나간
 * 선의 가장 높은 높이(지평선)를 기억한다. 위쪽 선의 점이 그 지평선보다 아래에 오면 솟은 면 뒤에
 * 있으므로 진하기를 0으로 둔다.
 */
function hideOccluded(lines: VeilLine[], column: number): void {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const l of lines) {
    for (let s = 0; s < l.x.length; s++) {
      minX = Math.min(minX, l.x[s]!);
      maxX = Math.max(maxX, l.x[s]!);
    }
  }
  const n = Math.ceil((maxX - minX) / column) + 2;
  const horizon = new Float32Array(n).fill(-Infinity);
  const col = (x: number) => (x - minX) / column;
  for (let i = 0; i < lines.length; i++) {
    const { x, y, a } = lines[i]!;
    for (let s = 0; s < x.length; s++) {
      if (y[s]! < horizon[Math.round(col(x[s]!))]!) a[s] = 0;
    }
    for (let s = 0; s + 1 < x.length; s++) {
      const c0 = col(x[s]!);
      const c1 = col(x[s + 1]!);
      const lo = Math.ceil(Math.min(c0, c1));
      const hi = Math.floor(Math.max(c0, c1));
      for (let c = lo; c <= hi; c++) {
        const t = c1 === c0 ? 0 : (c - c0) / (c1 - c0);
        const yy = y[s]! + (y[s + 1]! - y[s]!) * t;
        if (yy > horizon[c]!) horizon[c] = yy;
      }
    }
  }
}
