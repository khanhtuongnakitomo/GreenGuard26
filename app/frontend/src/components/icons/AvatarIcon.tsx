import React from 'react';
import { Image, ImageStyle } from 'react-native';

interface AvatarIconProps {
  size?: number;
  style?: ImageStyle;
}

/**
 * AvatarIcon — User avatar illustration.
 *
 * Originally a 41KB inline base64 PNG embedded in an SVG, which inflated
 * the JS bundle and contributed to evaluation errors in Expo Go. Now
 * loaded as a normal image asset via require().
 */
export const AvatarIcon = ({ size = 48, style }: AvatarIconProps) => (
  <Image
    source={require('../../../assets/images/avatar.png')}
    style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
  />
);
