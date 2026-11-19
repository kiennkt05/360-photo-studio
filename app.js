/* 360 Photo Studio — no dependencies, no network requests, no server-side image processing. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const viewer = $('viewer');
  const viewport = viewer.getContext('2d', { alpha: false });
  const flatMap = $('mapCanvas');
  const mapContext = flatMap.getContext('2d');
  const TAU = Math.PI * 2;
  const RADIANS = Math.PI / 180;
  const state = { heading: 180, pitch: 0, fov: 90, file: null, image: null,
    previewPixels: null, previewWidth: 0, previewHeight: 0,
    needsRender: false, isExporting: false, objectUrl: null, info: '' };
  const controlIds = ['heading', 'pitch', 'fov'];
  const bounds = { heading: [0, 359.9], pitch: [-85, 85], fov: [40, 120] };

  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const normalizedHeading = (v) => ((v % 360) + 360) % 360;
  const formatValue = (v) => Number(v.toFixed(1)).toString();
  const setFeedback = (message, kind = '') => {
    const target = $('feedback'); target.textContent = message; target.className = 'feedback' + (kind ? ' ' + kind : '');
  };
  const readableBytes = (size) => size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;

  function updateInputFields() {
    for (const id of controlIds) {
      $(id).value = state[id].toFixed(id === 'fov' ? 0 : 1);
      $(id + 'Number').value = formatValue(state[id]);
    }
  }
  function setAngle(name, number, sync = true) {
    if (!Number.isFinite(number)) return;
    state[name] = name === 'heading' ? Math.round(normalizedHeading(number) * 10) / 10
      : Math.round(clamp(number, ...bounds[name]) * 10) / 10;
    if (sync) updateInputFields();
    scheduleRender();
  }
  for (const id of controlIds) {
    $(id).addEventListener('input', (event) => setAngle(id, Number(event.target.value)));
    $(id + 'Number').addEventListener('change', (event) => {
      const val = Number(event.target.value);
      setAngle(id, event.target.value.trim() === '' || !Number.isFinite(val) ? state[id] : val);
    });
  }
  $('resetBtn').addEventListener('click', () => {
    state.heading = 180; state.pitch = 0; state.fov = 90;
    updateInputFields(); scheduleRender();
  });
  $('quality').addEventListener('input', (e) => { $('qualityLabel').textContent = e.target.value + '%'; });

  function scheduleRender() {
    if (!state.image || state.needsRender) return;
    state.needsRender = true;
    requestAnimationFrame(() => {
      state.needsRender = false;
      drawSphere();
      drawMap();
    });
  }

  function drawSphere() {
    const source = state.previewPixels;
    if (!source) return;
    const w = viewer.width, h = viewer.height, sw = state.previewWidth, sh = state.previewHeight;
    const result = viewport.createImageData(w, h);
    const output = result.data;
    const yaw = state.heading * RADIANS;
    const pitch = state.pitch * RADIANS;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const focal = (w / 2) / Math.tan(state.fov * RADIANS / 2);
    const twoPiInv = 1 / TAU;
    const piInv = 1 / Math.PI;
    for (let py = 0; py < h; py++) {
      const v = (h / 2 - py - 0.5) / focal;
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5 - w / 2) / focal;
        const yy = cp * v + sp;
        const zz = cp - sp * v;
        const lon = yaw + Math.atan2(u, zz);
        const lat = Math.atan2(yy, Math.hypot(u, zz));
        let sx = Math.floor(normalizedHeading(lon / RADIANS) * sw / 360);
        let sy = Math.floor((0.5 - lat * piInv) * sh);
        sx = ((sx % sw) + sw) % sw;
        sy = clamp(sy, 0, sh - 1);
        const origin = (sy * sw + sx) * 4;
        const dest = (py * w + px) * 4;
        output[dest] = source[origin]; output[dest + 1] = source[origin + 1];
        output[dest + 2] = source[origin + 2]; output[dest + 3] = 255;
      }
    }
    viewport.putImageData(result, 0, 0);
  }

  function drawMap() {
    if (!state.image) return;
    const w = flatMap.width, h = flatMap.height;
    mapContext.drawImage(state.image, 0, 0, w, h);
    const x = state.heading / 360 * w;
    const y = (90 - state.pitch) / 180 * h;
    mapContext.lineWidth = 2;
    mapContext.strokeStyle = '#fff';
    mapContext.beginPath();mapContext.moveTo(x-13,y);mapContext.lineTo(x+13,y);mapContext.moveTo(x,y-13);mapContext.lineTo(x,y+13);mapContext.stroke();
    mapContext.fillStyle = '#65f5d4'; mapContext.beginPath();mapContext.arc(x,y,5,0,TAU);mapContext.fill();
    mapContext.strokeStyle = '#0b1b27';mapContext.lineWidth = 2;mapContext.stroke();
    mapContext.fillStyle = '#0a1725ce';mapContext.fillRect(7,7,160,25);
    mapContext.fillStyle = '#ddfbf5';mapContext.font = 'bold 15px system-ui';
    mapContext.fillText(`H ${formatValue(state.heading)}°   P ${formatValue(state.pitch)}°`, 15, 25);
  }

  function buildPreviewPixels(image) {
    const w = Math.min(2048, image.naturalWidth);
    const h = Math.max(1, Math.round(w * image.naturalHeight / image.naturalWidth));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    state.previewPixels = pixels.data;
    state.previewWidth = w; state.previewHeight = h;
  }

  async function loadFile(file) {
    if (!file) return;
    if (!/image\/(jpeg|png)/.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setFeedback('Vui lòng chọn file JPG hoặc PNG.', 'error'); return;
    }
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    const url = URL.createObjectURL(file);
    state.objectUrl = url;
    const image = new Image();
    try {
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
      const w = image.naturalWidth, h = image.naturalHeight;
      const ratio = w / h;
      if (Math.abs(ratio - 2) > 0.015) {
        throw new Error(`Ảnh này có kích thước ${w} × ${h} (tỷ lệ ${ratio.toFixed(3)}), không phải panorama 360° 2:1. Hãy xuất ảnh 360° (không phải Flat/Reframe) từ Insta360.`);
      }
      state.file = file;
      state.image = image;
      buildPreviewPixels(image);
      $('emptyState').classList.add('hidden');
      $('mapEmpty').classList.add('hidden');
      $('viewerHint').classList.remove('hidden');
      $('changeImageBtn').disabled = false;
      $('exportBtn').disabled = false;
      $('fileState').textContent = `${w.toLocaleString('vi-VN')} × ${h.toLocaleString('vi-VN')}`;
      const content = new TextDecoder('latin1').decode(await file.slice(0, 512 * 1024).arrayBuffer());
      const metaFound = /GPano:(?:ProjectionType|UsePanoramaViewer)/.test(content);
      $('fileInfo').textContent = `${file.name} · ${readableBytes(file.size)} · ${w} × ${h} px · GPano gốc: ${metaFound ? 'Đã tìm thấy' : 'Chưa thấy (sẽ bổ sung)'}`;
      state.heading = 180; state.pitch = 0; state.fov = 90;
      updateInputFields(); scheduleRender();
      setFeedback('Ảnh đã sẵn sàng. Kéo trong khung xem để chọn góc nhìn.', 'success');
    } catch (error) {
      state.file = null; state.image = null; state.previewPixels = null;
      $('emptyState').classList.remove('hidden');
      $('mapEmpty').classList.remove('hidden');
      $('viewerHint').classList.add('hidden');
      $('changeImageBtn').disabled = true;
      $('fileState').textContent = 'Chưa chọn ảnh';
      $('fileInfo').textContent = 'Chưa có file ảnh hợp lệ được chọn.';
      viewport.clearRect(0,0,viewer.width,viewer.height);
      mapContext.clearRect(0,0,flatMap.width,flatMap.height);
      $('exportBtn').disabled = true;
      setFeedback(error.message || 'Không thể đọc ảnh. Vui lòng thử một file khác.', 'error');
    }
  }
  $('chooseBtn').addEventListener('click', () => $('fileInput').click());
  $('changeImageBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (event) => { loadFile(event.target.files?.[0]); event.target.value = ''; });

  const dropTarget = $('viewerContainer');
  let dragCount = 0;
  dropTarget.addEventListener('dragenter', e => { e.preventDefault(); dragCount++; $('dropIndicator').classList.remove('hidden'); });
  dropTarget.addEventListener('dragover', e => { e.preventDefault(); });
  dropTarget.addEventListener('dragleave', e => { e.preventDefault(); dragCount = Math.max(0, dragCount - 1); if (!dragCount) $('dropIndicator').classList.add('hidden'); });
  dropTarget.addEventListener('drop', e => { e.preventDefault(); dragCount=0; $('dropIndicator').classList.add('hidden'); loadFile(e.dataTransfer?.files?.[0]); });

  let dragging = false, previousX = 0, previousY = 0;
  viewer.addEventListener('pointerdown', e => { if (!state.image) return; dragging=true; previousX=e.clientX; previousY=e.clientY; viewer.setPointerCapture(e.pointerId); });
  viewer.addEventListener('pointermove', e => {
    if (!dragging || !state.image) return;
    const dx=e.clientX-previousX, dy=e.clientY-previousY;
    previousX=e.clientX; previousY=e.clientY;
    state.heading = normalizedHeading(state.heading - dx * state.fov / viewer.getBoundingClientRect().width);
    state.pitch = clamp(state.pitch + dy * state.fov / viewer.getBoundingClientRect().width, -85,85);
    state.heading = Math.round(state.heading*10)/10;state.pitch = Math.round(state.pitch*10)/10;
    updateInputFields();scheduleRender();
  });
  const stopDrag = () => {dragging=false;};
  viewer.addEventListener('pointerup',stopDrag);
  viewer.addEventListener('pointercancel',stopDrag);
  viewer.addEventListener('lostpointercapture',stopDrag);
  viewer.addEventListener('wheel', e => { if (!state.image) return; e.preventDefault(); setAngle('fov', state.fov + (e.deltaY > 0 ? 5 : -5)); }, {passive:false});
  viewer.addEventListener('keydown', e => {
    if (!state.image) return;
    const key = {'ArrowLeft':['heading',-5], 'ArrowRight':['heading',5], 'ArrowUp':['pitch',5], 'ArrowDown':['pitch',-5]}[e.key];
    if (key) {e.preventDefault(); setAngle(key[0],state[key[0]]+key[1]);}
  });
  flatMap.addEventListener('click', e => {
    if (!state.image) return;
    const rect = flatMap.getBoundingClientRect();
    state.heading = Math.round(clamp((e.clientX-rect.left)/rect.width,0,0.9997)*3600)/10;
    state.pitch = Math.round(clamp(90-(e.clientY-rect.top)/rect.height*180,-85,85)*10)/10;
    updateInputFields();scheduleRender();
  });

  /* Encode one standards-compliant, standard XMP APP1 JPEG segment. */
  function injectGPanoXmp(jpegBytes, settings) {
    if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) throw new Error('Dữ liệu xuất không phải JPEG.');
    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
