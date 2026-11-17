import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FriendProfileScreen } from '../../src/screens/social/FriendProfileScreen';
import { FriendsScreen } from '../../src/screens/social/FriendsScreen';
import { LeaderboardScreen } from '../../src/screens/social/LeaderboardScreen';
import { ApiError } from '../../src/services/api/errors';
import { friendApi } from '../../src/services/api/friendApi';
import { gameApi } from '../../src/services/api/gameApi';
import { leaderboardApi } from '../../src/services/api/leaderboardApi';
import { userApi } from '../../src/services/api/userApi';
import { useAuthStore } from '../../src/store/authStore';
import { useOnlineStore } from '../../src/store/onlineStore';
import { useToastStore } from '../../src/store/toastStore';

// lucide ships ESM-only (.mjs) which jest-expo does not transform: replace icons with a plain stub.
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? false : () => null) }));
jest.mock('../../src/services/api/friendApi');
jest.mock('../../src/services/api/leaderboardApi');
jest.mock('../../src/services/api/userApi');
jest.mock('../../src/services/api/gameApi');
jest.mock('../../src/services/api/roomApi');

const mockNavigate = jest.fn();
const mockGoTab = jest.fn();
const mockBack = jest.fn();
jest.mock('../../src/navigation/useAppNav', () => ({
  useAppNav: () => ({ nav: { navigate: mockNavigate }, goTab: mockGoTab, back: mockBack }),
}));

const lb = leaderboardApi as jest.Mocked<typeof leaderboardApi>;
const fr = friendApi as jest.Mocked<typeof friendApi>;
const users = userApi as jest.Mocked<typeof userApi>;
const games = gameApi as jest.Mocked<typeof gameApi>;

const card = (id: string, name: string, online = false) => ({ id, username: name.toLowerCase(), displayName: name, avatar: 'av_1', level: 3, online });
const page = <T,>(items: T[]) => ({ items, page: 1, limit: 50, total: items.length, totalPages: 1, meta: {} });
const friendItem = (fid: string, id: string, name: string, online = false) => ({ friendshipId: fid, status: 'ACCEPTED' as const, since: null, requestedAt: '', user: card(id, name, online) });
const row = (rank: number, id: string, name: string, extra = {}) => ({ rank, user: card(id, name), points: 1000 - rank * 10, wins: 10, games: 20, ...extra });

const ME = { id: 'me1', username: 'me', displayName: 'Me' } as never;

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};
const route = (params: object) => ({ params }) as never;

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ status: 'signedIn', user: ME });
  useToastStore.setState({ toast: null });
  fr.list.mockResolvedValue(page([]));
  fr.blocked.mockResolvedValue(page([]));
});

