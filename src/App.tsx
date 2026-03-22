/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { GameCanvas } from './components/GameCanvas';
import { AgentPanel } from './components/AgentPanel';
import { TopBar } from './components/TopBar';
import { ResourceInventory, SocialEvent, SocialObligation, useGameStore } from './store';
import { determineAgentAction, generateAgentConversation } from './ai/agentLogic';
import { findPath } from './utils/pathfinding';
import { CORE_ENTITY_ASSETS } from './assets/catalog';
import { v4 as uuidv4 } from 'uuid';

const SIM_TICK_MS = 500;
const TICK_SCALE = SIM_TICK_MS / 1000;
const TREE_RESPAWN_TARGET = 24;
const ROCK_RESPAWN_TARGET = 16;
const TREE_RESPAWN_CHANCE_PER_SECOND = 0.18;
const ROCK_RESPAWN_CHANCE_PER_SECOND = 0.12;
const TALK_RANGE = 2;
const SPEECH_DURATION_TICKS = 12;
const TALK_TIMEOUT_TICKS = 10;

function scaledChance(perSecondChance: number) {
  return 1 - Math.pow(1 - perSecondChance, TICK_SCALE);
}

function makeEmptyInventory(): ResourceInventory {
  return { wood: 0, stone: 0, axes: 0, weapons: 0 };
}

function getTotalInventory(inventory: ResourceInventory) {
  return inventory.wood + inventory.stone + inventory.axes + inventory.weapons;
}

function findEmptySpawnTile(state: ReturnType<typeof useGameStore.getState>) {
  const attempts = 80;

  for (let i = 0; i < attempts; i += 1) {
    const x = Math.floor(Math.random() * state.gridWidth);
    const y = Math.floor(Math.random() * state.gridHeight);
    const blockedByEntity = state.entities.some(
      (entity) => x >= entity.x && x < entity.x + entity.width && y >= entity.y && y < entity.y + entity.height
    );
    const blockedByAgent = state.agents.some((agent) => agent.x === x && agent.y === y);

    if (!blockedByEntity && !blockedByAgent && state.tiles[y][x] !== 'wall' && state.tiles[y][x] !== 'door') {
      return { x, y };
    }
  }

  return null;
}

function getEntityAt(state: ReturnType<typeof useGameStore.getState>, x: number, y: number) {
  return state.entities.find((entity) => x >= entity.x && x < entity.x + entity.width && y >= entity.y && y < entity.y + entity.height);
}

function updateRelationship(agent: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>, targetAgentId: string, trustDelta: number, respectDelta: number, lastInteraction: string) {
  const current = agent.relationships?.[targetAgentId] || { trust: 0, respect: 0 };
  return {
    ...(agent.relationships || {}),
    [targetAgentId]: {
      trust: Math.max(-5, Math.min(5, current.trust + trustDelta)),
      respect: Math.max(-5, Math.min(5, current.respect + respectDelta)),
      lastInteraction
    }
  };
}

function addMemory(agent: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>, memory: string) {
  const existing = agent.memories || [];
  return [memory, ...existing.filter((entry) => entry !== memory)].slice(0, 6);
}

function addSocialEvent(existing: SocialEvent[] | undefined, event: SocialEvent) {
  const currentEvents = existing || [];
  return [event, ...currentEvents.filter((entry) => entry.id !== event.id)].slice(0, 12);
}

function areAdjacent(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
}

function areCloseEnoughToTalk(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= TALK_RANGE;
}

