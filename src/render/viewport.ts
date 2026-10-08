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
  private groundY = 0;
  private centerX = 0;

  constructor(readonly canvas: HTMLCanvasElement) {}

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    const V = CONFIG.view;
    this.unit = Math.min(this.height * V.heightFraction, this.width * V.widthFraction);
    this.centerX = this.width / 2;
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
