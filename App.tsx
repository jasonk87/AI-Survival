import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sandbox from './components/Sandbox';
import LogPanel from './components/LogPanel';
import Controls from './components/Controls';
import WorldStatus from './components/WorldStatus';
import RobotStatusPanel from './components/RobotStatusPanel';
import { getRobotNextAction } from './services/geminiService';
import { GRID_SIZE, INITIAL_ENV_STATE, SIMULATION_SPEED_MS, MOVEMENT_SPEED_MS, IMPASSABLE_ITEM_TYPES, DAY_CYCLE_MS } from './constants';
import type { EnvironmentState, LogEntry, Robot, RobotAction, EnvironmentItem, WorldState, TimeOfDay, WeatherType } from './types';
import { ActionType, ItemType, WeatherType as WeatherEnum } from './types';
import { findPath, findReachableAdjacentPosition } from './utils/pathfinding';

const App: React.FC = () => {
  const [environment, setEnvironment] = useState<EnvironmentState>(INITIAL_ENV_STATE);
  const [worldState, setWorldState] = useState<WorldState>({ day: 1, timeOfDay: 'Day', cycleProgress: 25, temperature: 20, weather: WeatherEnum.Clear });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [activeRobotIndex, setActiveRobotIndex] = useState<number>(0);
  const logIdCounter = useRef(0);

  const addLog = useCallback((robotName: string, robotColor: string, message: string, type: LogEntry['type']) => {
    setLogs(prev => [...prev.slice(-100), { id: logIdCounter.current++, robotName, robotColor, message, type }]);
  }, []);

  const handleReset = useCallback(() => {
    setEnvironment(JSON.parse(JSON.stringify(INITIAL_ENV_STATE)));
    setWorldState({ day: 1, timeOfDay: 'Day', cycleProgress: 25, temperature: 20, weather: WeatherEnum.Clear });
    setLogs([]);
    setActiveRobotIndex(0);
    setIsSimulating(false);
  }, []);

  const processAction = useCallback((robot: Robot, action: RobotAction) => {
    if (action.thought) {
      addLog(robot.name, robot.color, `Thought: ${action.thought}`, 'ACTION');
    }
    
    setEnvironment(prevEnv => {
      let newEnv: EnvironmentState = JSON.parse(JSON.stringify(prevEnv));
      const robotInState = newEnv.robots.find((r: Robot) => r.id === robot.id);
      if (!robotInState) return newEnv;
      
      robotInState.currentAction = action.action;

      // An inactive robot can only try to rest
      if (robotInState.isInactive && action.action !== ActionType.IDLE) {
          addLog(robot.name, robot.color, `Is inactive and cannot perform ${action.action}. Trying to rest.`, 'STATUS');
          action.action = ActionType.IDLE;
          robotInState.currentAction = ActionType.IDLE;
      }

      switch (action.action) {
        case ActionType.GOTO: {
            const { targetPosition } = action.payload;
            if (!targetPosition) break;

            let finalTarget = targetPosition;
            let isTargetAdjusted = false;

            const targetItem = newEnv.items.find(
                (i: EnvironmentItem) => i.position.x === targetPosition.x && i.position.y === targetPosition.y
            );
            const isTargetImpassableItem = targetItem && IMPASSABLE_ITEM_TYPES.includes(targetItem.type);
            const isTargetOccupiedByOtherRobot = newEnv.robots.some(
                (r: Robot) => r.id !== robot.id && r.position.x === targetPosition.x && r.position.y === targetPosition.y
            );

            if (isTargetImpassableItem || isTargetOccupiedByOtherRobot) {
                const reachableAdjacent = findReachableAdjacentPosition(targetPosition, robot.position, newEnv);
                if (reachableAdjacent) {
                    finalTarget = reachableAdjacent;
                    isTargetAdjusted = true;
                } else {
                     addLog(robot.name, robot.color, `Cannot go to (${targetPosition.x}, ${targetPosition.y}), it's blocked.`, 'ACTION');
                     break;
                }
            }

            const path = findPath(robot.position, finalTarget, newEnv);
            if (path) { 
                if (path.length > 0) {
                    robotInState.path = path;
                    const viaMessage = isTargetAdjusted ? ` via (${finalTarget.x}, ${finalTarget.y})` : '';
                    addLog(robot.name, robot.color, `Moving towards (${targetPosition.x}, ${targetPosition.y})${viaMessage}.`, 'ACTION');
                }
            } else { 
                addLog(robot.name, robot.color, `Couldn't find a path to (${finalTarget.x}, ${finalTarget.y}).`, 'ACTION');
            }
            break;
        }
        case ActionType.MOVE: {
          const { direction } = action.payload;
          let { x, y } = robot.position;
          if (direction === 'UP') y = Math.max(0, y - 1);
          if (direction === 'DOWN') y = Math.min(GRID_SIZE - 1, y + 1);
          if (direction === 'LEFT') x = Math.max(0, x - 1);
          if (direction === 'RIGHT') x = Math.min(GRID_SIZE - 1, x + 1);
          
          const robotAtTarget = newEnv.robots.find((r: Robot) => r.id !== robot.id && r.position.x === x && r.position.y === y);
          const impassableItemAtTarget = newEnv.items.find((i: EnvironmentItem) => i.position.x === x && i.position.y === y && IMPASSABLE_ITEM_TYPES.includes(i.type));
          const isOccupied = !!robotAtTarget || !!impassableItemAtTarget;

          if (!isOccupied) {
            robotInState.position = { x, y };
            addLog(robot.name, robot.color, `Moved ${direction}.`, 'ACTION');
          } else {
             addLog(robot.name, robot.color, `Tried to move ${direction}, but it was blocked.`, 'ACTION');
          }
          break;
        }
        case ActionType.TALK:
          addLog(robot.name, robot.color, action.payload.message || '...', 'COMMUNICATION');
          break;
        case ActionType.PICKUP: {
          const targetId = action.payload.targetId;
          const itemIndex = newEnv.items.findIndex((i: EnvironmentItem) => i.id === targetId && i.position.x === robot.position.x && i.position.y === robot.position.y);
          if (itemIndex > -1) {
            if (!robotInState.inventory) {
              const [itemToPickup] = newEnv.items.splice(itemIndex, 1);
              robotInState.inventory = itemToPickup.type;
              addLog(robot.name, robot.color, `Picked up ${itemToPickup.type}.`, 'ACTION');
            } else {
              addLog(robot.name, robot.color, `Failed to pick up ${newEnv.items[itemIndex].type}, inventory full.`, 'ACTION');
            }
          }
          break;
        }
        case ActionType.USE: {
          const targetId = action.payload.targetId;
          const target = newEnv.items.find((i: EnvironmentItem) => i.id === targetId);
          if (target) {
            const dx = Math.abs(robot.position.x - target.position.x);
            const dy = Math.abs(robot.position.y - target.position.y);
            const isAdjacent = dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);

            if (isAdjacent) {
                const heldItem = robotInState.inventory;
                if (heldItem === ItemType.Axe && target.type === ItemType.Tree) {
                    newEnv.items = newEnv.items.filter(i => i.id !== target.id);
                    newEnv.items.push({ id: `wood-${Date.now()}`, type: ItemType.Wood, position: target.position });
                    newEnv.items.push({ id: `seed-${Date.now()}`, type: ItemType.Seed, position: target.position });
                    addLog(robot.name, robot.color, `Chopped down the tree.`, 'ACTION');
                } else if (heldItem === ItemType.Pickaxe && target.type === ItemType.Rock) {
                    newEnv.items = newEnv.items.filter(i => i.id !== target.id);
                    newEnv.items.push({ id: `stone-${Date.now()}`, type: ItemType.Stone, position: target.position });
                    addLog(robot.name, robot.color, `Mined the rock.`, 'ACTION');
                } else if (heldItem === ItemType.Wood && target.type === ItemType.FirePit) {
                    target.type = ItemType.Fire;
                    robotInState.inventory = null;
                    addLog(robot.name, robot.color, `Used wood to start a fire.`, 'ACTION');
                } else if (heldItem === ItemType.BucketEmpty && target.type === ItemType.WaterSource) {
                    robotInState.inventory = ItemType.BucketFull;
                    addLog(robot.name, robot.color, `Filled the bucket.`, 'ACTION');
                } else if (heldItem === ItemType.BucketFull && target.type === ItemType.Fire) {
                    target.type = ItemType.FirePit;
                    robotInState.inventory = ItemType.BucketEmpty;
                    addLog(robot.name, robot.color, `Doused the fire.`, 'ACTION');
                } else if (heldItem === ItemType.BucketFull && target.type === ItemType.Sapling) {
                    target.type = ItemType.Tree;
                    robotInState.inventory = ItemType.BucketEmpty;
                    addLog(robot.name, robot.color, `Watered the sapling. It grew into a tree!`, 'ACTION');
                } else if (heldItem === ItemType.Seed && target.type === ItemType.Soil) {
                    target.type = ItemType.Sapling;
                    robotInState.inventory = null;
                    addLog(robot.name, robot.color, `Planted a seed.`, 'ACTION');
                } else if (heldItem === ItemType.Stone && target.type === ItemType.Stone) {
                    newEnv.items = newEnv.items.filter(i => i.id !== target.id);
                    newEnv.items.push({ id: `wall-${Date.now()}`, type: ItemType.Wall, position: target.position });
                    robotInState.inventory = null;
                    addLog(robot.name, robot.color, `Built a wall segment.`, 'ACTION');
                } else if (!heldItem && target.type === ItemType.BerryBush) {
                     newEnv.items = newEnv.items.filter(i => i.id !== target.id);
                     robotInState.inventory = ItemType.Berries;
                     addLog(robot.name, robot.color, 'Picked some berries.', 'ACTION');
                } else {
                  addLog(robot.name, robot.color, `Tried to use ${heldItem || 'hands'} on ${target.type}, but it did nothing.`, 'ACTION');
                }
            } else {
              addLog(robot.name, robot.color, `Tried to use an item on ${target.type}, but was too far away.`, 'ACTION');
            }
          }
          break;
        }
        case ActionType.EAT: {
          if (robotInState.inventory === ItemType.Berries) {
            robotInState.inventory = null;
            robotInState.status.hunger = Math.min(100, robotInState.status.hunger + 50);
            addLog(robot.name, robot.color, `Ate the berries.`, 'ACTION');
          } else {
            addLog(robot.name, robot.color, `Tried to eat, but has no food.`, 'ACTION');
          }
          break;
        }
        case ActionType.DROP: {
          if (robotInState.inventory) {
            const itemToDrop = robotInState.inventory;
            newEnv.items.push({
              id: `${itemToDrop.toLowerCase()}-${Date.now()}`,
              type: itemToDrop,
              position: robotInState.position,
            });
            robotInState.inventory = null;
            addLog(robot.name, robot.color, `Dropped ${itemToDrop}.`, 'ACTION');
          }
          break;
        }
        case ActionType.IDLE:
          addLog(robot.name, robot.color, 'Is resting.', 'ACTION');
          break;
        default:
          addLog(robot.name, robot.color, `Attempted an unknown action: ${action.action}`, 'SYSTEM');
          break;
      }
      return newEnv;
    });
  }, [addLog]);

  const runSimulationTurn = useCallback(async () => {
    if (!isSimulating) return;

    const currentRobot = environment.robots[activeRobotIndex];
    
    if (currentRobot.path && currentRobot.path.length > 0) {
      setActiveRobotIndex((prevIndex) => (prevIndex + 1) % environment.robots.length);
      return;
    }

    setIsThinking(true);
    
    const action = await getRobotNextAction(currentRobot, environment, worldState, logs);
    
    if (action) {
      processAction(currentRobot, action);
    } else {
      addLog(currentRobot.name, currentRobot.color, 'Could not decide on an action.', 'SYSTEM');
    }
    
    setIsThinking(false);
    setActiveRobotIndex((prevIndex) => (prevIndex + 1) % environment.robots.length);

  }, [isSimulating, activeRobotIndex, environment, worldState, logs, processAction, addLog]);
  
  const handleMovement = useCallback(() => {
    setEnvironment(prevEnv => {
        let hasChanges = false;
        const newRobots = prevEnv.robots.map(robot => {
            if (robot.path && robot.path.length > 0) {
                hasChanges = true;
                const newPath = [...robot.path];
                const nextPosition = newPath.shift();
                if (newPath.length === 0) {
                    addLog(robot.name, robot.color, `Arrived at destination.`, 'ACTION');
                }
                return { ...robot, position: nextPosition!, path: newPath.length > 0 ? newPath : undefined };
            }
            return robot;
        });

        if (hasChanges) {
            return { ...prevEnv, robots: newRobots };
        }
        return prevEnv;
    });
  }, [addLog]);
  
  const simulationTick = useCallback(() => {
    setWorldState(prevWorld => {
      // --- Update World State ---
      const progress = prevWorld.cycleProgress + (100 * 1000) / DAY_CYCLE_MS;
      let newDay = prevWorld.day;
      let newProgress = progress;
      if (progress >= 100) {
        newProgress = 0;
        newDay += 1;
      }

      const oldTimeOfDay = prevWorld.timeOfDay;
      let newTimeOfDay: TimeOfDay = 'Day';
      if (newProgress > 90 || newProgress < 10) newTimeOfDay = 'Night';
      else if (newProgress > 75) newTimeOfDay = 'Dusk';
      else if (newProgress < 25) newTimeOfDay = 'Dawn';

      let newWeather = prevWorld.weather;
      if ((oldTimeOfDay === 'Night' && newTimeOfDay === 'Dawn') || (oldTimeOfDay === 'Day' && newTimeOfDay === 'Dusk')) {
        const weatherOptions = [WeatherEnum.Clear, WeatherEnum.Clear, WeatherEnum.Clear, WeatherEnum.Rain, WeatherEnum.Snow];
        newWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
        addLog('System', '', `The weather has changed to ${newWeather}.`, 'SYSTEM');
      }

      const tempFluctuation = Math.sin((newProgress / 100) * 2 * Math.PI - Math.PI / 2);
      let baseTemperature = 10 + 15 * (tempFluctuation + 1) / 2;
      if (newWeather === WeatherEnum.Rain) baseTemperature -= 5;
      if (newWeather === WeatherEnum.Snow) baseTemperature -= 10;

      const newWorldState: WorldState = { day: newDay, cycleProgress: newProgress, timeOfDay: newTimeOfDay, temperature: Math.round(baseTemperature), weather: newWeather };
      
      // --- Update Environment and Robot Needs based on new World State ---
      setEnvironment(prevEnv => {
        const newEnv = JSON.parse(JSON.stringify(prevEnv));
        const fires = newEnv.items.filter((i: EnvironmentItem) => i.type === ItemType.Fire);

        if (newWorldState.weather === WeatherEnum.Rain) {
          fires.forEach((fire: EnvironmentItem) => {
            if (Math.random() < 0.25) {
              const fireToUpdate = newEnv.items.find((i: EnvironmentItem) => i.id === fire.id);
              if (fireToUpdate) fireToUpdate.type = ItemType.FirePit;
              addLog('System', '', `The rain has doused a fire at (${fire.position.x}, ${fire.position.y}).`, 'SYSTEM');
            }
          });
          const saplings = newEnv.items.filter((i: EnvironmentItem) => i.type === ItemType.Sapling);
          saplings.forEach((sapling: EnvironmentItem) => {
            if (Math.random() < 0.1) {
              const saplingToUpdate = newEnv.items.find((i: EnvironmentItem) => i.id === sapling.id);
              if (saplingToUpdate) saplingToUpdate.type = ItemType.Tree;
              addLog('System', '', `A sapling at (${sapling.position.x}, ${sapling.position.y}) grew into a tree in the rain.`, 'SYSTEM');
            }
          });
        }

        const newRobots = newEnv.robots.map((r: Robot) => {
          const isNearFire = fires.some(f => Math.abs(r.position.x - f.position.x) <= 1 && Math.abs(r.position.y - f.position.y) <= 1);
          let { warmth, energy, hunger } = r.status;

          if (isNearFire) {
            warmth = Math.min(100, warmth + 10);
          } else {
            if (newWorldState.timeOfDay === 'Night') warmth = Math.max(0, warmth - 5);
            else if (newWorldState.timeOfDay === 'Dusk' || newWorldState.timeOfDay === 'Dawn') warmth = Math.max(0, warmth - 2);
            if (newWorldState.weather === WeatherEnum.Rain) warmth = Math.max(0, warmth - 3);
            if (newWorldState.weather === WeatherEnum.Snow) warmth = Math.max(0, warmth - 5);
          }

          hunger = Math.max(0, hunger - 0.5);

          const isResting = r.currentAction === ActionType.IDLE && isNearFire;
          if (isResting) energy = Math.min(100, energy + 10);
          else energy = Math.max(0, energy - 1);
          if (warmth <= 0 || hunger <= 0) energy = Math.max(0, energy - 2);

          const isInactive = energy <= 0;
          if (isInactive && !r.isInactive) addLog(r.name, r.color, 'Energy depleted. Shutting down.', 'STATUS');
          if (!isInactive && r.isInactive) addLog(r.name, r.color, 'Energy restored. Resuming operations.', 'STATUS');

          return { ...r, status: { warmth, energy, hunger }, isInactive };
        });
        newEnv.robots = newRobots;
        return newEnv;
      });

      return newWorldState;
    });
  }, [addLog]);

  // Main simulation tick timer (World state, robot needs)
  useEffect(() => {
    if (!isSimulating) return;
    const tickTimer = setInterval(simulationTick, 1000);
    return () => clearInterval(tickTimer);
  }, [isSimulating, simulationTick]);

  // Movement timer
  useEffect(() => {
    if (isSimulating) {
      const movementTimer = setInterval(handleMovement, MOVEMENT_SPEED_MS);
      return () => clearInterval(movementTimer);
    }
  }, [isSimulating, handleMovement]);
  
  // AI action timer
  useEffect(() => {
    if (isSimulating && !isThinking) {
      const timer = setTimeout(runSimulationTurn, SIMULATION_SPEED_MS);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulating, activeRobotIndex, environment, isThinking]);

  const handleStart = () => {
    addLog('System', '', `Simulation started. The goal is to survive.`, 'GOAL');
    setIsSimulating(true);
  };

  const handleStop = () => {
    setIsSimulating(false);
    addLog('System', '', 'Simulation stopped by user.', 'SYSTEM');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl text-cyan-400">Robot Survival AI</h1>
          <p className="text-gray-400 text-xs mt-2">An autonomous multi-agent AI survival simulation</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          <div className="lg:col-span-3">
            <Sandbox 
              environment={environment} 
              activeRobotId={isSimulating ? environment.robots[activeRobotIndex].id : null}
              timeOfDay={worldState.timeOfDay}
              weather={worldState.weather}
            />
          </div>
          <div className="lg:col-span-2 space-y-4">
              <WorldStatus worldState={worldState} />
              <RobotStatusPanel 
                robots={environment.robots} 
                activeRobotId={isSimulating ? environment.robots[activeRobotIndex].id : null}
                isThinking={isThinking}
              />
              <div className="h-64 lg:h-[calc(100%-14rem-2rem)]">
                <LogPanel logs={logs} />
              </div>
          </div>
        </main>

        <footer>
          <Controls
            isSimulating={isSimulating}
            onStart={handleStart}
            onStop={handleStop}
            onReset={handleReset}
            isThinking={isThinking}
          />
        </footer>
      </div>
    </div>
  );
};

export default App;
