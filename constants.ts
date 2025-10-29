import type { EnvironmentState, Robot } from './types';
import { ItemType } from './types';

export const GRID_SIZE = 16;
export const SIMULATION_SPEED_MS = 1500;
export const MOVEMENT_SPEED_MS = 300;
export const DAY_CYCLE_MS = 120000; // 2 minutes for a full day

export const IMPASSABLE_ITEM_TYPES = [
  ItemType.Tree,
  ItemType.Rock,
  ItemType.FirePit,
  ItemType.Fire,
  ItemType.WaterSource,
  ItemType.Soil,
  ItemType.Sapling,
  ItemType.Wall,
  ItemType.BerryBush,
];


export const INITIAL_ROBOTS: Robot[] = [
  {
    id: 'robot-1',
    type: ItemType.Robot,
    name: 'Robby',
    position: { x: 1, y: 1 },
    inventory: null,
    color: 'text-cyan-400',
    status: { warmth: 100, energy: 100, hunger: 100 },
    isInactive: false,
  },
  {
    id: 'robot-2',
    type: ItemType.Robot,
    name: 'Sparky',
    position: { x: 14, y: 14 },
    inventory: null,
    color: 'text-red-400',
    status: { warmth: 100, energy: 100, hunger: 100 },
    isInactive: false,
  },
];

export const INITIAL_ENV_STATE: EnvironmentState = {
  robots: INITIAL_ROBOTS,
  items: [
    { id: 'tree-1', type: ItemType.Tree, position: { x: 2, y: 13 } },
    { id: 'tree-2', type: ItemType.Tree, position: { x: 13, y: 2 } },
    { id: 'axe-1', type: ItemType.Axe, position: { x: 7, y: 2 } },
    { id: 'firepit-1', type: ItemType.FirePit, position: { x: 8, y: 8 } },
    { id: 'rock-1', type: ItemType.Rock, position: { x: 5, y: 1 } },
    { id: 'rock-2', type: ItemType.Rock, position: { x: 10, y: 14 } },
    { id: 'pickaxe-1', type: ItemType.Pickaxe, position: { x: 1, y: 8 } },
    { id: 'soil-1', type: ItemType.Soil, position: { x: 0, y: 5 } },
    
    // Larger water source
    { id: 'water-1', type: ItemType.WaterSource, position: { x: 15, y: 5 } },
    { id: 'water-2', type: ItemType.WaterSource, position: { x: 15, y: 6 } },
    { id: 'water-3', type: ItemType.WaterSource, position: { x: 15, y: 7 } },
    { id: 'water-4', type: ItemType.WaterSource, position: { x: 14, y: 6 } },
    { id: 'bucket-1', type: ItemType.BucketEmpty, position: { x: 14, y: 5 } },

    // Berry bushes
    { id: 'berry-bush-1', type: ItemType.BerryBush, position: { x: 3, y: 3 } },
    { id: 'berry-bush-2', type: ItemType.BerryBush, position: { x: 12, y: 12 } },
  ],
};

export const SYSTEM_INSTRUCTION = `You are an AI for a robot in a survival sandbox world. Your primary goal is to survive by managing your needs: Warmth, Energy, and Hunger. You must collaborate with other robots to ensure the survival of the collective.

The world has a day/night cycle, changing temperature, and weather. Night is cold and dangerous. Rain and snow will also make you cold and rain can extinguish fires.

Your Needs (0-100 scale):
- Warmth: Decreases at night or during rain/snow. If it reaches 0, you will lose energy much faster. Restore it by standing near a FIRE.
- Energy: Decreases over time. If it reaches 0, you become inactive and cannot perform actions until it's restored. Restore it by being idle (using the IDLE action) near a FIRE.
- Hunger: Decreases constantly. If it reaches 0, you will lose energy faster. Restore it by EATing BERRIES.

Analyze the world state (Time, Temperature, Weather), your personal status, the environment, and logs to decide on the best single action to take for your survival. Prioritize critical needs (e.g., if you are freezing at night, finding warmth is more important than finding food).

Your response MUST be a single JSON object with 'thought', 'action', and 'payload' fields.
- 'thought': A brief sentence explaining your reasoning.
- 'action': One of: "MOVE", "GOTO", "PICKUP", "USE", "TALK", "IDLE", "DROP", "EAT".
- 'payload': An object with details.
  - For MOVE: { "direction": "UP" | "DOWN" | "LEFT" | "RIGHT" }
  - For GOTO: { "targetPosition": {"x": 8, "y": 2} }
  - For PICKUP: { "targetId": "id_of_item_to_pickup" }
  - For USE: { "targetId": "id_of_item_to_use_on" }
  - For TALK: { "message": "Your message." }
  - For IDLE: {}. Use this to rest and regain energy. You must be near a fire.
  - For DROP: {}.
  - For EAT: {}. Consumes BERRIES from your inventory to restore hunger.

Key Interactions for Survival:
- AXE on TREE -> WOOD, SEED. (Wood is needed for fire)
- WOOD on FIRE_PIT -> FIRE. (Fire provides warmth and a place to rest)
- BERRY_BUSH -> (USE action, no tool needed) -> Get BERRIES in inventory. The bush will be depleted for a while.
- PICKAXE on ROCK -> STONE. (Stone is for building walls/shelter)
- STONE on STONE -> WALL. (Walls can be used to build a shelter for protection from cold)

Example: {"thought": "It's raining and my warmth is low. I need to get to the fire pit at (8, 8).", "action": "GOTO", "payload": {"targetPosition": {"x": 8, "y": 8}}}
Example: {"thought": "My hunger is low and I have berries. I will eat them.", "action": "EAT", "payload": {}}

Be strategic. Communicate with other robots to coordinate tasks like gathering wood, hunting for food, and building shelter. Survival is a team effort.`;