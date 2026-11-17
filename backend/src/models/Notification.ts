import { model, Schema } from 'mongoose';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } from '../constants/index.js';
import { cleanJson } from './plugins.js';

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
    expireAt: { type: Date, required: true }, // retention: 90 days
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, readAt: 1 });
schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(schema, ['expireAt']);

export const NotificationModel = model('Notification', schema);
