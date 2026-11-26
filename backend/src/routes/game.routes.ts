import * as c from '../controllers/game.controller.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/game.validator.js';
import { route } from './registry.js';

const tag = 'Games';
const gameErrors = ['GAME_NOT_FOUND', 'NOT_A_PLAYER'];

export const gameRoutes = [
  route({ method: 'post', path: '/games', tag, summary: 'Create a game: vs server AI, or invite a friend (online random games use /matchmaking, private ones /rooms)', body: v.createGameBody, status: 201, response: 'Game state', errors: ['INVALID_BOARD_CONFIG', 'NOT_FRIENDS', 'BLOCKED', 'ALREADY_IN_GAME'], handler: c.create }),
  route({ method: 'get', path: '/games/active', tag, summary: 'List my unfinished games (used to resume after reconnect)', response: 'Array of game states', handler: c.active }),
  route({ method: 'get', path: '/games/invites', tag, summary: 'Friend challenges still waiting: incoming (sent to me) and outgoing (sent by me), with expiresAt', response: '{ incoming: [{ game, from, to, expiresAt }], outgoing: [...] }', handler: c.invites }),
  route({ method: 'post', path: '/games/:id/decline', tag, summary: 'Decline a friend challenge sent to me (before I accept)', params: idParam, response: '{ declined: true }', errors: [...gameErrors, 'NOT_INVITEE', 'INVITE_CLOSED'], handler: c.decline }),
  route({ method: 'post', path: '/games/:id/cancel', tag, summary: 'Cancel a friend challenge I sent (before it is accepted)', params: idParam, response: '{ cancelled: true }', errors: [...gameErrors, 'NOT_INVITER', 'INVITE_CLOSED'], handler: c.cancelInvite }),
  route({ method: 'get', path: '/games/:id', tag, summary: 'Get the authoritative state of a game I play in', params: idParam, response: 'Game state', errors: gameErrors, handler: c.get }),
  route({ method: 'post', path: '/games/:id/join', tag, summary: 'Join / confirm presence in a game (starts it when all players joined; invited friends accept here)', params: idParam, response: 'Game state', errors: gameErrors, handler: c.join }),
  route({ method: 'post', path: '/games/:id/moves', tag, summary: 'Submit a move (server validates turn, cell, state; decides win/draw)', params: idParam, body: v.moveBody, response: '{ game, move, aiMove?, duplicate }', errors: [...gameErrors, 'GAME_NOT_ACTIVE', 'NOT_YOUR_TURN', 'CELL_OCCUPIED', 'CELL_OUT_OF_RANGE', 'MOVE_CONFLICT'], handler: c.move }),
  route({ method: 'post', path: '/games/:id/forfeit', tag, summary: 'Forfeit a running game (or cancel one that has not started)', params: idParam, response: 'Final game state', errors: [...gameErrors, 'GAME_NOT_ACTIVE'], handler: c.forfeit }),
  route({ method: 'post', path: '/games/:id/rematch', tag, summary: 'Request a rematch; starts when both players asked (AI games restart immediately)', params: idParam, response: '{ status: REQUESTED | STARTED, game }', errors: [...gameErrors, 'GAME_NOT_FINISHED'], handler: c.rematch }),
  route({ method: 'get', path: '/games/:id/history', tag, summary: 'Move history of a game', params: idParam, response: 'Array of moves { moveNumber, position, row, col, mark, playerId, playedAt }', errors: gameErrors, handler: c.history }),
  route({ method: 'get', path: '/games/:id/replay', tag, summary: 'Move-by-move replay (board snapshot after every move)', params: idParam, response: '{ game, totalMoves, frames[] }', errors: gameErrors, handler: c.replay }),
];
