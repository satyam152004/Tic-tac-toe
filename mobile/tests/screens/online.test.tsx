import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { gameFixture, meFixture, oppCard, ME_ID, OPP_ID } from '../mocks/onlineFixtures';

const mockNav = {
  replace: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  dispatch: jest.fn(),
  addListener: jest.fn(() => () => undefined),
};
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => mockNav }));
jest.mock('../../src/navigation/useAppNav', () => {
  let api: unknown;
  return { useAppNav: () => (api ??= { nav: mockNav, goTab: jest.fn(), goHome: jest.fn(), resetTo: jest.fn(), back: jest.fn() }) };
});

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => 'abc123'), setStringAsync: jest.fn(async () => true) }));
jest.mock('../../src/services/socket/socketClient', () => ({
  socketClient: { status: 'ready', connected: true, onStatus: jest.fn(() => () => undefined), on: jest.fn(() => () => undefined), connect: jest.fn(), newId: jest.fn(() => 'id') },
}));
jest.mock('../../src/services/socket/gameSocket', () => ({
  gameSocket: { offerDraw: jest.fn(async () => undefined), respondDraw: jest.fn(async () => undefined) },
}));
jest.mock('../../src/services/onlineActions', () => ({
  submitMove: jest.fn(async () => undefined),
  startQuickMatch: jest.fn(async () => ({ status: 'QUEUED' })),
  cancelQuickMatch: jest.fn(async () => undefined),
  createRoom: jest.fn(),
  joinRoomByCode: jest.fn(),
  setReady: jest.fn(),
  startRoomGame: jest.fn(),
  leaveRoom: jest.fn(async () => undefined),
  joinGame: jest.fn(async () => undefined),
  openGame: jest.fn(async () => undefined),
  forfeitGame: jest.fn(async () => undefined),
  requestRematch: jest.fn(async () => 'REQUESTED'),
}));
jest.mock('../../src/services/api/gameApi', () => ({ gameApi: { active: jest.fn(async () => []), get: jest.fn(), forfeit: jest.fn(), replay: jest.fn(async () => ({ totalMoves: 0, frames: [] })), inviteFriend: jest.fn(async () => ({ id: 'game-9', type: 'FRIEND', status: 'WAITING', boardSize: 3, board: [], players: [] })),
  invites: jest.fn(async () => ({ incoming: [{ game: { id: 'gi1', type: 'FRIEND', status: 'WAITING', boardSize: 3, entryAmount: 0, board: [], players: [] }, from: { id: 'u9', username: 'ann', displayName: 'Ann', avatar: 'av_1', level: 2, online: true }, to: null, expiresAt: new Date(Date.now() + 600000).toISOString() }], outgoing: [] })),
  decline: jest.fn(async () => ({ declined: true })),
  cancelInvite: jest.fn(async () => ({ cancelled: true })),
 } }));
jest.mock('../../src/services/api/userApi', () => ({ userApi: { me: jest.fn(async () => require('../mocks/onlineFixtures').meFixture()), get: jest.fn() } }));
jest.mock('../../src/services/api/roomApi', () => ({ roomApi: { get: jest.fn(), invite: jest.fn() } }));
jest.mock('../../src/services/api/friendApi', () => ({ friendApi: { list: jest.fn(async () => ({ items: [], total: 0 })), request: jest.fn(async () => ({ id: 'f1', status: 'PENDING' })) } }));

import { JoinRoomScreen } from '../../src/screens/online/JoinRoomScreen';
import { MatchmakingScreen } from '../../src/screens/online/MatchmakingScreen';
import { MatchFoundScreen } from '../../src/screens/online/MatchFoundScreen';
import { ChallengeList } from '../../src/screens/social/ChallengeList';
import { MatchSetupScreen } from '../../src/screens/offline/MatchSetupScreen';
import { GameBoardScreen } from '../../src/screens/game/GameBoardScreen';
import { OnlineLobbyScreen } from '../../src/screens/online/OnlineLobbyScreen';
import { GameResultScreen } from '../../src/screens/game/GameResultScreen';
import { RoomDetailsScreen } from '../../src/screens/online/RoomDetailsScreen';
import { WaitingRoomScreen } from '../../src/screens/online/WaitingRoomScreen';
import { ApiError } from '../../src/services/api/errors';
import * as actions from '../../src/services/onlineActions';
import { gameSocket } from '../../src/services/socket/gameSocket';
import { socketClient } from '../../src/services/socket/socketClient';
import { useAuthStore } from '../../src/store/authStore';
import { useOnlineStore } from '../../src/store/onlineStore';
import { useToastStore } from '../../src/store/toastStore';

