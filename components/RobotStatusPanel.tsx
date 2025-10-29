import React from 'react';
import type { Robot } from '../types';

interface RobotStatusPanelProps {
  robots: Robot[];
  activeRobotId: string | null;
  isThinking: boolean;
}

const StatusBar: React.FC<{ value: number; color: string; label: string }> = ({ value, color, label }) => (
    <div>
        <div className="text-gray-400 text-xs mb-1">{label}</div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
                className={`${color} h-2.5 rounded-full`}
                style={{width: `${value}%`}}
            ></div>
        </div>
    </div>
);


const RobotStatusPanel: React.FC<RobotStatusPanelProps> = ({ robots, activeRobotId, isThinking }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg space-y-4">
      <h2 className="text-lg text-gray-300 border-b border-gray-700 pb-2">Robot Status</h2>
      {robots.map(robot => (
        <div key={robot.id} className={`${robot.isInactive ? 'opacity-50' : ''}`}>
            <h3 className={`font-bold ${robot.color}`}>
                {robot.name} 
                {robot.isInactive ? ' (Inactive)' : ''}
                {isThinking && robot.id === activeRobotId && <span className="ml-2 animate-pulse">🤔</span>}
            </h3>
            <div className="grid grid-cols-3 gap-2 mt-1">
                <StatusBar value={robot.status.warmth} color="bg-orange-500" label="Warmth" />
                <StatusBar value={robot.status.energy} color="bg-green-500" label="Energy" />
                <StatusBar value={robot.status.hunger} color="bg-yellow-500" label="Hunger" />
            </div>
        </div>
      ))}
    </div>
  );
};

export default RobotStatusPanel;