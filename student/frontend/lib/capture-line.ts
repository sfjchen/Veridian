import type { Stroke } from '@/components/InkCanvas';
import type { Line } from '@/lib/line-grouping';

const PADDING = 16;

export function captureLineAsDataUri(strokes: Stroke[], line: Line): string {
  const lineStrokes = strokes.filter((s) => line.strokeIds.has(s.id));
  if (lineStrokes.length === 0) return '';

  const { minX, minY, maxX, maxY } = line.bbox;
  const w = Math.ceil(maxX - minX) + PADDING * 2;
  const h = Math.ceil(maxY - minY) + PADDING * 2;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of lineStrokes) {
    if (stroke.points.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x - minX + PADDING, stroke.points[0].y - minY + PADDING);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x - minX + PADDING, stroke.points[i].y - minY + PADDING);
    }
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}