describe('LeaderboardScreen', () => {
  it('calls the endpoint for each scope and metric', async () => {
    lb.get.mockResolvedValue({ rows: [row(1, 'u1', 'Ann')], me: null, total: 1 });
    await wrap(<LeaderboardScreen />);
    await screen.findByText('Ann');
    expect(lb.get).toHaveBeenCalledWith('global', 'points');
    await fireEvent.press(screen.getByTestId('lb-scope-weekly'));
    await waitFor(() => expect(lb.get).toHaveBeenCalledWith('weekly', 'points'));
    await fireEvent.press(screen.getByTestId('lb-scope-friends'));
    await waitFor(() => expect(lb.get).toHaveBeenCalledWith('friends', 'points'));
    await fireEvent.press(screen.getByTestId('lb-metric-wins'));
    await waitFor(() => expect(lb.get).toHaveBeenCalledWith('friends', 'wins'));
  });

  it('highlights own row and routes taps', async () => {
    lb.get.mockResolvedValue({ rows: [row(1, 'u1', 'Ann'), row(2, 'me1', 'Me')], me: { rank: 2, points: 980, wins: 10 }, total: 2 });
    await wrap(<LeaderboardScreen />);
    await screen.findByText('Me (You)');
    expect(screen.getByTestId('lb-me-card')).toBeTruthy();
    expect(screen.getAllByText('#2').length).toBeGreaterThan(1);
    await fireEvent.press(screen.getByLabelText(/Rank 2, Me/));
    expect(mockGoTab).toHaveBeenCalledWith('ProfileTab');
    await fireEvent.press(screen.getByLabelText(/Rank 1, Ann/));
    expect(mockNavigate).toHaveBeenCalledWith('friend_profile', { userId: 'u1' });
  });

  it('shows a helpful message when rank is null', async () => {
    lb.get.mockResolvedValue({ rows: [], me: { rank: null, points: 0, wins: 0 }, total: 0 });
    await wrap(<LeaderboardScreen />);
    await screen.findByTestId('lb-me-unranked');
    expect(screen.getByText('No ranked games yet')).toBeTruthy();
  });

  it('shows the per-scope empty state', async () => {
    lb.get.mockResolvedValue({ rows: [], me: null, total: 0 });
    await wrap(<LeaderboardScreen />);
    await fireEvent.press(screen.getByTestId('lb-scope-daily'));
    await screen.findByText('No ranked games today yet');
  });

  it('shows error and offline states with retry', async () => {
    lb.get.mockRejectedValueOnce(new ApiError('INTERNAL', 'Boom'));
    await wrap(<LeaderboardScreen />);
    await screen.findByText('Boom');
    lb.get.mockResolvedValue({ rows: [row(1, 'u1', 'Ann')], me: null, total: 1 });
    await fireEvent.press(screen.getByText('Try Again'));
    await screen.findByText('Ann');
  });

  it('shows the offline state', async () => {
    lb.get.mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<LeaderboardScreen />);
    await screen.findByText('No Internet Connection');
  });
});

