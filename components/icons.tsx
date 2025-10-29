
import React from 'react';
import { ItemType } from '../types';

interface PixelArtProps {
  pixels: (string | null)[][];
  className?: string;
}

const PixelArt: React.FC<PixelArtProps> = ({ pixels, className = '' }) => {
  const size = pixels.length;
  return (
    <div
      className={`grid w-full h-full ${className}`}
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
      }}
    >
      {pixels.flat().map((color, i) => (
        <div key={i} style={{ backgroundColor: color || 'transparent' }} />
      ))}
    </div>
  );
};

// --- Color Palette ---
const N = null; // Transparent
const GREEN = '#22c55e';
const DARK_GREEN = '#15803d';
const BROWN = '#854d0e';
const DARK_BROWN = '#422006';
const GRAY = '#6b7280';
const DARK_GRAY = '#374151';
const LIGHT_GRAY = '#d1d5db';
const ORANGE = '#f97316';
const YELLOW = '#eab308';
const BLUE = '#3b82f6';
const SOIL = '#713f12';
const SAPLING_GREEN = '#4ade80';
const RED = '#ef4444';
const DARK_RED = '#b91c1c';

// --- Pixel Art Definitions (8x8) ---

const getRobotPixels = (color: string): (string | null)[][] => {
  const C = color;      // Main color
  const S = DARK_GRAY;  // Shade
  const E = LIGHT_GRAY; // Eye
  return [
    [N,N,C,C,C,C,N,N],
    [N,C,S,S,S,S,C,N],
    [C,S,S,S,S,S,S,C],
    [C,S,C,C,C,C,S,C],
    [C,S,E,S,S,E,S,C],
    [C,S,S,S,S,S,S,C],
    [N,C,N,C,C,N,C,N],
    [N,C,N,C,C,N,C,N],
  ];
};

const TREE_PIXELS: (string | null)[][] = [
  [N,N,GREEN,GREEN,GREEN,GREEN,N,N],
  [N,GREEN,GREEN,DARK_GREEN,GREEN,DARK_GREEN,GREEN,N],
  [GREEN,DARK_GREEN,GREEN,GREEN,DARK_GREEN,GREEN,DARK_GREEN,GREEN],
  [GREEN,GREEN,DARK_GREEN,GREEN,GREEN,DARK_GREEN,GREEN,GREEN],
  [N,N,N,BROWN,BROWN,N,N,N],
  [N,N,N,BROWN,BROWN,N,N,N],
  [N,N,N,DARK_BROWN,DARK_BROWN,N,N,N],
  [N,N,N,DARK_BROWN,DARK_BROWN,N,N,N],
];

const AXE_PIXELS: (string | null)[][] = [
  [N,N,N,N,GRAY,LIGHT_GRAY,N,N],
  [N,N,N,GRAY,LIGHT_GRAY,LIGHT_GRAY,N,N],
  [N,N,GRAY,LIGHT_GRAY,BROWN,N,N,N],
  [N,GRAY,LIGHT_GRAY,BROWN,N,N,N,N],
  [GRAY,LIGHT_GRAY,BROWN,N,N,N,N,N],
  [N,BROWN,N,N,N,N,N,N],
  [BROWN,N,N,N,N,N,N,N],
  [N,N,N,N,N,N,N,N],
];

const WOOD_PIXELS: (string | null)[][] = [
  [N,N,N,N,N,N,N,N],
  [N,BROWN,DARK_BROWN,BROWN,BROWN,N,N,N],
  [N,DARK_BROWN,BROWN,BROWN,DARK_BROWN,BROWN,N,N],
  [N,BROWN,BROWN,DARK_BROWN,BROWN,DARK_BROWN,BROWN,N],
  [N,N,BROWN,DARK_BROWN,BROWN,BROWN,N,N],
  [N,N,N,BROWN,DARK_BROWN,N,N,N],
  [N,N,N,N,N,N,N,N],
  [N,N,N,N,N,N,N,N],
];

const FIRE_PIT_PIXELS: (string | null)[][] = [
  [N,N,GRAY,DARK_GRAY,DARK_GRAY,GRAY,N,N],
  [N,GRAY,N,N,N,N,GRAY,N],
  [GRAY,N,N,N,N,N,N,DARK_GRAY],
  [DARK_GRAY,N,N,N,N,N,N,GRAY],
  [DARK_GRAY,N,N,N,N,N,N,GRAY],
  [GRAY,N,N,N,N,N,N,DARK_GRAY],
  [N,GRAY,N,N,N,N,GRAY,N],
  [N,N,GRAY,DARK_GRAY,DARK_GRAY,GRAY,N,N],
];

