// FIX: Create the `getRobotNextAction` function to resolve the export error.
import { GoogleGenAI, Type } from "@google/genai";
import type { EnvironmentState, LogEntry, Robot, RobotAction, WorldState } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';
import { ActionType } from "../types";
import config from '../config.json';

const apiKey = config.GOOGLE_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// According to guidelines, the model for complex reasoning should be gemini-2.5-pro
const model = config.MODEL_NAME || "gemini-1.5-flash";

const responseSchema = {
    type: Type.OBJECT,
    properties: {
      thought: { type: Type.STRING, description: 'Your reasoning for the action.' },
      action: { type: Type.STRING, description: `The action to take. Must be one of: ${Object.values(ActionType).join(', ')}` },
      payload: {
        type: Type.OBJECT,
        properties: {
          direction: {
            type: Type.STRING,
            description: "Direction for MOVE. One of: 'UP', 'DOWN', 'LEFT', 'RIGHT'."
          },
          message: { type: Type.STRING, description: "Message for TALK." },
          targetId: { type: Type.STRING, description: "ID of the target item for PICKUP or USE." },
          targetPosition: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.INTEGER },
              y: { type: Type.INTEGER },
            },
            description: "Target coordinates for GOTO."
          },
        },
      },
    },
    required: ['thought', 'action', 'payload'],
};

export const getRobotNextAction = async (
  robot: Robot,
  environment: EnvironmentState,
  world: WorldState,
  logs: LogEntry[]
): Promise<RobotAction | null> => {
  const otherRobots = environment.robots.filter(r => r.id !== robot.id);

  const prompt = `
World State: Day ${world.day}, Time: ${world.timeOfDay}, Weather: ${world.weather}, Temperature: ${world.temperature}°
  
You are robot ${robot.name} (${robot.color.replace('text-','').replace('-400','')}).
Your primary goal is to survive.

Your current status:
- Position: (${robot.position.x}, ${robot.position.y})
- Inventory: ${robot.inventory || 'empty'}
- Warmth: ${Math.round(robot.status.warmth)}/100
- Energy: ${Math.round(robot.status.energy)}/100
- Hunger: ${Math.round(robot.status.hunger)}/100
${robot.isInactive ? "- YOU ARE INACTIVE. You can only perform IDLE action to recover." : ""}

Current Environment State:
Items:
${environment.items.map(i => `- ${i.type} (id: ${i.id}) at (${i.position.x}, ${i.position.y})`).join('\n') || 'No items in the environment.'}

Other Robots:
${otherRobots.length > 0 ? otherRobots.map(r => `- ${r.name} is at (${r.position.x}, ${r.position.y}) with inventory: ${r.inventory || 'empty'}`).join('\n') : 'No other robots.'}

Recent Event Log (last 15 events):
${logs.slice(-15).map(l => `${l.robotName}: ${l.message}`).join('\n')}

Based on all this information, decide your next single action to ensure your survival. Follow the system instruction precisely.
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      console.error("Gemini API returned empty response text.");
      return null;
    }
    
    const cleanJsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');

    const parsedAction = JSON.parse(cleanJsonText) as RobotAction;
    return parsedAction;

  } catch (error) {
    console.error("Error getting robot action from Gemini API:", error);
    return null;
  }
};