'use strict';
const {channels, presets, validate, Player} = require('./engine.js');
const library = presets.concat(require('./packs.js').map(validate));
class Panel {
    constructor(store, changed) {
        this.store = store;
        this.changed = changed;
        this.slot = 1;
        this.draft = store.load(this.slot) || {version: 1, name: 'Моя сцена', steps: []};
        this.selected = [];
        this.frame = [];
        this.page = 'home';
        this.ms = 500;
        this.loop = true;
        this.count = 1;
        this.channelPage = 0;
        this.speed = 1;
        this.note = '';
        this.current = presets[0];
        this.player = new Player((on, index) => {
            this.frame = on;
            this.index = index;
            this.changed();
        });
        this.index = -1;
    }
    stop() { this.selected = []; this.player.stop(); }
    status() {
        const title = this.index < 0 ? 'Предпросмотр' : this.player.pack.name + ' · шаг ' + (this.index + 1);
        const names = this.frame.map(id => channels.find(c => c.id === id).label);
        return this.note || title + '  |  ' + (names.join(', ') || 'Огни выключены');
    }
    rows() {
        const rows = [];
        const add = (label, run) => rows.push({label, run});
        const go = (label, page) => add(label, () => { this.page = page; });
        const play = (pack, beats) => {
            this.current = validate(pack);
            this.player.play(this.current, {loop:this.loop, speed:this.speed, beats:beats, count:this.count});
        };
        add('Стоп · погасить предпросмотр', () => this.stop());
        if (this.page !== 'home') go('‹ Главное меню', 'home');
        if (this.page === 'channels') {
            const size = 10;
            const offset = this.channelPage * size;
            go('Редактор шагов ›', 'edit');
            if (offset > 0) add('‹ Предыдущие каналы', () => {this.channelPage--;});
            if (offset + size < channels.length) add('Следующие каналы ›', () => {this.channelPage++;});
            channels.slice(offset, offset+size).forEach(c => add((this.selected.includes(c.id) ? '● ' : '○ ') + c.label, () => {
                this.player.stop();
                this.selected = this.selected.includes(c.id) ? this.selected.filter(x => x !== c.id) : this.selected.concat(c.id);
                this.frame = this.selected.slice();
            }));
        } else if (this.page === 'duration' || this.page === 'speed') {
            const speed = this.page === 'speed';
            const values = speed ? [0.5,0.75,1,1.25,1.5,1.75,2] : [100,150,250,500,750,1000,2000,5000,10000];
            values.forEach((v,i) => add((v === (speed ? this.speed : this.ms) ? '●  ' : '○  ') +
                (speed ? v + '×' : v + ' мс') + '   ' + '━'.repeat(i+1), () => {
                if(speed){this.speed=v;this.player.speed=v;this.page='home';}
                else{this.ms=v;this.page='edit';}
            }));
        } else if (this.page === 'presets') {
            library.forEach(pack => add(pack.name, () => play(pack, false)));
        } else if (this.page === 'slots') {
            for (let slot = 1; slot <= 8; slot++) {
                const stored = this.store.load(slot);
                add(slot + ' · ' + (stored ? stored.name : 'Свободно'), () => {
                    this.slot = slot;
                    this.draft = stored || {version:1,name:'Моя сцена ' + slot,steps:[]};
                    this.page = 'edit';
                });
            }
        } else if (this.page === 'edit') {
            go('Сохранённые сцены · слот ' + this.slot + ' ›', 'slots');
            add('Скопировать текущий эффект в редактор', () => {
                this.draft = validate(this.current);
                this.draft.name = 'Сцена ' + this.slot + ' · ' + this.draft.name.slice(0,44);
            });
            if (this.store.remove) add('Очистить слот ' + this.slot + '…', () => {this.page='confirm';});
            go('Выбрать огни для шага ›', 'channels');
            go('Длительность · ' + this.ms + ' мс ›','duration');
            add('Добавить шаг (' + this.selected.length + ' огней)', () => {
                if (this.draft.steps.length >= 128) throw Error('Лимит 128 шагов');
                this.draft.steps.push({ms:this.ms, on:this.selected.slice()});
            });
            this.draft.steps.forEach((s,i) => add((i+1) + '. ' + s.ms + ' мс · ' + (s.on.join(', ') || 'пауза'), () => {
                this.editIndex = i;
                this.page = 'step';
            }));
            add('Сохранить сцену', () => { this.store.save(validate(this.draft),this.slot); this.note = 'Сцена сохранена'; });
            add('Проиграть сцену', () => play(this.draft, false));
        } else if (this.page === 'confirm') {
            go('Отмена', 'edit');
            add('Удалить сохранённую сцену ' + this.slot, () => {
                this.store.remove(this.slot);
                this.draft = {version:1,name:'Моя сцена ' + this.slot,steps:[]};
                this.page='edit';
            });
        } else if (this.page === 'step') {
            const i = this.editIndex;
            const list = this.draft.steps;
            add('Заменить выбранными огнями и длительностью', () => { list[i] = {ms:this.ms,on:this.selected.slice()}; this.page = 'edit'; });
            if (i > 0) add('На шаг раньше', () => { list.splice(i-1, 0, list.splice(i,1)[0]); this.page = 'edit'; });
            if (i+1 < list.length) add('На шаг позже', () => { list.splice(i+1, 0, list.splice(i,1)[0]); this.page = 'edit'; });
            add('Удалить шаг', () => { list.splice(i,1); this.page = 'edit'; });
            go('‹ К шагам', 'edit');
        } else {
            add('Аварийка · предпросмотр', () => play(presets[0], false));
            add('ФСО · демо 4 с', () => {
                this.player.previewFso();
            });
            go('Эффекты ›', 'presets');
            add('Число проходов без цикла · ' + this.count, () => {this.count = this.count % 3 + 1;});
            go('Ручной выбор огней ›', 'channels');
            go('Моя сцена · редактор ›', 'edit');
            add('Повтор · ' + (this.loop ? 'вкл.' : 'выкл.'), () => { this.loop = !this.loop; this.player.loop = this.loop; });
            go('Скорость · ×' + this.speed + ' ›','speed');
            add('Вручную в такт · ' + this.current.name, () => {
                if (!this.player.active || !this.player.beats) play(this.current, true);
                else this.player.beat();
            });
        }
        return rows;
    }
    press(row) {
        this.note = '';
        try { row.run(); } catch (err) { this.note = err.message; }
        this.changed();
    }
}
module.exports = {Panel};
