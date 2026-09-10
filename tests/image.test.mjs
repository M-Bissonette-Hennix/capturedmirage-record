import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDocumentQuadFromRGBA,homographyUnitSquareToQuad,mapHomography,normalizeIlluminationRGBA,polygonArea,warpPerspectiveRGBA} from '../src/perspective.js';

test('homography maps unit-square corners onto arbitrary source quad',()=>{
  const q=[[12,8],[90,16],[82,112],[6,96]],H=homographyUnitSquareToQuad(q),uv=[[0,0],[1,0],[1,1],[0,1]];
  uv.forEach((p,i)=>{const m=mapHomography(H,...p);assert.ok(Math.abs(m[0]-q[i][0])<1e-7);assert.ok(Math.abs(m[1]-q[i][1])<1e-7);});
});

test('document detector recovers a large skewed light page on dark surround',()=>{
  const w=120,h=100,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=18;d[i+3]=255;}
  const q=[[22,12],[102,20],[94,89],[13,80]];
  const inside=(x,y)=>{let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(c&&sign===0)sign=Math.sign(c);else if(c&&Math.sign(c)!==sign)return false;}return true;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(inside(x,y)){const i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=238;}
  const out=detectDocumentQuadFromRGBA(d,w,h);assert.notEqual(out.confidence,'LOW');assert.ok(polygonArea(out.quad)>.4);const expected=q.map(([x,y])=>[x/(w-1),y/(h-1)]);out.quad.forEach((p,i)=>{assert.ok(Math.abs(p[0]-expected[i][0])<.07);assert.ok(Math.abs(p[1]-expected[i][1])<.07);});
});

test('document detector fails safe to full frame when there is no separable page',()=>{
  const w=50,h=50,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=200;d[i+3]=255;}const out=detectDocumentQuadFromRGBA(d,w,h);assert.equal(out.confidence,'LOW');assert.deepEqual(out.quad,[[0,0],[1,0],[1,1],[0,1]]);
});

test('perspective warp is bounded and illumination normalization lifts shadowed tiles without changing alpha',()=>{
  const sw=6,sh=6,src=new Uint8ClampedArray(sw*sh*4);for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4,v=x<3?90:210;src[i]=src[i+1]=src[i+2]=v;src[i+3]=255;}
  const warped=warpPerspectiveRGBA(src,sw,sh,5,5,[[0,0],[5,0],[5,5],[0,5]]);assert.equal(warped.data.length,5*5*4);const norm=normalizeIlluminationRGBA(warped.data,5,5,2);for(let i=3;i<norm.length;i+=4)assert.equal(norm[i],255);assert.ok(norm[0]>warped.data[0]);
});

import {sniffImageMime} from '../src/image.js';
test('source signature sniff distinguishes JPEG/PNG and rejects arbitrary bytes',()=>{assert.equal(sniffImageMime(Uint8Array.from([0xff,0xd8,0xff,0x00])).mime,'image/jpeg');assert.equal(sniffImageMime(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])).mime,'image/png');assert.equal(sniffImageMime(new TextEncoder().encode('<svg></svg>')).mime,null);});
test('animated WebP is detected and is not silently treated as a still source',()=>{const riff=new Uint8Array(30);riff.set(new TextEncoder().encode('RIFF'),0);riff.set(new TextEncoder().encode('WEBP'),8);riff.set(new TextEncoder().encode('VP8X'),12);riff[16]=10;riff[20]=0x02;const x=sniffImageMime(riff);assert.equal(x.mime,'image/webp');assert.equal(x.animated,true);});
