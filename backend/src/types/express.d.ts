import 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; sessionId: string; accountType: 'GUEST' | 'REGISTERED' };
      requestId?: string;
    }
  }
}
export {};
