import { useCallback, useEffect, useState } from 'react';
import { friendlyMessage } from '../services/api/errors';
import type { Game } from '../services/api/types';
import { gameSocket } from '../services/socket/gameSocket';
import { socketClient } from '../services/socket/socketClient';
import { toast } from '../store/toastStore';

/**
 * Mutual-draw offers of one online game (server `game:offer-draw` / `game:respond-draw`).
 * `incoming` is the opponent's open offer (drives DrawOfferModal); `sent` is true while my own offer waits for an answer.
 * Seeded from `game.drawOffer` so a reconnect restores a pending offer.
 */
export function useDrawOffer(game: Game | null, myId: string | undefined) {
  const gameId = game?.id;
  const [offer, setOffer] = useState<{ by: string; expiresAt: string; moveCount: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const o = game?.drawOffer;
    setOffer(o && Date.parse(o.expiresAt) > Date.now() ? { by: o.by, expiresAt: o.expiresAt, moveCount: game?.moveCount ?? 0 } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, game?.drawOffer?.by, game?.drawOffer?.expiresAt]);

  useEffect(() => {
    if (!gameId) return;
    const offs = [
      socketClient.on('game:draw-offered', (p) => {
        if (p.gameId !== gameId) return;
        setOffer({ by: p.by, expiresAt: p.expiresAt, moveCount: p.moveCount });
        if (p.by !== myId) toast.info('Draw offered', 'Your opponent offered a draw');
      }),
      socketClient.on('game:draw-declined', (p) => {
        if (p.gameId !== gameId) return;
        setOffer(null);
        if (p.by !== myId) toast.info('Draw declined', 'Your opponent wants to keep playing');
      }),
      socketClient.on('game:finished', (p) => p.game.id === gameId && setOffer(null)),
      socketClient.on('game:draw', (p) => p.game.id === gameId && setOffer(null)),
    ];
    return () => offs.forEach((off) => off());
  }, [gameId, myId]);

  const send = useCallback(async () => {
    if (!gameId || busy) return;
    setBusy(true);
    try {
      await gameSocket.offerDraw(gameId);
      toast.info('Draw offer sent', 'Waiting for your opponent');
    } catch (e) {
      toast.error("Couldn't offer a draw", friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }, [gameId, busy]);

  const respond = useCallback(
    async (accept: boolean) => {
      if (!gameId) return;
      setOffer(null);
      try {
        await gameSocket.respondDraw(gameId, accept);
      } catch (e) {
        toast.error(accept ? "Couldn't accept the draw" : "Couldn't decline the draw", friendlyMessage(e));
      }
    },
    [gameId],
  );

  const active = offer && Date.parse(offer.expiresAt) > Date.now() ? offer : null;
  return { incoming: active && active.by !== myId ? active : null, sent: !!active && active.by === myId, busy, send, respond };
}
