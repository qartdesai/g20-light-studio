'use strict';
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'profiles', 'g20-318-2021.json');
const profile = JSON.parse(fs.readFileSync(src, 'utf8'));
const seen = new Set();
const result = [];
for (const part of profile.assemblies) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(part.id) || seen.has(part.id) ||
        !['front','rear','side'].includes(part.zone) || typeof part.label !== 'string' ||
        !part.label.trim() || !Number.isInteger(part.segments) || part.segments < 0 || part.segments > 128 ||
        !Number.isFinite(part.x) || !Number.isFinite(part.y)) throw Error('Проверь сборку: ' + part.id);
    seen.add(part.id);
    for (let i = 0; i < part.segments; i++) {
        const cols = Math.min(6, part.segments);
        result.push({id:'seg_' + part.id + '_' + (i+1), label:part.label + ' · ' + (i+1),
            zone:part.zone, segment:true, x:part.x + ((i%cols) - (cols-1)/2)*7, y:part.y+Math.floor(i/cols)*7});
    }
}
const dest = path.join(__dirname,'..','apps','qart_lightstudio','src','segments.js');
fs.writeFileSync(dest,"'use strict';\n// Generated from profiles/g20-318-2021.json.\nmodule.exports = " + JSON.stringify(result,null,2) + ';\n');
