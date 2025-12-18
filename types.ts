export type GameState = 'start' | 'playing' | 'gameover';

export interface GameStats {
  score: number;
  speed: number;
  distance: number;
}
