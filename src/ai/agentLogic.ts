import { GoogleGenAI, Type } from '@google/genai';
import { Agent, Entity, ResourceInventory, SocialEvent, SocialObligation, TileType } from '../store';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Decision = { action: string; targetId?: string; targetAgentId?: string; targetX?: number; targetY?: number; thought: string; buildType?: string; placeType?: string; currentProject?: string };

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function summarizeEntities(agent: Agent, entities: Entity[]) {
  const byType = new Map<string, Entity[]>();
  for (const entity of entities) {
    if (!byType.has(entity.type)) byType.set(entity.type, []);
    byType.get(entity.type)!.push(entity);
  }

  const order: Entity['type'][] = ['tree', 'rock', 'workstation', 'chest', 'bed', 'food', 'farm'];
  return order
    .map((type) => {
      const matches = (byType.get(type) || [])
        .sort((a, b) => distance(agent.x, agent.y, a.x, a.y) - distance(agent.x, agent.y, b.x, b.y))
        .slice(0, 3);
      if (matches.length === 0) return null;
      return `${type}: ${matches
        .map((entity) => {
          if (entity.type === 'chest') {
            const inv = entity.inventory || { wood: 0, stone: 0, axes: 0, weapons: 0 };
            return `${entity.id} at (${entity.x},${entity.y}) chest[wood ${inv.wood}, stone ${inv.stone}, axes ${inv.axes}, weapons ${inv.weapons}]`;
          }
          return `${entity.id} at (${entity.x},${entity.y})`;
        })
        .join(' ; ')}`;
    })
    .filter(Boolean)
    .join('\n');
}

function summarizeAgents(agent: Agent, agents: Agent[]) {
  return agents
    .filter((other) => other.id !== agent.id)
    .sort((a, b) => distance(agent.x, agent.y, a.x, a.y) - distance(agent.x, agent.y, b.x, b.y))
    .slice(0, 4)
    .map((other) => {
      const relationship = agent.relationships?.[other.id];
      return `${other.name} id ${other.id} at (${other.x},${other.y}) traits [${other.traits.join(', ') || 'None'}] inventory [${inventoryLine(other.inventory)}]${relationship ? ` trust ${relationship.trust} respect ${relationship.respect}` : ''}`;
    })
    .join('\n');
}

function buildDecisionBrief(agent: Agent, entities: Entity[], currentTime: number) {
  const inv = agent.inventory || { wood: 0, stone: 0, axes: 0, weapons: 0 };
  const chests = entities.filter((entity) => entity.type === 'chest');
  const workstations = entities.filter((entity) => entity.type === 'workstation');
  const food = entities.filter((entity) => entity.type === 'food');
  const beds = entities.filter((entity) => entity.type === 'bed');
  const trees = entities.filter((entity) => entity.type === 'tree');
  const rocks = entities.filter((entity) => entity.type === 'rock');
  const openObligations = (agent.obligations || []).filter((obligation) => obligation.status === 'open');

  const priorities: string[] = [];
  if (agent.stats.hunger < 40) priorities.push('Hunger is urgent: look for food or farming before optional work.');
  if (agent.stats.energy < 30) priorities.push('Energy is urgent: look for a bed before optional work.');
  if (inv.axes <= 0) {
    const chestWithAxe = chests.find((entity) => (entity.inventory?.axes || 0) > 0);
    const canCraftAxe = inv.wood >= 1 && inv.stone >= 1 && workstations.length > 0;
    const canGatherForAxe = rocks.length > 0 && workstations.length > 0;
    priorities.push('You cannot chop trees without an axe.');
    if (chestWithAxe) priorities.push('Fastest axe path available: retrieve an axe from a chest.');
    if (canCraftAxe) priorities.push('You have materials to craft an axe now at a workstation.');
    if (!chestWithAxe && !canCraftAxe && canGatherForAxe) priorities.push('To get an axe, gather stone and wood, then use a workstation.');
  } else if (trees.length > 0) {
    priorities.push('You already have an axe, so trees are valid targets for wood.');
  }
  if (inv.wood > 0 || inv.stone > 0 || inv.axes > 1 || inv.weapons > 0) {
    priorities.push('If you are carrying useful surplus and a chest exists, storing supplies is often smart.');
  }
  if (openObligations.length > 0) {
    priorities.push(`You have ${openObligations.length} open social obligations. They matter, but they do not override survival.`);
  }
  priorities.push('Do not pick a tree as your next action unless you already have an axe or your immediate plan is to first acquire one.');

  const obligations = openObligations
    .slice(0, 4)
    .map((obligation) => `${obligation.kind} age ${currentTime - obligation.createdAt}: ${obligation.note}`)
    .join(' | ');
  const recentEvents = (agent.socialEvents || [])
    .slice(0, 4)
    .map((event) => `${event.direct ? 'direct' : 'heard'} ${event.type}: ${event.summary}`)
    .join(' | ');

  return {
    priorities: priorities.join('\n'),
    obligations: obligations || 'None',
    recentEvents: recentEvents || 'None'
  };
}