const a = actions as jest.Mocked<typeof actions>;
const gs = gameSocket as jest.Mocked<typeof gameSocket>;

async function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const props = <T,>(params?: T) => ({ route: { key: 'k', name: 'x', params }, navigation: mockNav }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  useOnlineStore.getState().reset();
  useToastStore.setState({ toast: null });
  useAuthStore.setState({ user: meFixture(), status: 'signedIn', offline: false });
  useOnlineStore.getState().setCards([oppCard]);
});

describe('GameBoardScreen (online)', () => {
  const open = async (game = gameFixture()) => {
    useOnlineStore.getState().applyGame(game);
    return wrap(<GameBoardScreen {...props({ gameId: 'game-1' })} />);
  };

  it('renders both players and the board from the server state', async () => {
    await open(gameFixture({ board: ['X', '', '', '', 'O', '', '', '', ''], moveCount: 2, currentTurn: 'X' }));
    expect(await screen.findByText('Your turn')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Opponent Pro')).toBeTruthy();
    expect(screen.getByText(/• Online$/)).toBeTruthy();
    expect(screen.getByLabelText('Cell 1 marked X')).toBeTruthy();
    expect(screen.getByLabelText('Cell 5 marked O')).toBeTruthy();
  });

  it('disables the board when it is not my turn', async () => {
    await open(gameFixture({ currentTurn: 'O' }));
    await screen.findByText("Opponent Pro's turn");
    await fireEvent.press(screen.getByTestId('cell-0'));
    expect(a.submitMove).not.toHaveBeenCalled();
  });

  it('tapping a cell on my turn calls submitMove once', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('cell-4'));
    expect(a.submitMove).toHaveBeenCalledTimes(1);
    expect(a.submitMove).toHaveBeenCalledWith(4);
  });

  it('locks the board while a move is pending', async () => {
    await open();
    await act(async () => useOnlineStore.getState().setPending(true));
    await fireEvent.press(screen.getByTestId('cell-4'));
    expect(a.submitMove).not.toHaveBeenCalled();
  });

  it('shows a toast when the server rejects a move', async () => {
    await open();
    await act(async () => useOnlineStore.getState().setMoveError({ code: 'CELL_OCCUPIED', message: 'x', at: Date.now() }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('That square is already taken.'));
  });

  it('shows the opponent-disconnected banner with a countdown and the reconnecting overlay', async () => {
    await open();
    await act(async () => useOnlineStore.getState().setOpponentOffline({ userId: OPP_ID, graceSeconds: 30, since: Date.now() }));
    const banner = await screen.findByTestId('opponent-offline-banner');
    expect(banner).toBeTruthy();
    expect(screen.getByText(/Opponent Pro disconnected\. They lose in 00:/)).toBeTruthy();
    await act(async () => useOnlineStore.getState().setReconnecting(true));
    expect(await screen.findByTestId('reconnecting-overlay')).toBeTruthy();
  });

  it('forfeit asks for confirmation and then calls forfeitGame', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('forfeit'));
    expect(a.forfeitGame).not.toHaveBeenCalled();
    await screen.findByText('Give up this match?');
    const forfeits = screen.getAllByText('Give up');
    await fireEvent.press(forfeits[forfeits.length - 1]);
    await waitFor(() => expect(a.forfeitGame).toHaveBeenCalledWith('game-1'));
  });

  it('Offer Draw asks for confirmation, calls gameSocket.offerDraw and is disabled while the offer is sent', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('offer-draw'));
    expect(gs.offerDraw).not.toHaveBeenCalled();
    await screen.findByText('Offer a draw?');
    await fireEvent.press(screen.getByText('Send offer'));
    await waitFor(() => expect(gs.offerDraw).toHaveBeenCalledWith('game-1'));
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    await act(async () => useOnlineStore.getState().applyGame(gameFixture({ drawOffer: { by: ME_ID, expiresAt } })));
    await waitFor(() => expect(screen.getByTestId('offer-draw').props.accessibilityState.disabled).toBe(true));
  });

  it('an incoming draw offer shows DrawOfferModal and Accept responds with true', async () => {
    await open();
    await screen.findByTestId('offer-draw');
    const handler = (socketClient.on as jest.Mock).mock.calls.filter((c) => c[0] === 'game:draw-offered').pop()![1];
    await act(async () => handler({ gameId: 'game-1', by: OPP_ID, expiresAt: new Date(Date.now() + 60000).toISOString(), moveCount: 3 }));
    expect(await screen.findByText('Draw offer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('draw-accept'));
    await waitFor(() => expect(gs.respondDraw).toHaveBeenCalledWith('game-1', true));
    await waitFor(() => expect(screen.queryByText('Draw offer')).toBeNull());
  });

  it('navigates to the result screen when the server finishes the game', async () => {
    await open();
    await act(async () =>
      useOnlineStore.getState().applyGame(
        gameFixture({ status: 'COMPLETED', moveCount: 5, result: { winner: 'X', winnerId: ME_ID, line: [0, 1, 2], reason: 'LINE' } }),
      ),
    );
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('online_result', { gameId: 'game-1' }), { timeout: 3000 });
  });
});

