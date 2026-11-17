import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Layers,
  MonitorSmartphone,
  Palette,
  Play,
  Smartphone,
} from 'lucide-react';
import {
  PlatformNavIndicator,
  PlatformStatusBar,
  SymbolMark,
  ToastNotification,
} from './components/ds/DesignSystemComponents';
import {
  AllScreensGallery,
  DesignSystemExplorer,
} from './components/studio/DesignSystemExplorer';
import {
  GLOBAL_LEADERBOARD,
  INITIAL_ACHIEVEMENTS,
  INITIAL_FRIENDS,
  INITIAL_HISTORY,
  INITIAL_REWARDS,
  INITIAL_USER,
  SCREEN_CATALOG,
  THEME_LIST,
  USER_FLOWS,
} from './data/mockData';
import { MobileScreenRouter } from './screens/MobileScreenRouter';
import {
  ActiveGameSession,
  BoardSize,
  Difficulty,
  Friend,
  MatchRecord,
  Platform,
  PlayerProfile,
  RoomInfo,
  ScreenCategory,
  ScreenId,
  ThemeId,
  ToastData,
  UIStateOverride,
} from './types/app';
import { checkWinner, getAIMove, getWinLength } from './utils/gameLogic';
import { playGameSound } from './utils/soundFx';

type StudioTab = 'simulator' | 'screens' | 'design_system';

const CATEGORIES: ScreenCategory[] = [
  'Onboarding & Core',
  'Offline Game',
  'Online Multiplayer',
  'Auth & Profile',
  'Social & Progression',
  'Settings & Themes',
];

