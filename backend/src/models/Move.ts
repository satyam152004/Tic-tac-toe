import { model, Schema } from 'mongoose';
import { cleanJson } from './plugins.js';

const moveSchema = new Schema(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    moveNumber: { type: Number, required: true, min: 1 },
    playerId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null => AI move
    mark: { type: String, enum: ['X', 'O'], required: true },
    position: { type: Number, required: true, min: 0, max: 24 },
    /** Client generated idempotency key (UUID). Re-sending the same key returns the original move. */
    clientMoveId: { type: String, maxlength: 64 },
    expireAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A move number can exist only once per game => prevents conflicting simultaneous moves.
moveSchema.index({ gameId: 1, moveNumber: 1 }, { unique: true });
// A cell can only be played once per game (belt and braces on top of the atomic board guard).
moveSchema.index({ gameId: 1, position: 1 }, { unique: true });
// Idempotency protection for duplicate submissions.
moveSchema.index(
  { gameId: 1, playerId: 1, clientMoveId: 1 },
  { unique: true, partialFilterExpression: { clientMoveId: { $type: 'string' } } },
);
moveSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(moveSchema, ['expireAt']);

export const MoveModel = model('Move', moveSchema);