const FIRE_PIXELS: (string | null)[][] = [
  [N,N,GRAY,DARK_GRAY,DARK_GRAY,GRAY,N,N],
  [N,GRAY,N,YELLOW,ORANGE,N,GRAY,N],
  [GRAY,N,YELLOW,ORANGE,YELLOW,ORANGE,N,DARK_GRAY],
  [DARK_GRAY,N,ORANGE,YELLOW,ORANGE,N,N,GRAY],
  [DARK_GRAY,N,YELLOW,ORANGE,N,ORANGE,N,GRAY],
  [GRAY,N,ORANGE,N,YELLOW,N,N,DARK_GRAY],
  [N,GRAY,N,N,N,N,GRAY,N],
  [N,N,GRAY,DARK_GRAY,DARK_GRAY,GRAY,N,N],
];

const ROCK_PIXELS: (string | null)[][] = [
  [N,N,N,N,N,N,N,N],
  [N,N,N,GRAY,GRAY,N,N,N],
  [N,N,GRAY,DARK_GRAY,GRAY,N,N,N],
  [N,GRAY,DARK_GRAY,GRAY,GRAY,N,N,N],
  [GRAY,DARK_GRAY,GRAY,DARK_GRAY,GRAY,GRAY,N],
  [N,GRAY,DARK_GRAY,GRAY,GRAY,N,N],
  [N,N,N,N,N,N,N,N],
  [N,N,N,N,N,N,N,N],
];

const PICKAXE_PIXELS: (string | null)[][] = [
  [LIGHT_GRAY,GRAY,N,N,N,N,N,N],
  [N,LIGHT_GRAY,BROWN,N,N,N,N,N],
  [N,N,LIGHT_GRAY,BROWN,N,N,N,N],
  [N,N,N,BROWN,LIGHT_GRAY,N,N,N],
  [N,N,N,BROWN,N,LIGHT_GRAY,GRAY,LIGHT_GRAY],
  [N,N,BROWN,N,N,N,N,N],
  [N,BROWN,N,N,N,N,N,N],
  [N,N,N,N,N,N,N,N],
];

const STONE_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,N,LIGHT_GRAY,GRAY,GRAY,N,N,N],
    [N,LIGHT_GRAY,GRAY,DARK_GRAY,GRAY,GRAY,N,N],
    [N,GRAY,DARK_GRAY,GRAY,DARK_GRAY,GRAY,N],
    [N,N,GRAY,GRAY,DARK_GRAY,GRAY,N,N],
    [N,N,N,GRAY,GRAY,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
];

const WALL_PIXELS: (string | null)[][] = [
    [GRAY,GRAY,DARK_GRAY,GRAY,GRAY,GRAY,DARK_GRAY,GRAY],
    [GRAY,GRAY,DARK_GRAY,GRAY,GRAY,GRAY,DARK_GRAY,GRAY],
    [DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY],
    [GRAY,DARK_GRAY,GRAY,GRAY,DARK_GRAY,GRAY,GRAY,DARK_GRAY],
    [GRAY,DARK_GRAY,GRAY,GRAY,DARK_GRAY,GRAY,GRAY,DARK_GRAY],
    [DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY,DARK_GRAY],
    [GRAY,GRAY,DARK_GRAY,GRAY,GRAY,GRAY,DARK_GRAY,GRAY],
    [GRAY,GRAY,DARK_GRAY,GRAY,GRAY,GRAY,DARK_GRAY,GRAY],
];

const WATER_SOURCE_PIXELS: (string | null)[][] = [
  [N,N,BLUE,BLUE,BLUE,BLUE,N,N],
  [N,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,N],
  [BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE],
  [BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE],
  [BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE],
  [BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE],
  [N,BLUE,BLUE,BLUE,BLUE,BLUE,BLUE,N],
  [N,N,BLUE,BLUE,BLUE,BLUE,N,N],
];

const BUCKET_EMPTY_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,GRAY,N,N,N,N,GRAY,N],
    [N,LIGHT_GRAY,GRAY,N,N,GRAY,LIGHT_GRAY,N],
    [N,N,LIGHT_GRAY,GRAY,GRAY,LIGHT_GRAY,N,N],
    [N,N,LIGHT_GRAY,GRAY,GRAY,LIGHT_GRAY,N,N],
    [N,N,N,LIGHT_GRAY,LIGHT_GRAY,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
];

const BUCKET_FULL_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,GRAY,N,N,N,N,GRAY,N],
    [N,LIGHT_GRAY,GRAY,BLUE,BLUE,GRAY,LIGHT_GRAY,N],
    [N,N,LIGHT_GRAY,BLUE,BLUE,LIGHT_GRAY,N,N],
    [N,N,LIGHT_GRAY,GRAY,GRAY,LIGHT_GRAY,N,N],
    [N,N,N,LIGHT_GRAY,LIGHT_GRAY,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
];

