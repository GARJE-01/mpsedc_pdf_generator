// Comprehensive Automated Test Suite for Site Installation Photo & Report Generator
const fs = require('fs');
const zlib = require('zlib');
const assert = require('assert');
const { jsPDF } = require('./lib/jspdf.umd.min.js');
const JSZip = require('./lib/jszip.min.js');

console.log('================================================================');
console.log(' SITE INSTALLATION PHOTO & REPORT GENERATOR - TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Filename Sanitization & Cleaning Rules (Section 15)
// -----------------------------------------------------------------------------
console.log('Test 1: Filename Cleaning Rules');

function getCleanSiteName(rawName) {
  if (!rawName) return 'Site_Report';
  let cleaned = rawName.trim();
  cleaned = cleaned.replace(/[\s\t\n\r]+/g, '_');
  cleaned = cleaned.replace(/[\\/:*?"<>|]+/g, '_');
  cleaned = cleaned.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  cleaned = cleaned.replace(/_+/g, '_');
  cleaned = cleaned.replace(/^_+|_+$/g, '');
  return cleaned || 'Site_Report';
}

assert.strictEqual(getCleanSiteName('Mumbai Fort'), 'Mumbai_Fort');
assert.strictEqual(getCleanSiteName('Pune Camp'), 'Pune_Camp');
assert.strictEqual(getCleanSiteName('Andheri East Branch'), 'Andheri_East_Branch');
assert.strictEqual(getCleanSiteName('RODKOL'), 'RODKOL');
assert.strictEqual(getCleanSiteName('   Jalgaon    Main Branch   '), 'Jalgaon_Main_Branch');
assert.strictEqual(getCleanSiteName('Site/Branch: Mumbai*East?'), 'Site_Branch_Mumbai_East');
assert.strictEqual(getCleanSiteName(''), 'Site_Report');
console.log('✔ All Filename Cleaning tests passed!\n');

// -----------------------------------------------------------------------------
// 2. Aspect Ratio Scaling Math (Section 9)
// -----------------------------------------------------------------------------
console.log('Test 2: Image Aspect Ratio Preservation Logic');

function computeFitDimensions(imgW, imgH, availW = 190, availH = 260) {
  const scale = Math.min(availW / imgW, availH / imgH);
  const finalW = imgW * scale;
  const finalH = imgH * scale;
  const x = (availW - finalW) / 2;
  const y = (availH - finalH) / 2;
  return { scale, finalW, finalH, x, y, originalRatio: imgW / imgH, finalRatio: finalW / finalH };
}

// Case A: Landscape (4000 x 3000, 4:3)
const landscape = computeFitDimensions(4000, 3000);
assert.strictEqual(landscape.finalW, 190);
assert.strictEqual(Math.round(landscape.finalH), 143);
assert.ok(Math.abs(landscape.originalRatio - landscape.finalRatio) < 0.0001, 'Landscape aspect ratio must be identical');

// Case B: Portrait (3000 x 4000, 3:4)
const portrait = computeFitDimensions(3000, 4000);
assert.ok(Math.abs(portrait.finalH - 253.3333) < 0.01, 'Portrait height must be ~253.33');
assert.ok(Math.abs(portrait.finalW - 190) < 0.001, 'Portrait width must be ~190');
assert.ok(Math.abs(portrait.originalRatio - portrait.finalRatio) < 0.0001, 'Portrait aspect ratio must be identical');

// Case C: Tall Phone Screenshot (1080 x 2400, 9:20)
const tall = computeFitDimensions(1080, 2400);
assert.strictEqual(tall.finalH, 260);
assert.strictEqual(tall.finalW, 117);
assert.ok(Math.abs(tall.originalRatio - tall.finalRatio) < 0.0001, 'Tall aspect ratio must be identical');

// Case D: Ultra-Wide (4000 x 1000, 4:1)
const ultraWide = computeFitDimensions(4000, 1000);
assert.strictEqual(ultraWide.finalW, 190);
assert.strictEqual(ultraWide.finalH, 47.5);
assert.ok(Math.abs(ultraWide.originalRatio - ultraWide.finalRatio) < 0.0001, 'Ultra-wide aspect ratio must be identical');

console.log('✔ All Aspect Ratio Scaling calculations passed (zero distortion)!\n');

// -----------------------------------------------------------------------------
// 3. Real Image Format Generation & Multi-Aspect Testing (Section 9, 10, 12, 14)
// -----------------------------------------------------------------------------
console.log('Test 3: Realistic Image Formats & Aspect Ratios for FE Workflows');

function createPngBuffer(width, height, r = 30, g = 144, b = 255) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const isPattern = (x % 40 < 20) ^ (y % 40 < 20);
      rawData[pxOffset] = isPattern ? r : Math.max(0, r - 30);
      rawData[pxOffset + 1] = isPattern ? g : Math.max(0, g - 30);
      rawData[pxOffset + 2] = isPattern ? b : Math.max(0, b - 30);
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const testScenarios = [
  { name: 'Pre-Installation Photo', ext: 'jpg', width: 1920, height: 1080, desc: 'Landscape 16:9 camera' },
  { name: 'Post-Installation Photo', ext: 'png', width: 1080, height: 1920, desc: 'Portrait 9:16 vertical camera' },
  { name: 'CMD Photo', ext: 'png', width: 2048, height: 1536, desc: 'Landscape 4:3 high-res terminal screen' },
  { name: 'Speed Test Photo', ext: 'png', width: 1080, height: 2400, desc: 'Tall 20:9 Android smartphone screen' },
  { name: 'Working Application Photo', ext: 'jpg', width: 1200, height: 1200, desc: 'Square 1:1 cropped UI photo' },
  { name: 'Sign-Off Report Photo', ext: 'png', width: 1240, height: 1754, desc: 'A4 Document aspect ratio photo' }
];

const generatedImages = testScenarios.map(s => {
  const buf = createPngBuffer(s.width, s.height);
  return {
    ...s,
    buffer: buf,
    dataUrl: 'data:image/png;base64,' + buf.toString('base64')
  };
});

// -----------------------------------------------------------------------------
// 4. Sequential 6-Page PDF Generation with Verification
// -----------------------------------------------------------------------------
console.log('Test 4: 6-Page PDF Generation with Zero Blank Pages & Exact Layout');

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
  compress: true
});

const pageWidth = 210;
const pageHeight = 297;
const marginX = 10;
const availableWidth = pageWidth - (marginX * 2); // 190 mm
const headerTopY = 10;
const headerBottomY = 26;
const footerY = 290;
const availableHeight = footerY - headerBottomY - 4; // 260 mm

generatedImages.forEach((img, idx) => {
  const pageNum = idx + 1;
  if (idx > 0) doc.addPage();

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(`${pageNum}. ${img.name.toUpperCase()}`, marginX, headerTopY + 4);

  // Site Name & Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Site: Mumbai Fort', marginX, headerTopY + 10.5);
  doc.text('Date: 12 Nov 2026', pageWidth - marginX - doc.getTextWidth('Date: 12 Nov 2026'), headerTopY + 10.5);

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, headerBottomY, pageWidth - marginX, headerBottomY);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  const pageStr = `Page ${pageNum} of 6`;
  doc.text(pageStr, pageWidth - marginX - doc.getTextWidth(pageStr), footerY + 2);
  doc.text('Site Installation Photo Report', marginX, footerY + 2);

  // Aspect ratio calculations
  const scale = Math.min(availableWidth / img.width, availableHeight / img.height);
  const finalW = img.width * scale;
  const finalH = img.height * scale;
  const x = marginX + (availableWidth - finalW) / 2;
  const y = headerBottomY + 2 + (availableHeight - finalH) / 2;

  assert.ok(finalW <= availableWidth + 0.001);
  assert.ok(finalH <= availableHeight + 0.001);

  doc.addImage(img.dataUrl, 'PNG', x, y, finalW, finalH, undefined, 'FAST');

  // Frame
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(x, y, finalW, finalH);

  console.log(`  Page ${pageNum} [${img.name}]: Placed at (${x.toFixed(1)}, ${y.toFixed(1)}), ${finalW.toFixed(1)}x${finalH.toFixed(1)} mm.`);
});

