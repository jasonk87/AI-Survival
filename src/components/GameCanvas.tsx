import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, TileType } from '../store';
import { ASSET_TILE_SIZE, assetSpriteSheetUrl, CORE_ENTITY_ASSETS, getRandomHumanAssetId, humanAssetMap, placeableAssetMap, spriteAssetMap } from '../assets/catalog';

const TILE_SIZE = 32;

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteSheetRef = useRef<HTMLImageElement | null>(null);
  const {
    gridWidth,
    gridHeight,
    tiles,
    entities,
    agents,
    selectedTool,
    setTile,
    addEntity,
    addAgent,
    setSelectedEntity,
    selectedEntity,
  } = useGameStore();

  const [isDragging, setIsDragging] = useState(false);
  const [spriteSheetReady, setSpriteSheetReady] = useState(false);

  const drawAtlasTile = (
    ctx: CanvasRenderingContext2D,
    spriteX: number,
    spriteY: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) => {
    const spriteSheet = spriteSheetRef.current;
    if (!spriteSheet) return false;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      spriteSheet,
      spriteX * ASSET_TILE_SIZE,
      spriteY * ASSET_TILE_SIZE,
      ASSET_TILE_SIZE,
      ASSET_TILE_SIZE,
      dx,
      dy,
      dw,
      dh
    );
    return true;
  };

  useEffect(() => {
    const image = new Image();
    image.src = assetSpriteSheetUrl;
    image.onload = () => {
      spriteSheetRef.current = image;
      setSpriteSheetReady(true);
    };
    image.onerror = () => {
      setSpriteSheetReady(false);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = tiles[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (tile === 'grass') {
          ctx.fillStyle = '#6da34d';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#7fbe57';
          ctx.fillRect(px + 3, py + 4, 5, 5);
          ctx.fillRect(px + 19, py + 8, 4, 4);
          ctx.fillRect(px + 12, py + 21, 3, 3);
        } else if (tile === 'floor') {
          ctx.fillStyle = '#9a7b58';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(68, 45, 27, 0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py + TILE_SIZE / 2);
          ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE / 2);
          ctx.moveTo(px + TILE_SIZE / 2, py);
          ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE);
          ctx.stroke();
        } else if (tile === 'wall') {
          ctx.fillStyle = '#5e6472';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#474c59';
          ctx.fillRect(px, py + 20, TILE_SIZE, 4);
          ctx.fillRect(px + 12, py, 4, TILE_SIZE);
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (tile === 'door') {
          ctx.fillStyle = '#7b4f2f';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#9c6644';
          ctx.fillRect(px + 4, py + 3, TILE_SIZE - 8, TILE_SIZE - 6);
          ctx.fillStyle = '#d4af37';
          ctx.beginPath();
          ctx.arc(px + TILE_SIZE - 8, py + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    entities.forEach((entity) => {
      const px = entity.x * TILE_SIZE;
      const py = entity.y * TILE_SIZE;
      const w = entity.width * TILE_SIZE;
      const h = entity.height * TILE_SIZE;

      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(px + w / 2, py + h - 4, Math.max(6, w / 2 - 4), Math.max(3, h / 4), 0, 0, Math.PI * 2);
      ctx.fill();

      const assetId =
        entity.type === 'asset'
          ? entity.assetId
          : entity.assetId || (entity.type in CORE_ENTITY_ASSETS ? CORE_ENTITY_ASSETS[entity.type as keyof typeof CORE_ENTITY_ASSETS].id : undefined);

      if (assetId && spriteSheetRef.current) {
        const asset = spriteAssetMap.get(assetId);
        if (asset) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            spriteSheetRef.current,
            asset.spriteX * ASSET_TILE_SIZE,
            asset.spriteY * ASSET_TILE_SIZE,
            (asset.width || 1) * ASSET_TILE_SIZE,
            (asset.height || 1) * ASSET_TILE_SIZE,
            px,
            py,
            w,
            h
          );
        }
      }

      if (selectedEntity === entity.id) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, w, h);
        ctx.lineWidth = 1;
      }
    });

    agents.forEach((agent) => {
      const cx = agent.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = agent.y * TILE_SIZE + TILE_SIZE / 2;

      if (agent.path && agent.path.length > 0) {
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        agent.path.forEach((p) => {
          ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const humanAsset = (agent.assetId ? humanAssetMap.get(agent.assetId) : undefined) || humanAssetMap.values().next().value;
      if (humanAsset && spriteSheetRef.current) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          spriteSheetRef.current,
          humanAsset.spriteX * ASSET_TILE_SIZE,
          humanAsset.spriteY * ASSET_TILE_SIZE,
          ASSET_TILE_SIZE,
          ASSET_TILE_SIZE,
          cx - TILE_SIZE / 2,
          cy - TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE
        );
      } else {
        ctx.fillStyle = agent.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(cx - 24, cy - 24, 48, 12);
      ctx.fillStyle = 'white';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(agent.name, cx, cy - 18);

      if (agent.speechBubble) {
        const bubbleText = agent.speechBubble.length > 48 ? `${agent.speechBubble.slice(0, 45)}...` : agent.speechBubble;
        ctx.font = '10px sans-serif';
        const metrics = ctx.measureText(bubbleText);
        const bubbleWidth = Math.min(180, metrics.width + 14);
        const bubbleHeight = 22;
        const bubbleX = cx - bubbleWidth / 2;
        const bubbleY = cy - 56;

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(15,23,42,0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - 5, bubbleY + bubbleHeight);
        ctx.lineTo(cx, bubbleY + bubbleHeight + 7);
        ctx.lineTo(cx + 5, bubbleY + bubbleHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillText(bubbleText, cx, bubbleY + bubbleHeight / 2 + 1);
      }

      if (selectedEntity === agent.id) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    });
  }, [tiles, entities, agents, gridWidth, gridHeight, selectedEntity, spriteSheetReady]);

  const handleInteract = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    if (selectedTool === 'grass' || selectedTool === 'floor' || selectedTool === 'wall' || selectedTool === 'door') {
      setTile(x, y, selectedTool as TileType);
    } else if (selectedTool === 'bed') {
      addEntity({ type: 'bed', x, y, width: 2, height: 2, name: CORE_ENTITY_ASSETS.bed.name, assetId: CORE_ENTITY_ASSETS.bed.id, assetCategory: CORE_ENTITY_ASSETS.bed.category });
    } else if (selectedTool === 'chest') {
      addEntity({ type: 'chest', x, y, width: 1, height: 1, name: CORE_ENTITY_ASSETS.chest.name, assetId: CORE_ENTITY_ASSETS.chest.id, assetCategory: CORE_ENTITY_ASSETS.chest.category, inventory: { wood: 0, stone: 0, axes: 0, weapons: 0 }, capacity: 12 });
    } else if (selectedTool === 'workstation') {
      addEntity({ type: 'workstation', x, y, width: 2, height: 1, name: CORE_ENTITY_ASSETS.workstation.name, assetId: CORE_ENTITY_ASSETS.workstation.id, assetCategory: CORE_ENTITY_ASSETS.workstation.category });
    } else if (selectedTool === 'food') {
      addEntity({ type: 'food', x, y, width: 1, height: 1, name: CORE_ENTITY_ASSETS.food.name, assetId: CORE_ENTITY_ASSETS.food.id, assetCategory: CORE_ENTITY_ASSETS.food.category });
    } else if (selectedTool === 'chair') {
      addEntity({ type: 'chair', x, y, width: 1, height: 1, name: CORE_ENTITY_ASSETS.chair.name, assetId: CORE_ENTITY_ASSETS.chair.id, assetCategory: CORE_ENTITY_ASSETS.chair.category });
    } else if (selectedTool === 'plant') {
      addEntity({ type: 'plant', x, y, width: 1, height: 1, name: CORE_ENTITY_ASSETS.plant.name, assetId: CORE_ENTITY_ASSETS.plant.id, assetCategory: CORE_ENTITY_ASSETS.plant.category });
    } else if (selectedTool === 'tree') {
      addEntity({ type: 'tree', x, y, width: 1, height: 1, name: CORE_ENTITY_ASSETS.tree.name, assetId: CORE_ENTITY_ASSETS.tree.id, assetCategory: CORE_ENTITY_ASSETS.tree.category });
    } else if (selectedTool === 'rock') {
      addEntity({ type: 'rock', x, y, width: 1, height: 1, name: CORE_ENTITY_ASSETS.rock.name, assetId: CORE_ENTITY_ASSETS.rock.id, assetCategory: CORE_ENTITY_ASSETS.rock.category });
    } else if (selectedTool === 'farm') {
      addEntity({ type: 'farm', x, y, width: 2, height: 2, name: CORE_ENTITY_ASSETS.farm.name, assetId: CORE_ENTITY_ASSETS.farm.id, assetCategory: CORE_ENTITY_ASSETS.farm.category });
    } else if (selectedTool?.startsWith('asset:')) {
      const assetId = selectedTool.replace('asset:', '');
      const asset = placeableAssetMap.get(assetId);
      if (asset) {
        addEntity({
          type: 'asset',
          assetId: asset.id,
          assetCategory: asset.category,
          x,
          y,
          width: asset.width || 1,
          height: asset.height || 1,
          name: asset.name
        });
      }
    } else if (selectedTool === 'agent') {
      const possibleTraits = ['Hardworker', 'Lazy', 'Gourmand', 'Night Owl', 'Fast Walker', 'Slow Pokes', 'Optimist', 'Pessimist'];
      const randomTraits = [];
      for (let i = 0; i < 2; i++) {
        randomTraits.push(possibleTraits[Math.floor(Math.random() * possibleTraits.length)]);
      }
      addAgent({
        name: `Agent ${agents.length + 1}`,
        x,
        y,
        color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
        assetId: getRandomHumanAssetId(),
        stats: { hunger: 100, energy: 100, fun: 100 },
        traits: [...new Set(randomTraits)],
        currentAction: 'idle',
        targetX: null,
        targetY: null,
        path: null,
        lastThought: null,
        inventory: { wood: 0, stone: 0, axes: 0, weapons: 0 },
        currentProject: null,
        targetAgentId: null,
        memories: [],
        relationships: {},
        obligations: [],
        socialEvents: [],
        speechBubble: null,
        speechUntil: null,
        socialCooldownUntil: null,
        talkingSince: null
      });
    } else if (selectedTool === null) {
      const clickedAgent = agents.find((a) => a.x === x && a.y === y);
      if (clickedAgent) {
        setSelectedEntity(clickedAgent.id);
        return;
      }
      const clickedEntity = entities.find((entity) => x >= entity.x && x < entity.x + entity.width && y >= entity.y && y < entity.y + entity.height);
      if (clickedEntity) {
        setSelectedEntity(clickedEntity.id);
        return;
      }
      setSelectedEntity(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-8 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={gridWidth * TILE_SIZE}
        height={gridHeight * TILE_SIZE}
        className="bg-slate-600 shadow-2xl cursor-crosshair rounded-lg"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleInteract(e);
        }}
        onMouseMove={(e) => {
          if (isDragging && (selectedTool === 'grass' || selectedTool === 'floor' || selectedTool === 'wall' || selectedTool === 'door')) {
            handleInteract(e);
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      />
    </div>
  );
}
