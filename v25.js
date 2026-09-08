(() => {
  'use strict';
  const VERSION = '25.0';
  window.__QR_V25__ = VERSION;
  const $ = id => document.getElementById(id);
  const el = {
    address:$('address'), lat:$('lat'), lng:$('lng'), mapsUrl:$('mapsUrl'), zoom:$('zoom'), paperSize:$('paperSize'),
    placeName:$('placeName'), mapFrame:$('mapFrame'), recordMap:$('recordMapImage'), recordStatus:$('recordMapStatus'),
    mapEmpty:$('mapEmpty'), poiEnabled:$('poiEnabled'), btnRefresh:$('btnRefreshRecordMap'),
    sheet:$('sheet'), sheetViewport:$('sheetViewport'), previewSync:$('previewSyncStatus'),
    exportProgress:$('exportProgress'), exportProgressText:$('exportProgressText'), exportProgressPct:$('exportProgressPct'), exportProgressBar:$('exportProgressBar'),
    toast:$('toast'), addressOutput:$('addressOutput')
  };
  let mapBuildTimer = 0;
  let mapBuildSeq = 0;
  let exportBusy = false;
  let lastMapKey = '';
  let lastMapDataUrl = '';
  const snapshotCache = new Map();
  const poiCache = new Map();

  function toast(msg){
    if(!el.toast) return;
    el.toast.textContent=msg; el.toast.classList.add('show');
    clearTimeout(toast._t); toast._t=setTimeout(()=>el.toast.classList.remove('show'),2400);
  }
  function setSync(kind,text){
    if(!el.previewSync) return;
    el.previewSync.className = `preview-sync-status ${kind||''}`;
    el.previewSync.textContent = text || '';
  }
  function setMapStatus(show,text){
    if(!el.recordStatus) return;
    el.recordStatus.textContent=text||'Đang tạo bản đồ hồ sơ…';
    el.recordStatus.classList.toggle('hidden',!show);
  }
  function setProgress(p,text,done=false,error=false){
    p=Math.max(0,Math.min(100,Math.round(Number(p)||0)));
    if(el.exportProgress){
      el.exportProgress.classList.toggle('hidden',!!done);
      el.exportProgress.classList.toggle('error',!!error);
      if(el.exportProgressText) el.exportProgressText.textContent=text||'Đang xử lý…';
      if(el.exportProgressPct) el.exportProgressPct.textContent=`${p}%`;
      if(el.exportProgressBar) el.exportProgressBar.style.width=`${p}%`;
    }
    if(!done) setSync(error?'v25-error':'v25-building', text||'Đang xử lý…');
    else setSync('v25-ready','1:1 Preview/PDF');
  }
  function n(v){ const x=Number(String(v??'').replace(',','.').trim()); return Number.isFinite(x)?x:null; }
  function validCoords(){
    const a=n(el.lat&&el.lat.value), b=n(el.lng&&el.lng.value);
    return a!==null&&b!==null&&a>=-90&&a<=90&&b>=-180&&b<=180?{lat:a,lng:b}:null;
  }
  function parseMaps(raw){
    if(!raw) return null; let s=String(raw).trim(); try{s=decodeURIComponent(s)}catch(_){}
    const ps=[/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,/!3d(-?\d{1,2}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/,/[?&](?:q|query|destination)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,/(?:^|\s)(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)(?:$|\s)/];
    for(const re of ps){ const m=s.match(re); if(m){const a=Number(m[1]),b=Number(m[2]);if(a>=-90&&a<=90&&b>=-180&&b<=180)return{lat:a,lng:b};} }
    return null;
  }
  async function fetchTimeout(url,opts={},ms=8500){
    const ctrl=('AbortController'in window)?new AbortController():null;
    const t=setTimeout(()=>{try{ctrl&&ctrl.abort()}catch(_){}},ms);
    try{return await fetch(url,{...opts,signal:ctrl?ctrl.signal:opts.signal})}finally{clearTimeout(t)}
  }
  async function geocodeAddress(q){
    q=String(q||'').trim(); if(!q) return null;
    try{
      const r=await fetchTimeout(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=vi&q=${encodeURIComponent(q)}`,{headers:{Accept:'application/json'}},9000);
      if(!r.ok) return null; const a=await r.json(), x=Array.isArray(a)&&a[0]; if(!x) return null;
      const lat=Number(x.lat),lng=Number(x.lon); return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
    }catch(_){return null}
  }
  async function resolveCoords(){ return validCoords() || parseMaps(el.mapsUrl&&el.mapsUrl.value) || await geocodeAddress(el.address&&el.address.value); }
  function paperMode(){ return el.paperSize&&el.paperSize.value==='a4'?'a4':'letter'; }
  function canonical(){ return paperMode()==='a4'?{w:794,h:1123}:{w:816,h:1056}; }
  function nextPaint(){ return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); }
  function renderAddress(){
    if(!el.addressOutput||!el.address) return;
    const v=String(el.address.value||'').trim(); el.addressOutput.replaceChildren();
    if(!v){el.addressOutput.classList.add('hidden');return;}
    const b=document.createElement('strong');b.textContent='Địa chỉ:';const s=document.createElement('span');s.textContent=v;
    el.addressOutput.append(b,document.createTextNode(' '),s);el.addressOutput.classList.remove('hidden');el.addressOutput.style.display='block';
  }
  function mercator(lat,lng,z){const N=2**z*256,x=(lng+180)/360*N,s=Math.sin(lat*Math.PI/180),y=(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*N;return{x,y};}
  function haversine(a,b){
    const R=6371000,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h));
  }
  async function loadTile(z,x,y,timeout=6500){
    const urls=[`https://tile.openstreetmap.org/${z}/${x}/${y}.png`,`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`,`https://b.tile.openstreetmap.org/${z}/${x}/${y}.png`,`https://c.tile.openstreetmap.org/${z}/${x}/${y}.png`];
    let last;
    for(const url of urls){
      try{
        const r=await fetchTimeout(url,{mode:'cors',cache:'force-cache'},timeout); if(!r.ok) throw Error(`tile-${r.status}`);
        const blob=await r.blob();
        if('createImageBitmap'in window) return await createImageBitmap(blob);
        return await new Promise((res,rej)=>{const im=new Image(),u=URL.createObjectURL(blob);im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=()=>{URL.revokeObjectURL(u);rej(Error('tile-image'))};im.src=u;});
      }catch(e){last=e}
    }
    throw last||Error('tile-failed');
  }
  async function mapLimit(items,limit,fn){
    let i=0; const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(i<items.length){const idx=i++;await fn(items[idx],idx);}}); await Promise.all(workers);
  }
  function poiRadius(coords,zoom,w,h){
    const mpp=156543.03392*Math.cos(coords.lat*Math.PI/180)/(2**zoom);
    return Math.max(250,Math.min(1400,Math.round(Math.max(w,h)*mpp*.62)));
  }
  async function fetchPois(coords,radius){
    if(!el.poiEnabled||!el.poiEnabled.checked) return [];
    const ck=`${coords.lat.toFixed(4)},${coords.lng.toFixed(4)},${Math.round(radius/100)*100}`;
    if(poiCache.has(ck)) return poiCache.get(ck);
    const q=`[out:json][timeout:10];(nwr["name"]["amenity"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["healthcare"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["shop"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["tourism"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["office"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["public_transport"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["place"](around:${radius},${coords.lat},${coords.lng});nwr["name"]["leisure"](around:${radius},${coords.lat},${coords.lng}););out center tags 120;`;
    const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
    let data=null;
    for(const ep of endpoints){
      try{const r=await fetchTimeout(ep,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:`data=${encodeURIComponent(q)}`},11000);if(r.ok){data=await r.json();break;}}catch(_){}
    }
    if(!data||!Array.isArray(data.elements)){poiCache.set(ck,[]);return []}
    const out=[];
    for(const e of data.elements){
      const t=e.tags||{},name=String(t.name||'').trim();if(!name)continue;
      const lat=Number(e.lat??(e.center&&e.center.lat)),lng=Number(e.lon??(e.center&&e.center.lon));if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      const category=t.healthcare||t.amenity||t.shop||t.tourism||t.office||t.public_transport||t.place||t.leisure||'poi';
      const priority=(t.healthcare||['pharmacy','hospital','clinic','doctors'].includes(t.amenity))?0:(['school','college','university','kindergarten'].includes(t.amenity)?1:(t.public_transport?2:(t.place?3:(t.shop?4:5))));
      out.push({name,lat,lng,category,priority,d:haversine(coords,{lat,lng})});
    }
    out.sort((a,b)=>a.priority-b.priority||a.d-b.d);
    const seen=new Set(),uniq=[];for(const p of out){const k=p.name.toLowerCase();if(seen.has(k))continue;seen.add(k);uniq.push(p);if(uniq.length>=28)break;}
    poiCache.set(ck,uniq);return uniq;
  }
  function roundedRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function poiStyle(p){
    const c=String(p.category||'');
    if(/pharmacy|hospital|clinic|doctors|health/.test(c)) return {dot:'#1689df',text:'#0d65a7'};
    if(/school|college|university|kindergarten/.test(c)) return {dot:'#2980b9',text:'#35677f'};
    if(/bus|station|public_transport/.test(c)) return {dot:'#5b83a1',text:'#456577'};
    if(p.priority===4) return {dot:'#e58b31',text:'#a45c17'};
    return {dot:'#71828d',text:'#53656f'};
  }
  function drawPois(ctx,pois,coords,z,left,top,scale,canvasW,canvasH){
    const boxes=[];ctx.save();ctx.font=`600 ${11*scale}px Arial`;
    let count=0;
    for(const p of pois){
      const wp=mercator(p.lat,p.lng,z),x=wp.x-left,y=wp.y-top;if(x<24*scale||y<20*scale||x>canvasW-24*scale||y>canvasH-30*scale)continue;
      let name=p.name.length>34?p.name.slice(0,33)+'…':p.name;
      const tw=ctx.measureText(name).width,padX=6*scale,h=20*scale,w=tw+padX*2+10*scale;
      let bx=x+7*scale,by=y-h/2;if(bx+w>canvasW-8*scale)bx=x-w-7*scale;
      const rect={x:bx,y:by,w,h};
      if(boxes.some(b=>!(rect.x+rect.w<b.x||b.x+b.w<rect.x||rect.y+rect.h<b.y||b.y+b.h<rect.y)))continue;
      boxes.push(rect);const st=poiStyle(p);
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.strokeStyle='rgba(50,70,80,.22)';ctx.lineWidth=1*scale;roundedRect(ctx,bx,by,w,h,8*scale);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(bx+7*scale,by+h/2,3.2*scale,0,Math.PI*2);ctx.fillStyle=st.dot;ctx.fill();
      ctx.fillStyle=st.text;ctx.textBaseline='middle';ctx.fillText(name,bx+13*scale,by+h/2+.3*scale);count++;if(count>=20)break;
    }
    ctx.restore();
  }
  function drawFallback(ctx,w,h,coords){
    ctx.fillStyle='#f2f5f6';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d5dde1';ctx.lineWidth=3;for(let x=0;x<w;x+=150){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=150){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    ctx.strokeStyle='#bfcbd1';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(0,h*.42);ctx.lineTo(w,h*.58);ctx.stroke();ctx.beginPath();ctx.moveTo(w*.35,0);ctx.lineTo(w*.58,h);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(18,h-62,w-36,44);ctx.fillStyle='#495b65';ctx.font='20px Arial';ctx.fillText(`Vị trí ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} • QR mở Google Maps`,28,h-34);
  }
  async function createSnapshot(coords,seq,progressCb){
    const logicalW=Math.max(360,Math.round(el.mapFrame.offsetWidth||638)),logicalH=Math.max(480,Math.round(el.mapFrame.offsetHeight||842));
    const userZoom=Math.max(13,Math.min(19,Number(el.zoom&&el.zoom.value)||18));
    const renderScale=userZoom<19?2:1.5;
    const z=userZoom<19?userZoom+1:userZoom;
    const viewW=logicalW*renderScale,viewH=logicalH*renderScale;
    const key=`${coords.lat.toFixed(6)}|${coords.lng.toFixed(6)}|${userZoom}|${logicalW}x${logicalH}|${el.poiEnabled&&el.poiEnabled.checked?'poi':'plain'}`;
    if(snapshotCache.has(key)) return {url:snapshotCache.get(key),key};
    const c=document.createElement('canvas');c.width=Math.round(viewW);c.height=Math.round(viewH);const ctx=c.getContext('2d');ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,c.width,c.height);
    const world=mercator(coords.lat,coords.lng,z),left=world.x-viewW/2,top=world.y-viewH/2,maxTile=2**z;
    const minX=Math.floor(left/256)-1,maxX=Math.floor((left+viewW)/256)+1,minY=Math.floor(top/256)-1,maxY=Math.floor((top+viewH)/256)+1,jobs=[];
    for(let ty=minY;ty<=maxY;ty++){if(ty<0||ty>=maxTile)continue;for(let tx=minX;tx<=maxX;tx++){jobs.push({tx,ty,x:((tx%maxTile)+maxTile)%maxTile,dx:tx*256-left,dy:ty*256-top});}}
    let done=0,ok=0;
    await mapLimit(jobs,6,async j=>{try{const im=await loadTile(z,j.x,j.ty);ctx.drawImage(im,j.dx,j.dy,256,256);if(im&&typeof im.close==='function')try{im.close()}catch(_){};ok++;}catch(_){}finally{done++;if(progressCb)progressCb(done/Math.max(1,jobs.length));}});
    if(seq!==mapBuildSeq) throw Error('superseded');
    if(!ok) drawFallback(ctx,c.width,c.height,coords);
    const radius=poiRadius(coords,userZoom,logicalW,logicalH);const pois=await fetchPois(coords,radius);if(seq!==mapBuildSeq) throw Error('superseded');
    if(pois.length) drawPois(ctx,pois,coords,z,left,top,1,c.width,c.height);
    const credit='© OpenStreetMap contributors';ctx.save();ctx.font='12px Arial';const tw=ctx.measureText(credit).width;ctx.fillStyle='rgba(255,255,255,.82)';ctx.fillRect(c.width-tw-12,c.height-20,tw+10,18);ctx.fillStyle='#56656d';ctx.fillText(credit,c.width-tw-7,c.height-7);ctx.restore();
    const url=c.toDataURL('image/png');snapshotCache.set(key,url);if(snapshotCache.size>8)snapshotCache.delete(snapshotCache.keys().next().value);return{url,key};
  }
  async function rebuildMap(force=false){
    const seq=++mapBuildSeq;renderAddress();
    const coords=await resolveCoords();if(seq!==mapBuildSeq)return;
    if(!coords){lastMapKey='';lastMapDataUrl='';if(el.recordMap){el.recordMap.classList.add('hidden');el.recordMap.removeAttribute('src')}setMapStatus(false);setSync('v25-error','Chưa có bản đồ');return;}
    const userZoom=Math.max(13,Math.min(19,Number(el.zoom&&el.zoom.value)||18));
    const key0=`${coords.lat.toFixed(6)}|${coords.lng.toFixed(6)}|${userZoom}|${paperMode()}|${el.poiEnabled&&el.poiEnabled.checked?'poi':'plain'}`;
    if(!force&&key0===lastMapKey&&lastMapDataUrl){setSync('v25-ready','1:1 Preview/PDF');return;}
    setMapStatus(true,'Đang tạo bản đồ hồ sơ 1:1…');setSync('v25-building','Đang dựng bản đồ…');
    try{
      const result=await createSnapshot(coords,seq,f=>{if(seq===mapBuildSeq)setSync('v25-building',`Đang tải bản đồ ${Math.round(f*100)}%`)});if(seq!==mapBuildSeq)return;
      lastMapKey=key0;lastMapDataUrl=result.url;el.recordMap.src=result.url;await new Promise((res,rej)=>{if(el.recordMap.complete&&el.recordMap.naturalWidth>0)return res();const t=setTimeout(()=>rej(Error('image-timeout')),5000);el.recordMap.onload=()=>{clearTimeout(t);res()};el.recordMap.onerror=()=>{clearTimeout(t);rej(Error('image-error'))}});
      el.recordMap.classList.remove('hidden');if(el.mapEmpty)el.mapEmpty.classList.add('hidden');setMapStatus(false);setSync('v25-ready','1:1 Preview/PDF');
    }catch(e){if(e&&e.message==='superseded')return;console.error('[v25 map]',e);setMapStatus(false);setSync('v25-error','Lỗi nền bản đồ');toast('Không tải đủ bản đồ. Có thể bấm “Làm mới bản đồ hồ sơ”.');}
  }
  function scheduleMap(ms=700){clearTimeout(mapBuildTimer);mapBuildTimer=setTimeout(()=>rebuildMap(false),ms);}

  function loadScript(urls,ready){if(ready())return Promise.resolve();return new Promise((res,rej)=>{let i=0;const go=()=>{if(ready())return res();if(i>=urls.length)return rej(Error('html2canvas-load'));const s=document.createElement('script');s.src=urls[i++];s.async=true;s.onload=()=>ready()?res():go();s.onerror=go;document.head.appendChild(s)};go()})}
  async function ensureHtml2Canvas(){return loadScript(['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'],()=>typeof window.html2canvas==='function')}
  function bytesFromDataUrl(u){const b=atob(u.slice(u.indexOf(',')+1)),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
  const ascii=s=>new TextEncoder().encode(s);
  function join(parts){const n=parts.reduce((a,p)=>a+p.length,0),o=new Uint8Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length}return o}
  function pdfBlob(jpegUrl,iw,ih,mode){
    const img=bytesFromDataUrl(jpegUrl);if(img.length<1000)throw Error('image-data');const W=mode==='a4'?595.276:612,H=mode==='a4'?841.89:792,stream=`q\n${W.toFixed(3)} 0 0 ${H.toFixed(3)} 0 0 cm\n/Im0 Do\nQ\n`;
    const objs=[ascii('<< /Type /Catalog /Pages 2 0 R >>'),ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(3)} ${H.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),join([ascii(`<< /Type /XObject /Subtype /Image /Width ${Math.round(iw)} /Height ${Math.round(ih)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`),img,ascii('\nendstream')]),ascii(`<< /Length ${ascii(stream).length} >>\nstream\n${stream}endstream`)];
    const parts=[ascii('%PDF-1.4\n%âãÏÓ\n')],off=[0];let cur=parts[0].length;objs.forEach((o,i)=>{off[i+1]=cur;const h=ascii(`${i+1} 0 obj\n`),t=ascii('\nendobj\n');parts.push(h,o,t);cur+=h.length+o.length+t.length});const xr=cur;let s=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)s+=`${String(off[i]).padStart(10,'0')} 00000 n \n`;s+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;parts.push(ascii(s));return new Blob([join(parts)],{type:'application/pdf'});
  }
  function safeName(){return(String(el.placeName&&el.placeName.value||'so-do-dia-diem-tham-dinh').trim()||'so-do-dia-diem-tham-dinh').replace(/[^a-zA-Z0-9\u00C0-\u024F_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}
  function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},1600)}
  function enterCanonical(){const d=canonical();document.body.classList.add('pdf-exporting','capture-mode');if(el.sheet){el.sheet.style.transform='none';el.sheet.style.boxShadow='none';el.sheet.style.outline='0';el.sheet.style.margin='0'}if(el.sheetViewport){el.sheetViewport.style.width=`${d.w}px`;el.sheetViewport.style.height=`${d.h}px`;el.sheetViewport.style.overflow='visible'}}
  function leaveCanonical(){document.body.classList.remove('pdf-exporting','capture-mode');if(el.sheet){el.sheet.style.margin='';el.sheet.style.boxShadow='';el.sheet.style.outline=''}window.dispatchEvent(new Event('resize'))}
  async function exportPdf(){
    if(exportBusy)return;exportBusy=true;renderAddress();
    try{
      setProgress(3,'Kiểm tra bản đồ…');if(!lastMapDataUrl||el.recordMap.classList.contains('hidden'))await rebuildMap(true);if(!lastMapDataUrl||el.recordMap.classList.contains('hidden'))throw Error('map-not-ready');
      setProgress(12,'Chuẩn bị bộ xuất…');await ensureHtml2Canvas();enterCanonical();await nextPaint();if(document.fonts&&document.fonts.ready)await document.fonts.ready;
      setProgress(32,'Đang chụp đúng bản xem trước…');
      const canvas=await window.html2canvas(el.sheet,{scale:3,useCORS:true,allowTaint:false,backgroundColor:'#fff',logging:false,imageTimeout:12000,scrollX:0,scrollY:0,onclone:doc=>{doc.body.classList.add('pdf-exporting','capture-mode');const rec=doc.getElementById('recordMapImage');if(rec){rec.classList.remove('hidden');rec.style.display='block';rec.style.width='100%';rec.style.height='100%';rec.style.objectFit='fill'}['mapIframe','staticMapImage','exportMapSurface','recordMapStatus'].forEach(id=>{const x=doc.getElementById(id);if(x)x.style.display='none'});doc.querySelectorAll('.road-rotate').forEach(x=>x.style.display='none')}});
      if(!canvas||canvas.width<1500||canvas.height<1900)throw Error('canvas-invalid');setProgress(74,'Đang đóng gói PDF…');const blob=pdfBlob(canvas.toDataURL('image/jpeg',.988),canvas.width,canvas.height,paperMode());if(blob.size<8000)throw Error('pdf-invalid');setProgress(94,'Đang lưu file…');download(blob,`${safeName()}-${paperMode().toUpperCase()}.pdf`);setProgress(100,'Hoàn tất');toast('Đã xuất PDF đúng bản xem trước.');setTimeout(()=>setProgress(100,'Sẵn sàng',true),1000);
    }catch(e){console.error('[v25 export]',e);setProgress(0,'Có lỗi khi xuất',false,true);toast(`Chưa xuất được PDF (${e&&e.message?e.message:'lỗi'}).`);setTimeout(()=>setProgress(0,'Sẵn sàng',true),2200)}finally{leaveCanonical();exportBusy=false}
  }

  // Địa chỉ phải hiển thị ngay, độc lập với việc bản đồ có tải hay không.
  if(el.address){el.address.addEventListener('input',()=>{renderAddress();scheduleMap(950)},true);el.address.addEventListener('change',()=>{renderAddress();scheduleMap(150)},true);}
  [el.lat,el.lng,el.mapsUrl].filter(Boolean).forEach(x=>{x.addEventListener('input',()=>scheduleMap(700),true);x.addEventListener('change',()=>scheduleMap(120),true)});
  if(el.zoom){el.zoom.addEventListener('input',()=>scheduleMap(500),true);el.zoom.addEventListener('change',()=>scheduleMap(100),true)}
  if(el.poiEnabled)el.poiEnabled.addEventListener('change',()=>rebuildMap(true));
  if(el.btnRefresh)el.btnRefresh.addEventListener('click',e=>{e.preventDefault();snapshotCache.clear();rebuildMap(true)});
  if(el.paperSize)el.paperSize.addEventListener('change',()=>setTimeout(()=>rebuildMap(true),80),true);
  ['btnPaperLetter','btnPaperA4'].forEach(id=>{const b=$(id);if(b)b.addEventListener('click',()=>setTimeout(()=>rebuildMap(true),120),true)});
  ['btnExportPdf','btnExportPdf2','btnQuickExportPdf'].forEach(id=>{const b=$(id);if(!b)return;b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();exportPdf()},true)});

  renderAddress();setSync('v25-building','Đang chuẩn bị bản đồ…');setTimeout(()=>rebuildMap(false),350);
})();
