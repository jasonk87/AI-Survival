import { TileType } from '../store';

export function findPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  gridWidth: number,
  gridHeight: number,
  tiles: TileType[][]
): { x: number; y: number }[] | null {
  const queue = [{ x: startX, y: startY, path: [] as { x: number; y: number }[] }];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  while (queue.length > 0) {
    const { x, y, path } = queue.shift()!;

    if (x === targetX && y === targetY) {
      return path;
    }

    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        if (tiles[ny][nx] !== 'wall' || (nx === targetX && ny === targetY)) {
          if (!visited.has(`${nx},${ny}`)) {
            visited.add(`${nx},${ny}`);
            queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
          }
        }
      }
    }
  }

  return null;
}
