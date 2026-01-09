import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

interface TimingMode {
  id: string;
  title: string;
  subtitle: string;
  available: boolean;
  route?: string;
}

const TIMING_MODES: TimingMode[] = [
  {
    id: 'photo-finish',
    title: 'Photo Finish',
    subtitle: '240fps camera detection',
    available: true,
    route: '/photo-finish',
  },
  {
    id: 'multi-phone',
    title: 'Multi-Phone',
    subtitle: 'Two phones, synced timing',
    available: true,
    route: '/race',
  },
  {
    id: 'sound-start',
    title: 'Sound Start',
    subtitle: 'Audio trigger detection',
    available: false,
  },
  {
    id: 'flying-start',
    title: 'Flying Start',
    subtitle: 'Time from gate crossing',
    available: false,
  },
];

function ModeCard({ mode, onPress }: { mode: TimingMode; onPress: () => void }) {
  const isGlassAvailable = isLiquidGlassAvailable();

  const cardContent = (
    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, !mode.available && styles.cardTitleDisabled]}>
        {mode.title}
      </Text>
      <Text style={[styles.cardSubtitle, !mode.available && styles.cardSubtitleDisabled]}>
        {mode.subtitle}
      </Text>
      {!mode.available && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      )}
    </View>
  );

  // Use GlassView on iOS 26+, fallback to regular View otherwise
  if (Platform.OS === 'ios' && isGlassAvailable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!mode.available}
        activeOpacity={0.8}
      >
        <GlassView style={[styles.card, !mode.available && styles.cardDisabled]}>
          {cardContent}
        </GlassView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, styles.cardFallback, !mode.available && styles.cardDisabled]}
      onPress={onPress}
      disabled={!mode.available}
      activeOpacity={0.8}
    >
      {cardContent}
    </TouchableOpacity>
  );
}

export default function TimerModeSelection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleModePress = (mode: TimingMode) => {
    if (mode.available && mode.route) {
      router.push(mode.route as any);
    }
  };

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
        <Text style={styles.title}>Timer</Text>
        <Text style={styles.subtitle}>Select a timing mode</Text>

        <View style={styles.modesGrid}>
          {TIMING_MODES.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              onPress={() => handleModePress(mode)}
            />
          ))}
        </View>
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
  modesGrid: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    padding: 18,
  },
  cardFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardContent: {
    gap: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cardTitleDisabled: {
    color: '#666',
  },
  cardSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  cardSubtitleDisabled: {
    color: '#555',
  },
  comingSoonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  comingSoonText: {
    color: '#FF9500',
    fontSize: 11,
    fontWeight: '600',
  },
});
