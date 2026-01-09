import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useHistoryStore } from '../src/store/historyStore';
import { useState } from 'react';

interface SettingRowProps {
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
}

function SettingRow({
  icon,
  iconColor = '#007AFF',
  label,
  value,
  onPress,
  isDestructive,
  hasSwitch,
  switchValue,
  onSwitchChange,
}: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={[styles.settingLabel, isDestructive && styles.settingLabelDestructive]}>
        {label}
      </Text>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {hasSwitch && (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: '#333', true: '#007AFF' }}
            thumbColor="#fff"
          />
        )}
        {onPress && !hasSwitch && (
          <Ionicons name="chevron-forward" size={18} color="#666" />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function SettingsSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const sessionsCount = useHistoryStore((state) => state.sessions.length);

  // Settings state (would persist in real app)
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(true);

  const handleClearHistory = () => {
    if (sessionsCount === 0) {
      Alert.alert('No History', 'There are no sessions to clear.');
      return;
    }

    Alert.alert(
      'Clear History',
      `Are you sure you want to delete all ${sessionsCount} session${sessionsCount !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearHistory,
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Feedback Settings */}
        <SettingsSection title="Feedback">
          <SettingRow
            icon="hand-left"
            label="Haptic Feedback"
            hasSwitch
            switchValue={hapticEnabled}
            onSwitchChange={setHapticEnabled}
          />
          <SettingRow
            icon="volume-high"
            label="Sound Effects"
            hasSwitch
            switchValue={soundEnabled}
            onSwitchChange={setSoundEnabled}
          />
          <SettingRow
            icon="flash"
            iconColor="#FF9500"
            label="Flash on Trigger"
            hasSwitch
            switchValue={flashEnabled}
            onSwitchChange={setFlashEnabled}
          />
        </SettingsSection>

        {/* Detection Settings */}
        <SettingsSection title="Detection">
          <SettingRow
            icon="speedometer"
            label="Trigger Threshold"
            value="10%"
          />
          <SettingRow
            icon="timer"
            label="Pre-trigger Buffer"
            value="0.8s"
          />
          <SettingRow
            icon="resize"
            label="Detection Band"
            value="20% - 90%"
          />
        </SettingsSection>

        {/* Camera Settings */}
        <SettingsSection title="Camera">
          <SettingRow
            icon="videocam"
            label="Target FPS"
            value="240"
          />
          <SettingRow
            icon="expand"
            label="Resolution"
            value="1080p"
          />
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Data">
          <SettingRow
            icon="folder"
            iconColor="#34C759"
            label="Sessions Saved"
            value={String(sessionsCount)}
          />
          <SettingRow
            icon="trash"
            iconColor="#FF3B30"
            label="Clear All History"
            onPress={handleClearHistory}
            isDestructive
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingRow
            icon="information-circle"
            iconColor="#8E8E93"
            label="Version"
            value={appVersion}
          />
          <SettingRow
            icon="code-slash"
            iconColor="#8E8E93"
            label="Build"
            value="Expo SDK 54"
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  settingLabelDestructive: {
    color: '#FF3B30',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    color: '#888',
    fontSize: 15,
  },
});
