import { useCallback } from 'react';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';

const SOCIAL_ERRORS: Record<string, string> = {
  USER_NOT_FOUND: "We can't find a player with that username.",
  SELF_REQUEST: "You can't add yourself.",
  ALREADY_FRIENDS: "You're already friends.",
  REQUEST_ALREADY_SENT: 'You already sent a friend request.',
  BLOCKED: "You can't do that with this player.",
  NOT_FRIENDS: 'You can only challenge friends.',
  ALREADY_IN_GAME: "You're already in a game.",
  SELF_REPORT: "You can't report yourself.",
  REPORT_LIMIT: "You've already reported this player too many times.",
};

export const socialError = (e: unknown): string => SOCIAL_ERRORS[toApiError(e).code] ?? friendlyMessage(e);
export const isOffline = (e: unknown): boolean => !!e && toApiError(e).code === 'NETWORK_ERROR';

/**
 * Challenge flow shared by the friends list and the friend profile.
 * Opens the online setup screen (board size and who goes first); the invite is sent from there.
 */
export function useChallenge() {
  const { nav } = useAppNav();
  const challenge = useCallback(
    (id: string, name: string) => nav.navigate('match_setup', { mode: 'ONLINE', purpose: 'CHALLENGE', opponentId: id, opponentName: name }),
    [nav],
  );
  return { challenge };
}
