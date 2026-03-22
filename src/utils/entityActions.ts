import { Entity } from '../store';

export interface EntityAction {
  label: string;
  detail: string;
}

export function getEntityActions(entity: Entity): EntityAction[] {
  switch (entity.type) {
    case 'bed':
      return [{ label: 'Sleep', detail: 'Recover energy while resting here.' }];
    case 'tree':
      return [{ label: 'Chop Wood', detail: 'Requires an axe. Harvest 1 wood and remove the tree.' }];
    case 'rock':
      return [{ label: 'Mine Stone', detail: 'Harvest 1 stone and remove the rock.' }];
    case 'food':
      return [{ label: 'Eat', detail: 'Consume the food to restore hunger.' }];
    case 'farm':
      return [{ label: 'Farm', detail: 'Work the field to occasionally produce food nearby.' }];
    case 'workstation':
      return [
        { label: 'Craft Axe', detail: 'Spend 1 wood and 1 stone to craft an axe.' },
        { label: 'Craft Weapon', detail: 'Spend 2 wood and 1 stone to craft a weapon.' },
        { label: 'Work', detail: 'Spend energy and fun while using the station.' }
      ];
    case 'chest':
      return [
        { label: 'Store Supplies', detail: 'Deposit carried wood, stone, axes, or weapons into storage.' },
        { label: 'Retrieve Supplies', detail: 'Withdraw materials, axes, or weapons from storage.' }
      ];
    case 'chair':
      return [{ label: 'Sit', detail: 'Use as a comfort/fun prop in future updates.' }];
    default:
      return [];
  }
}
