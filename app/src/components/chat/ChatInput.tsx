import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useVoiceInput } from '../../hooks/useVoiceInput';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [inputText, setInputText] = useState('');
  
  const { isListening, startListening, stopListening } = useVoiceInput((result) => {
    setInputText(result);
  });

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSend(inputText);
    setInputText('');
  };

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Mic Button (Left) */}
      <TouchableOpacity 
        style={[
          styles.iconButton, 
          isListening && styles.micActiveButton
        ]} 
        onPress={handleMicPress}
        disabled={disabled}
      >
        <Text style={styles.iconText}>
          {isListening ? '🔴' : '🎤'}
        </Text>
      </TouchableOpacity>
      
      {/* 2. Text Input (Middle) */}
      <TextInput
        value={inputText}
        onChangeText={setInputText}
        placeholder={isListening ? "Listening to your thoughts..." : "What's on your mind?"}
        placeholderTextColor="rgba(255, 255, 255, 0.4)"
        style={styles.textInput}
        multiline={true}
        maxHeight={100}
        disabled={disabled}
      />
      
      {/* 3. Send Button (Right) */}
      <TouchableOpacity 
        style={[
          styles.sendButton,
          !inputText.trim() && styles.sendButtonDisabled
        ]} 
        onPress={handleSend}
        disabled={disabled || !inputText.trim()}
      >
        <Text style={styles.sendIcon}>➔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#121218',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconButton: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  micActiveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  iconText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'System',
    marginRight: 8,
    textAlignVertical: 'center',
  },
  sendButton: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: '#8b5cf6', // Premium purple accent
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sendIcon: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
  },
});
