'use strict';
const OnlineApp = require('oap-sdk/src/core/OnlineApp.js');
const fs = require('fs');
const path = require('path');
const engine = require('./engine.js');
const { Panel } = require('./panel.js');

class LightStudio extends OnlineApp {
    constructor() {
        super();
        this.on('initialized', () => this.setup().catch(err => console.error(err)));
        this.on('entryPointExecute', uuid => this.open(uuid).catch(err => console.error(err)));
        this.on('changeVisibility', event => {
            if (event && event.visible === false && this.panel) this.panel.stop();
        });
        this.on('shutdown', () => {
            if (this.panel) this.panel.stop();
            Promise.resolve(this.destroyBundles()).then(() => process.exit(0), () => process.exit(0));
        });
        this.on('error', err => console.error(err));
    }
    async open(uuid) {
        if (this.ready && uuid) await this.rhmiApplication.openEntryState(uuid);
    }
    async setup() {
        const hmi = this.rhmiApplication;
        if (!hmi) return this.initialized();
        const dataPath = path.join(__dirname, '..', '..', 'data', 'light-scene.json');
        const slotPath = n => n === 1 ? dataPath : path.join(path.dirname(dataPath), 'scene-' + n + '.json');
        const store = {
            load: n => {
                try { return engine.validate(JSON.parse(fs.readFileSync(slotPath(n), 'utf8'))); }
                catch (err) { if (err.code !== 'ENOENT') console.error(err); return null; }
            },
            remove: n => {
                try { fs.unlinkSync(slotPath(n)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
            },
            save: (pack,n) => {
                const dest = slotPath(n);
                const tmp = dest + '.tmp';
                fs.writeFileSync(tmp, JSON.stringify(engine.validate(pack)), 'utf8');
                fs.renameSync(tmp, dest);
            }
        };
        this.status = hmi.getByName('STATUS');
        this.menu = hmi.getByName('OPTIONS');
        this.rows = [];
        this.pending = false;
        this.revision = 0;
        this.panel = new Panel(store, () => this.redraw());
        this.menu.on('action', ev => {
            const index = Number(ev && ev.row);
            if (index === 0) { this.panel.stop(); return; }
            if (this.pending) return;
            const row = this.rows[index];
            if (row) this.panel.press(row);
        });
        await this.redraw();
        const entry = this.getEntryPoints().find(ep => this.appDescription.application.entryPoints
            .some(desc => desc.uuid === ep.getDescription().uuid));
        if (!entry) throw Error('MGU entry point unavailable');
        await entry.init();
        await hmi.mapEntryState(entry.getDescription().uuid, hmi.getByName('STUDIO'));
        await entry.setAvailability('ENABLED');
        this.ready = true;
        await this.initialized();
        await this.open(this.getLastExecutedEntryPointUuid && this.getLastExecutedEntryPointUuid());
    }
    async writeText(component, row, key, text) {
        const values = {};
        values[key] = text;
        await component.getStringBundle().setStrings(values);
        await component.setValue(row, 'Text', key, 'StringId');
    }
    async redraw() {
        this.revision++;
        if (this.pending || !this.panel) return;
        this.pending = true;
        try {
            let seen;
            do {
                seen = this.revision;
                const rows = this.panel.rows();
                const title = this.panel.status();
                if (title !== this.lastStatus) {
                    await this.writeText(this.status, 0, 'SID_STUDIO_STATUS', title);
                    this.lastStatus = title;
                }
                if (rows.length !== this.rows.length) await this.menu.setRowCount(rows.length);
                for (let i = 0; i < rows.length; i++) {
                    if (!this.rows[i] || this.rows[i].label !== rows[i].label)
                        await this.writeText(this.menu, i, 'SID_STUDIO_ROW_' + i, rows[i].label);
                }
                this.rows = rows;
            } while (seen !== this.revision);
        } catch (err) { this.rows = []; console.error(err); }
        finally { this.pending = false; }
    }
}
new LightStudio().start().catch(err => console.error(err));
