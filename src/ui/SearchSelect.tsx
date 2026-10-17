import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Typography } from './Typography';
import { theme } from './theme';

export interface SelectItem<T = any> {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  data?: T;
}

export interface SearchSelectProps<T = any> {
  items: SelectItem<T>[];
  selectedId?: string;
  onSelect: (item: SelectItem<T>) => void;
  placeholder?: string;
  filterChips?: { id: string; label: string }[];
  activeFilterId?: string;
  onFilterChange?: (filterId: string) => void;
  emptyText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SearchSelect<T = any>({
  items,
  selectedId,
  onSelect,
  placeholder = 'Search...',
  filterChips,
  activeFilterId,
  onFilterChange,
  emptyText = 'No items found',
  containerStyle,
}: SearchSelectProps<T>) {
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(lower))
    );
  }, [items, query]);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Typography variant="bodyMd" color={theme.colors.textSecondary} style={{ marginRight: 6 }}>
          🔍
        </Typography>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textDisabled}
          clearButtonMode="while-editing"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Typography variant="labelSm" color={theme.colors.textSecondary}>
              ✕
            </Typography>
          </Pressable>
        ) : null}
      </View>

      {/* Filter Chips */}
      {filterChips && filterChips.length > 0 ? (
        <View style={styles.chipRow}>
          {filterChips.map((chip) => {
            const isActive = chip.id === activeFilterId;
            return (
              <Pressable
                key={chip.id}
                onPress={() => onFilterChange?.(chip.id)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Typography
                  variant="labelSm"
                  color={isActive ? theme.colors.actionOnPrimary : theme.colors.textSecondary}
                >
                  {chip.label}
                </Typography>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Typography variant="bodyMd" color={theme.colors.textSecondary}>
              {emptyText}
            </Typography>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId;
          return (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.itemRow,
                isSelected && styles.itemRowSelected,
                pressed && styles.itemRowPressed,
              ]}
            >
              <View style={styles.itemContent}>
                <Typography
                  variant="bodyMd"
                  weight={isSelected ? '600' : '400'}
                  color={theme.colors.textPrimary}
                >
                  {item.title}
                </Typography>
                {item.subtitle ? (
                  <Typography variant="bodySm" color={theme.colors.textSecondary}>
                    {item.subtitle}
                  </Typography>
                ) : null}
              </View>

              {item.badge ? (
                <View
                  style={[
                    styles.badge,
                    item.badgeColor ? { backgroundColor: item.badgeColor } : null,
                  ]}
                >
                  <Typography variant="labelSm" color="#FFFFFF">
                    {item.badge}
                  </Typography>
                </View>
              ) : null}

              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.md,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  chipActive: {
    backgroundColor: theme.colors.actionPrimary,
    borderColor: theme.colors.actionPrimary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.sm,
  },
  itemRowSelected: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  itemRowPressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  itemContent: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  radioCircleSelected: {
    borderColor: theme.colors.actionPrimary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.actionPrimary,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
});
