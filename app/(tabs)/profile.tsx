import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Constants from 'expo-constants';
import { useHistoryStore } from '../../src/store/historyStore';

interface SettingRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
}

function SettingRow({ label, value, onPress, isDestructive, showChevron }: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, isDestructive && styles.settingLabelDestructive]}>
        {label}
      </Text>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {showChevron && <Text style={styles.chevron}>chevron.right</Text>}
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

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const isGlassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (isGlassAvailable) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <GlassView style={styles.sectionContent}>
          {children}
        </GlassView>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionContent, styles.sectionContentFallback]}>
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const sessionsCount = useHistoryStore((state) => state.sessions.length);

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Settings & Preferences</Text>

        {/* Detection Settings */}
        <SettingsSection title="Detection">
          <SettingRow label="Trigger Threshold" value="10%" />
          <SettingRow label="Pre-trigger Buffer" value="0.8s" />
          <SettingRow label="Post-trigger Buffer" value="0.4s" />
          <SettingRow label="Detection Band" value="20% - 90%" />
        </SettingsSection>

        {/* Camera Settings */}
        <SettingsSection title="Camera">
          <SettingRow label="Target FPS" value="240" />
          <SettingRow label="Resolution" value="1920x1080" />
        </SettingsSection>

        {/* Feedback Settings */}
        <SettingsSection title="Feedback">
          <SettingRow label="Haptic Feedback" value="Enabled" />
          <SettingRow label="Sound Feedback" value="Enabled" />
          <SettingRow label="Flash on Trigger" value="Enabled" />
        </SettingsSection>

        {/* This Device (Future) */}
        <SettingsSection title="This Device">
          <SettingRow label="Device Name" value="My iPhone" />
          <SettingRow label="Role" value="Standalone" />
          <View style={styles.comingSoonBanner}>
            <Text style={styles.comingSoonText}>
              Multi-phone support coming soon. Connect multiple devices as timing gates.
            </Text>
          </View>
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Data">
          <SettingRow label="Sessions Saved" value={String(sessionsCount)} />
          <SettingRow
            label="Clear All History"
            onPress={handleClearHistory}
            isDestructive
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingRow label="Version" value={appVersion} />
          <SettingRow label="Build" value="SDK 54" />
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 17,
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionContentFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingLabel: {
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
    fontSize: 16,
  },
  chevron: {
    color: '#666',
    fontSize: 14,
  },
  comingSoonBanner: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: 12,
    margin: 12,
    marginTop: 0,
    borderRadius: 8,
  },
  comingSoonText: {
    color: '#FF9500',
    fontSize: 13,
    lineHeight: 18,
  },
});
