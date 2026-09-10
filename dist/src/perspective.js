const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const luma=(r,g,b)=>0.2126*r+0.7152*g+0.0722*b;

export function polygonArea(quad){
  let s=0;for(let i=0;i<quad.length;i++){const [x1,y1]=quad[i],[x2,y2]=quad[(i+1)%quad.length];s+=x1*y2-x2*y1;}return Math.abs(s)/2;
}

function median(values){const a=[...values].sort((x,y)=>x-y),n=a.length;return n?((n&1)?a[n>>1]:(a[(n>>1)-1]+a[n>>1])/2):0;}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function boundingRect(quad){const xs=quad.map(p=>p[0]),ys=quad.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys),r=Math.max(...xs),b=Math.max(...ys);return {x,y,w:r-x,h:b-y};}

/** Detect a likely document quadrilateral in a small RGBA raster.
 * Returns normalized points in TL,TR,BR,BL order. Fail-safe behavior is full-frame.
 */
export function detectDocumentQuadFromRGBA(data,width,height){
  const full={quad:[[0,0],[1,0],[1,1],[0,1]],rect:{x:0,y:0,w:1,h:1},confidence:'LOW',coverage:1,reason:'fallback'};
  if(!data||width<12||height<12||data.length<width*height*4)return full;
  const border=[];const band=Math.max(2,Math.floor(Math.min(width,height)*0.04));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<band||x>=width-band||y<band||y>=height-band){const i=(y*width+x)*4;border.push(luma(data[i],data[i+1],data[i+2]));}
  const bg=median(border);const deltas=[];for(let i=0;i<border.length;i++)deltas.push(Math.abs(border[i]-bg));
  const borderNoise=median(deltas);const threshold=clamp(22+borderNoise*1.8,24,62);
  const mask=new Uint8Array(width*height);let candidates=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,Y=luma(data[i],data[i+1],data[i+2]);
    const delta=Math.abs(Y-bg);
    // Scoresheets are normally light paper. The delta branch still permits dark documents on light surroundings.
    const paperBias=(bg<190&&Y>bg+18)||(bg>205&&Y<bg-24);
    if(delta>threshold||paperBias){mask[y*width+x]=1;candidates++;}
  }
  if(candidates<width*height*0.06)return full;

  // Largest 8-connected component prevents text/noise from defining the document corners.
  const seen=new Uint8Array(mask.length),stack=new Int32Array(mask.length);let best=[];
  for(let idx=0;idx<mask.length;idx++){
    if(!mask[idx]||seen[idx])continue;let sp=0;stack[sp++]=idx;seen[idx]=1;const comp=[];
    while(sp){const cur=stack[--sp];comp.push(cur);const cy=Math.floor(cur/width),cx=cur-cy*width;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const ni=ny*width+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;stack[sp++]=ni;}}
    }
    if(comp.length>best.length)best=comp;
  }
  const coverage=best.length/(width*height);if(coverage<0.12)return full;
  let tl=null,tr=null,br=null,bl=null,minSum=Infinity,maxSum=-Infinity,minDiff=Infinity,maxDiff=-Infinity;
  for(const idx of best){const y=Math.floor(idx/width),x=idx-y*width,s=x+y,d=x-y;
    if(s<minSum){minSum=s;tl=[x,y];}if(s>maxSum){maxSum=s;br=[x,y];}if(d>maxDiff){maxDiff=d;tr=[x,y];}if(d<minDiff){minDiff=d;bl=[x,y];}
  }
  if(!tl||!tr||!br||!bl)return full;
  const raw=[tl,tr,br,bl];
  const area=polygonArea(raw)/(width*height);const minEdge=Math.min(dist(tl,tr),dist(tr,br),dist(br,bl),dist(bl,tl))/Math.min(width,height);
  const unique=new Set(raw.map(p=>`${p[0]},${p[1]}`)).size;
  if(unique<4||area<0.24||minEdge<0.18)return full;
  const quad=raw.map(([x,y])=>[clamp(x/(width-1),0,1),clamp(y/(height-1),0,1)]);
  const rect=boundingRect(quad);const confidence=area>0.48&&coverage>0.34?'HIGH':'HEURISTIC';
  return {quad,rect,confidence,coverage:Number(coverage.toFixed(4)),reason:'largest-component-extrema'};
}

