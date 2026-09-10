import {LIMITS} from './config.js';
import {ERR, RecordError} from './errors.js';

const te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
function crcTable(){const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;}const CT=crcTable();
export function crc32(u){let c=0xffffffff;for(const b of u)c=CT[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function u16(v){return [v&255,(v>>>8)&255];}function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
function r16(b,o){if(o<0||o+2>b.length)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP read exceeded archive bounds.');return b[o]|(b[o+1]<<8);}function r32(b,o){if(o<0||o+4>b.length)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP read exceeded archive bounds.');return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function dosDate(d=new Date(2000,0,1,0,0,0)){let year=Math.max(1980,d.getFullYear());return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
function safePath(name){if(typeof name!=='string'||!name||name.length>LIMITS.archivePathLength||name.includes('\\')||name.startsWith('/')||/^[A-Za-z]:/.test(name)||name.split('/').some(p=>p==='..'||p===''))throw new RecordError(ERR.IMP_ARCHIVE,`Unsafe archive path: ${name}`);return name;}

export function createZip(files,{deterministic=true,maxBytes=LIMITS.backupArchiveBytes}={}){
  if(!Array.isArray(files)||files.length>LIMITS.archiveFiles)throw new RecordError(ERR.EXP_BACKUP,'Archive file count exceeds safety limit.');
  const names=new Set(),local=[],central=[];let offset=0,totalData=0;const stamp=dosDate(deterministic?new Date(2000,0,1):new Date());
  for(const f of files){const safe=safePath(f.name);if(names.has(safe))throw new RecordError(ERR.EXP_BACKUP,`Duplicate archive path: ${safe}`);names.add(safe);const name=te.encode(safe),data=f.data instanceof Uint8Array?f.data:te.encode(String(f.data));totalData+=data.length;if(totalData>maxBytes)throw new RecordError(ERR.EXP_BACKUP,'Archive payload exceeds safety limit.');const crc=crc32(data);
    const lh=new Uint8Array([0x50,0x4b,0x03,0x04,...u16(20),...u16(0x0800),...u16(0),...u16(stamp.time),...u16(stamp.date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);local.push(lh,data);
    const ch=new Uint8Array([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(stamp.time),...u16(stamp.date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);central.push(ch);offset+=lh.length+data.length;
  }
  const csize=central.reduce((n,x)=>n+x.length,0),count=files.length,end=new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(count),...u16(count),...u32(csize),...u32(offset),...u16(0)]),all=[...local,...central,end],size=all.reduce((n,x)=>n+x.length,0);if(size>maxBytes)throw new RecordError(ERR.EXP_BACKUP,'Archive output exceeds safety limit.');const out=new Uint8Array(size);let p=0;for(const a of all){out.set(a,p);p+=a.length;}return out;
}

export function parseZipStore(input,{maxBytes=LIMITS.backupArchiveBytes,maxFiles=LIMITS.archiveFiles}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<22||bytes.length>maxBytes)throw new RecordError(ERR.IMP_ARCHIVE,'Archive size is outside the safety limit.');
  let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(r32(bytes,i)===0x06054b50){const comment=r16(bytes,i+20);if(i+22+comment===bytes.length){eocd=i;break;}}if(eocd<0)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP end-of-central-directory record not found.');
  const disk=r16(bytes,eocd+4),centralDisk=r16(bytes,eocd+6),diskCount=r16(bytes,eocd+8),count=r16(bytes,eocd+10),centralSize=r32(bytes,eocd+12),centralOffset=r32(bytes,eocd+16);if(disk!==0||centralDisk!==0||diskCount!==count)throw new RecordError(ERR.IMP_ARCHIVE,'Multi-disk ZIP archives are not accepted.');if(count>maxFiles)throw new RecordError(ERR.IMP_ARCHIVE,'Archive file count exceeds safety limit.');if(centralOffset+centralSize!==eocd||centralOffset+centralSize>bytes.length)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP central directory is inconsistent.');
  const files=new Map();let p=centralOffset,total=0;
  for(let i=0;i<count;i++){
    if(p+46>eocd||r32(bytes,p)!==0x02014b50)throw new RecordError(ERR.IMP_ARCHIVE,'Malformed ZIP central directory.');
    const flags=r16(bytes,p+8),method=r16(bytes,p+10),crc=r32(bytes,p+16),compressed=r32(bytes,p+20),uncompressed=r32(bytes,p+24),nameLen=r16(bytes,p+28),extraLen=r16(bytes,p+30),commentLen=r16(bytes,p+32),localOffset=r32(bytes,p+42);if(method!==0)throw new RecordError(ERR.IMP_ARCHIVE,'Only uncompressed STORE ZIP members are accepted.');if(compressed!==uncompressed)throw new RecordError(ERR.IMP_ARCHIVE,'Unexpected compressed member in STORE archive.');if(flags&0x0001)throw new RecordError(ERR.IMP_ARCHIVE,'Encrypted ZIP members are not accepted.');if(flags&0x0008)throw new RecordError(ERR.IMP_ARCHIVE,'Data-descriptor ZIP members are not accepted.');if(p+46+nameLen+extraLen+commentLen>eocd)throw new RecordError(ERR.IMP_ARCHIVE,'Central directory member exceeds bounds.');
    const name=td.decode(bytes.subarray(p+46,p+46+nameLen));safePath(name);if(files.has(name))throw new RecordError(ERR.IMP_ARCHIVE,`Duplicate archive member: ${name}`);
    if(localOffset+30>centralOffset||r32(bytes,localOffset)!==0x04034b50)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP local header missing.');const lflags=r16(bytes,localOffset+6),lmethod=r16(bytes,localOffset+8),lcrc=r32(bytes,localOffset+14),lcomp=r32(bytes,localOffset+18),luncomp=r32(bytes,localOffset+22),localNameLen=r16(bytes,localOffset+26),localExtraLen=r16(bytes,localOffset+28);if(lflags!==flags||lmethod!==method||lcrc!==crc||lcomp!==compressed||luncomp!==uncompressed)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP local/central metadata mismatch.');const localNameStart=localOffset+30,localNameEnd=localNameStart+localNameLen;if(localNameEnd+localExtraLen>centralOffset)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP local header exceeds bounds.');const localName=td.decode(bytes.subarray(localNameStart,localNameEnd));if(localName!==name)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP local/central filename mismatch.');
    const dataOffset=localNameEnd+localExtraLen,end=dataOffset+uncompressed;if(end>centralOffset)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP member exceeds archive bounds.');const data=bytes.slice(dataOffset,end);if(crc32(data)!==crc)throw new RecordError(ERR.IMP_ARCHIVE,`CRC mismatch: ${name}`);total+=data.length;if(total>maxBytes)throw new RecordError(ERR.IMP_ARCHIVE,'Expanded archive exceeds safety limit.');files.set(name,data);p+=46+nameLen+extraLen+commentLen;
  }
  if(p!==eocd)throw new RecordError(ERR.IMP_ARCHIVE,'ZIP central directory length mismatch.');return files;
}

export function textMember(files,name,max=10*1024*1024){const b=files.get(name);if(!b)throw new RecordError(ERR.IMP_ARCHIVE,`Required archive member missing: ${name}`);if(b.length>max)throw new RecordError(ERR.IMP_ARCHIVE,`${name} exceeds text member limit.`);try{return td.decode(b);}catch{throw new RecordError(ERR.IMP_ARCHIVE,`${name} is not valid UTF-8.`);}}
