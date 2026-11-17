import { model, Schema } from 'mongoose';
import { cleanJson } from './plugins.js';

const schema = new Schema(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
schema.index({ blockedId: 1 });
cleanJson(schema);

export const BlockedUserModel = model('BlockedUser', schema);
