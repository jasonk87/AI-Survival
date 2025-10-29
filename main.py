import ollama
import json
import asyncio
import argparse
from pydantic import BaseModel
from typing import List, Optional, Literal
from enum import Enum

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

class Robot(BaseItem):
    type: ItemType = ItemType.ROBOT
    name: str
    inventory: Optional[ItemType] = None
    color: str
    path: Optional[List[Position]] = None
    status: RobotStatus = RobotStatus()
    is_inactive: bool = False
    current_action: Optional[ActionType] = None

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

class RobotAction(BaseModel):
    action: ActionType
    payload: RobotActionPayload
    thought: Optional[str] = None

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

logs: List[LogEntry] = []
log_id_counter = 0

import heapq

def add_log(robot_name: str, robot_color: str, message: str, type: Literal['ACTION', 'COMMUNICATION', 'GOAL', 'SYSTEM', 'STATUS']):
    global log_id_counter
    logs.append(LogEntry(id=log_id_counter, robot_name=robot_name, robot_color=robot_color, message=message, type=type))
    log_id_counter += 1
    print(f"[{type}] {robot_name}: {message}")

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
    # Simplified world state update
    world_state.cycle_progress = (world_state.cycle_progress + 1) % 100
    if world_state.cycle_progress == 0:
        world_state.day += 1

    # Simplified needs update
    for robot in environment.robots:
        robot.status.hunger = max(0, robot.status.hunger - 0.5)
        robot.status.energy = max(0, robot.status.energy - 1)
        if robot.status.energy == 0:
            robot.is_inactive = True

    return world_state, environment

async def get_robot_next_action(robot: Robot, environment: EnvironmentState, world: WorldState, logs: List[LogEntry], host: str) -> Optional[RobotAction]:
    other_robots = [r for r in environment.robots if r.id != robot.id]

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
        print(f"Error getting robot action from Ollama: {e}")
        return None

INITIAL_ENV_STATE = {
    "items": [
        {"id": "tree-1", "type": "TREE", "position": {"x": 2, "y": 2}},
        {"id": "rock-1", "type": "ROCK", "position": {"x": 5, "y": 5}},
        {"id": "axe-1", "type": "AXE", "position": {"x": 1, "y": 1}},
    ],
    "robots": [
        {"id": "robot-1", "type": "ROBOT", "name": "R1", "color": "blue", "position": {"x": 0, "y": 0}},
    ],
}

async def main(host: str):
    environment = EnvironmentState(**INITIAL_ENV_STATE)
    world_state = WorldState()
    active_robot_index = 0

    while True:
        environment = await run_simulation_turn(active_robot_index, environment, world_state, host)
        environment = handle_movement(environment)
        world_state, environment = simulation_tick(world_state, environment)

        active_robot_index = (active_robot_index + 1) % len(environment.robots)

        await asyncio.sleep(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="192.168.86.250", help="Ollama host")
    parser.add_argument("--port", default="11434", help="Ollama port")
    args = parser.parse_args()

    ollama_host = f"http://{args.host}:{args.port}"

    asyncio.run(main(host=ollama_host))
