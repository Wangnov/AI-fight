import type { BattleSelections, CharacterId } from './characters';

export type ArenaId =
  | 'altmanDario'
  | 'altmanElon'
  | 'darioElon'
  | 'mirror';

export const ARENA_BACKGROUND_PATHS: Record<ArenaId, string> = {
  altmanDario: '/sprites/scene/bg_arena_altman_dario.png',
  altmanElon: '/sprites/scene/bg_arena_altman_elon.png',
  darioElon: '/sprites/scene/bg_arena_dario_elon.png',
  mirror: '/sprites/scene/bg_arena_mirror.png',
};

const CHARACTER_ORDER: Record<CharacterId, number> = {
  altman: 0,
  dario: 1,
  elon: 2,
};

export function getArenaIdForSelections(selections: BattleSelections): ArenaId {
  if (selections.p1 === selections.p2) return 'mirror';

  const [left, right] = [selections.p1, selections.p2].sort(
    (a, b) => CHARACTER_ORDER[a] - CHARACTER_ORDER[b]
  );
  const matchup = `${left}_${right}`;

  switch (matchup) {
    case 'altman_dario':
      return 'altmanDario';
    case 'altman_elon':
      return 'altmanElon';
    case 'dario_elon':
      return 'darioElon';
    default:
      return 'mirror';
  }
}
