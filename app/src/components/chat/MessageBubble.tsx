import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BucketTag } from './BucketTag';
import { ChatMessage } from '../../store/chatStore';

interface MessageBubbleProps {
  message: ChatMessage;
  onTapTag?: (bucketKey: string, itemIdx: number) => void;
}

export function MessageBubble({ message, onTapTag }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.assistantContainer
    ]}>
      {/* 1. Bucket tags rendered ABOVE assistant bubble */}
      {!isUser && message.bucket_tags && message.bucket_tags.length > 0 && (
        <View style={styles.tagsRow}>
          {message.bucket_tags.map((tag, idx) => {
            // Extract bucket key from tag text (e.g. "✅ Tasks" -> "tasks")
            const bucketNamesMap: Record<string, string> = {
              "Tasks": "tasks",
              "Ideas": "ideas",
              "Journal": "journals",
              "Finance": "finance",
              "Health": "health",
              "Watchlist": "watchlist",
              "Others": "others"
            };
            const labelWithoutIcon = tag.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
            const bucketKey = bucketNamesMap[labelWithoutIcon] || "others";
            
            return (
              <BucketTag 
                key={idx} 
                label={tag} 
                onPress={onTapTag ? () => onTapTag(bucketKey, idx) : undefined}
              />
            );
          })}
        </View>
      )}
      
      {/* 2. Message Bubble itself */}
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble
      ]}>
        <Text style={[
          styles.text,
          isUser ? styles.userText : styles.assistantText
        ]}>
          {message.content}
        </Text>
      </View>
      
      {/* 3. Small timestamp */}
      <Text style={styles.timestamp}>
        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    maxWidth: '80%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#8b5cf6', // Premium Purple
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: '#1c1c24', // Modern Dark Bubble
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  text: {
    fontFamily: 'System',
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#e4e4e7',
  },
  timestamp: {
    fontFamily: 'System',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 4,
    marginHorizontal: 4,
  },
});
