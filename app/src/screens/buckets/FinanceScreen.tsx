import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { apiRequest } from '../../services/api';
import { router } from 'expo-router';

export function FinanceScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem } = useDashboard();
  const transactions = bucketItems['finance'] || [];
  
  useEffect(() => {
    const hasCachedData = transactions.length > 0;
    fetchBucketItems('finance', hasCachedData);
  }, []);

  const handleToggleSettle = async (itemId: string) => {
    try {
      await apiRequest(`/api/v1/finance/${itemId}/settle`, 'PATCH');
      fetchBucketItems('finance');
    } catch (e) {
      console.error(e);
    }
  };

  // Group transactions by month (YYYY-MM)
  const groupedByMonth: Record<string, any[]> = {};
  transactions.forEach((tx) => {
    const date = new Date(tx.created_at);
    if (isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groupedByMonth[monthKey]) {
      groupedByMonth[monthKey] = [];
    }
    groupedByMonth[monthKey].push(tx);
  });

  const sortedMonths = Object.keys(groupedByMonth).sort().reverse();

  const formatMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💸 Finance</Text>
      </View>

      {isLoading && transactions.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : sortedMonths.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No entries.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {sortedMonths.map((monthKey) => {
            const monthTxs = groupedByMonth[monthKey];
            
            // Sort txs within month by date descending
            const sortedTxs = [...monthTxs].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            return (
              <View key={monthKey} style={styles.monthGroup}>
                <Text style={styles.monthHeading}>{formatMonthName(monthKey)}</Text>
                <View style={styles.transactionList}>
                  {sortedTxs.map((tx) => {
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={styles.txInfo}>
                          <Text style={styles.txDate}>
                            {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </Text>
                          <View style={styles.txContent}>
                            <InlineEditText
                              value={tx.description}
                              onChange={(newDesc) => updateBucketItem('finance', tx.id, { description: newDesc, amount: tx.amount })}
                              style={styles.txDesc}
                              placeholder="Description"
                            />
                            <Text style={styles.txAmountDisplay}>
                              ₹{tx.amount}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
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
  monthGroup: {
    marginBottom: 24,
  },
  monthHeading: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
    paddingLeft: 4,
  },
  transactionList: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
  },
  txRow: {
    minHeight: 60, // Fitts's Law
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  txInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  txDate: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 4,
  },
  txContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  txDesc: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
    marginRight: 8,
  },
  txAmountDisplay: {
    fontSize: 15,
    color: '#22c55e',
    fontWeight: '600',
  },
});
