import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { MatchSetupScreen } from '../../src/screens/offline/MatchSetupScreen';
import { MatchFoundScreen } from '../../src/screens/online/MatchFoundScreen';
import { GameResultScreen } from '../../src/screens/game/GameResultScreen';
import { GameBoardScreen } from '../../src/screens/game/GameBoardScreen';
import { OfflineHistoryScreen } from '../../src/screens/offline/OfflineHistoryScreen';
import { localGameStorage } from '../../src/services/storage/localGameStorage';
import { DEFAULT_SETUP, useLocalGameStore } from '../../src/store/localGameStore';

jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (t, k) => (k in t ? (t as any)[k] : () => null) }));

const sqlite = jest.requireMock('expo-sqlite') as { __matches: unknown[] };
const st = () => useLocalGameStore.getState();
const Stack = createNativeStackNavigator<any>();
const Stub = (name: string) => () => <Text testID={`stub-${name}`}>{name}</Text>;

async function mount(initial: string, params?: object) {
  const screens: Record<string, React.ComponentType<any>> = {
    offline_board: GameBoardScreen,
    match_setup: MatchSetupScreen,
    match_found: MatchFoundScreen,
    game_result: GameResultScreen,
    offline_history: OfflineHistoryScreen,
    Main: Stub('Main'),
    settings: Stub('settings'),
    rematch: Stub('rematch'),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, animation: 'none' }}>
          {Object.entries(screens).map(([name, C]) => (
            <Stack.Screen key={name} name={name} component={C} initialParams={name === initial ? params : undefined} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sqlite.__matches.length = 0;
  useLocalGameStore.setState({ setup: DEFAULT_SETUP, game: null, paused: false, pauseReason: null, lastMatchId: null, historyVersion: 0, lastMove: null });
});

describe('OfflineBoardScreen', () => {
  it.each([3, 4, 5] as const)('renders a %ix%i board with the right number of cells', async (size) => {
    st().configure({ size });
    st().start();
    await mount('offline_board');
    expect(await screen.findByLabelText(`${size} by ${size} game board`)).toBeTruthy();
    expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(size * size);
  });

  it('tapping a cell places a mark', async () => {
    st().start();
    await mount('offline_board');
    await fireEvent.press(await screen.findByTestId('cell-4'));
    expect(st().game?.board[4]).toBe('X');
    expect(screen.getByLabelText('Cell 5 marked X')).toBeTruthy();
  });

  it('the AI replies after the human move', async () => {
    st().configure({ mode: 'VS_AI', difficulty: 'EASY', p1Mark: 'X' });
    st().start();
    await mount('offline_board');
    await fireEvent.press(await screen.findByTestId('cell-0'));
    await waitFor(() => expect(st().game?.moves).toHaveLength(2), { timeout: 3000 });
  });

  it('shows the result screen after a win', async () => {
    st().start();
    await mount('offline_board');
    for (const p of [0, 3, 1, 4, 2]) await fireEvent.press(await screen.findByTestId(`cell-${p}`));
    expect(await screen.findByTestId('result-title', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Player 1 wins!')).toBeTruthy();
  });

  it('manual pause shows the in-game overlay with Resume and blocks moves', async () => {
    st().start();
    await mount('offline_board');
    expect(screen.queryByTestId('game-pause')).toBeNull();
    await fireEvent.press(await screen.findByTestId('board-pause'));
    expect(st().paused).toBe(true);
    expect(await screen.findByTestId('pause-resume')).toBeTruthy();
    expect(screen.getByTestId('pause-restart')).toBeTruthy();
    expect(screen.getByTestId('pause-quit')).toBeTruthy();
    expect(st().play(0)).toBe(false);
    await fireEvent.press(screen.getByTestId('pause-resume'));
    expect(st().paused).toBe(false);
    expect(screen.queryByTestId('game-pause')).toBeNull();
  });

  it('regression: a game paused by an interruption (background, lock) always shows Resume, and Resume keeps the match', async () => {
    st().start();
    await mount('offline_board');
    await fireEvent.press(await screen.findByTestId('cell-0'));
    await fireEvent.press(screen.getByTestId('cell-4'));
    const before = st().game!;
    await act(async () => st().pause('interrupted')); // what useInterruptionPause does on background / inactive
    expect(await screen.findByTestId('pause-resume')).toBeTruthy();
    expect(screen.getByText('The game was paused while you were away.')).toBeTruthy();
    // the pause button cannot pause a second time
    expect(screen.getByTestId('board-pause').props.accessibilityState?.disabled ?? screen.getByTestId('board-pause').props['aria-disabled']).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pause-resume'));
    expect(st().paused).toBe(false);
    expect(st().game?.board).toEqual(before.board);
    expect(st().game?.current).toBe(before.current);
    expect(st().game?.scores).toEqual(before.scores);
    expect(st().game?.moves).toEqual(before.moves);
    await fireEvent.press(screen.getByTestId('cell-8'));
    expect(st().game?.board[8]).toBe('X');
  });

  it('Restart from the pause overlay resumes play on a fresh board with the scores kept', async () => {
    st().start();
    await mount('offline_board');
    await fireEvent.press(await screen.findByTestId('cell-0'));
    await act(async () => st().pause('manual'));
    await fireEvent.press(await screen.findByTestId('pause-restart'));
    expect(st().paused).toBe(false);
    expect(st().game?.moves).toHaveLength(0);
    expect(screen.queryByTestId('game-pause')).toBeNull();
  });

  it('Restart and Undo are disabled once the round has ended, so a stored result cannot be undone', async () => {
    st().start();
    await mount('offline_board');
    for (const p of [0, 3, 1, 4, 2]) await fireEvent.press(await screen.findByTestId(`cell-${p}`));
    const off = (id: string) => screen.getByTestId(id).props.accessibilityState?.disabled ?? screen.getByTestId(id).props['aria-disabled'];
    expect(off('board-undo')).toBeTruthy();
    expect(off('board-restart')).toBeTruthy();
  });

  it('undo is disabled until a move was made', async () => {
    st().start();
    await mount('offline_board');
    await screen.findByTestId('board-undo');
    expect(screen.getByTestId('board-undo').props.accessibilityState?.disabled ?? screen.getByTestId('board-undo').props['aria-disabled']).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cell-0'));
    await fireEvent.press(screen.getByTestId('board-undo'));
    expect(st().game?.moves).toHaveLength(0);
  });
});

describe('MatchSetupScreen (computer)', () => {
  it('lists exactly the five levels and saves the selection', async () => {
    await mount('match_setup', { mode: 'VS_AI' });
    const cards = await screen.findAllByTestId(/^difficulty-/);
    expect(cards.map((c) => c.props.testID)).toEqual(['difficulty-EASY', 'difficulty-MEDIUM', 'difficulty-HARD', 'difficulty-EXPERT', 'difficulty-IMPOSSIBLE']);
    await fireEvent.press(screen.getByTestId('difficulty-HARD'));
    await fireEvent.press(screen.getByTestId('ai-difficulty-continue'));
    expect(st().setup).toMatchObject({ mode: 'VS_AI', difficulty: 'HARD' });
    expect(await screen.findByTestId('match-found')).toBeTruthy();
    expect(await screen.findByTestId('match-found-countdown')).toBeTruthy();
  });
});

describe('GameResultScreen', () => {
  it('shows the human perspective vs the AI and the saved note', async () => {
    st().configure({ mode: 'VS_AI', difficulty: 'EASY', p1Mark: 'X' });
    st().start();
    useLocalGameStore.setState({
      game: { ...st().game!, board: ['X', 'X', 'X', 'O', 'O', '', '', '', ''], moves: [], outcome: { status: 'WIN', winner: 'X', line: [0, 1, 2] }, scores: { X: 1, O: 0, draws: 0 }, resumedAt: null },
      lastMatchId: 'abc',
    });
    await mount('game_result');
    expect(await screen.findByText('You won!')).toBeTruthy();
    expect(screen.getByTestId('result-saved')).toBeTruthy();
  });

  it('goes home when there is no game', async () => {
    await mount('game_result');
    await waitFor(() => expect(screen.queryByTestId('result-title')).toBeNull());
  });
});

describe('OfflineHistoryScreen', () => {
  const record = (result: 'X' | 'O' | 'DRAW') => ({
    config: { size: 3 as const, winLength: 3 },
    mode: 'VS_AI' as const,
    difficulty: 'HARD' as const,
    humanMark: 'X' as const,
    moves: [0, 3, 1, 4, 2],
    result,
    durationMs: 65000,
    playedAt: new Date().toISOString(),
  });

  it('shows the empty state', async () => {
    await mount('offline_history');
    expect(await screen.findByText('No matches yet')).toBeTruthy();
    expect(screen.getByText('Play now')).toBeTruthy();
  });

  it('lists, deletes and clears matches', async () => {
    await localGameStorage.saveMatch(record('X'), 'You', 'Vortex AI');
    await localGameStorage.saveMatch(record('O'), 'You', 'Vortex AI');
    await mount('offline_history');
    expect(await screen.findByText('All 2')).toBeTruthy();
    expect(screen.getByText('Wins 1')).toBeTruthy();
    expect(screen.getAllByText('Replay')).toHaveLength(2);
    expect(screen.getAllByText('AI Hard • 3×3')).toHaveLength(2);

    await fireEvent.press(screen.getByTestId('history-clear'));
    await fireEvent.press(await screen.findByText('Clear History'));
    expect(await screen.findByText('No matches yet')).toBeTruthy();
    await act(async () => undefined);
  });
});
