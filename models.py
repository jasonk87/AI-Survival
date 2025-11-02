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
    TOOL_HANDLE = 'TOOL_HANDLE'
    AXE_HEAD = 'AXE_HEAD'

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
    CRAFT = 'CRAFT'
    GIVE = 'GIVE'

class Role(str, Enum):
    WOODCUTTER = 'WOODCUTTER'
    MINER = 'MINER'
    EXPLORER = 'EXPLORER'

class RobotMemory(BaseModel):
    known_locations: dict[str, Position] = {}

class Robot(BaseItem):
    type: ItemType = ItemType.ROBOT
    name: str
    inventory: dict[ItemType, int] = {}
    color: str
    tribe: str
    role: Optional[Role] = None
    path: Optional[List[Position]] = None
    status: RobotStatus = RobotStatus()
    is_inactive: bool = False
    current_action: Optional[ActionType] = None
    memory: RobotMemory = RobotMemory()
    speed: int = 1

class EnvironmentItem(BaseItem):
    durability: Optional[int] = None

class EnvironmentState(BaseModel):
    items: List[EnvironmentItem]
    robots: List[Robot]
    predators: List[Predator] = []

Direction = Literal['UP', 'DOWN', 'LEFT', 'RIGHT']

class RobotActionPayload(BaseModel):
    direction: Optional[Direction] = None
    message: Optional[str] = None
    target_id: Optional[str] = None
    target_position: Optional[Position] = None
    memory_name: Optional[str] = None
    memory_position: Optional[Position] = None
    item_to_craft: Optional[ItemType] = None
    target_robot_id: Optional[str] = None
    item_type: Optional[ItemType] = None

class RobotAction(BaseModel):
    action: ActionType
    payload: RobotActionPayload
    thought: Optional[str] = None

class Scenario(BaseModel):
    grid_size: int
    items: List[EnvironmentItem]
    robots: List[Robot]
    predators: List[Predator] = []

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

class Predator(BaseModel):
    id: str
    position: Position
    is_active: bool = True

class Season(str, Enum):
    SPRING = 'SPRING'
    SUMMER = 'SUMMER'
    AUTUMN = 'AUTUMN'
    WINTER = 'WINTER'

class WorldState(BaseModel):
    day: int = 1
    time_of_day: TimeOfDay = 'Day'
    cycle_progress: float = 25.0
    temperature: int = 20
    weather: WeatherType = WeatherType.CLEAR
    season: Season = Season.SPRING
