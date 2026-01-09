import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function RaceRoleSelect() {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Multi-Phone Race</Text>
        <Text style={styles.subtitle}>
          Use two phones for start and finish line timing
        </Text>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Each phone detects crossings locally. Clock sync ensures accurate
            split times across devices.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Select Your Role</Text>

        <TouchableOpacity
          style={styles.roleButton}
          onPress={() =>
            router.push({ pathname: '/race/pair', params: { role: 'start' } })
          }
        >
          <View style={styles.roleIcon}>
            <Ionicons name="flag" size={32} color="#00C853" />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>Start Phone</Text>
            <Text style={styles.roleDescription}>
              Place at start line. Triggers timer when athlete crosses.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roleButton}
          onPress={() =>
            router.push({ pathname: '/race/pair', params: { role: 'finish' } })
          }
        >
          <View style={styles.roleIcon}>
            <Ionicons name="trophy" size={32} color="#FF9500" />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>Finish Phone</Text>
            <Text style={styles.roleDescription}>
              Place at finish line. Records final time when athlete crosses.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
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
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleDescription: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
});