const SEED_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,BROWN,N,N,N,N],
    [N,N,BROWN,DARK_BROWN,BROWN,N,N,N],
    [N,N,N,BROWN,N,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
];

const SOIL_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,SOIL,DARK_BROWN,SOIL,N,SOIL,DARK_BROWN,N],
    [SOIL,DARK_BROWN,SOIL,N,SOIL,DARK_BROWN,SOIL,SOIL],
    [N,SOIL,N,SOIL,DARK_BROWN,SOIL,N,SOIL],
    [N,DARK_BROWN,SOIL,DARK_BROWN,N,SOIL,DARK_BROWN,N],
    [SOIL,N,SOIL,DARK_BROWN,SOIL,N,SOIL,DARK_BROWN],
    [DARK_BROWN,SOIL,N,SOIL,N,SOIL,DARK_BROWN,SOIL],
    [N,N,N,N,N,N,N,N],
];

const SAPLING_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,N,N,SAPLING_GREEN,N,N,N,N],
    [N,N,SAPLING_GREEN,SAPLING_GREEN,GREEN,N,N,N],
    [N,N,N,GREEN,N,N,N,N],
    [N,N,N,BROWN,N,N,N,N],
    [N,SOIL,BROWN,BROWN,SOIL,N,N,N],
    [SOIL,DARK_BROWN,SOIL,SOIL,DARK_BROWN,SOIL,N,N],
    [N,N,N,N,N,N,N,N],
];

const BERRY_BUSH_PIXELS: (string | null)[][] = [
    [N,N,GREEN,GREEN,DARK_GREEN,N,N,N],
    [N,GREEN,DARK_GREEN,RED,GREEN,GREEN,N,N],
    [GREEN,RED,GREEN,DARK_GREEN,DARK_RED,GREEN,DARK_GREEN,N],
    [DARK_GREEN,GREEN,DARK_GREEN,GREEN,GREEN,RED,GREEN,N],
    [N,DARK_GREEN,GREEN,RED,DARK_GREEN,GREEN,DARK_GREEN,N],
    [N,N,DARK_GREEN,GREEN,GREEN,DARK_GREEN,N,N],
    [N,N,N,DARK_BROWN,DARK_BROWN,N,N,N],
    [N,N,N,BROWN,BROWN,N,N,N],
];

const BERRIES_PIXELS: (string | null)[][] = [
    [N,N,N,N,N,N,N,N],
    [N,N,N,RED,N,N,N,N],
    [N,N,RED,DARK_RED,N,RED,N,N],
    [N,N,N,RED,DARK_RED,DARK_RED,RED,N],
    [N,N,N,N,RED,DARK_RED,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
    [N,N,N,N,N,N,N,N],
];


interface IconProps {
  type: ItemType;
  className?: string;
}

export const ItemIcon: React.FC<IconProps> = ({ type, className = '' }) => {
  let pixels: (string | null)[][] | null = null;

  switch (type) {
    case ItemType.Robot:
      let hexColor = '#78716c'; // Default gray
      if (className.includes('cyan')) hexColor = '#22d3ee';
      if (className.includes('red')) hexColor = '#f87171';
      pixels = getRobotPixels(hexColor);
      break;
    case ItemType.Tree: pixels = TREE_PIXELS; break;
    case ItemType.Axe: pixels = AXE_PIXELS; break;
    case ItemType.Wood: pixels = WOOD_PIXELS; break;
    case ItemType.FirePit: pixels = FIRE_PIT_PIXELS; break;
    case ItemType.Fire: pixels = FIRE_PIXELS; break;
    case ItemType.Rock: pixels = ROCK_PIXELS; break;
    case ItemType.Pickaxe: pixels = PICKAXE_PIXELS; break;
    case ItemType.Stone: pixels = STONE_PIXELS; break;
    case ItemType.Wall: pixels = WALL_PIXELS; break;
    case ItemType.WaterSource: pixels = WATER_SOURCE_PIXELS; break;
    case ItemType.BucketEmpty: pixels = BUCKET_EMPTY_PIXELS; break;
    case ItemType.BucketFull: pixels = BUCKET_FULL_PIXELS; break;
    case ItemType.Seed: pixels = SEED_PIXELS; break;
    case ItemType.Soil: pixels = SOIL_PIXELS; break;
    case ItemType.Sapling: pixels = SAPLING_PIXELS; break;
    case ItemType.BerryBush: pixels = BERRY_BUSH_PIXELS; break;
    case ItemType.Berries: pixels = BERRIES_PIXELS; break;
    default: return null;
  }
  
  return pixels ? <PixelArt pixels={pixels} /> : null;
};
