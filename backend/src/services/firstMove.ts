import { otherMark, type Mark } from '../game-engine/index.js';

/**
 * Who moves first, chosen by the player who starts the match.
 *  - ME:       the chooser moves first (plays X, X always moves first)
 *  - OPPONENT: the other player moves first (the chooser plays O)
 *  - RANDOM:   the server decides (default)
 */
export type FirstMovePref = 'ME' | 'OPPONENT' | 'RANDOM';

/** The mark a preference asks for, or null when it is RANDOM. */
export function wantedMark(pref: FirstMovePref): Mark | null {
  if (pref === 'ME') return 'X';
  if (pref === 'OPPONENT') return 'O';
  return null;
}

/** Mark for a single chooser (a room host or a friend invite): honour the choice, otherwise random. */
export function markFor(pref: FirstMovePref, random: () => Mark): Mark {
  return wantedMark(pref) ?? random();
}

/**
 * Mark for `mine` in a match made from two queued players. Each side's choice is turned into the mark
 * it asks for (for the other side, their OPPONENT choice means I am X). If both sides ask for different
 * marks, both want to go first: that is a conflict, so the server decides at random. If only one side
 * chose, that choice is honoured. If neither chose, the server decides.
 */
export function resolveMatchMark(myPref: FirstMovePref, theirPref: FirstMovePref, random: () => Mark): Mark {
  const mine = wantedMark(myPref);
  const theirs = wantedMark(theirPref);
  const forMe = theirs === null ? null : otherMark(theirs);
  if (mine !== null && forMe !== null && mine !== forMe) return random();
  return mine ?? forMe ?? random();
}
