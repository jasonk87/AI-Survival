import type { EnvironmentState, Position } from '../types';
import { GRID_SIZE, IMPASSABLE_ITEM_TYPES } from '../constants';

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan distance
}

function getNeighbors(pos: Position): Position[] {
  const neighbors: Position[] = [];
  const { x, y } = pos;
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < GRID_SIZE - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < GRID_SIZE - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
}

function reconstructPath(cameFrom: Map<string, string | null>, currentKey: string): Position[] {
  const totalPath: Position[] = [];
  let current = currentKey;
  while (cameFrom.has(current) && cameFrom.get(current) != null) {
    const [x, y] = current.split(',').map(Number);
    totalPath.unshift({ x, y });
    current = cameFrom.get(current)!;
  }
  return totalPath;
}

export function findReachableAdjacentPosition(
    target: Position,
    start: Position,
    environment: EnvironmentState
): Position | null {
    const obstacles = new Set<string>();
    // The robot at the 'start' position should not be considered an obstacle for itself.
    environment.robots.forEach(r => {
        if (r.position.x !== start.x || r.position.y !== start.y) {
           obstacles.add(`${r.position.x},${r.position.y}`);
        }
    });
    environment.items.forEach(i => {
        if (IMPASSABLE_ITEM_TYPES.includes(i.type)) {
            obstacles.add(`${i.position.x},${i.position.y}`);
        }
    });

    const neighbors = getNeighbors(target);
    const validNeighbors = neighbors.filter(n => !obstacles.has(`${n.x},${n.y}`));
    
    if (validNeighbors.length === 0) {
        return null; // No empty spots next to the target.
    }
    
    // If the robot is already at a valid adjacent position, it's the best choice.
    if (validNeighbors.some(n => n.x === start.x && n.y === start.y)) {
        return start;
    }

    // Sort remaining valid neighbors by distance from the starting point.
    validNeighbors.sort((a, b) => heuristic(a, start) - heuristic(b, start));

    // Find the first valid neighbor that we can actually find a path to.
    for (const neighbor of validNeighbors) {
        const path = findPath(start, neighbor, environment);
        if (path !== null) { // A path exists
            return neighbor; // Found a reachable adjacent position.
        }
    }

    return null; // No path found to any of the adjacent positions.
}

// A* pathfinding algorithm
export function findPath(start: Position, end: Position, environment: EnvironmentState): Position[] | null {
  if (start.x === end.x && start.y === end.y) {
    return [];
  }

  // Set of nodes already evaluated
  const closedSet = new Set<string>();
  
  // The set of discovered nodes that are not yet evaluated.
  const openSet = new Set<string>([`${start.x},${start.y}`]);
  
  // For node n, cameFrom[n] is the node immediately preceding it on the cheapest path from start to n.
  const cameFrom = new Map<string, string>();

  // For node n, gScore[n] is the cost of the cheapest path from start to n currently known.
  const gScore = new Map<string, number>();
  gScore.set(`${start.x},${start.y}`, 0);

  // For node n, fScore[n] := gScore[n] + h(n). fScore[n] represents our current best guess as to
  // how short a path from start to finish can be if it goes through n.
  const fScore = new Map<string, number>();
  fScore.set(`${start.x},${start.y}`, heuristic(start, end));

  const obstacles = new Set<string>();
  environment.robots.forEach(r => {
    if (r.position.x !== start.x || r.position.y !== start.y) {
      obstacles.add(`${r.position.x},${r.position.y}`);
    }
  });
  environment.items.forEach(i => {
    if (IMPASSABLE_ITEM_TYPES.includes(i.type)) {
      obstacles.add(`${i.position.x},${i.position.y}`);
    }
  });
  
  if (obstacles.has(`${end.x},${end.y}`)) {
    return null;
  }

  while (openSet.size > 0) {
    let currentKey: string | undefined;
    let lowestFScore = Infinity;

    // Find the node in openSet having the lowest fScore value
    for (const nodeKey of openSet) {
      const score = fScore.get(nodeKey) ?? Infinity;
      if (score < lowestFScore) {
        lowestFScore = score;
        currentKey = nodeKey;
      }
    }
    
    if (!currentKey) break; // Should not happen if openSet is not empty

    const [currentX, currentY] = currentKey.split(',').map(Number);
    const currentPos = { x: currentX, y: currentY };

    if (currentPos.x === end.x && currentPos.y === end.y) {
      return reconstructPath(cameFrom, currentKey);
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const neighbor of getNeighbors(currentPos)) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey) || obstacles.has(neighborKey)) {
        continue;
      }

      const tentativeGScore = (gScore.get(currentKey) ?? Infinity) + 1;

      if (!openSet.has(neighborKey)) {
        openSet.add(neighborKey);
      } else if (tentativeGScore >= (gScore.get(neighborKey) ?? Infinity)) {
        continue; // This is not a better path.
      }

      // This path is the best until now. Record it.
      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeGScore);
      fScore.set(neighborKey, gScore.get(neighborKey)! + heuristic(neighbor, end));
    }
  }

  return null; // No path found
}
