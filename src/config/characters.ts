import {
  PRESET_ALTMAN,
  PRESET_DARIO,
  type FighterPreset,
} from './constants';

export type CharacterId = 'altman' | 'dario';

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  portraitPath: string;
  color: number;
  accentColor: number;
  preset: FighterPreset;
}

export interface BattleSelections {
  p1: CharacterId;
  p2: CharacterId;
}

export const CHARACTER_ROSTER: readonly CharacterDefinition[] = [
  {
    id: 'altman',
    name: 'ALTMAN',
    portraitPath: '/sprites/scene/portrait_altman.png',
    color: 0x4ade80,
    accentColor: 0x22d3ee,
    preset: PRESET_ALTMAN,
  },
  {
    id: 'dario',
    name: 'DARIO',
    portraitPath: '/sprites/scene/portrait_dario.png',
    color: 0xfb923c,
    accentColor: 0xf97316,
    preset: PRESET_DARIO,
  },
];

export const DEFAULT_BATTLE_SELECTIONS: BattleSelections = {
  p1: 'altman',
  p2: 'dario',
};

export function getCharacterDefinition(id: CharacterId): CharacterDefinition {
  const character = CHARACTER_ROSTER.find((item) => item.id === id);
  if (!character) {
    throw new Error(`Unknown character: ${id}`);
  }
  return character;
}