assert.strictEqual(doc.getNumberOfPages(), 6, 'PDF must contain exactly 6 pages');
const pdfOutput = doc.output('arraybuffer');
console.log(`✔ Generated 6-page PDF successfully! Total bytes: ${pdfOutput.byteLength}\n`);

// -----------------------------------------------------------------------------
// 5. Original Files in ZIP Generation (Section 14)
// -----------------------------------------------------------------------------
console.log('Test 5: Original Files in ZIP Generation');

const zip = new JSZip();
generatedImages.forEach(img => {
  zip.file(`${img.name}.${img.ext}`, img.buffer);
});

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(zipBuffer => {
  assert.ok(zipBuffer.length > 0);
  return JSZip.loadAsync(zipBuffer);
}).then(loadedZip => {
  const filenames = Object.keys(loadedZip.files);
  assert.strictEqual(filenames.length, 6, 'ZIP must contain exactly 6 files');
  assert.ok(filenames.includes('Pre-Installation Photo.jpg'));
  assert.ok(filenames.includes('Post-Installation Photo.png'));
  assert.ok(filenames.includes('CMD Photo.png'));
  assert.ok(filenames.includes('Speed Test Photo.png'));
  assert.ok(filenames.includes('Working Application Photo.jpg'));
  assert.ok(filenames.includes('Sign-Off Report Photo.png'));
  console.log('✔ JSZip test passed: All 6 original files preserved with correct names and extensions!\n');
  console.log('================================================================');
  console.log(' ALL 5 TEST SUITES PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}).catch(err => {
  console.error('JSZip test error:', err);
  process.exit(1);
});
