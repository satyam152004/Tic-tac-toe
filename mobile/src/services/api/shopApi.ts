import { api, unwrap } from './apiClient';

export interface EmblemView {
  id: string;
  name: string;
  sub: string;
  cost: number;
  badge: string;
  bg: string;
  fg: string;
  unlocked: boolean;
  equipped: boolean;
}
export interface EmblemShop { coins: number; equipped: string; emblems: EmblemView[] }

/** Server-authoritative: prices, ownership and the coin balance all live on the backend. */
export const shopApi = {
  emblems: () => unwrap<EmblemShop>(api.get('/shop/emblems')),
  unlock: (id: string) => unwrap<EmblemShop>(api.post(`/shop/emblems/${id}/unlock`)),
  equip: (id: string) => unwrap<EmblemShop>(api.post(`/shop/emblems/${id}/equip`)),
};