describe('GameResultScreen (online)', () => {
  const finished = (me: 'WIN' | 'LOSS' | 'DRAW', reason: 'LINE' | 'FORFEIT' | 'TIMEOUT' | 'DRAW') =>
    gameFixture({
      status: me === 'DRAW' ? 'DRAW' : 'COMPLETED',
      moveCount: 6,
      board: ['X', 'X', 'X', 'O', 'O', '', '', '', ''],
      result: { winner: me === 'WIN' ? 'X' : me === 'LOSS' ? 'O' : null, winnerId: me === 'WIN' ? ME_ID : me === 'LOSS' ? OPP_ID : null, line: [0, 1, 2], reason },
      players: [
        { userId: ME_ID, mark: 'X', isAI: false, joined: true, outcome: me, pointsAwarded: me === 'WIN' ? 25 : me === 'LOSS' ? -10 : 0 },
        { userId: OPP_ID, mark: 'O', isAI: false, joined: true, outcome: me === 'WIN' ? 'LOSS' : me === 'LOSS' ? 'WIN' : 'DRAW', pointsAwarded: 0 },
      ],
    });
  const open = async (g: ReturnType<typeof finished>) => {
    useOnlineStore.getState().applyGame(g);
    return wrap(<GameResultScreen {...props({ gameId: 'game-1' })} />);
  };

  it('shows the server outcome, reason and points for a win', async () => {
    await open(finished('WIN', 'FORFEIT'));
    expect(await screen.findByText('You won!')).toBeTruthy();
    expect(screen.getByText('+25')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('shows a loss from the server outcome (not from the board)', async () => {
    await open(finished('LOSS', 'TIMEOUT'));
    expect(await screen.findByText('You lost')).toBeTruthy();
    expect(screen.getByText('-10')).toBeTruthy();
  });

  it('shows a draw', async () => {
    await open(finished('DRAW', 'DRAW'));
    expect(await screen.findByText("It's a draw")).toBeTruthy();
    expect(screen.getAllByText('+0').length).toBe(2);
  });

  it('rematch: sends a request, then shows waiting state', async () => {
    await open(finished('WIN', 'LINE'));
    await fireEvent.press(await screen.findByTestId('rematch'));
    expect(a.requestRematch).toHaveBeenCalledWith('game-1');
    await act(async () => useOnlineStore.getState().setRematch({ requestedByMe: true }));
    expect(await screen.findByText('Waiting for opponent...')).toBeTruthy();
  });

  it('shows when the opponent wants a rematch and navigates to the new game', async () => {
    await open(finished('WIN', 'LINE'));
    await act(async () => useOnlineStore.getState().setRematch({ requestedByOpponent: true }));
    expect(await screen.findByTestId('rematch')).toBeTruthy();
    await act(async () => useOnlineStore.getState().setRematchGameId('game-2'));
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('match_found', { gameId: 'game-2', source: 'RANKED' }));
  });

  it('loads the game from the server when it is not in the store', async () => {
    useOnlineStore.getState().reset();
    (a.openGame as jest.Mock).mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<GameResultScreen {...props({ gameId: 'game-9' })} />);
    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(a.openGame).toHaveBeenCalledWith('game-9');
  });
});

describe('JoinRoomScreen', () => {
  const submit = async (code: string) => {
    await wrap(<JoinRoomScreen {...props()} />);
    await fireEvent.changeText(screen.getByTestId('room-code-input'), code);
    await fireEvent.press(screen.getByTestId('join-room-submit'));
  };

  it.each([
    ['ROOM_NOT_FOUND', 'Room code not found. Check the code and try again.'],
    ['ROOM_EXPIRED', 'That room has expired. Ask your friend to create a new one.'],
    ['ROOM_FULL', 'That room is already full.'],
    ['BLOCKED', "You can't join this room."],
  ])('maps %s to a friendly inline error', async (code, text) => {
    (a.joinRoomByCode as jest.Mock).mockRejectedValueOnce(new ApiError(code, 'raw server text'));
    await submit('abc123');
    expect(await screen.findByText(text)).toBeTruthy();
    expect(mockNav.replace).not.toHaveBeenCalled();
  });

  it('uppercases the code, validates length and joins', async () => {
    await wrap(<JoinRoomScreen {...props()} />);
    await fireEvent.changeText(screen.getByTestId('room-code-input'), 'ab1');
    expect(screen.getByTestId('room-code-input').props.value).toBe('AB1');
    await fireEvent.press(screen.getByTestId('join-room-submit'));
    expect(await screen.findByText('Enter the 6-character room code.')).toBeTruthy();
    expect(a.joinRoomByCode).not.toHaveBeenCalled();

    (a.joinRoomByCode as jest.Mock).mockResolvedValueOnce({ id: 'room-1' });
    await fireEvent.changeText(screen.getByTestId('room-code-input'), 'ab1234');
    await fireEvent.press(screen.getByTestId('join-room-submit'));
    await waitFor(() => expect(a.joinRoomByCode).toHaveBeenCalledWith('AB1234'));
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('waiting_room', { roomId: 'room-1' }));
  });

  it('pastes from the clipboard and prefills from deep link params', async () => {
    await wrap(<JoinRoomScreen {...props({ code: 'zz9988' })} />);
    expect(screen.getByTestId('room-code-input').props.value).toBe('ZZ9988');
    await fireEvent.press(screen.getByTestId('paste-code'));
    await waitFor(() => expect(screen.getByTestId('room-code-input').props.value).toBe('ABC123'));
  });
});

