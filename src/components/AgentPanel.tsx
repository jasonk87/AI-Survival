import { useGameStore } from '../store';
import { Trash2, Brain } from 'lucide-react';
import { getEntityActions } from '../utils/entityActions';

export function AgentPanel() {
  const { selectedEntity, agents, entities, removeAgent, removeEntity, time } = useGameStore();

  const agent = agents.find((currentAgent) => currentAgent.id === selectedEntity);
  const entity = entities.find((currentEntity) => currentEntity.id === selectedEntity);

  if (!agent && !entity) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 text-slate-400 flex flex-col items-center justify-center text-center">
        <Brain size={48} className="text-slate-700 mb-4" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">AI Agent Sandbox</h3>
        <p className="text-sm mb-4">
          Build the settlement layout, place a few agents, then press Play.
          Trees and rocks spawn into the world automatically for the agents to harvest.
        </p>
        <p className="text-xs text-slate-500">
          Click on an agent or entity to view its details here.
        </p>
      </div>
    );
  }

  if (agent) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 text-white flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: agent.color }}></div>
            <h2 className="text-xl font-bold">{agent.name}</h2>
          </div>
          <button onClick={() => removeAgent(agent.id)} className="text-slate-400 hover:text-rose-400 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Hunger</span>
              <span className={agent.stats.hunger < 30 ? 'text-rose-400' : 'text-emerald-400'}>{Math.round(agent.stats.hunger)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${agent.stats.hunger}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Energy</span>
              <span className={agent.stats.energy < 30 ? 'text-rose-400' : 'text-blue-400'}>{Math.round(agent.stats.energy)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${agent.stats.energy}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Fun</span>
              <span className={agent.stats.fun < 30 ? 'text-rose-400' : 'text-purple-400'}>{Math.round(agent.stats.fun)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${agent.stats.fun}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Status</h3>
          <p className="text-sm font-medium text-indigo-300 capitalize">{agent.currentAction || 'Idle'}</p>
          {agent.speechBubble && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Speaking</h3>
              <p className="text-sm text-slate-200">"{agent.speechBubble}"</p>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Project</h3>
            <p className="text-sm text-slate-300">{agent.currentProject || 'None'}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Inventory</h3>
            <p className="text-sm text-slate-300">Wood {agent.inventory?.wood || 0} | Stone {agent.inventory?.stone || 0} | Axes {agent.inventory?.axes || 0} | Weapons {agent.inventory?.weapons || 0}</p>
          </div>
        </div>

        {agent.memories && agent.memories.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Memories</h3>
            <div className="space-y-2">
              {agent.memories.map((memory, index) => (
                <p key={`${memory}-${index}`} className="text-sm text-slate-300">{memory}</p>
              ))}
            </div>
          </div>
        )}

        {agent.relationships && Object.keys(agent.relationships).length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Relationships</h3>
            <div className="space-y-2">
              {Object.entries(agent.relationships).map(([targetId, relationship]) => (
                <p key={targetId} className="text-sm text-slate-300">
                  {targetId.slice(0, 6)}: trust {relationship.trust}, respect {relationship.respect}
                </p>
              ))}
            </div>
          </div>
        )}

        {agent.obligations && agent.obligations.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Obligations</h3>
            <div className="space-y-2">
              {agent.obligations.map((obligation) => (
                <p key={obligation.id} className="text-sm text-slate-300">
                  {obligation.status === 'open' ? '[Open]' : '[Done]'} {obligation.kind} ({time - obligation.createdAt} ticks): {obligation.note}
                </p>
              ))}
            </div>
          </div>
        )}

        {agent.socialEvents && agent.socialEvents.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Social Events</h3>
            <div className="space-y-2">
              {agent.socialEvents.map((event) => (
                <p key={event.id} className="text-sm text-slate-300">
                  {event.direct ? '[Direct]' : '[Heard]'} {event.type} ({time - event.time} ticks ago): {event.summary}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Traits</h3>
          <div className="flex flex-wrap gap-2">
            {agent.traits.map((trait) => (
              <span key={trait} className="px-2 py-1 bg-slate-700 text-slate-300 rounded-md text-xs">
                {trait}
              </span>
            ))}
          </div>
        </div>

        {agent.lastThought && (
          <div className="bg-slate-800 rounded-xl p-4 border border-indigo-500/30">
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Brain size={14} /> Last Thought
            </h3>
            <p className="text-sm text-slate-300 italic">"{agent.lastThought}"</p>
          </div>
        )}
      </div>
    );
  }

  if (entity) {
    const actions = getEntityActions(entity);
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 text-white flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold capitalize">{entity.name}</h2>
          <button onClick={() => removeEntity(entity.id)} className="text-slate-400 hover:text-rose-400 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-sm text-slate-300">Type: <span className="capitalize font-medium text-white">{entity.type}</span></p>
          <p className="text-sm text-slate-300 mt-2">Position: {entity.x}, {entity.y}</p>
          <p className="text-sm text-slate-300 mt-2">Size: {entity.width}x{entity.height}</p>
          {entity.assetCategory && (
            <p className="text-sm text-slate-300 mt-2">Category: <span className="font-medium text-white">{entity.assetCategory}</span></p>
          )}
          {entity.assetId && (
            <p className="text-sm text-slate-300 mt-2">Asset ID: <span className="font-mono text-white">{entity.assetId}</span></p>
          )}
          {entity.type === 'chest' && (
            <>
              <p className="text-sm text-slate-300 mt-2">Storage: {entity.inventory?.wood || 0} Wood | {entity.inventory?.stone || 0} Stone | {entity.inventory?.axes || 0} Axes | {entity.inventory?.weapons || 0} Weapons</p>
              <p className="text-sm text-slate-300 mt-2">Capacity: {(entity.inventory?.wood || 0) + (entity.inventory?.stone || 0) + (entity.inventory?.axes || 0) + (entity.inventory?.weapons || 0)} / {entity.capacity || 0}</p>
            </>
          )}
        </div>
        {actions.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mt-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Actions</h3>
            <div className="space-y-2">
              {actions.map((action) => (
                <div key={action.label}>
                  <p className="text-sm font-medium text-indigo-300">{action.label}</p>
                  <p className="text-xs text-slate-400">{action.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
