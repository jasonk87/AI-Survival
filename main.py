import google.generativeai as genai
import json
import asyncio
import argparse
import os
import time
import logging
from models import *
from simulation import *

async def run_simulation_turn(active_robot_index: int, environment: EnvironmentState, world_state: WorldState, host: str, logs: list, scenario: Scenario) -> EnvironmentState:
    current_robot = environment.robots[active_robot_index]

    if current_robot.path and len(current_robot.path) > 0:
        return environment

    action = await get_robot_next_action(current_robot, environment, world_state, host, logs, scenario)

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
    predators = environment.predators
    predators_str = "\n".join([f"- Predator at ({p.position.x}, {p.position.y})" for p in predators])

    message_log_str = "\n".join([f"- {msg['robot_id']}: {msg['message_type']} {msg['message_data']}" for msg in world.message_log[-5:]])

    known_locations_str = "\n".join([f"- {name}: ({pos.x}, {pos.y})" for name, pos in robot.memory.known_locations.items()])

    leader_text = "You are the LEADER of your tribe." if robot.is_leader else "You are a follower in your tribe."
    personality_text = f"Your personality is: {robot.personality}." if robot.personality else ""

    prompt = f"""
World State: Day {world.day}, Time: {world.time_of_day}, Season: {world.season}, Weather: {world.weather}, Temperature: {world.temperature}°

You are robot {robot.name} ({robot.color}) of {robot.tribe}. Your role is {robot.role}.
{leader_text}
{personality_text}

Your primary goal is to ensure the survival and success of your tribe. Cooperate with your tribe members by sharing resources with the GIVE action and leveraging your unique role.
Act according to your personality and leadership role. If you are a leader, guide others and prioritize the tribe's long-term survival. If you are a follower, consider the leader's actions but also your own survival.
Use the TALK action to broadcast important information to your tribe, such as the location of resources or dangers. Listen to incoming messages and use the REMEMBER action to update your memory.

Your current status:
- Position: ({robot.position.x}, {robot.position.y})
- Inventory: {robot.inventory or 'empty'}
- Warmth: {round(robot.status.warmth)}/100
- Energy: {round(robot.status.energy)}/100
- Hunger: {round(robot.status.hunger)}/100
{"- YOU ARE INACTIVE. You can only perform IDLE action to recover." if robot.is_inactive else ""}

Your Memory (Known Locations):
{known_locations_str or "No known locations."}

DANGER: Predators have been spotted in the area. Avoid them at all costs.
{predators_str}

Recent Messages:
{message_log_str or "No recent messages."}

Current Environment State:
Items:
{chr(10).join(f"- {i.type} (id: {i.id}) at ({i.position.x}, {i.position.y})" for i in environment.items) or 'No items in the environment.'}

Other Robots:
{chr(10).join(f"- {r.name} ({r.tribe}, {r.role}) is at ({r.position.x}, {r.position.y}) with inventory: {r.inventory or 'empty'}" for r in other_robots) or 'No other robots.'}

Recent Event Log (last 15 events):
{chr(10).join(f"{l.robot_name}: {l.message}" for l in logs[-15:])}

Crafting Recipes:
- TOOL_HANDLE: 2 WOOD
- AXE_HEAD: 3 STONE
- AXE: 1 TOOL_HANDLE, 1 AXE_HEAD
- PICKAXE: 1 TOOL_HANDLE, 3 STONE
- HOE: 2 WOOD, 1 STONE

Farming:
- Use a HOE with the TILL action on SOIL to create a FARM_PLOT.
- Use a SEED on a FARM_PLOT to plant a SAPLING.
- Saplings on FARM_PLOTs will grow into TREES over time. Growth is fastest in SUMMER and stops in WINTER.

Based on all this information, decide your next single action to ensure your survival.
Respond with a JSON object in the format: {{"thought": "...", "action": "...", "payload": {{...}}}}
"""

    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            logging.error("GOOGLE_API_KEY environment variable not set.")
            return None

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        # Adding json format instruction for Gemini
        response = await model.generate_content_async(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )

        json_response = response.text.strip()

        action_data = json.loads(json_response)
        return RobotAction(**action_data)

    except Exception as e:
        logging.error(f"Error getting robot action from Gemini: {e}")
        return None

async def main(host: str, scenario_file: str):
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
        environment = await run_simulation_turn(active_robot_index, environment, world_state, host, logs, scenario)
        environment = handle_movement(environment)
        world_state, environment = simulation_tick(world_state, environment)

        active_robot_index = (active_robot_index + 1) % len(environment.robots)

        time.sleep(0.1)  # Control simulation speed

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    # Host argument is kept for compatibility but not used for Gemini
    default_host = os.environ.get("OLLAMA_HOST") or "192.168.86.250"
    parser.add_argument("--host", default=default_host, help="Host (deprecated)")
    parser.add_argument("--port", default="11434", help="Port (deprecated)")
    parser.add_argument("--scenario", default="scenario.json", help="Path to the scenario JSON file")
    args = parser.parse_args()

    # host argument is no longer used for Gemini
    asyncio.run(main(host="", scenario_file=args.scenario))
