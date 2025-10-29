import ollama
import json
import asyncio
import argparse
import os
import time
import logging
from pydantic import BaseModel
from typing import List, Optional, Literal
from enum import Enum
import heapq
import math
import random

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='simulation.log',
    filemode='w'
)

class Position(BaseModel):
    x: int
    y: int

class ItemType(str, Enum):
    ROBOT = 'ROBOT'
    TREE = 'TREE'
    AXE = 'AXE'
    WOOD = 'WOOD'
    FIRE_PIT = 'FIRE_PIT'
    FIRE = 'FIRE'
    ROCK = 'ROCK'
    PICKAXE = 'PICKAXE'
    STONE = 'STONE'
    WALL = 'WALL'
    WATER_SOURCE = 'WATER_SOURCE'
    BUCKET_EMPTY = 'BUCKET_EMPTY'
    BUCKET_FULL = 'BUCKET_FULL'
    SEED = 'SEED'
    SOIL = 'SOIL'
    SAPLING = 'SAPLING'
    BERRY_BUSH = 'BERRY_BUSH'
    BERRIES = 'BERRIES'

class BaseItem(BaseModel):
    id: str
    type: ItemType
    position: Position

class RobotStatus(BaseModel):
    warmth: float = 100.0
    energy: float = 100.0
    hunger: float = 100.0

class ActionType(str, Enum):
    MOVE = 'MOVE'
    GOTO = 'GOTO'
    PICKUP = 'PICKUP'
    USE = 'USE'
    TALK = 'TALK'
    IDLE = 'IDLE'
    DROP = 'DROP'
    EAT = 'EAT'
    REMEMBER = 'REMEMBER'

class Robot(BaseItem):
    type: ItemType = ItemType.ROBOT
    name: str
    inventory: Optional[ItemType] = None
    color: str
    path: Optional[List[Position]] = None
    status: RobotStatus = RobotStatus()
    is_inactive: bool = False
    current_action: Optional[ActionType] = None
    memory: RobotMemory = RobotMemory()

class EnvironmentItem(BaseItem):
    pass

class EnvironmentState(BaseModel):
    items: List[EnvironmentItem]
    robots: List[Robot]

Direction = Literal['UP', 'DOWN', 'LEFT', 'RIGHT']

class RobotActionPayload(BaseModel):
    direction: Optional[Direction] = None
    message: Optional[str] = None
    target_id: Optional[str] = None
    target_position: Optional[Position] = None
    memory_name: Optional[str] = None
    memory_position: Optional[Position] = None

class RobotAction(BaseModel):
    action: ActionType
    payload: RobotActionPayload
    thought: Optional[str] = None

class RobotMemory(BaseModel):
    known_locations: dict[str, Position] = {}

class Scenario(BaseModel):
    grid_size: int
    items: List[EnvironmentItem]
    robots: List[Robot]

class LogEntry(BaseModel):
    id: int
    robot_name: str
    robot_color: str
    message: str
    type: Literal['ACTION', 'COMMUNICATION', 'GOAL', 'SYSTEM', 'STATUS']

TimeOfDay = Literal['Dawn', 'Day', 'Dusk', 'Night']

class WeatherType(str, Enum):
    CLEAR = 'Clear'
    RAIN = 'Rain'
    SNOW = 'Snow'

class WorldState(BaseModel):
    day: int = 1
    time_of_day: TimeOfDay = 'Day'
    cycle_progress: float = 25.0
    temperature: int = 20
    weather: WeatherType = WeatherType.CLEAR

GRID_SIZE = 20
IMPASSABLE_ITEM_TYPES = [
    ItemType.TREE, ItemType.ROCK, ItemType.WALL, ItemType.WATER_SOURCE
]

DAY_CYCLE_MS = 60000  # 60 seconds for a full day/night cycle

logs: List[LogEntry] = []
log_id_counter = 0

def add_log(robot_name: str, robot_color: str, message: str, type: Literal['ACTION', 'COMMUNICATION', 'GOAL', 'SYSTEM', 'STATUS']):
    global log_id_counter
    logs.append(LogEntry(id=log_id_counter, robot_name=robot_name, robot_color=robot_color, message=message, type=type))
    log_id_counter += 1
    logging.info(f"[{type}] {robot_name}: {message}")

