import { useGameStore } from '../store';
import { MousePointer2, Square, Grid, Bed, Monitor, Sofa, User, Play, Pause, DoorClosed, Tractor, Leaf, Package } from 'lucide-react';
import { assetSpriteSheetUrl, ASSET_TILE_SIZE, placeableAssetsByCategory } from '../assets/catalog';

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'grass', icon: Grid, label: 'Grass' },
  { id: 'floor', icon: Square, label: 'Floor' },
  { id: 'wall', icon: Square, label: 'Wall', fill: true },
  { id: 'door', icon: DoorClosed, label: 'Door' },
  { id: 'bed', icon: Bed, label: 'Bed' },
  { id: 'chest', icon: Package, label: 'Chest' },
  { id: 'workstation', icon: Monitor, label: 'Workstation' },
  { id: 'chair', icon: Sofa, label: 'Chair' },
  { id: 'plant', icon: Leaf, label: 'Plant' },
  { id: 'farm', icon: Tractor, label: 'Farm' },
  { id: 'agent', icon: User, label: 'Agent' },
];

export function Sidebar() {
  const { selectedTool, setSelectedTool, isSimulating, toggleSimulation } = useGameStore();

  return (
    <div className="w-72 bg-slate-800 text-white p-4 flex flex-col h-full border-r border-slate-700">
      <h2 className="text-xl font-bold mb-6 text-indigo-400">Tools</h2>

      <div className="flex-1 overflow-y-auto pr-2 mb-4 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Core</h3>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isSelected = selectedTool === tool.id || (tool.id === 'select' && selectedTool === null);
              return (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id === 'select' ? null : tool.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  <Icon size={24} className="mb-1" fill={tool.fill ? 'currentColor' : 'none'} />
                  <span className="text-xs font-medium">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {Object.entries(placeableAssetsByCategory).map(([category, assets]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">{category}</h3>
            <div className="grid grid-cols-2 gap-2">
              {assets.map((asset) => {
                const toolId = `asset:${asset.id}`;
                const isSelected = selectedTool === toolId;
                return (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedTool(toolId)}
                    className={`flex items-center gap-2 p-2 rounded-xl transition-colors text-left ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    <span
                      className="h-8 w-8 shrink-0 rounded border border-slate-500/50 bg-no-repeat"
                      style={{
                        backgroundImage: `url(${assetSpriteSheetUrl})`,
                        backgroundSize: `${16 * ASSET_TILE_SIZE * 2}px auto`,
                        backgroundPosition: `-${asset.spriteX * ASSET_TILE_SIZE * 2}px -${asset.spriteY * ASSET_TILE_SIZE * 2}px`,
                        imageRendering: 'pixelated',
                      }}
                    />
                    <span className="text-xs font-medium leading-tight">{asset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-700">
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Simulation</h3>
        <div className="flex gap-2">
          <button
            onClick={toggleSimulation}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
              isSimulating ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isSimulating ? <Pause size={20} /> : <Play size={20} />}
            {isSimulating ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    </div>
  );
}
