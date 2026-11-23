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
jest.mock('../../src/services/api/gameApi', () => ({ gameApi: { active: jest.fn(async () => []), get: jest.fn(), forfeit: jest.fn(), replay: jest.fn(async () => ({ totalMoves: 0, frames: [] })) } }));
jest.mock('../../src/services/api/userApi', () => ({ userApi: { me: jest.fn(async () => require('../mocks/onlineFixtures').meFixture()), get: jest.fn() } }));
jest.mock('../../src/services/api/roomApi', () => ({ roomApi: { get: jest.fn(), invite: jest.fn() } }));
jest.mock('../../src/services/api/friendApi', () => ({ friendApi: { list: jest.fn(async () => ({ items: [], total: 0 })) } }));

import { JoinRoomScreen } from '../../src/screens/online/JoinRoomScreen';
import { MatchmakingScreen } from '../../src/screens/online/MatchmakingScreen';
import { OnlineBoardScreen } from '../../src/screens/online/OnlineBoardScreen';
import { OnlineLobbyScreen } from '../../src/screens/online/OnlineLobbyScreen';
import { OnlineResultScreen } from '../../src/screens/online/OnlineResultScreen';
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

describe('OnlineBoardScreen', () => {
  const open = async (game = gameFixture()) => {
    useOnlineStore.getState().applyGame(game);
    return wrap(<OnlineBoardScreen {...props({ gameId: 'game-1' })} />);
  };

  it('renders both players and the board from the server state', async () => {
    await open(gameFixture({ board: ['X', '', '', '', 'O', '', '', '', ''], moveCount: 2, currentTurn: 'X' }));
    expect(await screen.findByText('You (X) • Your Turn')).toBeTruthy();
    expect(screen.getByText('Opponent Pro (O) • Online')).toBeTruthy();
    expect(screen.getByLabelText('Cell 1 marked X')).toBeTruthy();
    expect(screen.getByLabelText('Cell 5 marked O')).toBeTruthy();
  });

  it('disables the board when it is not my turn', async () => {
    await open(gameFixture({ currentTurn: 'O' }));
    await screen.findByText('You (X) • Waiting');
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
    expect(screen.getByText(/Opponent Pro disconnected\. They forfeit in 00:/)).toBeTruthy();
    await act(async () => useOnlineStore.getState().setReconnecting(true));
    expect(await screen.findByTestId('reconnecting-overlay')).toBeTruthy();
  });

  it('forfeit asks for confirmation and then calls forfeitGame', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('forfeit'));
    expect(a.forfeitGame).not.toHaveBeenCalled();
    await screen.findByText('Forfeit Match?');
    const forfeits = screen.getAllByText('Forfeit');
    await fireEvent.press(forfeits[forfeits.length - 1]);
    await waitFor(() => expect(a.forfeitGame).toHaveBeenCalledWith('game-1'));
  });

  it('Offer Draw asks for confirmation, calls gameSocket.offerDraw and is disabled while the offer is sent', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('offer-draw'));
    expect(gs.offerDraw).not.toHaveBeenCalled();
    await screen.findByText('Offer Mutual Draw?');
    await fireEvent.press(screen.getByText('Send Draw Offer'));
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
    expect(await screen.findByText('Draw Offered')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('draw-accept'));
    await waitFor(() => expect(gs.respondDraw).toHaveBeenCalledWith('game-1', true));
    await waitFor(() => expect(screen.queryByText('Draw Offered')).toBeNull());
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

describe('OnlineResultScreen', () => {
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
    return wrap(<OnlineResultScreen {...props({ gameId: 'game-1' })} />);
  };

  it('shows the server outcome, reason and points for a win', async () => {
    await open(finished('WIN', 'FORFEIT'));
    expect(await screen.findByText('Ranked Victory')).toBeTruthy();
    expect(screen.getByText('+25 ELO (1,030)')).toBeTruthy();
    expect(screen.getByText('6 Moves')).toBeTruthy();
  });

  it('shows a loss from the server outcome (not from the board)', async () => {
    await open(finished('LOSS', 'TIMEOUT'));
    expect(await screen.findByText('Ranked Defeat')).toBeTruthy();
    expect(screen.getByText('-10 ELO (1,030)')).toBeTruthy();
  });

  it('shows a draw', async () => {
    await open(finished('DRAW', 'DRAW'));
    expect(await screen.findByText('Ranked Draw')).toBeTruthy();
    expect(screen.getByText('+0 ELO (1,030)')).toBeTruthy();
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
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('online_board', { gameId: 'game-2' }));
  });

  it('loads the game from the server when it is not in the store', async () => {
    useOnlineStore.getState().reset();
    (a.openGame as jest.Mock).mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<OnlineResultScreen {...props({ gameId: 'game-9' })} />);
    expect(await screen.findByText('No Internet Connection')).toBeTruthy();
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
    ['BLOCKED', 'You cannot join this room.'],
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
    await wrap(<MatchmakingScreen {...props({ boardSize: 4 })} />);
    expect(await screen.findByText('Searching Arena...')).toBeTruthy();
    expect(screen.getByTestId('search-spec').props.children).toBe('4×4 Ranked • ~1,030 ELO');
    expect(a.startQuickMatch).toHaveBeenCalledTimes(1);
    expect(a.startQuickMatch).toHaveBeenCalledWith(4);
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
    expect(await screen.findByText('Opponent Found!')).toBeTruthy();
    expect(screen.getByText('vs Opponent Pro')).toBeTruthy();
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('online_board', { gameId: 'game-1' }), { timeout: 4000 });
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
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('online_board', { gameId: 'game-7' }));
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
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('online_board', { gameId: 'game-5' }));
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
    expect(mockNav.navigate).toHaveBeenCalledWith('matchmaking', { boardSize: 3 });
    await fireEvent.press(screen.getByTestId('create-room'));
    expect(mockNav.navigate).toHaveBeenCalledWith('create_room');
    await fireEvent.press(screen.getByTestId('join-room'));
    expect(mockNav.navigate).toHaveBeenCalledWith('join_room');
  });

  it('shows the offline state', async () => {
    useAuthStore.setState({ offline: true });
    await wrap(<OnlineLobbyScreen {...props()} />);
    expect(await screen.findByText('No Internet Connection')).toBeTruthy();
    expect(screen.queryByTestId('quick-match')).toBeNull();
  });
});
