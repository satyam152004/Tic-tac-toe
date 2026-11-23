import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/index.js';
import { auth, clearDb, Env, registerUser, startEnv, stopEnv } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => clearDb());

const api = () => request(env.app);

describe('emblem shop', () => {
  it('lists the catalog: free emblems unlocked, cobalt equipped by default', async () => {
    const u = await registerUser(env.app, 'shopper');
    const res = await api().get('/api/v1/shop/emblems').set(auth(u));
    expect(res.status).toBe(200);
    expect(res.body.data.equipped).toBe('cobalt');
    const byId = Object.fromEntries(res.body.data.emblems.map((e: { id: string }) => [e.id, e]));
    expect(byId.cobalt.unlocked).toBe(true);
    expect(byId.tactical.unlocked).toBe(true);
    expect(byId.crown.unlocked).toBe(false);
  });

  it('refuses to unlock without enough coins and does not touch the balance', async () => {
    const u = await registerUser(env.app, 'poor');
    await UserModel.updateOne({ _id: u.id }, { $set: { 'wallet.coins': 100 } });
    const res = await api().post('/api/v1/shop/emblems/crown/unlock').set(auth(u));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
    expect((await UserModel.findById(u.id).lean())!.wallet!.coins).toBe(100);
  });

  it('spends the server price, equips, and refuses a second purchase', async () => {
    const u = await registerUser(env.app, 'buyer');
    await UserModel.updateOne({ _id: u.id }, { $set: { 'wallet.coins': 1000 } });
    const res = await api().post('/api/v1/shop/emblems/crown/unlock').set(auth(u)).send({ cost: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.coins).toBe(550);
    expect(res.body.data.equipped).toBe('crown');
    const again = await api().post('/api/v1/shop/emblems/crown/unlock').set(auth(u));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('EMBLEM_ALREADY_OWNED');
    expect((await UserModel.findById(u.id).lean())!.wallet!.coins).toBe(550);
  });

  it('equips owned emblems only, and rejects unknown ids', async () => {
    const u = await registerUser(env.app, 'equipper');
    expect((await api().post('/api/v1/shop/emblems/frame/equip').set(auth(u))).body.error.code).toBe('EMBLEM_LOCKED');
    expect((await api().post('/api/v1/shop/emblems/tactical/equip').set(auth(u))).body.data.equipped).toBe('tactical');
    expect((await api().post('/api/v1/shop/emblems/nope/equip').set(auth(u))).status).toBe(400);
  });

  it('concurrent purchases charge exactly once', async () => {
    const u = await registerUser(env.app, 'racer');
    await UserModel.updateOne({ _id: u.id }, { $set: { 'wallet.coins': 2000 } });
    const rs = await Promise.all([1, 2, 3].map(() => api().post('/api/v1/shop/emblems/frame/unlock').set(auth(u))));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await UserModel.findById(u.id).lean())!.wallet!.coins).toBe(1200);
  });

  it('requires authentication', async () => {
    expect((await api().get('/api/v1/shop/emblems')).status).toBe(401);
  });
});
