import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useHistoryStore } from '../../src/store/historyStore';
import type { TimingSession } from '../../src/types';

function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return `${seconds.toFixed(3)}s`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (isYesterday) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'photo-finish':
      return 'Photo-Finish';
    case 'sound-start':
      return 'Sound Start';
    case 'flying-start':
      return 'Flying Start';
    case 'multi-gate':
      return 'Multi-Gate';
    default:
      return mode;
  }
}

function SessionCard({ session, onPress }: { session: TimingSession; onPress: () => void }) {
  const isGlassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const content = (
    <>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTime}>{formatTime(session.stats.elapsedSeconds)}</Text>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{getModeLabel(session.mode)}</Text>
        </View>
      </View>
      <View style={styles.cardDetails}>
        <Text style={styles.cardDate}>{formatDate(session.timestamp)}</Text>
        <Text style={styles.cardStats}>
          {session.stats.actualFps.toFixed(0)} FPS | {session.stats.frameDrops} drops
        </Text>
      </View>
      {session.stats.compositePath && (
        <Image
          source={{ uri: `file://${session.stats.compositePath}` }}
          style={styles.cardThumbnail}
          resizeMode="cover"
        />
      )}
    </>
  );

  if (isGlassAvailable) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <GlassView style={styles.card}>
          {content}
        </GlassView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, styles.cardFallback]} onPress={onPress} activeOpacity={0.8}>
      {content}
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessions = useHistoryStore((state) => state.sessions);

  const handleSessionPress = (session: TimingSession) => {
    router.push(`/session/${session.id}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {sessions.length === 0
            ? 'No sessions yet'
            : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>stopwatch</Text>
          <Text style={styles.emptyTitle}>No Sessions Yet</Text>
          <Text style={styles.emptyText}>
            Complete a timing session and save it to see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionCard session={item} onPress={() => handleSessionPress(item)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  cardFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTime: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modeBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeBadgeText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardDate: {
    color: '#888',
    fontSize: 14,
  },
  cardStats: {
    color: '#666',
    fontSize: 13,
  },
  cardThumbnail: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#333',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
