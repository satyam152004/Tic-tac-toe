import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, ScaledSize, StyleSheet, Text } from 'react-native';
import { estimateBoardArea, fitBoard, minBoardSide, BoardSize, MIN_CELL, boardMetrics } from '../../src/components/game/boardLayout';
import { GameResultScreen } from '../../src/screens/offline/GameResultScreen';
import { OfflineBoardScreen } from '../../src/screens/offline/OfflineBoardScreen';
import { DEFAULT_SETUP, useLocalGameStore } from '../../src/store/localGameStore';
import { useSettingsStore } from '../../src/store/settingsStore';

jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (t, k) => (k in t ? (t as any)[k] : () => null) }));

const sqlite = jest.requireMock('expo-sqlite') as { __matches: unknown[] };
const st = () => useLocalGameStore.getState();
const Stack = createNativeStackNavigator<any>();
const Stub = (name: string) => () => <Text>{name}</Text>;

const original = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
function setWindow(width: number, height: number, fontScale = 1) {
  const w: ScaledSize = { width, height, scale: 2, fontScale };
  Dimensions.set({ window: w, screen: w });
}

async function mount(initial: 'offline_board' | 'game_result') {
  const screens: Record<string, React.ComponentType<any>> = {
    offline_board: OfflineBoardScreen,
    game_result: GameResultScreen,
    Main: Stub('Main'),
    settings: Stub('settings'),
    rematch: Stub('rematch'),
    player_setup: Stub('player_setup'),
    ai_difficulty: Stub('ai_difficulty'),
  };
  await render(
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, animation: 'none' }}>
        {Object.entries(screens).map(([name, C]) => <Stack.Screen key={name} name={name} component={C} />)}
      </Stack.Navigator>
    </NavigationContainer>,
  );
}

const layoutEvent = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
const boardNode = (size: number) => screen.getByLabelText(`${size} by ${size} game board`);
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, any>;

beforeEach(() => {
  sqlite.__matches.length = 0;
  useLocalGameStore.setState({ setup: DEFAULT_SETUP, game: null, paused: false, pauseReason: null, lastMatchId: null, historyVersion: 0, lastMove: null });
  useSettingsStore.setState({ soundEffects: true } as never);
});
afterEach(() => {
  Dimensions.set(original);
});

const DEVICES = [
  ['iPhone SE 320x568', 320, 568],
  ['small Android 360x592', 360, 592],
  ['Android 360x640', 360, 640],
  ['iPhone 14 390x844', 390, 844],
  ['Pixel 7 412x915', 412, 915],
  ['tablet 768x1024', 768, 1024],
] as const;

describe('board screen at device sizes (mocked window, NOT a device test)', () => {
  it.each(DEVICES.flatMap(([n, w, h]) => ([3, 4, 5] as const).map((size) => [n, w, h, size] as const)))(
    '%s, %ix%i grid: every cell, every control and Pause are present; the first frame is sized from the window',
    async (_n, w, h, size) => {
      setWindow(w, h);
      st().configure({ size: size as BoardSize });
      st().start();
      await mount('offline_board');

      expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(size * size);
      for (const id of ['board-undo', 'board-restart', 'board-mute', 'board-pause']) expect(screen.getByTestId(id)).toBeTruthy();

      const e = estimateBoardArea({ windowWidth: w, windowHeight: h });
      const { side } = fitBoard({ areaWidth: e.width, areaHeight: e.height, size });
      expect(flat(boardNode(size)).width).toBe(side);
      expect(boardMetrics(size, side).cell).toBeGreaterThanOrEqual(MIN_CELL);
    },
  );

  it('uses the MEASURED area once laid out: a short area shrinks the board, a tall one is capped at 340', async () => {
    setWindow(360, 640);
    st().start();
    await mount('offline_board');
    await fireEvent(screen.getByTestId('board-area'), 'layout', layoutEvent(336, 250));
    expect(flat(boardNode(3)).width).toBe(250);
    await fireEvent(screen.getByTestId('board-area'), 'layout', layoutEvent(336, 900));
    expect(flat(boardNode(3)).width).toBe(336);
    await fireEvent(screen.getByTestId('board-area'), 'layout', layoutEvent(700, 900));
    expect(flat(boardNode(3)).width).toBe(340);
  });

  it.each([3, 4, 5] as const)('%ix%i: an area shorter than the minimum keeps 44dp cells and the area itself reserves that height (so the page scrolls)', async (size) => {
    setWindow(320, 568);
    st().configure({ size });
    st().start();
    await mount('offline_board');
    await fireEvent(screen.getByTestId('board-area'), 'layout', layoutEvent(296, 90));
    expect(flat(boardNode(size)).width).toBe(minBoardSide(size));
    expect(flat(screen.getByTestId('board-area')).minHeight).toBe(minBoardSide(size));
  });

  it('is a scroll view with a growing content container, so a long layout scrolls instead of clipping', async () => {
    setWindow(320, 568);
    st().start();
    await mount('offline_board');
    const scroll = screen.getByTestId('offline-board-scroll');
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).flexGrow).toBe(1);
  });

  it('the pause overlay is outside the scrolling content, so it always covers the visible screen', async () => {
    setWindow(320, 568);
    st().start();
    await mount('offline_board');
    await act(async () => st().pause('interrupted'));
    expect(await screen.findByTestId('pause-resume')).toBeTruthy();
    const scroll = screen.getByTestId('offline-board-scroll', { includeHiddenElements: true });
    expect(within(scroll).queryByTestId('game-pause')).toBeNull();
    // and the content underneath is hidden from screen readers while the overlay is up
    expect(screen.queryByTestId('offline-board-scroll')).toBeNull();
  });
});

