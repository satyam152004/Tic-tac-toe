import * as Linking from 'expo-linking';
import { navigateTo, currentRouteName } from '../navigation/navigationRef';
import { useAuthStore } from '../store/authStore';

/**
 * Deep links for invitations:
 *   tictactoe://join/ABC234            -> join_room with the code prefilled
 *   tictactoe://invite/<gameId>        -> match_invitation (friend challenge)
 *   (the same paths work for the https universal/app link host configured in app.config.ts)
 * A link that arrives while signed out (or before the splash finished) is kept and handled right after sign-in.
 */
export type ParsedLink = { type: 'join'; code: string } | { type: 'invite'; gameId: string } | null;

export function parseLink(url: string | null | undefined): ParsedLink {
  if (!url) return null;
  try {
    const { path } = Linking.parse(url);
    const parts = (path ?? '').split('/').filter(Boolean);
    if (parts[0] === 'join' && /^[A-Za-z0-9]{6}$/.test(parts[1] ?? '')) return { type: 'join', code: parts[1]!.toUpperCase() };
    if (parts[0] === 'invite' && /^[0-9a-fA-F]{24}$/.test(parts[1] ?? '')) return { type: 'invite', gameId: parts[1]! };
  } catch {
    /* malformed link: ignore */
  }
  return null;
}

let pending: ParsedLink = null;

export function handleUrl(url: string | null | undefined): void {
  const link = parseLink(url);
  if (!link) return;
  pending = link;
  flushPendingLink();
}

/** Called when auth/navigation readiness changes. Safe to call any time. */
export function flushPendingLink(): void {
  if (!pending) return;
  const route = currentRouteName();
  if (useAuthStore.getState().status !== 'signedIn' || !route || route === 'splash') return;
  const link = pending;
  pending = null;
  if (link.type === 'join') navigateTo('join_room', { code: link.code });
  else navigateTo('match_invitation', { gameId: link.gameId });
}

/** Subscribes to links while the app runs and reads the launch URL. Returns the unsubscribe function. */
export function startDeepLinks(): () => void {
  void Linking.getInitialURL().then(handleUrl);
  const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
  return () => sub.remove();
}
