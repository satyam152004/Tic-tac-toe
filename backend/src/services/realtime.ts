import type { Server } from 'socket.io';

/**
 * Thin holder so services (REST + jobs + sockets) can push real-time events without
 * importing the socket layer (avoids circular deps). Rooms:
 *   user:<userId>  - every socket of a user (all devices)
 *   game:<gameId>  - sockets of verified players of a game
 *   room:<roomId>  - sockets of members of a private room
 * All operations go through the adapter, so they work across instances with the Redis adapter.
 */
let io: Server | null = null;

export const realtime = {
  setIo(server: Server | null): void {
    io = server;
  },
  getIo(): Server | null {
    return io;
  },
  emitToUser(userId: unknown, event: string, payload: unknown): void {
    io?.to(`user:${String(userId)}`).emit(event, payload);
  },
  emitToGame(gameId: unknown, event: string, payload: unknown): void {
    io?.to(`game:${String(gameId)}`).emit(event, payload);
  },
  emitToRoom(roomId: unknown, event: string, payload: unknown): void {
    io?.to(`room:${String(roomId)}`).emit(event, payload);
  },
  /** Make all sockets of a user join a room (only called after membership was verified). */
  joinUserTo(userId: unknown, room: string): void {
    io?.in(`user:${String(userId)}`).socketsJoin(room);
  },
  leaveUserFrom(userId: unknown, room: string): void {
    io?.in(`user:${String(userId)}`).socketsLeave(room);
  },
  async isUserOnline(userId: unknown): Promise<boolean> {
    if (!io) return false;
    const sockets = await io.in(`user:${String(userId)}`).fetchSockets();
    return sockets.length > 0;
  },
};
