import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const PaperIcon = ({ size = 24, color = '#459E41' }) => (
  <Svg width={size} height={size} viewBox="0 0 38 38" fill="none">
    <Path d="M27.3208 29.4588L16.928 32.823L18.5731 18.025L28.9833 14.5048L27.3208 29.4588Z" fill={color}/>
    <Path d="M16.0539 32.7258L8.03075 27.8516L9.60645 13.678L13.8629 11.2119L17.6955 17.9591L16.0539 32.7258Z" fill={color}/>
    <Path d="M28.7197 13.7485L18.313 17.2375L14.463 10.6465L24.6824 7.42112L28.7197 13.7485Z" fill={color}/>
    <Path d="M24.6061 6.68571L14.4562 9.85561L14.6332 8.26343L24.7727 5.18718L24.6061 6.68571Z" fill={color}/>
  </Svg>
);