function solveLinear(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    if(Math.abs(M[p][c])<1e-12)throw new Error('Singular homography.');[M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=d;
    for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];if(!f)continue;for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j];}
  }
  return M.map(r=>r[n]);
}

/** Homography mapping destination unit-square coordinates (u,v) to source pixel coordinates. */
export function homographyUnitSquareToQuad(quadPx){
  if(!Array.isArray(quadPx)||quadPx.length!==4)throw new Error('Quad must have four points.');
  const uv=[[0,0],[1,0],[1,1],[0,1]],A=[],b=[];
  for(let i=0;i<4;i++){
    const [u,v]=uv[i],[x,y]=quadPx[i];
    A.push([u,v,1,0,0,0,-x*u,-x*v]);b.push(x);
    A.push([0,0,0,u,v,1,-y*u,-y*v]);b.push(y);
  }
  return solveLinear(A,b);
}
export function mapHomography(H,u,v){const [a,b,c,d,e,f,g,h]=H,den=g*u+h*v+1;return [(a*u+b*v+c)/den,(d*u+e*v+f)/den];}

export function estimateRectifiedSize(quadPx,maxEdge){
  const w=(dist(quadPx[0],quadPx[1])+dist(quadPx[3],quadPx[2]))/2,h=(dist(quadPx[0],quadPx[3])+dist(quadPx[1],quadPx[2]))/2;
  const s=Math.min(1,maxEdge/Math.max(w,h));return {width:Math.max(1,Math.round(w*s)),height:Math.max(1,Math.round(h*s))};
}

export function warpPerspectiveRGBA(src,sw,sh,dw,dh,quadPx){
  const H=homographyUnitSquareToQuad(quadPx),out=new Uint8ClampedArray(dw*dh*4);
  for(let y=0;y<dh;y++){
    const v=dh===1?0:y/(dh-1);
    for(let x=0;x<dw;x++){
      const u=dw===1?0:x/(dw-1),[sx0,sy0]=mapHomography(H,u,v),sx=clamp(sx0,0,sw-1),sy=clamp(sy0,0,sh-1);
      const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=sx-x0,fy=sy-y0;
      const i00=(y0*sw+x0)*4,i10=(y0*sw+x1)*4,i01=(y1*sw+x0)*4,i11=(y1*sw+x1)*4,o=(y*dw+x)*4;
      for(let c=0;c<3;c++){const a=src[i00+c]*(1-fx)+src[i10+c]*fx,b=src[i01+c]*(1-fx)+src[i11+c]*fx;out[o+c]=Math.round(a*(1-fy)+b*fy);}out[o+3]=255;
    }
  }
  return {data:out,homography:H};
}

/** Modest local illumination normalization. Intended for recognition derivatives only, never source evidence. */
export function normalizeIlluminationRGBA(data,width,height,tile=96){
  const out=new Uint8ClampedArray(data);const nx=Math.ceil(width/tile),ny=Math.ceil(height/tile),means=new Float64Array(nx*ny),counts=new Uint32Array(nx*ny);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,k=Math.floor(y/tile)*nx+Math.floor(x/tile);means[k]+=luma(data[i],data[i+1],data[i+2]);counts[k]++;}
  for(let k=0;k<means.length;k++)means[k]/=Math.max(1,counts[k]);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,k=Math.floor(y/tile)*nx+Math.floor(x/tile),offset=clamp((222-means[k])*.52,-34,46);
    for(let c=0;c<3;c++){let v=data[i+c]+offset;v=128+(v-128)*1.055;out[i+c]=clamp(Math.round(v),0,255);}out[i+3]=255;
  }
  return out;
}
