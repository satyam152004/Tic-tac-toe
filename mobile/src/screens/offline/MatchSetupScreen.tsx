import React, { useState } from 'react';
import { BoardSize, Difficulty, defaultWinLength } from '../../game-engine';
import { AI_LEVELS, FirstMove, Mark, MarkChoice, MatchSetupView } from '../../components/game/MatchSetupView';
import { useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { Popup } from '../../components/common/Popup';
import { ProtoInput } from '../auth/protoUi';
import { createRoomWithOptions } from '../online/shared';
import { friendlyMessage } from '../../services/api/errors';
import { joinErrorMessage } from '../online/JoinRoomScreen';
import { joinRoomByCode } from '../../services/onlineActions';
import { type } from '../../design-system/typography';
import { ms } from '../../design-system/responsive';
import { ActionButton } from '../../components/game/ActionButton';
import { StyleSheet, Text, View } from 'react-native';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { gameApi } from '../../services/api/gameApi';
import type { EntryAmount, FirstMovePref } from '../../services/api/types';
import { socialError } from '../social/socialShared';
import { useAuthStore } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';

const MAX_NAME = 20;

const ONLINE_FIRST_MOVE_OPTIONS: { id: FirstMovePref; label: string }[] = [
  { id: 'ME', label: 'Me' },
  { id: 'OPPONENT', label: 'Opponent' },
  { id: 'RANDOM', label: 'Random' },
];

export function validateNames(p1: string, p2: string | null): { p1?: string; p2?: string } {
  const errors: { p1?: string; p2?: string } = {};
  const a = p1.trim();
  if (a.length < 1) errors.p1 = 'Enter a name for Player 1';
  else if (a.length > MAX_NAME) errors.p1 = `Use ${MAX_NAME} characters or fewer`;
  if (p2 !== null) {
    const b = p2.trim();
    if (b.length < 1) errors.p2 = 'Enter a name for Player 2';
    else if (b.length > MAX_NAME) errors.p2 = `Use ${MAX_NAME} characters or fewer`;
    else if (!errors.p1 && a.toLowerCase() === b.toLowerCase()) errors.p2 = 'Players need different names';
  }
  return errors;
}

const opposite = (m: Mark): Mark => (m === 'X' ? 'O' : 'X');

/**
 * One setup screen for every match type. The route's `mode` decides the content:
 *  - VS_AI:    computer opponent (difficulty, your mark, coin balance). Starts on `offline_board`.
 *  - LOCAL_2P: pass n play (two names, your mark, who goes first). Starts on `offline_board`.
 *  - ONLINE:   board size and who goes first, then either a ranked search (purpose QUICK)
 *              or an invite to a friend (purpose CHALLENGE).
 * Offline modes end on the Match found screen (countdown, then the board).
 */
export const MatchSetupScreen: React.FC<RootScreenProps<'match_setup'>> = ({ route }) => {
  const params = route.params;
  const mode = params?.mode ?? 'LOCAL_2P';
  const isAi = mode === 'VS_AI';
  const isOnline = mode === 'ONLINE';
  const online = params && params.mode === 'ONLINE' ? params : null;
  const [joinOpen, setJoinOpen] = useState(false);
  const { nav, back } = useAppNav();
  const me = useMe();
  const coins = me.data?.wallet?.coins;
  const stored = useLocalGameStore.getState().setup;
  const displayName = useAuthStore.getState().user?.displayName;

  // Shared
  const [size, setSize] = useState<BoardSize>(isOnline ? 3 : stored.size);

  // Computer mode
  const [difficulty, setDifficulty] = useState<Difficulty>(stored.difficulty);
  const [choice, setChoice] = useState<MarkChoice>(stored.p1Mark);

  // Pass n play mode
  const [p1Name, setP1Name] = useState(() => (displayName ?? (stored.p1Name || 'Player 1')).slice(0, MAX_NAME));
  const [p2Name, setP2Name] = useState(stored.mode === 'LOCAL_2P' && stored.p2Name ? stored.p2Name : 'Player 2');
  const [p1Avatar] = useState(stored.p1Avatar);
  const [p2Avatar] = useState(stored.p2Avatar === stored.p1Avatar ? 'av_2' : stored.p2Avatar);
  const [p1Mark, setP1Mark] = useState<Mark>(stored.p1Mark);
  const [firstMove, setFirstMove] = useState<FirstMove>('p1');
  const [errors, setErrors] = useState<{ p1?: string; p2?: string }>({});

  // Online mode
  const [onlineFirst, setOnlineFirst] = useState<FirstMovePref>('RANDOM');
  const [onlineEntry, setOnlineEntry] = useState<EntryAmount>(0);
  const [roomTimer, setRoomTimer] = useState<0 | 15 | 30>(30);
  const [busy, setBusy] = useState(false);

  // Ranked search (QUICK) or a challenge to the friend the player came from (CHALLENGE).
  const submitOnline = async () => {
    if (!online || busy || online.purpose === 'FRIEND') return;
    if (online.purpose === 'QUICK') {
      nav.replace('matchmaking', { boardSize: size, firstMove: onlineFirst, entryAmount: onlineEntry });
      return;
    }
    setBusy(true);
    try {
      const game = await gameApi.inviteFriend({ opponentId: online.opponentId, boardSize: size, firstMove: onlineFirst, entryAmount: onlineEntry });
      useOnlineStore.getState().applyGame(game);
      toast.success('Challenge sent', `Waiting for ${online.opponentName} to join`);
      nav.replace('match_found', { gameId: game.id, source: 'FRIEND', opponentName: online.opponentName });
    } catch (e) {
      toast.error("Couldn't send the challenge", socialError(e));
      setBusy(false);
    }
  };

  // Play with friends: create a private room with these settings, then the friend joins with the code.
  const createRoomFromSetup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const room = await createRoomWithOptions(size, { isPublic: false, turnTimeoutSec: roomTimer, firstMove: onlineFirst, entryAmount: onlineEntry });
      nav.replace('waiting_room', { roomId: room.id });
    } catch (e) {
      toast.error("Couldn't create the room", friendlyMessage(e));
      setBusy(false);
    }
  };

  // Offline start: check the setup, save it to the local game, then show the Match found screen (countdown, then the board).
  const startOffline = () => {
    const store = useLocalGameStore.getState();
    if (isAi) {
      const mark: Mark = choice === 'RANDOM' ? (Math.random() < 0.5 ? 'X' : 'O') : choice;
      store.configure({ mode: 'VS_AI', difficulty, size, p1Mark: mark, winLength: undefined });
    } else {
      const found = validateNames(p1Name, p2Name);
      setErrors(found);
      if (found.p1 || found.p2) return;
      // X always moves first, so a "Player 2 first" choice swaps the marks.
      const p2First = firstMove === 'p2' || (firstMove === 'random' && Math.random() < 0.5);
      const mark: Mark = p2First ? opposite(p1Mark) : p1Mark;
      store.configure({
        mode: 'LOCAL_2P',
        size,
        winLength: defaultWinLength(size),
        p1Name: p1Name.trim(),
        p2Name: p2Name.trim(),
        p1Avatar,
        p2Avatar,
        p1Mark: mark,
        difficulty: store.setup.difficulty,
      });
    }
    nav.replace('match_found', { source: isAi ? 'COMPUTER' : 'PASS_N_PLAY' });
  };

  const title = isOnline
    ? online?.purpose === 'CHALLENGE'
      ? `Challenge ${online.opponentName}`
      : online?.purpose === 'FRIEND'
        ? 'Play with friends'
        : 'Ranked match'
    : isAi
      ? 'Play vs computer'
      : 'Pass n play';
  const footerTitle = isOnline
    ? online?.purpose === 'QUICK'
      ? 'Find match'
      : online?.purpose === 'FRIEND'
        ? 'Create room'
        : 'Send challenge'
    : isAi
      ? 'Start game'
      : 'Start Match';
  const footerTestID = online?.purpose === 'FRIEND' ? 'create-room-submit' : isOnline ? 'online-setup-continue' : isAi ? 'ai-difficulty-continue' : 'setup-start';
  const onContinue = isOnline ? (online?.purpose === 'FRIEND' ? createRoomFromSetup : submitOnline) : startOffline;

  const onlineTop =
    online?.purpose === 'QUICK' ? (
      <ActionButton testID="online-rooms-link" title="Create or join a room" variant="secondary" compact fullWidth onPress={() => nav.navigate('online_lobby')} />
    ) : null;

  return (
    <>
    <MatchSetupView
      topSlot={isOnline ? onlineTop : undefined}
      footerSecondary={online?.purpose === 'FRIEND' ? { testID: 'open-join-room', title: 'Join room', onPress: () => setJoinOpen(true) } : undefined}
      mode={mode}
      title={title}
      testID="match-setup"
      onBack={back}
      footerTitle={footerTitle}
      footerTestID={footerTestID}
      onContinue={() => void onContinue()}
      coins={isAi ? coins : undefined}
      difficulty={isAi ? difficulty : undefined}
      onDifficultyChange={isAi ? setDifficulty : undefined}
      p1Name={isAi || isOnline ? undefined : p1Name}
      onP1NameChange={isAi || isOnline ? undefined : setP1Name}
      p2Name={isAi || isOnline ? undefined : p2Name}
      onP2NameChange={isAi || isOnline ? undefined : setP2Name}
      nameErrors={isAi || isOnline ? undefined : errors}
      firstMove={isOnline ? onlineFirst : isAi ? undefined : firstMove}
      onFirstMoveChange={isOnline ? (f) => setOnlineFirst(f as FirstMovePref) : isAi ? undefined : (f) => setFirstMove(f as FirstMove)}
      firstMoveOptions={isOnline ? ONLINE_FIRST_MOVE_OPTIONS : undefined}
      entryAmount={isOnline ? onlineEntry : undefined}
      turnTimer={online?.purpose === 'FRIEND' ? roomTimer : undefined}
      onTurnTimerChange={online?.purpose === 'FRIEND' ? setRoomTimer : undefined}
      onEntryAmountChange={isOnline ? setOnlineEntry : undefined}
      size={size}
      onSizeChange={setSize}
      markChoice={isAi ? choice : p1Mark}
      onMarkChoiceChange={(m) => {
        if (isAi) setChoice(m);
        else if (m !== 'RANDOM') setP1Mark(m);
      }}
    />
    <JoinCodePopup open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
};

/** Popup on the setup screen where a friend's room code is typed. Joining goes to the Waiting Room. */
const JoinCodePopup: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { nav } = useAppNav();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError('Enter the 6 character room code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinRoomByCode(clean);
      setBusy(false);
      setCode('');
      onClose();
      nav.replace('waiting_room', { roomId: room.id });
    } catch (e) {
      setError(joinErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Popup open={open} layout="center" title="Join a room" message="Ask your friend for the 6 character code." onDismiss={onClose} testID="join-code-popup">
      <ProtoInput
        testID="room-code-input"
        label="Room code"
        value={code}
        onChangeText={(v) => {
          setCode(v.toUpperCase());
          setError(null);
        }}
        placeholder="ABC123"
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        error={error ?? undefined}
      />
      <ActionButton testID="join-room-submit" title="Join room" fullWidth loading={busy} onPress={join} />
    </Popup>
  );
};
