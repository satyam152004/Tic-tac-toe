import { HydratedDocument, InferSchemaType, model, Schema } from 'mongoose';
import { BOARD_SIZES } from '../constants/index.js';
import { cleanJson } from './plugins.js';

const ticketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    boardSize: { type: Number, enum: BOARD_SIZES, required: true },
    winLength: { type: Number, required: true },
    /** The player's choice of who moves first (ME / OPPONENT / RANDOM). */
    firstMove: { type: String, enum: ['ME', 'OPPONENT', 'RANDOM'], default: 'RANDOM', required: true },
    /** Coins each player pays to start the match (0 = free). Only tickets with the same entry are paired. */
    entryAmount: { type: Number, enum: [0, 10, 25, 50], default: 0, required: true },
    status: { type: String, enum: ['QUEUED', 'MATCHED', 'CANCELLED', 'EXPIRED'], default: 'QUEUED', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    queueExpiresAt: { type: Date, required: true },
    matchedAt: { type: Date },
    /** Housekeeping: ticket documents are deleted a while after they stop being relevant. */
    purgeAt: { type: Date },
  },
  { timestamps: true },
);

// A user can have at most ONE queued ticket => no joining multiple queues, even across instances.
ticketSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'QUEUED' } });
ticketSchema.index({ status: 1, boardSize: 1, winLength: 1, createdAt: 1 });
ticketSchema.index({ status: 1, queueExpiresAt: 1 });
ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(ticketSchema, ['purgeAt']);

export type TicketAttrs = InferSchemaType<typeof ticketSchema>;
export type TicketDoc = HydratedDocument<TicketAttrs>;
export const MatchmakingTicketModel = model('MatchmakingTicket', ticketSchema);
