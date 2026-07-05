import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { InlineEditText } from '../../components/shared/InlineEditText';
import { apiRequest } from '../../services/api';
import { router } from 'expo-router';

const CATEGORIES = [
  { key: 'food', name: 'Food', icon: '🍔' },
  { key: 'groceries', name: 'Groceries', icon: '🛒' },
  { key: 'transport', name: 'Transport', icon: '🚗' },
  { key: 'shopping', name: 'Shopping', icon: '🛍️' },
  { key: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { key: 'health', name: 'Health', icon: '❤️' },
  { key: 'pay', name: 'Pay (Owe)', icon: '💸' },
  { key: 'receive', name: 'Receive', icon: '💰' },
  { key: 'others', name: 'Others', icon: '📦' }
];

export function FinanceScreen() {
  const { bucketItems, isLoading, fetchBucketItems, updateBucketItem } = useDashboard();
  const transactions = bucketItems['finance'] || [];
  
  const [selectedFilter, setSelectedFilter] = useState<{ month: string; category: string } | null>(null);

  useEffect(() => {
    fetchBucketItems('finance');
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

  // Helper to calculate totals for a list of transactions
  const calculateTotalSpend = (txs: any[]) => {
    let sum = 0;
    txs.forEach((tx) => {
      const cat = tx.category.toLowerCase();
      const amt = Number(tx.amount || 0);
      
      if (cat === 'receive') {
        // Receive settlements NOT counted
        return;
      } else if (cat === 'pay') {
        // Pay bucket: Settled = money left pocket = ADDED to total spend
        if (tx.is_settled) {
          sum += amt;
        }
      } else {
        // General expenses always counted
        sum += amt;
      }
    });
    return sum;
  };

  const formatMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  };

  // Level 2 Category Detail View
  if (selectedFilter) {
    const { month, category } = selectedFilter;
    const monthTxs = groupedByMonth[month] || [];
    const filteredTxs = monthTxs.filter(tx => tx.category.toLowerCase() === category);
    const categoryInfo = CATEGORIES.find(c => c.key === category);

    return (
      <SafeAreaView style={styles.safeContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedFilter(null)}>
            <Text style={styles.backText}>◀ Overview</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {categoryInfo?.icon} {categoryInfo?.name} — {formatMonthName(month)}
          </Text>
        </View>

        {filteredTxs.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No entries for this category.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.transactionList}>
              {filteredTxs.map((tx) => {
                const isDebt = tx.category === 'pay' || tx.category === 'receive';
                return (
                  <View key={tx.id} style={styles.txRow}>
                    {/* Checkbox for Pay/Receive debt settlement */}
                    {isDebt && (
                      <TouchableOpacity 
                        style={[
                          styles.checkbox,
                          tx.is_settled && styles.checkboxChecked
                        ]}
                        onPress={() => handleToggleSettle(tx.id)}
                      >
                        {tx.is_settled && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    )}
                    
                    {/* Details input */}
                    <View style={styles.txInfo}>
                      <InlineEditText
                        value={tx.description}
                        onChange={(newDesc) => updateBucketItem('finance', tx.id, { description: newDesc, amount: tx.amount, category: tx.category })}
                        style={[
                          styles.txDesc,
                          tx.is_settled && styles.txCompletedText
                        ]}
                        placeholder="Description"
                      />
                      <Text style={styles.txDate}>
                        {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    {/* Amount Input */}
                    <View style={styles.amountContainer}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <InlineEditText
                        value={String(tx.amount)}
                        onChange={(newAmt) => updateBucketItem('finance', tx.id, { description: tx.description, amount: Number(newAmt) || 0, category: tx.category })}
                        style={styles.txAmount}
                        placeholder="0"
                      />
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

  // Level 1 Monthly List View
  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💰 Finance</Text>
      </View>

      {isLoading && transactions.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No financial logs yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {sortedMonths.map((monthKey) => {
            const monthTxs = groupedByMonth[monthKey] || [];
            const totalSpend = calculateTotalSpend(monthTxs);
            
            return (
              <View key={monthKey} style={styles.monthCard}>
                {/* Month Total Spend Summary */}
                <View style={styles.monthHeader}>
                  <Text style={styles.monthName}>{formatMonthName(monthKey)}</Text>
                  <View style={styles.totalBadge}>
                    <Text style={styles.totalBadgeLabel}>Total Spent</Text>
                    <Text style={styles.totalBadgeValue}>₹{totalSpend}</Text>
                  </View>
                </View>

                {/* Categories Grid for this Month */}
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const catTxs = monthTxs.filter(tx => tx.category.toLowerCase() === cat.key);
                    const catTotal = catTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
                    
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={styles.categoryCard}
                        onPress={() => setSelectedFilter({ month: monthKey, category: cat.key })}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.catIcon}>{cat.icon}</Text>
                        <Text style={styles.catName}>{cat.name}</Text>
                        <Text style={styles.catAmount}>₹{catTotal}</Text>
                      </TouchableOpacity>
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
    gap: 20,
  },
  monthCard: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 12,
  },
  monthName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  totalBadge: {
    alignItems: 'flex-end',
  },
  totalBadgeLabel: {
    fontFamily: 'System',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  totalBadgeValue: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '800',
    color: '#22c55e',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryCard: {
    width: '33.33% - 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    alignItems: 'center',
    margin: 4,
    flexGrow: 1,
    minWidth: 90,
  },
  catIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  catName: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    textAlign: 'center',
  },
  catAmount: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
  },
  transactionList: {
    backgroundColor: '#13131c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
  },
  txRow: {
    height: 56, // Fitts's Law: min 48px
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  checkmark: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -2,
  },
  txInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  txDesc: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  txCompletedText: {
    color: 'rgba(255, 255, 255, 0.35)',
    textDecorationLine: 'line-through',
  },
  txDate: {
    fontFamily: 'System',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '700',
    marginRight: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    width: 60,
    textAlign: 'right',
  },
});
