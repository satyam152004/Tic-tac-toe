import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Globe, KeyRound, PlusSquare, Users, Wifi, WifiOff } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameModeCard } from '../../components/profile/Cards';
import { type } from '../../design-system/typography';
import { useFriends } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { gameApi } from '../../services/api/gameApi';
import type { BoardSize } from '../../services/api/types';
import { useAuthStore } from '../../store/authStore';
import { BoardSizePicker, useSocketStatus } from './shared';

export const OnlineLobbyScreen: React.FC<RootScreenProps<'online_lobby'>> = () => {
  const c = useTheme();
  const { nav, goTab, back } = useAppNav();
  const authOffline = useAuthStore((s) => s.offline);
  const status = useSocketStatus();
  const [size, setSize] = useState<BoardSize>(3);
  const friends = useFriends();
  const active = useQuery({ queryKey: ['games', 'active'], queryFn: gameApi.active, enabled: !authOffline, staleTime: 5000 });

  const offline = authOffline || status === 'closed';
  const onlineFriends = (friends.data?.items ?? []).filter((f) => f.user.online).length;
  const unfinished = (active.data ?? []).find((g) => g.status === 'IN_PROGRESS' || g.status === 'READY' || g.status === 'WAITING');

  const resume = () => {
    if (!unfinished) return;
    if (status === 'reconnecting') nav.navigate('reconnection', { gameId: unfinished.id });
    else nav.navigate('online_board', { gameId: unfinished.id });
  };

  return (
    <Screen
      title="Online Lobby"
      subtitle={offline ? 'Offline' : status === 'ready' ? 'Connected' : 'Connecting...'}
      onBack={back}
      rightAction={
        <View style={styles.pill} accessibilityLabel={status === 'ready' ? 'Connected' : 'Not connected'}>
          {status === 'ready' ? <Wifi size={16} color={c.success} /> : <WifiOff size={16} color={c.warning} />}
        </View>
      }
    >
      {offline ? (
        <ErrorState offline message="Online play needs an internet connection. You can still play offline." retryLabel="Play Offline" onRetry={() => goTab('PlayTab')} />
      ) : (
        <>
          {unfinished ? (
            <AppCard selected onPress={resume} testID="resume-game" accessibilityLabel="Resume your unfinished game">
              <Text style={[type.subheading, { color: c.text }]}>You have a game in progress</Text>
              <Text style={[type.small, { color: c.textSecondary }]}>
                {unfinished.boardSize}x{unfinished.boardSize} · {unfinished.status === 'IN_PROGRESS' ? 'Tap to return to your match' : 'Waiting to start'}
              </Text>
            </AppCard>
          ) : null}

          <Text style={[type.smallStrong, { color: c.textSecondary }]}>Quick Match board size</Text>
          <BoardSizePicker value={size} onChange={setSize} />
          <GameModeCard
            testID="quick-match"
            title="Quick Match"
            description="Instant skill-based matchmaking worldwide"
            metaText={`Ranked · ${size}x${size}`}
            icon={<Globe size={24} color="#FFFFFF" />}
            featured
            onPress={() => nav.navigate('matchmaking', { boardSize: size })}
          />
          <GameModeCard
            testID="create-room"
            title="Create Private Room"
            description="Host a custom grid and share your invite code"
            metaText="3x3, 4x4 or 5x5"
            icon={<PlusSquare size={24} color={c.accent} />}
            onPress={() => nav.navigate('create_room')}
          />
          <GameModeCard
            testID="join-room"
            title="Join Room"
            description="Enter a 6-character room code from a friend"
            metaText="Direct invite entry"
            icon={<KeyRound size={24} color={c.accent} />}
            onPress={() => nav.navigate('join_room')}
          />
          <GameModeCard
            testID="play-friends"
            title="Play with Friends"
            description="Challenge friends directly from your roster"
            metaText={`${onlineFriends} friends online`}
            icon={<Users size={24} color={c.accent} />}
            onPress={() => goTab('FriendsTab')}
          />
          {active.isError ? <AppButton title="Retry loading active game" variant="ghost" size="md" onPress={() => void active.refetch()} /> : null}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({ pill: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' } });
