
import React from 'react';

interface ControlsProps {
  isSimulating: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  isThinking: boolean;
}

const Controls: React.FC<ControlsProps> = ({ isSimulating, onStart, onStop, onReset, isThinking }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col sm:flex-row gap-4 items-center justify-center">
       <p className="text-gray-400 text-sm hidden md:block">The goal is simple: SURVIVE.</p>
      <div className="flex flex-shrink-0 gap-2">
        {!isSimulating ? (
          <button
            onClick={onStart}
            disabled={isThinking}
            className="px-6 py-2 bg-cyan-600 text-white font-bold rounded-md hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isThinking ? 'Starting...' : 'Start'}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="px-6 py-2 bg-orange-600 text-white font-bold rounded-md hover:bg-orange-500 transition-colors"
          >
            Stop
          </button>
        )}
        <button
          onClick={onReset}
          disabled={isSimulating}
          className="px-6 py-2 bg-red-700 text-white font-bold rounded-md hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default Controls;
