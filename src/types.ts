export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FighterId = 'P1' | 'P2';

export type AttackKind = 'jab' | 'combo1' | 'combo2' | 'ultimate';
