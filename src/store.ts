import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CORE_ENTITY_ASSETS, getRandomHumanAssetId } from './assets/catalog';

export type TileType = 'grass' | 'floor' | 'wall' | 'door';
export type ResourceInventory = { wood: number; stone: number; axes: number; weapons: number };

export interface RelationshipState {
  trust: number;
  respect: number;
  lastInteraction?: string;
}

export interface SocialObligation {
  id: string;
  kind: 'deliver_wood' | 'deliver_stone' | 'craft_axe';
  owedTo: string;
  createdBy: string;
  status: 'open' | 'fulfilled';
  note: string;
  createdAt: number;
  fulfilledAt?: number;
  lastDiscussedAt?: number;
}

export type SocialEventType =
  | 'promise_made'
  | 'promise_kept'
  | 'promise_overdue'
  | 'trade'
  | 'gift'
  | 'coordination'
  | 'gossip';

export interface SocialEvent {
  id: string;
  type: SocialEventType;
  time: number;
  sourceAgentId: string;
  targetAgentId?: string;
  subjectAgentId?: string;
  obligationId?: string;
  summary: string;
  direct: boolean;
  emotionalWeight: number;
}

export interface Entity {
  id: string;
  type: 'bed' | 'workstation' | 'food' | 'chair' | 'table' | 'plant' | 'farm' | 'tree' | 'rock' | 'chest' | 'asset';
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  assetId?: string;
  assetCategory?: string;
  inventory?: ResourceInventory;
  capacity?: number;
}

export interface Agent {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  assetId?: string;
  stats: {
    hunger: number; // 0-100, 100 is full
    energy: number; // 0-100, 100 is rested
    fun: number; // 0-100
  };
  traits: string[];
  currentAction: string | null;
  targetX: number | null;
  targetY: number | null;
  path: { x: number; y: number }[] | null;
  lastThought: string | null;
  buildType?: string;
  placeType?: string;
  inventory?: ResourceInventory;
  currentProject?: string | null;
  targetAgentId?: string | null;
  memories?: string[];
  relationships?: Record<string, RelationshipState>;
  obligations?: SocialObligation[];
  socialEvents?: SocialEvent[];
  speechBubble?: string | null;
  speechUntil?: number | null;
  socialCooldownUntil?: number | null;
  talkingSince?: number | null;
}

export interface SavedEnvironment {
  name: string;
  timestamp: number;
  gridWidth: number;
  gridHeight: number;
  tiles: TileType[][];
  entities: Entity[];
  agents: Agent[];
}

interface GameState {
  gridWidth: number;
  gridHeight: number;
  tiles: TileType[][];
  entities: Entity[];
  agents: Agent[];
  time: number;
  isSimulating: boolean;
  selectedTool: string | null;
  selectedEntity: string | null;
  savedEnvironments: SavedEnvironment[];

  // Actions
  setTile: (x: number, y: number, type: TileType) => void;
  addEntity: (entity: Omit<Entity, 'id'>) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setSelectedTool: (tool: string | null) => void;
  setSelectedEntity: (id: string | null) => void;
  toggleSimulation: () => void;
  tick: () => void;
  saveEnvironment: (name: string) => void;
  loadEnvironment: (name: string) => void;
  clearState: () => void;
}

const INITIAL_WIDTH = 40;
const INITIAL_HEIGHT = 30;
const INITIAL_TREE_COUNT = 24;
const INITIAL_ROCK_COUNT = 16;

const createInitialTiles = () => {
  const tiles: TileType[][] = [];
  for (let y = 0; y < INITIAL_HEIGHT; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < INITIAL_WIDTH; x++) {
      row.push('grass');
    }
    tiles.push(row);
  }
  return tiles;
};

