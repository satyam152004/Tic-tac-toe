import React, { useEffect, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Copy,
  Flag,
  Globe,
  KeyRound,
  MessageSquare,
  PlusSquare,
  RefreshCw,
  Send,
  Share2,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  AppButton,
  AppCard,
  AppHeader,
  BottomNavigation,
  ConfirmationDialog,
  ErrorState,
  GameBoard,
  GameModeCard,
  LoadingIndicator,
  PlayerAvatar,
  PlayerInfoCard,
  ScoreCard,
} from '../components/ds/DesignSystemComponents';
import {
  ActiveGameSession,
  BoardSize,
  Friend,
  PlayerProfile,
  RoomInfo,
  ScreenId,
} from '../types/app';
import { getWinLength } from '../utils/gameLogic';

export interface OnlineScreensProps {
  screen: ScreenId;
  user: PlayerProfile;
  session: ActiveGameSession;
  room: RoomInfo;
  friends: Friend[];
  onCellPress: (index: number) => void;
  onStartQuickMatch: () => void;
  onCreateRoom: (size: BoardSize) => void;
  onJoinRoomCode: (code: string) => boolean;
  onToggleMute: () => void;
  onSimulateOpponentMove?: () => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
  onNotify: (title: string, message?: string) => void;
}

export const OnlineScreens: React.FC<OnlineScreensProps> = ({
  screen,
  user,
  session,
  room,
  friends,
  onCellPress,
  onStartQuickMatch,
  onCreateRoom,
  onJoinRoomCode,
  onToggleMute,
  onNavigate,
  onBack,
  onNotify,
}) => {
  const [searchSec, setSearchSec] = useState(0);
  const [roomBoardSize, setRoomBoardSize] = useState<BoardSize>(room.boardSize);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showResign, setShowResign] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: string; text: string }[]>([
    { sender: 'MayaLin', text: 'Good luck! Have fun.' },
  ]);

  useEffect(() => {
    if (screen !== 'matchmaking') {
      setSearchSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSearchSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  /* 17. Online Lobby */
  if (screen === 'online_lobby') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader
          title="Online Lobby"
          subtitle="1,240 players online"
          onBack={onBack}
          rightAction={
            <span className="flex items-center gap-1 text-xs font-mono-num text-[#22C55E]">
              <Wifi className="w-3.5 h-3.5" /> 18ms
            </span>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          <GameModeCard
            title="Quick Match"
            description="Instant skill-based matchmaking worldwide"
            metaText="Ranked · Avg wait 4s"
            icon={<Globe className="w-6 h-6" />}
            featured
            onClick={() => {
              onStartQuickMatch();
              onNavigate('matchmaking');
            }}
          />

          <GameModeCard
            title="Create Private Room"
            description="Host a custom grid and share your invite code"
            metaText="3x3, 5x5 or 6x6 · Custom rules"
            icon={<PlusSquare className="w-6 h-6" />}
            onClick={() => onNavigate('create_room')}
          />

          <GameModeCard
            title="Join Room"
            description="Enter a 6-character room code from a friend"
            metaText="Direct invite entry"
            icon={<KeyRound className="w-6 h-6" />}
            onClick={() => onNavigate('join_room')}
          />

          <GameModeCard
            title="Play with Friends"
            description="Challenge friends directly from your roster"
            metaText={`${friends.filter((f) => f.status === 'online').length} friends online`}
            icon={<Users className="w-6 h-6" />}
            onClick={() => onNavigate('friends')}
          />
        </div>

        <BottomNavigation activeTab="play" onNavigate={onNavigate} />
      </div>
    );
  }

  /* 18. Matchmaking Screen */
  if (screen === 'matchmaking') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Matchmaking" onBack={() => onNavigate('online_lobby')} />
        <div className="flex-1 flex flex-col items-center justify-between p-5 text-center">
          <div className="pt-4 space-y-1">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              Ranked Arena · {session.boardSize}x{session.boardSize}
            </div>
            <div className="font-mono-num text-2xl font-bold text-[#8B5CF6]">
              00:{String(searchSec).padStart(2, '0')}
            </div>
          </div>

          <div className="space-y-6 w-full">
            <div className="flex items-center justify-center gap-6">
              <div className="space-y-2 text-center">
                <PlayerAvatar avatarId={user.avatarId} name={user.username} size="lg" activeRing />
                <div className="text-xs font-semibold text-[var(--text-primary)]">{user.username}</div>
              </div>
              <span className="font-display font-bold text-sm text-[var(--text-secondary)]">VS</span>
              <div className="space-y-2 text-center">
                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-[#8B5CF6] flex items-center justify-center text-[#8B5CF6]">
                  ?
                </div>
                <div className="text-xs text-[var(--text-secondary)]">Searching</div>
              </div>
            </div>

            <LoadingIndicator
              label="Searching for Opponent"
              sublabel="Matching players near 1640 rating"
            />
          </div>

          <div className="w-full space-y-2.5">
            <AppButton fullWidth onClick={() => onNavigate('online_board')}>
              Opponent Found — Enter Match
            </AppButton>
            <AppButton fullWidth variant="outline" onClick={() => onNavigate('online_lobby')}>
              Cancel Search
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  /* 19. Waiting Room Screen */
  if (screen === 'waiting_room') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Waiting Room" subtitle={`Room ${room.code}`} onBack={onBack} />
        <div className="flex-1 flex flex-col justify-between p-4">
          <AppCard className="space-y-3 text-center">
            <div className="text-xs text-[var(--text-secondary)]">Room Code</div>
            <div className="font-mono-num font-bold text-3xl tracking-[0.2em] text-[#8B5CF6]">
              {room.code}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {room.boardSize}x{room.boardSize} Grid · {room.winLength} in a row
            </div>
          </AppCard>

          <div className="grid grid-cols-2 gap-3 my-auto">
            <AppCard selected className="text-center space-y-2">
              <PlayerAvatar avatarId={room.hostAvatarId} name={room.hostName} size="lg" activeRing />
              <div className="font-display font-semibold text-sm text-[var(--text-primary)] truncate">
                {room.hostName}
              </div>
              <div className="text-[11px] text-[#22C55E] font-medium">Host Ready</div>
            </AppCard>

            <AppCard className="text-center space-y-2 flex flex-col items-center justify-center">
              <LoadingIndicator label="Waiting..." sublabel="Opponent slot open" />
            </AppCard>
          </div>

          <div className="space-y-2.5">
            <AppButton fullWidth onClick={() => onNavigate('online_board')}>
              Start Match (Simulate Join)
            </AppButton>
            <AppButton fullWidth variant="outline" onClick={() => onNavigate('online_lobby')}>
              Cancel Room
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  /* 20. Online Game Board */
  if (screen === 'online_board') {
    const p1Active = !session.winner && session.currentTurn === session.player1Symbol;
    const p2Active = !session.winner && session.currentTurn === session.player2Symbol;

    return (
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AppHeader
          title="Online Match"
          subtitle={`Room ${room.code} · Connected`}
          onBack={() => setShowResign(true)}
          rightAction={
            <button
              type="button"
              aria-label="Simulate connection drop"
              onClick={() => onNavigate('reconnection')}
              className="min-h-[44px] px-2.5 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center gap-1 text-xs font-mono-num cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5" /> 18ms
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col justify-between gap-3">
          <div className="flex items-stretch gap-2.5">
            <PlayerInfoCard
              name={session.player1Name}
              avatarId={session.player1Avatar}
              symbol={session.player1Symbol}
              score={session.scores.p1}
              isActive={p1Active}
              subtitle="You"
            />
            <PlayerInfoCard
              name={session.player2Name}
              avatarId={session.player2Avatar}
              symbol={session.player2Symbol}
              score={session.scores.p2}
              isActive={p2Active}
              subtitle="Opponent"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs">
            <span className="text-[var(--text-secondary)]">
              {p1Active ? 'Your turn to move' : `${session.player2Name} is thinking...`}
            </span>
            <span className="font-mono-num font-bold text-[#FBBF24]">00:24</span>
          </div>

          <div className="my-auto">
            <GameBoard
              board={session.board}
              size={session.boardSize}
              winningLine={session.winningLine}
              disabled={Boolean(session.winner) || p2Active}
              onCellPress={onCellPress}
            />
          </div>

          {/* Quick Chat Drawer */}
          {chatOpen && (
            <AppCard padding="sm" className="space-y-2">
              <div className="max-h-20 overflow-y-auto space-y-1 text-xs">
                {chatLog.map((c, idx) => (
                  <div key={idx} className="text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">{c.sender}: </span>
                    {c.text}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Send message..."
                  className="flex-1 h-9 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  aria-label="Send chat"
                  onClick={() => {
                    if (!chatMessage.trim()) return;
                    setChatLog([...chatLog, { sender: user.username, text: chatMessage.trim() }]);
                    setChatMessage('');
                  }}
                  className="w-9 h-9 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </AppCard>
          )}

          {/* Action Bar */}
          <div className="grid grid-cols-3 gap-2">
            <AppButton
              variant="secondary"
              size="md"
              icon={<MessageSquare className="w-4 h-4" />}
              onClick={() => setChatOpen(!chatOpen)}
            >
              Chat
            </AppButton>
            <AppButton
              variant="secondary"
              size="md"
              icon={session.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              onClick={onToggleMute}
            >
              {session.isMuted ? 'Muted' : 'Audio'}
            </AppButton>
            <AppButton
              variant="danger"
              size="md"
              icon={<Flag className="w-4 h-4" />}
              onClick={() => setShowResign(true)}
            >
              Resign
            </AppButton>
          </div>
        </div>

        <ConfirmationDialog
          open={showResign}
          title="Resign Match?"
          message="Resigning forfeits this ranked online match to your opponent."
          confirmLabel="Resign"
          cancelLabel="Continue"
          destructive
          onConfirm={() => {
            setShowResign(false);
            onNavigate('online_result');
          }}
          onCancel={() => setShowResign(false)}
        />
      </div>
    );
  }

  /* 21. Create Room Screen */
  if (screen === 'create_room') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Create Private Room" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">Select Board Size</div>
            <div className="grid grid-cols-3 gap-2.5">
              {([3, 5, 6] as BoardSize[]).map((sz) => (
                <AppCard
                  key={sz}
                  selected={roomBoardSize === sz}
                  onClick={() => setRoomBoardSize(sz)}
                  padding="sm"
                  className="text-center"
                >
                  <div className="font-display font-bold text-base font-mono-num text-[var(--text-primary)]">
                    {sz}x{sz}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {getWinLength(sz)} to win
                  </div>
                </AppCard>
              ))}
            </div>
          </div>

          <AppCard className="space-y-3 text-center">
            <div className="text-xs text-[var(--text-secondary)]">Generated Room Code</div>
            <div className="font-mono-num font-bold text-3xl tracking-[0.22em] text-[#38BDF8]">
              {room.code}
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <AppButton
                variant="secondary"
                size="md"
                icon={<Copy className="w-4 h-4" />}
                onClick={() => onNotify('Room Code Copied', `Code ${room.code} copied to clipboard`)}
              >
                Copy Code
              </AppButton>
              <AppButton
                variant="secondary"
                size="md"
                icon={<Share2 className="w-4 h-4" />}
                onClick={() => onNotify('Invite Link Copied', `https://ttt.arena/r/${room.code}`)}
              >
                Share Link
              </AppButton>
            </div>
          </AppCard>

          <AppCard
            onClick={() => onNavigate('friends')}
            className="flex items-center justify-between"
          >
            <div>
              <div className="font-display font-semibold text-sm text-[var(--text-primary)]">
                Invite Online Friends
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Send direct push invitation
              </div>
            </div>
            <Users className="w-5 h-5 text-[#8B5CF6]" />
          </AppCard>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton
            fullWidth
            onClick={() => {
              onCreateRoom(roomBoardSize);
              onNavigate('room_details');
            }}
          >
            Create Room
          </AppButton>
        </div>
      </div>
    );
  }

  /* 22. Join Room Screen */
  if (screen === 'join_room') {
    const handleJoin = () => {
      if (joinCode.trim().length < 4) {
        setJoinError('Room code not found. Enter a valid 6-character code (e.g. VTX409).');
        return;
      }
      const ok = onJoinRoomCode(joinCode.trim().toUpperCase());
      if (!ok) {
        setJoinError('Invalid or expired room code. Try VTX409.');
      } else {
        setJoinError(null);
        onNavigate('waiting_room');
      }
    };

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Join Room" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <AppCard className="space-y-3">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Enter 6-Character Room Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinError(null);
                }}
                placeholder="e.g. VTX409"
                className="flex-1 h-12 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono-num text-lg tracking-widest uppercase text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="button"
                aria-label="Paste room code"
                onClick={() => {
                  setJoinCode(room.code);
                  setJoinError(null);
                }}
                className="h-12 px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <ClipboardPaste className="w-4 h-4 text-[#8B5CF6]" /> Paste
              </button>
            </div>
          </AppCard>

          {joinError && (
            <ErrorState
              title="Invalid Room Code"
              message={joinError}
              retryLabel="Use Demo Code (VTX409)"
              onRetry={() => {
                setJoinCode(room.code);
                setJoinError(null);
              }}
            />
          )}
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton fullWidth onClick={handleJoin}>
            Join Room
          </AppButton>
        </div>
      </div>
    );
  }

  /* 23. Room Details Screen */
  if (screen === 'room_details') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Room Details" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <AppCard className="space-y-2 text-center">
            <div className="text-xs text-[var(--text-secondary)]">Private Room Code</div>
            <div className="font-mono-num font-bold text-3xl tracking-[0.2em] text-[#8B5CF6]">
              {room.code}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {room.boardSize}x{room.boardSize} Board · {room.winLength} in a row
            </div>
          </AppCard>

          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">Player Slots</div>
            <AppCard selected className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlayerAvatar avatarId={room.hostAvatarId} name={room.hostName} size="md" />
                <div>
                  <div className="font-display font-semibold text-sm text-[var(--text-primary)]">
                    {room.hostName}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">Host · Plays X</div>
                </div>
              </div>
              <Check className="w-5 h-5 text-[#22C55E]" />
            </AppCard>

            <AppCard className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)]">
                  ?
                </div>
                <div>
                  <div className="font-display font-semibold text-sm text-[var(--text-primary)]">
                    Waiting for Opponent
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">Plays O</div>
                </div>
              </div>
            </AppCard>
          </div>

          <AppButton
            fullWidth
            variant="secondary"
            icon={<Share2 className="w-4 h-4" />}
            onClick={() => onNotify('Invitation Shared', `Room code ${room.code} ready`)}
          >
            Share Invitation
          </AppButton>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton fullWidth onClick={() => onNavigate('waiting_room')}>
            Open Waiting Room
          </AppButton>
        </div>
      </div>
    );
  }

  /* 24. Online Result Screen */
  if (screen === 'online_result') {
    const isWin = session.winner === session.player1Symbol || !session.winner;
    return (
      <div className="flex-1 flex flex-col justify-between p-5">
        <div className="pt-4 text-center space-y-3">
          <div className="text-xs font-semibold text-[#22C55E]">Ranked Match Complete</div>
          <h2 className="font-display font-extrabold text-2xl text-[var(--text-primary)]">
            {isWin ? `${session.player1Name} Wins!` : `${session.player2Name} Wins`}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-mono-num">
            Rating +24 pts · +75 Coins Earned
          </p>
        </div>

        <div className="space-y-4 my-auto">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center space-y-1.5">
              <PlayerAvatar avatarId={session.player1Avatar} name={session.player1Name} size="lg" activeRing />
              <div className="text-xs font-semibold text-[var(--text-primary)]">{session.player1Name}</div>
            </div>
            <div className="font-mono-num font-bold text-2xl text-[var(--text-primary)]">
              {session.scores.p1} : {session.scores.p2}
            </div>
            <div className="text-center space-y-1.5">
              <PlayerAvatar avatarId={session.player2Avatar} name={session.player2Name} size="lg" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">{session.player2Name}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <ScoreCard label="Rating" value="1,666" subtext="+24" tone="success" />
            <ScoreCard label="Accuracy" value="92%" tone="accent" />
            <ScoreCard label="Coins" value="+75" tone="warning" />
          </div>
        </div>

        <div className="space-y-2.5">
          <AppButton
            fullWidth
            onClick={() => {
              onNotify('Rematch Requested', `Sent to ${session.player2Name}`);
              onNavigate('waiting_room');
            }}
          >
            Request Rematch
          </AppButton>
          <AppButton fullWidth variant="outline" onClick={() => onNavigate('online_lobby')}>
            Return to Lobby
          </AppButton>
        </div>
      </div>
    );
  }

  /* 25. Reconnection Screen */
  if (screen === 'reconnection') {
    return (
      <div className="flex-1 flex flex-col justify-center p-5 text-center">
        <AppCard padding="lg" className="space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FBBF24]/15 border border-[#FBBF24]/40 flex items-center justify-center text-[#FBBF24]">
            <WifiOff className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
              Connection Lost
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Attempting to restore your live match in Room {room.code}. Your seat is reserved for 45 seconds.
            </p>
          </div>
          <LoadingIndicator label="Reconnecting..." sublabel="Syncing move state" />
          <div className="space-y-2.5">
            <AppButton
              fullWidth
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                onNotify('Reconnected', 'Live match resumed');
                onNavigate('online_board');
              }}
            >
              Retry &amp; Return to Match
            </AppButton>
            <AppButton fullWidth variant="outline" onClick={() => onNavigate('online_lobby')}>
              Leave to Lobby
            </AppButton>
          </div>
        </AppCard>
      </div>
    );
  }

  /* 26. Match Invitation Screen */
  const inviter = friends[0];
  return (
    <div className="flex-1 flex flex-col justify-center p-5">
      <AppCard padding="lg" className="space-y-5 text-center">
        <div className="text-xs font-semibold text-[#8B5CF6]">Incoming Match Invitation</div>
        <div className="flex flex-col items-center gap-2.5">
          <PlayerAvatar avatarId={inviter.avatarId} name={inviter.username} size="xl" status="online" activeRing />
          <div>
            <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
              {inviter.username}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-mono-num">
              Level {inviter.level} · {inviter.rating} pts · {inviter.winRate}% win rate
            </p>
          </div>
        </div>

        <AppCard padding="sm" className="text-xs text-[var(--text-secondary)] space-y-1">
          <div className="font-semibold text-[var(--text-primary)]">Friendly Ranked Duel</div>
          <div>5x5 Board · 4 in a row · 30s turn clock</div>
        </AppCard>

        <div className="grid grid-cols-2 gap-2.5">
          <AppButton variant="outline" onClick={() => onNavigate('friends')}>
            Decline
          </AppButton>
          <AppButton
            onClick={() => {
              onNotify('Invitation Accepted', `Joining ${inviter.username}'s match`);
              onNavigate('online_board');
            }}
          >
            Accept
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
};