export async function determineAgentAction(
  agent: Agent,
  agents: Agent[],
  entities: Entity[],
  tiles: TileType[][],
  currentTime: number
): Promise<Decision> {
  const visibleEntities = summarizeEntities(agent, entities);
  const visibleAgents = summarizeAgents(agent, agents);
  const inv = agent.inventory || { wood: 0, stone: 0, axes: 0, weapons: 0 };
  const memories = (agent.memories || []).slice(0, 4).join(' | ');
  const decisionBrief = buildDecisionBrief(agent, entities, currentTime);
  
  const prompt = `
You are an AI agent named ${agent.name} in a simulation game.
State
- Stats: hunger ${Math.round(agent.stats.hunger)}, energy ${Math.round(agent.stats.energy)}, fun ${Math.round(agent.stats.fun)}
- Inventory: ${inv.wood} wood, ${inv.stone} stone, ${inv.axes} axes, ${inv.weapons} weapons
- Traits: ${agent.traits.join(', ') || 'None'}
- Position: (${agent.x}, ${agent.y})
- Current project: ${agent.currentProject || 'None'}
- Recent memories: ${memories || 'None'}
- Recent social events: ${decisionBrief.recentEvents}
- Open obligations: ${decisionBrief.obligations}

Decision brief
${decisionBrief.priorities}

Nearby entities
${visibleEntities || 'None'}

Nearby agents
${visibleAgents || 'None'}

Available actions
1. interact(targetId)
2. move(targetX,targetY)
3. build(targetX,targetY,buildType wall/floor/door)
4. place(targetX,targetY,placeType bed/chest/workstation/food/chair/plant/farm/tree)
5. talk(targetAgentId)
6. idle

Rules
- Trees require an axe. If you have 0 axes, do not choose a tree as your immediate interaction target.
- Workstation crafts 1 axe from 1 wood + 1 stone.
- Workstation crafts 1 weapon from 2 wood + 1 stone if you already have an axe.
- Chest can store and retrieve wood, stone, axes, and weapons.
- Bed restores energy. Food restores hunger.
- Obligations matter socially but do not override urgent survival needs.
- Keep your thought short and concrete.
- For multi-step work, keep or update currentProject so you stay consistent.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thought: { type: Type.STRING, description: 'Your inner thought process explaining why you chose this action.' },
            currentProject: { type: Type.STRING, description: 'Update your current project/memory note to stay focused.' },
            action: { type: Type.STRING, description: 'The action to take: "interact", "move", "build", "place", "talk", or "idle"' },
            targetId: { type: Type.STRING, description: 'The ID of the entity to interact with, if action is "interact"' },
            targetAgentId: { type: Type.STRING, description: 'The ID of the agent to talk to, if action is "talk"' },
            targetX: { type: Type.INTEGER, description: 'The X coordinate to move/build/place to' },
            targetY: { type: Type.INTEGER, description: 'The Y coordinate to move/build/place to' },
            buildType: { type: Type.STRING, description: 'The type of tile to build ("wall", "floor", "door"), if action is "build"' },
            placeType: { type: Type.STRING, description: 'The type of entity to place ("bed", "chest", "workstation", "food", "chair", "plant", "farm", "tree"), if action is "place"' }
          },
          required: ['thought', 'action']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error('Failed to get agent action:', error);
    return { action: 'idle', thought: 'I am confused and cannot think right now.' };
  }
}

function inventoryLine(inventory?: ResourceInventory) {
  const inv = inventory || { wood: 0, stone: 0, axes: 0, weapons: 0 };
  return `${inv.wood} wood, ${inv.stone} stone, ${inv.axes} axes, ${inv.weapons} weapons`;
}

function visibleAgentSummary(agent: Agent, other: Agent) {
  const relationship = agent.relationships?.[other.id];
  const openObligations = (agent.obligations || [])
    .filter((obligation) => obligation.status === 'open' && (obligation.owedTo === other.id || obligation.createdBy === other.id))
    .map((obligation) => obligation.note)
    .join(' | ');
  return `${other.name}: traits ${other.traits.join(', ') || 'None'}, inventory ${inventoryLine(other.inventory)}, current project ${other.currentProject || 'None'}${relationship ? `, trust ${relationship.trust}, respect ${relationship.respect}, last ${relationship.lastInteraction}` : ''}${openObligations ? `, open social context ${openObligations}` : ''}`;
}

export async function generateAgentConversation(
  speaker: Agent,
  listener: Agent,
  currentTime: number
): Promise<{
  speakerLine: string;
  listenerLine: string;
  speakerThought: string;
  listenerThought: string;
  speakerMemory?: string;
  listenerMemory?: string;
  socialEventType?: SocialEvent['type'];
  eventSummary?: string;
  emotionalWeight?: number;
  speakerTrustDelta?: number;
  listenerTrustDelta?: number;
  speakerRespectDelta?: number;
  listenerRespectDelta?: number;
  promise?: { creator: 'speaker' | 'listener'; kind: SocialObligation['kind']; note: string };
  itemTransfer?: { from: 'speaker' | 'listener'; to: 'speaker' | 'listener'; resource: keyof ResourceInventory; amount: number };
}> {
  const speakerEvents = (speaker.socialEvents || []).slice(0, 5).map((event) => `${event.direct ? 'direct' : 'heard'} ${event.type}: ${event.summary}`).join(' | ');
  const listenerEvents = (listener.socialEvents || []).slice(0, 5).map((event) => `${event.direct ? 'direct' : 'heard'} ${event.type}: ${event.summary}`).join(' | ');
  const prompt = `
You are simulating a short in-world conversation between two autonomous game agents.

Speaker:
${visibleAgentSummary(speaker, listener)}

Listener:
${visibleAgentSummary(listener, speaker)}

Speaker recent events: ${speakerEvents || 'None'}
Listener recent events: ${listenerEvents || 'None'}
Current time: ${currentTime}

Write a natural two-line exchange. Do not summarize with generic words like chatted, gossiped, coordinated, or discussed. Write what they actually say in character.
The conversation can be practical, social, manipulative, suspicious, friendly, demanding, or trivial.
If nothing important happens, keep it light and natural.
Only create a promise or item transfer if the dialogue supports it and the inventories make sense.
Memories should be what each agent personally chooses to remember, not a narrator summary.
Trust/respect changes should be small and grounded in the exchange.

Return JSON only.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speakerLine: { type: Type.STRING },
            listenerLine: { type: Type.STRING },
            speakerThought: { type: Type.STRING },
            listenerThought: { type: Type.STRING },
            speakerMemory: { type: Type.STRING },
            listenerMemory: { type: Type.STRING },
            socialEventType: { type: Type.STRING },
            eventSummary: { type: Type.STRING },
            emotionalWeight: { type: Type.INTEGER },
            speakerTrustDelta: { type: Type.INTEGER },
            listenerTrustDelta: { type: Type.INTEGER },
            speakerRespectDelta: { type: Type.INTEGER },
            listenerRespectDelta: { type: Type.INTEGER },
            promise: {
              type: Type.OBJECT,
              properties: {
                creator: { type: Type.STRING },
                kind: { type: Type.STRING },
                note: { type: Type.STRING }
              }
            },
            itemTransfer: {
              type: Type.OBJECT,
              properties: {
                from: { type: Type.STRING },
                to: { type: Type.STRING },
                resource: { type: Type.STRING },
                amount: { type: Type.INTEGER }
              }
            }
          },
          required: ['speakerLine', 'listenerLine', 'speakerThought', 'listenerThought']
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Failed to generate conversation:', error);
    return {
      speakerLine: `Need anything, ${listener.name}?`,
      listenerLine: `Not sure yet. I am still figuring things out.`,
      speakerThought: `I tried to start a conversation with ${listener.name}.`,
      listenerThought: `${speaker.name} tried to talk to me.`
    };
  }
}
