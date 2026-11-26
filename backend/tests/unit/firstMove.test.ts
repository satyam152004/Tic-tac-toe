import { describe, expect, it } from 'vitest';
import { markFor, resolveMatchMark, wantedMark } from '../../src/services/firstMove.js';

const fixed = (m: 'X' | 'O') => () => m;

describe('wantedMark', () => {
  it('ME means the chooser plays X (moves first), OPPONENT means O, RANDOM means no preference', () => {
    expect(wantedMark('ME')).toBe('X');
    expect(wantedMark('OPPONENT')).toBe('O');
    expect(wantedMark('RANDOM')).toBeNull();
  });
});

describe('markFor (room host / friend invite)', () => {
  it('honours the choice without calling the random source', () => {
    let calls = 0;
    const rnd = (): 'X' | 'O' => {
      calls++;
      return 'O';
    };
    expect(markFor('ME', rnd)).toBe('X');
    expect(markFor('OPPONENT', rnd)).toBe('O');
    expect(calls).toBe(0);
  });

  it('uses the random source only for RANDOM', () => {
    expect(markFor('RANDOM', fixed('O'))).toBe('O');
    expect(markFor('RANDOM', fixed('X'))).toBe('X');
  });
});

describe('resolveMatchMark (two queued players)', () => {
  it('gives the only player who chose their mark', () => {
    expect(resolveMatchMark('ME', 'RANDOM', fixed('O'))).toBe('X');
    expect(resolveMatchMark('OPPONENT', 'RANDOM', fixed('X'))).toBe('O');
    // They chose "I go first" (their X), so I am O.
    expect(resolveMatchMark('RANDOM', 'ME', fixed('X'))).toBe('O');
    // They chose "you go first", so I am X.
    expect(resolveMatchMark('RANDOM', 'OPPONENT', fixed('O'))).toBe('X');
  });

  it('agrees when both choices point to the same mark', () => {
    // I chose ME (X); they chose OPPONENT, which makes me X as well.
    expect(resolveMatchMark('ME', 'OPPONENT', fixed('O'))).toBe('X');
    // I chose OPPONENT (O); they chose ME, which makes me O.
    expect(resolveMatchMark('OPPONENT', 'ME', fixed('X'))).toBe('O');
  });

  it('falls back to random when both want to go first', () => {
    expect(resolveMatchMark('ME', 'ME', fixed('O'))).toBe('O');
    expect(resolveMatchMark('ME', 'ME', fixed('X'))).toBe('X');
    let calls = 0;
    const rnd = (): 'X' | 'O' => {
      calls++;
      return 'X';
    };
    resolveMatchMark('ME', 'ME', rnd);
    expect(calls).toBe(1);
  });

  it('uses random when neither player chose', () => {
    expect(resolveMatchMark('RANDOM', 'RANDOM', fixed('O'))).toBe('O');
    expect(resolveMatchMark('RANDOM', 'RANDOM', fixed('X'))).toBe('X');
  });
});
