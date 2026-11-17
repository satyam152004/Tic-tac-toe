import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { DeviceTokenModel } from '../models/index.js';

/** Firebase Cloud Messaging (Android + iOS via APNs). Initialised lazily; disabled when not configured. */
interface Messaging {
  sendEachForMulticast(msg: unknown): Promise<{ responses: Array<{ success: boolean; error?: { code?: string } }> }>;
}
let messaging: Messaging | null | undefined;

async function getMessaging(): Promise<Messaging | null> {
  if (messaging !== undefined) return messaging;
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || (env.FIREBASE_SERVICE_ACCOUNT_PATH ? readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8') : '');
  if (!raw) {
    messaging = null;
    return null;
  }
  try {
    const admin = await import('firebase-admin/app');
    const msg = await import('firebase-admin/messaging');
    const app = admin.getApps().length ? admin.getApp() : admin.initializeApp({ credential: admin.cert(JSON.parse(raw)) });
    messaging = msg.getMessaging(app) as unknown as Messaging;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Firebase initialisation failed; push disabled');
    messaging = null;
  }
  return messaging;
}

export function isPushConfigured(): boolean {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

/** Test hook: lets tests observe pushes without Firebase. */
export const pushSink: { fn: ((userId: string, payload: { title: string; body: string; data: Record<string, string> }) => void) | null } = { fn: null };

export async function sendPush(
  userId: string,
  payload: { title: string; body: string; data: Record<string, string> },
): Promise<void> {
  pushSink.fn?.(userId, payload);
  const m = await getMessaging();
  if (!m) return;
  const devices = await DeviceTokenModel.find({ userId }).select('+token').lean();
  if (!devices.length) return;
  const tokens = devices.map((d) => d.token);
  try {
    const res = await m.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    // Remove tokens FCM says are dead.
    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code ?? '';
      if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token'))) dead.push(tokens[i]!);
    });
    if (dead.length) await DeviceTokenModel.deleteMany({ token: { $in: dead } });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'FCM send failed');
  }
}
