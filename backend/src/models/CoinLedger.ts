import { HydratedDocument, InferSchemaType, model, Schema } from 'mongoose';

/**
 * One row per coin movement. `key` is unique, so the same entry charge, refund or prize can only be applied once,
 * even when a request is retried or two requests race.
 */
const coinLedgerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Positive = coins received, negative = coins paid. */
    amount: { type: Number, required: true },
    reason: { type: String, enum: ['ENTRY', 'ENTRY_REFUND', 'PRIZE', 'REFUND'], required: true },
    /** The game (or room start) this movement belongs to. */
    refId: { type: String, required: true },
  },
  { timestamps: true },
);

export type CoinLedgerAttrs = InferSchemaType<typeof coinLedgerSchema>;
export type CoinLedgerDoc = HydratedDocument<CoinLedgerAttrs>;
export const CoinLedgerModel = model('CoinLedger', coinLedgerSchema);
