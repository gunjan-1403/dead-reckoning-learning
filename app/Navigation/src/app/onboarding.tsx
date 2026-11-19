import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PhotoCollage } from '@/components/onboarding/PhotoCollage';
import { onboarding } from '@/constants/onboardingTheme';
import { setOnboardingComplete } from '@/utils/onboardingStorage';

const BACK_SIZE = 48;

function BackArrowIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 5.5L9 12l6.5 6.5"
        stroke={onboarding.backArrow}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Page = {
  key: string;
  title: string;
  body: string;
  variant: 'explore' | 'navigate';
  cta: string;
};

const PAGES: Page[] = [
  {
    key: 'explore',
    title: 'Travel and Share\nmoments with us',
    body: 'Share the moments that matter, connect with others, and turn every journey.',
    variant: 'explore',
    cta: 'Next',
  },
  {
    key: 'navigate',
    title: 'Stay on course,\neven when GPS fades',
    body: 'NavGo guides every trip with live maps — and keeps estimating your path when the signal drops.',
    variant: 'navigate',
    cta: 'Get Started',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(next);
  };

  const goBack = () => {
    if (index <= 0) return;
    listRef.current?.scrollToIndex({ index: index - 1, animated: true });
    setIndex(index - 1);
  };

  const goNext = async () => {
    if (index < PAGES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      await setOnboardingComplete();
    } finally {
      // Always enter the app — never get stuck on a storage failure.
      router.replace('/');
      setBusy(false);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Page>) => (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      {/* Images sit in the exact center of the upper screen area */}
      <View style={styles.hero}>
        <PhotoCollage variant={item.variant} />
      </View>

      <View style={styles.bottomBlock}>
        <View style={styles.copy}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      </View>
    </View>
  );

  const page = PAGES[index];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={[
          onboarding.gradientTop,
          onboarding.gradientMid,
          onboarding.gradientBottom,
        ]}
        locations={[0, 0.45, 1]}
        style={styles.gradient}
      />

      <View style={{ flex: 1, paddingTop: insets.top + 12 }}>
        <FlatList
          ref={listRef}
          data={PAGES}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
        />

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 20) + 4 },
          ]}>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              disabled={index === 0}
              style={({ pressed }) => [
                styles.backBtn,
                index === 0 && styles.backBtnHidden,
                pressed && index > 0 && styles.pressed,
              ]}>
              <BackArrowIcon />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void goNext();
              }}
              disabled={busy}
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.pressed,
                busy && styles.ctaDisabled,
              ]}>
              <Text style={styles.ctaText}>{page.cta}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: onboarding.gradientBottom,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBlock: {
    paddingBottom: 8,
  },
  copy: {
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 24,
  },
  title: {
    color: onboarding.heading,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'left',
  },
  body: {
    color: onboarding.body,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
    textAlign: 'left',
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  backBtn: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    backgroundColor: onboarding.white,
    borderWidth: 1.5,
    borderColor: onboarding.backBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnHidden: {
    opacity: 0,
  },
  cta: {
    width: 158,
    height: 52,
    borderRadius: 26,
    backgroundColor: onboarding.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    shadowColor: onboarding.orangeDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: onboarding.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
