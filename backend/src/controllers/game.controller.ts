import { z } from 'zod';
import type { Ctx } from '../routes/registry.js';
import * as games from '../services/game.service.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/game.validator.js';

type P = z.infer<typeof idParam>;

export function create(c: Ctx<z.infer<typeof v.createGameBody>>) {
  return c.body.type === 'AI' ? games.createAiGame(c.userId, c.body) : games.createFriendGame(c.userId, c.body);
}
export const active = (c: Ctx) => games.getActiveGames(c.userId);
export const get = (c: Ctx<unknown, unknown, P>) => games.getGame(c.userId, c.params.id);
export const join = (c: Ctx<unknown, unknown, P>) => games.joinGame(c.userId, c.params.id);
export const move = (c: Ctx<z.infer<typeof v.moveBody>, unknown, P>) => games.makeMove(c.userId, c.params.id, c.body);
export const forfeit = (c: Ctx<unknown, unknown, P>) => games.forfeit(c.userId, c.params.id);
export const rematch = (c: Ctx<unknown, unknown, P>) => games.requestRematch(c.userId, c.params.id);
export const history = (c: Ctx<unknown, unknown, P>) => games.getMoveHistory(c.userId, c.params.id);
export const replay = (c: Ctx<unknown, unknown, P>) => games.getReplay(c.userId, c.params.id);
