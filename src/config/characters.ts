import {
  PRESET_ALTMAN,
  PRESET_DARIO,
  PRESET_ELON,
  type FighterPreset,
} from './constants';

export type CharacterId = 'altman' | 'dario' | 'elon';

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
    name: 'Sam',
    portraitPath: '/sprites/scene/portrait_altman.png',
    color: 0x4ade80,
    accentColor: 0x22d3ee,
    preset: PRESET_ALTMAN,
  },
  {
    id: 'dario',
    name: 'Dario',
    portraitPath: '/sprites/scene/portrait_dario.png',
    color: 0xfb923c,
    accentColor: 0xf97316,
    preset: PRESET_DARIO,
  },
  {
    id: 'elon',
    name: 'Elon',
    portraitPath: '/sprites/scene/portrait_elon.png',
    color: 0x60a5fa,
    accentColor: 0xa78bfa,
    preset: PRESET_ELON,
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
