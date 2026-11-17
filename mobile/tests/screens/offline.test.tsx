import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AiDifficultyScreen } from '../../src/screens/offline/AiDifficultyScreen';
import { BoardSelectionScreen } from '../../src/screens/offline/BoardSelectionScreen';
import { GameResultScreen } from '../../src/screens/offline/GameResultScreen';
import { OfflineBoardScreen } from '../../src/screens/offline/OfflineBoardScreen';
import { OfflineHistoryScreen } from '../../src/screens/offline/OfflineHistoryScreen';
import { GamePauseScreen } from '../../src/screens/offline/GamePauseScreen';
import { localGameStorage } from '../../src/services/storage/localGameStorage';
import { DEFAULT_SETUP, useLocalGameStore } from '../../src/store/localGameStore';

jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (t, k) => (k in t ? (t as any)[k] : () => null) }));

const sqlite = jest.requireMock('expo-sqlite') as { __matches: unknown[] };
const st = () => useLocalGameStore.getState();
const Stack = createNativeStackNavigator<any>();
const Stub = (name: string) => () => <Text testID={`stub-${name}`}>{name}</Text>;

async function mount(initial: string, params?: object) {
  const screens: Record<string, React.ComponentType<any>> = {
    offline_board: OfflineBoardScreen,
    board_selection: BoardSelectionScreen,
    ai_difficulty: AiDifficultyScreen,
    game_result: GameResultScreen,
    game_pause: GamePauseScreen,
    offline_history: OfflineHistoryScreen,
    Main: Stub('Main'),
    player_setup: Stub('player_setup'),
    settings: Stub('settings'),
    rematch: Stub('rematch'),
  };
  await render(
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, animation: 'none' }}>
        {Object.entries(screens).map(([name, C]) => (
          <Stack.Screen key={name} name={name} component={C} initialParams={name === initial ? params : undefined} />
        ))}
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

beforeEach(() => {
  sqlite.__matches.length = 0;
  useLocalGameStore.setState({ setup: DEFAULT_SETUP, game: null, paused: false, lastMatchId: null, historyVersion: 0, lastMove: null });
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
    expect(screen.getByText('Player 1 Wins!')).toBeTruthy();
  });

  it('pause blocks moves and navigates to the pause screen', async () => {
    st().start();
    await mount('offline_board');
    await fireEvent.press(await screen.findByTestId('board-pause'));
    expect(st().paused).toBe(true);
    expect(await screen.findByTestId('pause-resume')).toBeTruthy();
    expect(st().play(0)).toBe(false);
    await fireEvent.press(screen.getByTestId('pause-resume'));
    expect(st().paused).toBe(false);
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

describe('AiDifficultyScreen', () => {
  it('lists exactly the five levels and saves the selection', async () => {
    await mount('ai_difficulty');
    const cards = await screen.findAllByTestId(/^difficulty-/);
    expect(cards.map((c) => c.props.testID)).toEqual(['difficulty-EASY', 'difficulty-MEDIUM', 'difficulty-HARD', 'difficulty-EXPERT', 'difficulty-IMPOSSIBLE']);
    await fireEvent.press(screen.getByTestId('difficulty-HARD'));
    await fireEvent.press(screen.getByTestId('side-O'));
    await fireEvent.press(screen.getByTestId('ai-difficulty-continue'));
    expect(st().setup).toMatchObject({ mode: 'VS_AI', difficulty: 'HARD', p1Mark: 'O' });
    expect(await screen.findByTestId('board-selection')).toBeTruthy();
  });
});

describe('BoardSelectionScreen', () => {
  it('2P: saves the size and goes to player setup', async () => {
    await mount('board_selection', { mode: 'LOCAL_2P' });
    await fireEvent.press(await screen.findByTestId('board-option-4'));
    await fireEvent.press(screen.getByTestId('board-selection-continue'));
    expect(st().setup.size).toBe(4);
    expect(await screen.findByTestId('stub-player_setup')).toBeTruthy();
  });

  it('VS_AI: starts the game on the chosen size', async () => {
    st().configure({ mode: 'VS_AI', difficulty: 'EASY' });
    await mount('board_selection', { mode: 'VS_AI' });
    await fireEvent.press(await screen.findByTestId('board-option-5'));
    await fireEvent.press(screen.getByTestId('board-selection-continue'));
    expect(st().game?.config.size).toBe(5);
    expect(await screen.findByTestId('offline-board')).toBeTruthy();
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
    expect(await screen.findByText('You Win!')).toBeTruthy();
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
    expect(await screen.findByText('No Matches Played Yet')).toBeTruthy();
    expect(screen.getByText('Play now')).toBeTruthy();
  });

  it('lists, deletes and clears matches', async () => {
    await localGameStorage.saveMatch(record('X'), 'You', 'Vortex AI');
    await localGameStorage.saveMatch(record('O'), 'You', 'Vortex AI');
    await mount('offline_history');
    expect(await screen.findByText('Victory')).toBeTruthy();
    expect(screen.getByText('Defeat')).toBeTruthy();
    expect(screen.getAllByText('On this device')).toHaveLength(2);

    const [first] = await localGameStorage.listMatches();
    await fireEvent.press(screen.getByTestId(`history-delete-${first!.id}`));
    await fireEvent.press(await screen.findByText('Delete'));
    await waitFor(() => expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('history-clear'));
    await fireEvent.press(await screen.findByText('Clear all'));
    expect(await screen.findByText('No Matches Played Yet')).toBeTruthy();
    await act(async () => undefined);
  });
});
