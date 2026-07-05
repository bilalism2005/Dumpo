import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { apiRequest } from '../../services/api';
import { router } from 'expo-router';

const GENRES = [
  { key: 'action', name: 'Action', icon: '💥' },
  { key: 'thriller', name: 'Thriller', icon: '🕵️‍♂️' },
  { key: 'comedy', name: 'Comedy', icon: '😂' },
  { key: 'horror', name: 'Horror', icon: '👻' },
  { key: 'romance', name: 'Romance', icon: '❤️' },
  { key: 'others', name: 'Others', icon: '📦' }
];

export function WatchlistScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem } = useDashboard();
  const movies = bucketItems['watchlist'] || [];
  
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  useEffect(() => {
    fetchBucketItems('watchlist');
  }, []);

  const handleToggleWatched = async (itemId: string) => {
    try {
      await apiRequest(`/api/v1/watchlist/${itemId}/toggle`, 'PATCH');
      fetchBucketItems('watchlist');
    } catch (e) {
      console.error(e);
    }
  };

  // Level 2: Genre List
  if (activeGenre) {
    const filteredMovies = movies.filter(
      m => m.genre.toLowerCase() === activeGenre
    );
    const genreInfo = GENRES.find(g => g.key === activeGenre);

    // Sort: unwatched first, watched at the bottom
    const sortedMovies = [...filteredMovies].sort((a, b) => {
      if (a.is_watched === b.is_watched) return 0;
      return a.is_watched ? 1 : -1;
    });

    return (
      <SafeAreaView style={styles.safeContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setActiveGenre(null)}>
            <Text style={styles.backText}>◀ Genres</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {genreInfo?.icon} {genreInfo?.name} Watchlist
          </Text>
        </View>

        {sortedMovies.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No items in this genre yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.listContainer}>
              {sortedMovies.map((item) => {
                const details = [
                  item.year_of_launch,
                  item.language,
                  item.platform
                ].filter(Boolean).join(' · ');

                return (
                  <View key={item.id} style={styles.movieItem}>
                    {/* Checkbox (left) */}
                    <TouchableOpacity 
                      style={[
                        styles.checkbox,
                        item.is_watched && styles.checkboxChecked
                      ]}
                      onPress={() => handleToggleWatched(item.id)}
                    >
                      {item.is_watched && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>

                    {/* Movie info */}
                    <View style={styles.movieInfo}>
                      <InlineEditText
                        value={item.title}
                        onChange={(newTitle) => updateBucketItem('watchlist', item.id, { title: newTitle, genre: item.genre, is_watched: item.is_watched })}
                        style={[
                          styles.movieTitle,
                          item.is_watched && styles.movieTitleWatched
                        ]}
                        placeholder="Title"
                      />
                      {details ? (
                        <Text style={styles.movieMeta}>{details}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // Level 1: Genre Grid (2 columns, 3 rows)
  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🎬 Watchlist</Text>
      </View>

      {isLoading && movies.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.gridHeading}>Choose Genre</Text>
          
          <View style={styles.grid}>
            {GENRES.map((genre) => {
              const count = movies.filter(m => m.genre.toLowerCase() === genre.key).length;
              return (
                <TouchableOpacity
                  key={genre.key}
                  style={styles.gridCard}
                  onPress={() => setActiveGenre(genre.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.gridIcon}>{genre.icon}</Text>
                  <View style={styles.cardInfo}>
                    <Text style={styles.gridName}>{genre.name}</Text>
                    <Text style={styles.gridCount}>{count} items</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#121218',
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    fontFamily: 'System',
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'System',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 15,
  },
  scrollContent: {
    padding: 16,
  },
  gridHeading: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridCard: {
    width: '50% - 12px',
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    margin: 6,
    minHeight: 100,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gridIcon: {
    fontSize: 30,
  },
  cardInfo: {
    justifyContent: 'center',
  },
  gridName: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  gridCount: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  listContainer: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
  },
  movieItem: {
    height: 60, // Fitts's Law: min 48px
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  checkmark: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -2,
  },
  movieInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  movieTitle: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  movieTitleWatched: {
    color: 'rgba(255, 255, 255, 0.35)',
    textDecorationLine: 'line-through',
  },
  movieMeta: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 2,
  },
});