describe('MatchmakingScreen', () => {
  it('starts the search once, shows searching state and cancels', async () => {
    await wrap(<MatchmakingScreen {...props({ boardSize: 4, firstMove: 'RANDOM' })} />);
    expect(await screen.findByText('Searching for an opponent')).toBeTruthy();
    expect(screen.getByTestId('search-spec').props.children).toBe('Ranked, 4×4');
    expect(screen.getByText('Rating 1,030')).toBeTruthy();
    expect(a.startQuickMatch).toHaveBeenCalledTimes(1);
    expect(a.startQuickMatch).toHaveBeenCalledWith(4, 'RANDOM', 0);
    await fireEvent.press(screen.getByTestId('cancel-search'));
    await waitFor(() => expect(a.cancelQuickMatch).toHaveBeenCalledTimes(1));
    expect(a.startQuickMatch).toHaveBeenCalledTimes(1);
  });

  it('shows the opponent and enters the match when found', async () => {
    (a.startQuickMatch as jest.Mock).mockImplementationOnce(async () => {
      useOnlineStore.getState().setMatchmaking({ phase: 'searching', startedAt: Date.now() });
      return { status: 'QUEUED' };
    });
    await wrap(<MatchmakingScreen {...props({ boardSize: 3 })} />);
    await act(async () => {
      useOnlineStore.getState().applyGame(gameFixture());
      useOnlineStore.getState().setMatchmaking({ phase: 'found', startedAt: null });
    });
    expect(await screen.findByText('Opponent found')).toBeTruthy();
    expect(screen.getByText('Matched with Opponent Pro')).toBeTruthy();
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('match_found', { gameId: 'game-1', source: 'RANKED' }), { timeout: 4000 });
  });

  it('offers a retry when the queue ticket expired', async () => {
    await wrap(<MatchmakingScreen {...props({ boardSize: 3 })} />);
    await act(async () => useOnlineStore.getState().setMatchmaking({ phase: 'idle', startedAt: null, cancelReason: 'EXPIRED' }));
    expect(await screen.findByText('No opponent found')).toBeTruthy();
    await fireEvent.press(screen.getByText('Search Again'));
    await waitFor(() => expect(a.startQuickMatch).toHaveBeenCalledTimes(2));
  });

  it('offers to return to the game on ALREADY_IN_GAME', async () => {
    (a.startQuickMatch as jest.Mock).mockRejectedValueOnce(new ApiError('ALREADY_IN_GAME', 'x'));
    await wrap(<MatchmakingScreen {...props({ boardSize: 3 })} />);
    expect(await screen.findByText('Return to game')).toBeTruthy();
  });
});

