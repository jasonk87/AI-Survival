export type Position = { x: number; y: number };

export enum ItemType {
  Robot = 'ROBOT',
  Tree = 'TREE',
  Axe = 'AXE',
  Wood = 'WOOD',
  FirePit = 'FIRE_PIT',
  Fire = 'FIRE',
  Rock = 'ROCK',
  Pickaxe = 'PICKAXE',
  Stone = 'STONE',
  Wall = 'WALL',
  WaterSource = 'WATER_SOURCE',
  BucketEmpty = 'BUCKET_EMPTY',
  BucketFull = 'BUCKET_FULL',
  Seed = 'SEED',
  Soil = 'SOIL',
  Sapling = 'SAPLING',
  BerryBush = 'BERRY_BUSH',
  Berries = 'BERRIES',
}

export interface BaseItem {
  id: string;
  type: ItemType;
  position: Position;
}

export interface Robot extends BaseItem {
  type: ItemType.Robot;
  name: string;
  inventory: ItemType | null;
  color: string;
  path?: Position[];
  status: {
    warmth: number; // 0-100
    energy: number; // 0-100
    hunger: number; // 0-100
  };
  isInactive: boolean;
  currentAction?: ActionType;
}

export type EnvironmentItem = BaseItem;

export type EnvironmentState = {
  items: EnvironmentItem[];
  robots: Robot[];
};

export enum ActionType {
  MOVE = 'MOVE',
  GOTO = 'GOTO',
  PICKUP = 'PICKUP',
  USE = 'USE',
  TALK = 'TALK',
  IDLE = 'IDLE',
  DROP = 'DROP',
  EAT = 'EAT',
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface RobotAction {
  action: ActionType;
  payload: {
    direction?: Direction;
    message?: string;
    targetId?: string;
    targetPosition?: Position;
  };
  thought?: string;
}


export type LogEntry = {
  id: number;
  robotName: string;
  robotColor: string;
  message: string;
  type: 'ACTION' | 'COMMUNICATION' | 'GOAL' | 'SYSTEM' | 'STATUS';
};

export type TimeOfDay = 'Dawn' | 'Day' | 'Dusk' | 'Night';

export enum WeatherType {
  Clear = 'Clear',
  Rain = 'Rain',
  Snow = 'Snow',
}

export type WorldState = {
  day: number;
  timeOfDay: TimeOfDay;
  cycleProgress: number; // 0-100
  temperature: number;
  weather: WeatherType;
};