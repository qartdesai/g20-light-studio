'use strict';

const PAIRS = [
    ['drl', 'ДХО'], ['low', 'Ближний свет'], ['high', 'Дальний свет'],
    ['front_turn', 'Передний поворотник'], ['fog', 'Передняя ПТФ'],
    ['mirror', 'Поворотник зеркала'], ['puddle', 'Подсветка у двери'],
    ['welcome', 'Приветственный свет'], ['tail', 'Габарит сзади'],
    ['rear_turn', 'Задний поворотник'], ['brake', 'Стоп-сигнал'],
    ['reverse', 'Задний ход'], ['rear_fog', 'Задняя ПТФ']
];
const channels = [];
PAIRS.forEach(pair => ['l', 'r'].forEach(side => channels.push({
    id: pair[0] + '_' + side, label: pair[1] + (side === 'l' ? ' · Л' : ' · П')
})));
channels.push({id: 'center_stop', label: 'Центральный стоп'}, {id: 'plate', label: 'Номерной знак'});
const extra = [
    ['handle_fl','Ручка · передняя левая',212,202], ['handle_fr','Ручка · передняя правая',428,202],
    ['handle_rl','Ручка · задняя левая',212,291], ['handle_rr','Ручка · задняя правая',428,291],
    ['plate_l','Номер · левая лампа',306,420], ['plate_r','Номер · правая лампа',334,420]
];
extra.forEach(c => channels.push({id:c[0],label:c[1],x:c[2],y:c[3]}));
channels.push.apply(channels, require('./segments.js'));
const hazards = ['front_turn_l','front_turn_r','mirror_l','mirror_r','rear_turn_l','rear_turn_r'];
const ids = channels.map(c => c.id);
if (new Set(ids).size !== ids.length) throw Error('Повтор ID в профиле');

function validate(pack) {
    if (!pack || pack.version !== 1 || typeof pack.name !== 'string' ||
        !pack.name.trim() || pack.name.length > 60 || !Array.isArray(pack.steps) ||
        !pack.steps.length || pack.steps.length > 128) throw Error('Нужны название и 1–128 шагов.');
    const steps = pack.steps.map(step => {
        if (!step || !Number.isInteger(step.ms) || step.ms < 100 || step.ms > 10000 ||
            !Array.isArray(step.on) || step.on.length > ids.length ||
            step.on.some(id => ids.indexOf(id) < 0) || new Set(step.on).size !== step.on.length)
            throw Error('Проверь каналы и длительность шага (100–10 000 мс).');
        return {ms: step.ms, on: step.on.slice()};
    });
    return {version: 1, name: pack.name.trim(), steps: steps};
}
function scene(name, ms, frames) {
    return validate({version: 1, name: name, steps: frames.map(on => ({ms: ms, on: on}))});
}
const presets = [
    scene('Аварийка', 500, [hazards, []]),
    scene('Перекличка ДХО', 500, [['drl_l'], ['drl_r']]),
    scene('Двойной импульс', 220, [['drl_l','drl_r'], [], ['drl_l','drl_r'], [], [], []]),
    scene('По периметру', 380, [['front_turn_l'], ['mirror_l'], ['rear_turn_l'], ['rear_turn_r'], ['mirror_r'], ['front_turn_r']]),
    scene('Встреча', 850, [['puddle_l','puddle_r'], ['welcome_l','welcome_r'], ['drl_l','drl_r','tail_l','tail_r'], []]),
    scene('Диагональ', 600, [['drl_l','tail_r'], ['drl_r','tail_l']]),
    scene('Задняя волна', 450, [['tail_l'], ['tail_l','tail_r'], ['tail_r'], []])
];
const pairs = [
    ['drl','ДХО'], ['front_turn','Передние поворотники'], ['tail','Задние габариты'],
    ['rear_turn','Задние поворотники'], ['fog','Передние ПТФ'], ['puddle','Подсветка дверей'],
    ['low','Ближний свет'], ['brake','Стопы']
];
pairs.forEach(pair => {
    const l = pair[0] + '_l', r = pair[0] + '_r';
    presets.push(scene(pair[1] + ' · чередование', 450, [[l], [], [r], []]));
    presets.push(scene(pair[1] + ' · вместе', 400, [[l,r], []]));
});
presets.push(scene('Ручки · по кругу', 500, [['handle_fl'],['handle_fr'],['handle_rr'],['handle_rl']]));
const segmented = channels.filter(c => c.segment);
['front','rear'].forEach(zone => {
    const parts = segmented.filter(c => c.zone === zone);
    if (parts.length) presets.push(scene(zone === 'front' ? 'Перед · по одному сегменту' :
        'Стопы · по одному сегменту', 600, parts.slice(0,128).map(c => [c.id])));
});
class Player {
    constructor(render, clock) {
        this.render = render;
        this.clock = clock || {set: setTimeout, clear: clearTimeout};
        this.token = 0;
        this.timer = null;
        this.active = false;
    }
    stop() {
        this.token++;
        if (this.timer !== null) this.clock.clear(this.timer);
        this.timer = null;
        this.active = false;
        this.render([], -1);
    }
    play(pack, options) {
        const ready = validate(pack);
        const settings = options || {};
        const speed = settings.speed === undefined ? 1 : settings.speed;
        if (![0.5, 1, 1.5, 2].includes(speed)) throw Error('Неизвестная скорость');
        this.stop();
        this.pack = ready;
        this.loop = !!settings.loop;
        this.beats = !!settings.beats;
        this.speed = speed;
        this.index = -1;
        this.passes = 0;
        this.count = settings.count || 1;
        if (![1,2,3].includes(this.count)) throw Error('Число повторов: 1, 2, 3');
        this.active = true;
        this.next();
    }
    next() {
        if (!this.active) return;
        this.index++;
        if (this.index >= this.pack.steps.length) {
            this.passes++;
            if (!this.loop && this.passes >= this.count) return this.stop();
            this.index = 0;
        }
        const step = this.pack.steps[this.index];
        this.render(step.on.slice(), this.index);
        if (!this.beats) {
            const token = this.token;
            this.timer = this.clock.set(() => { if (token === this.token) this.next(); },
                Math.round(step.ms / this.speed));
        }
    }
    beat() { if (this.active && this.beats) this.next(); }
}
module.exports = {channels, hazards, presets, validate, Player};
