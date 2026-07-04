const fs = require('fs');
let svg = fs.readFileSync('f:/WEBAPP/GreenGuard26/app/frontend/assets/BKI LOGO/profile earth.svg', 'utf8');

// Basic replacements for React Native SVG
svg = svg.replace(/<svg.*?>/, '<Svg width={size} height={size / 2} viewBox="0 0 184 92" fill="none">');
svg = svg.replace(/xmlns=".*?"/g, '');
svg = svg.replace(/fill-opacity/g, 'fillOpacity');
svg = svg.replace(/stroke-width/g, 'strokeWidth');
svg = svg.replace(/stroke-linecap/g, 'strokeLinecap');
svg = svg.replace(/stroke-linejoin/g, 'strokeLinejoin');
svg = svg.replace(/stroke-miterlimit/g, 'strokeMiterlimit');
svg = svg.replace(/clip-path/g, 'clipPath');
svg = svg.replace(/clip-rule/g, 'clipRule');
svg = svg.replace(/fill-rule/g, 'fillRule');
svg = svg.replace(/xmlns:xlink/g, 'xmlnsXlink');
svg = svg.replace(/xlink:href/g, 'href');

const outPath = 'f:/WEBAPP/GreenGuard26/app/frontend/src/components/icons/ProfileEarthIcon.tsx';

let component = `import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect, Circle, Ellipse, Line, Polyline, Polygon, Image, Use, Pattern } from 'react-native-svg';

export const ProfileEarthIcon = ({ size = 184 }) => (
  ${svg}
);
`;

fs.writeFileSync(outPath, component);
console.log('Done creating ProfileEarthIcon.tsx');
