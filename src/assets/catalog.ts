import spriteSheetUrl from './dawnlike_combined.png';

export type AssetCategory = 'Furniture' | 'Decor' | 'Workshop' | 'Nature' | 'Characters' | 'Utility';

export interface PlaceableAsset {
  id: string;
  name: string;
  category: AssetCategory;
  spriteX: number;
  spriteY: number;
  width?: number;
  height?: number;
}

export const assetSpriteSheetUrl = spriteSheetUrl;
export const ASSET_TILE_SIZE = 16;

export const HUMAN_ASSETS: PlaceableAsset[] = [
  { id: 'villager_tan_01', name: 'Villager Tan 01', category: 'Characters', spriteX: 0, spriteY: 0 },
  { id: 'villager_tan_02', name: 'Villager Tan 02', category: 'Characters', spriteX: 2, spriteY: 0 },
  { id: 'villager_red_01', name: 'Villager Red 01', category: 'Characters', spriteX: 3, spriteY: 0 },
  { id: 'villager_light_01', name: 'Villager Light 01', category: 'Characters', spriteX: 6, spriteY: 0 },
  { id: 'villager_green_01', name: 'Villager Green 01', category: 'Characters', spriteX: 1, spriteY: 1 },
  { id: 'villager_dark_01', name: 'Villager Dark 01', category: 'Characters', spriteX: 3, spriteY: 1 },
];

export const CORE_ENTITY_ASSETS = {
  bed: { id: 'simple_bed', name: 'Simple Bed', category: 'Furniture', spriteX: 0, spriteY: 185 } as PlaceableAsset,
  chest: { id: 'supply_chest', name: 'Supply Chest', category: 'Utility', spriteX: 2, spriteY: 185 } as PlaceableAsset,
  workstation: { id: 'craft_bench', name: 'Craft Bench', category: 'Workshop', spriteX: 4, spriteY: 180 } as PlaceableAsset,
  chair: { id: 'wooden_chair', name: 'Wooden Chair', category: 'Furniture', spriteX: 2, spriteY: 183 } as PlaceableAsset,
  plant: { id: 'vine_cluster', name: 'Vine Cluster', category: 'Nature', spriteX: 6, spriteY: 178 } as PlaceableAsset,
  farm: { id: 'crop_patch', name: 'Crop Patch', category: 'Nature', spriteX: 5, spriteY: 156 } as PlaceableAsset,
  tree: { id: 'green_tree', name: 'Green Tree', category: 'Nature', spriteX: 0, spriteY: 192 } as PlaceableAsset,
  rock: { id: 'stone_boulder', name: 'Stone Boulder', category: 'Nature', spriteX: 0, spriteY: 160 } as PlaceableAsset,
  food: { id: 'supply_jar', name: 'Supply Jar', category: 'Decor', spriteX: 0, spriteY: 179 } as PlaceableAsset,
} as const;

export const PLACEABLE_ASSETS: PlaceableAsset[] = [
  CORE_ENTITY_ASSETS.bed,
  CORE_ENTITY_ASSETS.chest,
  CORE_ENTITY_ASSETS.workstation,
  CORE_ENTITY_ASSETS.chair,
  CORE_ENTITY_ASSETS.plant,
  CORE_ENTITY_ASSETS.farm,
  CORE_ENTITY_ASSETS.tree,
  CORE_ENTITY_ASSETS.rock,
  CORE_ENTITY_ASSETS.food,

  { id: 'stone_vines', name: 'Stone Vines', category: 'Nature', spriteX: 0, spriteY: 178 },
  { id: 'thorn_patch', name: 'Thorn Patch', category: 'Nature', spriteX: 2, spriteY: 178 },
  { id: 'clay_jar', name: 'Clay Jar', category: 'Decor', spriteX: 0, spriteY: 179 },
  { id: 'amber_jar', name: 'Amber Jar', category: 'Decor', spriteX: 1, spriteY: 179 },
  { id: 'moon_flask', name: 'Moon Flask', category: 'Decor', spriteX: 2, spriteY: 179 },
  { id: 'sea_flask', name: 'Sea Flask', category: 'Decor', spriteX: 3, spriteY: 179 },
  { id: 'ember_lantern', name: 'Ember Lantern', category: 'Decor', spriteX: 4, spriteY: 179 },
  { id: 'small_cabinet', name: 'Small Cabinet', category: 'Furniture', spriteX: 0, spriteY: 183 },
  { id: 'round_table', name: 'Round Table', category: 'Furniture', spriteX: 1, spriteY: 183 },
  { id: 'parlor_chair', name: 'Parlor Chair', category: 'Furniture', spriteX: 3, spriteY: 183 },
  { id: 'bench_seat', name: 'Bench Seat', category: 'Furniture', spriteX: 4, spriteY: 183 },
  { id: 'gold_throne', name: 'Gold Throne', category: 'Furniture', spriteX: 5, spriteY: 183 },
  { id: 'wax_candle', name: 'Wax Candle', category: 'Decor', spriteX: 0, spriteY: 184 },
  { id: 'triple_candle', name: 'Triple Candle', category: 'Decor', spriteX: 4, spriteY: 184 },
  { id: 'blue_candelabra', name: 'Blue Candelabra', category: 'Decor', spriteX: 8, spriteY: 184 },
  { id: 'training_dummy', name: 'Training Dummy', category: 'Workshop', spriteX: 0, spriteY: 187 },
  { id: 'spear_stand', name: 'Spear Stand', category: 'Workshop', spriteX: 1, spriteY: 187 },
  { id: 'blue_sword', name: 'Blue Sword', category: 'Workshop', spriteX: 3, spriteY: 187 },
  { id: 'bronze_sword', name: 'Bronze Sword', category: 'Workshop', spriteX: 5, spriteY: 187 },
];

export const placeableAssetsByCategory = PLACEABLE_ASSETS.reduce<Record<AssetCategory, PlaceableAsset[]>>(
  (groups, asset) => {
    groups[asset.category].push(asset);
    return groups;
  },
  {
    Furniture: [],
    Decor: [],
    Workshop: [],
    Nature: [],
    Characters: [],
    Utility: [],
  }
);

export const placeableAssetMap = new Map(PLACEABLE_ASSETS.map((asset) => [asset.id, asset]));
export const humanAssetMap = new Map(HUMAN_ASSETS.map((asset) => [asset.id, asset]));
export const spriteAssetMap = new Map([...PLACEABLE_ASSETS, ...HUMAN_ASSETS].map((asset) => [asset.id, asset]));

export function getRandomHumanAssetId() {
  return HUMAN_ASSETS[Math.floor(Math.random() * HUMAN_ASSETS.length)]?.id ?? HUMAN_ASSETS[0].id;
}
