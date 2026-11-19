/**
 * NavGo travel theme — soft teal surfaces, white cards, orange accents.
 * Matches the explore / itinerary design language.
 */
export const colors = {
  // Page / map chrome
  background: '#E8F4F2',
  backgroundSoft: '#F3FAF8',
  surface: '#FFFFFF',
  surfaceElevated: '#F7FBFA',
  surfaceMint: '#D9EFEC',
  card: '#FFFFFF',

  // Brand
  primary: '#FF9F43',
  primaryDark: '#F08A2E',
  primaryLight: '#FFB56B',
  primaryGlow: 'rgba(255, 159, 67, 0.16)',

  // Teal ink
  teal: '#1B3A4B',
  tealSoft: '#2F5A68',
  tealMuted: '#6B8A90',

  // Text
  text: '#1B3A4B',
  textSecondary: '#6B8A90',
  textMuted: '#9AAAB0',
  textOnPrimary: '#FFFFFF',

  // UI
  border: '#E3EEEC',
  borderStrong: '#D0E0DD',
  error: '#E85D5D',
  errorDark: '#C94444',
  success: '#2BB673',
  overlay: 'rgba(27, 58, 75, 0.35)',
  inputBg: '#FFFFFF',
  white: '#FFFFFF',
  black: '#0D1B22',
  transparent: 'transparent',

  // Route
  route: '#FF9F43',
  routeSoft: 'rgba(255, 159, 67, 0.28)',
  routeTraveled: 'rgba(107, 138, 144, 0.45)',
  originDot: '#2BB673',
  destDot: '#FF9F43',
} as const;

// Fix typo if I left one - textMuted had a space issue
