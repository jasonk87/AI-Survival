import React, { useMemo } from 'react';
import { GRID_SIZE, MOVEMENT_SPEED_MS } from '../constants';
import type { EnvironmentState, TimeOfDay, WeatherType } from '../types';
import { ItemIcon } from './icons';

interface WeatherOverlayProps {
  weather: WeatherType;
}

const WeatherOverlay: React.FC<WeatherOverlayProps> = ({ weather }) => {
  const snowflakes = useMemo(() => {
    if (weather !== 'Snow') return [];
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${5 + Math.random() * 5}s`,
      animationDelay: `${Math.random() * 5}s`,
      opacity: 0.5 + Math.random() * 0.5,
      transform: `scale(${0.5 + Math.random() * 0.5})`,
    }));
  }, [weather]);

  if (weather === 'Clear') return null;

  return (
    <>
      {weather === 'Rain' && <div className="rain" />}
      {weather === 'Snow' && (
        <div className="snow">
          {snowflakes.map(flake => (
            <div
              key={flake.id}
              className="snowflake"
              style={{
                left: flake.left,
                animationDuration: flake.animationDuration,
                animationDelay: flake.animationDelay,
                opacity: flake.opacity,
                transform: flake.transform,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};

interface SandboxProps {
  environment: EnvironmentState;
  activeRobotId: string | null;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
}

const Sandbox: React.FC<SandboxProps> = ({ environment, activeRobotId, timeOfDay, weather }) => {
  const { robots, items } = environment;
  
  const getNightOverlayOpacity = () => {
    switch(timeOfDay) {
      case 'Day': return 0;
      case 'Dusk': return 0.3;
      case 'Night': return 0.6;
      case 'Dawn': return 0.3;
      default: return 0;
    }
  };

  return (
    <div className="bg-green-800 p-4 rounded-lg shadow-lg aspect-square relative overflow-hidden" style={{
      backgroundImage: `
        linear-gradient(rgba(16, 111, 32, 0.5) 1px, transparent 1px),
        linear-gradient(90deg, rgba(16, 111, 32, 0.5) 1px, transparent 1px)
      `,
      backgroundSize: `calc(100% / ${GRID_SIZE}) calc(100% / ${GRID_SIZE})`
    }}>
      <WeatherOverlay weather={weather} />
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
          const x = index % GRID_SIZE;
          const y = Math.floor(index / GRID_SIZE);
          const itemsOnSquare = items.filter(i => i.position.x === x && i.position.y === y);
          return (
            <div
              key={`${x}-${y}`}
              className="aspect-square"
            >
              {itemsOnSquare.length > 0 && (
                <div className={`grid p-0.5 gap-px w-full h-full ${itemsOnSquare.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {itemsOnSquare.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-center min-w-0 min-h-0">
                          <ItemIcon type={item.type} />
                      </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="absolute top-4 left-4 right-4 bottom-4 pointer-events-none">
         {robots.map((robot) => {
            const isActive = robot.id === activeRobotId;
            return (
                 <div
                    key={robot.id}
                    className="absolute p-1"
                    style={{
                      width: `calc(100% / ${GRID_SIZE})`,
                      height: `calc(100% / ${GRID_SIZE})`,
                      transform: `translate(${robot.position.x * 100}%, ${robot.position.y * 100}%)`,
                      transition: `transform ${MOVEMENT_SPEED_MS}ms linear`,
                      zIndex: 10,
                    }}
                 >
                    <div className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${robot.isInactive ? 'opacity-50' : ''}`}>
                      {isActive && !robot.isInactive && (
                        <div className={`absolute -inset-0.5 border-2 ${robot.color.replace('text-', 'border-')} opacity-75 animate-pulse`}></div>
                      )}
                      <ItemIcon type={robot.type} className={`${robot.color} z-10`} />
                      {robot.inventory && (
                         <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 w-1/2 h-1/2 bg-gray-900 bg-opacity-50 p-0.5 border border-gray-600">
                           <ItemIcon type={robot.inventory} />
                         </div>
                      )}
                    </div>
                </div>
            )
         })}
      </div>
       <div 
        className="absolute inset-0 bg-blue-900 pointer-events-none transition-opacity duration-1000"
        style={{
          opacity: getNightOverlayOpacity(),
          mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};

export default Sandbox;