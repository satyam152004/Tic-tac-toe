import React, { useState } from 'react';
import {
  Bot,
  Calendar,
  Grid3X3,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import {
  AppButton,
  AppCard,
  AppHeader,
  ConfirmationDialog,
  EmptyState,
  GameBoard,
  PlayerAvatar,
  PlayerInfoCard,
  ScoreCard,
  SymbolMark,
} from '../components/ds/DesignSystemComponents';
import {
  ActiveGameSession,
  BoardSize,
  Difficulty,
  MatchRecord,
  ScreenId,
} from '../types/app';
import { getWinLength } from '../utils/gameLogic';

export interface OfflineScreensProps {
  screen: ScreenId;
  session: ActiveGameSession;
  selectedDifficulty: Difficulty;
  selectedBoardSize: BoardSize;
  history: MatchRecord[];
  onCellPress: (index: number) => void;
  onUndo: () => void;
  onRestartRound: () => void;
  onSelectDifficulty: (d: Difficulty) => void;
  onStartVsAI: (d?: Difficulty) => void;
  onSelectBoardSize: (size: BoardSize) => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const OfflineScreens: React.FC<OfflineScreensProps> = ({
  screen,
  session,
  selectedDifficulty,
  selectedBoardSize,
  history,
  onCellPress,
  onUndo,
  onRestartRound,
  onSelectDifficulty,
  onStartVsAI,
  onSelectBoardSize,
  onNavigate,
  onBack,
}) => {
  const [confirmExit, setConfirmExit] = useState(false);

  /* 10. Offline Game Board */
  if (screen === 'offline_board') {
    const p1Active = !session.winner && session.currentTurn === session.player1Symbol;
    const p2Active = !session.winner && session.currentTurn === session.player2Symbol;
    const lastMove =
      session.moveHistory.length > 0
        ? session.moveHistory[session.moveHistory.length - 1]
        : null;

    return (
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AppHeader
          title={session.mode === 'ai' ? `vs AI · ${session.difficulty.toUpperCase()}` : 'Offline Match'}
          subtitle={`${session.boardSize}x${session.boardSize} Grid · ${getWinLength(session.boardSize)} in a row`}
          onBack={() => setConfirmExit(true)}
          rightAction={
            <button
              type="button"
              aria-label="Pause game"
              onClick={() => onNavigate('game_pause')}
              className="w-11 h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-primary)] hover:border-[#8B5CF6] cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col justify-between gap-4">
          {/* Players Turn Cards */}
          <div className="flex items-stretch gap-2.5">
            <PlayerInfoCard
              name={session.player1Name}
              avatarId={session.player1Avatar}
              symbol={session.player1Symbol}
              score={session.scores.p1}
              isActive={p1Active}
              subtitle="Player 1"
            />
            <PlayerInfoCard
              name={session.player2Name}
              avatarId={session.player2Avatar}
              symbol={session.player2Symbol}
              score={session.scores.p2}
              isActive={p2Active}
              subtitle={session.mode === 'ai' ? 'AI Bot' : 'Player 2'}
            />
          </div>

          {/* Match Status Bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs">
            <span className="text-[var(--text-secondary)]">
              {session.winner
                ? session.winner === 'draw'
                  ? 'Round ended in a Draw'
                  : `${
                      session.winner === session.player1Symbol
                        ? session.player1Name
                        : session.player2Name
                    } Wins`
                : `Turn: ${
                    session.currentTurn === session.player1Symbol
                      ? session.player1Name
                      : session.player2Name
                  } (${session.currentTurn})`}
            </span>
            <span className="font-mono-num font-semibold text-[var(--text-primary)]">
              {formatTimer(session.elapsedSeconds)}
            </span>
          </div>

          {/* Interactive Board */}
          <div className="my-auto">
            <GameBoard
              board={session.board}
              size={session.boardSize}
              winningLine={session.winningLine}
              lastMoveIndex={lastMove}
              disabled={Boolean(session.winner) || (session.mode === 'ai' && p2Active)}
              onCellPress={onCellPress}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 gap-2.5">
            <AppButton
              variant="secondary"
              size="md"
              disabled={session.moveHistory.length === 0 || Boolean(session.winner)}
              icon={<Undo2 className="w-4 h-4" />}
              onClick={onUndo}
            >
              Undo
            </AppButton>
            <AppButton
              variant="secondary"
              size="md"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={onRestartRound}
            >
              Restart
            </AppButton>
            <AppButton
              variant="outline"
              size="md"
              icon={<Grid3X3 className="w-4 h-4" />}
              onClick={() => onNavigate('board_selection')}
            >
              Grid
            </AppButton>
          </div>
        </div>

        <ConfirmationDialog
          open={confirmExit}
          title="Leave Match?"
          message="Your current round progress will be paused or discarded."
          confirmLabel="Exit"
          cancelLabel="Keep Playing"
          destructive
          onConfirm={() => {
            setConfirmExit(false);
            onNavigate('home');
          }}
          onCancel={() => setConfirmExit(false)}
        />
      </div>
    );
  }

  /* 11. Advanced Board Selection */
  if (screen === 'board_selection') {
    const boards: { size: BoardSize; title: string; winRule: string; desc: string }[] = [
      {
        size: 3,
        title: 'Classic 3x3',
        winRule: 'Align 3 in a row',
        desc: 'Fast, pure tactical duel. Ideal for quick 60-second matches.',
      },
      {
        size: 5,
        title: 'Tactical 5x5',
        winRule: 'Align 4 in a row',
        desc: 'Expanded midfield control with multi-angle diagonal traps.',
      },
      {
        size: 6,
        title: 'Grand 6x6',
        winRule: 'Align 4 in a row',
        desc: 'Deep strategic grid for prolonged offense and defense.',
      },
    ];

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Board Size" subtitle="Choose grid & win condition" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          {boards.map((b) => {
            const previewCells = Array(b.size * b.size).fill(null);
            previewCells[0] = 'X';
            previewCells[b.size + 1] = 'X';
            previewCells[b.size * 2 + 2] = 'X';
            previewCells[1] = 'O';
            previewCells[b.size] = 'O';

            return (
              <AppCard
                key={b.size}
                selected={selectedBoardSize === b.size}
                onClick={() => onSelectBoardSize(b.size)}
                className="flex items-center gap-3.5"
              >
                <div className="w-24 shrink-0">
                  <GameBoard board={previewCells} size={b.size} compact disabled />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-[15px] text-[var(--text-primary)]">
                    {b.title}
                  </h3>
                  <div className="text-xs font-semibold text-[#8B5CF6] mt-0.5">{b.winRule}</div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">{b.desc}</p>
                </div>
              </AppCard>
            );
          })}
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton fullWidth onClick={() => onNavigate('player_setup')}>
            Use {selectedBoardSize}x{selectedBoardSize} Board
          </AppButton>
        </div>
      </div>
    );
  }

  /* 12. AI Difficulty Selection */
  if (screen === 'ai_difficulty') {
    const levels: { id: Difficulty; name: string; desc: string; elo: string }[] = [
      {
        id: 'easy',
        name: 'Easy',
        desc: 'Relaxed pace. Makes occasional openings for casual warmups.',
        elo: 'Bot Elo ~950',
      },
      {
        id: 'medium',
        name: 'Medium',
        desc: 'Balanced tactics. Blocks obvious threats and seizes center squares.',
        elo: 'Bot Elo ~1400',
      },
      {
        id: 'hard',
        name: 'Hard',
        desc: 'Full Minimax solver on 3x3 & deep heuristic on 5x5/6x6.',
        elo: 'Bot Elo ~1950',
      },
    ];

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="AI Difficulty" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <AppCard className="flex items-center gap-3.5">
            <PlayerAvatar avatarId="av_ai" name="Vortex AI" size="lg" activeRing />
            <div className="min-w-0">
              <div className="font-display font-bold text-base text-[var(--text-primary)]">
                Vortex AI Strategist
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Adaptive tactical engine for {selectedBoardSize}x{selectedBoardSize} boards
              </p>
            </div>
          </AppCard>

          <div className="space-y-2.5">
            {levels.map((lvl) => (
              <AppCard
                key={lvl.id}
                selected={selectedDifficulty === lvl.id}
                onClick={() => onSelectDifficulty(lvl.id)}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-[15px] text-[var(--text-primary)]">
                    {lvl.name}
                  </span>
                  <span className="text-xs font-mono-num text-[var(--text-secondary)]">
                    {lvl.elo}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{lvl.desc}</p>
              </AppCard>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton
            fullWidth
            icon={<Bot className="w-4 h-4" />}
            onClick={() => onStartVsAI(selectedDifficulty)}
          >
            Start vs AI
          </AppButton>
        </div>
      </div>
    );
  }

  /* 13. Game Pause Screen */
  if (screen === 'game_pause') {
    return (
      <div className="flex-1 flex flex-col justify-center p-5 bg-[var(--bg-primary)]/95">
        <AppCard padding="lg" className="space-y-5 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6]">
            <Pause className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-[var(--text-primary)]">
              Game Paused
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {session.player1Name} vs {session.player2Name} · {formatTimer(session.elapsedSeconds)}
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <AppButton
              fullWidth
              icon={<Play className="w-4 h-4" />}
              onClick={() => onNavigate('offline_board')}
            >
              Resume Game
            </AppButton>
            <AppButton
              fullWidth
              variant="secondary"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                onRestartRound();
                onNavigate('offline_board');
              }}
            >
              Restart Match
            </AppButton>
            <AppButton
              fullWidth
              variant="outline"
              onClick={() => onNavigate('home')}
            >
              Exit to Home
            </AppButton>
          </div>
        </AppCard>
      </div>
    );
  }

  /* 14. Game Result Screen */
  if (screen === 'game_result') {
    const isDraw = session.winner === 'draw' || !session.winner;
    const winnerName =
      session.winner === session.player1Symbol ? session.player1Name : session.player2Name;
    const winnerAvatar =
      session.winner === session.player1Symbol ? session.player1Avatar : session.player2Avatar;

    return (
      <div className="flex-1 flex flex-col justify-between p-5">
        <div className="pt-4 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FBBF24]/25 to-[#8B5CF6]/25 border border-[#FBBF24]/50 flex items-center justify-center text-[#FBBF24]">
            {isDraw ? <ShieldAlert className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
          </div>

          <div>
            <h2 className="font-display font-extrabold text-2xl text-[var(--text-primary)]">
              {isDraw ? 'Match Draw' : `${winnerName} Wins!`}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono-num">
              {session.boardSize}x{session.boardSize} Board · {session.moveHistory.length} moves ·{' '}
              {formatTimer(session.elapsedSeconds)}
            </p>
          </div>

          {!isDraw && (
            <div className="flex items-center justify-center gap-3">
              <PlayerAvatar avatarId={winnerAvatar} name={winnerName} size="lg" activeRing />
              <SymbolMark value={session.winner === 'O' ? 'O' : 'X'} size="lg" />
            </div>
          )}
        </div>

        <div className="space-y-4 my-auto">
          <GameBoard
            board={session.board}
            size={session.boardSize}
            winningLine={session.winningLine}
            compact
            disabled
          />

          <div className="grid grid-cols-3 gap-2.5">
            <ScoreCard label={session.player1Name} value={session.scores.p1} tone="accent" />
            <ScoreCard label="Draws" value={session.scores.draws} />
            <ScoreCard label={session.player2Name} value={session.scores.p2} tone="success" />
          </div>
        </div>

        <div className="space-y-2.5">
          <AppButton
            fullWidth
            icon={<Sparkles className="w-4 h-4" />}
            onClick={() => onNavigate('rematch')}
          >
            Rematch Options
          </AppButton>
          <AppButton fullWidth variant="outline" onClick={() => onNavigate('home')}>
            Back to Home
          </AppButton>
        </div>
      </div>
    );
  }

  /* 15. Rematch Screen */
  if (screen === 'rematch') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Rematch" subtitle="Choose your next round" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <AppCard className="text-center space-y-2">
            <div className="text-xs text-[var(--text-secondary)]">Current Series Score</div>
            <div className="font-display font-bold text-2xl font-mono-num text-[var(--text-primary)]">
              {session.scores.p1} — {session.scores.p2}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {session.player1Name} vs {session.player2Name}
            </div>
          </AppCard>

          <div className="space-y-2.5">
            <AppButton
              fullWidth
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                onRestartRound();
                onNavigate('offline_board');
              }}
            >
              Play Again Immediately
            </AppButton>
            <AppButton
              fullWidth
              variant="secondary"
              icon={<Users className="w-4 h-4" />}
              onClick={() => onNavigate('player_setup')}
            >
              Change Opponent
            </AppButton>
            <AppButton
              fullWidth
              variant="secondary"
              icon={<Grid3X3 className="w-4 h-4" />}
              onClick={() => onNavigate('board_selection')}
            >
              Change Board Size
            </AppButton>
            <AppButton fullWidth variant="outline" onClick={() => onNavigate('home')}>
              Return Home
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  /* 16. Offline Match History */
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader title="Match History" subtitle="Recent offline & arena rounds" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2.5">
        {history.length === 0 ? (
          <EmptyState
            title="No Matches Played Yet"
            description="Complete an offline or AI match to see your round history here."
            actionLabel="Start First Match"
            onAction={() => onNavigate('game_mode')}
          />
        ) : (
          history.map((item) => {
            const outcomeColor =
              item.result === 'win'
                ? 'text-[#22C55E]'
                : item.result === 'loss'
                ? 'text-[#F87171]'
                : 'text-[#FBBF24]';
            const outcomeLabel =
              item.result === 'win' ? 'Victory' : item.result === 'loss' ? 'Defeat' : 'Draw';

            return (
              <AppCard
                key={item.id}
                onClick={() => onNavigate('game_result')}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar
                    avatarId={item.opponentAvatarId}
                    name={item.opponentName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-sm text-[var(--text-primary)] truncate">
                      vs {item.opponentName}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                      <span>{item.mode}</span>
                      <span>·</span>
                      <span>
                        {item.boardSize}x{item.boardSize}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> {item.date}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold ${outcomeColor}`}>{outcomeLabel}</div>
                  <div className="text-[11px] font-mono-num text-[var(--text-secondary)] mt-0.5">
                    {item.scoreSummary}
                  </div>
                </div>
              </AppCard>
            );
          })
        )}
      </div>
    </div>
  );
};
