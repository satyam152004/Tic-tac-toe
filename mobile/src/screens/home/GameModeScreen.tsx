import React from 'react';
import { BookOpen, Bot, Globe, UserCheck, Users } from 'lucide-react-native';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Screen } from '../../components/common/Screen';
import { GameModeCard } from '../../components/profile/Cards';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

export const GameModeScreen: React.FC = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const offline = useAuthStore((s) => s.offline);

  const online = (go: () => void) => () => {
    if (offline) {
      toast.warning('You are offline', 'Connect to the internet to play online or with friends.');
      return;
    }
    go();
  };

  return (
    <Screen
      tabs
      title="Select Game Mode"
      onBack={back}
      testID="game-mode-screen"
      rightAction={<AppIconButton label="Game rules" onPress={() => nav.navigate('game_rules')} icon={<BookOpen size={20} color={c.textSecondary} />} />}
    >
      <GameModeCard testID="mode-ai" title="Offline: Player vs AI" description="Challenge adaptive bots from Easy to Impossible" metaText="Single-player · No internet needed" icon={<Bot size={24} color="#FFFFFF" />} featured onPress={() => nav.navigate('ai_difficulty')} />
      <GameModeCard testID="mode-local" title="Offline: Pass & Play" description="Two players on one device with custom names" metaText="Local 2P · 3x3, 4x4 & 5x5 boards" icon={<Users size={24} color={c.text} />} onPress={() => nav.navigate('player_setup', { mode: 'LOCAL_2P' })} />
      <GameModeCard testID="mode-online" title="Online Game" description="Random matchmaking against global players" metaText="Real-time · Earn rating" icon={<Globe size={24} color={c.text} />} onPress={online(() => nav.navigate('online_lobby'))} />
      <GameModeCard testID="mode-friends" title="Play with Friends" description="Create a private room code and invite friends" metaText="Custom board size · Instant invite" icon={<UserCheck size={24} color={c.text} />} onPress={online(() => nav.navigate('create_room'))} />
    </Screen>
  );
};
