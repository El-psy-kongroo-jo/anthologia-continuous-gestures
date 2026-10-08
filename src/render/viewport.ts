import { CONFIG } from '../config';
import type { Vec3 } from '../core/types';

export interface ScreenPoint {
  x: number;
  y: number;
  /** 카메라 쪽으로의 깊이(클수록 관객에게 가까움) */
  depth: number;
}

/**
 * 캔버스 크기·해상도와 몸 좌표 → 화면 좌표 변환.
 * 화면 크기가 바뀌면 몸의 크기와 여백을 다시 계산한다(자르지 않는다).
 */
export class Viewport {
  width = 0;
  height = 0;
  pixelRatio = 1;
  /** 몸 단위 1.0의 CSS 픽셀 길이 */
  unit = 0;
  /** 이 뷰포트가 차지하는 캔버스의 가로 범위(CSS 픽셀) */
  left = 0;
  private groundY = 0;
  private centerX = 0;

  /**
   * region은 캔버스 너비에 대한 비율이다. 기본은 전체 화면이고, 개발용 비교 화면에서는
   * 두 뷰포트가 캔버스를 좌우로 나눠 쓴다.
   */
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly region: { x: number; w: number } = { x: 0, w: 1 },
  ) {}

  /** 캔버스의 실제 해상도를 화면 크기에 맞춘다. 여러 뷰포트가 캔버스를 나눠 쓰면 한 번만 부른다. */
  static fitCanvas(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
    canvas.width = Math.round(Math.max(1, rect.width) * ratio);
    canvas.height = Math.round(Math.max(1, rect.height) * ratio);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
    this.width = Math.max(1, rect.width * this.region.w);
    this.height = Math.max(1, rect.height);
    this.left = rect.width * this.region.x;
    const V = CONFIG.view;
    this.unit = Math.min(this.height * V.heightFraction, this.width * V.widthFraction);
    this.centerX = this.left + this.width / 2;
    // 몸이 작아지는 좁은 화면에서는 바닥선을 위로 올려 몸을 화면 중앙 부근에 둔다.
    const bodyCenter = this.height * V.groundAt - this.height * V.heightFraction * 0.5;
    this.groundY = Math.min(this.height * V.groundAt, bodyCenter + this.unit * 0.5);
  }

  project(v: Vec3): ScreenPoint {
    const { yaw, pitch, distance } = CONFIG.camera;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const x = v.x * cy + v.z * sy;
    const z = v.z * cy - v.x * sy;
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const up = v.y * c - z * s;
    const depth = z * c + v.y * s;
    const k = distance / (distance - depth);
    return {
      x: this.centerX + x * k * this.unit,
      y: this.groundY - 0.5 * this.unit - (up - 0.5) * k * this.unit,
      depth,
    };
  }
}
