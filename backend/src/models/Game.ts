import { HydratedDocument, InferSchemaType, model, Schema } from 'mongoose';
import { BOARD_SIZES, DIFFICULTIES, GAME_STATUSES, GAME_TYPES } from '../constants/index.js';
import { cleanJson } from './plugins.js';

const playerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null => AI
    mark: { type: String, enum: ['X', 'O'], required: true },
    isAI: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
    outcome: { type: String, enum: ['WIN', 'LOSS', 'DRAW', null], default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { _id: false },
);

const gameSchema = new Schema(
  {
    type: { type: String, enum: GAME_TYPES, required: true },
    status: { type: String, enum: GAME_STATUSES, required: true, default: 'WAITING' },
    boardSize: { type: Number, enum: BOARD_SIZES, required: true },
    winLength: { type: Number, required: true, min: 3, max: 5 },
    board: { type: [String], required: true },
    currentTurn: { type: String, enum: ['X', 'O'], default: 'X' },
    /** Number of accepted moves; doubles as the optimistic-concurrency version of the game. */
    moveCount: { type: Number, default: 0, min: 0 },
    players: { type: [playerSchema], default: [] },
    /** Flat copy of human player ids for indexing/membership queries. */
    playerIds: { type: [Schema.Types.ObjectId], default: [], index: true },
    difficulty: { type: String, enum: DIFFICULTIES },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    /** FRIEND games: the invited friend (joins via game:join / POST /games/:id/join). */
    invitedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** LOCAL (offline) games uploaded by the client; unique per creator for idempotent sync. */
    clientMatchId: { type: String, maxlength: 64 },
    turnTimeoutSec: { type: Number, default: 60 },
    turnDeadline: { type: Date, default: null },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationMs: { type: Number, min: 0 },
    lastMoveAt: { type: Date },
    result: {
      winner: { type: String, enum: ['X', 'O', null], default: null },
      winnerId: { type: Schema.Types.ObjectId, default: null },
      line: { type: [Number], default: [] },
      reason: { type: String, enum: ['LINE', 'DRAW', 'FORFEIT', 'TIMEOUT', 'DISCONNECT', null], default: null },
    },
    disconnectedAt: {
      X: { type: Date, default: null },
      O: { type: Date, default: null },
    },
    /** Set exactly once (atomically) when stats/points/achievements have been applied. */
    finalizedAt: { type: Date, default: null },
    rematchRequestedBy: { type: [Schema.Types.ObjectId], default: [] },
    rematchGameId: { type: Schema.Types.ObjectId, default: null },
    previousGameId: { type: Schema.Types.ObjectId, default: null },
    /** Retention: TTL-deleted when set (cancelled/expired games soon, finished games after a year). */
    purgeAt: { type: Date },
  },
  { timestamps: true },
);

gameSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
gameSchema.index({ status: 1, turnDeadline: 1 });
gameSchema.index({ status: 1, createdAt: 1 });
gameSchema.index({ playerIds: 1, status: 1, createdAt: -1 });
gameSchema.index({ playerIds: 1, endedAt: -1 });
gameSchema.index({ roomId: 1 });
gameSchema.index({ createdBy: 1, clientMatchId: 1 }, { unique: true, partialFilterExpression: { clientMatchId: { $type: 'string' } } });
gameSchema.index({ status: 1, 'disconnectedAt.X': 1 });
gameSchema.index({ status: 1, 'disconnectedAt.O': 1 });

cleanJson(gameSchema, ['purgeAt']);

export type GameAttrs = InferSchemaType<typeof gameSchema>;
export type GameDoc = HydratedDocument<GameAttrs>;
export const GameModel = model('Game', gameSchema);
