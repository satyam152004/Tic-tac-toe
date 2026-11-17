import * as Crypto from 'expo-crypto';
import { io, Socket } from 'socket.io-client';
import { refreshTokens } from '../api/apiClient';
import { SOCKET_URL } from '../api/config';
import { ApiError, toApiError } from '../api/errors';
import type { Ack, ServerEvents } from '../api/types';
import { tokenStorage } from '../storage/secureStorage';

type Listener<K extends keyof ServerEvents> = (payload: ServerEvents[K]) => void;
export type SocketStatus = 'idle' | 'connecting' | 'ready' | 'reconnecting' | 'closed';

/**
 * ONE authenticated Socket.IO connection for the whole app session.
 *  - JWT in the handshake `auth` callback (always the CURRENT access token, also on automatic reconnects)
 *  - expired token -> refresh via REST (single flight) -> reconnect
 *  - heartbeat every 25 s (server marks silent clients offline after 90 s)
 *  - listeners are registered through on() which returns an unsubscribe fn (no duplicate listeners)
 *  - `status` is observable so the UI can show a reconnecting banner
 */
class SocketClient {
  private socket: Socket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private ready = false;
  private waiters: Array<() => void> = [];
  private statusListeners = new Set<(s: SocketStatus) => void>();
  private _status: SocketStatus = 'idle';
  /** Every handler ever registered through on(): re-attached if the underlying socket is recreated. */
  private handlers = new Map<string, Set<(p: never) => void>>();

  get status(): SocketStatus {
    return this._status;
  }
  get connected(): boolean {
    return this.socket?.connected === true && this.ready;
  }

  private setStatus(s: SocketStatus): void {
    if (this._status === s) return;
    this._status = s;
    this.statusListeners.forEach((l) => l(s));
  }
  onStatus(fn: (s: SocketStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  /** Idempotent: calling connect() twice never opens a second connection. */
  connect(): void {
    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return;
    }
    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      auth: (cb) => cb({ token: tokenStorage.current()?.accessToken }),
    });
    this.socket = s;
    this.setStatus('connecting');

    // Re-attach handlers registered before the socket existed.
    this.handlers.forEach((set, event) => set.forEach((h) => s.on(event, h as (...a: unknown[]) => void)));

    s.on('session:ready', () => {
      this.ready = true;
      this.setStatus('ready');
      this.waiters.splice(0).forEach((w) => w());
    });
    s.on('disconnect', (reason) => {
      this.ready = false;
      this.setStatus(reason === 'io client disconnect' ? 'closed' : 'reconnecting');
    });
    s.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));
    s.on('connect_error', async (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN' || code === 'UNAUTHORIZED') {
        try {
          await refreshTokens(); // the auth callback now yields the new access token
          s.connect();
        } catch {
          /* session dead: apiClient already invoked the session-expired handler */
        }
      } else {
        this.setStatus('reconnecting');
      }
    });
    s.on('server:shutdown', ({ reconnectInMs }: { reconnectInMs: number }) => setTimeout(() => s.connect(), reconnectInMs));

    this.heartbeat = setInterval(() => {
      if (s.connected) s.emit('player:heartbeat', undefined, () => undefined);
    }, 25_000);
    s.connect();
  }

  disconnect(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.ready = false;
    this.waiters = [];
    this.setStatus('closed');
  }

  /** Resolves when the server finished building the session (await before the first emit). */
  whenReady(timeoutMs = 10_000): Promise<void> {
    if (this.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new ApiError('NETWORK_ERROR', 'Socket not ready')), timeoutMs);
      this.waiters.push(() => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  /** Subscribe to a server event. Always call the returned function on cleanup. */
  on<K extends keyof ServerEvents>(event: K, fn: Listener<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn as (p: never) => void);
    this.socket?.on(event as string, fn as (...a: unknown[]) => void);
    return () => {
      set?.delete(fn as (p: never) => void);
      this.socket?.off(event as string, fn as (...a: unknown[]) => void);
    };
  }

  /** Emit with ack + timeout; rejects with ApiError when the server answers { ok:false }. */
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

  newId(): string {
    return Crypto.randomUUID();
  }
}

export const socketClient = new SocketClient();