describe('controls', () => {
  it('equal-width tiles in a row at normal font size', async () => {
    setWindow(360, 640, 1);
    st().start();
    await mount('offline_board');
    expect(flat(screen.getByTestId('board-controls')).flexDirection).toBe('row');
    for (const id of ['board-undo', 'board-restart', 'board-mute']) expect(flat(screen.getByTestId(id)).flex).toBe(1);
  });

  it('labels are never truncated to one line and never shrunk or font-capped', async () => {
    setWindow(320, 568, 1);
    st().start();
    await mount('offline_board');
    for (const label of ['Undo', 'Restart', 'Mute']) {
      const t = screen.getByText(label);
      expect(t.props.numberOfLines).toBeUndefined();
      expect(t.props.adjustsFontSizeToFit).toBeUndefined();
      expect(t.props.maxFontSizeMultiplier).toBeUndefined();
      expect(t.props.allowFontScaling).not.toBe(false);
    }
  });

  it('ACCESSIBILITY: at a 2x system font the tiles stack as full-width rows (labels keep their full size) and stay reachable', async () => {
    setWindow(320, 568, 2);
    st().start();
    await mount('offline_board');
    expect(flat(screen.getByTestId('board-controls')).flexDirection).toBe('column');
    for (const id of ['board-undo', 'board-restart', 'board-mute']) {
      expect(flat(screen.getByTestId(id)).flexDirection).toBe('row');
      expect(flat(screen.getByTestId(id)).alignSelf).toBe('stretch');
    }
    const label = screen.getByText('Restart');
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('1.3x is still the row layout; 1.5x stacks', async () => {
    setWindow(360, 800, 1.3);
    st().start();
    await mount('offline_board');
    expect(flat(screen.getByTestId('board-controls')).flexDirection).toBe('row');
    await act(async () => setWindow(360, 800, 1.5));
    expect(flat(screen.getByTestId('board-controls')).flexDirection).toBe('column');
  });

  it('the tiles still work: undo, restart and mute', async () => {
    setWindow(360, 640);
    st().start();
    await mount('offline_board');
    await fireEvent.press(screen.getByTestId('cell-4'));
    expect(st().game?.moves).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('board-undo'));
    expect(st().game?.moves).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('cell-0'));
    await fireEvent.press(screen.getByTestId('board-restart'));
    expect(st().game?.moves).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('board-mute'));
    expect(useSettingsStore.getState().soundEffects).toBe(false);
    expect(screen.getByText('Unmute')).toBeTruthy();
  });

  it('disabled tiles report it to accessibility', async () => {
    setWindow(360, 640);
    st().start();
    await mount('offline_board');
    expect(screen.getByTestId('board-undo').props.accessibilityState?.disabled ?? screen.getByTestId('board-undo').props['aria-disabled']).toBeTruthy();
  });
});

describe('result screen footer', () => {
  const finish = () => {
    st().start();
    useLocalGameStore.setState({
      game: { ...st().game!, board: ['X', 'X', 'X', 'O', 'O', '', '', '', ''], moves: [], outcome: { status: 'WIN', winner: 'X', line: [0, 1, 2] }, scores: { X: 1, O: 0, draws: 0 }, resumedAt: null },
    });
  };

  it('stacks the actions full width and renames "Change Settings" to "Change Setup" (test IDs unchanged)', async () => {
    setWindow(320, 568);
    finish();
    await mount('game_result');
    expect(screen.getByText('Change Setup')).toBeTruthy();
    expect(screen.queryByText('Change Settings')).toBeNull();
    for (const id of ['result-rematch', 'result-settings', 'result-options', 'result-home']) {
      expect(flat(screen.getByTestId(id)).alignSelf).toBe('stretch');
    }
  });

  it('Change Setup still goes to player setup (2P)', async () => {
    setWindow(320, 568);
    finish();
    await mount('game_result');
    await fireEvent.press(screen.getByTestId('result-settings'));
    expect(await screen.findByText('player_setup')).toBeTruthy();
  });
});
