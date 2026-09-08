(() => {
  'use strict';
  const VERSION='24.3';
  window.__QR_EXPORT_PATCH_VERSION__=VERSION;
  const $=id=>document.getElementById(id);
  const address=$('address'), addressOutput=$('addressOutput');
  const sheet=$('sheet'), sheetViewport=$('sheetViewport'), mapFrame=$('mapFrame'), exportMap=$('exportMapSurface');
  const paperSize=$('paperSize'), zoom=$('zoom'), lat=$('lat'), lng=$('lng'), mapsUrl=$('mapsUrl'), placeName=$('placeName');
  const progress=$('exportProgress'), progressText=$('exportProgressText'), progressPct=$('exportProgressPct'), progressBar=$('exportProgressBar');
  const previewSync=$('previewSyncStatus'), toolbar=document.querySelector('.preview-toolbar'), toastEl=$('toast');
  let busy=false;

  function toast(msg){
    if(!toastEl) return;
    toastEl.textContent=msg; toastEl.classList.add('show');
    clearTimeout(toast._t); toast._t=setTimeout(()=>toastEl.classList.remove('show'),2600);
  }
  function renderAddress(){
    if(!address || !addressOutput) return;
    const value=String(address.value||'').trim();
    addressOutput.replaceChildren();
    if(!value){
      addressOutput.classList.add('hidden');
      addressOutput.style.removeProperty('display');
      return;
    }
    const strong=document.createElement('strong'); strong.textContent='Địa chỉ:';
    const span=document.createElement('span'); span.textContent=value;
    addressOutput.append(strong,document.createTextNode(' '),span);
    addressOutput.classList.remove('hidden');
    addressOutput.style.display='block';
    addressOutput.style.zIndex='12';
  }
  if(address){
    address.addEventListener('input',renderAddress,true);
    address.addEventListener('change',renderAddress,true);
    renderAddress();
  }

  function setProgress(p,text,done=false,error=false){
    p=Math.max(0,Math.min(100,Math.round(Number(p)||0)));
    if(progress){
      progress.classList.toggle('hidden',!!done);
      progress.classList.toggle('error',!!error);
      if(progressText) progressText.textContent=text||'Đang xử lý…';
      if(progressPct) progressPct.textContent=`${p}%`;
      if(progressBar) progressBar.style.width=`${p}%`;
    }
    if(toolbar) toolbar.classList.toggle('export-busy',!done&&p<100&&!error);
    if(previewSync){
      previewSync.textContent=done?'Sẵn sàng':(text||'Đang xử lý…');
      previewSync.classList.toggle('warning',!done&&!error);
      previewSync.classList.toggle('error',!!error);
    }
  }

  function num(v){const n=Number(String(v??'').replace(',','.').trim());return Number.isFinite(n)?n:null;}
  function validCoords(){
    const a=num(lat&&lat.value), b=num(lng&&lng.value);
    return a!==null&&b!==null&&a>=-90&&a<=90&&b>=-180&&b<=180?{lat:a,lng:b}:null;
  }
  function parseMaps(raw){
    if(!raw) return null; let s=String(raw).trim(); try{s=decodeURIComponent(s)}catch(_){}
    const ps=[/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,/!3d(-?\d{1,2}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/,/[?&](?:q|query|destination)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,/(?:^|\s)(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)(?:$|\s)/];
    for(const re of ps){const m=s.match(re);if(m){const a=Number(m[1]),b=Number(m[2]);if(a>=-90&&a<=90&&b>=-180&&b<=180)return{lat:a,lng:b}}} return null;
  }
  async function geocode(q){
    q=String(q||'').trim(); if(!q) return null;
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=vi&q=${encodeURIComponent(q)}`,{headers:{Accept:'application/json'}});
      if(!r.ok)return null; const a=await r.json(),x=Array.isArray(a)&&a[0]; if(!x)return null;
      const la=Number(x.lat),lo=Number(x.lon); return Number.isFinite(la)&&Number.isFinite(lo)?{lat:la,lng:lo}:null;
    }catch(_){return null}
  }
  async function resolveCoords(){return validCoords()||parseMaps(mapsUrl&&mapsUrl.value)||await geocode(address&&address.value)}
  function paperMode(){return paperSize&&paperSize.value==='a4'?'a4':'letter'}
  function canonical(){return paperMode()==='a4'?{w:794,h:1123}:{w:816,h:1056}}
  function nextPaint(){return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}
  function enterCanonical(){
    const d=canonical(); document.body.classList.add('pdf-exporting','capture-mode');
    if(sheet){sheet.style.transform='none';sheet.style.margin='0';sheet.style.boxShadow='none';sheet.style.outline='0'}
    if(sheetViewport){sheetViewport.style.width=`${d.w}px`;sheetViewport.style.height=`${d.h}px`;sheetViewport.style.overflow='visible'}
  }
  function leaveCanonical(){
    document.body.classList.remove('pdf-exporting','capture-mode');
    if(sheet){sheet.style.margin='';sheet.style.boxShadow='';sheet.style.outline=''}
    if(exportMap) exportMap.removeAttribute('src');
    window.dispatchEvent(new Event('resize'));
  }

  function mercator(lat,lng,z){const n=2**z*256,x=(lng+180)/360*n,s=Math.sin(lat*Math.PI/180),y=(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n;return{x,y}}
  async function tileBitmap(url,timeout=7000){
    const ctrl=('AbortController'in window)?new AbortController():null,t=setTimeout(()=>{try{ctrl&&ctrl.abort()}catch(_){}},timeout);
    try{
      const r=await fetch(url,{mode:'cors',cache:'force-cache',signal:ctrl?ctrl.signal:undefined}); if(!r.ok)throw Error(`tile-${r.status}`);
      const blob=await r.blob(); if('createImageBitmap'in window)return await createImageBitmap(blob);
      return await new Promise((res,rej)=>{const i=new Image(),u=URL.createObjectURL(blob);i.onload=()=>{URL.revokeObjectURL(u);res(i)};i.onerror=()=>{URL.revokeObjectURL(u);rej(Error('tile-image'))};i.src=u});
    }finally{clearTimeout(t)}
  }
  async function tileWithFallback(z,x,y){
    // Chỉ dùng OpenStreetMap chuẩn. Không dùng CARTO vì một số endpoint
    // hiện trả tile có watermark "API KEY REQUIRED", làm file PDF không sử dụng được.
    const urls=[
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://b.tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://c.tile.openstreetmap.org/${z}/${x}/${y}.png`
    ];
    let last; for(const u of urls){try{return await tileBitmap(u)}catch(e){last=e}} throw last||Error('tile-failed');
  }
  function drawFallbackGrid(ctx,w,h,coords){
    ctx.fillStyle='#f2f5f6';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d7dfe3';ctx.lineWidth=2;
    for(let x=0;x<w;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
    for(let y=0;y<h;y+=120){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    ctx.strokeStyle='#c3cdd2';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,h*.38);ctx.lineTo(w,h*.62);ctx.stroke();ctx.beginPath();ctx.moveTo(w*.32,0);ctx.lineTo(w*.58,h);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(12,h-52,w-24,40);ctx.fillStyle='#475860';ctx.font='20px Arial';ctx.fillText(`Vị trí ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} • Quét QR để mở Google Maps`,22,h-25);
  }
  async function buildMap(coords){
    enterCanonical(); await nextPaint();
    const r=mapFrame.getBoundingClientRect(),lw=Math.max(320,Math.round(r.width)),lh=Math.max(420,Math.round(r.height)),scale=2;
    const c=document.createElement('canvas');c.width=lw*scale;c.height=lh*scale;const x=c.getContext('2d');x.fillStyle='#f2f5f6';x.fillRect(0,0,c.width,c.height);
    const z=Math.max(13,Math.min(19,Number(zoom&&zoom.value)||18)),world=mercator(coords.lat,coords.lng,z),left=world.x-lw/2,top=world.y-lh/2;
    const minX=Math.floor(left/256)-1,maxX=Math.floor((left+lw)/256)+1,minY=Math.floor(top/256)-1,maxY=Math.floor((top+lh)/256)+1,maxTile=2**z,jobs=[];
    for(let ty=minY;ty<=maxY;ty++){if(ty<0||ty>=maxTile)continue;for(let tx=minX;tx<=maxX;tx++){const wx=((tx%maxTile)+maxTile)%maxTile;jobs.push({x:wx,y:ty,dx:(tx*256-left)*scale,dy:(ty*256-top)*scale})}}
    let ok=0,done=0;await Promise.all(jobs.map(async j=>{try{const im=await tileWithFallback(z,j.x,j.y);x.drawImage(im,j.dx,j.dy,512,512);if(im&&typeof im.close==='function')try{im.close()}catch(_){};ok++}catch(_){}done++;setProgress(18+Math.round(done/Math.max(1,jobs.length)*36),'Đang dựng nền bản đồ…')}));
    if(!ok) drawFallbackGrid(x,c.width,c.height,coords);
    const credit=ok?'© OpenStreetMap contributors':'Nền bản đồ dự phòng';x.font='20px Arial';const tw=x.measureText(credit).width;x.fillStyle='rgba(255,255,255,.86)';x.fillRect(c.width-tw-22,c.height-34,tw+18,30);x.fillStyle='#4d5b63';x.fillText(credit,c.width-tw-13,c.height-12);
    const data=c.toDataURL('image/png'); exportMap.src=data;
    await new Promise((res,rej)=>{if(exportMap.complete&&exportMap.naturalWidth>0)return res();const t=setTimeout(()=>rej(Error('map-image-timeout')),5000);exportMap.onload=()=>{clearTimeout(t);res()};exportMap.onerror=()=>{clearTimeout(t);rej(Error('map-image-error'))}});await nextPaint();
  }

  function loadScript(urls,ready){if(ready())return Promise.resolve();return new Promise((res,rej)=>{let i=0;const n=()=>{if(ready())return res();if(i>=urls.length)return rej(Error('html2canvas-load'));const s=document.createElement('script');s.src=urls[i++];s.async=true;s.onload=()=>ready()?res():n();s.onerror=n;document.head.appendChild(s)};n()})}
  async function ensureHtml2Canvas(){return loadScript(['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'],()=>typeof window.html2canvas==='function')}
  function bytesFromDataUrl(u){const b=atob(u.slice(u.indexOf(',')+1)),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
  const ascii=s=>new TextEncoder().encode(s);
  function join(parts){const n=parts.reduce((a,p)=>a+p.length,0),o=new Uint8Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length}return o}
  function pdfBlob(jpegUrl,iw,ih,mode){
    const img=bytesFromDataUrl(jpegUrl);if(img.length<1000)throw Error('image-data');const W=mode==='a4'?595.276:612,H=mode==='a4'?841.89:792,stream=`q\n${W.toFixed(3)} 0 0 ${H.toFixed(3)} 0 0 cm\n/Im0 Do\nQ\n`;
    const objs=[ascii('<< /Type /Catalog /Pages 2 0 R >>'),ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(3)} ${H.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),join([ascii(`<< /Type /XObject /Subtype /Image /Width ${Math.round(iw)} /Height ${Math.round(ih)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`),img,ascii('\nendstream')]),ascii(`<< /Length ${ascii(stream).length} >>\nstream\n${stream}endstream`)];
    const parts=[ascii('%PDF-1.4\n%âãÏÓ\n')],off=[0];let cur=parts[0].length;objs.forEach((o,i)=>{off[i+1]=cur;const h=ascii(`${i+1} 0 obj\n`),t=ascii('\nendobj\n');parts.push(h,o,t);cur+=h.length+o.length+t.length});const xr=cur;let s=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)s+=`${String(off[i]).padStart(10,'0')} 00000 n \n`;s+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;parts.push(ascii(s));return new Blob([join(parts)],{type:'application/pdf'})
  }
  function safeName(){return(String(placeName&&placeName.value||'so-do-dia-diem-tham-dinh').trim()||'so-do-dia-diem-tham-dinh').replace(/[^a-zA-Z0-9\u00C0-\u024F_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}
  function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},1500)}

  async function exportPdf(){
    if(busy)return;busy=true;renderAddress();
    try{
      setProgress(4,'Kiểm tra bộ xuất…');await ensureHtml2Canvas();
      setProgress(10,'Xác định vị trí…');const coords=await resolveCoords();if(!coords)throw Error('no-coords');
      setProgress(18,'Chuẩn bị bản đồ…');await buildMap(coords);
      setProgress(62,'Đang tạo ảnh chất lượng cao…');if(document.fonts&&document.fonts.ready)await document.fonts.ready;await nextPaint();
      const canvas=await window.html2canvas(sheet,{scale:3,useCORS:true,allowTaint:false,backgroundColor:'#fff',logging:false,imageTimeout:12000,scrollX:0,scrollY:0,onclone:doc=>{doc.body.classList.add('pdf-exporting','capture-mode');const i=doc.getElementById('mapIframe');if(i)i.style.display='none';const st=doc.getElementById('staticMapImage');if(st)st.style.display='none';const ex=doc.getElementById('exportMapSurface');if(ex){ex.style.display='block';ex.style.width='100%';ex.style.height='100%';ex.style.objectFit='fill'}doc.querySelectorAll('.road-rotate').forEach(e=>e.style.display='none')}});
      if(!canvas||canvas.width<1000||canvas.height<1400)throw Error('canvas');setProgress(82,'Đang đóng gói PDF…');const blob=pdfBlob(canvas.toDataURL('image/jpeg',.985),canvas.width,canvas.height,paperMode());if(blob.size<5000)throw Error('pdf');setProgress(94,'Đang lưu file…');download(blob,`${safeName()}-${paperMode().toUpperCase()}.pdf`);setProgress(100,'Hoàn tất');toast('Đã xuất PDF.');setTimeout(()=>setProgress(100,'Sẵn sàng',true),1000);
    }catch(e){console.error('[QR v24 export]',e);setProgress(0,'Có lỗi khi xuất',false,true);if(e&&e.message==='no-coords')toast('Không xác định được vị trí. Hãy nhập tọa độ, link Google Maps hoặc địa chỉ rõ hơn.');else if(e&&e.message==='html2canvas-load')toast('Không tải được bộ chụp biểu mẫu. Kiểm tra Internet rồi thử lại.');else toast(`Xuất PDF chưa hoàn tất (${e&&e.message?e.message:'lỗi không xác định'}).`);setTimeout(()=>setProgress(0,'Sẵn sàng',true),2200)}finally{leaveCanonical();busy=false}
  }

  ['btnExportPdf','btnExportPdf2','btnQuickExportPdf'].forEach(id=>{const b=$(id);if(!b)return;b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();exportPdf()},true)});
  if(previewSync){previewSync.title='v24.3: Địa chỉ hiển thị tức thời; PDF dùng OpenStreetMap không cần API key';previewSync.textContent='Sẵn sàng'}
})();
