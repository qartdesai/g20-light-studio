'use strict';
const fs = require('fs');
const path = require('path');
const {validate} = require('../apps/qart_lightstudio/src/engine.js');
const file = require.resolve('../apps/qart_lightstudio/src/packs.js');
try {
    const pack = validate(JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8')));
    const packs = require(file).filter(p => p.name !== pack.name).concat(pack);
    fs.writeFileSync(file + '.tmp', "'use strict';\nmodule.exports = " + JSON.stringify(packs, null, 2) + ';\n');
    fs.renameSync(file + '.tmp', file);
    console.log('Добавлена сцена: ' + pack.name);
} catch (err) {
    console.error(err.message);
    process.exitCode = 1;
}
