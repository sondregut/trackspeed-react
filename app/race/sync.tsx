import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRace } from '../../src/race/RaceContext';

export default function RaceSync() {
  const { role, syncStatus, state, startSync, disconnect } = useRace();
  const [syncStarted, setSyncStarted] = useState(false);

  // Auto-start sync when screen loads
  useEffect(() => {
    if (!syncStarted) {
      setSyncStarted(true);
      startSync();
    }
  }, [syncStarted, startSync]);

  // Navigate to session when sync is ready
  useEffect(() => {
    if (state === 'ready') {
      router.replace('/race/session');
    }
  }, [state]);

  const handleBack = async () => {
    await disconnect();
    router.replace('/race');
  };

  const getQualityColor = () => {
    if (!syncStatus) return '#888';
    switch (syncStatus.quality) {
      case 'excellent':
        return '#00C853';
      case 'good':
        return '#4CAF50';
      case 'ok':
        return '#FF9800';
      case 'poor':
        return '#F44336';
      default:
        return '#888';
    }
  };

  const getQualityLabel = () => {
    if (!syncStatus) return 'Syncing...';
    switch (syncStatus.quality) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'ok':
        return 'OK';
      case 'poor':
        return 'Poor';
      default:
        return 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Clock Sync</Text>
        <Text style={styles.subtitle}>
          Synchronizing clocks between devices
        </Text>

        <View style={styles.syncCard}>
          <View style={styles.syncIconContainer}>
            {!syncStatus?.isReady ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={getQualityColor()}
              />
            )}
          </View>

          {syncStatus && (
            <>
              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>Uncertainty</Text>
                <Text
                  style={[styles.syncValue, { color: getQualityColor() }]}
                >
                  {syncStatus.uncertaintyMs.toFixed(1)} ms
                </Text>
              </View>

              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>Quality</Text>
                <Text
                  style={[styles.syncValue, { color: getQualityColor() }]}
                >
                  {getQualityLabel()}
                </Text>
              </View>

              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>Samples</Text>
                <Text style={styles.syncValue}>{syncStatus.sampleCount}</Text>
              </View>
            </>
          )}

          {!syncStatus && (
            <Text style={styles.syncingText}>
              Collecting sync samples...
            </Text>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Lower uncertainty means more accurate timing. For best results,
            keep both phones connected to the same WiFi network.
          </Text>
        </View>

        <View style={styles.roleIndicator}>
          <Ionicons
            name={role === 'start' ? 'flag' : 'checkered-flag'}
            size={24}
            color={role === 'start' ? '#00C853' : '#FF9500'}
          />
          <Text style={styles.roleText}>
            {role === 'start' ? 'Start Phone' : 'Finish Phone'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    marginBottom: 32,
  },
  syncCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  syncIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  syncLabel: {
    color: '#888',
    fontSize: 16,
  },
  syncValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Menlo',
  },
  syncingText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  roleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
