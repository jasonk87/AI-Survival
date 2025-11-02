import os
import json
import logging
import heapq
import math
import random
import time
from typing import List, Optional, Literal

from models import *

GRID_SIZE = 20
IMPASSABLE_ITEM_TYPES = [
    ItemType.TREE, ItemType.ROCK, ItemType.WALL, ItemType.WATER_SOURCE
]

DAY_CYCLE_MS = 60000  # 60 seconds for a full day/night cycle

CRAFTING_RECIPES = {
    ItemType.AXE: {ItemType.WOOD: 3, ItemType.STONE: 2},
    ItemType.PICKAXE: {ItemType.WOOD: 2, ItemType.STONE: 3},
}

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
            if sum(robot_in_state.inventory.values()) < 10:
                robot_in_state.inventory[item_to_pickup.type] = robot_in_state.inventory.get(item_to_pickup.type, 0) + 1
                env.items = [i for i in env.items if i.id != target_id]
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
                inventory = robot_in_state.inventory
                if inventory.get(ItemType.AXE, 0) > 0 and target.type == ItemType.TREE:
                    inventory[ItemType.AXE] -= 1
                    if inventory[ItemType.AXE] == 0:
                        del inventory[ItemType.AXE]
                    env.items = [i for i in env.items if i.id != target.id]
                    env.items.append(EnvironmentItem(id=f"wood-{id(target)}", type=ItemType.WOOD, position=target.position))
                    env.items.append(EnvironmentItem(id=f"seed-{id(target)}", type=ItemType.SEED, position=target.position))
                    add_log(robot.name, robot.color, "Chopped down the tree.", 'ACTION')
                elif inventory.get(ItemType.PICKAXE, 0) > 0 and target.type == ItemType.ROCK:
                    inventory[ItemType.PICKAXE] -= 1
                    if inventory[ItemType.PICKAXE] == 0:
                        del inventory[ItemType.PICKAXE]
                    env.items = [i for i in env.items if i.id != target.id]
                    env.items.append(EnvironmentItem(id=f"stone-{id(target)}", type=ItemType.STONE, position=target.position))
                    add_log(robot.name, robot.color, "Mined the rock.", 'ACTION')
                elif inventory.get(ItemType.WOOD, 0) > 0 and target.type == ItemType.FIRE_PIT:
                    inventory[ItemType.WOOD] -= 1
                    if inventory[ItemType.WOOD] == 0:
                        del inventory[ItemType.WOOD]
                    target.type = ItemType.FIRE
                    add_log(robot.name, robot.color, "Used wood to start a fire.", 'ACTION')
                elif inventory.get(ItemType.BUCKET_EMPTY, 0) > 0 and target.type == ItemType.WATER_SOURCE:
                    inventory[ItemType.BUCKET_EMPTY] -= 1
                    if inventory[ItemType.BUCKET_EMPTY] == 0:
                        del inventory[ItemType.BUCKET_EMPTY]
                    inventory[ItemType.BUCKET_FULL] = inventory.get(ItemType.BUCKET_FULL, 0) + 1
                    add_log(robot.name, robot.color, "Filled the bucket.", 'ACTION')
                elif inventory.get(ItemType.BUCKET_FULL, 0) > 0 and target.type == ItemType.FIRE:
                    inventory[ItemType.BUCKET_FULL] -= 1
                    if inventory[ItemType.BUCKET_FULL] == 0:
                        del inventory[ItemType.BUCKET_FULL]
                    inventory[ItemType.BUCKET_EMPTY] = inventory.get(ItemType.BUCKET_EMPTY, 0) + 1
                    target.type = ItemType.FIRE_PIT
                    add_log(robot.name, robot.color, "Doused the fire.", 'ACTION')
                elif inventory.get(ItemType.BUCKET_FULL, 0) > 0 and target.type == ItemType.SAPLING:
                    inventory[ItemType.BUCKET_FULL] -= 1
                    if inventory[ItemType.BUCKET_FULL] == 0:
                        del inventory[ItemType.BUCKET_FULL]
                    inventory[ItemType.BUCKET_EMPTY] = inventory.get(ItemType.BUCKET_EMPTY, 0) + 1
                    target.type = ItemType.TREE
                    add_log(robot.name, robot.color, "Watered the sapling. It grew into a tree!", 'ACTION')
                elif inventory.get(ItemType.SEED, 0) > 0 and target.type == ItemType.SOIL:
                    inventory[ItemType.SEED] -= 1
                    if inventory[ItemType.SEED] == 0:
                        del inventory[ItemType.SEED]
                    target.type = ItemType.SAPLING
                    add_log(robot.name, robot.color, "Planted a seed.", 'ACTION')
                elif inventory.get(ItemType.STONE, 0) > 0 and target.type == ItemType.STONE:
                    inventory[ItemType.STONE] -= 1
                    if inventory[ItemType.STONE] == 0:
                        del inventory[ItemType.STONE]
                    env.items = [i for i in env.items if i.id != target.id]
                    env.items.append(EnvironmentItem(id=f"wall-{id(target)}", type=ItemType.WALL, position=target.position))
                    add_log(robot.name, robot.color, "Built a wall segment.", 'ACTION')
                elif not any(inventory) and target.type == ItemType.BERRY_BUSH:
                    env.items = [i for i in env.items if i.id != target.id]
                    inventory[ItemType.BERRIES] = inventory.get(ItemType.BERRIES, 0) + 1
                    add_log(robot.name, robot.color, 'Picked some berries.', 'ACTION')
                else:
                    add_log(robot.name, robot.color, f"Tried to use inventory on {target.type}, but it did nothing.", 'ACTION')
            else:
                add_log(robot.name, robot.color, f"Tried to use an item on {target.type}, but was too far away.", 'ACTION')

    elif action.action == ActionType.EAT:
        if robot_in_state.inventory.get(ItemType.BERRIES, 0) > 0:
            robot_in_state.inventory[ItemType.BERRIES] -= 1
            if robot_in_state.inventory[ItemType.BERRIES] == 0:
                del robot_in_state.inventory[ItemType.BERRIES]
            robot_in_state.status.hunger = min(100, robot_in_state.status.hunger + 50)
            add_log(robot.name, robot.color, "Ate the berries.", 'ACTION')
        else:
            add_log(robot.name, robot.color, "Tried to eat, but has no food.", 'ACTION')

    elif action.action == ActionType.DROP:
        item_to_drop_type = action.payload.get("item_type")
        if item_to_drop_type in robot_in_state.inventory and robot_in_state.inventory[item_to_drop_type] > 0:
            robot_in_state.inventory[item_to_drop_type] -= 1
            if robot_in_state.inventory[item_to_drop_type] == 0:
                del robot_in_state.inventory[item_to_drop_type]

            new_item = EnvironmentItem(id=f"{item_to_drop_type.lower()}-{time.time()}", type=item_to_drop_type, position=robot_in_state.position)
            env.items.append(new_item)
            add_log(robot.name, robot.color, f"Dropped {item_to_drop_type}.", 'ACTION')
        else:
            add_log(robot.name, robot.color, f"Tried to drop {item_to_drop_type}, but has none.", 'ACTION')

    elif action.action == ActionType.IDLE:
        add_log(robot.name, robot.color, 'Is resting.', 'ACTION')

    elif action.action == ActionType.CRAFT:
        item_to_craft = action.payload.item_to_craft
        if item_to_craft in CRAFTING_RECIPES:
            recipe = CRAFTING_RECIPES[item_to_craft]
            can_craft = all(robot_in_state.inventory.get(res, 0) >= count for res, count in recipe.items())
            if can_craft:
                for res, count in recipe.items():
                    robot_in_state.inventory[res] -= count
                    if robot_in_state.inventory[res] == 0:
                        del robot_in_state.inventory[res]

                robot_in_state.inventory[item_to_craft] = robot_in_state.inventory.get(item_to_craft, 0) + 1
                add_log(robot.name, robot.color, f"Crafted a {item_to_craft}.", 'ACTION')
            else:
                add_log(robot.name, robot.color, f"Tried to craft a {item_to_craft}, but is missing resources.", 'ACTION')

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

