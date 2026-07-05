import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface UseVoiceInputResult {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  isSupported: boolean;
}

export function useVoiceInput(onResult?: (text: string) => void): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const isSupported = Platform.OS === 'web' && 
    (typeof window !== 'undefined' && 
     ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));

  useEffect(() => {
    if (isSupported) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-IN'; // Indian English default, perfect for urban Indian professionals!

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setTranscript(currentText);
        if (onResult && finalTranscript) {
          onResult(finalTranscript);
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        setTranscript('');
        recognitionRef.current.start();
      } catch (e) {
        console.error('Failed to start speech recognition', e);
      }
    } else {
      // Mock/simulate voice input on simulator/native for demonstration
      setIsListening(true);
      let count = 0;
      const demoPhrases = [
        "Spent 450 rupees on groceries and buy milk tomorrow morning",
        "Had a great idea for a hostel mess food quality tracking app",
        "Slept only 4 hours last night feeling very tired today",
        "Need to complete the report by Friday afternoon at 3pm"
      ];
      const randomPhrase = demoPhrases[Math.floor(Math.random() * demoPhrases.length)];
      
      const interval = setInterval(() => {
        count++;
        const words = randomPhrase.split(' ');
        const partial = words.slice(0, Math.ceil((words.length * count) / 5)).join(' ');
        setTranscript(partial);
        
        if (count >= 5) {
          clearInterval(interval);
          setIsListening(false);
          if (onResult) onResult(randomPhrase);
        }
      }, 500);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      setIsListening(false);
    }
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    isSupported: !!recognitionRef.current || Platform.OS !== 'web'
  };
}
