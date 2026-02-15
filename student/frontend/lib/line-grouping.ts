import type { Stroke } from '@/components/InkCanvas';

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export type Line = { strokeIds: Set<string>; bbox: BBox };

export function strokeBBox(stroke: Stroke): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function verticalOverlap(a: BBox, b: BBox): boolean {
  return a.minY <= b.maxY && b.minY <= a.maxY;
}

function mergeBBoxes(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function mergeOverlapping(lines: Line[]): Line[] {
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        if (!verticalOverlap(lines[i].bbox, lines[j].bbox)) continue;
        lines[i].bbox = mergeBBoxes(lines[i].bbox, lines[j].bbox);
        for (const id of lines[j].strokeIds) lines[i].strokeIds.add(id);
        lines.splice(j, 1);
        merged = true;
        break;
      }
      if (merged) break;
    }
  }
  return lines;
}

export function lineKeyFromStrokeIds(ids: Set<string>): string {
  return [...ids].sort().join('|');
}

export function buildLines(
  strokes: Stroke[],
  targetStrokeId: string,
): { lines: Line[]; targetLine: Line | null } {
  const lines: Line[] = [];
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const bbox = strokeBBox(stroke);
    lines.push({ strokeIds: new Set([stroke.id]), bbox });
  }
  const result = mergeOverlapping(lines);
  const targetLine = result.find((l) => l.strokeIds.has(targetStrokeId)) ?? null;
  return { lines: result, targetLine };
}
