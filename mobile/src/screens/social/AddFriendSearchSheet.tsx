import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppInput } from '../../components/common/AppInput';
import { AppModal } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { fonts, type } from '../../design-system/typography';
import { useFriendActions } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { userApi } from '../../services/api/userApi';
import { toast } from '../../store/toastStore';
import { socialError } from './socialShared';

export interface AddFriendSearchSheetProps {
  open: boolean;
  onClose: () => void;
}

export const AddFriendSearchSheet: React.FC<AddFriendSearchSheetProps> = ({ open, onClose }) => {
  const c = useTheme();
  const actions = useFriendActions();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().replace(/^@/, '')), 350);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery({
    queryKey: ['users', 'search', debounced],
    queryFn: () => userApi.search(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });
  const results = debounced.length >= 2 ? (search.data?.items ?? []) : [];

  const sendInvite = async (userId: string, name: string) => {
    try {
      await actions.request.mutateAsync({ userId });
      setSentMap((s) => ({ ...s, [userId]: true }));
      toast.success('Friend request sent', `Invited ${name}`);
    } catch (e) {
      toast.error('Could not send request', socialError(e));
    }
  };

  return (
    <AppModal open={open} title="Add Friend" onClose={onClose}>
      <View style={{ gap: 14 }}>
        <AppInput
          testID="add-friend-search-input"
          label=""
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username..."
          autoCapitalize="none"
          autoCorrect={false}
          labelRight={
            debounced.length >= 2 && !search.isFetching ? (
              <Text style={[styles.matchCount, { color: c.accent }]}>
                {results.length} {results.length === 1 ? 'match' : 'matches'}
              </Text>
            ) : search.isFetching ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : null
          }
        />

        <View style={[styles.resultsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {results.length === 0 ? (
            <Text style={[styles.meta, { color: c.textSecondary, padding: 14, textAlign: 'center' }]}>
              {debounced.length < 2
                ? 'Type at least 2 characters to search'
                : search.isError
                  ? 'Search failed. Check your connection and try again.'
                  : search.isFetching
                    ? 'Searching…'
                    : 'No players found'}
            </Text>
          ) : null}
          {results.map((r, i) => {
            const sent = !!sentMap[r.id];
            return (
              <View
                key={r.id}
                style={[
                  styles.resultRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatar, { backgroundColor: '#F1F1EE' }]}>
                    <Text style={[styles.avatarText, { color: c.text }]}>{r.displayName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={[styles.name, { color: c.text }]}>{r.displayName}</Text>
                    <Text style={[styles.meta, { color: c.textSecondary }]}>@{r.username} • Lv {r.level}</Text>
                  </View>
                </View>

                <Pressy
                  testID={`send-invite-${r.id}`}
                  onPress={() => sendInvite(r.id, r.displayName)}
                  style={[
                    styles.inviteBtn,
                    { backgroundColor: sent ? '#F0FDF4' : c.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.inviteBtnText,
                      { color: sent ? '#15803D' : '#FFFFFF' },
                    ]}
                  >
                    {sent ? 'Sent ✓' : 'Add'}
                  </Text>
                </Pressy>
              </View>
            );
          })}
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  matchCount: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
  },
  resultsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
  name: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  meta: {
    fontSize: 10,
    fontFamily: fonts.mono.medium,
    marginTop: 1,
  },
  inviteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  inviteBtnText: {
    fontSize: 11,
    fontFamily: fonts.body.semibold,
  },
});
