import { useGameStore } from '../store';
import { Save, FolderOpen, Trash2 } from 'lucide-react';

export function TopBar() {
  const { saveEnvironment, loadEnvironment, savedEnvironments, clearState, time } = useGameStore();

  const handleSave = () => {
    const name = prompt('Enter a name for this environment:');
    if (name) {
      saveEnvironment(name);
    }
  };

  const handleLoad = () => {
    if (savedEnvironments.length === 0) {
      alert('No saved environments.');
      return;
    }
    const names = savedEnvironments.map(e => e.name).join('\n');
    const name = prompt(`Enter the name of the environment to load:\n${names}`);
    if (name) {
      loadEnvironment(name);
    }
  };

  return (
    <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 text-white">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          AI Agent Sandbox
        </h1>
        <div className="h-4 w-px bg-slate-700 mx-2"></div>
        <span className="text-sm text-slate-400 font-mono">Time: {time}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Save size={16} /> Save
        </button>
        <button
          onClick={handleLoad}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <FolderOpen size={16} /> Load
        </button>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to clear the environment?')) {
              clearState();
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-lg transition-colors"
        >
          <Trash2 size={16} /> Clear
        </button>
      </div>
    </div>
  );
}
