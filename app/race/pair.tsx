import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRace } from '../../src/race/RaceContext';
import { RaceRole } from '../../src/race/transport/types';

export default function RacePair() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = roleParam as RaceRole;
  const insets = useSafeAreaInsets();

  const {
    roomCode,
    connectionState,
    partnerConnected,
    createRoom,
    joinRoom,
    disconnect,
  } = useRace();

  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigate to sync when partner connects
  useEffect(() => {
    if (partnerConnected && connectionState === 'connected') {
      router.replace('/race/sync');
    }
  }, [partnerConnected, connectionState]);

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await createRoom(role);
      setMode('create');
    } catch (e) {
      setError('Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (inputCode.length !== 6) {
      setError('Enter a 6-character code');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await joinRoom(inputCode, role);
    } catch (e) {
      setError('Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (mode !== 'select') {
      disconnect();
      setMode('select');
      setInputCode('');
      setError(null);
    } else {
      router.back();
    }
  };

  const renderSelect = () => (
    <>
      <Text style={styles.title}>
        {role === 'start' ? 'Start Phone' : 'Finish Phone'}
      </Text>
      <Text style={styles.subtitle}>How do you want to connect?</Text>

      <TouchableOpacity style={styles.optionButton} onPress={handleCreate}>
        <View style={styles.optionIcon}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Create Room</Text>
          <Text style={styles.optionDescription}>
            Generate a code for the other phone to join
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => setMode('join')}
      >
        <View style={styles.optionIcon}>
          <Ionicons name="enter" size={28} color="#00C853" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Join Room</Text>
          <Text style={styles.optionDescription}>
            Enter the code from the other phone
          </Text>
        </View>
      </TouchableOpacity>
    </>
  );

  const renderCreate = () => (
    <>
      <Text style={styles.title}>Room Created</Text>
      <Text style={styles.subtitle}>
        Share this code with the other phone
      </Text>

      <View style={styles.codeContainer}>
        <Text style={styles.codeText}>{roomCode}</Text>
      </View>

      <View style={styles.statusContainer}>
        {connectionState === 'connected' ? (
          <>
            <ActivityIndicator color="#007AFF" />
            <Text style={styles.statusText}>Waiting for partner...</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color="#888" />
            <Text style={styles.statusText}>Connecting...</Text>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );

  const renderJoin = () => (
    <>
      <Text style={styles.title}>Join Room</Text>
      <Text style={styles.subtitle}>Enter the 6-character code</Text>

      <TextInput
        style={styles.codeInput}
        value={inputCode}
        onChangeText={(text) => setInputCode(text.toUpperCase())}
        placeholder="XXXXXX"
        placeholderTextColor="#555"
        autoCapitalize="characters"
        maxLength={6}
      />

      <TouchableOpacity
        style={[
          styles.joinButton,
          inputCode.length !== 6 && styles.joinButtonDisabled,
        ]}
        onPress={handleJoin}
        disabled={inputCode.length !== 6 || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.joinButtonText}>Join</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {mode === 'select' && renderSelect()}
          {mode === 'create' && renderCreate()}
          {mode === 'join' && renderJoin()}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
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
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    color: '#888',
    fontSize: 14,
  },
  codeContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  codeText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 8,
    fontFamily: 'Menlo',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusText: {
    color: '#888',
    fontSize: 16,
  },
  codeInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 8,
    fontFamily: 'Menlo',
    marginBottom: 24,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#333',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff6666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    color: '#ff6666',
    fontSize: 16,
    fontWeight: '500',
  },
});