describe('FriendsScreen', () => {
  const setLists = (acc: unknown[], inc: unknown[] = [], out: unknown[] = []) =>
    fr.list.mockImplementation((async (s: string) => page(s === 'accepted' ? acc : s === 'incoming' ? inc : out)) as never);

  it('lists friends with presence and switches to requests with counts', async () => {
    setLists([friendItem('f1', 'u1', 'Ann', true)], [friendItem('f2', 'u2', 'Bob')], [friendItem('f3', 'u3', 'Cy')]);
    await wrap(<FriendsScreen />);
    await screen.findByText('Ann');
    expect(screen.getByText('Online · Level 3')).toBeTruthy();
    expect(screen.getByText('Requests (2)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('friends-segment-requests'));
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Cy')).toBeTruthy();
  });

  it('shows empty states', async () => {
    setLists([]);
    await wrap(<FriendsScreen />);
    await screen.findByText('No friends yet');
    await fireEvent.press(screen.getByTestId('friends-segment-requests'));
    expect(screen.getByText('No pending requests')).toBeTruthy();
  });

  it('shows the offline state', async () => {
    fr.list.mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<FriendsScreen />);
    await screen.findByText('No Internet Connection');
  });

  it('accepts and rejects incoming requests with the friendshipId', async () => {
    setLists([], [friendItem('f2', 'u2', 'Bob'), friendItem('f4', 'u4', 'Dee')]);
    fr.accept.mockResolvedValue({ id: 'f2', status: 'ACCEPTED', friendId: 'u2' });
    fr.reject.mockResolvedValue({ rejected: true });
    await wrap(<FriendsScreen />);
    await screen.findByText('Requests (2)');
    await fireEvent.press(screen.getByTestId('friends-segment-requests'));
    await fireEvent.press(screen.getByTestId('accept-u2'));
    await waitFor(() => expect(fr.accept).toHaveBeenCalledWith('f2'));
    await fireEvent.press(screen.getByTestId('reject-u4'));
    await waitFor(() => expect(fr.reject).toHaveBeenCalledWith('f4'));
  });

  it('adds a friend by username on success', async () => {
    setLists([]);
    fr.request.mockResolvedValue({ id: 'x', status: 'PENDING' });
    users.search.mockResolvedValue(page([]) as never);
    await wrap(<FriendsScreen />);
    await screen.findByText('No friends yet');
    await fireEvent.press(screen.getByTestId('friends-add'));
    await fireEvent.changeText(screen.getByTestId('add-friend-input'), 'devon');
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    await waitFor(() => expect(fr.request).toHaveBeenCalledWith({ username: 'devon' }));
  });

  it.each([
    ['USER_NOT_FOUND', 'No player found with that username.'],
    ['ALREADY_FRIENDS', 'You are already friends with this player.'],
    ['REQUEST_ALREADY_SENT', 'A friend request is already pending.'],
    ['BLOCKED', "You can't interact with this player."],
    ['SELF_REQUEST', "You can't add yourself."],
  ])('maps add-friend error %s', async (code, msg) => {
    setLists([]);
    fr.request.mockRejectedValue(new ApiError(code, 'raw'));
    users.search.mockResolvedValue(page([]) as never);
    await wrap(<FriendsScreen />);
    await screen.findByText('No friends yet');
    await fireEvent.press(screen.getByTestId('friends-add'));
    await fireEvent.changeText(screen.getByTestId('add-friend-input'), 'someone');
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    await screen.findByText(msg);
  });

  it('searches players (debounced) and adds from results', async () => {
    setLists([]);
    users.search.mockResolvedValue(page([card('u9', 'Zed')]) as never);
    fr.request.mockResolvedValue({ id: 'x', status: 'PENDING' });
    await wrap(<FriendsScreen />);
    await screen.findByText('No friends yet');
    await fireEvent.press(screen.getByTestId('friends-add'));
    await fireEvent.changeText(screen.getByTestId('add-friend-input'), 'ze');
    await screen.findByText('Zed', undefined, { timeout: 2000 });
    expect(users.search).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('add-result-u9'));
    await waitFor(() => expect(fr.request).toHaveBeenCalledWith({ userId: 'u9' }));
  });

  it('confirms before removing a friend', async () => {
    setLists([friendItem('f1', 'u1', 'Ann')]);
    fr.remove.mockResolvedValue({ removed: true });
    await wrap(<FriendsScreen />);
    await screen.findByText('Ann');
    await fireEvent.press(screen.getByTestId('remove-u1'));
    expect(fr.remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Remove'));
    await waitFor(() => expect(fr.remove).toHaveBeenCalledWith('f1'));
  });

  it('cancels an outgoing request', async () => {
    setLists([], [], [friendItem('f3', 'u3', 'Cy')]);
    fr.remove.mockResolvedValue({ removed: true });
    await wrap(<FriendsScreen />);
    await screen.findByText('Requests (1)');
    await fireEvent.press(screen.getByTestId('friends-segment-requests'));
    await fireEvent.press(screen.getByTestId('cancel-u3'));
    await waitFor(() => expect(fr.remove).toHaveBeenCalledWith('f3'));
  });

  it('lists blocked users and unblocks', async () => {
    setLists([]);
    fr.blocked.mockResolvedValue(page([card('u8', 'Bad')]) as never);
    fr.unblock.mockResolvedValue({ blocked: false });
    await wrap(<FriendsScreen />);
    await screen.findByText('No friends yet');
    await fireEvent.press(screen.getByTestId('friends-blocked'));
    await fireEvent.press(await screen.findByTestId('unblock-u8'));
    await waitFor(() => expect(fr.unblock).toHaveBeenCalledWith('u8'));
  });

  it('challenge creates a friend game and navigates to the board', async () => {
    setLists([friendItem('f1', 'u1', 'Ann', true)]);
    const game = { id: 'g1', type: 'FRIEND', status: 'WAITING', boardSize: 4, winLength: 4, board: Array(16).fill(''), currentTurn: 'X', moveCount: 0, players: [] } as never;
    games.inviteFriend.mockResolvedValue(game);
    const spy = jest.spyOn(useOnlineStore.getState(), 'applyGame');
    await wrap(<FriendsScreen />);
    await screen.findByText('Ann');
    await fireEvent.press(screen.getByTestId('challenge-u1'));
    await fireEvent.press(screen.getByTestId('challenge-size-4'));
    await fireEvent.press(screen.getByTestId('challenge-send'));
    await waitFor(() => expect(games.inviteFriend).toHaveBeenCalledWith({ opponentId: 'u1', boardSize: 4 }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('online_board', { gameId: 'g1' }));
    spy.mockRestore();
  });
});

describe('FriendProfileScreen', () => {
  const profile = {
    id: 'u1', username: 'ann', displayName: 'Ann', avatar: 'av_1', bio: 'Hello there', accountType: 'REGISTERED', online: true, lastActiveAt: '', createdAt: '',
    stats: { totalGames: 10, wins: 6, losses: 3, draws: 1, winPercentage: 60, points: 1200, level: 5, currentStreak: 2, bestStreak: 4 },
  };
  const setLists = (acc: unknown[] = [], inc: unknown[] = [], out: unknown[] = []) =>
    fr.list.mockImplementation((async (s: string) => page(s === 'accepted' ? acc : s === 'incoming' ? inc : out)) as never);
  const open = () => wrap(<FriendProfileScreen route={route({ userId: 'u1' })} navigation={undefined as never} />);

  beforeEach(() => users.get.mockResolvedValue(profile as never));

  it('shows profile details', async () => {
    setLists();
    await open();
    await screen.findByText('Hello there');
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('Level 5 · 1200 Rating')).toBeTruthy();
  });

  it('friend: shows challenge + remove (with confirm)', async () => {
    setLists([friendItem('f1', 'u1', 'Ann')]);
    fr.remove.mockResolvedValue({ removed: true });
    await open();
    await screen.findByTestId('profile-challenge');
    await fireEvent.press(screen.getByTestId('profile-remove'));
    expect(fr.remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Remove'));
    await waitFor(() => expect(fr.remove).toHaveBeenCalledWith('f1'));
  });

  it('stranger: add friend', async () => {
    setLists();
    fr.request.mockResolvedValue({ id: 'x', status: 'PENDING' });
    await open();
    await fireEvent.press(await screen.findByTestId('profile-add'));
    await waitFor(() => expect(fr.request).toHaveBeenCalledWith({ userId: 'u1' }));
    expect(screen.queryByTestId('profile-challenge')).toBeNull();
  });

  it('incoming request: accept / decline', async () => {
    setLists([], [friendItem('f2', 'u1', 'Ann')]);
    fr.accept.mockResolvedValue({ id: 'f2', status: 'ACCEPTED', friendId: 'u1' });
    await open();
    await fireEvent.press(await screen.findByTestId('profile-accept'));
    await waitFor(() => expect(fr.accept).toHaveBeenCalledWith('f2'));
    expect(screen.getByTestId('profile-reject')).toBeTruthy();
  });

  it('outgoing request: cancel', async () => {
    setLists([], [], [friendItem('f3', 'u1', 'Ann')]);
    fr.remove.mockResolvedValue({ removed: true });
    await open();
    await fireEvent.press(await screen.findByTestId('profile-cancel'));
    await waitFor(() => expect(fr.remove).toHaveBeenCalledWith('f3'));
  });

  it('block asks for confirmation, then blocks by userId', async () => {
    setLists();
    fr.block.mockResolvedValue({ blocked: true });
    await open();
    await fireEvent.press(await screen.findByTestId('profile-block'));
    expect(fr.block).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByText('Block').slice(-1)[0]!);
    await waitFor(() => expect(fr.block).toHaveBeenCalledWith('u1'));
  });

  it('blocked player: unblock with confirm', async () => {
    setLists();
    fr.blocked.mockResolvedValue(page([card('u1', 'Ann')]) as never);
    fr.unblock.mockResolvedValue({ blocked: false });
    await open();
    await fireEvent.press(await screen.findByTestId('profile-unblock'));
    await fireEvent.press(screen.getAllByText('Unblock').slice(-1)[0]!);
    await waitFor(() => expect(fr.unblock).toHaveBeenCalledWith('u1'));
  });

  it('report opens reason sheet and submits', async () => {
    setLists();
    users.report.mockResolvedValue({} as never);
    await open();
    await fireEvent.press(await screen.findByTestId('profile-report'));
    await fireEvent.press(screen.getByTestId('report-SPAM'));
    await waitFor(() => expect(users.report).toHaveBeenCalledWith('u1', 'SPAM'));
  });

  it('404 shows Player not found', async () => {
    setLists();
    users.get.mockRejectedValue(new ApiError('USER_NOT_FOUND', 'nope', 404));
    await open();
    await screen.findByText('Player not found');
  });
});
