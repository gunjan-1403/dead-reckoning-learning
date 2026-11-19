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

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

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
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>
        {isOrigin ? 'Choose start' : 'Choose destination'}
      </Text>
      <Text style={styles.subheading}>
        Search a place or use your current location.
      </Text>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.inputContainer}>
          <Text style={styles.searchIcon}>⌕</Text>
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

      <Pressable
        style={({ pressed }) => [
          styles.currentLocRow,
          pressed && styles.rowPressed,
        ]}
        onPress={handleCurrentLocation}>
        <View style={styles.currentLocIcon}>
          <Text style={styles.currentLocIconText}>◎</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.currentLocTitle}>Use current location</Text>
          <Text style={styles.currentLocSub}>GPS • Your current position</Text>
        </View>
      </Pressable>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      )}

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
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 18,
  },
  heading: {
    color: colors.teal,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrow: {
    color: colors.teal,
    fontSize: 20,
    fontWeight: '600',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    color: colors.textMuted,
    fontSize: 18,
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
  currentLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
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
    color: colors.teal,
    fontSize: 16,
    fontWeight: '700',
  },
  currentLocSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMint,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.surfaceMint,
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
    color: colors.teal,
    fontSize: 16,
    fontWeight: '600',
  },
  resultSecondary: {
    color: colors.textMuted,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
