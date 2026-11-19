import { Image, StyleSheet, Text, View } from 'react-native';
import { onboarding } from '@/constants/onboardingTheme';
import { ONBOARDING_IMAGES } from '@/constants/onboardingImages';

type Variant = 'explore' | 'navigate';

const CONTENT: Record<
  Variant,
  {
    tag: string;
    left: number;
    right: number;
    center: number;
  }
> = {
  explore: {
    tag: 'Tekergat, Sunamgnj',
    left: ONBOARDING_IMAGES.colosseum,
    right: ONBOARDING_IMAGES.mountains,
    center: ONBOARDING_IMAGES.beach,
  },
  navigate: {
    tag: 'Agra, India',
    left: ONBOARDING_IMAGES.indiaJaipur,
    right: ONBOARDING_IMAGES.indiaMumbai,
    center: ONBOARDING_IMAGES.indiaTaj,
  },
};

/** Three overlapping photo cards — local Image for instant paint. */
export function PhotoCollage({ variant = 'explore' }: { variant?: Variant }) {
  const photos = CONTENT[variant];

  return (
    <View style={styles.stage}>
      <View style={[styles.card, styles.leftCard]}>
        <Image source={photos.left} style={styles.image} resizeMode="cover" />
      </View>

      <View style={[styles.card, styles.rightCard]}>
        <Image source={photos.right} style={styles.image} resizeMode="cover" />
      </View>

      <View style={[styles.card, styles.centerCard]}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{photos.tag}</Text>
        </View>
        <Image source={photos.center} style={styles.image} resizeMode="cover" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 390,
    height: 440,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  card: {
    position: 'absolute',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: onboarding.white,
    borderWidth: 5,
    borderColor: onboarding.white,
    shadowColor: onboarding.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  leftCard: {
    width: 186,
    height: 260,
    left: '50%',
    marginLeft: -218,
    top: 48,
    transform: [{ rotate: '-12deg' }],
    zIndex: 1,
  },
  rightCard: {
    width: 186,
    height: 260,
    left: '50%',
    marginLeft: 32,
    top: 48,
    transform: [{ rotate: '12deg' }],
    zIndex: 1,
  },
  centerCard: {
    width: 200,
    height: 260,
    left: '50%',
    marginLeft: -100,
    top: 118,
    zIndex: 3,
    transform: [{ rotate: '-2deg' }],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  tag: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 4,
    backgroundColor: onboarding.white,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  tagText: {
    color: onboarding.tagText,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
