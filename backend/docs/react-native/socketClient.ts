import 'react-native-get-random-values'; // crypto.getRandomValues polyfill required by uuid
import { v4 as uuid } from 'uuid';
import { io, Socket } from 'socket.io-client';
import { refreshTokens } from './apiClient';
import { SOCKET_URL } from './config';
import { ApiError, toApiError } from './errors';
import { tokenStorage } from './tokenStorage';
import type { Ack, Game, MoveResult, ServerEvents } from './types';

type Listener<K extends keyof ServerEvents> = (payload: ServerEvents[K]) => void;

/**
 * One authenticated Socket.IO connection for the whole app.
 *  - JWT in the handshake (`auth` callback => always the CURRENT access token, also on automatic reconnects)
 *  - expired token => refresh via REST, then reconnect
 *  - heartbeat every 25 s (the server marks silent clients offline after 90 s)
 *  - every request/ack helper rejects with a normalised ApiError
 */
export class GameSocket {
  private socket: Socket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private ready = false;
  private readyWaiters: Array<() => void> = [];

  connect(): void {
    if (this.socket) return;
    const s = io(SOCKET_URL, {
      transports: ['websocket'], // no sticky sessions needed behind a load balancer
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      auth: (cb) => cb({ token: tokenStorage.current()?.accessToken }),
    });
    this.socket = s;

    s.on('session:ready', () => {
      this.ready = true;
      this.readyWaiters.splice(0).forEach((w) => w());
    });
    s.on('disconnect', () => {
      this.ready = false;
    });
    s.on('connect_error', async (err: Error & { data?: { code?: string } }) => {
      if (err.data?.code === 'TOKEN_EXPIRED' || err.data?.code === 'INVALID_TOKEN') {
        try {
          await refreshTokens(); // the auth callback above now returns the new access token
          s.connect();
        } catch {
          /* session is dead: apiClient already called the session-expired handler */
        }
      }
    });
    // server restarting -> come back shortly
    s.on('server:shutdown', ({ reconnectInMs }: { reconnectInMs: number }) => setTimeout(() => s.connect(), reconnectInMs));

    this.heartbeat = setInterval(() => {
      if (s.connected) s.emit('player:heartbeat', undefined, () => undefined);
    }, 25_000);
    s.connect();
  }

  disconnect(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.socket?.disconnect();
    this.socket = null;
    this.ready = false;
  }

  /** Resolves once the server finished (re)building the session. Await before the first emit. */
  whenReady(timeoutMs = 10_000): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new ApiError('NETWORK_ERROR', 'Socket not ready')), timeoutMs);
      this.readyWaiters.push(() => (clearTimeout(t), resolve()));
    });
  }

  on<K extends keyof ServerEvents>(event: K, fn: Listener<K>): () => void {
    this.socket?.on(event as string, fn as (...a: unknown[]) => void);
    return () => this.socket?.off(event as string, fn as (...a: unknown[]) => void);
  }

  /** Emit with acknowledgement + timeout. Rejects with ApiError({code}) when the server answers { ok: false }. */
  request<T>(event: string, payload?: unknown, timeoutMs = 8_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const s = this.socket;
      if (!s || !s.connected) return reject(new ApiError('NETWORK_ERROR', 'Not connected'));
      s.timeout(timeoutMs).emit(event, payload, (timedOut: Error | null, res: Ack<T>) => {
        if (timedOut) return reject(new ApiError('NETWORK_ERROR', 'The server did not answer in time'));
        if (res.ok) resolve(res.data);
        else reject(toApiError(res.error));
      });
    });
  }

  // ---- convenience wrappers --------------------------------------------------------------
  joinQueue = (boardSize: 3 | 4 | 5 = 3) => this.request<{ status: 'QUEUED' | 'MATCHED'; game?: Game }>('matchmaking:join', { boardSize });
  cancelQueue = () => this.request<{ cancelled: boolean }>('matchmaking:cancel');
  joinGame = (gameId: string) => this.request<Game>('game:join', { gameId });
  forfeit = (gameId: string) => this.request<Game>('game:forfeit', { gameId });
  rematch = (gameId: string) => this.request<{ status: 'REQUESTED' | 'STARTED'; game: Game }>('game:rematch', { gameId });
  createRoom = (boardSize: 3 | 4 | 5 = 3) => this.request<{ id: string; code: string }>('room:create', { boardSize });
  joinRoom = (code: string) => this.request<{ id: string }>('room:join', { code });

  /**
   * Send a move. `clientMoveId` makes retries safe: when the ack is lost (flaky network) call again with the SAME id and the
   * server answers with the original move (`duplicate: true`) instead of applying it twice.
   */
  async sendMove(gameId: string, position: number, clientMoveId: string = uuid()): Promise<MoveResult> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request<MoveResult>('game:move', { gameId, position, clientMoveId });
      } catch (e) {
        const err = toApiError(e);
        if (err.code !== 'NETWORK_ERROR' || attempt >= 2) throw err;
        await this.whenReady().catch(() => undefined); // wait for the automatic reconnect, then retry with the same id
      }
    }
  }
}

export const gameSocket = new GameSocket();
