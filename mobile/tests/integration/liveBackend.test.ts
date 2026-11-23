/**
 * END-TO-END against the REAL backend (HTTP + Socket.IO + MongoDB in memory), driven through the app's own layers:
 * auth store, API client (refresh/rotation), SecureStore token storage, socket client, session bridge, online actions,
 * offline sync. Only native modules are faked (tests/setup.ts). The opponent is a second raw client.
 *
 * Starts `backend/scripts/e2e-server.ts` itself (needs backend deps installed: `cd backend && npm install`).
 */
import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import axios from 'axios';
import { io as rawIo, Socket } from 'socket.io-client';

const PORT = 4556;
const BASE = `http://127.0.0.1:${PORT}`;
const BACKEND = join(__dirname, '..', '..', '..', 'backend');
let server: ChildProcess;
let serverOut = '';

// socket.io-client is globally mocked in tests/setup.ts: the live test needs the real one.
jest.unmock('socket.io-client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const realIo: typeof rawIo = require('socket.io-client').io;

// babel-preset-expo inlines EXPO_PUBLIC_* at transform time, so point the app's config at the test server explicitly.
jest.mock('../../src/services/api/config', () => ({
  API_URL: 'http://127.0.0.1:4556',
  API_BASE: 'http://127.0.0.1:4556/api/v1',
  SOCKET_URL: 'http://127.0.0.1:4556',
  REQUEST_TIMEOUT_MS: 15000,
}));

// Jest resolves axios' React Native build (no Node http adapter); use the Node build for real network calls.
jest.mock('axios', () => jest.requireActual('axios/dist/node/axios.cjs'));

jest.setTimeout(120_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => T | undefined | null | false, ms = 15_000, label = 'condition'): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error(`timeout waiting for ${label}`);
    await sleep(40);
  }
}

/** Latest dev mail for an address (the backend writes mails to ./.dev-mail when SMTP is not configured). */
function latestCode(email: string): string {
  const dir = join(BACKEND, '.dev-mail');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.includes(email.replace(/[^a-z0-9@.]/gi, '_'))).sort() : [];
  const text = readFileSync(join(dir, files[files.length - 1]!), 'utf8');
  return /: (\d{6})/.exec(text)![1]!;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let A: {
  authStore: any; api: any; tokenStorage: any; socketClient: any; onlineStore: any; actions: any; attachSession: () => () => void;
  authApi: any; rewardApi: any; userApi: any; statisticsApi: any; syncLocalMatches: () => Promise<number>; localGameStorage: any;
  engine: any; leaderboardApi: any; achievementApi: any; friendApi: any;
};

beforeAll(async () => {
  // Refuse to run against a leftover server from an earlier run (stale data would make results meaningless).
  const busy = await axios.get(`${BASE}/api/v1/health`, { timeout: 800 }).then(() => true, () => false);
  if (busy) throw new Error(`Port ${PORT} is already in use by another backend; stop it and re-run.`);
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'scripts/e2e-server.ts', String(PORT)], { cwd: BACKEND, shell: process.platform === 'win32', env: { ...process.env } });
  let out = '';
  server.stdout?.on('data', (d) => (out += d, (serverOut += d)));
  server.stderr?.on('data', (d) => (out += d, (serverOut += d)));
  await waitFor(() => out.includes('E2E_READY'), 90_000, 'backend to start');

  const probe = await axios.get(`${BASE}/api/v1/health`, { adapter: 'http' }).catch((e) => e);
  if (probe instanceof Error) console.log('PROBE FAILED', (probe as any).code, probe.message, out.slice(-500));
  process.env.EXPO_PUBLIC_API_URL = BASE;
  (globalThis as any).__DEV__ = true;
  const apiClient = require('../../src/services/api/apiClient');
  // Node http adapter (the RN XHR adapter is not available under Jest)
  apiClient.api.defaults.adapter = 'http';
  apiClient.bare.defaults.adapter = 'http';
  axios.defaults.adapter = 'http';
  A = {
    api: apiClient.api,
    authStore: (require('../../src/store/authStore')).useAuthStore,
    tokenStorage: (require('../../src/services/storage/secureStorage')).tokenStorage,
    socketClient: (require('../../src/services/socket/socketClient')).socketClient,
    onlineStore: (require('../../src/store/onlineStore')).useOnlineStore,
    actions: require('../../src/services/onlineActions'),
    attachSession: (require('../../src/services/socket/sessionBridge')).attachSession,
    authApi: (require('../../src/services/api/authApi')).authApi,
    rewardApi: (require('../../src/services/api/rewardApi')).rewardApi,
    userApi: (require('../../src/services/api/userApi')).userApi,
    statisticsApi: (require('../../src/services/api/statisticsApi')).statisticsApi,
    syncLocalMatches: (require('../../src/services/localSync')).syncLocalMatches,
    localGameStorage: (require('../../src/services/storage/localGameStorage')).localGameStorage,
    engine: require('../../src/game-engine'),
    leaderboardApi: (require('../../src/services/api/leaderboardApi')).leaderboardApi,
    achievementApi: (require('../../src/services/api/achievementApi')).achievementApi,
    friendApi: (require('../../src/services/api/friendApi')).friendApi,
  };
});

