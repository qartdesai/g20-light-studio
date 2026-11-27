'use strict';
const $ = id => document.getElementById(id);
const {channels, presets, validate, Player} = LightStudio;
const channelNames = new Map(channels.map(c => [c.id,c.label]));
const notify = text => { $('feedback').textContent = text; };
const copy = value => JSON.parse(JSON.stringify(value));
let saved = [];
try {
    const data = JSON.parse(localStorage.getItem('lightstudio.scenes.v1') || '[]');
    if (Array.isArray(data)) saved = data.map(validate);
} catch (err) { notify('Локальные сцены не удалось прочитать. Доступен импорт JSON.'); }
let draft = {version:1,name:'Моя сцена',steps:[]};
let selected = [];
let active = [];
let sounds = [], musicUrl = '', request = 0, raf = 0, beatIndex = 0, mode = 'idle';
const audio = $('track');
const player = new Player((on,index) => {
    active = on;
    $('progress').textContent = index < 0 ? '' : 'Шаг ' + (index+1) + ' / ' + player.pack.steps.length;
    draw();
});
function draw() {
    const ctx = $('map').getContext('2d');
    ctx.clearRect(0,0,640,470);
    const metal = ctx.createLinearGradient(200,0,442,0);
    ['#292c2f','#93979a','#53565a','#46494c','#9c9fa1','#27292b'].forEach((c,i)=>metal.addColorStop(i/5,c));
    function contour(d, fill, stroke) {
        const outline=new Path2D(d);
        if(fill){ctx.fillStyle=fill;ctx.fill(outline);}
        if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke(outline);}
    }
    contour('M320 39 C250 38 223 49 214 90 Q202 161 207 325 Q208 400 230 421 Q245 440 320 440 Q395 440 410 421 Q432 400 433 325 Q438 161 426 90 Q417 49 320 39Z',metal,'#b8bab9');
    contour('M232 149 Q320 127 408 149 L383 199 Q320 188 257 199Z','#1c2023','#8c9092');
    contour('M256 305 Q320 317 384 305 L402 356 Q320 373 238 356Z','#222528','#818588');
    contour('M228 155 Q217 240 226 327 L250 300 L250 201Z M412 155 Q423 240 414 327 L390 300 L390 201Z','#222527','#888c8c');
    contour('M238 127 Q248 98 263 82 M402 127 Q392 98 377 82 M240 377 Q320 392 400 377',null,'#9b9e9e');
    const coords={drl:[246,67],low:[265,85],high:[288,84],front_turn:[228,97],fog:[224,121],
        mirror:[194,172],puddle:[208,220],welcome:[213,274],tail:[244,392],rear_turn:[224,371],
        brake:[270,405],reverse:[289,386],rear_fog:[230,414],center_stop:[320,351],plate:[320,410]};
    channels.forEach(channel => {
        const side=channel.id.slice(-2), paired=side==='_l'||side==='_r';
        const family=paired?channel.id.slice(0,-2):channel.id;
        let x=channel.x, y=channel.y;
        if(x===undefined){[x,y]=coords[family];if(side==='_r')x=640-x;}
        const lit=active.includes(channel.id);
        const color=family.includes('turn')||family==='mirror'?'#ffbc4b':
            ['tail','brake','center_stop','rear_fog'].includes(family)?'#ff766e':'#f7faff';
        ctx.save();ctx.fillStyle=lit?color:'#45494b';ctx.shadowColor=color;ctx.shadowBlur=lit?14:0;
        if(channel.segment)ctx.fillRect(x-2,y-2,5,5);else ctx.fillRect(x-8,y-4,16,8);ctx.restore();
    });
    ctx.fillStyle='#9cb5bf';ctx.font='15px system-ui';ctx.textAlign='center';
    ctx.fillText('ПЕРЕД',320,26);ctx.fillText('ЗАД',320,458);
    $('monitor').textContent=active.length?active.map(id=>channelNames.get(id)).join(' · '):'Огни выключены';
}
function stop() {
    mode='idle'; cancelAnimationFrame(raf); audio.pause(); player.stop();
}
function manual() { stop(); active=selected.slice(); draw(); }
function scenes() { return presets.concat(bundledPacks, saved); }
function library(index) {
    $('scene').replaceChildren();
    scenes().forEach((p,i)=>$('scene').add(new Option(p.name,String(i))));
    $('scene').value=String(index||0);
}
function button(label,run) {
    const b=document.createElement('button');b.textContent=label;
    b.onclick=()=>{try {run();} catch(err){notify(err.message);}};return b;
}
function bank() {
    $('bank').replaceChildren();
    channels.forEach(c=>{
        const b=button(c.label,()=>{
            selected=selected.includes(c.id)?selected.filter(id=>id!==c.id):selected.concat(c.id);
            manual();bank();
        });
        b.setAttribute('aria-pressed',String(selected.includes(c.id)));$('bank').append(b);
    });
}
function stepInput() {
    const ms=Number($('ms').value);
    return validate({version:1,name:'Шаг',steps:[{ms:ms,on:selected}]}).steps[0];
}
function timeline() {
    $('steps').replaceChildren();
    draft.steps.forEach((s,i)=>{
        const row=document.createElement('div');row.className='line';
        const title=document.createElement('strong');title.textContent=(i+1)+'. '+s.ms+' мс';
        const lights=document.createElement('small');lights.textContent=s.on.map(id=>channelNames.get(id)).join(' · ')||'Пауза';
        const actions=document.createElement('div');actions.className='row';
        actions.append(button('Выбрать',()=>{selected=s.on.slice();$('ms').value=s.ms;refreshSliders();manual();bank();}),
            button('Заменить',()=>{draft.steps[i]=stepInput();timeline();}));
        if(i>0) actions.append(button('↑',()=>{draft.steps.splice(i-1,0,draft.steps.splice(i,1)[0]);timeline();}));
        if(i+1<draft.steps.length) actions.append(button('↓',()=>{draft.steps.splice(i+1,0,draft.steps.splice(i,1)[0]);timeline();}));
        actions.append(button('Удалить',()=>{draft.steps.splice(i,1);timeline();}));
        row.append(title,lights,actions);$('steps').append(row);
    });
}
function edit(pack) {
    stop();draft=copy(pack);$('name').value=draft.name;selected=[];bank();timeline();
}
const chosen=()=>scenes()[Number($('scene').value)];
function currentDraft() { return validate({version:1,name:$('name').value,steps:draft.steps}); }
function run(beats) {
    player.play(chosen(),{speed:Number($('speed').value),loop:$('loop').checked,count:Number($('count').value),beats:beats});
    if (window.matchMedia('(max-width:760px)').matches) $('map').scrollIntoView({block:'start'});
}
function on(id,fn) {
    $(id).onclick=async()=>{try{await fn();}catch(err){notify(err.message);}};
}
on('stop',stop);
on('fso',()=>{
    stop();
    mode='sequence';
    player.previewFso();
    if(window.matchMedia('(max-width:760px)').matches) $('map').scrollIntoView({block:'start'});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
on('hazard',()=>{stop();$('scene').value='0';mode='sequence';run(false);});
on('remove',()=>{
    const index=Number($('scene').value)-presets.length-bundledPacks.length;
    if(index<0)throw Error('Удаление доступно для своих сохранённых сцен.');
    const next=saved.filter((p,i)=>i!==index);
    localStorage.setItem('lightstudio.scenes.v1',JSON.stringify(next));stop();saved=next;library();notify('Сцена удалена.');
});
on('play',()=>{stop();mode='sequence';run(false);});
on('tap',()=>{if(mode!=='tap'||!player.active){stop();mode='tap';run(true);}else player.beat();});
on('copy',()=>edit(chosen()));
on('fresh',()=>edit({version:1,name:'Моя сцена',steps:[]}));
on('clear',()=>{selected=[];manual();bank();});
on('add',()=>{if(draft.steps.length>=128)throw Error('Лимит 128 шагов');draft.steps.push(stepInput());timeline();});
on('save',()=>{
    const pack=currentDraft();
    const next=saved.filter(p=>p.name!==pack.name).concat(pack);
    localStorage.setItem('lightstudio.scenes.v1',JSON.stringify(next));saved=next;
    library(scenes().length-1);notify('Сцена сохранена на этом устройстве.');
});
on('export',()=>{
    const pack=currentDraft(), a=document.createElement('a');
    const url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));
    a.href=url;a.download='g20-scene.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
});
$('import').onchange=async e=>{
    try {
        const file=e.target.files[0];if(!file)return;
        if(file.size>256*1024)throw Error('Файл больше 256 КБ.');
        const pack=validate(JSON.parse(await file.text()));edit(pack);notify('Сцена загружена в редактор.');
    }catch(err){notify(err.message);}finally{e.target.value='';}
};
$('fileAudio').onchange=async e=>{
    const serial=++request;stop();sounds=[];
    if(musicUrl) URL.revokeObjectURL(musicUrl);
    musicUrl='';audio.removeAttribute('src');audio.load();
    const file=e.target.files[0];if(!file)return;
    let context;
    try {
        if(file.size>50*1024*1024)throw Error('Выбери аудиофайл до 50 МБ.');
        $('musicStatus').textContent='Ищу удары в треке…';
        context=new (window.AudioContext||window.webkitAudioContext)();
        const decoded=await context.decodeAudioData(await file.arrayBuffer());
        if(serial!==request)return;
        sounds=detectOnsets(decoded);
        musicUrl=URL.createObjectURL(file);audio.src=musicUrl;
        $('musicStatus').textContent='Ударов в треке: '+sounds.length;
    }catch(err){if(serial===request)$('musicStatus').textContent=err.message;}
    finally{if(context)await context.close();}
};
function alignMusic() {
    const now=audio.currentTime;
    let lo=0,hi=sounds.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(sounds[mid]<=now)lo=mid+1;else hi=mid;}
    if(lo!==beatIndex || !player.active) {
        beatIndex=lo;
        if(!player.loop && lo>=player.pack.steps.length*player.count){stop();return;}
        const i=lo%player.pack.steps.length;player.index=i;player.render(player.pack.steps[i].on,i);
    }
}
function animation() {
    if(mode!=='music')return;
    alignMusic();
    if(mode==='music'&&!audio.paused)raf=requestAnimationFrame(animation);
}
audio.onpause=()=>{if(mode==='music'){cancelAnimationFrame(raf);active=[];draw();}};
audio.onplay=()=>{if(mode==='music'){beatIndex=-1;cancelAnimationFrame(raf);animation();}};
audio.onseeked=()=>{if(mode==='music'&&!audio.paused)alignMusic();};
audio.onended=()=>{if(mode==='music')stop();};
on('sync',async()=>{
    if(!sounds.length)throw Error('Сначала выбери трек с различимым ритмом.');
    stop();audio.currentTime=0;beatIndex=-1;mode='music';run(true);
    try{await audio.play();}catch(err){stop();throw err;}
});
$('scene').onchange=stop;$('speed').onchange=()=>{player.speed=Number($('speed').value);};
$('loop').onchange=()=>{player.loop=$('loop').checked;};
window.addEventListener('pagehide',stop);
library();bank();timeline();draw();

function refreshSliders() {
    for(const id of ['speed','ms']){
        const el=$(id), v=Number(el.value);
        el.style.setProperty('--fill', (100*(v-el.min)/(el.max-el.min))+'%');
        $(id+'Value').value=id==='ms'?v+' мс':v.toLocaleString('ru')+'×';
    }
}
$('speed').oninput=()=>{player.speed=Number($('speed').value);refreshSliders();};
$('ms').oninput=refreshSliders;
function showEditor(edit){
    $('editPane').hidden=!edit;$('scenesPane').hidden=edit;
    $('tabScenes').setAttribute('aria-pressed',String(!edit));$('tabEdit').setAttribute('aria-pressed',String(edit));
}
$('tabScenes').onclick=()=>showEditor(false);$('tabEdit').onclick=()=>showEditor(true);
refreshSliders();
