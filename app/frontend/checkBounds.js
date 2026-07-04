const fs = require('fs');
['profile earth.svg'].forEach(file => {
  const content = fs.readFileSync('f:/WEBAPP/GreenGuard26/app/frontend/assets/BKI LOGO/' + file, 'utf8');
  const viewBox = content.match(/viewBox="(.*?)"/);
  const width = content.match(/width="(.*?)"/);
  const height = content.match(/height="(.*?)"/);
  console.log(file, 'viewBox:', viewBox?.[1], 'width:', width?.[1], 'height:', height?.[1]);
});
