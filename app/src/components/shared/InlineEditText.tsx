import React, { useState, useEffect, useRef } from 'react';
import { TextInput, StyleSheet, TextStyle } from 'react-native';

interface InlineEditTextProps {
  value: string;
  onChange: (newValue: string) => void;
  style?: TextStyle;
  placeholder?: string;
  multiline?: boolean;
}

export function InlineEditText({
  value,
  onChange,
  style,
  placeholder = 'Type here...',
  multiline = false,
}: InlineEditTextProps) {
  const [text, setText] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if value changes externally
  useEffect(() => {
    setText(value);
  }, [value]);

  const handleChangeText = (newText: string) => {
    setText(newText);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      onChange(newText);
    }, 500); // 500ms debounce as per spec
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <TextInput
      value={text}
      onChangeText={handleChangeText}
      style={[styles.input, style]}
      placeholder={placeholder}
      placeholderTextColor="rgba(255, 255, 255, 0.3)"
      multiline={multiline}
      scrollEnabled={false} // Let the outer scrollview handle scrolling
      blurOnSubmit={!multiline}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
    color: '#ffffff',
    fontFamily: 'System',
  },
});
