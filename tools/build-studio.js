'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const segments = require('../apps/qart_lightstudio/src/segments.js');
const core = read('apps/qart_lightstudio/src/engine.js').replace("require('./segments.js')", () => JSON.stringify(segments).replace(/</g,'\\u003c'));
const packs = require('../apps/qart_lightstudio/src/packs.js');
const script = 'const LightStudio = (function(){const module={exports:{}};\n' + core +
    '\nreturn module.exports;})();\nconst bundledPacks=' + JSON.stringify(packs).replace(/</g,'\\u003c') + ';\n' +
    read('studio/music.js') + '\n' + read('studio/browser.js');
fs.writeFileSync(path.join(root,'G20-Light-Studio.html'), read('studio/page.html')
    .replace('<!--SCRIPTS-->', () => '<script>\n'+script+'\n</script>'));
