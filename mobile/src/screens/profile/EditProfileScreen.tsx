import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { SELECTABLE_AVATARS, findAvatar, toServerAvatar } from '../../constants/avatars';
import { type } from '../../design-system/typography';
import { useMe, useUpdateProfile } from '../../hooks/queries';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { UpdateMeInput } from '../../services/api/userApi';
import { toast } from '../../store/toastStore';
import { usernameError } from '../auth/authValidation';

const BIO_MAX = 160;

export const EditProfileScreen: React.FC<RootScreenProps<'edit_profile'>> = () => {
  const c = useTheme();
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
      toast.success('Profile Updated', 'Your changes have been saved');
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
    <Screen
      title="Edit Profile"
      onBack={back}
      testID="edit-profile-screen"
      footer={<AppButton testID="profile-save" title="Save Changes" fullWidth loading={update.isPending} disabled={!dirty || !valid} onPress={() => void save()} />}
    >
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <AppAvatar avatarId={avatar} name={displayName} size="xl" activeRing />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SELECTABLE_AVATARS.map((av) => (
            <Pressy
              key={av.id}
              testID={`avatar-${av.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: avatar === av.id }}
              accessibilityLabel={`Avatar ${av.label}`}
              onPress={() => setAvatar(av.id)}
              style={{ padding: 2, borderRadius: 16, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppAvatar avatarId={av.id} size="sm" activeRing={avatar === av.id} />
            </Pressy>
          ))}
        </View>
      </View>

      <AppCard style={{ gap: 12 }}>
        <AppInput testID="edit-display-name" label="Display Name" value={displayName} onChangeText={setDisplayName} error={displayName !== initial.displayName ? nameErr : null} maxLength={60} />
        <AppInput
          testID="edit-username"
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            setServerErr((e) => ({ ...e, username: undefined }));
          }}
          error={username !== initial.username || serverErr.username ? userErr : null}
          hint="3-20 characters: letters, numbers, underscore"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ gap: 6 }}>
          <AppInput
            testID="edit-bio"
            label="Player Bio"
            value={bio}
            onChangeText={setBio}
            error={bioErr}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 70 }}
          />
          <Text testID="bio-counter" style={[type.caption, { color: bio.length > BIO_MAX ? c.danger : c.textSecondary, textAlign: 'right' }]}>
            {bio.length}/{BIO_MAX}
          </Text>
        </View>
      </AppCard>

      {serverErr.form ? (
        <Text testID="edit-error" accessibilityRole="alert" style={[type.small, { color: c.danger }]}>
          {serverErr.form}
        </Text>
      ) : null}
    </Screen>
  );
};
