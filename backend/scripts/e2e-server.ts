/**
 * Boots the REAL backend (HTTP + Socket.IO) on top of a throwaway in-memory MongoDB, for end-to-end tests of the mobile
 * app's API/socket layer. Prints `E2E_READY <port>` when it accepts connections. Usage: tsx scripts/e2e-server.ts [port]
 * Mails are written to ./.dev-mail (never logged), so tests can read OTP codes exactly like a developer would.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.argv[2] ?? process.env.E2E_PORT ?? 4555);
const mongo = await MongoMemoryServer.create();

process.env.NODE_ENV = 'development';
process.env.PORT = String(port);
process.env.MONGODB_URI = mongo.getUri('tictactoe_e2e');
process.env.JWT_ACCESS_SECRET = 'e2e-secret-e2e-secret-e2e-secret-123456';
process.env.LOG_LEVEL = 'error';
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.AUTH_RATE_LIMIT_MAX ??= '100000';
process.env.SMTP_HOST = '';

await import('../src/server.js');

const stop = async () => {
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/readyz`);
    if (r.ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`E2E_READY ${port}`);
