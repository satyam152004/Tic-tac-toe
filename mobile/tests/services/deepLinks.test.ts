import { parseLink } from '../../src/services/deepLinks';

jest.mock('expo-linking', () => ({
  parse: (url: string) => {
    const m = /^[a-z]+:\/\/(?:[^/]+\/)?(.*)$/i.exec(url);
    const isCustom = url.startsWith('tictactoe://');
    return { path: isCustom ? url.replace('tictactoe://', '') : (m?.[1] ?? '') };
  },
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

describe('deep link parsing', () => {
  it('parses room join links (custom scheme and https) and normalises the code', () => {
    expect(parseLink('tictactoe://join/abc234')).toEqual({ type: 'join', code: 'ABC234' });
    expect(parseLink('https://play.example.com/join/XYZ789')).toEqual({ type: 'join', code: 'XYZ789' });
  });

  it('parses friend challenge links', () => {
    expect(parseLink('tictactoe://invite/665f1c2e8b3a4c0012345678')).toEqual({ type: 'invite', gameId: '665f1c2e8b3a4c0012345678' });
  });

  it('rejects malformed or hostile input', () => {
    expect(parseLink('tictactoe://join/abc')).toBeNull();
    expect(parseLink('tictactoe://join/abc23!')).toBeNull();
    expect(parseLink('tictactoe://invite/not-an-id')).toBeNull();
    expect(parseLink('tictactoe://settings')).toBeNull();
    expect(parseLink(null)).toBeNull();
    expect(parseLink('')).toBeNull();
  });
});
