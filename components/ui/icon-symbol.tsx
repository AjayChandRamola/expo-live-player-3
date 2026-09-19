// Fallback for using MaterialCommunityIcons on Android and web.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialCommunityIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Community Icons mappings here.
 * - see Material Community Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 *
 * Size guard (docs/size-optimization, C-08b): this file previously used the
 * separate MaterialIcons family, which bundled a second icon font (356,840 B)
 * purely for these eight glyphs. Every name below has an equivalent glyph in
 * MaterialCommunityIcons (already bundled for the rest of the app), so no
 * second font is needed.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code-tags',
  'chevron.right': 'chevron-right',
  'dot.radiowaves.left.and.right': 'access-point',
  'bookmark.fill': 'bookmark',
  'magnifyingglass': 'magnify',
  'gearshape.fill': 'cog',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Community
 * Icons on Android and web. This ensures a consistent look across platforms,
 * and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material
 * Community Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialCommunityIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
