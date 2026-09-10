import test from 'node:test';import assert from 'node:assert/strict';import {createZip,parseZipStore,textMember} from '../src/zip.js';
test('ZIP store round trip',()=>{const z=createZip([{name:'a.txt',data:'alpha'},{name:'dir/b.txt',data:'beta'}]);const f=parseZipStore(z);assert.equal(textMember(f,'a.txt'),'alpha');assert.equal(textMember(f,'dir/b.txt'),'beta');});
test('writer rejects traversal and duplicate paths',()=>{assert.throws(()=>createZip([{name:'../evil',data:'x'}]));assert.throws(()=>createZip([{name:'a',data:'x'},{name:'a',data:'y'}]));});
test('reader rejects tampered CRC',()=>{const z=createZip([{name:'a.txt',data:'alpha'}]);z[40]^=1;assert.throws(()=>parseZipStore(z));});
