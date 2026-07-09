import React from 'react';
import { Image, ImageStyle } from 'react-native';

interface ProfileEarthIconProps {
  size?: number;
  style?: ImageStyle;
}

/**
 * ProfileEarthIcon — Earth illustration shown on the Home points banner.
 *
 * Originally a 3.1MB inline base64 PNG embedded in an SVG, which caused
 * Expo Go to choke when evaluating the bundle after sign-in. Now loaded
 * as a normal image asset via require().
 */
export const ProfileEarthIcon = ({ size = 184, style }: ProfileEarthIconProps) => (
  <Image
    source={require('../../../assets/images/profile-earth.png')}
    style={[{ width: size, height: size / 2, resizeMode: 'contain' }, style]}
  />
);
