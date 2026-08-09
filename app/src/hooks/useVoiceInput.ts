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
  const recordingStartTimeRef = useRef<number>(0);

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
      recordingStartTimeRef.current = Date.now();
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
      
      const duration = Date.now() - recordingStartTimeRef.current;

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Avoid hallucinations from Whisper for < 1000ms silent audio bumps
      if (duration < 1000) {
        setIsTranscribing(false);
        return;
      }

      const uri = recording.getURI();
      if (!uri) {
        setIsTranscribing(false);
        return;
      }

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'audio.m4a';

      // @ts-ignore React Native FormData payload
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.startsWith('file://') ? uri : `file://${uri}`,
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
