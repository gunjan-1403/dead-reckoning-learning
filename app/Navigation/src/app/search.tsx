import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useNavContext } from '@/context/NavigationContext';
import {
  searchPlaces,
  getPlaceDetails,
  reverseGeocode,
  type PlacePrediction,
} from '@/utils/api';

export default function SearchScreen() {
  const { field } = useLocalSearchParams<{ field: 'origin' | 'destination' }>();
  const insets = useSafeAreaInsets();
  const { setOrigin, setDestination } = useNavContext();

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLoc, setUserLoc] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<any>(null);

  const isOrigin = field === 'origin';

  // Get user location for proximity biasing in searches
  useEffect(() => {
    (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setUserLoc({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          });
        }
      } catch {}
    })();
  }, []);

  // Auto-focus the input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  // Debounced search
  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.length < 2) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const res = await searchPlaces(text, userLoc);
        setPredictions(res.predictions || []);
        setLoading(false);
      }, 300);
    },
    [userLoc]
  );

  // Handle selecting a place from predictions
  const handleSelectPlace = async (prediction: PlacePrediction) => {
    Keyboard.dismiss();
    setLoading(true);
    const location = await getPlaceDetails(prediction.place_id);
    setLoading(false);

    if (location) {
      if (isOrigin) {
        setOrigin(location);
      } else {
        setDestination(location);
      }
      router.back();
    }
  };

  // Handle "Use current location"
  const handleCurrentLocation = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addr = await reverseGeocode(
        loc.coords.latitude,
        loc.coords.longitude
      );
      const point = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: addr,
      };
      if (isOrigin) {
        setOrigin(point);
      } else {
        setDestination(point);
      }
      router.back();
    } catch (err) {
      console.warn('Current location error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.inputContainer}>
          <View
            style={[
              styles.fieldDot,
              { backgroundColor: isOrigin ? colors.primary : colors.error },
            ]}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={
              isOrigin ? 'Enter starting point' : 'Enter destination'
            }
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleSearch}
            selectionColor={colors.primary}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                setPredictions([]);
              }}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Current location option */}
      <Pressable
        style={({ pressed }) => [
          styles.currentLocRow,
          pressed && styles.rowPressed,
        ]}
        onPress={handleCurrentLocation}>
        <View style={styles.currentLocIcon}>
          <Text style={styles.currentLocIconText}>◎</Text>
        </View>
        <View>
          <Text style={styles.currentLocTitle}>Use current location</Text>
          <Text style={styles.currentLocSub}>GPS • Your current position</Text>
        </View>
      </Pressable>

      <View style={styles.divider} />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={predictions}
        keyExtractor={(item) => item.place_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.resultRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => handleSelectPlace(item)}>
            <View style={styles.resultIcon}>
              <Text style={styles.resultIconText}>📍</Text>
            </View>
            <View style={styles.resultTextContainer}>
              <Text style={styles.resultMain} numberOfLines={1}>
                {item.structured_formatting?.main_text || item.description}
              </Text>
              {item.structured_formatting?.secondary_text ? (
                <Text style={styles.resultSecondary} numberOfLines={1}>
                  {item.structured_formatting.secondary_text}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>
                Try a different search term
              </Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrow: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  fieldDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  clearIcon: {
    color: colors.textMuted,
    fontSize: 16,
    padding: 4,
  },

  /* Current location */
  currentLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  currentLocIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocIconText: {
    color: colors.primary,
    fontSize: 20,
  },
  currentLocTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  currentLocSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },

  /* Loading */
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  /* Results */
  listContent: {
    paddingBottom: 40,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIconText: {
    fontSize: 18,
  },
  resultTextContainer: {
    flex: 1,
    gap: 2,
  },
  resultMain: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  resultSecondary: {
    color: colors.textMuted,
    fontSize: 13,
  },

  /* Empty state */
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