function clampSocialDelta(value: number | undefined, min = -2, max = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeSpeech(line: string | undefined, fallback: string) {
  if (!line) return fallback;
  return line.replace(/\s+/g, ' ').trim().slice(0, 90) || fallback;
}

function findTalkTile(
  state: ReturnType<typeof useGameStore.getState>,
  speaker: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>,
  listener: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>
) {
  const candidates: { x: number; y: number; score: number }[] = [];

  for (let dy = -TALK_RANGE; dy <= TALK_RANGE; dy += 1) {
    for (let dx = -TALK_RANGE; dx <= TALK_RANGE; dx += 1) {
      const x = listener.x + dx;
      const y = listener.y + dy;
      if (x < 0 || y < 0 || x >= state.gridWidth || y >= state.gridHeight) continue;
      if (x === listener.x && y === listener.y) continue;
      if (!areCloseEnoughToTalk({ x, y }, listener)) continue;
      if (state.tiles[y][x] === 'wall' || state.tiles[y][x] === 'door') continue;

      const blockedByEntity = state.entities.some(
        (entity) => x >= entity.x && x < entity.x + entity.width && y >= entity.y && y < entity.y + entity.height
      );
      const blockedByAgent = state.agents.some((agent) => agent.id !== speaker.id && agent.id !== listener.id && agent.x === x && agent.y === y);
      if (blockedByEntity || blockedByAgent) continue;

      const score = Math.abs(speaker.x - x) + Math.abs(speaker.y - y);
      candidates.push({ x, y, score });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || null;
}

function getObligationAge(currentTime: number, obligation: SocialObligation) {
  return currentTime - obligation.createdAt;
}

function getTraitBias(agent: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>, positive: boolean) {
  let score = 0;

  if (agent.traits.includes('Optimist')) score += positive ? 2 : -1;
  if (agent.traits.includes('Pessimist')) score += positive ? -1 : 2;
  if (agent.traits.includes('Hardworker')) {
    score += positive ? 1 : 0;
  }
  if (agent.traits.includes('Lazy')) {
    score += positive ? 0 : 1;
  }

  return score;
}

function getGossipScore(
  speaker: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>,
  listenerId: string,
  event: SocialEvent,
  currentTime: number
) {
  const subjectId = event.subjectAgentId || event.sourceAgentId;
  if (!subjectId || subjectId === listenerId || subjectId === speaker.id || event.type === 'gossip') {
    return Number.NEGATIVE_INFINITY;
  }

  const speakerToSubject = speaker.relationships?.[subjectId];
  const speakerToListener = speaker.relationships?.[listenerId];
  const positive = event.emotionalWeight > 0;
  const age = currentTime - event.time;
  const recencyScore = Math.max(0, 8 - Math.floor(age / 20));
  const intensityScore = Math.abs(event.emotionalWeight) * 3;
  const traitScore = getTraitBias(speaker, positive);
  const subjectAffinityScore = positive
    ? (speakerToSubject?.trust || 0) + (speakerToSubject?.respect || 0)
    : -((speakerToSubject?.trust || 0) + (speakerToSubject?.respect || 0));
  const listenerTrustScore = (speakerToListener?.trust || 0) + Math.max(0, speakerToListener?.respect || 0);

  return intensityScore + recencyScore + traitScore + subjectAffinityScore + listenerTrustScore;
}

function getStructuredGossip(
  speaker: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>,
  listenerId: string,
  currentTime: number
) {
  const candidates = (speaker.socialEvents || [])
    .map((event) => ({
      event,
      score: getGossipScore(speaker, listenerId, event, currentTime)
    }))
    .filter((entry) => entry.score > 2)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.event;
}

function propagateGossipEvent(
  listener: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>,
  speaker: NonNullable<ReturnType<typeof useGameStore.getState>['agents'][number]>,
  event: SocialEvent,
  time: number
) {
  const subjectId = event.subjectAgentId || event.sourceAgentId;
  const heardEvent: SocialEvent = {
    id: uuidv4(),
    type: 'gossip',
    time,
    sourceAgentId: speaker.id,
    targetAgentId: listener.id,
    subjectAgentId: subjectId,
    obligationId: event.obligationId,
    summary: `${speaker.name} said: ${event.summary}`,
    direct: false,
    emotionalWeight: Math.max(-2, Math.min(2, Math.round(event.emotionalWeight / 2)))
  };

  const relationshipDelta = heardEvent.emotionalWeight;
  const relationship = subjectId
    ? updateRelationship(
        listener,
        subjectId,
        relationshipDelta,
        relationshipDelta < 0 ? -1 : relationshipDelta > 0 ? 1 : 0,
        `Heard from ${speaker.name}: ${event.summary}`
      )
    : listener.relationships || {};

  return {
    heardEvent,
    relationships: relationship
  };
}

export default function App() {
  const { isSimulating } = useGameStore();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const state = useGameStore.getState();
      state.tick();
      const stateAfterTick = useGameStore.getState();

      for (const simAgent of stateAfterTick.agents) {
        if (simAgent.speechUntil !== null && simAgent.speechUntil !== undefined && simAgent.speechUntil <= stateAfterTick.time && simAgent.speechBubble) {
          stateAfterTick.updateAgent(simAgent.id, {
            speechBubble: null,
            speechUntil: null
          });
        }
        if (simAgent.currentAction === 'talking') {
          const targetAgent = simAgent.targetAgentId
            ? stateAfterTick.agents.find((candidate) => candidate.id === simAgent.targetAgentId)
            : null;
          const timedOut = simAgent.talkingSince !== null && simAgent.talkingSince !== undefined && stateAfterTick.time - simAgent.talkingSince > TALK_TIMEOUT_TICKS;
          const lostTarget = simAgent.targetAgentId && !targetAgent;
          if (timedOut || lostTarget) {
            stateAfterTick.updateAgent(simAgent.id, {
              currentAction: 'idle',
              targetX: null,
              targetY: null,
              targetAgentId: null,
              path: null,
              talkingSince: null
            });
          }
        }
      }

      if (stateAfterTick.time % 20 === 0) {
        for (const simAgent of stateAfterTick.agents) {
          let updatedRelationships = simAgent.relationships || {};
          let updatedMemories = simAgent.memories || [];
          let updatedSocialEvents = simAgent.socialEvents || [];
          let changed = false;

          for (const obligation of simAgent.obligations || []) {
            if (obligation.status !== 'open') continue;
            const age = getObligationAge(stateAfterTick.time, obligation);
            if (age < 80) continue;
            if (obligation.lastDiscussedAt && stateAfterTick.time - obligation.lastDiscussedAt < 40) continue;

            const owner = stateAfterTick.agents.find((candidate) => candidate.id === obligation.createdBy);
            if (!owner) continue;

            const relationship = updatedRelationships[owner.id] || { trust: 0, respect: 0 };
            updatedRelationships = {
              ...updatedRelationships,
              [owner.id]: {
                trust: Math.max(-5, relationship.trust - 1),
                respect: Math.max(-5, relationship.respect - 1),
                lastInteraction: `Promise aging poorly: ${obligation.note}`
              }
            };
            const overdueEvent: SocialEvent = {
              id: uuidv4(),
              type: 'promise_overdue',
              time: stateAfterTick.time,
              sourceAgentId: simAgent.id,
              targetAgentId: owner.id,
              subjectAgentId: simAgent.id,
              obligationId: obligation.id,
              summary: `${simAgent.name} is overdue on a promise to ${owner.name}: ${obligation.note}`,
              direct: true,
              emotionalWeight: -2
            };
            updatedMemories = addMemory(simAgent, `I am falling behind on a promise to ${owner.name}: ${obligation.note}`);
            updatedSocialEvents = addSocialEvent(updatedSocialEvents, overdueEvent);
            obligation.lastDiscussedAt = stateAfterTick.time;
            changed = true;

            const ownerRelationships = updateRelationship(owner, simAgent.id, -1, -1, `Overdue promise: ${obligation.note}`);
            const ownerEvent: SocialEvent = {
              id: uuidv4(),
              type: 'promise_overdue',
              time: stateAfterTick.time,
              sourceAgentId: simAgent.id,
              targetAgentId: owner.id,
              subjectAgentId: simAgent.id,
              obligationId: obligation.id,
              summary: `${simAgent.name} has not yet fulfilled a promise to ${owner.name}: ${obligation.note}`,
              direct: true,
              emotionalWeight: -2
            };

            stateAfterTick.updateAgent(owner.id, {
              relationships: ownerRelationships,
              memories: addMemory(owner, `${simAgent.name} is overdue on a promise to me: ${obligation.note}`),
              socialEvents: addSocialEvent(owner.socialEvents, ownerEvent)
            });
          }

          if (changed) {
            stateAfterTick.updateAgent(simAgent.id, {
              relationships: updatedRelationships,
              memories: updatedMemories,
              socialEvents: updatedSocialEvents
            });
          }
        }
      }

      const treeCount = state.entities.filter((entity) => entity.type === 'tree').length;
        if (treeCount < TREE_RESPAWN_TARGET && Math.random() < scaledChance(TREE_RESPAWN_CHANCE_PER_SECOND)) {
          const spawn = findEmptySpawnTile(state);
          if (spawn) {
          state.addEntity({ type: 'tree', x: spawn.x, y: spawn.y, width: 1, height: 1, name: 'Tree', assetId: CORE_ENTITY_ASSETS.tree.id, assetCategory: CORE_ENTITY_ASSETS.tree.category });
        }
      }

      const rockCount = state.entities.filter((entity) => entity.type === 'rock').length;
      if (rockCount < ROCK_RESPAWN_TARGET && Math.random() < scaledChance(ROCK_RESPAWN_CHANCE_PER_SECOND)) {
        const spawn = findEmptySpawnTile(state);
        if (spawn) {
          state.addEntity({ type: 'rock', x: spawn.x, y: spawn.y, width: 1, height: 1, name: 'Rock', assetId: CORE_ENTITY_ASSETS.rock.id, assetCategory: CORE_ENTITY_ASSETS.rock.category });
        }
      }

      // Process agents
      for (const agent of state.agents) {
        if (agent.currentAction === 'moving_to_talk' && agent.targetAgentId) {
          const targetAgent = state.agents.find((candidate) => candidate.id === agent.targetAgentId);
          if (targetAgent?.currentAction === 'talking') {
            state.updateAgent(agent.id, {
              currentAction: 'idle',
              targetX: null,
              targetY: null,
              targetAgentId: null,
              path: null
            });
            continue;
          }
          if (targetAgent && areCloseEnoughToTalk(agent, targetAgent)) {
            state.updateAgent(agent.id, {
              currentAction: 'talking',
              path: null,
              talkingSince: state.time
            });
            state.updateAgent(targetAgent.id, {
              currentAction: 'talking',
              path: null,
              talkingSince: state.time
            });

            generateAgentConversation(agent, targetAgent, state.time).then((result) => {
              const currentState = useGameStore.getState();
              const currentSpeaker = currentState.agents.find((candidate) => candidate.id === agent.id);
              const currentListener = currentState.agents.find((candidate) => candidate.id === targetAgent.id);
              if (!currentSpeaker || !currentListener) {
                if (currentSpeaker) {
                  currentState.updateAgent(currentSpeaker.id, { currentAction: 'idle', targetX: null, targetY: null, targetAgentId: null, path: null, talkingSince: null });
                }
                if (currentListener) {
                  currentState.updateAgent(currentListener.id, { currentAction: 'idle', targetX: null, targetY: null, targetAgentId: null, path: null, talkingSince: null });
                }
                return;
              }

              const speakerInventory = { ...(currentSpeaker.inventory || makeEmptyInventory()) };
              const listenerInventory = { ...(currentListener.inventory || makeEmptyInventory()) };
              const speakerObligations = [...(currentSpeaker.obligations || [])];
              const listenerObligations = [...(currentListener.obligations || [])];
              let speakerEvents = [...(currentSpeaker.socialEvents || [])];
              let listenerEvents = [...(currentListener.socialEvents || [])];

              const speakerLine = sanitizeSpeech(result.speakerLine, `Need anything, ${currentListener.name}?`);
              const listenerLine = sanitizeSpeech(result.listenerLine, `Maybe later.`);
              const speakerThought = sanitizeSpeech(result.speakerThought, `I talked with ${currentListener.name}.`);
              const listenerThought = sanitizeSpeech(result.listenerThought, `${currentSpeaker.name} talked with me.`);
              const eventType = result.socialEventType;

              if (result.itemTransfer && result.itemTransfer.amount > 0) {
                const amount = Math.max(1, Math.min(3, Math.round(result.itemTransfer.amount)));
                const resource = result.itemTransfer.resource;
                const fromInventory = result.itemTransfer.from === 'speaker' ? speakerInventory : listenerInventory;
                const toInventory = result.itemTransfer.to === 'speaker' ? speakerInventory : listenerInventory;

                if (resource in fromInventory && resource in toInventory && fromInventory[resource] >= amount) {
                  fromInventory[resource] -= amount;
                  toInventory[resource] += amount;
                }
              }

              if (result.promise && ['deliver_wood', 'deliver_stone', 'craft_axe'].includes(result.promise.kind)) {
                const obligation: SocialObligation = {
                  id: uuidv4(),
                  kind: result.promise.kind,
                  owedTo: result.promise.creator === 'speaker' ? currentListener.id : currentSpeaker.id,
                  createdBy: result.promise.creator === 'speaker' ? currentSpeaker.id : currentListener.id,
                  status: 'open',
                  note: result.promise.note?.trim() || `${result.promise.creator === 'speaker' ? currentSpeaker.name : currentListener.name} made a promise.`,
                  createdAt: currentState.time
                };

                if (result.promise.creator === 'speaker') {
                  speakerObligations.push(obligation);
                } else {
                  listenerObligations.push(obligation);
                }
              }

              if (eventType && ['promise_made', 'promise_kept', 'promise_overdue', 'trade', 'gift', 'coordination', 'gossip'].includes(eventType)) {
                const summary = result.eventSummary?.trim() || `${currentSpeaker.name} to ${currentListener.name}: ${speakerLine} / ${listenerLine}`;
                const emotionalWeight = clampSocialDelta(result.emotionalWeight, -3, 3);
                const baseEvent: SocialEvent = {
                  id: uuidv4(),
                  type: eventType as SocialEvent['type'],
                  time: currentState.time,
                  sourceAgentId: currentSpeaker.id,
                  targetAgentId: currentListener.id,
                  subjectAgentId: currentSpeaker.id,
                  summary,
                  direct: true,
                  emotionalWeight
                };
                speakerEvents = addSocialEvent(speakerEvents, baseEvent);
                listenerEvents = addSocialEvent(listenerEvents, {
                  ...baseEvent,
                  id: uuidv4(),
                  subjectAgentId: currentListener.id
                });
              }

              currentState.updateAgent(currentSpeaker.id, {
                currentAction: 'idle',
                targetX: null,
                targetY: null,
                targetAgentId: null,
                path: null,
                inventory: speakerInventory,
                lastThought: speakerThought,
                speechBubble: speakerLine,
                speechUntil: currentState.time + SPEECH_DURATION_TICKS,
                socialCooldownUntil: currentState.time + 16,
                talkingSince: null,
                memories: result.speakerMemory ? addMemory(currentSpeaker, result.speakerMemory) : currentSpeaker.memories,
                relationships: updateRelationship(
                  currentSpeaker,
                  currentListener.id,
                  clampSocialDelta(result.speakerTrustDelta),
                  clampSocialDelta(result.speakerRespectDelta),
                  speakerLine
                ),
                obligations: speakerObligations,
                socialEvents: speakerEvents
              });
              currentState.updateAgent(currentListener.id, {
                currentAction: currentListener.currentAction === 'moving_to_talk' ? 'idle' : currentListener.currentAction,
                targetX: currentListener.currentAction === 'moving_to_talk' ? null : currentListener.targetX,
                targetY: currentListener.currentAction === 'moving_to_talk' ? null : currentListener.targetY,
                targetAgentId: currentListener.currentAction === 'moving_to_talk' ? null : currentListener.targetAgentId,
                path: currentListener.currentAction === 'moving_to_talk' ? null : currentListener.path,
                inventory: listenerInventory,
                lastThought: listenerThought,
                speechBubble: listenerLine,
                speechUntil: currentState.time + SPEECH_DURATION_TICKS,
                socialCooldownUntil: currentState.time + 16,
                talkingSince: null,
                memories: result.listenerMemory ? addMemory(currentListener, result.listenerMemory) : currentListener.memories,
                relationships: updateRelationship(
                  currentListener,
                  currentSpeaker.id,
                  clampSocialDelta(result.listenerTrustDelta),
                  clampSocialDelta(result.listenerRespectDelta),
                  listenerLine
                ),
                obligations: listenerObligations,
                socialEvents: listenerEvents
              });
            });
            continue;
          }
        }

        // If agent has a path, move them
        if (agent.path && agent.path.length > 0) {
          const nextStep = agent.path[0];
          state.updateAgent(agent.id, {
            x: nextStep.x,
            y: nextStep.y,
            path: agent.path.slice(1)
          });
          continue;
        }

        // If agent arrived at target, perform action
        if (agent.targetX !== null && agent.targetY !== null && agent.x === agent.targetX && agent.y === agent.targetY) {
          if (agent.currentAction === 'moving_to_build' && agent.buildType) {
            const inv = { ...(agent.inventory || makeEmptyInventory()) };
            let canBuild = false;
            if ((agent.buildType === 'wall' || agent.buildType === 'door') && inv.wood >= 1) {
              inv.wood -= 1;
              canBuild = true;
            } else if (agent.buildType === 'floor' && inv.stone >= 1) {
              inv.stone -= 1;
              canBuild = true;
            }

            if (canBuild) {
              state.setTile(agent.targetX, agent.targetY, agent.buildType as any);
              state.updateAgent(agent.id, { currentAction: 'idle', targetX: null, targetY: null, buildType: undefined, inventory: inv });
            } else {
              state.updateAgent(agent.id, { currentAction: 'idle', targetX: null, targetY: null, buildType: undefined, lastThought: "Not enough resources to build." });
            }
            continue;
          }
          if (agent.currentAction === 'moving_to_place' && agent.placeType) {
            let width = 1;
            let height = 1;
            if (agent.placeType === 'bed' || agent.placeType === 'farm') {
              width = 2;
              height = 2;
            } else if (agent.placeType === 'workstation') {
              width = 2;
              height = 1;
            }
            const coreAsset = agent.placeType ? CORE_ENTITY_ASSETS[agent.placeType as keyof typeof CORE_ENTITY_ASSETS] : undefined;
            const entityConfig = agent.placeType === 'chest'
              ? { inventory: makeEmptyInventory(), capacity: 12 }
              : {};
            state.addEntity({
              type: agent.placeType as any,
              x: agent.targetX,
              y: agent.targetY,
              width,
              height,
              name: coreAsset?.name || agent.placeType,
              assetId: coreAsset?.id,
              assetCategory: coreAsset?.category,
              ...entityConfig
            });
            state.updateAgent(agent.id, { currentAction: 'idle', targetX: null, targetY: null, placeType: undefined });
            continue;
          }
          if (agent.currentAction === 'moving_to_interact') {
            const targetEntity = getEntityAt(state, agent.targetX, agent.targetY);
            
            if (targetEntity) {
              if (targetEntity.type === 'tree') {
                const inv = agent.inventory || makeEmptyInventory();
                if (inv.axes <= 0) {
                  state.updateAgent(agent.id, {
                    currentAction: 'idle',
                    targetX: null,
                    targetY: null,
                    lastThought: 'I need an axe before I can chop this tree.'
                  });
                  continue;
                }
                state.removeEntity(targetEntity.id);
                state.updateAgent(agent.id, {
                  currentAction: 'idle',
                  targetX: null,
                  targetY: null,
                  inventory: { ...inv, wood: inv.wood + 1 }
                });
                continue;
              }
              if (targetEntity.type === 'rock') {
                state.removeEntity(targetEntity.id);
                const inv = agent.inventory || makeEmptyInventory();
                state.updateAgent(agent.id, {
                  currentAction: 'idle',
                  targetX: null,
                  targetY: null,
                  inventory: { ...inv, stone: inv.stone + 1 }
                });
                continue;
              }
              if (targetEntity.type === 'chest') {
                const chestInventory = { ...(targetEntity.inventory || makeEmptyInventory()) };
                const chestCapacity = targetEntity.capacity ?? 12;
                const carriedInventory = { ...(agent.inventory || makeEmptyInventory()) };
                const chestSpace = Math.max(0, chestCapacity - getTotalInventory(chestInventory));

                if (getTotalInventory(carriedInventory) > 0 && chestSpace > 0) {
                  let remainingSpace = chestSpace;
                  const woodToDeposit = Math.min(carriedInventory.wood, remainingSpace);
                  chestInventory.wood += woodToDeposit;
                  carriedInventory.wood -= woodToDeposit;
                  remainingSpace -= woodToDeposit;

                  const stoneToDeposit = Math.min(carriedInventory.stone, remainingSpace);
                  chestInventory.stone += stoneToDeposit;
                  carriedInventory.stone -= stoneToDeposit;
                  remainingSpace -= stoneToDeposit;

                  const axesToDeposit = Math.min(carriedInventory.axes, remainingSpace);
                  chestInventory.axes += axesToDeposit;
                  carriedInventory.axes -= axesToDeposit;
                  remainingSpace -= axesToDeposit;

                  const weaponsToDeposit = Math.min(carriedInventory.weapons, remainingSpace);
                  chestInventory.weapons += weaponsToDeposit;
                  carriedInventory.weapons -= weaponsToDeposit;

                  state.updateEntity(targetEntity.id, { inventory: chestInventory });
                  state.updateAgent(agent.id, {
                    currentAction: 'idle',
                    targetX: null,
                    targetY: null,
                    inventory: carriedInventory,
                    lastThought: 'Stored supplies in the chest.'
                  });
                  continue;
                }

                if (chestInventory.wood > 0 || chestInventory.stone > 0 || chestInventory.axes > 0 || chestInventory.weapons > 0) {
                  const needsAxe = carriedInventory.axes <= 0 && chestInventory.axes > 0;
                  const needWood = carriedInventory.wood <= carriedInventory.stone;
                  if (needsAxe) {
                    chestInventory.axes -= 1;
                    carriedInventory.axes += 1;
                  } else if (needWood && chestInventory.wood > 0) {
                    chestInventory.wood -= 1;
                    carriedInventory.wood += 1;
                  } else if (chestInventory.stone > 0) {
                    chestInventory.stone -= 1;
                    carriedInventory.stone += 1;
                  } else if (chestInventory.weapons > 0) {
                    chestInventory.weapons -= 1;
                    carriedInventory.weapons += 1;
                  } else if (chestInventory.axes > 0) {
                    chestInventory.axes -= 1;
                    carriedInventory.axes += 1;
                  } else if (chestInventory.wood > 0) {
                    chestInventory.wood -= 1;
                    carriedInventory.wood += 1;
                  }

                  state.updateEntity(targetEntity.id, { inventory: chestInventory });
                  state.updateAgent(agent.id, {
                    currentAction: 'idle',
                    targetX: null,
                    targetY: null,
                    inventory: carriedInventory,
                    lastThought: 'Took supplies from the chest.'
                  });
                  continue;
                }

                state.updateAgent(agent.id, {
                  currentAction: 'idle',
                  targetX: null,
                  targetY: null,
                  lastThought: 'The chest is empty.'
                });
                continue;
              }

              let newAction = 'idle';
              if (targetEntity.type === 'bed') newAction = 'sleeping';
              if (targetEntity.type === 'food') {
                newAction = 'eating';
                state.removeEntity(targetEntity.id);
              }
              if (targetEntity.type === 'workstation') {
                const inv = { ...(agent.inventory || makeEmptyInventory()) };
                if (inv.axes <= 0 && inv.wood >= 1 && inv.stone >= 1) {
                  inv.wood -= 1;
                  inv.stone -= 1;
                  inv.axes += 1;
                  state.updateAgent(agent.id, {
                    currentAction: 'idle',
                    targetX: null,
                    targetY: null,
                    inventory: inv,
                    lastThought: 'Crafted an axe at the workstation.'
                  });
                  continue;
                }
                if (inv.wood >= 2 && inv.stone >= 1) {
                  inv.wood -= 2;
                  inv.stone -= 1;
                  inv.weapons += 1;
                  state.updateAgent(agent.id, {
                    currentAction: 'idle',
                    targetX: null,
                    targetY: null,
                    inventory: inv,
                    lastThought: 'Crafted a weapon at the workstation.'
                  });
                  continue;
                }
                newAction = 'working';
              }
              if (targetEntity.type === 'farm') newAction = 'farming';
              
              state.updateAgent(agent.id, {
                currentAction: newAction,
                targetX: null,
                targetY: null
              });
            } else {
              state.updateAgent(agent.id, { currentAction: 'idle', targetX: null, targetY: null });
            }
          } else {
             state.updateAgent(agent.id, { currentAction: 'idle', targetX: null, targetY: null });
          }
          continue;
        }

        // If agent is doing something, maybe finish it
        if (agent.currentAction === 'sleeping') {
          if (agent.stats.energy >= 100) {
            state.updateAgent(agent.id, { currentAction: 'idle' });
          } else {
            state.updateAgent(agent.id, { stats: { ...agent.stats, energy: Math.min(100, agent.stats.energy + 10 * TICK_SCALE) } });
          }
          continue;
        }
        if (agent.currentAction === 'eating') {
          if (agent.stats.hunger >= 100) {
            state.updateAgent(agent.id, { currentAction: 'idle' });
          } else {
            state.updateAgent(agent.id, { stats: { ...agent.stats, hunger: Math.min(100, agent.stats.hunger + 20 * TICK_SCALE) } });
          }
          continue;
        }
        if (agent.currentAction === 'working') {
          if (agent.stats.energy <= 10 || agent.stats.fun <= 10) {
            state.updateAgent(agent.id, { currentAction: 'idle' });
          } else {
            state.updateAgent(agent.id, { stats: { ...agent.stats, energy: Math.max(0, agent.stats.energy - 5 * TICK_SCALE), fun: Math.max(0, agent.stats.fun - 5 * TICK_SCALE) } });
          }
          continue;
        }
        if (agent.currentAction === 'farming') {
          if (agent.stats.energy <= 10) {
            state.updateAgent(agent.id, { currentAction: 'idle' });
          } else {
            // Farming produces food occasionally
            if (Math.random() < scaledChance(0.1)) {
              // Find empty spot near agent
              let placed = false;
              for (let dy = -1; dy <= 1 && !placed; dy++) {
                for (let dx = -1; dx <= 1 && !placed; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nx = agent.x + dx;
                  const ny = agent.y + dy;
                  if (nx >= 0 && nx < state.gridWidth && ny >= 0 && ny < state.gridHeight) {
                    const hasEntity = state.entities.some(e => nx >= e.x && nx < e.x + e.width && ny >= e.y && ny < e.y + e.height);
                    if (!hasEntity && state.tiles[ny][nx] !== 'wall') {
                      state.addEntity({
                        type: 'food',
                        x: nx,
                        y: ny,
                        width: 1,
                        height: 1,
                        name: CORE_ENTITY_ASSETS.food.name,
                        assetId: CORE_ENTITY_ASSETS.food.id,
                        assetCategory: CORE_ENTITY_ASSETS.food.category
                      });
                      placed = true;
                    }
                  }
                }
              }
            }
            state.updateAgent(agent.id, { stats: { ...agent.stats, energy: Math.max(0, agent.stats.energy - 5 * TICK_SCALE) } });
          }
          continue;
        }

        // If idle, ask AI
        if (agent.currentAction === 'idle' || !agent.currentAction) {
          if (agent.socialCooldownUntil && state.time < agent.socialCooldownUntil) continue;
          // Don't ask too often; preserve roughly the same per-second rate at faster ticks.
          if (Math.random() > scaledChance(0.2)) continue;

          state.updateAgent(agent.id, { currentAction: 'thinking' });
          
          // Fire and forget the AI call so we don't block the simulation loop
          determineAgentAction(agent, state.agents, state.entities, state.tiles, state.time).then(decision => {
            const currentState = useGameStore.getState();
            const currentAgent = currentState.agents.find(a => a.id === agent.id);
            if (!currentAgent || currentAgent.currentAction !== 'thinking') return;

            if (decision.action === 'interact' && decision.targetId) {
              const target = currentState.entities.find(e => e.id === decision.targetId);
              if (target) {
                const path = findPath(currentAgent.x, currentAgent.y, target.x, target.y, currentState.gridWidth, currentState.gridHeight, currentState.tiles);
                currentState.updateAgent(agent.id, {
                currentAction: 'moving_to_interact',
                targetX: target.x,
                targetY: target.y,
                targetAgentId: null,
                path: path,
                lastThought: decision.thought,
                currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject
                });
              } else {
                currentState.updateAgent(agent.id, { currentAction: 'idle', lastThought: decision.thought, currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject });
              }
            } else if (decision.action === 'build' && decision.targetX !== undefined && decision.targetY !== undefined && decision.buildType) {
              const path = findPath(currentAgent.x, currentAgent.y, decision.targetX, decision.targetY, currentState.gridWidth, currentState.gridHeight, currentState.tiles);
              currentState.updateAgent(agent.id, {
                currentAction: 'moving_to_build',
                targetX: decision.targetX,
                targetY: decision.targetY,
                targetAgentId: null,
                path: path,
                buildType: decision.buildType,
                lastThought: decision.thought,
                currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject
              });
            } else if (decision.action === 'place' && decision.targetX !== undefined && decision.targetY !== undefined && decision.placeType) {
              const path = findPath(currentAgent.x, currentAgent.y, decision.targetX, decision.targetY, currentState.gridWidth, currentState.gridHeight, currentState.tiles);
              currentState.updateAgent(agent.id, {
                currentAction: 'moving_to_place',
                targetX: decision.targetX,
                targetY: decision.targetY,
                targetAgentId: null,
                path: path,
                placeType: decision.placeType,
                lastThought: decision.thought,
                currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject
              });
            } else if (decision.action === 'move' && decision.targetX !== undefined && decision.targetY !== undefined) {
              const path = findPath(currentAgent.x, currentAgent.y, decision.targetX, decision.targetY, currentState.gridWidth, currentState.gridHeight, currentState.tiles);
              currentState.updateAgent(agent.id, {
                currentAction: 'moving',
                targetX: decision.targetX,
                targetY: decision.targetY,
                targetAgentId: null,
                path: path,
                lastThought: decision.thought,
                currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject
              });
            } else if (decision.action === 'talk' && decision.targetAgentId) {
              const targetAgent = currentState.agents.find((candidate) => candidate.id === decision.targetAgentId && candidate.id !== agent.id);
              if (targetAgent) {
                const talkTile = findTalkTile(currentState, currentAgent, targetAgent);
                if (talkTile) {
                  const path = findPath(currentAgent.x, currentAgent.y, talkTile.x, talkTile.y, currentState.gridWidth, currentState.gridHeight, currentState.tiles);
                  currentState.updateAgent(agent.id, {
                    currentAction: 'moving_to_talk',
                    targetX: talkTile.x,
                    targetY: talkTile.y,
                    targetAgentId: targetAgent.id,
                    path,
                    lastThought: decision.thought,
                    currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject
                  });
                } else {
                  currentState.updateAgent(agent.id, { currentAction: 'idle', lastThought: decision.thought, currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject });
                }
              } else {
                currentState.updateAgent(agent.id, { currentAction: 'idle', lastThought: decision.thought, currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject });
              }
            } else {
              currentState.updateAgent(agent.id, { currentAction: 'idle', lastThought: decision.thought, currentProject: decision.currentProject !== undefined ? decision.currentProject : currentAgent.currentProject });
            }
          });
        }
      }
      
      isProcessingRef.current = false;
    }, SIM_TICK_MS);

    return () => clearInterval(interval);
  }, [isSimulating]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 font-sans">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <GameCanvas />
        <AgentPanel />
      </div>
    </div>
  );
}
