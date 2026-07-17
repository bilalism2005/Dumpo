import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { BucketBottomSheet } from '../components/shared/BucketBottomSheet';
import { useChat } from '../hooks/useChat';
import { useAuthStore } from '../store/authStore';

export function ChatScreen() {
  const { messages, isLoading, sendMessage, reclassifyMessageItem } = useChat();
  const { user } = useAuthStore();
  
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedItemInfo, setSelectedItemInfo] = useState<{ msgIndex: number; itemIndex: number; currentBucket: string } | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages.length]);

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  const handleTapTag = (bucketKey: string, msgIndex: number, itemIdx: number) => {
    setSelectedItemInfo({
      msgIndex,
      itemIndex: itemIdx,
      currentBucket: bucketKey
    });
    setSheetVisible(true);
  };

  const handleSelectReclassify = (toBucket: string) => {
    if (selectedItemInfo) {
      reclassifyMessageItem(
        selectedItemInfo.msgIndex,
        selectedItemInfo.itemIndex,
        toBucket
      );
      setSelectedItemInfo(null);
    }
  };

  const userAvatar = user?.user_metadata?.avatar_url || `https://avatar.vercel.sh/${user?.email || 'dumpo'}`;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* 1. Custom WhatsApp-Style Header */}
        <View style={styles.header}>
          <Image 
            source={{ uri: 'https://avatar.vercel.sh/dumpo.png' }} 
            style={styles.avatar} 
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Dumpo</Text>
            <Text style={styles.headerStatus}>AI Assistant</Text>
          </View>
        </View>

        {/* 2. Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageBubble 
              message={item} 
              onTapTag={() => handleTapTag(item.items?.[0]?.primary_bucket || "others", index, 0)}
            />
          )}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color="#a855f7" size="small" />
              <Text style={styles.loaderText}>Dumpo is processing...</Text>
            </View>
          ) : null}
        />

        {/* 3. Input Bar */}
        <ChatInput onSend={handleSend} disabled={isLoading} />

        {/* 4. Bottom Sheet Modal */}
        <BucketBottomSheet
          isVisible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onSelectBucket={handleSelectReclassify}
          currentBucket={selectedItemInfo?.currentBucket}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121218',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
  },
  headerInfo: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerStatus: {
    fontFamily: 'System',
    fontSize: 11,
    color: '#a855f7',
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 6,
    gap: 8,
  },
  loaderText: {
    fontFamily: 'System',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
