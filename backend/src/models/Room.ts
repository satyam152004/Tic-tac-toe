import { HydratedDocument, InferSchemaType, model, Schema } from 'mongoose';
import { BOARD_SIZES, ROOM_ENTRY_AMOUNTS, ROOM_STATUSES } from '../constants/index.js';
import { cleanJson } from './plugins.js';

const roomSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, minlength: 6, maxlength: 6 },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guestId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ROOM_STATUSES, default: 'WAITING', required: true },
    boardSize: { type: Number, enum: BOARD_SIZES, required: true },
    winLength: { type: Number, required: true, min: 3, max: 5 },
    /** The host's choice of who moves first (ME / OPPONENT / RANDOM). */
    firstMove: { type: String, enum: ['ME', 'OPPONENT', 'RANDOM'], default: 'RANDOM', required: true },
    guestReady: { type: Boolean, default: false },
    /** Listed in GET /rooms/open while it is waiting for a guest. Rooms are private (code-only) unless the host opts in. */
    isPublic: { type: Boolean, default: false },
    /** Coins each player pays when the match starts (0 = free). The winner takes both entries. */
    entryAmount: { type: Number, enum: ROOM_ENTRY_AMOUNTS, default: 0, required: true },
    /** Per-turn clock for the game started from this room; 0 = no clock. */
    turnTimeoutSec: { type: Number, default: 60, min: 0, max: 600 },
    invitedUserIds: { type: [Schema.Types.ObjectId], default: [] },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    expiresAt: { type: Date, required: true },
    purgeAt: { type: Date },
  },
  { timestamps: true },
);

roomSchema.index({ code: 1 }, { unique: true });
roomSchema.index({ hostId: 1, status: 1 });
roomSchema.index({ guestId: 1, status: 1 });
roomSchema.index({ status: 1, expiresAt: 1 });
roomSchema.index({ isPublic: 1, status: 1, expiresAt: 1 });
roomSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(roomSchema, ['purgeAt']);

export type RoomAttrs = InferSchemaType<typeof roomSchema>;
export type RoomDoc = HydratedDocument<RoomAttrs>;
export const RoomModel = model('Room', roomSchema);
