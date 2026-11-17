import { model, Schema, Types } from 'mongoose';
import { cleanJson } from './plugins.js';

/**
 * Refresh tokens are opaque random strings; only their SHA-256 hash is stored.
 * Tokens belong to a "family" (one per login session). Reusing a rotated token revokes the family.
 */
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
    deviceName: { type: String, maxlength: 100 },
  },
  { timestamps: true },
);
// Token expiration: documents are removed by MongoDB shortly after expiresAt.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(schema, ['tokenHash', 'replacedByHash']);

export interface RefreshTokenAttrs {
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}
export const RefreshTokenModel = model('RefreshToken', schema);