describe('WaitingRoomScreen', () => {
  const room = (over = {}) => ({
    id: 'room-1', code: 'VTX409', status: 'FULL', host: { ...oppCard, id: 'h', displayName: 'Hosty' }, guest: { ...oppCard, id: ME_ID, displayName: 'Me Player' },
    hostId: 'h', guestId: ME_ID, boardSize: 3, winLength: 3, guestReady: false, gameId: null, expiresAt: new Date(Date.now() + 600000).toISOString(), ...over,
  });

  it('Room Details: guest toggles ready and is sent to the board when the game appears', async () => {
    useOnlineStore.getState().setRoom(room() as never);
    await wrap(<RoomDetailsScreen {...props({ roomId: 'room-1' })} />);
    expect(await screen.findByTestId('guest-status')).toBeTruthy();
    (a.setReady as jest.Mock).mockResolvedValueOnce(room({ guestReady: true }));
    await fireEvent.press(screen.getByTestId('ready-toggle'));
    expect(a.setReady).toHaveBeenCalledWith('room-1', true);
    await act(async () => useOnlineStore.getState().setRoom(room({ status: 'PLAYING', gameId: 'game-7' }) as never));
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('match_found', { gameId: 'game-7', source: 'ROOM' }));
  });

  it('host can start only when the guest is present and ready', async () => {
    useAuthStore.setState({ user: meFixture({ id: 'h' }) });
    useOnlineStore.getState().setRoom(room({ guestReady: false }) as never);
    await wrap(<RoomDetailsScreen {...props({ roomId: 'room-1' })} />);
    await screen.findByTestId('guest-status');
    await fireEvent.press(screen.getByTestId('start-match'));
    expect(a.startRoomGame).not.toHaveBeenCalled();
    await act(async () => useOnlineStore.getState().setRoom(room({ guestReady: true, status: 'READY' }) as never));
    (a.startRoomGame as jest.Mock).mockResolvedValueOnce(gameFixture({ id: 'game-5' }));
    await fireEvent.press(screen.getByTestId('start-match'));
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('match_found', { gameId: 'game-5', source: 'ROOM' }));
  });

  it('shows the room-ended state when the server expires the room', async () => {
    useOnlineStore.getState().setRoom(room({ guest: null, guestId: null, status: 'WAITING' }) as never);
    await wrap(<WaitingRoomScreen {...props({ roomId: 'room-1' })} />);
    await screen.findByText('VTX-409');
    await act(async () => {
      useOnlineStore.getState().setRoom(null);
      useOnlineStore.getState().setRoomEnded('EXPIRED');
    });
    expect(await screen.findByText('Room expired')).toBeTruthy();
  });
});