def handle_movement(environment: EnvironmentState) -> EnvironmentState:
    for robot in environment.robots:
        if robot.path and len(robot.path) > 0:
            for _ in range(int(robot.speed)):
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
                add_log('System', '', f"A sapling at ({sapling.position.x}, {sapling.position.y}) is being watered by the rain.", 'SYSTEM')

    # Refined needs update
    for robot in environment.robots:
        is_near_fire = any(abs(robot.position.x - f.position.x) <= 1 and abs(robot.position.y - f.position.y) <= 1 for f in fires)

        warmth = robot.status.warmth
        if is_near_fire:
            warmth = min(100, warmth + 10)
        else:
            if world_state.time_of_day == 'Night': warmth = max(0, warmth - 10)
            elif world_state.time_of_day in ['Dusk', 'Dawn']: warmth = max(0, warmth - 5)
            if world_state.weather == WeatherType.RAIN: warmth = max(0, warmth - 5)
            if world_state.weather == WeatherType.SNOW: warmth = max(0, warmth - 10)
        robot.status.warmth = warmth

        robot.status.hunger = max(0, robot.status.hunger - 0.5)

        if world_state.weather == WeatherType.SNOW:
            robot.speed = 0.5
        else:
            robot.speed = 1

        energy = robot.status.energy
        is_resting = robot.current_action == ActionType.IDLE and is_near_fire
        if is_resting:
            energy = min(100, energy + 10)
        else:
            if robot.current_action == ActionType.MOVE:
                energy = max(0, energy - 2)
            elif robot.current_action == ActionType.USE:
                energy = max(0, energy - 5)
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
