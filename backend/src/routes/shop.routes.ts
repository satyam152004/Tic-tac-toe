import * as c from '../controllers/shop.controller.js';
import { emblemParam } from '../validators/shop.validator.js';
import { route } from './registry.js';

const tag = 'Shop';

export const shopRoutes = [
  route({ method: 'get', path: '/shop/emblems', tag, summary: 'Emblem catalog with my coin balance, what I own and what is equipped', response: '{ coins, equipped, emblems[{ id, name, sub, cost, badge, bg, fg, unlocked, equipped }] }', handler: c.list }),
  route({ method: 'post', path: '/shop/emblems/:id/unlock', tag, summary: 'Spend coins to unlock an emblem (price decided by the server) and equip it', params: emblemParam, response: 'Same shape as GET /shop/emblems', errors: ['INSUFFICIENT_COINS', 'EMBLEM_ALREADY_OWNED', 'EMBLEM_NOT_FOUND'], handler: c.unlock }),
  route({ method: 'post', path: '/shop/emblems/:id/equip', tag, summary: 'Equip an emblem I own', params: emblemParam, response: 'Same shape as GET /shop/emblems', errors: ['EMBLEM_LOCKED', 'EMBLEM_NOT_FOUND'], handler: c.equip }),
];
