import { useState, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { API_URL } from '../config';
import { useAuthStore } from '../store/authStore';

interface UseVoiceInputResult {
  isListening: boolean;
  isTranscribing: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
}

export function useVoiceInput(onResult?: (text: string) => void): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startListening = async () => {
    try {
      if (Platform.OS === 'web') {
        alert('Voice recording is designed for native mobile devices.');
        return;
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission is required to record audio dumps.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    if (!recordingRef.current || !isListening) return;

    try {
      setIsListening(false);
      setIsTranscribing(true);

      const recording = recordingRef.current;
      recordingRef.current = null;

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      if (!uri) {
        setIsTranscribing(false);
        return;
      }

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'audio.m4a';

      // @ts-ignore React Native FormData payload
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: filename,
        type: 'audio/m4a',
      });

      const session = useAuthStore.getState().session;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_URL}/api/v1/transcribe`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.text && onResult) {
        onResult(data.text);
      }
    } catch (err) {
      console.error('Speech transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  return {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
  };
}
