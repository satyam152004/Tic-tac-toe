import { HydratedDocument, InferSchemaType, model, Schema, Types } from 'mongoose';
import { cleanJson } from './plugins.js';

const friendshipSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Order independent key (sorted ids) => one relationship per pair, no duplicates in either direction. */
    pairKey: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED'], default: 'PENDING', required: true },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

friendshipSchema.index({ pairKey: 1 }, { unique: true });
friendshipSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
friendshipSchema.index({ requesterId: 1, status: 1, createdAt: -1 });
cleanJson(friendshipSchema, ['pairKey']);

export function makePairKey(a: string | Types.ObjectId, b: string | Types.ObjectId): string {
  return [String(a), String(b)].sort().join(':');
}

export type FriendshipAttrs = InferSchemaType<typeof friendshipSchema>;
export type FriendshipDoc = HydratedDocument<FriendshipAttrs>;
export const FriendshipModel = model('Friendship', friendshipSchema);
