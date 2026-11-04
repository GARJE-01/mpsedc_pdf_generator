/* Site Report Generator
 * Fully client-side. No uploads, no backend, no tracking.
 * Needs: jsPDF (window.jspdf) and JSZip (window.JSZip).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  var CATEGORIES = [
    { title: 'Pre-Installation Photo' },
    { title: 'Post-Installation Photo' },
    { title: 'CMD Photo' },
    { title: 'Speed Test Photo' },
    { title: 'Working Application Photo' },
    { title: 'Sign-Off Report Photo' }
  ];

  var JPEG_QUALITY = 0.95;          // high quality for the PDF copy only
  var MAX_LONG_SIDE = 6000;         // safety cap for phone canvas limits (A4 @ 300dpi is ~3500px)
  var FALLBACK_LONG_SIDES = [4096, 3000]; // used only if the canvas fails (low memory phones)

  // ---------------------------------------------------------------------------
  // Pure helpers (also unit-tested in Node)
  // ---------------------------------------------------------------------------
  function cleanSiteName(name) {
    var s = String(name == null ? '' : name).trim();
    s = s.replace(/[\u0000-\u001f\u007f]/g, '');       // control characters
    s = s.replace(/[\\\/:*?"<>|]/g, '');                // invalid filename characters
    s = s.replace(/\s+/g, '_');                         // spaces -> single underscore
    s = s.replace(/_+/g, '_');
    s = s.replace(/^[._]+|[._]+$/g, '');                // no leading/trailing dots/underscores
    if (s.length > 100) s = s.slice(0, 100).replace(/[._]+$/g, '');
    return s || 'Site_Report';
  }

  function getExtension(file) {
    var m = /\.([A-Za-z0-9]{1,5})$/.exec((file && file.name) || '');
    if (m) return m[1];
    var map = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif', 'image/bmp': 'bmp'
    };
    return map[(file && file.type || '').toLowerCase()] || 'jpg';
  }

  // contain / fit-inside, same scale for both axes, centred inside the area
  function fitContain(imgW, imgH, areaX, areaY, areaW, areaH) {
    var scale = Math.min(areaW / imgW, areaH / imgH);
    var w = imgW * scale;
    var h = imgH * scale;
    return { x: areaX + (areaW - w) / 2, y: areaY + (areaH - h) / 2, w: w, h: h, scale: scale };
  }

  function formatDate(d) {
    try {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return d.toDateString();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cleanSiteName: cleanSiteName, getExtension: getExtension, fitContain: fitContain, CATEGORIES: CATEGORIES };
  }
  if (typeof document === 'undefined') return; // Node: stop here

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  // photos[i] = { file, url, width, height } or null. `file` is the untouched original.
  var photos = CATEGORIES.map(function () { return null; });
  var tokens = CATEGORIES.map(function () { return 0; });
  var busy = false;
  var result = null; // { pdfUrl, zipUrl }

  // Test hook (Test 9): window.__siteReport.forceFail.add('bitmap') etc.
  var forceFail = new Set();
  window.__siteReport = { forceFail: forceFail };

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var siteInput = $('siteName');
  var photoList = $('photoList');
  var counterEl = $('counter');
  var messageEl = $('message');
  var progressEl = $('progress');
  var generateBtn = $('generateBtn');
  var formView = $('formView');
  var successView = $('successView');
  var cards = [];

  function buildCards() {
    CATEGORIES.forEach(function (cat, i) {
      var card = document.createElement('section');
      card.className = 'card';
      card.innerHTML =
        '<h2><span class="num">' + (i + 1) + '</span>' + cat.title.toUpperCase() + ' <span class="req">*</span></h2>' +
        '<div class="empty">' +
          '<label class="btn btn-primary">📷 TAKE / UPLOAD PHOTO' +
            '<input class="file-input" type="file" accept="image/*"></label>' +
        '</div>' +
        '<div class="filled" hidden>' +
          '<div class="thumb"><img alt="' + cat.title + ' preview"></div>' +
          '<p class="ok">✓ Photo Added</p>' +
          '<div class="btn-row">' +
            '<label class="btn btn-secondary">Retake / Replace' +
              '<input class="file-input" type="file" accept="image/*"></label>' +
            '<button type="button" class="btn btn-remove">Remove</button>' +
          '</div>' +
        '</div>' +
        '<p class="status" hidden></p>';
      photoList.appendChild(card);

      var inputs = card.querySelectorAll('input[type=file]');
      Array.prototype.forEach.call(inputs, function (inp) {
        inp.addEventListener('change', function () {
          var f = inp.files && inp.files[0];
          inp.value = ''; // allow choosing the same file again
          if (f) onFileChosen(i, f);
        });
      });
      card.querySelector('.btn-remove').addEventListener('click', function () { removePhoto(i); });
      card.querySelector('img').addEventListener('error', function () {
        // Preview could not be displayed: never treat it as ready.
        if (photos[i]) {
          clearPhoto(i);
          setStatus(i, 'This photo cannot be displayed. Please take or choose it again.', true);
          render();
        }
      });

      cards.push(card);
    });
  }

  function setStatus(i, text, isError) {
    var el = cards[i].querySelector('.status');
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = text;
    el.className = 'status' + (isError ? ' error' : '');
  }

  function render() {
    var ready = 0;
    photos.forEach(function (p, i) {
      var card = cards[i];
      var has = !!p;
      if (has) ready++;
      card.classList.toggle('done', has);
      if (has) card.classList.remove('missing');
      card.querySelector('.empty').hidden = has;
      card.querySelector('.filled').hidden = !has;
      var img = card.querySelector('img');
      var wantSrc = has ? p.url : '';
      if (has && img.getAttribute('src') !== wantSrc) img.src = wantSrc;
      if (!has) img.removeAttribute('src');
    });
    counterEl.textContent = ready + '/6';
    generateBtn.classList.toggle('is-disabled', ready < 6 || !siteInput.value.trim());
  }

  function showMessage(html) {
    messageEl.innerHTML = html;
    messageEl.hidden = false;
  }
  function hideMessage() { messageEl.hidden = true; messageEl.innerHTML = ''; }
  function showProgress(text) { progressEl.hidden = false; progressEl.textContent = text; }
  function hideProgress() { progressEl.hidden = true; progressEl.textContent = ''; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------------------------------------------------------------------------
  // Image decoding pipeline (primary + fallbacks)
  // Each method resolves to { source, width, height, close() } or rejects.
  // ---------------------------------------------------------------------------
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('image load failed')); };
      img.src = src;
    });
  }

  function validDims(w, h) { return w > 0 && h > 0 && isFinite(w) && isFinite(h); }

  // Method 1: createImageBitmap (applies EXIF orientation via "from-image")
  function decodeViaBitmap(file) {
    if (forceFail.has('bitmap')) return Promise.reject(new Error('forced failure: bitmap'));
    if (typeof createImageBitmap !== 'function') return Promise.reject(new Error('createImageBitmap unavailable'));
    return createImageBitmap(file, { imageOrientation: 'from-image' })
      .catch(function () { return createImageBitmap(file); })
      .then(function (bmp) {
        if (!validDims(bmp.width, bmp.height)) { try { bmp.close(); } catch (e) {} throw new Error('bad dimensions'); }
        return { source: bmp, width: bmp.width, height: bmp.height, close: function () { try { bmp.close(); } catch (e) {} } };
      });
  }

  // Method 2: <img> from an object URL, waiting for decode()
  function decodeViaObjectUrl(file) {
    if (forceFail.has('objecturl')) return Promise.reject(new Error('forced failure: objecturl'));
    var url = URL.createObjectURL(file);
    return loadImg(url).then(function (img) {
      var wait = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      return wait.then(function () {
        if (!img.complete || !validDims(img.naturalWidth, img.naturalHeight)) throw new Error('bad dimensions');
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: function () { URL.revokeObjectURL(url); } };
      });
    }).catch(function (e) { URL.revokeObjectURL(url); throw e; });
  }

  // Method 3: FileReader data URL -> <img>
  function decodeViaDataUrl(file) {
    if (forceFail.has('dataurl')) return Promise.reject(new Error('forced failure: dataurl'));
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error('FileReader failed')); };
      fr.readAsDataURL(file);
    }).then(loadImg).then(function (img) {
      var wait = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      return wait.then(function () {
        if (!img.complete || !validDims(img.naturalWidth, img.naturalHeight)) throw new Error('bad dimensions');
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: function () { img.src = ''; } };
      });
    });
  }

  function decodeImage(file) {
    var methods = [decodeViaBitmap, decodeViaObjectUrl, decodeViaDataUrl];
    var idx = 0;
    function next(lastErr) {
      if (idx >= methods.length) return Promise.reject(lastErr || new Error('all decoders failed'));
      var m = methods[idx++];
      return m(file).catch(function (e) { return next(e); });
    }
    return next();
  }

  // ---------------------------------------------------------------------------
  // Photo selection
  // ---------------------------------------------------------------------------
  function clearPhoto(i) {
    if (photos[i] && photos[i].url) URL.revokeObjectURL(photos[i].url);
    photos[i] = null;
  }

  function removePhoto(i) {
    if (busy) return;
    tokens[i]++;
    clearPhoto(i);
    setStatus(i, '');
    hideMessage();
    render();
  }

  function onFileChosen(i, file) {
    if (busy) return;
    var token = ++tokens[i];
    hideMessage();
    setStatus(i, 'Checking photo…', false);
    decodeImage(file).then(function (d) {
      var w = d.width, h = d.height;
      d.close(); // release memory right away
      if (token !== tokens[i]) return; // a newer choice replaced this one
      clearPhoto(i);
      photos[i] = { file: file, url: URL.createObjectURL(file), width: w, height: h };
      setStatus(i, '');
      render();
    }).catch(function () {
      if (token !== tokens[i]) return;
      setStatus(i, 'This photo could not be read. Please take or choose it again.', true);
      render();
    });
  }

  // ---------------------------------------------------------------------------
  // Photo -> JPEG bytes for the PDF (original File is never touched)
  // ---------------------------------------------------------------------------
  function canvasToBytes(source, srcW, srcH, longSide) {
    var scale = Math.min(1, longSide / Math.max(srcW, srcH));
    var w = Math.max(1, Math.round(srcW * scale));
    var h = Math.max(1, Math.round(srcH * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('no canvas context'));
    ctx.fillStyle = '#ffffff';            // PNGs with transparency become white, not black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return new Promise(function (resolve, reject) {
      if (!canvas.toBlob) return reject(new Error('toBlob unavailable'));
      canvas.toBlob(function (blob) {
        canvas.width = canvas.height = 0; // free canvas memory
        if (!blob) return reject(new Error('canvas export failed'));
        resolve(blob);
      }, 'image/jpeg', JPEG_QUALITY);
    }).then(function (blob) {
      return blob.arrayBuffer ? blob.arrayBuffer() : new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(new Error('read failed')); };
        fr.readAsArrayBuffer(blob);
      });
    }).then(function (buf) {
      var bytes = new Uint8Array(buf);
      if (bytes.length < 100 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('invalid JPEG data');
      return { bytes: bytes, width: w, height: h };
    });
  }

  function prepareForPdf(file) {
    return decodeImage(file).then(function (d) {
      var sides = [Math.min(MAX_LONG_SIDE, Math.max(d.width, d.height))].concat(FALLBACK_LONG_SIDES);
      var k = 0;
      function attempt(lastErr) {
        if (k >= sides.length) { d.close(); return Promise.reject(lastErr); }
        var side = sides[k++];
        return canvasToBytes(d.source, d.width, d.height, side).catch(attempt);
      }
      return attempt(new Error('no attempts')).then(function (out) { d.close(); return out; });
    });
  }

  // ---------------------------------------------------------------------------
  // PDF
  // ---------------------------------------------------------------------------
  function CategoryError(index, cause) {
    this.index = index;
    this.cause = cause;
  }

  function buildPdf(siteName) {
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) return Promise.reject(new Error('jsPDF not loaded'));
    var dateText = formatDate(new Date());
    var doc = null;
    var added = 0;

    function step(i) {
      if (i >= CATEGORIES.length) return Promise.resolve();
      showProgress('Preparing photo ' + (i + 1) + ' of 6: ' + CATEGORIES[i].title + '…');
      return prepareForPdf(photos[i].file).then(function (img) {
        // Landscape photos get a landscape A4 page so they fill more of the page.
        var landscape = img.width > img.height;
        var orient = landscape ? 'landscape' : 'portrait';
        if (!doc) doc = new JsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
        else doc.addPage('a4', orient);

        var pw = doc.internal.pageSize.getWidth();
        var ph = doc.internal.pageSize.getHeight();
        var margin = 10;
        var headerH = 16;

        doc.setTextColor(30, 36, 48);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(CATEGORIES[i].title, margin, 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(dateText, pw - margin, 14, { align: 'right' });

        var siteLine = doc.splitTextToSize('Site: ' + siteName, pw - margin * 2)[0];
        doc.text(siteLine, margin, 20);

        doc.setDrawColor(200, 205, 212);
        doc.setLineWidth(0.3);
        doc.line(margin, 23, pw - margin, 23);

        var areaX = margin;
        var areaY = 23 + 4;
        var areaW = pw - margin * 2;
        var areaH = ph - areaY - margin;
        var fit = fitContain(img.width, img.height, areaX, areaY, areaW, areaH);

        doc.addImage(img.bytes, 'JPEG', fit.x, fit.y, fit.w, fit.h, 'photo' + i, 'NONE');
        added++;
        img.bytes = null; // let the memory go before the next photo
        return step(i + 1);
      }, function (err) {
        throw new CategoryError(i, err);
      });
    }

    return step(0).then(function () {
      if (added !== CATEGORIES.length || doc.getNumberOfPages() !== CATEGORIES.length) {
        throw new Error('PDF page count mismatch');
      }
      var blob = doc.output('blob');
      if (!blob || blob.size < 1000) throw new Error('PDF output empty');
      return blob;
    });
  }

  // ---------------------------------------------------------------------------
  // ZIP (original File objects, stored without recompression)
  // ---------------------------------------------------------------------------
  function buildZip() {
    if (!window.JSZip) return Promise.reject(new Error('JSZip not loaded'));
    var zip = new window.JSZip();
    CATEGORIES.forEach(function (cat, i) {
      var f = photos[i].file;
      zip.file(cat.title + '.' + getExtension(f), f, { binary: true });
    });
    if (Object.keys(zip.files).length !== CATEGORIES.length) return Promise.reject(new Error('ZIP entry count mismatch'));
    return zip.generateAsync({ type: 'blob', compression: 'STORE' }).then(function (blob) {
      if (!blob || blob.size < 100) throw new Error('ZIP output empty');
      return blob;
    });
  }

  // ---------------------------------------------------------------------------
  // Generate flow
  // ---------------------------------------------------------------------------
  function validate() {
    var problems = [];
    var name = siteInput.value.trim();
    if (!name) problems.push({ site: true });
    photos.forEach(function (p, i) { if (!p) problems.push({ index: i }); });
    return problems;
  }

  function onGenerateClick() {
    if (busy) return;
    hideMessage();
    hideProgress();
    cards.forEach(function (c) { c.classList.remove('missing'); });
    siteInput.classList.remove('invalid');

    var problems = validate();
    if (problems.length) {
      var items = [];
      var first = null;
      problems.forEach(function (p) {
        if (p.site) {
          items.push('Site Name');
          siteInput.classList.add('invalid');
          first = first || siteInput;
        } else {
          items.push(CATEGORIES[p.index].title);
          cards[p.index].classList.add('missing');
          first = first || cards[p.index];
        }
      });
      var html;
      if (items.length === 1) {
        html = '<strong>REPORT INCOMPLETE</strong><p>Please ' + (items[0] === 'Site Name' ? 'enter the ' : 'upload ') + escapeHtml(items[0]) + '.</p>';
      } else {
        html = '<strong>REPORT INCOMPLETE</strong><p>Please complete:</p><ul>' +
          items.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ul>';
      }
      showMessage(html);
      if (first && first.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    generate();
  }

  function setBusy(on) {
    busy = on;
    generateBtn.classList.toggle('busy', on);
    cards.forEach(function (c) { c.classList.toggle('busy', on); c.style.pointerEvents = on ? 'none' : ''; });
    siteInput.disabled = on;
  }

  function generate() {
    var siteName = siteInput.value.trim();
    var base = cleanSiteName(siteName);
    setBusy(true);
    showProgress('Starting…');
    var pdfBlob = null;

    buildPdf(siteName).then(function (blob) {
      pdfBlob = blob;
      showProgress('Packing original photos into ZIP…');
      return buildZip().then(function (zipBlob) { return { pdf: pdfBlob, zip: zipBlob }; }, function (err) {
        var e = new Error('zip');
        e.zipFailed = true;
        e.cause = err;
        throw e;
      });
    }).then(function (files) {
      showSuccess(siteName, base, files.pdf, files.zip);
    }).catch(function (err) {
      hideProgress();
      if (err instanceof CategoryError) {
        var cat = CATEGORIES[err.index];
        cards[err.index].classList.add('missing');
        showMessage('<strong>PHOTO PROBLEM</strong><p>' + escapeHtml(cat.title) +
          ' could not be processed. Please remove it and take or choose the photo again.</p>');
        cards[err.index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (err && err.zipFailed) {
        showMessage('<strong>ZIP NOT READY</strong><p>The original photos ZIP could not be prepared, so no report was completed. Please try again.</p>');
      } else if (err && /not loaded/.test(err.message || '')) {
        showMessage('<strong>PAGE NOT READY</strong><p>Some required parts did not load. Please check your internet connection and reload the page.</p>');
      } else {
        showMessage('<strong>COULD NOT GENERATE REPORT</strong><p>Your phone may be low on memory. Close other apps and try again.</p>');
      }
    }).then(function () {
      setBusy(false);
    });
  }

  function showSuccess(siteName, base, pdfBlob, zipBlob) {
    releaseResult();
    result = { pdfUrl: URL.createObjectURL(pdfBlob), zipUrl: URL.createObjectURL(zipBlob) };

    $('successSite').textContent = siteName;
    $('pdfName').textContent = base + '.pdf';
    $('zipName').textContent = base + '.zip';

    var pdfLink = $('pdfLink');
    pdfLink.href = result.pdfUrl;
    pdfLink.setAttribute('download', base + '.pdf');
    var zipLink = $('zipLink');
    zipLink.href = result.zipUrl;
    zipLink.setAttribute('download', base + '.zip');

    hideProgress();
    hideMessage();
    formView.hidden = true;
    successView.hidden = false;
    window.scrollTo(0, 0);
  }

  function releaseResult() {
    if (result) {
      URL.revokeObjectURL(result.pdfUrl);
      URL.revokeObjectURL(result.zipUrl);
      result = null;
    }
    $('pdfLink').removeAttribute('href');
    $('zipLink').removeAttribute('href');
  }

  function resetAll() {
    if (!window.confirm('Start a new report? The current site name and photos will be cleared. Make sure you have downloaded both files.')) return;
    tokens = tokens.map(function (t) { return t + 1; });
    photos.forEach(function (p, i) { clearPhoto(i); setStatus(i, ''); });
    releaseResult();
    siteInput.value = '';
    siteInput.classList.remove('invalid');
    cards.forEach(function (c) { c.classList.remove('missing'); });
    hideMessage();
    hideProgress();
    successView.hidden = true;
    formView.hidden = false;
    render();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  buildCards();
  render();
  siteInput.addEventListener('input', function () {
    siteInput.classList.remove('invalid');
    render();
  });
  generateBtn.addEventListener('click', onGenerateClick);
  $('newBtn').addEventListener('click', resetAll);
})();