describe('OnlineLobbyScreen', () => {
  it('navigates to quick match (3x3), create and join', async () => {
    await wrap(<OnlineLobbyScreen {...props()} />);
    await fireEvent.press(await screen.findByTestId('quick-match'));
    expect(mockNav.navigate).toHaveBeenCalledWith('match_setup', { mode: 'ONLINE', purpose: 'QUICK' });
    await fireEvent.press(screen.getByTestId('create-room'));
    expect(mockNav.navigate).toHaveBeenCalledWith('create_room');
    await fireEvent.press(screen.getByTestId('join-room'));
    expect(mockNav.navigate).toHaveBeenCalledWith('join_room');
  });

  it('shows the offline state', async () => {
    useAuthStore.setState({ offline: true });
    await wrap(<OnlineLobbyScreen {...props()} />);
    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(screen.queryByTestId('quick-match')).toBeNull();
  });
});

describe('MatchSetupScreen (online)', () => {
  it('quick match: board size and first mover go to the matchmaking search', async () => {
    const route = { key: 'k', name: 'match_setup', params: { mode: 'ONLINE', purpose: 'QUICK' } };
    await wrap(<MatchSetupScreen {...({ route, navigation: mockNav } as any)} />);
    await fireEvent.press(screen.getByTestId('size-option-5'));
    await fireEvent.press(screen.getByTestId('first-ME'));
    await fireEvent.press(screen.getByTestId('online-setup-continue'));
    expect(mockNav.replace).toHaveBeenCalledWith('matchmaking', { boardSize: 5, firstMove: 'ME', entryAmount: 0 });
  });

  it('quick match: the chosen entry price goes to the search', async () => {
    const route = { key: 'k', name: 'match_setup', params: { mode: 'ONLINE', purpose: 'QUICK' } };
    await wrap(<MatchSetupScreen {...({ route, navigation: mockNav } as any)} />);
    await fireEvent.press(screen.getByTestId('entry-25'));
    await fireEvent.press(screen.getByTestId('online-setup-continue'));
    expect(mockNav.replace).toHaveBeenCalledWith('matchmaking', { boardSize: 3, firstMove: 'RANDOM', entryAmount: 25 });
  });
});

describe('GameResultScreen add friend', () => {
  const { friendApi } = jest.requireMock('../../src/services/api/friendApi') as { friendApi: { request: jest.Mock } };
  const ranked = () =>
    gameFixture({
      status: 'COMPLETED',
      moveCount: 6,
      board: ['X', 'X', 'X', 'O', 'O', '', '', '', ''],
      result: { winner: 'X', winnerId: ME_ID, line: [0, 1, 2], reason: 'LINE' },
      players: [
        { userId: ME_ID, mark: 'X', isAI: false, joined: true, outcome: 'WIN', pointsAwarded: 25 },
        { userId: OPP_ID, mark: 'O', isAI: false, joined: true, outcome: 'LOSS', pointsAwarded: -10 },
      ],
    });

  beforeEach(() => friendApi.request.mockClear());

  it('ranked: sends a friend request to the opponent and shows it as sent', async () => {
    useOnlineStore.getState().applyGame(ranked());
    await wrap(<GameResultScreen {...props({ gameId: 'game-1' })} />);
    await fireEvent.press(await screen.findByTestId('result-add-friend'));
    expect(friendApi.request).toHaveBeenCalledWith({ userId: OPP_ID });
    expect(await screen.findByText('Request sent')).toBeTruthy();
  });

  it('friend-room games do not offer add friend (they are already friends)', async () => {
    useOnlineStore.getState().applyGame({ ...ranked(), type: 'FRIEND' });
    await wrap(<GameResultScreen {...props({ gameId: 'game-1' })} />);
    await screen.findByTestId('result-title');
    expect(screen.queryByTestId('result-add-friend')).toBeNull();
  });
});

