import type { Viewport } from './viewport';

/** 캔버스 공통 처리: 배경 지우기와 개발용 비교 화면의 이름표 */
export class Surface {
  readonly ctx: CanvasRenderingContext2D;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.');
    this.ctx = ctx;
  }

  /** 캔버스 전체를 지운다(뷰포트가 캔버스를 나눠 써도 한 번만 부른다). */
  clear(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fbfbf9';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  /** 이후 그리기를 이 뷰포트의 해상도 기준으로 맞춘다. */
  begin(vp: Viewport): void {
    this.ctx.setTransform(vp.pixelRatio, 0, 0, vp.pixelRatio, 0, 0);
  }

  /** 개발용 비교 화면: 뷰포트 아래쪽의 이름표와 왼쪽 경계선 */
  drawLabel(vp: Viewport, text: string): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, vp.left + vp.width / 2, vp.height - 16);
    if (vp.left > 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vp.left, 0);
      ctx.lineTo(vp.left, vp.height);
      ctx.stroke();
    }
  }
}
