import React from 'react';
import type { WorldState } from '../types';

interface WorldStatusProps {
  worldState: WorldState;
}

const WorldStatus: React.FC<WorldStatusProps> = ({ worldState }) => {
    
  const getTimeIcon = () => {
    switch(worldState.timeOfDay) {
        case 'Dawn': return '🌅';
        case 'Day': return '☀️';
        case 'Dusk': return '🌇';
        case 'Night': return '🌙';
    }
  }

  const getWeatherIcon = () => {
    switch(worldState.weather) {
        case 'Clear': return '☀️';
        case 'Rain': return '🌧️';
        case 'Snow': return '❄️';
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center text-sm text-gray-300">
        <div className="flex items-center gap-3">
            <span className="text-lg" title={worldState.timeOfDay}>{getTimeIcon()}</span>
            <span className="text-lg" title={worldState.weather}>{getWeatherIcon()}</span>
            <span>Day {worldState.day} - {worldState.timeOfDay}</span>
        </div>
        <div className="font-bold text-lg">
           🌡️ {worldState.temperature}°
        </div>
      </div>
       <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
            <div 
                className="bg-yellow-400 h-1.5 rounded-full" 
                style={{width: `${worldState.cycleProgress}%`}}
            ></div>
        </div>
    </div>
  );
};

export default WorldStatus;