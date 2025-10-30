import ollama
import json
import asyncio
import argparse
import os
import time
import logging
from models import *
from simulation import *

async def run_simulation_turn(active_robot_index: int, environment: EnvironmentState, world_state: WorldState, host: str, logs: list) -> EnvironmentState:
    current_robot = environment.robots[active_robot_index]

    if current_robot.path and len(current_robot.path) > 0:
        return environment

    action = await get_robot_next_action(current_robot, environment, world_state, host, logs)

    if action:
        return process_action(current_robot, action, environment)
    else:
        add_log(current_robot.name, current_robot.color, 'Could not decide on an action.', 'SYSTEM')
        return environment

async def get_robot_next_action(robot: Robot, environment: EnvironmentState, world: WorldState, host: str, logs: list, scenario: Scenario) -> Optional[RobotAction]:
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
    logs = []

    while True:
        render_grid(environment, world_state)
        environment = await run_simulation_turn(active_robot_index, environment, world_state, host, logs)
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