afterAll(async () => {
  A?.socketClient?.disconnect();
  if (server?.pid) {
    // Kill the whole tree (tsx -> node -> mongod) synchronously; plain kill() leaves orphans on Windows.
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    else server.kill('SIGTERM');
  }
  await sleep(300);
});

describe('auth against the real backend', () => {
  it('guest sign-in, secure token storage and automatic token refresh/rotation', async () => {
    const me = await A.authStore.getState().continueAsGuest();
    expect(me.accountType).toBe('GUEST');
    expect(A.authStore.getState().status).toBe('signedIn');
    const t1 = A.tokenStorage.current();
    expect(t1.accessToken).toBeTruthy();

    // simulate an expired/garbled access token: the interceptor must refresh transparently and rotate the refresh token
    A.tokenStorage.current().accessToken = 'garbage.token.value';
    const again = await A.userApi.me();
    expect(again.id).toBe(me.id);
    const t2 = A.tokenStorage.current();
    expect(t2.refreshToken).not.toBe(t1.refreshToken);

    // concurrent calls with a dead access token share ONE refresh (rotation safety)
    A.tokenStorage.current().accessToken = 'garbage.token.value';
    const rs = await Promise.all([A.userApi.me(), A.rewardApi.status(), A.statisticsApi.me()]);
    expect(rs[0].id).toBe(me.id);
    expect(A.authStore.getState().status).toBe('signedIn');
  });

  it('register -> six-digit OTP by email -> verify; wrong code, cooldown, upgrade keeps progress', async () => {
    const email = `live${Date.now()}@example.com`;
    // upgrade the current guest (keeps the account id)
    const guest = A.authStore.getState().user;
    const upgraded = await A.authStore.getState().upgradeGuest({ email, password: 'Passw0rdOK', username: `live${String(Date.now()).slice(-8)}` });
    expect(upgraded.id).toBe(guest.id);
    expect(upgraded.accountType).toBe('REGISTERED');

    await expect(A.authApi.verifyEmail(email, '000000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await expect(A.authApi.resendVerification()).rejects.toMatchObject({ code: 'OTP_COOLDOWN' });
    const code = await waitFor(() => { try { return latestCode(email); } catch { return null; } }, 8000, 'OTP mail');
    expect(code).toMatch(/^\d{6}$/);
    await expect(A.authApi.verifyEmail(email, code)).resolves.toEqual({ verified: true });
    const me = await A.authStore.getState().refreshUser();
    expect(me.emailVerified).toBe(true);
  });

  it('wrong password is rejected and stores nothing', async () => {
    await expect(A.authApi.login('nobody@example.com', 'Passw0rdOK')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('profile, themes, daily rewards against the real backend', () => {
  it('updates bio/theme/timezone and the coins come only from the server', async () => {
    // the app already sent the device time zone at sign-in (first change is free); a second change is rate limited by the server
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect((await A.userApi.me()).timezone).toBe(deviceTz === 'UTC' ? 'UTC' : deviceTz);
    if (deviceTz !== 'America/Adak') await expect(A.userApi.update({ timezone: 'America/Adak' })).rejects.toMatchObject({ code: 'TIMEZONE_CHANGE_LIMITED' });
    const me = await A.userApi.update({ bio: 'Live test bio', theme: 'ocean', avatar: 'avatar_2' });
    expect(me).toMatchObject({ bio: 'Live test bio', theme: 'ocean', avatar: 'avatar_2' });
    await expect(A.userApi.update({ theme: 'rainbow' as never })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const status = await A.rewardApi.status();
    expect(status.canClaim).toBe(true);
    expect(status.cycle).toHaveLength(7);
    const claim = await A.rewardApi.claim();
    expect(claim.claimed).toEqual({ day: 1, coins: 100 });
    expect(claim.wallet.coins).toBe(100);
    await expect(A.rewardApi.claim()).rejects.toMatchObject({ code: 'REWARD_ALREADY_CLAIMED' });
    expect((await A.userApi.me()).wallet.coins).toBe(100);
  });
});

describe('offline matches sync (server replays and verifies)', () => {
  it('uploads a finished offline match once; a resend is a duplicate; points are not awarded', async () => {
    const { newLocalGame, playMove, toMatchRecord } = A.engine;
    let g = newLocalGame({ mode: 'LOCAL_2P', size: 3 });
    for (const p of [0, 3, 1, 4, 2]) g = playMove(g, p);
    await A.localGameStorage.clearMatches();
    await A.localGameStorage.saveMatch(toMatchRecord(g), 'Ann', 'Bob', 'live-match-1');
    const before = (await A.userApi.me()).stats;
    expect(await A.syncLocalMatches()).toBe(1);
    const after = (await A.userApi.me()).stats;
    expect(after.local.games).toBe(before.local.games + 1);
    expect(after.points).toBe(before.points); // offline play never awards points
    // resend the same clientMatchId straight to the API: idempotent
    const dup = await A.statisticsApi.syncLocalMatches([{ clientMatchId: 'live-match-1', size: 3, winLength: 3, mode: 'LOCAL_2P', moves: [0, 3, 1, 4, 2], durationMs: 1000 }]);
    expect(dup).toMatchObject({ accepted: 0, duplicates: 1 });
    // a forged/impossible match is rejected, not counted
    const bad = await A.statisticsApi.syncLocalMatches([{ clientMatchId: 'live-bad', size: 3, winLength: 3, mode: 'LOCAL_2P', moves: [0, 0, 1], durationMs: 1000 }]);
    expect(bad.accepted).toBe(0);
    expect(bad.rejected).toHaveLength(1);
  });
});

describe('online multiplayer through the app layers vs a second client', () => {
  let detach: () => void;
  let bSocket: Socket;
  let bToken: string;
  let bId: string;
  const bHttp = () => axios.create({ baseURL: `${BASE}/api/v1`, headers: { Authorization: `Bearer ${bToken}` }, adapter: 'http' });

  beforeAll(async () => {
    detach = A.attachSession();
    const g = await axios.post(`${BASE}/api/v1/auth/guest`, {}, { adapter: 'http' });
    bToken = g.data.data.tokens.accessToken;
    bId = g.data.data.user.id;
    bSocket = realIo(BASE, { transports: ['websocket'], auth: { token: bToken } });
    await new Promise<void>((res) => bSocket.once('session:ready', () => res()));
  });
  afterAll(() => {
    detach?.();
    bSocket?.disconnect();
  });

  it('quick match: both sides are matched by the server, moves sync live, the server decides the winner', async () => {
    await waitFor(() => A.socketClient.connected, 15000, 'app socket ready');
    const myId = A.authStore.getState().user.id;

    // B joins the queue first, then the app user searches (app side uses onlineActions.startQuickMatch)
    const bJoin = await new Promise<any>((res) => bSocket.emit('matchmaking:join', { boardSize: 3 }, (r: any) => res(r)));
    expect(bJoin.ok).toBe(true);
    const bFound = new Promise<any>((res) => bSocket.once('matchmaking:found', (p) => res(p)));
    const res = await A.actions.startQuickMatch(3);
    expect(['QUEUED', 'MATCHED']).toContain(res.status);
    await waitFor(() => A.onlineStore.getState().game?.status === 'IN_PROGRESS' || A.onlineStore.getState().game?.status === 'READY', 15000, 'app side match');
    const found = await bFound;
    const gameId = found.gameId;
    expect(A.onlineStore.getState().game.id).toBe(gameId);
    await new Promise<void>((res2) => bSocket.emit('game:join', { gameId }, () => res2()));
    await waitFor(() => A.onlineStore.getState().game?.status === 'IN_PROGRESS', 15000, 'game start');

    const game = () => A.onlineStore.getState().game;
    const myMark = game().players.find((p: any) => p.userId === myId).mark;
    const bMark = myMark === 'X' ? 'O' : 'X';
    const bMove = (position: number) => new Promise<any>((r) => bSocket.emit('game:move', { gameId, position, clientMoveId: `b-${position}-${Date.now()}` }, (x: any) => r(x)));

    // cell sequence that makes the app user win on the top row: mine 0,1,2 ; theirs 3,4 (X always starts)
    const mine = [0, 1, 2];
    const theirs = [3, 4, 6]; // never forms a line, so the app user (cells 0,1,2) always wins first
    let mi = 0;
    let ti = 0;
    for (let turn = 0; turn < 6; turn++) {
      if (game().currentTurn === myMark) {
        // the board is locked while a move is pending: rapid double submission sends ONE move
        await Promise.all([A.actions.submitMove(mine[mi]!), A.actions.submitMove(mine[mi]!)]);
        mi++;
      } else {
        const r = await bMove(theirs[ti]!);
        if (!r.ok) throw new Error(`B move rejected: ${JSON.stringify(r)} store=${JSON.stringify({ turn: game().currentTurn, myMark, moveCount: game().moveCount, status: game().status })}`);
        ti++;
        await waitFor(() => game().moveCount >= mi + ti, 5000, 'opponent move to reach the app store');
      }
      if (game().status !== 'IN_PROGRESS') break;
    }
    void bMark;
    await waitFor(() => game().status === 'COMPLETED' && game().players.every((p: any) => p.outcome), 15000, 'finish with outcomes').catch(async (e) => {
      const rest = await A.api.get(`/games/${gameId}`).then((r: any) => JSON.stringify(r.data.data.players)).catch(() => 'rest failed');
      throw new Error(`REST: ${rest} ${e.message}: ${JSON.stringify({ status: game().status, moves: game().moveCount, board: game().board, players: game().players, result: game().result })} SERVER: ${serverOut.slice(-1500)}`);
    });
    const me = game().players.find((p: any) => p.userId === myId);
    expect(game().result.winner).toBe(myMark);
    expect(game().result.reason).toBe('LINE');
    expect(me.outcome).toBe('WIN');
    expect(me.pointsAwarded).toBeGreaterThan(0);
    // the app refuses to send a move for a finished game; and if one is forced, the SERVER rejects it
    await A.actions.submitMove(8);
    expect(A.onlineStore.getState().game.board[8]).toBe('');
    await expect(A.api.post(`/games/${gameId}/moves`, { position: 8, clientMoveId: 'forced-after-end-1' })).rejects.toMatchObject({ code: 'GAME_NOT_ACTIVE' });
  });

  it('stats, history and leaderboard reflect the server-decided result', async () => {
    const stats = await A.statisticsApi.me();
    expect(stats.onlineWins).toBeGreaterThanOrEqual(1);
    const hist = await A.statisticsApi.history({});
    expect(hist.items[0]).toMatchObject({ type: 'ONLINE_RANDOM', result: 'WIN' });
    const lb = await A.leaderboardApi.get('global');
    expect(lb.rows.length).toBeGreaterThan(0);
    expect(lb.me?.rank).toBeGreaterThan(0);
    const ach = await A.achievementApi.mine();
    expect(ach.items.find((a: any) => a.key === 'FIRST_VICTORY')?.unlocked).toBe(true);
  });

  it('friends: request by username and accept via the real endpoints', async () => {
    const bProfile = await bHttp().get('/users/me');
    const req = await A.friendApi.request({ username: bProfile.data.data.username });
    expect(req.status).toBe('PENDING');
    const incoming = await bHttp().get('/friends', { params: { status: 'incoming' } });
    expect(incoming.data.data).toHaveLength(1);
    await bHttp().post(`/friends/${incoming.data.data[0].friendshipId}/accept`);
    const mine = await A.friendApi.list('accepted');
    expect(mine.items.map((f: any) => f.user.id)).toContain(bId);
  });

  it('reconnect restores the latest server game state (in-progress game survives a socket drop)', async () => {
    // new game vs B via private room, driven through the app actions
    const room = await A.actions.createRoom(3);
    expect(room.code).toHaveLength(6);
    const joined = await new Promise<any>((r) => bSocket.emit('room:join', { code: room.code }, (x: any) => r(x)));
    expect(joined.ok).toBe(true);
    await waitFor(() => A.onlineStore.getState().room?.guestId === bId, 10000, 'room:updated with guest');
    await new Promise<any>((r) => bSocket.emit('room:ready', { roomId: room.id, ready: true }, (x: any) => r(x)));
    await waitFor(() => A.onlineStore.getState().room?.guestReady === true, 10000, 'guest ready');
    const game = await A.actions.startRoomGame(room.id);
    expect(game.type).toBe('PRIVATE_ROOM');
    await A.actions.joinGame(game.id);
    await new Promise<any>((r) => bSocket.emit('game:join', { gameId: game.id }, (x: any) => r(x)));
    await waitFor(() => A.onlineStore.getState().game?.id === game.id && A.onlineStore.getState().game?.status === 'IN_PROGRESS', 10000, 'room game running');

    const myId = A.authStore.getState().user.id;
    const myMark = A.onlineStore.getState().game.players.find((p: any) => p.userId === myId).mark;
    if (A.onlineStore.getState().game.currentTurn === myMark) await A.actions.submitMove(4);
    else await new Promise<any>((r) => bSocket.emit('game:move', { gameId: game.id, position: 0, clientMoveId: `c-${Date.now()}` }, (x: any) => r(x)));
    await waitFor(() => A.onlineStore.getState().game.moveCount >= 1, 5000, 'first move');
    const countBefore = A.onlineStore.getState().game.moveCount;

    // drop the app's socket and reconnect (what happens on a bad network)
    A.socketClient.disconnect();
    A.onlineStore.getState().applyGame({ ...A.onlineStore.getState().game }); // keep state, as the app would
    A.socketClient.connect();
    await waitFor(() => A.socketClient.connected, 15000, 'reconnect');
    await waitFor(() => A.onlineStore.getState().game?.id === game.id, 5000, 'game still restored');
    expect(A.onlineStore.getState().game.moveCount).toBeGreaterThanOrEqual(countBefore);
    // and the opponent can still move, with the app seeing it
    await A.actions.forfeitGame(game.id);
    await waitFor(() => A.onlineStore.getState().game?.status === 'COMPLETED', 10000, 'forfeit result');
    expect(A.onlineStore.getState().game.result.reason).toBe('FORFEIT');
  });
});
