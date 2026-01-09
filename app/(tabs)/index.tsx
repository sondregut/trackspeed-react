import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

interface TimingMode {
  id: string;
  title: string;
  description: string;
  icon: string;
  available: boolean;
  route?: string;
}

const TIMING_MODES: TimingMode[] = [
  {
    id: 'photo-finish',
    title: 'Photo-Finish',
    description: 'High-speed camera detection at 240fps. Place your phone at the finish line.',
    icon: 'camera.viewfinder',
    available: true,
    route: '/photo-finish',
  },
  {
    id: 'multi-phone',
    title: 'Multi-Phone Race',
    description: 'Use two phones for start and finish line timing with clock sync.',
    icon: 'antenna.radiowaves.left.and.right',
    available: true,
    route: '/race',
  },
  {
    id: 'sound-start',
    title: 'Sound Start',
    description: 'Detect starting gun or clap sound to trigger timing.',
    icon: 'waveform',
    available: false,
  },
  {
    id: 'flying-start',
    title: 'Flying Start',
    description: 'Time from when the runner crosses the start gate at speed.',
    icon: 'figure.run',
    available: false,
  },
];

function ModeCard({ mode, onPress }: { mode: TimingMode; onPress: () => void }) {
  const isGlassAvailable = isLiquidGlassAvailable();

  const cardContent = (
    <>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{mode.icon}</Text>
        <Text style={[styles.cardTitle, !mode.available && styles.cardTitleDisabled]}>
          {mode.title}
        </Text>
        {!mode.available && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Soon</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardDescription, !mode.available && styles.cardDescriptionDisabled]}>
        {mode.description}
      </Text>
    </>
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
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    minHeight: 120,
  },
  cardFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  cardIcon: {
    fontSize: 20,
    color: '#007AFF',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  cardTitleDisabled: {
    color: '#888',
  },
  cardDescription: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 22,
  },
  cardDescriptionDisabled: {
    color: '#666',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
  },
});