const createInitialEntities = () => {
  const entities: Entity[] = [];
  const occupied = new Set<string>();

  const addNaturalEntity = (type: 'tree' | 'rock', count: number, name: string) => {
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < 2000) {
      attempts += 1;
      const x = Math.floor(Math.random() * INITIAL_WIDTH);
      const y = Math.floor(Math.random() * INITIAL_HEIGHT);
      const key = `${x},${y}`;

      if (occupied.has(key)) continue;

      occupied.add(key);
      entities.push({
        id: uuidv4(),
        type,
        x,
        y,
        width: 1,
        height: 1,
        name,
        assetId: CORE_ENTITY_ASSETS[type].id,
        assetCategory: CORE_ENTITY_ASSETS[type].category
      });
      placed += 1;
    }
  };

  addNaturalEntity('tree', INITIAL_TREE_COUNT, 'Tree');
  addNaturalEntity('rock', INITIAL_ROCK_COUNT, 'Rock');

  return entities;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      gridWidth: INITIAL_WIDTH,
      gridHeight: INITIAL_HEIGHT,
      tiles: createInitialTiles(),
      entities: createInitialEntities(),
      agents: [],
      time: 0,
      isSimulating: false,
      selectedTool: null,
      selectedEntity: null,
      savedEnvironments: [],

      setTile: (x, y, type) =>
        set((state) => {
          if (x < 0 || x >= state.gridWidth || y < 0 || y >= state.gridHeight) return state;
          const newTiles = [...state.tiles];
          newTiles[y] = [...newTiles[y]];
          newTiles[y][x] = type;
          return { tiles: newTiles };
        }),

      addEntity: (entity) =>
        set((state) => ({
          entities: [...state.entities, { ...entity, id: uuidv4() }],
        })),

      updateEntity: (id, updates) =>
        set((state) => ({
          entities: state.entities.map((entity) => (entity.id === id ? { ...entity, ...updates } : entity)),
        })),

      removeEntity: (id) =>
        set((state) => ({
          entities: state.entities.filter((e) => e.id !== id),
          selectedEntity: state.selectedEntity === id ? null : state.selectedEntity,
        })),

      addAgent: (agent) =>
        set((state) => ({
          agents: [...state.agents, { ...agent, assetId: agent.assetId || getRandomHumanAssetId(), id: uuidv4() }],
        })),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          selectedEntity: state.selectedEntity === id ? null : state.selectedEntity,
        })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      setSelectedTool: (tool) => set({ selectedTool: tool, selectedEntity: null }),
      setSelectedEntity: (id) => set({ selectedEntity: id, selectedTool: null }),
      toggleSimulation: () => set((state) => ({ isSimulating: !state.isSimulating })),

      tick: () =>
        set((state) => {
          if (!state.isSimulating) return state;
          
          // Basic simulation logic: decrease stats over time
          const newAgents = state.agents.map(agent => {
            let newHunger = agent.stats.hunger;
            let newEnergy = agent.stats.energy;
            let newFun = agent.stats.fun;
            
            // Only decrease stats if not doing an action that restores them
            if (agent.currentAction !== 'sleeping') {
              newEnergy = Math.max(0, agent.stats.energy - 0.05);
            }
            if (agent.currentAction !== 'eating') {
              newHunger = Math.max(0, agent.stats.hunger - 0.1);
            }
            if (agent.currentAction !== 'playing') {
              newFun = Math.max(0, agent.stats.fun - 0.08);
            }

            return {
              ...agent,
              stats: {
                hunger: newHunger,
                energy: newEnergy,
                fun: newFun
              }
            };
          });

          return { time: state.time + 1, agents: newAgents };
        }),

      saveEnvironment: (name) =>
        set((state) => {
          const newEnv: SavedEnvironment = {
            name,
            timestamp: Date.now(),
            gridWidth: state.gridWidth,
            gridHeight: state.gridHeight,
            tiles: state.tiles,
            entities: state.entities,
            agents: state.agents,
          };
          return {
            savedEnvironments: [...state.savedEnvironments.filter((e) => e.name !== name), newEnv],
          };
        }),

      loadEnvironment: (name) =>
        set((state) => {
          const env = state.savedEnvironments.find((e) => e.name === name);
          if (!env) return state;
          return {
            gridWidth: env.gridWidth,
            gridHeight: env.gridHeight,
            tiles: env.tiles,
            entities: env.entities,
            agents: env.agents,
            time: 0,
            isSimulating: false,
          };
        }),

      clearState: () =>
        set((state) => ({
          tiles: createInitialTiles(),
          entities: createInitialEntities(),
          agents: [],
          time: 0,
          isSimulating: false,
          selectedEntity: null,
        })),
    }),
    {
      name: 'ai-agent-sandbox-storage',
      partialize: (state) => ({ savedEnvironments: state.savedEnvironments }),
    }
  )
);
