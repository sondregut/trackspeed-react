import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryStore } from '../../src/store/historyStore';

function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color="#007AFF" style={styles.statIcon} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessions = useHistoryStore((state) => state.sessions);

  // Calculate stats
  const totalSessions = sessions.length;
  const photoFinishSessions = sessions.filter(s => s.mode === 'photo-finish').length;
  const multiPhoneSessions = sessions.filter(s => s.mode === 'multi-phone').length;

  // Get best time (lowest elapsed time)
  const bestTime = sessions.reduce((best, session) => {
    const elapsed = session.stats?.elapsedTime || Infinity;
    return elapsed < best ? elapsed : best;
  }, Infinity);

  const bestTimeStr = bestTime === Infinity ? '--' : `${bestTime.toFixed(2)}s`;

  // Get average time
  const validTimes = sessions
    .map(s => s.stats?.elapsedTime)
    .filter((t): t is number => t !== undefined && t > 0);
  const avgTime = validTimes.length > 0
    ? (validTimes.reduce((a, b) => a + b, 0) / validTimes.length).toFixed(2)
    : '--';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Settings */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#666" />
          </View>
          <Text style={styles.userName}>Athlete</Text>
          <Text style={styles.userSubtitle}>Sprint Timer MVP</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard value={String(totalSessions)} label="Total Runs" icon="fitness" />
            <StatCard value={bestTimeStr} label="Best Time" icon="trophy" />
            <StatCard value={avgTime === '--' ? '--' : `${avgTime}s`} label="Avg Time" icon="timer" />
            <StatCard value={String(photoFinishSessions)} label="Photo Finish" icon="camera" />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="timer-outline" size={48} color="#333" />
              <Text style={styles.emptyTitle}>No runs yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete your first timed run to see stats here
              </Text>
            </View>
          ) : (
            <View style={styles.recentList}>
              {sessions.slice(0, 5).map((session, index) => (
                <View key={session.id || index} style={styles.recentItem}>
                  <View style={styles.recentIcon}>
                    <Ionicons
                      name={session.mode === 'photo-finish' ? 'camera' : 'phone-portrait'}
                      size={18}
                      color="#007AFF"
                    />
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTime}>
                      {session.stats?.elapsedTime?.toFixed(3) || '--'}s
                    </Text>
                    <Text style={styles.recentDate}>
                      {new Date(session.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.recentMode}>
                    {session.mode === 'photo-finish' ? 'Photo' : 'Multi'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/history')}
          >
            <Ionicons name="list" size={20} color="#fff" />
            <Text style={styles.actionText}>View All History</Text>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '700',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  userSubtitle: {
    color: '#666',
    fontSize: 15,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsSection: {
    marginBottom: 28,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  activitySection: {
    marginBottom: 28,
  },
  emptyState: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#888',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
  },
  recentList: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,122,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentTime: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  recentDate: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  recentMode: {
    color: '#555',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  actionText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
