import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { SELECTABLE_AVATARS, findAvatar, toServerAvatar } from '../../constants/avatars';
import { fonts, type } from '../../design-system/typography';
import { useMe, useUpdateProfile } from '../../hooks/queries';
import { useBackGuard } from '../../hooks/useBackGuard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { UpdateMeInput } from '../../services/api/userApi';
import { toast } from '../../store/toastStore';
import { usernameError } from '../auth/authValidation';

import { fs, ms } from '../../design-system/responsive';
const BIO_MAX = 160;

export const EditProfileScreen: React.FC<RootScreenProps<'edit_profile'>> = () => {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const isTall = height >= 780;
  const { back } = useAppNav();
  const me = useMe().data;
  const update = useUpdateProfile();

  const initial = useMemo(
    () => ({
      displayName: me?.displayName ?? '',
      username: me?.username ?? '',
      bio: me?.bio ?? '',
      avatar: findAvatar(me?.avatar).id,
    }),
    [me?.displayName, me?.username, me?.bio, me?.avatar],
  );

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState(initial.avatar);
  const [serverErr, setServerErr] = useState<{ username?: string; form?: string }>({});

  const changes = useMemo(() => {
    const patch: UpdateMeInput = {};
    if (displayName.trim() !== initial.displayName) patch.displayName = displayName.trim();
    if (username.trim() !== initial.username) patch.username = username.trim();
    if (bio.trim() !== initial.bio) patch.bio = bio.trim();
    if (avatar !== initial.avatar) patch.avatar = toServerAvatar(avatar);
    return patch;
  }, [displayName, username, bio, avatar, initial]);

  const dirty = Object.keys(changes).length > 0;
  const nameErr = displayName.trim().length < 1 ? 'Display name is required' : displayName.trim().length > 40 ? 'Display name can be at most 40 characters' : null;
  const userErr = usernameError(username) ?? serverErr.username ?? null;
  const bioErr = bio.length > BIO_MAX ? `Bio can be at most ${BIO_MAX} characters` : null;
  const valid = !nameErr && !usernameError(username) && !bioErr;

  const guard = useBackGuard({ when: dirty && !update.isPending, title: 'Discard changes?', message: 'You have unsaved changes to your profile.', confirmLabel: 'Discard' });

  const save = async () => {
    if (!dirty || !valid || update.isPending) return;
    setServerErr({});
    try {
      await update.mutateAsync(changes);
      toast.success('Profile Updated', 'Your changes are saved');
      guard.allow();
      back();
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'USERNAME_TAKEN') setServerErr({ username: 'That username is taken. Pick another one.' });
      else setServerErr({ form: friendlyMessage(err) });
    }
  };

  if (!me) {
    return (
      <Screen title="Edit Profile" onBack={back}>
        <AppLoader label="Loading profile..." />
      </Screen>
    );
  }

  return (
    <>
    <Screen
      title="Edit Profile"
      onBack={back}
      testID="edit-profile-screen"
      scroll={false}
      padded={false}
      footer={
        <View style={styles.footer}>
          <AppButton
            testID="profile-save"
            title="Save Changes"
            fullWidth
            loading={update.isPending}
            disabled={!dirty || !valid}
            onPress={() => void save()}
          />
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { gap: isTall ? 18 : 14, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Choose Avatar 6-grid */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>CHOOSE AVATAR</Text>
          <View style={styles.avatarGrid}>
            {SELECTABLE_AVATARS.map((av) => {
              const active = avatar === av.id;
              return (
                <Pressy
                  key={av.id}
                  testID={`avatar-${av.id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Avatar ${av.label}${active ? ', selected' : ''}`}
                  onPress={() => setAvatar(av.id)}
                  style={[
                    styles.avatarCell,
                    {
                      backgroundColor: av.colors[0],
                      borderColor: active ? c.accent : c.border,
                      borderWidth: active ? 2 : 1,
                    },
                    active && {
                      shadowColor: c.accent,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3,
                      elevation: 2,
                    },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: c.onAccent }]}>{av.initials}</Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        {/* Profile Inputs */}
        <AppCard style={{ gap: 14 }}>
          <AppInput
            testID="edit-display-name"
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            error={displayName !== initial.displayName ? nameErr : null}
            maxLength={40}
            placeholder="Your name"
          />

          <AppInput
            testID="edit-username"
            label="Username"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              setServerErr((e) => ({ ...e, username: undefined }));
            }}
            error={username !== initial.username || serverErr.username ? userErr : null}
            hint="3-20 letters, numbers or underscores"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="@username"
          />

          <View style={{ gap: 6 }}>
            <AppInput
              testID="edit-bio"
              label="Bio"
              value={bio}
              onChangeText={setBio}
              error={bioErr}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholder="Tell people about you"
              style={{ minHeight: ms(84) }}
            />
            <Text
              testID="bio-counter"
              style={[
                type.caption,
                { color: bio.length > BIO_MAX ? c.danger : c.textSecondary, textAlign: 'right' },
              ]}
            >
              {bio.length}/{BIO_MAX}
            </Text>
          </View>
        </AppCard>

        {serverErr.form ? (
          <Text testID="edit-error" accessibilityRole="alert" style={[type.small, { color: c.danger }]}>
            {serverErr.form}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
    <ConfirmDialog {...guard.dialog} />
    </>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionLabel: {
    fontSize: fs(10.5),
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  avatarGrid: {
    flexDirection: 'row',
    gap: ms(6),
  },
  avatarCell: {
    flex: 1,
    height: ms(44),
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fs(11.5),
    fontFamily: fonts.mono.semibold,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
});