export default function App() {
  // Studio Workspace State
  const [studioTab, setStudioTab] = useState<StudioTab>('simulator');
  const [sidebarMode, setSidebarMode] = useState<'screens' | 'flows'>('screens');
  const [platform, setPlatform] = useState<Platform>('ios');
  const [activeTheme, setActiveTheme] = useState<ThemeId>('dark');
  const [uiState, setUiState] = useState<UIStateOverride>('default');

  // Mobile App Navigation Stack (Starts on Home or Splash—let's start on Home for immediate playability, with Splash 1 click away, OR Splash -> Onboarding -> Home. Starting on 'home' makes first impression immediately rich, while Splash is screen 01 in sidebar!)
  const [navStack, setNavStack] = useState<ScreenId[]>(['home']);
  const currentScreen = navStack[navStack.length - 1];

  // Player & Social State
  const [user, setUser] = useState<PlayerProfile>(INITIAL_USER);
  const [history, setHistory] = useState<MatchRecord[]>(INITIAL_HISTORY);
  const [friends, setFriends] = useState<Friend[]>(INITIAL_FRIENDS);
  const [selectedFriend, setSelectedFriend] = useState<Friend>(INITIAL_FRIENDS[0]);
  const [achievements] = useState(INITIAL_ACHIEVEMENTS);
  const [rewards, setRewards] = useState(INITIAL_REWARDS);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Settings State
  const [settings, setSettings] = useState({
    soundEffects: true,
    music: false,
    vibration: true,
    notifications: true,
    language: 'English (US)',
  });

  // Setup & Match Config
  const [setupConfig, setSetupConfig] = useState<{
    p1Name: string;
    p1Avatar: string;
    p1Symbol: 'X' | 'O';
    p2Name: string;
    p2Avatar: string;
    boardSize: BoardSize;
  }>({
    p1Name: INITIAL_USER.username,
    p1Avatar: INITIAL_USER.avatarId,
    p1Symbol: 'X',
    p2Name: 'LiamChen',
    p2Avatar: 'av_3',
    boardSize: 3,
  });

  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [selectedBoardSize, setSelectedBoardSize] = useState<BoardSize>(3);

  const [room, setRoom] = useState<RoomInfo>({
    code: 'VTX409',
    hostName: INITIAL_USER.username,
    hostAvatarId: INITIAL_USER.avatarId,
    boardSize: 3,
    winLength: 3,
    guestName: null,
    guestAvatarId: null,
    guestReady: false,
  });

  // Active Game Session
  const [session, setSession] = useState<ActiveGameSession>({
    mode: 'ai',
    boardSize: 3,
    difficulty: 'medium',
    player1Name: INITIAL_USER.username,
    player1Avatar: INITIAL_USER.avatarId,
    player1Symbol: 'X',
    player2Name: 'Vortex AI',
    player2Avatar: 'av_ai',
    player2Symbol: 'O',
    board: Array(9).fill(null),
    moveHistory: [],
    currentTurn: 'X',
    winner: null,
    winningLine: null,
    scores: { p1: 1, p2: 0, draws: 0 },
    elapsedSeconds: 0,
    isMuted: false,
  });

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastData['type'] = 'info') => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToast({ id: String(Date.now()), type, title, message });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 3200);
    },
    []
  );

  const navigate = useCallback(
    (screen: ScreenId) => {
      playGameSound('tap', settings.soundEffects);
      setUiState('default');
      setNavStack((prev) => (prev[prev.length - 1] === screen ? prev : [...prev, screen]));
    },
    [settings.soundEffects]
  );

  const goBack = useCallback(() => {
    playGameSound('tap', settings.soundEffects);
    setUiState('default');
    setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : ['home']));
  }, [settings.soundEffects]);

  // Match Timer
  useEffect(() => {
    const isPlayingBoard =
      (currentScreen === 'offline_board' || currentScreen === 'online_board') &&
      !session.winner &&
      uiState === 'default';
    if (!isPlayingBoard) return;

    const timer = window.setInterval(() => {
      setSession((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentScreen, session.winner, uiState]);

  // Record finished match & transition to result screen smoothly
  const finalizeRound = useCallback(
    (
      winner: 'X' | 'O' | 'draw',
      finishedSession: ActiveGameSession
    ) => {
      const p1Won = winner === finishedSession.player1Symbol;
      const isDraw = winner === 'draw';

      playGameSound(isDraw ? 'draw' : 'win', settings.soundEffects);

      const newRecord: MatchRecord = {
        id: `m_${Date.now()}`,
        opponentName: finishedSession.player2Name,
        opponentAvatarId: finishedSession.player2Avatar,
        mode:
          finishedSession.mode === 'ai'
            ? finishedSession.difficulty === 'easy'
              ? 'AI Easy'
              : finishedSession.difficulty === 'medium'
              ? 'AI Medium'
              : 'AI Hard'
            : finishedSession.mode === 'local'
            ? 'Local 2P'
            : finishedSession.mode === 'online_private'
            ? 'Private Room'
            : 'Online Ranked',
        boardSize: finishedSession.boardSize,
        result: isDraw ? 'draw' : p1Won ? 'win' : 'loss',
        scoreSummary: isDraw ? 'Draw' : `${finishedSession.moveHistory.length} moves`,
        date: 'Just now',
        duration: `00:${String(finishedSession.elapsedSeconds).padStart(2, '0')}`,
        movesCount: finishedSession.moveHistory.length,
      };

      setHistory((prev) => [newRecord, ...prev]);

      setUser((prev) => ({
        ...prev,
        wins: prev.wins + (p1Won ? 1 : 0),
        losses: prev.losses + (!p1Won && !isDraw ? 1 : 0),
        draws: prev.draws + (isDraw ? 1 : 0),
        coins: prev.coins + (p1Won ? 50 : isDraw ? 20 : 10),
        xp: Math.min(prev.xpMax, prev.xp + (p1Won ? 120 : 45)),
      }));

      window.setTimeout(() => {
        setNavStack((prev) => [
          ...prev,
          finishedSession.mode.startsWith('online') ? 'online_result' : 'game_result',
        ]);
      }, 650);
    },
    [settings.soundEffects]
  );

  // Handle cell tap
  const handleCellPress = useCallback(
    (index: number) => {
      setSession((prev) => {
        if (prev.winner || prev.board[index] !== null) return prev;

        const nextBoard = [...prev.board];
        nextBoard[index] = prev.currentTurn;
        const nextMoves = [...prev.moveHistory, index];

        playGameSound(
          prev.currentTurn === 'X' ? 'move_x' : 'move_o',
          settings.soundEffects && !prev.isMuted
        );

        const outcome = checkWinner(nextBoard, prev.boardSize);
        const nextTurn: 'X' | 'O' = prev.currentTurn === 'X' ? 'O' : 'X';

        const nextScores = { ...prev.scores };
        if (outcome.winner === prev.player1Symbol) nextScores.p1 += 1;
        else if (outcome.winner === prev.player2Symbol) nextScores.p2 += 1;
        else if (outcome.winner === 'draw') nextScores.draws += 1;

        const updated: ActiveGameSession = {
          ...prev,
          board: nextBoard,
          moveHistory: nextMoves,
          currentTurn: nextTurn,
          winner: outcome.winner,
          winningLine: outcome.line,
          scores: nextScores,
        };

        if (outcome.winner) {
          finalizeRound(outcome.winner, updated);
        }
        return updated;
      });
    },
    [finalizeRound, settings.soundEffects]
  );

  // Automatic AI / Online Opponent Move
  useEffect(() => {
    const isBoardScreen =
      currentScreen === 'offline_board' || currentScreen === 'online_board';
    if (!isBoardScreen || session.winner || uiState !== 'default') return;

    const isBotOrRemoteTurn =
      (session.mode === 'ai' || session.mode.startsWith('online')) &&
      session.currentTurn === session.player2Symbol;

    if (!isBotOrRemoteTurn) return;

    const delay = session.mode === 'ai' ? 420 : 650;
    const timer = window.setTimeout(() => {
      const moveIdx = getAIMove(
        session.board,
        session.boardSize,
        session.mode === 'ai' ? session.difficulty : 'medium',
        session.player2Symbol
      );
      if (moveIdx !== -1) {
        handleCellPress(moveIdx);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    currentScreen,
    handleCellPress,
    session.board,
    session.boardSize,
    session.currentTurn,
    session.difficulty,
    session.mode,
    session.player2Symbol,
    session.winner,
    uiState,
  ]);

  const handleUndo = () => {
    setSession((prev) => {
      if (prev.moveHistory.length === 0 || prev.winner) return prev;
      const stepsToUndo = prev.mode === 'ai' && prev.moveHistory.length >= 2 ? 2 : 1;
      const nextHistory = prev.moveHistory.slice(0, prev.moveHistory.length - stepsToUndo);
      const nextBoard = Array(prev.boardSize * prev.boardSize).fill(null);
      nextHistory.forEach((cellIdx, i) => {
        nextBoard[cellIdx] = i % 2 === 0 ? 'X' : 'O';
      });
      const nextTurn: 'X' | 'O' = nextHistory.length % 2 === 0 ? 'X' : 'O';
      return {
        ...prev,
        board: nextBoard,
        moveHistory: nextHistory,
        currentTurn: nextTurn,
      };
    });
  };

  const handleRestartRound = () => {
    setSession((prev) => ({
      ...prev,
      board: Array(prev.boardSize * prev.boardSize).fill(null),
      moveHistory: [],
      currentTurn: 'X',
      winner: null,
      winningLine: null,
      elapsedSeconds: 0,
    }));
  };

  const startLocalGame = () => {
    const size = setupConfig.boardSize;
    setSelectedBoardSize(size);
    setSession({
      mode: 'local',
      boardSize: size,
      difficulty: selectedDifficulty,
      player1Name: setupConfig.p1Name.trim() || 'Player 1',
      player1Avatar: setupConfig.p1Avatar,
      player1Symbol: setupConfig.p1Symbol,
      player2Name: setupConfig.p2Name.trim() || 'Player 2',
      player2Avatar: setupConfig.p2Avatar,
      player2Symbol: setupConfig.p1Symbol === 'X' ? 'O' : 'X',
      board: Array(size * size).fill(null),
      moveHistory: [],
      currentTurn: 'X',
      winner: null,
      winningLine: null,
      scores: { p1: 0, p2: 0, draws: 0 },
      elapsedSeconds: 0,
      isMuted: false,
    });
    navigate('offline_board');
  };

  const startVsAI = (diff: Difficulty = selectedDifficulty) => {
    const size = selectedBoardSize;
    setSelectedDifficulty(diff);
    setSession({
      mode: 'ai',
      boardSize: size,
      difficulty: diff,
      player1Name: user.username,
      player1Avatar: user.avatarId,
      player1Symbol: 'X',
      player2Name: `Vortex AI`,
      player2Avatar: 'av_ai',
      player2Symbol: 'O',
      board: Array(size * size).fill(null),
      moveHistory: [],
      currentTurn: 'X',
      winner: null,
      winningLine: null,
      scores: { p1: 0, p2: 0, draws: 0 },
      elapsedSeconds: 0,
      isMuted: false,
    });
    navigate('offline_board');
  };

  const startOnlineQuickMatch = () => {
    const size: BoardSize = 3;
    setSession({
      mode: 'online_quick',
      boardSize: size,
      difficulty: 'medium',
      player1Name: user.username,
      player1Avatar: user.avatarId,
      player1Symbol: 'X',
      player2Name: 'MayaLin',
      player2Avatar: 'av_2',
      player2Symbol: 'O',
      board: Array(size * size).fill(null),
      moveHistory: [],
      currentTurn: 'X',
      winner: null,
      winningLine: null,
      scores: { p1: 0, p2: 0, draws: 0 },
      elapsedSeconds: 0,
      isMuted: false,
    });
  };

  const currentMeta = useMemo(
    () => SCREEN_CATALOG.find((s) => s.id === currentScreen) || SCREEN_CATALOG[5],
    [currentScreen]
  );

  return (
    <div className="min-h-screen bg-[#070510] text-white flex flex-col">
      {/* Desktop Studio Top Bar (Strict 3-zone contract) */}
      <header className="hidden lg:flex items-center justify-between gap-8 px-6 h-14 border-b border-[#30264D] bg-[#0B0718] shrink-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setStudioTab('simulator');
            navigate('home');
          }}
          className="flex items-center gap-2.5 font-display font-bold text-lg text-white whitespace-nowrap shrink-0"
        >
          <span className="w-7 h-7 rounded-lg bg-[#1C1635] border border-[#30264D] flex items-center justify-center gap-0.5">
            <SymbolMark value="X" size="sm" glow={false} />
          </span>
          <span>Tic Tac Toe</span>
        </a>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setStudioTab('simulator')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer transition-colors ${
              studioTab === 'simulator'
                ? 'text-white border-b-2 border-[#8B5CF6]'
                : 'text-[#A8A0BC] hover:text-white'
            }`}
          >
            Live App
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('screens')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer transition-colors ${
              studioTab === 'screens'
                ? 'text-white border-b-2 border-[#8B5CF6]'
                : 'text-[#A8A0BC] hover:text-white'
            }`}
          >
            40 Screens
          </button>
          <button
            type="button"
            onClick={() => setStudioTab('design_system')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer transition-colors ${
              studioTab === 'design_system'
                ? 'text-white border-b-2 border-[#8B5CF6]'
                : 'text-[#A8A0BC] hover:text-white'
            }`}
          >
            Design System
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => {
              setStudioTab('simulator');
              startVsAI('medium');
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer hover:brightness-110"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Match</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      {studioTab === 'design_system' ? (
        <div className="flex-1 overflow-y-auto studio-scroll bg-[#0B0718]">
          <DesignSystemExplorer
            onOpenScreen={(id) => {
              setStudioTab('simulator');
              navigate(id);
            }}
          />
        </div>
      ) : studioTab === 'screens' ? (
        <div className="flex-1 overflow-y-auto studio-scroll bg-[#0B0718]">
          <AllScreensGallery
            activeScreen={currentScreen}
            onSelectScreen={(id) => {
              setStudioTab('simulator');
              navigate(id);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[290px_1fr_300px] min-h-0">
          {/* Left Panel: 40 Screens & 8 User Flows Navigator (Desktop) */}
          <aside className="hidden lg:flex flex-col border-r border-[#30264D] bg-[#0E0A1D] min-h-0 h-[calc(100vh-56px)]">
            <div className="p-3 border-b border-[#30264D] grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSidebarMode('screens')}
                className={`h-9 rounded-xl text-xs font-semibold cursor-pointer ${
                  sidebarMode === 'screens'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-[#1C1635] text-[#A8A0BC] hover:text-white'
                }`}
              >
                Screens (40)
              </button>
              <button
                type="button"
                onClick={() => setSidebarMode('flows')}
                className={`h-9 rounded-xl text-xs font-semibold cursor-pointer ${
                  sidebarMode === 'flows'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-[#1C1635] text-[#A8A0BC] hover:text-white'
                }`}
              >
                Flows (8)
              </button>
            </div>

            <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-4">
              {sidebarMode === 'screens' ? (
                CATEGORIES.map((cat) => (
                  <div key={cat} className="space-y-1">
                    <div className="px-2 py-1 text-[11px] font-semibold text-[#A8A0BC]">
                      {cat}
                    </div>
                    {SCREEN_CATALOG.filter((s) => s.category === cat).map((scr) => {
                      const active = scr.id === currentScreen;
                      return (
                        <button
                          key={scr.id}
                          type="button"
                          onClick={() => navigate(scr.id)}
                          className={`w-full px-2.5 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#8B5CF6]/20 text-white border border-[#8B5CF6]/60'
                              : 'text-[#A8A0BC] hover:bg-[#1C1635] hover:text-white border border-transparent'
                          }`}
                        >
                          <span className="truncate">
                            <span className="font-mono-num opacity-70 mr-1.5">
                              {String(scr.number).padStart(2, '0')}.
                            </span>
                            {scr.title}
                          </span>
                          {active && <ChevronRight className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="space-y-3">
                  {USER_FLOWS.map((flow) => (
                    <div
                      key={flow.id}
                      className="rounded-2xl bg-[#15102A] border border-[#30264D] p-3 space-y-2"
                    >
                      <div className="font-display font-semibold text-xs text-white">
                        {flow.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {flow.steps.map((step, i) => (
                          <button
                            key={`${flow.id}-${i}`}
                            type="button"
                            onClick={() => navigate(step.screen)}
                            className={`px-2 py-1 rounded-lg text-[11px] cursor-pointer transition-colors ${
                              currentScreen === step.screen
                                ? 'bg-[#8B5CF6] text-white font-semibold'
                                : 'bg-[#1C1635] text-[#A8A0BC] hover:text-white border border-[#30264D]'
                            }`}
                          >
                            {i + 1}. {step.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Center Viewport: Full-bleed on Mobile, Realistic iOS/Android Device Shell on Desktop */}
          <main className="flex-1 flex flex-col items-center justify-center lg:p-6 bg-[#070510] min-h-screen lg:min-h-0 lg:h-[calc(100vh-56px)] overflow-y-auto">
            <div
              data-app-theme={activeTheme}
              className="w-full h-screen lg:w-[390px] lg:h-[810px] lg:max-h-full bg-[var(--bg-primary)] text-[var(--text-primary)] lg:rounded-[44px] lg:border-[6px] lg:border-[#241D44] lg:shadow-[0_24px_80px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden relative transition-colors duration-200"
            >
              <PlatformStatusBar platform={platform} />

              <ToastNotification toast={toast} onDismiss={() => setToast(null)} />

              <MobileScreenRouter
                screen={currentScreen}
                uiState={uiState}
                user={user}
                session={session}
                setupConfig={setupConfig}
                selectedDifficulty={selectedDifficulty}
                selectedBoardSize={selectedBoardSize}
                history={history}
                room={room}
                friends={friends}
                selectedFriend={selectedFriend}
                leaderboard={GLOBAL_LEADERBOARD}
                achievements={achievements}
                rewards={rewards}
                activeTheme={activeTheme}
                settings={settings}
                onResetUIState={() => setUiState('default')}
                onUpdateSetup={(patch) => setSetupConfig((prev) => ({ ...prev, ...patch }))}
                onNavigate={navigate}
                onBack={goBack}
                onStartLocalGame={startLocalGame}
                onPlayAsGuest={() => {
                  setUser((prev) => ({ ...prev, username: 'Guest_Player', isGuest: true }));
                  showToast('Guest Session Active', 'Offline & AI modes unlocked');
                  navigate('home');
                }}
                onCellPress={handleCellPress}
                onUndo={handleUndo}
                onRestartRound={handleRestartRound}
                onSelectDifficulty={setSelectedDifficulty}
                onStartVsAI={startVsAI}
                onSelectBoardSize={(sz) => {
                  setSelectedBoardSize(sz);
                  setSetupConfig((prev) => ({ ...prev, boardSize: sz }));
                }}
                onStartQuickMatch={startOnlineQuickMatch}
                onCreateRoom={(sz) => {
                  const code = `VTX${Math.floor(100 + Math.random() * 899)}`;
                  setRoom({
                    code,
                    hostName: user.username,
                    hostAvatarId: user.avatarId,
                    boardSize: sz,
                    winLength: getWinLength(sz),
                    guestName: null,
                    guestAvatarId: null,
                    guestReady: false,
                  });
                  setSession((prev) => ({
                    ...prev,
                    mode: 'online_private',
                    boardSize: sz,
                    board: Array(sz * sz).fill(null),
                    moveHistory: [],
                    currentTurn: 'X',
                    winner: null,
                    winningLine: null,
                  }));
                }}
                onJoinRoomCode={(code) => {
                  if (code.length < 4) return false;
                  setRoom((prev) => ({ ...prev, code }));
                  startOnlineQuickMatch();
                  return true;
                }}
                onToggleMute={() =>
                  setSession((prev) => ({ ...prev, isMuted: !prev.isMuted }))
                }
                onUpdateProfile={(patch) => setUser((prev) => ({ ...prev, ...patch }))}
                onSelectFriend={setSelectedFriend}
                onAcceptFriendRequest={(id) => {
                  setFriends((prev) =>
                    prev.map((f) => (f.id === id ? { ...f, pendingRequest: false } : f))
                  );
                  showToast('Friend Added', 'You can now invite them to private rooms', 'success');
                }}
                onAddFriend={(username) => {
                  setFriends((prev) => {
                    if (prev.some((f) => f.username === username)) return prev;
                    return [
                      ...prev,
                      {
                        id: `fr_${Date.now()}`,
                        username,
                        avatarId: 'av_3',
                        level: 13,
                        rating: 1580,
                        status: 'online',
                        wins: 77,
                        losses: 40,
                        draws: 15,
                        winRate: 58,
                      },
                    ];
                  });
                }}
                onClaimReward={(day) => {
                  const rewardObj = rewards.find((r) => r.day === day);
                  if (!rewardObj || rewardObj.status !== 'claimable') return;
                  playGameSound('reward', settings.soundEffects);
                  setRewards((prev) =>
                    prev.map((r) =>
                      r.day === day
                        ? { ...r, status: 'claimed' }
                        : r.day === day + 1
                        ? { ...r, status: 'claimable' }
                        : r
                    )
                  );
                  setUser((prev) => ({ ...prev, coins: prev.coins + rewardObj.coins }));
                  showToast(`Day ${day} Claimed`, `+${rewardObj.coins} coins added`, 'success');
                }}
                onChallengeFriend={(f) => {
                  setSession({
                    mode: 'online_friend',
                    boardSize: 5,
                    difficulty: 'medium',
                    player1Name: user.username,
                    player1Avatar: user.avatarId,
                    player1Symbol: 'X',
                    player2Name: f.username,
                    player2Avatar: f.avatarId,
                    player2Symbol: 'O',
                    board: Array(25).fill(null),
                    moveHistory: [],
                    currentTurn: 'X',
                    winner: null,
                    winningLine: null,
                    scores: { p1: 0, p2: 0, draws: 0 },
                    elapsedSeconds: 0,
                    isMuted: false,
                  });
                  navigate('match_invitation');
                }}
                onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
                onSelectTheme={setActiveTheme}
                onNotify={(title, msg) => showToast(title, msg, 'success')}
              />

              <PlatformNavIndicator
                platform={platform}
                onBack={goBack}
                onHome={() => navigate('home')}
              />
            </div>
          </main>

          {/* Right Panel: Platform, Theme, UI States & Active Screen Spec (Desktop) */}
          <aside className="hidden lg:flex flex-col border-l border-[#30264D] bg-[#0E0A1D] p-4 space-y-5 overflow-y-auto studio-scroll h-[calc(100vh-56px)]">
            {/* Active Screen Info */}
            <div className="rounded-2xl bg-[#15102A] border border-[#30264D] p-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono-num text-[#8B5CF6]">
                <span>SCREEN {String(currentMeta.number).padStart(2, '0')} / 40</span>
                <span>{currentMeta.category}</span>
              </div>
              <h2 className="font-display font-bold text-base text-white">{currentMeta.title}</h2>
              <p className="text-xs text-[#A8A0BC] leading-relaxed">{currentMeta.summary}</p>
              <div className="pt-2 border-t border-[#30264D] text-[11px] text-[#A8A0BC]">
                Components: {currentMeta.components.join(' · ')}
              </div>
            </div>

            {/* Platform Switcher */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A8A0BC]">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Target Platform</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['ios', 'android'] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border ${
                      platform === p
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                        : 'bg-[#15102A] border-[#30264D] text-[#A8A0BC]'
                    }`}
                  >
                    <MonitorSmartphone className="w-3.5 h-3.5" />
                    <span>{p === 'ios' ? 'iOS' : 'Android'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Switcher */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A8A0BC]">
                <Palette className="w-3.5 h-3.5" />
                <span>Live App Theme</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_LIST.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTheme(t.id)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer border ${
                      activeTheme === t.id
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                        : 'bg-[#15102A] border-[#30264D] text-[#A8A0BC] hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/25 shrink-0"
                      style={{ backgroundColor: t.bg }}
                    />
                    <span className="truncate">{t.name.replace(' Theme', '')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Edge & Interaction States Simulator */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A8A0BC]">
                <Layers className="w-3.5 h-3.5" />
                <span>Interaction &amp; Edge States</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['default', 'Default'],
                    ['loading', 'Loading'],
                    ['empty', 'Empty'],
                    ['error', 'Error'],
                    ['offline', 'Offline'],
                    ['opponent_disconnected', 'Opponent Drop'],
                    ['permission_denied', 'Permission'],
                  ] as [UIStateOverride, string][]
                ).map(([stateKey, label]) => (
                  <button
                    key={stateKey}
                    type="button"
                    onClick={() => setUiState(stateKey)}
                    className={`px-2.5 py-2 rounded-xl text-[11px] font-medium cursor-pointer border text-left truncate ${
                      uiState === stateKey
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                        : 'bg-[#15102A] border-[#30264D] text-[#A8A0BC] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Next Destinations */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#A8A0BC]">Connected Screens</div>
              <div className="flex flex-wrap gap-1.5">
                {currentMeta.nextScreens.map((nextId) => {
                  const nextMeta = SCREEN_CATALOG.find((s) => s.id === nextId);
                  return (
                    <button
                      key={nextId}
                      type="button"
                      onClick={() => navigate(nextId)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#15102A] border border-[#30264D] text-[11px] text-white hover:border-[#8B5CF6] cursor-pointer"
                    >
                      {nextMeta ? `${nextMeta.number}. ${nextMeta.title}` : nextId}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