def find_path(start: Position, end: Position, env: EnvironmentState) -> Optional[List[Position]]:
    grid = [[0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

    for item in env.items:
        if item.type in IMPASSABLE_ITEM_TYPES:
            grid[item.position.y][item.position.x] = 1
    for robot in env.robots:
        grid[robot.position.y][robot.position.x] = 1

    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = { (x, y): float('inf') for x in range(GRID_SIZE) for y in range(GRID_SIZE) }
    g_score[(start.x, start.y)] = 0
    f_score = { (x, y): float('inf') for x in range(GRID_SIZE) for y in range(GRID_SIZE) }
    f_score[(start.x, start.y)] = abs(start.x - end.x) + abs(start.y - end.y)

    while open_set:
        _, current_pos_tuple = heapq.heappop(open_set)
        current_pos = Position(x=current_pos_tuple[0], y=current_pos_tuple[1])

        if current_pos == end:
            path = []
            while (current_pos.x, current_pos.y) in came_from:
                path.append(current_pos)
                current_pos = came_from[(current_pos.x, current_pos.y)]
            path.append(start)
            return path[::-1]

        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            neighbor_pos = Position(x=current_pos.x + dx, y=current_pos.y + dy)

            if 0 <= neighbor_pos.x < GRID_SIZE and 0 <= neighbor_pos.y < GRID_SIZE and grid[neighbor_pos.y][neighbor_pos.x] == 0:
                tentative_g_score = g_score.get((current_pos.x, current_pos.y), float('inf')) + 1
                if tentative_g_score < g_score.get((neighbor_pos.x, neighbor_pos.y), float('inf')):
                    came_from[(neighbor_pos.x, neighbor_pos.y)] = current_pos
                    g_score[(neighbor_pos.x, neighbor_pos.y)] = tentative_g_score
                    f_score[(neighbor_pos.x, neighbor_pos.y)] = tentative_g_score + abs(neighbor_pos.x - end.x) + abs(neighbor_pos.y - end.y)
                    heapq.heappush(open_set, (f_score[(neighbor_pos.x, neighbor_pos.y)], (neighbor_pos.x, neighbor_pos.y)))
    return None

def find_reachable_adjacent_position(target: Position, start: Position, env: EnvironmentState) -> Optional[Position]:
    for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
        adj_pos = Position(x=target.x + dx, y=target.y + dy)
        if 0 <= adj_pos.x < GRID_SIZE and 0 <= adj_pos.y < GRID_SIZE:
            is_impassable = any(item.position == adj_pos and item.type in IMPASSABLE_ITEM_TYPES for item in env.items)
            is_occupied = any(robot.position == adj_pos for robot in env.robots)
            if not is_impassable and not is_occupied:
                if find_path(start, adj_pos, env):
                    return adj_pos
    return None

def process_action(robot: Robot, action: RobotAction, env: EnvironmentState) -> EnvironmentState:
    if action.thought:
        add_log(robot.name, robot.color, f"Thought: {action.thought}", 'ACTION')

    robot_in_state = next((r for r in env.robots if r.id == robot.id), None)
    if not robot_in_state:
        return env

    robot_in_state.current_action = action.action

    if robot_in_state.is_inactive and action.action != ActionType.IDLE:
        add_log(robot.name, robot.color, f"Is inactive and cannot perform {action.action}. Trying to rest.", 'STATUS')
        action.action = ActionType.IDLE
        robot_in_state.current_action = ActionType.IDLE

    if action.action == ActionType.GOTO:
        target_position = action.payload.target_position
        if not target_position:
            return env

        final_target = target_position
        is_target_adjusted = False

        target_item = next((i for i in env.items if i.position == target_position), None)
        is_target_impassable_item = target_item and target_item.type in IMPASSABLE_ITEM_TYPES
        is_target_occupied_by_other_robot = any(r.id != robot.id and r.position == target_position for r in env.robots)

        if is_target_impassable_item or is_target_occupied_by_other_robot:
            reachable_adjacent = find_reachable_adjacent_position(target_position, robot.position, env)
            if reachable_adjacent:
                final_target = reachable_adjacent
                is_target_adjusted = True
            else:
                add_log(robot.name, robot.color, f"Cannot go to ({target_position.x}, {target_position.y}), it's blocked.", 'ACTION')
                return env

        path = find_path(robot.position, final_target, env)
        if path and len(path) > 0:
            robot_in_state.path = path
            via_message = f" via ({final_target.x}, {final_target.y})" if is_target_adjusted else ''
            add_log(robot.name, robot.color, f"Moving towards ({target_position.x}, {target_position.y}){via_message}.", 'ACTION')
        else:
            add_log(robot.name, robot.color, f"Couldn't find a path to ({final_target.x}, {final_target.y}).", 'ACTION')

    elif action.action == ActionType.MOVE:
        direction = action.payload.direction
        x, y = robot.position.x, robot.position.y
        if direction == 'UP': y = max(0, y - 1)
        if direction == 'DOWN': y = min(GRID_SIZE - 1, y + 1)
        if direction == 'LEFT': x = max(0, x - 1)
        if direction == 'RIGHT': x = min(GRID_SIZE - 1, x + 1)

        robot_at_target = any(r.id != robot.id and r.position.x == x and r.position.y == y for r in env.robots)
        impassable_item_at_target = any(i.position.x == x and i.position.y == y and i.type in IMPASSABLE_ITEM_TYPES for i in env.items)
        is_occupied = robot_at_target or impassable_item_at_target

        if not is_occupied:
            robot_in_state.position = Position(x=x, y=y)
            add_log(robot.name, robot.color, f"Moved {direction}.", 'ACTION')
        else:
            add_log(robot.name, robot.color, f"Tried to move {direction}, but it was blocked.", 'ACTION')

    elif action.action == ActionType.TALK:
        add_log(robot.name, robot.color, action.payload.message or '...', 'COMMUNICATION')

    elif action.action == ActionType.PICKUP:
        target_id = action.payload.target_id
        item_to_pickup = next((i for i in env.items if i.id == target_id and i.position == robot.position), None)
        if item_to_pickup:
            if not robot_in_state.inventory:
                env.items = [i for i in env.items if i.id != target_id]
                robot_in_state.inventory = item_to_pickup.type
                add_log(robot.name, robot.color, f"Picked up {item_to_pickup.type}.", 'ACTION')
            else:
                add_log(robot.name, robot.color, f"Failed to pick up {item_to_pickup.type}, inventory full.", 'ACTION')

    elif action.action == ActionType.USE:
        target_id = action.payload.target_id
        target = next((i for i in env.items if i.id == target_id), None)
        if target:
            dx = abs(robot.position.x - target.position.x)
            dy = abs(robot.position.y - target.position.y)
            is_adjacent = dx <= 1 and dy <= 1 and not (dx == 0 and dy == 0)

            if is_adjacent:
                held_item = robot_in_state.inventory
                if held_item == ItemType.AXE and target.type == ItemType.TREE:
                    env.items = [i for i in env.items if i.id != target.id]
                    env.items.append(EnvironmentItem(id=f"wood-{id(target)}", type=ItemType.WOOD, position=target.position))
                    env.items.append(EnvironmentItem(id=f"seed-{id(target)}", type=ItemType.SEED, position=target.position))
                    add_log(robot.name, robot.color, "Chopped down the tree.", 'ACTION')
                elif held_item == ItemType.PICKAXE and target.type == ItemType.ROCK:
                    env.items = [i for i in env.items if i.id != target.id]
                    env.items.append(EnvironmentItem(id=f"stone-{id(target)}", type=ItemType.STONE, position=target.position))
                    add_log(robot.name, robot.color, "Mined the rock.", 'ACTION')
                elif held_item == ItemType.WOOD and target.type == ItemType.FIRE_PIT:
                    target.type = ItemType.FIRE
                    robot_in_state.inventory = None
                    add_log(robot.name, robot.color, "Used wood to start a fire.", 'ACTION')
                elif held_item == ItemType.BUCKET_EMPTY and target.type == ItemType.WATER_SOURCE:
                    robot_in_state.inventory = ItemType.BUCKET_FULL
                    add_log(robot.name, robot.color, "Filled the bucket.", 'ACTION')
                elif held_item == ItemType.BUCKET_FULL and target.type == ItemType.FIRE:
                    target.type = ItemType.FIRE_PIT
                    robot_in_state.inventory = ItemType.BUCKET_EMPTY
                    add_log(robot.name, robot.color, "Doused the fire.", 'ACTION')
                elif held_item == ItemType.BUCKET_FULL and target.type == ItemType.SAPLING:
                    target.type = ItemType.TREE
                    robot_in_state.inventory = ItemType.BUCKET_EMPTY
                    add_log(robot.name, robot.color, "Watered the sapling. It grew into a tree!", 'ACTION')
                elif held_item == ItemType.SEED and target.type == ItemType.SOIL:
                    target.type = ItemType.SAPLING
                    robot_in_state.inventory = None
                    add_log(robot.name, robot.color, "Planted a seed.", 'ACTION')
                elif held_item == ItemType.STONE and target.type == ItemType.STONE:
                    env.items = [i for i in env.items if i.id != target.id]
                    env.items.append(EnvironmentItem(id=f"wall-{id(target)}", type=ItemType.WALL, position=target.position))
                    robot_in_state.inventory = None
                    add_log(robot.name, robot.color, "Built a wall segment.", 'ACTION')
                elif not held_item and target.type == ItemType.BERRY_BUSH:
                    env.items = [i for i in env.items if i.id != target.id]
                    robot_in_state.inventory = ItemType.BERRIES
                    add_log(robot.name, robot.color, 'Picked some berries.', 'ACTION')
                else:
                    add_log(robot.name, robot.color, f"Tried to use {held_item or 'hands'} on {target.type}, but it did nothing.", 'ACTION')
            else:
                add_log(robot.name, robot.color, f"Tried to use an item on {target.type}, but was too far away.", 'ACTION')

    elif action.action == ActionType.EAT:
        if robot_in_state.inventory == ItemType.BERRIES:
            robot_in_state.inventory = None
            robot_in_state.status.hunger = min(100, robot_in_state.status.hunger + 50)
            add_log(robot.name, robot.color, "Ate the berries.", 'ACTION')
        else:
            add_log(robot.name, robot.color, "Tried to eat, but has no food.", 'ACTION')

    elif action.action == ActionType.DROP:
        if robot_in_state.inventory:
            item_to_drop = robot_in_state.inventory
            env.items.append(EnvironmentItem(id=f"{item_to_drop.lower()}-{id(item_to_drop)}", type=item_to_drop, position=robot_in_state.position))
            robot_in_state.inventory = None
            add_log(robot.name, robot.color, f"Dropped {item_to_drop}.", 'ACTION')

    elif action.action == ActionType.IDLE:
        add_log(robot.name, robot.color, 'Is resting.', 'ACTION')

    elif action.action == ActionType.REMEMBER:
        name = action.payload.memory_name
        pos = action.payload.memory_position
        if name and pos:
            robot_in_state.memory.known_locations[name] = pos
            memory_file = f"{robot.id}_memory.json"
            with open(memory_file, 'w') as f:
                json.dump(robot_in_state.memory.dict(), f, indent=2)
            add_log(robot.name, robot.color, f"Remembered location '{name}' at ({pos.x}, {pos.y}).", 'ACTION')

    else:
        add_log(robot.name, robot.color, f"Attempted an unknown action: {action.action}", 'SYSTEM')

    return env

async def run_simulation_turn(active_robot_index: int, environment: EnvironmentState, world_state: WorldState, host: str) -> EnvironmentState:
    current_robot = environment.robots[active_robot_index]

    if current_robot.path and len(current_robot.path) > 0:
        return environment

    action = await get_robot_next_action(current_robot, environment, world_state, logs, host)

    if action:
        return process_action(current_robot, action, environment)
    else:
        add_log(current_robot.name, current_robot.color, 'Could not decide on an action.', 'SYSTEM')
        return environment

def handle_movement(environment: EnvironmentState) -> EnvironmentState:
    for robot in environment.robots:
        if robot.path and len(robot.path) > 0:
            next_position = robot.path.pop(0)
            robot.position = next_position
            if not robot.path:
                add_log(robot.name, robot.color, "Arrived at destination.", "ACTION")
    return environment

def simulation_tick(world_state: WorldState, environment: EnvironmentState) -> (WorldState, EnvironmentState):
    progress = world_state.cycle_progress + (100 * 1000) / DAY_CYCLE_MS
    new_day = world_state.day
    new_progress = progress
    if progress >= 100:
        new_progress = 0
        new_day += 1

    new_time_of_day: TimeOfDay = 'Day'
    if new_progress > 90 or new_progress < 10: new_time_of_day = 'Night'
    elif new_progress > 75: new_time_of_day = 'Dusk'
    elif new_progress < 25: new_time_of_day = 'Dawn'

    old_time_of_day = world_state.time_of_day
    new_weather = world_state.weather
    if (old_time_of_day == 'Night' and new_time_of_day == 'Dawn') or \
       (old_time_of_day == 'Day' and new_time_of_day == 'Dusk'):
        weather_options = [WeatherType.CLEAR, WeatherType.CLEAR, WeatherType.CLEAR, WeatherType.RAIN, WeatherType.SNOW]
        new_weather = random.choice(weather_options)
        add_log('System', '', f"The weather has changed to {new_weather}.", 'SYSTEM')

    temp_fluctuation = math.sin((new_progress / 100) * 2 * math.pi - math.pi / 2)
    base_temperature = 10 + 15 * (temp_fluctuation + 1) / 2
    if new_weather == WeatherType.RAIN: base_temperature -= 5
    if new_weather == WeatherType.SNOW: base_temperature -= 10

    world_state.day = new_day
    world_state.cycle_progress = new_progress
    world_state.time_of_day = new_time_of_day
    world_state.weather = new_weather
    world_state.temperature = round(base_temperature)

    fires = [item for item in environment.items if item.type == ItemType.FIRE]
    if world_state.weather == WeatherType.RAIN:
        for fire in fires:
            if random.random() < 0.25:
                fire.type = ItemType.FIRE_PIT
                add_log('System', '', f"The rain has doused a fire at ({fire.position.x}, {fire.position.y}).", 'SYSTEM')

        saplings = [item for item in environment.items if item.type == ItemType.SAPLING]
        for sapling in saplings:
            if random.random() < 0.1:
                sapling.type = ItemType.TREE
                add_log('System', '', f"A sapling at ({sapling.position.x}, {sapling.position.y}) grew into a tree in the rain.", 'SYSTEM')

    # Refined needs update
    for robot in environment.robots:
        is_near_fire = any(abs(robot.position.x - f.position.x) <= 1 and abs(robot.position.y - f.position.y) <= 1 for f in fires)

        warmth = robot.status.warmth
        if is_near_fire:
            warmth = min(100, warmth + 10)
        else:
            if world_state.time_of_day == 'Night': warmth = max(0, warmth - 5)
            elif world_state.time_of_day in ['Dusk', 'Dawn']: warmth = max(0, warmth - 2)
            if world_state.weather == WeatherType.RAIN: warmth = max(0, warmth - 3)
            if world_state.weather == WeatherType.SNOW: warmth = max(0, warmth - 5)
        robot.status.warmth = warmth

        robot.status.hunger = max(0, robot.status.hunger - 0.5)

        energy = robot.status.energy
        is_resting = robot.current_action == ActionType.IDLE and is_near_fire
        if is_resting:
            energy = min(100, energy + 10)
        else:
            energy = max(0, energy - 1)
        if warmth <= 0 or robot.status.hunger <= 0:
            energy = max(0, energy - 2)
        robot.status.energy = energy

        was_inactive = robot.is_inactive
        is_inactive = energy <= 0
        if is_inactive and not was_inactive:
            add_log(robot.name, robot.color, 'Energy depleted. Shutting down.', 'STATUS')
        if not is_inactive and was_inactive:
            add_log(robot.name, robot.color, 'Energy restored. Resuming operations.', 'STATUS')
        robot.is_inactive = is_inactive

    return world_state, environment

def render_grid(environment: EnvironmentState, world_state: WorldState):
    os.system('cls' if os.name == 'nt' else 'clear')

    grid = [['.' for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

    for item in environment.items:
        char = '?'
        if item.type == ItemType.TREE: char = 'T'
        elif item.type == ItemType.ROCK: char = 'O'
        elif item.type == ItemType.WATER_SOURCE: char = 'W'
        elif item.type == ItemType.FIRE: char = 'F'
        elif item.type == ItemType.AXE: char = 'a'
        elif item.type == ItemType.WOOD: char = 'w'
        grid[item.position.y][item.position.x] = char

    for i, robot in enumerate(environment.robots):
        grid[robot.position.y][robot.position.x] = f"{i+1}"

    print("--- Robot Survival Simulation ---")
    print(f"Day {world_state.day} | Time: {world_state.time_of_day} ({world_state.cycle_progress:.0f}%) | Temp: {world_state.temperature}°C | Weather: {world_state.weather}")
    print("-" * (GRID_SIZE * 2 + 3))
    for row in grid:
        print(f"| {' '.join(row)} |")
    print("-" * (GRID_SIZE * 2 + 3))

    for i, robot in enumerate(environment.robots):
        print(f"Robot {i+1} ({robot.name}): Inv: {robot.inventory or 'Empty'} | Nrg: {robot.status.energy:.0f} | Hgr: {robot.status.hunger:.0f}")

async def get_robot_next_action(robot: Robot, environment: EnvironmentState, world: WorldState, logs: List[LogEntry], host: str) -> Optional[RobotAction]:
    memory_file = f"{robot.id}_memory.json"
    if os.path.exists(memory_file):
        with open(memory_file, 'r') as f:
            robot.memory = RobotMemory(**json.load(f))

    other_robots = [r for r in environment.robots if r.id != robot.id]

    known_locations_str = "\n".join([f"- {name}: ({pos.x}, {pos.y})" for name, pos in robot.memory.known_locations.items()])

    prompt = f"""
World State: Day {world.day}, Time: {world.time_of_day}, Weather: {world.weather}, Temperature: {world.temperature}°

You are robot {robot.name} ({robot.color}).
Your primary goal is to survive.

Your current status:
- Position: ({robot.position.x}, {robot.position.y})
- Inventory: {robot.inventory or 'empty'}
- Warmth: {round(robot.status.warmth)}/100
- Energy: {round(robot.status.energy)}/100
- Hunger: {round(robot.status.hunger)}/100
{"- YOU ARE INACTIVE. You can only perform IDLE action to recover." if robot.is_inactive else ""}

Your Memory (Known Locations):
{known_locations_str or "No known locations."}

Current Environment State:
Items:
{chr(10).join(f"- {i.type} (id: {i.id}) at ({i.position.x}, {i.position.y})" for i in environment.items) or 'No items in the environment.'}

Other Robots:
{chr(10).join(f"- {r.name} is at ({r.position.x}, {r.position.y}) with inventory: {r.inventory or 'empty'}" for r in other_robots) or 'No other robots.'}

Recent Event Log (last 15 events):
{chr(10).join(f"{l.robot_name}: {l.message}" for l in logs[-15:])}

Based on all this information, decide your next single action to ensure your survival.
Respond with a JSON object in the format: {{"thought": "...", "action": "...", "payload": {{...}}}}
"""

    try:
        client = ollama.AsyncClient(host=host)
        response = await client.generate(model='llama2', prompt=prompt)

        # Extract the JSON part of the response
        json_response = response['response'].strip()

        # It's possible the model returns markdown JSON, so we need to clean it
        if json_response.startswith('```json'):
            json_response = json_response.replace('```json', '').replace('```', '').strip()

        action_data = json.loads(json_response)

        return RobotAction(**action_data)

    except Exception as e:
        logging.error(f"Error getting robot action from Ollama: {e}")
        return None

async def main(host: str):
    try:
        with open(scenario_file, 'r') as f:
            scenario_data = json.load(f)
            scenario = Scenario(**scenario_data)
            GRID_SIZE = scenario.grid_size
            environment = EnvironmentState(items=scenario.items, robots=scenario.robots)
    except (FileNotFoundError, json.JSONDecodeError, TypeError) as e:
        logging.error(f"Error loading scenario file: {e}")
        return

    world_state = WorldState()
    active_robot_index = 0

    while True:
        render_grid(environment, world_state)
        environment = await run_simulation_turn(active_robot_index, environment, world_state, host)
        environment = handle_movement(environment)
        world_state, environment = simulation_tick(world_state, environment)

        active_robot_index = (active_robot_index + 1) % len(environment.robots)

        time.sleep(0.1)  # Control simulation speed

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="192.168.86.250", help="Ollama host")
    parser.add_argument("--port", default="11434", help="Ollama port")
    parser.add_argument("--scenario", default="scenario.json", help="Path to the scenario JSON file")
    args = parser.parse_args()

    ollama_host = f"http://{args.host}:{args.port}"

    asyncio.run(main(host=ollama_host, scenario_file=args.scenario))
