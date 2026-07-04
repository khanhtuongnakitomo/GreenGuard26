const fs = require('fs');
let file = fs.readFileSync('f:/WEBAPP/GreenGuard26/app/frontend/src/components/icons/AvatarIcon.tsx', 'utf8');
file = file.replace(/xlink:href/g, 'xlinkHref');
file = file.replace(/<image /g, '<Image ');
file = file.replace(/<\/image>/g, '</Image>');
file = file.replace(/<use /g, '<Use ');
file = file.replace(/<\/use>/g, '</Use>');
file = file.replace(
  "import Svg, { Path, G, Defs, ClipPath, Rect, Circle, Ellipse, Line, Polyline, Polygon } from 'react-native-svg';", 
  "import Svg, { Path, G, Defs, ClipPath, Rect, Circle, Ellipse, Line, Polyline, Polygon, Image, Use } from 'react-native-svg';"
);
fs.writeFileSync('f:/WEBAPP/GreenGuard26/app/frontend/src/components/icons/AvatarIcon.tsx', file);
