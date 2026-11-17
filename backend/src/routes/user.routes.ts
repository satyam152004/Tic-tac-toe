import * as c from '../controllers/user.controller.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/user.validator.js';
import { route } from './registry.js';

const tag = 'Users';

export const userRoutes = [
  route({ method: 'get', path: '/users/me', tag, summary: 'Get my full profile', response: 'Profile with stats, sound/theme/language preferences', handler: c.getMe }),
  route({ method: 'patch', path: '/users/me', tag, summary: 'Update my profile and preferences', body: v.updateMeBody, response: 'Updated profile', errors: ['USERNAME_TAKEN'], handler: c.updateMe }),
  route({ method: 'delete', path: '/users/me', tag, summary: 'Delete my account (password required for registered accounts)', body: v.deleteMeBody, response: '{ deleted: true }', errors: ['INVALID_CREDENTIALS'], handler: c.deleteMe }),
  route({ method: 'get', path: '/users/search', tag, summary: 'Search players by username prefix', query: v.searchQuery, response: 'Array of public profiles (paginated, meta)', handler: c.search }),
  route({ method: 'get', path: '/users/:id', tag, summary: 'Get a public player profile', params: idParam, response: 'Public profile (no email / preferences)', handler: c.getUser }),
  route({ method: 'post', path: '/users/:id/report', tag, summary: 'Report a player', params: idParam, body: v.reportBody, status: 201, response: 'Created report', errors: ['SELF_REPORT', 'REPORT_LIMIT'], handler: c.report }),
  route({ method: 'post', path: '/devices/register', tag: 'Devices', summary: 'Register / refresh an FCM device token for push notifications', body: v.registerDeviceBody, status: 201, response: 'Device registration (id, platform)', handler: c.registerDevice }),
  route({ method: 'delete', path: '/devices/:id', tag: 'Devices', summary: 'Remove a registered device token', params: idParam, response: '{ removed: true }', handler: c.removeDevice }),
];