`<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="360 Photo Studio"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" GPano:UsePanoramaViewer="True" GPano:ProjectionType="equirectangular" GPano:FullPanoWidthPixels="${settings.width}" GPano:FullPanoHeightPixels="${settings.height}" GPano:CroppedAreaImageWidthPixels="${settings.width}" GPano:CroppedAreaImageHeightPixels="${settings.height}" GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0" GPano:PoseHeadingDegrees="0" GPano:PosePitchDegrees="0" GPano:PoseRollDegrees="0" GPano:InitialViewHeadingDegrees="${settings.initialHeading.toFixed(1)}" GPano:InitialViewPitchDegrees="${settings.pitch.toFixed(1)}" GPano:InitialHorizontalFOVDegrees="${settings.fov.toFixed(1)}" GPano:StitchingSoftware="360 Photo Studio" /></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
    const payload = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xmp);
    if (payload.length + 2 > 65535) throw new Error('XMP quá lớn so với giới hạn JPEG APP1.');
    // Preserve the initial APP0 (JFIF) segment before inserting APP1 (XMP).
    let pos=2;
    while (pos+4 < jpegBytes.length && jpegBytes[pos]===0xff && jpegBytes[pos+1]===0xe0) {
      const len=(jpegBytes[pos+2]<<8)|jpegBytes[pos+3];
      if(len<2 || pos+2+len>jpegBytes.length) break;
      pos+=2+len;
    }
    const output = new Uint8Array(jpegBytes.length + 4 + payload.length);
    output.set(jpegBytes.subarray(0,pos),0);
    output[pos]=0xff; output[pos+1]=0xe1;
    const size=payload.length+2;
    output[pos+2]=(size>>8)&255;output[pos+3]=size&255;
    output.set(payload,pos+4);
    output.set(jpegBytes.subarray(pos),pos+4+payload.length);
    return output;
  }
  function canvasBlob(canvas, quality) {
    return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Trình duyệt không thể mã hóa JPG.')), 'image/jpeg', quality));
  }
  function makeOutputImage(image,width,height,heading,rotate) {
    const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if (!ctx) throw new Error('Không thể tạo canvas. Hãy giảm độ phân giải.');
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    if (!rotate) {ctx.drawImage(image,0,0,width,height);return canvas;}
    // Seam-free 360 horizontal cyclic shift. The chosen ray is now the image center.
    const shift=((heading/360-0.5)%1+1)%1;
    const srcW=image.naturalWidth,srcH=image.naturalHeight;
    if (shift<1e-9 || shift>1-1e-9) {ctx.drawImage(image,0,0,width,height);return canvas;}
    const leftW=(1-shift)*width;
    ctx.drawImage(image,shift*srcW,0,(1-shift)*srcW,srcH,0,0,leftW,height);
    ctx.drawImage(image,0,0,shift*srcW,srcH,leftW,0,width-leftW,height);
    return canvas;
  }
  async function exportImage() {
    if (!state.image || state.isExporting) return;
    state.isExporting=true;$('exportBtn').disabled=true;
    setFeedback('Đang tạo JPG và ghi metadata GPano…');
    try {
      // Yield so the busy state becomes visible before the synchronous draw.
      await new Promise(requestAnimationFrame);
      const maxWidth=$('outputSize').value==='original' ? state.image.naturalWidth : Number($('outputSize').value);
      const width=Math.min(maxWidth,state.image.naturalWidth);
      const height=Math.round(width/2);
      const rotate=$('rotatePixels').checked;
      const canvas=makeOutputImage(state.image,width,height,state.heading,rotate);
      const jpeg=await canvasBlob(canvas,Number($('quality').value)/100);
      const output=injectGPanoXmp(new Uint8Array(await jpeg.arrayBuffer()), {
        width,height,initialHeading: rotate ? 0 : normalizedHeading(state.heading-180), pitch:state.pitch,fov:state.fov
      });
      const blob=new Blob([output],{type:'image/jpeg'});
      const fileName=state.file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._-]+/gu,'_') + '_facebook_360.jpg';
      const href=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=href;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(href),60_000);
      setFeedback(`Đã tạo ${fileName} (${readableBytes(blob.size)}). Nếu chưa tải xuống, kiểm tra mục Downloads.`, 'success');
    } catch(error) {console.error(error);setFeedback(error.message || 'Xuất file thất bại. Hãy thử giảm độ phân giải.', 'error');}
    finally {state.isExporting=false;$('exportBtn').disabled=false;}
  }
  $('exportBtn').addEventListener('click',exportImage);
})();
