const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js');
test('SRT conserva tiempos y texto, admite coma y punto',()=>{const s=C.parseSRT('1\n00:00:01,250 --> 00:00:03.500\nHola\nMundo');assert.deepEqual(s,[{start:1.25,end:3.5,text:'Hola\nMundo'}])});
test('SRT rechaza intervalos invertidos y minutos fuera de rango',()=>{assert.throws(()=>C.parseSRT('1\n00:00:04,000 --> 00:00:02,000\nX'));assert.throws(()=>C.parseSRT('1\n00:70:00,000 --> 01:20:00,000\nX'))});
test('Distribución de subtítulos cubre la duración sin huecos',()=>{const a=C.parseSRT(C.captions('Uno\nDos\nTres',9));assert.equal(a[0].start,0);assert.equal(a[2].end,9);assert.equal(a[0].end,a[1].start)});
test('Importación normaliza valores peligrosos y crea identificadores propios',()=>{const p=C.normalize({name:'Prueba',id:"bad' onclick='",format:'xxx',bg:'red" onload="',fontSize:100000,asset:'injected',checklist:[-1,3,99]});assert.match(p.id,/^[\w-]+$/);assert.equal(p.format,'9:16');assert.equal(p.bg,'#c6cbb9');assert.equal(p.fontSize,140);assert.equal(p.asset,null);assert.deepEqual(p.checklist,[3])});
test('Dimensiones sociales siempre son pares para el codificador',()=>{assert.deepEqual(C.dimensions('9:16',720),[720,1280]);for(const f of ['1:1','16:9','4:5'])assert.equal(C.dimensions(f,1080)[1]%2,0)});

