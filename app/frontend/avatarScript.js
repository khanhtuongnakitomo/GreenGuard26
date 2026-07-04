const fs = require('fs');
let svg = fs.readFileSync('f:/WEBAPP/GreenGuard26/app/frontend/assets/BKI LOGO/avatar.svg', 'utf8');
svg = svg.replace(/<svg.*?>/, '<Svg width={size} height={size} viewBox="0 0 100 100" fill="none">');
svg = svg.replace(/<\/svg>/, '</Svg>');
svg = svg.replace(/fill-opacity/g, 'fillOpacity');
svg = svg.replace(/clip-path/g, 'clipPath');
svg = svg.replace(/clip-rule/g, 'clipRule');
svg = svg.replace(/fill-rule/g, 'fillRule');
svg = svg.replace(/stroke-width/g, 'strokeWidth');
svg = svg.replace(/stroke-linecap/g, 'strokeLinecap');
svg = svg.replace(/stroke-linejoin/g, 'strokeLinejoin');
svg = svg.replace(/stroke-miterlimit/g, 'strokeMiterlimit');

const component = `import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect, Circle, Ellipse, Line, Polyline, Polygon } from 'react-native-svg';

export const AvatarIcon = ({ size = 48 }) => (
  ${svg}
);`;

fs.writeFileSync('f:/WEBAPP/GreenGuard26/app/frontend/src/components/icons/AvatarIcon.tsx', component);
