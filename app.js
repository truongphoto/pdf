(() => {
  'use strict';
  // v23: sửa địa chỉ, jsPDF CDN, kiểm tra thư viện và xuất PDF an toàn.

  const $ = (id) => document.getElementById(id);
  const els = {
    placeName:$('placeName'), address:$('address'), mapsUrl:$('mapsUrl'), lat:$('lat'), lng:$('lng'), zoom:$('zoom'), zoomValue:$('zoomValue'),
    travelMode:$('travelMode'), btnParse:$('btnParse'), btnOpenMap:$('btnOpenMap'), btnTestQr:$('btnTestQr'), locationStatus:$('locationStatus'),
    iconChoices:$('iconChoices'), customIconInput:$('customIconInput'), btnCustomIcon:$('btnCustomIcon'), markerSize:$('markerSize'), markerSizeValue:$('markerSizeValue'),
    qrLogoMode:$('qrLogoMode'), qrCustomWrap:$('qrCustomWrap'), qrCustomInput:$('qrCustomInput'), qrLogoSize:$('qrLogoSize'), qrLogoSizeValue:$('qrLogoSizeValue'),
    qrBoxSize:$('qrBoxSize'), qrBoxSizeValue:$('qrBoxSizeValue'), btnQrSmaller:$('btnQrSmaller'), btnQrDefault:$('btnQrDefault'), btnQrLarger:$('btnQrLarger'),
    roadNames:$('roadNames'), btnApplyRoadLabels:$('btnApplyRoadLabels'), btnClearRoadLabels:$('btnClearRoadLabels'), roadLabelsLayer:$('roadLabelsLayer'),
    note:$('note'), noteEnabled:$('noteEnabled'), noteControls:$('noteControls'), noteCount:$('noteCount'), noteFontSize:$('noteFontSize'), noteFontSizeValue:$('noteFontSizeValue'), googleApiKey:$('googleApiKey'), mapIframe:$('mapIframe'), staticMapImage:$('staticMapImage'), mapEmpty:$('mapEmpty'), mapFrame:$('mapFrame'), addressOutput:$('addressOutput'),
    markerWrap:$('markerWrap'), markerIcon:$('markerIcon'), placeLabel:$('placeLabel'), qrcode:$('qrcode'), qrLogoOverlay:$('qrLogoOverlay'), noteOutput:$('noteOutput'),
    btnPrint:$('btnPrint'), btnPrint2:$('btnPrint2'), btnExportPdf:$('btnExportPdf'), btnExportPdf2:$('btnExportPdf2'), btnDownloadQr:$('btnDownloadQr'), btnCopyLink:$('btnCopyLink'), qrCard:$('qrCard'), toast:$('toast'),
    paperSize:$('paperSize'), paperSizeHint:$('paperSizeHint'), previewMeta:$('previewMeta'),
    btnPaperLetter:$('btnPaperLetter'), btnPaperA4:$('btnPaperA4'),
    btnRefreshAll:$('btnRefreshAll'), btnQuickTestQr:$('btnQuickTestQr'), btnQuickPrint:$('btnQuickPrint'), btnQuickExportPdf:$('btnQuickExportPdf'), exportProgress:$('exportProgress'), exportProgressText:$('exportProgressText'), exportProgressPct:$('exportProgressPct'), exportProgressBar:$('exportProgressBar'), exportMapSurface:$('exportMapSurface'),
    mapsApiBox:$('mapsApiBox'), apiKeyStatus:$('apiKeyStatus'), btnToggleApiKey:$('btnToggleApiKey'), btnTestApiKey:$('btnTestApiKey'),
    sheet:$('sheet'), sheetViewport:$('sheetViewport'), previewArea:document.querySelector('.preview-area'), previewToolbar:document.querySelector('.preview-toolbar'), previewSyncStatus:$('previewSyncStatus')
  };

  let selectedMarker = 'assets/icons/y-te.svg';
  let lastAutoPlaceName = '';
  let customMarkerData = '';
  let customQrLogoData = '';
  let qrObject = null;
  let updateTimer = null;
  let exportBusy = false;
  let markerPos = {x:50, y:50};
  let roadLabels = [];
  const QR_DEFAULT_SIZE = 15.4;
  let lastMapKey = '';
  let lastDestination = '';

  function toast(msg){
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function num(v){
    const n = Number(String(v).replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
  }

  function clamp(v, min, max){
    return Math.min(max, Math.max(min, v));
  }

  function applyMarkerPosition(){
    els.markerWrap.style.left = `${markerPos.x}%`;
    els.markerWrap.style.top = `${markerPos.y}%`;
  }

  function resetMarkerPosition(){
    markerPos = {x:50, y:50};
    applyMarkerPosition();
  }

  function setQrSize(value){
    const next = clamp(Number(value) || QR_DEFAULT_SIZE, 11, 20);
    els.qrBoxSize.value = next.toFixed(1);
    els.qrBoxSizeValue.textContent = next.toFixed(1);
    els.qrCard.style.width = `${next}%`;
  }

  function changeQrSize(delta){
    setQrSize(Number(els.qrBoxSize.value) + delta);
  }


  function paperMode(){
    return els.paperSize && els.paperSize.value === 'a4' ? 'a4' : 'letter';
  }


  function canonicalPagePx(){
    return paperMode() === 'a4' ? {width:794,height:1123} : {width:816,height:1056};
  }

  function setPreviewSyncStatus(kind, text){
    if(!els.previewSyncStatus) return;
    els.previewSyncStatus.className = `preview-sync-status ${kind || 'warning'}`;
    els.previewSyncStatus.textContent = text || '';
  }

  function fitPreviewSheet(){
    if(!els.sheet || !els.sheetViewport || !els.previewArea) return;
    if(document.body.classList.contains('capture-mode') || document.body.classList.contains('pdf-exporting')) return;
    const dims = canonicalPagePx();
    const areaRect = els.previewArea.getBoundingClientRect();
    const desktop = window.innerWidth > 1100;
    let availableW = Math.max(260, areaRect.width - (desktop ? 62 : 12));
    let availableH = desktop ? Math.max(360, areaRect.height - 14) : Number.POSITIVE_INFINITY;
    if(!desktop && els.previewToolbar){
      availableH = Number.POSITIVE_INFINITY;
    }
    let scale = Math.min(1, availableW / dims.width, availableH / dims.height);
    if(!Number.isFinite(scale) || scale <= 0) scale = 1;
    scale = Math.max(0.22, scale);
    els.sheet.style.transform = `scale(${scale})`;
    els.sheetViewport.style.width = `${Math.round(dims.width * scale)}px`;
    els.sheetViewport.style.height = `${Math.round(dims.height * scale)}px`;
  }

  function setCanonicalSheetMode(enabled){
    if(!els.sheet || !els.sheetViewport) return;
    const dims = canonicalPagePx();
    if(enabled){
      document.body.classList.add('capture-mode');
      els.sheet.style.transform = 'none';
      els.sheetViewport.style.width = `${dims.width}px`;
      els.sheetViewport.style.height = `${dims.height}px`;
    }else{
      document.body.classList.remove('capture-mode');
      requestAnimationFrame(fitPreviewSheet);
    }
  }

  async function nextPaint(){
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function updatePaperUi(){
    const mode = paperMode();
    document.body.dataset.paper = mode;
    if(els.btnPaperLetter) els.btnPaperLetter.classList.toggle('active', mode === 'letter');
    if(els.btnPaperA4) els.btnPaperA4.classList.toggle('active', mode === 'a4');
    if(mode === 'a4'){
      if(els.paperSizeHint) els.paperSizeHint.textContent = 'A4 toàn trang 210 × 297 mm, không còn dải trắng phía dưới khi xuất.';
      if(els.previewMeta) els.previewMeta.textContent = 'Khổ xuất A4 • 210 × 297 mm • Toàn trang';
    }else{
      if(els.paperSizeHint) els.paperSizeHint.textContent = 'Letter giữ đúng kích thước biểu mẫu gốc.';
      if(els.previewMeta) els.previewMeta.textContent = 'Biểu mẫu gốc • Letter 8.5 × 11 inch';
    }
    requestAnimationFrame(fitPreviewSheet);
  }

  function applyPrintPageStyle(){
    let style = document.getElementById('dynamicPrintPage');
    if(!style){
      style = document.createElement('style');
      style.id = 'dynamicPrintPage';
      document.head.appendChild(style);
    }
    if(paperMode() === 'a4'){
      style.textContent = `@page{size:A4 portrait;margin:0}\n@media print{body[data-paper="a4"] .sheet-viewport{width:794px!important;height:1123px!important}body[data-paper="a4"] .sheet{width:794px!important;height:1123px!important}}`;
    }else{
      style.textContent = `@page{size:Letter portrait;margin:0}\n@media print{body[data-paper="letter"] .sheet-viewport{width:816px!important;height:1056px!important}body[data-paper="letter"] .sheet{width:816px!important;height:1056px!important}}`;
    }
  }

  function safeBaseName(){
    return (els.placeName.value.trim() || 'so-do-dia-diem-tham-dinh')
      .replace(/[^a-zA-Z0-9\u00C0-\u024F_-]+/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'') || 'so-do-dia-diem-tham-dinh';
  }

  function setApiKeyStatus(kind, text){
    if(!els.apiKeyStatus) return;
    els.apiKeyStatus.className = `api-key-status ${kind || 'neutral'}`;
    els.apiKeyStatus.textContent = text || 'Không bắt buộc';
  }

  function staticMapRequestSize(){
    // Khung bản đồ cao hơn rộng. Yêu cầu ảnh Google cùng tỷ lệ khung để không bị
    // object-fit cắt mất mép phải hoặc mép dưới khi xuất PDF.
    const pageRatio = paperMode() === 'a4' ? (210 / 297) : (8.5 / 11);
    const frameRatio = (0.7808 * pageRatio) / 0.7970;
    const height = 640;
    const width = Math.max(320, Math.min(640, Math.round(height * frameRatio)));
    return `${width}x${height}`;
  }

  function staticMapUrl(center, zoom, key, size=staticMapRequestSize(), scale=2){
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(center)}&zoom=${encodeURIComponent(zoom)}&size=${encodeURIComponent(size)}&scale=${encodeURIComponent(scale)}&maptype=roadmap&format=png32&language=vi&region=VN&key=${encodeURIComponent(key)}`;
  }

  function testStaticMapsKey(){
    const key = els.googleApiKey.value.trim();
    if(!key){
      setApiKeyStatus('error','Chưa nhập key');
      if(els.mapsApiBox) els.mapsApiBox.open = true;
      els.googleApiKey.focus();
      toast('Hãy dán Google Static Maps API key trước.');
      return;
    }
    setApiKeyStatus('pending','Đang kiểm tra…');
    const center = destinationText() || '10.762622,106.660172';
    const img = new Image();
    let finished = false;
    const done = (ok) => {
      if(finished) return;
      finished = true;
      clearTimeout(timer);
      if(ok){
        setApiKeyStatus('ok','Đã tải bản đồ');
        toast('Google Static Maps đã phản hồi. Có thể Export PDF.');
        updateMap();
      }else{
        setApiKeyStatus('error','Không tải được');
        toast('Không tải được bản đồ tĩnh. Kiểm tra key, billing và Maps Static API.');
      }
    };
    img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => done(false);
    const timer = setTimeout(() => done(false), 9000);
    img.src = staticMapUrl(center, Math.min(Number(els.zoom.value)||17, 18), key, '320x180', 1) + `&cb=${Date.now()}`;
  }

  function waitForStaticMap(timeout=10000){
    return new Promise((resolve, reject) => {
      if(els.staticMapImage.complete && els.staticMapImage.naturalWidth > 0){ resolve(); return; }
      let done = false;
      const cleanup = () => {
        els.staticMapImage.removeEventListener('load', onLoad);
        els.staticMapImage.removeEventListener('error', onError);
      };
      const onLoad = () => { if(done) return; done=true; cleanup(); resolve(); };
      const onError = () => { if(done) return; done=true; cleanup(); reject(new Error('static-map-error')); };
      els.staticMapImage.addEventListener('load', onLoad, {once:true});
      els.staticMapImage.addEventListener('error', onError, {once:true});
      setTimeout(() => { if(done) return; done=true; cleanup(); reject(new Error('static-map-timeout')); }, timeout);
    });
  }

  async function renderExactSheetCanvas(){
    if(!destinationText()) throw new Error('missing-destination');
    const html2canvasFn = window.html2canvas;
    if(typeof html2canvasFn !== 'function') throw new Error('missing-html2canvas');
    const key = els.googleApiKey.value.trim();
    if(!key) throw new Error('missing-static-map-key');

    updatePaperUi();
    updateMap();
    await waitForStaticMap(12000);
    setCanonicalSheetMode(true);
    await nextPaint();
    try{
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      return await html2canvasFn(els.sheet, {
        scale:2.15,
        useCORS:true,
        allowTaint:false,
        backgroundColor:'#ffffff',
        logging:false,
        scrollX:0,
        scrollY:0,
        windowWidth:1440,
        windowHeight:1600,
        onclone:(doc)=>{
          doc.body.classList.add('capture-mode');
          const cloneMap=doc.getElementById('staticMapImage');
          const cloneIframe=doc.getElementById('mapIframe');
          const cloneSheet=doc.getElementById('sheet');
          if(cloneSheet){ cloneSheet.style.transform='none'; cloneSheet.style.boxShadow='none'; cloneSheet.style.outline='0'; }
          if(cloneMap){
            cloneMap.classList.remove('hidden');
            cloneMap.style.display='block'; cloneMap.style.width='100%'; cloneMap.style.height='100%'; cloneMap.style.objectFit='fill';
          }
          if(cloneIframe) cloneIframe.style.display='none';
        }
      });
    }finally{
      setCanonicalSheetMode(false);
    }
  }

  async function doKeylessBrowserPrint(saveAsPdf=false){
    updatePaperUi();
    applyPrintPageStyle();
    updateMap();
    await nextPaint();
    // Google Maps nhúng là nội dung khác miền nên JavaScript không thể chụp thành ảnh
    // trực tiếp. Trình duyệt vẫn có thể in chính trang xem trước, vì vậy đây là
    // chế độ mặc định không cần API key.
    await new Promise(resolve => setTimeout(resolve, 650));
    toast(saveAsPdf ? 'Không cần API key: trong hộp thoại hãy chọn “Save as PDF / Lưu dưới dạng PDF”.' : 'Đang mở hộp thoại In bằng Google Maps hiện tại.');
    setTimeout(() => window.print(), 80);
  }

  async function doExportPdf(){ return exportPdfSilent(); }

  function roadLabelDefaults(index){
    const positions = [
      [35,30],[65,30],[32,50],[68,50],[36,70],[64,70],[50,40],[50,62]
    ];
    return positions[index % positions.length];
  }

  function normalizedRoadNames(){
    return els.roadNames.value.split(/\n|;/).map(v => v.trim()).filter(Boolean).slice(0,8);
  }

  function renderRoadLabels(resetPositions=false){
    const names = normalizedRoadNames();
    if(resetPositions || roadLabels.length !== names.length){
      roadLabels = names.map((text, index) => {
        const old = roadLabels[index];
        const pos = roadLabelDefaults(index);
        return {text, x: old && !resetPositions ? old.x : pos[0], y: old && !resetPositions ? old.y : pos[1], angle: old && !resetPositions ? (old.angle || 0) : 0};
      });
    }else{
      roadLabels.forEach((item, index) => item.text = names[index] || item.text);
    }

    els.roadLabelsLayer.innerHTML = '';
    roadLabels.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'road-label';
      el.dataset.index = String(index);
      el.style.left = `${item.x}%`;
      el.style.top = `${item.y}%`;
      el.style.setProperty('--road-angle', `${item.angle || 0}deg`);

      const textEl = document.createElement('span');
      textEl.className = 'road-label-text';
      textEl.textContent = item.text;
      el.appendChild(textEl);

      const rotateBtn = document.createElement('button');
      rotateBtn.type = 'button';
      rotateBtn.className = 'road-rotate';
      rotateBtn.textContent = '↻';
      rotateBtn.title = 'Xoay 15°. Giữ Shift để xoay ngược';
      rotateBtn.setAttribute('aria-label', `Xoay nhãn ${item.text}`);
      el.appendChild(rotateBtn);

      els.roadLabelsLayer.appendChild(el);
    });
  }

  function validCoords(){
    const lat = num(els.lat.value), lng = num(els.lng.value);
    return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? {lat,lng} : null;
  }

  function destinationText(){
    const c = validCoords() || parseGoogleMapsUrl(els.mapsUrl.value);
    if(c) return `${c.lat},${c.lng}`;
    const a = els.address.value.trim();
    return a || '';
  }

  function exportCoords(){
    return validCoords() || parseGoogleMapsUrl(els.mapsUrl.value);
  }

  async function geocodeAddressForExport(address){
    const q = String(address || '').trim();
    if(!q) return null;
    try{
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=vi&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {headers:{'Accept':'application/json'}});
      if(!res.ok) return null;
      const data = await res.json();
      const item = Array.isArray(data) && data[0];
      if(!item) return null;
      const lat = Number(item.lat), lng = Number(item.lon);
      if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {lat,lng};
    }catch(_){ return null; }
  }

  async function resolveExportCoords(){
    return exportCoords() || await geocodeAddressForExport(els.address.value);
  }

  function updateAddressOutput(){
    if(!els.addressOutput || !els.address) return;
    const value=els.address.value.trim();
    els.addressOutput.replaceChildren();
    if(value){
      const strong=document.createElement('strong');
      strong.textContent='Địa chỉ:';
      els.addressOutput.append(strong, document.createTextNode(` ${value}`));
      els.addressOutput.classList.remove('hidden');
      els.addressOutput.style.display='block';
    }else{
      els.addressOutput.classList.add('hidden');
      els.addressOutput.style.removeProperty('display');
    }
  }

  function directionsUrl(){
    const d = destinationText();
    if(!d) return '';
    const mode = els.travelMode.value || 'driving';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}&travelmode=${encodeURIComponent(mode)}&hl=vi`;
  }

  function placeMapUrl(){
    const d = destinationText();
    if(!d) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d)}&hl=vi`;
  }

  function parseGoogleMapsUrl(raw){
    if(!raw) return null;
    let s = String(raw).trim();
    try{s = decodeURIComponent(s);}catch(_){ }
    const patterns = [
      /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
      /!3d(-?\d{1,2}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/,
      /[?&](?:q|query|destination)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
      /(?:^|\s)(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)(?:$|\s)/
    ];
    for(const re of patterns){
      const m = s.match(re);
      if(m){
        const lat = Number(m[1]), lng = Number(m[2]);
        if(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return {lat,lng};
      }
    }
    return null;
  }

  function setStatus(msg, isError=false){
    els.locationStatus.textContent = msg || '';
    els.locationStatus.classList.toggle('error', !!isError);
  }

  function updateMap(){
    const d = destinationText();
    const zoom = els.zoom.value;
    const key = els.googleApiKey.value.trim();
    const requestSize = key ? staticMapRequestSize() : '';
    const mapKey = `${d}|${zoom}|${key ? 'static' : 'embed'}|${paperMode()}|${requestSize}`;
    els.zoomValue.textContent = zoom;

    if(!d){
      els.mapIframe.src = 'about:blank';
      els.staticMapImage.removeAttribute('src');
      els.mapIframe.classList.remove('hidden');
      els.staticMapImage.classList.add('hidden');
      els.mapEmpty.classList.remove('hidden');
      lastMapKey = '';
      lastDestination = '';
      resetMarkerPosition();
      setStatus('Hãy nhập tọa độ, link Google Maps hoặc địa chỉ để xác định vị trí.');
      setPreviewSyncStatus('warning','Chưa có bản đồ');
      return;
    }

    // Chỉ trả ghim về giữa khi điểm đến thật sự đổi. Đổi địa chỉ hồ sơ trong khi
    // đã có tọa độ sẽ không làm bản đồ tải lại hoặc mất vị trí đã căn.
    if(d !== lastDestination){
      lastDestination = d;
      resetMarkerPosition();
    }

    els.mapEmpty.classList.add('hidden');

    // Tránh gán lại cùng một URL ảnh/iframe mỗi lần gõ tên cơ sở, địa chỉ hồ sơ,
    // lưu ý... Việc reload liên tục là nguyên nhân dễ làm bản đồ trắng/cắt khi in ngay.
    if(mapKey === lastMapKey){
      setStatus(key ? 'Bản đồ tĩnh đã sẵn sàng cho In / Export PDF.' : (validCoords() || parseGoogleMapsUrl(els.mapsUrl.value) ? 'Đã xác định vị trí chính xác.' : 'Đang dùng địa chỉ để xác định vị trí. Nên kiểm tra lại trước khi in.'));
      return;
    }
    lastMapKey = mapKey;

    if(key){
      const staticUrl = staticMapUrl(d, zoom, key, requestSize, 2);
      els.staticMapImage.src = staticUrl;
      els.staticMapImage.classList.remove('hidden');
      els.mapIframe.classList.add('hidden');
      setStatus('Đang tải Google Static Maps cho bản in/PDF.');
      setPreviewSyncStatus('ok','1:1 Static Map');
    }else{
      els.mapIframe.src = `https://www.google.com/maps?q=${encodeURIComponent(d)}&z=${encodeURIComponent(zoom)}&hl=vi&gl=VN&output=embed`;
      els.mapIframe.classList.remove('hidden');
      els.staticMapImage.classList.add('hidden');
      setStatus(validCoords() || parseGoogleMapsUrl(els.mapsUrl.value) ? 'Đã xác định vị trí bằng tọa độ/link Maps.' : 'Đang xác định vị trí theo địa chỉ. Nên kiểm tra lại trước khi in.');
      setPreviewSyncStatus('ok','Xem trước = Xuất');
    }
  }

  function currentMarkerSrc(){
    if(selectedMarker === 'none') return '';
    if(selectedMarker === 'custom') return customMarkerData || '';
    return selectedMarker;
  }

  function updateMarker(){
    const src = currentMarkerSrc();
    const name = els.placeName.value.trim() || 'Vị trí thẩm định';
    els.placeLabel.textContent = name;
    els.markerIcon.style.width = `${els.markerSize.value}px`;
    els.markerSizeValue.textContent = els.markerSize.value;
    applyMarkerPosition();
    if(src){
      els.markerIcon.src = src;
      els.markerIcon.classList.remove('hidden');
      els.markerWrap.classList.remove('text-only');
    }else{
      els.markerIcon.classList.add('hidden');
      els.markerWrap.classList.add('text-only');
    }
  }

  function qrLogoSrc(){
    const mode = els.qrLogoMode.value;
    if(mode === 'none') return '';
    if(mode === 'custom') return customQrLogoData || '';
    return currentMarkerSrc();
  }

  function renderQr(){
    const url = directionsUrl();
    els.qrcode.innerHTML = '';
    els.qrLogoSizeValue.textContent = els.qrLogoSize.value;
    const logo = qrLogoSrc();
    if(logo){
      els.qrLogoOverlay.src = logo;
      els.qrLogoOverlay.style.width = `${els.qrLogoSize.value}%`;
      els.qrLogoOverlay.style.height = `${els.qrLogoSize.value}%`;
      els.qrLogoOverlay.classList.remove('hidden');
    }else{
      els.qrLogoOverlay.classList.add('hidden');
      els.qrLogoOverlay.removeAttribute('src');
    }

    if(!url){
      els.qrcode.innerHTML = '<div style="font-size:11px;color:#7a8790;text-align:center;padding:8px">Chưa có vị trí</div>';
      return;
    }

    if(typeof window.QRCode === 'function'){
      qrObject = new QRCode(els.qrcode, {
        text:url,
        width:300,
        height:300,
        colorDark:'#000000',
        colorLight:'#ffffff',
        correctLevel: logo ? QRCode.CorrectLevel.H : QRCode.CorrectLevel.M
      });
    }else{
      const img = new Image();
      img.alt = 'QR chỉ đường';
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=${logo?'H':'M'}&data=${encodeURIComponent(url)}`;
      els.qrcode.appendChild(img);
    }
  }

  function updateNote(){
    const enabled = !!(els.noteEnabled && els.noteEnabled.checked);
    const v = els.note.value.trim();
    const fontSize = Math.max(9, Math.min(12.5, Number(els.noteFontSize && els.noteFontSize.value) || 9));
    if(els.noteControls) els.noteControls.classList.toggle('hidden', !enabled);
    els.noteCount.textContent = els.note.value.length;
    if(els.noteFontSizeValue) els.noteFontSizeValue.textContent = Number.isInteger(fontSize) ? String(fontSize) : fontSize.toFixed(1);
    els.noteOutput.style.setProperty('--note-font-size', String(fontSize));
    const span = els.noteOutput.querySelector('span');
    span.textContent = v || '';
    // Không có lưu ý hoặc chưa chọn "Có lưu ý" thì không chiếm chỗ trên biểu mẫu.
    els.noteOutput.classList.toggle('hidden', !enabled || !v);
  }

  function scheduleUpdate(){
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateMap();
      updateMarker();
      renderQr();
      updateNote();
      updateAddressOutput();
    }, 180);
  }

  function readFileAsDataUrl(file, cb){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result || ''));
    reader.onerror = () => toast('Không đọc được file ảnh.');
    reader.readAsDataURL(file);
  }

  function selectIconButton(button){
    document.querySelectorAll('.icon-choice').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
  }



  function initRoadLabelDrag(){
    let draggingEl = null;
    let draggingIndex = -1;

    const selectLabel = (label) => {
      els.roadLabelsLayer.querySelectorAll('.road-label').forEach(el => el.classList.toggle('selected', el === label));
    };

    const applyAngle = (label, index, angle) => {
      const normalized = ((angle + 180) % 360 + 360) % 360 - 180;
      roadLabels[index].angle = normalized;
      label.style.setProperty('--road-angle', `${normalized}deg`);
      selectLabel(label);
    };

    const update = (event) => {
      if(!draggingEl || draggingIndex < 0) return;
      const rect = els.mapFrame.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95);
      const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 5, 95);
      roadLabels[draggingIndex].x = x;
      roadLabels[draggingIndex].y = y;
      draggingEl.style.left = `${x}%`;
      draggingEl.style.top = `${y}%`;
    };

    els.roadLabelsLayer.addEventListener('click', (event) => {
      const rotateBtn = event.target.closest('.road-rotate');
      if(rotateBtn){
        const label = rotateBtn.closest('.road-label');
        const index = Number(label && label.dataset.index);
        if(!label || !Number.isInteger(index) || !roadLabels[index]) return;
        const delta = event.shiftKey ? -15 : 15;
        applyAngle(label, index, (roadLabels[index].angle || 0) + delta);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const label = event.target.closest('.road-label');
      if(label) selectLabel(label);
    });

    els.roadLabelsLayer.addEventListener('contextmenu', (event) => {
      const rotateBtn = event.target.closest('.road-rotate');
      if(!rotateBtn) return;
      const label = rotateBtn.closest('.road-label');
      const index = Number(label && label.dataset.index);
      if(!label || !Number.isInteger(index) || !roadLabels[index]) return;
      applyAngle(label, index, (roadLabels[index].angle || 0) - 15);
      event.preventDefault();
    });

    els.roadLabelsLayer.addEventListener('wheel', (event) => {
      if(!event.shiftKey) return;
      const label = event.target.closest('.road-label');
      if(!label) return;
      const index = Number(label.dataset.index);
      if(!Number.isInteger(index) || !roadLabels[index]) return;
      const delta = event.deltaY > 0 ? 5 : -5;
      applyAngle(label, index, (roadLabels[index].angle || 0) + delta);
      event.preventDefault();
    }, {passive:false});

    els.roadLabelsLayer.addEventListener('pointerdown', (event) => {
      if(event.target.closest('.road-rotate')) return;
      const label = event.target.closest('.road-label');
      if(!label) return;
      const index = Number(label.dataset.index);
      if(!Number.isInteger(index) || !roadLabels[index]) return;
      draggingEl = label;
      draggingIndex = index;
      selectLabel(label);
      label.classList.add('dragging');
      if(label.setPointerCapture){
        try { label.setPointerCapture(event.pointerId); } catch(_) {}
      }
      update(event);
      event.preventDefault();
    });

    window.addEventListener('pointermove', (event) => {
      if(draggingEl) update(event);
    });

    const stop = (event) => {
      if(!draggingEl) return;
      draggingEl.classList.remove('dragging');
      if(event && draggingEl.releasePointerCapture){
        try { draggingEl.releasePointerCapture(event.pointerId); } catch(_) {}
      }
      draggingEl = null;
      draggingIndex = -1;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function initMarkerDrag(){
    let dragging = false;

    const updateFromPointer = (event) => {
      const rect = els.mapFrame.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      markerPos.x = clamp(x, 4, 96);
      markerPos.y = clamp(y, 6, 98);
      applyMarkerPosition();
    };

    els.markerWrap.addEventListener('pointerdown', (event) => {
      if(event.button !== undefined && event.button !== 0) return;
      dragging = true;
      els.markerWrap.classList.add('dragging');
      if(els.markerWrap.setPointerCapture){
        try { els.markerWrap.setPointerCapture(event.pointerId); } catch(_) {}
      }
      updateFromPointer(event);
      event.preventDefault();
    });

    window.addEventListener('pointermove', (event) => {
      if(!dragging) return;
      updateFromPointer(event);
    });

    const stopDragging = (event) => {
      if(!dragging) return;
      dragging = false;
      els.markerWrap.classList.remove('dragging');
      if(event && els.markerWrap.releasePointerCapture){
        try { els.markerWrap.releasePointerCapture(event.pointerId); } catch(_) {}
      }
    };

    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
  }

  function loadScriptWithFallback(urls, readyCheck){
    if(readyCheck()) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let index=0;
      const next=()=>{
        if(readyCheck()){resolve();return;}
        if(index>=urls.length){reject(new Error('library-load-failed'));return;}
        const src=urls[index++];
        const existing=[...document.scripts].find(s=>s.src===src);
        if(existing){
          // Script đã tồn tại nhưng global chưa sẵn sàng: chuyển ngay sang CDN dự phòng.
          next();
          return;
        }
        const script=document.createElement('script');
        script.src=src; script.async=true;
        script.onload=()=>readyCheck()?resolve():next();
        script.onerror=next;
        document.head.appendChild(script);
      };
      next();
    });
  }

  async function ensureExportLibraries(){
    await loadScriptWithFallback([
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    ],()=>typeof window.html2canvas==='function');
  }

  function dataUrlToBytes(dataUrl){
    const comma=dataUrl.indexOf(',');
    if(comma<0) throw new Error('invalid-image-data');
    const bin=atob(dataUrl.slice(comma+1));
    const out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
    return out;
  }

  function asciiBytes(text){
    return new TextEncoder().encode(text);
  }

  function concatBytes(parts){
    const size=parts.reduce((n,p)=>n+p.length,0);
    const out=new Uint8Array(size);
    let pos=0;
    for(const p of parts){out.set(p,pos);pos+=p.length;}
    return out;
  }

  function buildSinglePagePdfFromJpeg(jpegDataUrl, imageWidth, imageHeight, mode){
    const jpeg=dataUrlToBytes(jpegDataUrl);
    if(jpeg.length<1000) throw new Error('invalid-image-data');
    const isA4=mode==='a4';
    const pageW=isA4?595.276:612;
    const pageH=isA4?841.89:792;
    const content=`q\n${pageW.toFixed(3)} 0 0 ${pageH.toFixed(3)} 0 0 cm\n/Im0 Do\nQ\n`;
    const objects=[
      asciiBytes('<< /Type /Catalog /Pages 2 0 R >>'),
      asciiBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(3)} ${pageH.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
      concatBytes([asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,asciiBytes('\nendstream')]),
      asciiBytes(`<< /Length ${asciiBytes(content).length} >>\nstream\n${content}endstream`)
    ];
    const parts=[asciiBytes('%PDF-1.4\n%âãÏÓ\n')];
    const offsets=[0];
    let cursor=parts[0].length;
    objects.forEach((obj,i)=>{
      offsets[i+1]=cursor;
      const head=asciiBytes(`${i+1} 0 obj\n`), tail=asciiBytes('\nendobj\n');
      parts.push(head,obj,tail); cursor+=head.length+obj.length+tail.length;
    });
    const xrefOffset=cursor;
    let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<=objects.length;i++) xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
    xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(asciiBytes(xref));
    return new Blob([concatBytes(parts)],{type:'application/pdf'});
  }

  function downloadBlob(blob, filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename; a.style.display='none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1200);
  }

  function setExportProgress(percent, text, done=false){
    const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
    if(els.exportProgress){
      els.exportProgress.classList.toggle('hidden', done);
      els.exportProgress.classList.remove('error');
      if(els.exportProgressPct) els.exportProgressPct.textContent = `${p}%`;
      if(els.exportProgressText) els.exportProgressText.textContent = text || 'Đang xử lý…';
      if(els.exportProgressBar) els.exportProgressBar.style.width = `${p}%`;
    }
    const toolbar = document.querySelector('.preview-toolbar');
    if(toolbar) toolbar.classList.toggle('export-busy', !done && p < 100);
    if(els.previewSyncStatus){
      els.previewSyncStatus.textContent = done ? 'Sẵn sàng' : (text || 'Đang xử lý…');
      els.previewSyncStatus.classList.toggle('warning', !done);
    }
  }

  function mercatorWorldPx(lat, lng, zoom){
    const n = Math.pow(2, zoom) * 256;
    const x = (lng + 180) / 360 * n;
    const sinLat = Math.sin(lat * Math.PI / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n;
    return {x,y};
  }

  async function loadTileBitmap(url, timeout=8000){
    const controller = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(()=>{ try{controller&&controller.abort();}catch(_){} }, timeout);
    try{
      const res = await fetch(url, {mode:'cors', cache:'force-cache', signal:controller?controller.signal:undefined});
      if(!res.ok) throw new Error(`tile-${res.status}`);
      const blob = await res.blob();
      if('createImageBitmap' in window) return await createImageBitmap(blob);
      return await new Promise((resolve,reject)=>{
        const img = new Image();
        const objectUrl=URL.createObjectURL(blob);
        img.onload=()=>{URL.revokeObjectURL(objectUrl);resolve(img);};
        img.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error('tile-image-error'));};
        img.src=objectUrl;
      });
    }finally{ clearTimeout(timer); }
  }

  async function loadMapTileWithFallback(z,x,y){
    const providers=[
      `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
      `https://b.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    ];
    let lastError=null;
    for(const url of providers){
      try{return await loadTileBitmap(url,7000);}catch(err){lastError=err;}
    }
    throw lastError || new Error('tile-load-failed');
  }

  async function buildHighResExportMap(coords){
    document.body.classList.add('pdf-exporting');
    setCanonicalSheetMode(true);
    await nextPaint();
    const frameRect = els.mapFrame.getBoundingClientRect();
    const logicalW = Math.max(320, Math.round(frameRect.width));
    const logicalH = Math.max(420, Math.round(frameRect.height));
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = logicalW * scale;
    canvas.height = logicalH * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle='#f2f5f6'; ctx.fillRect(0,0,canvas.width,canvas.height);

    const baseZoom = Math.max(13, Math.min(19, Number(els.zoom.value) || 18));
    const tileZoom = Math.min(20, baseZoom);
    const world = mercatorWorldPx(coords.lat, coords.lng, tileZoom);
    const viewW = logicalW;
    const viewH = logicalH;
    const left = world.x - viewW/2;
    const top = world.y - viewH/2;
    const minTX = Math.floor(left/256)-1, maxTX=Math.floor((left+viewW)/256)+1;
    const minTY = Math.floor(top/256)-1, maxTY=Math.floor((top+viewH)/256)+1;
    const maxTile = Math.pow(2,tileZoom);
    const jobs=[];
    for(let ty=minTY; ty<=maxTY; ty++){
      if(ty<0 || ty>=maxTile) continue;
      for(let tx=minTX; tx<=maxTX; tx++){
        const wrappedX=((tx%maxTile)+maxTile)%maxTile;
        const dx=(tx*256-left)*scale, dy=(ty*256-top)*scale;
        jobs.push({z:tileZoom,x:wrappedX,y:ty,dx,dy});
      }
    }

    let loaded=0, failed=0;
    const total=Math.max(1,jobs.length);
    await Promise.all(jobs.map(async job=>{
      try{
        const img=await loadMapTileWithFallback(job.z,job.x,job.y);
        ctx.drawImage(img,job.dx,job.dy,256*scale,256*scale);
        if(img && typeof img.close==='function') try{img.close();}catch(_){}
        loaded++;
      }catch(_){ failed++; }
      const pct=18 + Math.round(((loaded+failed)/total)*34);
      setExportProgress(pct,'Đang dựng bản đồ chất lượng cao…');
    }));
    if(!loaded || loaded < Math.ceil(total*0.6)) throw new Error('map-tiles-failed');

    // Attribution bắt buộc cho nền bản đồ OSM/CARTO.
    const credit='© OpenStreetMap contributors • © CARTO';
    ctx.save();
    ctx.font=`${11*scale}px Arial`;
    const pad=4*scale, tw=ctx.measureText(credit).width;
    const x=canvas.width-tw-pad*2, y=canvas.height-(18*scale);
    ctx.fillStyle='rgba(255,255,255,.86)'; ctx.fillRect(x,y,tw+pad*2,16*scale);
    ctx.fillStyle='#4b5961'; ctx.fillText(credit,x+pad,y+11*scale);
    ctx.restore();

    const dataUrl=canvas.toDataURL('image/png');
    els.exportMapSurface.src=dataUrl;
    await new Promise((resolve,reject)=>{
      if(els.exportMapSurface.complete && els.exportMapSurface.naturalWidth>0){resolve();return;}
      const t=setTimeout(()=>reject(new Error('export-map-image-timeout')),5000);
      els.exportMapSurface.onload=()=>{clearTimeout(t);resolve();};
      els.exportMapSurface.onerror=()=>{clearTimeout(t);reject(new Error('export-map-image-error'));};
    });
    await nextPaint();
  }

  function finishSilentExportMap(){
    document.body.classList.remove('pdf-exporting');
    setCanonicalSheetMode(false);
    if(els.exportMapSurface) els.exportMapSurface.removeAttribute('src');
    requestAnimationFrame(fitPreviewSheet);
  }

  async function silentSheetCanvas(){
    const html2canvasFn = window.html2canvas;
    if(typeof html2canvasFn !== 'function') throw new Error('missing-html2canvas');
    const coords=await resolveExportCoords();
    if(!coords) throw new Error('missing-coordinates');
    await buildHighResExportMap(coords);
    try{
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      await nextPaint();
      return await html2canvasFn(els.sheet, {
        scale:3.0,
        useCORS:true,
        allowTaint:false,
        backgroundColor:'#ffffff',
        logging:false,
        imageTimeout:12000,
        scrollX:0,
        scrollY:0,
        onclone:(doc)=>{
          doc.body.classList.add('pdf-exporting');
          const s=doc.getElementById('sheet'); if(s){s.style.transform='none';s.style.boxShadow='none';s.style.outline='0';}
          const iframe=doc.getElementById('mapIframe'); if(iframe) iframe.style.display='none';
          const staticImg=doc.getElementById('staticMapImage'); if(staticImg) staticImg.style.display='none';
          const exportImg=doc.getElementById('exportMapSurface');
          if(exportImg){exportImg.style.display='block';exportImg.style.width='100%';exportImg.style.height='100%';exportImg.style.objectFit='fill';}
          const controls=doc.querySelectorAll('.road-rotate'); controls.forEach(el=>el.style.display='none');
        }
      });
    }finally{
      finishSilentExportMap();
    }
  }

  async function exportPdfSilent(){
    if(exportBusy) return;
    if(!destinationText()){ toast('Hãy nhập tọa độ, link Google Maps hoặc địa chỉ trước khi Export PDF.'); return; }
    exportBusy=true;
    try{
      setExportProgress(4,'Kiểm tra thư viện xuất…');
      await ensureExportLibraries();
      setExportProgress(10,'Chuẩn bị bản đồ…');
      await nextPaint();
      setExportProgress(28,'Đang tải nền bản đồ…');
      const canvas = await silentSheetCanvas();
      if(!canvas || canvas.width < 1000 || canvas.height < 1400) throw new Error('invalid-export-canvas');
      setExportProgress(76,'Đang tạo PDF chất lượng cao…');
      const jpeg=canvas.toDataURL('image/jpeg',0.985);
      setExportProgress(86,'Đang đóng gói PDF…');
      const pdfBlob=buildSinglePagePdfFromJpeg(jpeg,canvas.width,canvas.height,paperMode());
      if(!pdfBlob || pdfBlob.size < 5000) throw new Error('invalid-pdf-output');
      setExportProgress(94,'Đang lưu file…');
      downloadBlob(pdfBlob,`${safeBaseName()}-${paperMode().toUpperCase()}.pdf`);
      setExportProgress(100,'Hoàn tất');
      setTimeout(()=>setExportProgress(100,'Sẵn sàng',true),900);
      toast('Đã xuất PDF chất lượng cao.');
    }catch(err){
      console.error(err);
      finishSilentExportMap();
      setExportProgress(0,'Có lỗi khi xuất',false);
      if(els.exportProgress) els.exportProgress.classList.add('error');
      if(els.previewSyncStatus){els.previewSyncStatus.classList.remove('ok');els.previewSyncStatus.classList.add('error');}
      setTimeout(()=>setExportProgress(0,'Sẵn sàng',true),1800);
      if(err&&err.message==='missing-coordinates') toast('Không xác định được vị trí. Hãy nhập tọa độ, link Google Maps hoặc kiểm tra lại địa chỉ.');
      else if(err&&err.message==='map-tiles-failed') toast('Không tải đủ nền bản đồ. Kiểm tra Internet rồi thử lại.');
      else if(err&&err.message==='library-load-failed') toast('Không tải được thư viện tạo PDF. Kiểm tra Internet rồi thử lại.');
      else if(err&&err.message==='missing-html2canvas') toast('Thư viện chụp biểu mẫu chưa sẵn sàng. Hãy tải lại trang rồi thử lại.');
      else if(err&&['invalid-export-canvas','invalid-pdf-output'].includes(err.message)) toast('Bản xuất chưa hoàn chỉnh nên phần mềm đã dừng để tránh tải file lỗi.');
      else toast('Chưa tạo được PDF. Vui lòng thử lại.');
    }finally{ exportBusy=false; }
  }



  function bind(){
    ['input','change'].forEach(evt => {
      [els.placeName,els.address,els.lat,els.lng,els.zoom,els.travelMode,els.markerSize,els.qrLogoMode,els.qrLogoSize,els.note].forEach(el => el.addEventListener(evt, scheduleUpdate));
    });

    if(els.address){
      els.address.addEventListener('input', updateAddressOutput);
      els.address.addEventListener('change', updateAddressOutput);
    }

    if(els.noteEnabled){
      els.noteEnabled.addEventListener('change', () => { updateNote(); });
    }

    els.placeName.addEventListener('input', () => {
      if(els.placeName.value.trim() !== lastAutoPlaceName) lastAutoPlaceName = '';
    });

    // Phần 2/3/4 hoạt động như accordion: mở một phần sẽ tự đóng các phần còn lại.
    const optionalDetails = Array.from(document.querySelectorAll('.collapsible-section > details'));
    optionalDetails.forEach(detail => detail.addEventListener('toggle', () => {
      if(!detail.open) return;
      optionalDetails.forEach(other => { if(other !== detail) other.open = false; });
    }));

    els.mapsUrl.addEventListener('input', scheduleUpdate);
    els.btnParse.addEventListener('click', () => {
      const found = parseGoogleMapsUrl(els.mapsUrl.value);
      if(found){
        els.lat.value = String(found.lat);
        els.lng.value = String(found.lng);
        setStatus(`Đã lấy tọa độ: ${found.lat}, ${found.lng}`);
        scheduleUpdate();
      }else{
        setStatus('Không đọc được tọa độ từ link này. Nếu là link rút gọn, hãy mở Google Maps và sao chép link đầy đủ hoặc nhập tọa độ.', true);
      }
    });

    els.iconChoices.addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-choice');
      if(!btn || btn.id === 'btnCustomIcon') return;
      selectIconButton(btn);
      selectedMarker = btn.dataset.icon || 'none';

      scheduleUpdate();
    });

    els.btnCustomIcon.addEventListener('click', () => els.customIconInput.click());
    els.customIconInput.addEventListener('change', () => {
      const file = els.customIconInput.files && els.customIconInput.files[0];
      if(!file) return;
      readFileAsDataUrl(file, data => {
        customMarkerData = data;
        selectedMarker = 'custom';
        selectIconButton(els.btnCustomIcon);
        scheduleUpdate();
        toast('Đã dùng icon tự chọn.');
      });
    });

    els.qrLogoMode.addEventListener('change', () => {
      els.qrCustomWrap.classList.toggle('hidden', els.qrLogoMode.value !== 'custom');
      scheduleUpdate();
    });
    els.qrCustomInput.addEventListener('change', () => {
      const file = els.qrCustomInput.files && els.qrCustomInput.files[0];
      if(!file) return;
      readFileAsDataUrl(file, data => { customQrLogoData = data; scheduleUpdate(); toast('Đã dùng logo riêng trong QR.'); });
    });


    els.qrBoxSize.addEventListener('input', () => setQrSize(els.qrBoxSize.value));
    els.btnQrSmaller.addEventListener('click', () => changeQrSize(-0.8));
    els.btnQrDefault.addEventListener('click', () => setQrSize(QR_DEFAULT_SIZE));
    els.btnQrLarger.addEventListener('click', () => changeQrSize(0.8));

    els.btnApplyRoadLabels.addEventListener('click', () => {
      renderRoadLabels(true);
      toast(roadLabels.length ? `Đã tạo ${roadLabels.length} nhãn. Kéo để di chuyển, bấm ↻ để xoay.` : 'Chưa có tên đường để tạo nhãn.');
    });
    els.btnClearRoadLabels.addEventListener('click', () => {
      els.roadNames.value = '';
      roadLabels = [];
      renderRoadLabels(true);
      toast('Đã xóa các nhãn đường thủ công.');
    });

    if(els.btnToggleApiKey){
      els.btnToggleApiKey.addEventListener('click', () => {
        const show = els.googleApiKey.type === 'password';
        els.googleApiKey.type = show ? 'text' : 'password';
        els.btnToggleApiKey.textContent = show ? 'Ẩn' : 'Hiện';
        els.btnToggleApiKey.setAttribute('aria-label', show ? 'Ẩn API key' : 'Hiện API key');
        els.googleApiKey.focus();
      });
    }
    els.googleApiKey.addEventListener('input', () => {
      const hasKey = !!els.googleApiKey.value.trim();
      setApiKeyStatus(hasKey ? 'pending' : 'neutral', hasKey ? 'Chưa kiểm tra' : 'Không bắt buộc');
    });
    els.googleApiKey.addEventListener('change', () => {
      if(els.googleApiKey.value.trim()) updateMap();
      else { setApiKeyStatus('neutral','Không bắt buộc'); updateMap(); }
    });
    if(els.btnTestApiKey) els.btnTestApiKey.addEventListener('click', testStaticMapsKey);

    const openUrl = (url) => {
      if(!url){ toast('Chưa có vị trí để mở.'); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    };
    els.btnOpenMap.addEventListener('click', () => openUrl(placeMapUrl()));
    els.btnTestQr.addEventListener('click', () => openUrl(directionsUrl()));

    const doPrint = () => {
      if(!destinationText()) { toast('Hãy nhập tọa độ, link Google Maps hoặc địa chỉ trước khi in.'); return; }
      updatePaperUi();
      applyPrintPageStyle();
      updateMap();
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    };
    els.btnPrint.addEventListener('click', doPrint);
    els.btnPrint2.addEventListener('click', doPrint);
    if(els.btnQuickPrint) els.btnQuickPrint.addEventListener('click', doPrint);
    if(els.btnExportPdf) els.btnExportPdf.addEventListener('click', doExportPdf);
    if(els.btnExportPdf2) els.btnExportPdf2.addEventListener('click', doExportPdf);
    if(els.btnQuickExportPdf) els.btnQuickExportPdf.addEventListener('click', doExportPdf);

    function setPaperModeQuick(mode){
      if(!els.paperSize) return;
      els.paperSize.value = mode === 'a4' ? 'a4' : 'letter';
      updatePaperUi();
      updateMap();
      requestAnimationFrame(fitPreviewSheet);
      toast(mode === 'a4' ? 'Đã chuyển sang A4 toàn trang.' : 'Đã chuyển sang Letter mẫu gốc.');
    }

    if(els.paperSize){
      els.paperSize.addEventListener('change', () => {
        updatePaperUi();
        updateMap();
        requestAnimationFrame(fitPreviewSheet);
        toast(els.paperSize.value === 'a4' ? 'Đã chọn khổ A4 toàn trang.' : 'Đã chọn khổ Letter mẫu gốc.');
      });
    }
    if(els.btnPaperLetter) els.btnPaperLetter.addEventListener('click', () => setPaperModeQuick('letter'));
    if(els.btnPaperA4) els.btnPaperA4.addEventListener('click', () => setPaperModeQuick('a4'));

    if(els.btnRefreshAll){
      els.btnRefreshAll.addEventListener('click', () => {
        updateMap(); updateMarker(); renderQr(); updateNote(); updateAddressOutput(); setExportProgress(0,'Sẵn sàng',true); renderRoadLabels(false); updatePaperUi();
        toast('Đã cập nhật bản xem trước.');
      });
    }
    if(els.btnQuickTestQr) els.btnQuickTestQr.addEventListener('click', () => openUrl(directionsUrl()));

    els.btnCopyLink.addEventListener('click', async () => {
      const url = directionsUrl();
      if(!url){ toast('Chưa có link chỉ đường.'); return; }
      try{ await navigator.clipboard.writeText(url); toast('Đã sao chép link chỉ đường.'); }
      catch(_){
        const ta=document.createElement('textarea'); ta.value=url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Đã sao chép link chỉ đường.');
      }
    });

    els.btnDownloadQr.addEventListener('click', () => {
      const url = directionsUrl();
      if(!url){ toast('Chưa có QR để tải.'); return; }
      const canvas = els.qrcode.querySelector('canvas');
      const img = els.qrcode.querySelector('img');
      const logo = qrLogoSrc();
      const size = 1000;
      const out = document.createElement('canvas'); out.width=size; out.height=size;
      const ctx = out.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size);
      const finish = (qrImage) => {
        ctx.drawImage(qrImage,0,0,size,size);
        if(logo){
          const li = new Image();
          li.onload = () => {
            const pct = Number(els.qrLogoSize.value)/100;
            const w = size*pct, h = w, x=(size-w)/2, y=(size-h)/2;
            const pad=size*0.018;
            ctx.fillStyle='#fff'; ctx.fillRect(x-pad,y-pad,w+pad*2,h+pad*2);
            ctx.drawImage(li,x,y,w,h);
            saveCanvas(out);
          };
          li.src = logo;
        }else saveCanvas(out);
      };
      if(canvas) finish(canvas);
      else if(img && img.complete) finish(img);
      else toast('QR chưa sẵn sàng, vui lòng thử lại.');
    });

    els.staticMapImage.addEventListener('error', () => {
      if(els.googleApiKey.value.trim()){
        setStatus('Không tải được Google Static Maps. Kiểm tra API key/billing hoặc để trống key để dùng bản đồ nhúng.', true);
        setApiKeyStatus('error','Không tải được');
      }
    });
  }

  function saveCanvas(canvas){
    const a=document.createElement('a');
    const safe=(els.placeName.value.trim()||'qr-chi-duong').replace(/[^a-zA-Z0-9\u00C0-\u024F_-]+/g,'-').replace(/-+/g,'-');
    a.download=`QR-${safe}.png`;
    a.href=canvas.toDataURL('image/png');
    a.click();
    toast('Đã tạo file QR PNG.');
  }

  window.addEventListener('resize', () => requestAnimationFrame(fitPreviewSheet));
  if(window.ResizeObserver && els.previewArea){
    const previewObserver = new ResizeObserver(() => requestAnimationFrame(fitPreviewSheet));
    previewObserver.observe(els.previewArea);
  }
  window.addEventListener('afterprint', () => requestAnimationFrame(fitPreviewSheet));

  bind();
  initMarkerDrag();
  initRoadLabelDrag();
  setQrSize(QR_DEFAULT_SIZE);
  renderRoadLabels(true);
  updatePaperUi();
  setApiKeyStatus('neutral','Không dùng API');
  setPreviewSyncStatus('ok','Xem trước = Xuất');
  updateMap(); updateMarker(); renderQr(); updateNote(); updateAddressOutput(); setExportProgress(0,'Sẵn sàng',true);
})();


// PWA v11: chỉ hiện Cài đặt khi chưa cài; chỉ hiện Cập nhật khi có phiên bản mới chờ áp dụng.
(() => {
  const installBtn = document.getElementById('btnInstallApp');
  const updateBtn = document.getElementById('btnUpdateApp');
  let deferredInstallPrompt = null;
  let registration = null;
  let reloading = false;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const show = (el, yes) => { if(el) el.classList.toggle('hidden', !yes); };

  show(installBtn, false);
  show(updateBtn, false);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if(!isStandalone()) show(installBtn, true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    show(installBtn, false);
  });

  if(installBtn){
    installBtn.addEventListener('click', async () => {
      if(isStandalone()) { show(installBtn, false); return; }
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if(choice && choice.outcome === 'accepted') show(installBtn, false);
      deferredInstallPrompt = null;
    });
  }

  const showUpdateIfWaiting = () => show(updateBtn, !!(registration && registration.waiting));

  if('serviceWorker' in navigator && location.protocol !== 'file:'){
    window.addEventListener('load', async () => {
      try{
        registration = await navigator.serviceWorker.register('./sw.js');
        showUpdateIfWaiting();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if(!worker) return;
          worker.addEventListener('statechange', () => {
            if(worker.state === 'installed' && navigator.serviceWorker.controller){
              showUpdateIfWaiting();
            }
          });
        });
        registration.update().catch(() => {});
      }catch(_){ }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  if(updateBtn){
    updateBtn.addEventListener('click', async () => {
      if(!registration) return;
      if(!registration.waiting){
        try{ await registration.update(); }catch(_){ }
      }
      if(registration.waiting){
        updateBtn.disabled = true;
        updateBtn.textContent = 'Đang cập nhật…';
        registration.waiting.postMessage({type:'SKIP_WAITING'});
      }
    });
  }
})();