describe('MatchFoundScreen', () => {
  const route = (over: object) => ({ key: 'k', name: 'match_found', params: { gameId: 'game-1', source: 'FRIEND', opponentName: 'Ann', ...over } });

  it('friend sender: empty opponent slot and waiting title until the friend accepts', async () => {
    useOnlineStore.getState().applyGame(gameFixture({ status: 'WAITING' }));
    await wrap(<MatchFoundScreen {...({ route: route({}), navigation: mockNav } as any)} />);
    expect(await screen.findByTestId('match-found-empty-slot')).toBeTruthy();
    expect(screen.getByText('Waiting for friend')).toBeTruthy();
    expect(screen.queryByTestId('match-found-countdown')).toBeNull();
  });

  it('once both players are ready, shows the countdown and opens the board', async () => {
    useOnlineStore.getState().applyGame(gameFixture({ status: 'READY' }));
    await wrap(<MatchFoundScreen {...({ route: route({ source: 'RANKED' }), navigation: mockNav } as any)} />);
    expect(await screen.findByText('Match found!')).toBeTruthy();
    expect((await screen.findByTestId('match-found-countdown')).props.children).toBe(3);
    expect(mockNav.replace).not.toHaveBeenCalledWith('online_board', { gameId: 'game-1' });
  });
});

describe('MatchSetupScreen (play with friends)', () => {
  it('shows Create room as the main button and Join room as the second button', async () => {
    const route = { key: 'k', name: 'match_setup', params: { mode: 'ONLINE', purpose: 'FRIEND' } };
    await wrap(<MatchSetupScreen {...({ route, navigation: mockNav } as any)} />);
    expect(screen.getByTestId('create-room-submit')).toBeTruthy();
    expect(screen.getByTestId('open-join-room')).toBeTruthy();
    expect(screen.queryByTestId('pick-friend-u9')).toBeNull();
  });

  it('Join room opens the code popup on the same page and rejects a short code', async () => {
    const route = { key: 'k', name: 'match_setup', params: { mode: 'ONLINE', purpose: 'FRIEND' } };
    await wrap(<MatchSetupScreen {...({ route, navigation: mockNav } as any)} />);
    await fireEvent.press(screen.getByTestId('open-join-room'));
    await fireEvent.changeText(await screen.findByTestId('room-code-input'), 'ABC');
    await fireEvent.press(screen.getByTestId('join-room-submit'));
    expect(await screen.findByText('Enter the 6 character room code.')).toBeTruthy();
    expect(mockNav.replace).not.toHaveBeenCalledWith('waiting_room', expect.anything());
  });
});

describe('ChallengeList', () => {
  it('shows an incoming challenge and lets the friend decline it', async () => {
    const { gameApi } = jest.requireMock('../../src/services/api/gameApi') as { gameApi: { decline: jest.Mock } };
    await wrap(<ChallengeList />);
    expect(await screen.findByText('Ann challenged you')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('challenge-decline-gi1'));
    await waitFor(() => expect(gameApi.decline).toHaveBeenCalledWith('gi1'));
  });

  it('accepts an incoming challenge and opens Match found', async () => {
    const { joinGame } = jest.requireMock('../../src/services/onlineActions') as { joinGame: jest.Mock };
    await wrap(<ChallengeList />);
    await fireEvent.press(await screen.findByTestId('challenge-accept-gi1'));
    await waitFor(() => expect(joinGame).toHaveBeenCalledWith('gi1'));
    expect(mockNav.replace).toHaveBeenCalledWith('match_found', { gameId: 'gi1', source: 'FRIEND', opponentName: 'Ann' });
  });
});

describe('MatchFoundScreen (offline)', () => {
  it('Pass n play: shows the two players, counts down, then starts the local game on the offline board', async () => {
    const { useLocalGameStore } = jest.requireActual('../../src/store/localGameStore') as typeof import('../../src/store/localGameStore');
    useLocalGameStore.getState().configure({ mode: 'LOCAL_2P', size: 3, p1Name: 'Asha', p2Name: 'Ben', p1Mark: 'X' });
    jest.useFakeTimers();
    try {
      const route = { key: 'k', name: 'match_found', params: { source: 'PASS_N_PLAY' } };
      await act(async () => {
        render(
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MatchFoundScreen {...({ route, navigation: mockNav } as any)} />
          </QueryClientProvider>,
        );
      });
      expect(screen.getByText('Asha')).toBeTruthy();
      expect(screen.getByText('Ben')).toBeTruthy();
      expect(screen.getByTestId('match-found-countdown').props.children).toBe(3);
      for (let i = 0; i < 3; i++) await act(async () => jest.advanceTimersByTime(1000));
      expect(mockNav.replace).toHaveBeenCalledWith('offline_board');
      expect(useLocalGameStore.getState().game).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

