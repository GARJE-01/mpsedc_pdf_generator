// Automated Test Suite for Site Installation Photo & Report Generator
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING AUTOMATED UNIT & INTEGRATION TESTS ===\n');

// 1. Test Clean Site Name Logic
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

console.log('Test 1: Filename Cleaning Rules');
assert.strictEqual(getCleanSiteName('Mumbai Fort'), 'Mumbai_Fort');
assert.strictEqual(getCleanSiteName('Pune Camp'), 'Pune_Camp');
assert.strictEqual(getCleanSiteName('Andheri East Branch'), 'Andheri_East_Branch');
assert.strictEqual(getCleanSiteName('RODKOL'), 'RODKOL');
assert.strictEqual(getCleanSiteName('   Jalgaon    Main Branch   '), 'Jalgaon_Main_Branch');
assert.strictEqual(getCleanSiteName('Site/Branch: Mumbai*East?'), 'Site_Branch_Mumbai_East');
assert.strictEqual(getCleanSiteName(''), 'Site_Report');
console.log('✔ All Filename Cleaning tests passed!\n');

// 2. Test Aspect Ratio Scaling Logic (Section 9)
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
assert.ok(landscape.finalW <= 190 && landscape.finalH <= 260, 'Landscape dimensions must fit within bounds');

// Case B: Portrait (3000 x 4000, 3:4)
const portrait = computeFitDimensions(3000, 4000);
assert.ok(Math.abs(portrait.finalH - 253.3333) < 0.01, 'Portrait height must be ~253.33');
assert.ok(Math.abs(portrait.finalW - 190) < 0.001, 'Portrait width must be ~190');
assert.ok(Math.abs(portrait.originalRatio - portrait.finalRatio) < 0.0001, 'Portrait aspect ratio must be identical');
assert.ok(portrait.finalW <= 190.001 && portrait.finalH <= 260.001, 'Portrait dimensions must fit within bounds');

// Case C: Tall Phone Screenshot (1080 x 2400, 9:20)
const tall = computeFitDimensions(1080, 2400);
assert.strictEqual(tall.finalH, 260);
assert.strictEqual(tall.finalW, 117);
assert.ok(Math.abs(tall.originalRatio - tall.finalRatio) < 0.0001, 'Tall aspect ratio must be identical');
assert.ok(tall.finalW <= 190 && tall.finalH <= 260, 'Tall dimensions must fit within bounds');

// Case D: Ultra-Wide (4000 x 1000, 4:1)
const ultraWide = computeFitDimensions(4000, 1000);
assert.strictEqual(ultraWide.finalW, 190);
assert.strictEqual(ultraWide.finalH, 47.5);
assert.ok(Math.abs(ultraWide.originalRatio - ultraWide.finalRatio) < 0.0001, 'Ultra-wide aspect ratio must be identical');

console.log('✔ All Aspect Ratio Scaling calculations passed (zero distortion)!\n');

// 3. Test JSZip Generation with raw dummy files
console.log('Test 3: JSZip Archive Generation with Raw Files');
const JSZip = require('./lib/jszip.min.js');

const categories = [
  { index: 1, title: 'Pre-Installation Photo', ext: 'jpg', data: Buffer.from('RAW_PRE_INSTALL_PHOTO_DATA') },
  { index: 2, title: 'Post-Installation Photo', ext: 'jpg', data: Buffer.from('RAW_POST_INSTALL_PHOTO_DATA') },
  { index: 3, title: 'CMD Photo', ext: 'png', data: Buffer.from('RAW_CMD_PHOTO_DATA') },
  { index: 4, title: 'Speed Test Photo', ext: 'jpg', data: Buffer.from('RAW_SPEED_TEST_PHOTO_DATA') },
  { index: 5, title: 'Working Application Photo', ext: 'jpeg', data: Buffer.from('RAW_WORKING_APP_PHOTO_DATA') },
  { index: 6, title: 'Sign-Off Report Photo', ext: 'png', data: Buffer.from('RAW_SIGNOFF_PHOTO_DATA') },
];

const zip = new JSZip();
categories.forEach(cat => {
  zip.file(`${cat.title}.${cat.ext}`, cat.data);
});

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(zipBuffer => {
  assert.ok(zipBuffer.length > 0, 'Zip buffer should not be empty');
  console.log(`Generated test ZIP buffer: ${zipBuffer.length} bytes`);

  // Read back the zip to verify contents
  return JSZip.loadAsync(zipBuffer);
}).then(loadedZip => {
  const filenames = Object.keys(loadedZip.files);
  console.log('Files inside ZIP:', filenames);
  assert.strictEqual(filenames.length, 6, 'ZIP must contain exactly 6 files');
  assert.ok(filenames.includes('Pre-Installation Photo.jpg'));
  assert.ok(filenames.includes('Post-Installation Photo.jpg'));
  assert.ok(filenames.includes('CMD Photo.png'));
  assert.ok(filenames.includes('Speed Test Photo.jpg'));
  assert.ok(filenames.includes('Working Application Photo.jpeg'));
  assert.ok(filenames.includes('Sign-Off Report Photo.png'));
  console.log('✔ JSZip test passed: All 6 original files preserved with correct names and extensions!\n');
}).catch(err => {
  console.error('JSZip test error:', err);
  process.exit(1);
});

// 4. Test Full 6-Page PDF Generation Matching script.js
console.log('Test 4: Full 6-Page PDF Generation Workflow');
const { jsPDF } = require('./lib/jspdf.umd.min.js');

function testGenerateFullPdf(siteName, currentDateStr) {
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

  const minimalJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // Test different orientations for the 6 pages:
  // 1: 4000x3000 (Landscape)
  // 2: 3000x4000 (Portrait)
  // 3: 1920x1080 (Landscape CMD)
  // 4: 1080x2400 (Tall Speed Test)
  // 5: 3024x4032 (Portrait Working App)
  // 6: 2480x3508 (Portrait Sign-off)
  const testImages = [
    { title: 'Pre-Installation Photo', w: 4000, h: 3000 },
    { title: 'Post-Installation Photo', w: 3000, h: 4000 },
    { title: 'CMD Photo', w: 1920, h: 1080 },
    { title: 'Speed Test Photo', w: 1080, h: 2400 },
    { title: 'Working Application Photo', w: 3024, h: 4032 },
    { title: 'Sign-Off Report Photo', w: 2480, h: 3508 },
  ];

  for (let i = 0; i < testImages.length; i++) {
    const item = testImages[i];
    const pageNum = i + 1;

    if (i > 0) doc.addPage();

    // Section Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`${pageNum}. ${item.title.toUpperCase()}`, marginX, headerTopY + 4);

    // Site Name and Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Site: ${siteName}`, marginX, headerTopY + 10.5);

    const dateDisplay = `Date: ${currentDateStr}`;
    const dateWidth = doc.getTextWidth(dateDisplay);
    doc.text(dateDisplay, pageWidth - marginX - dateWidth, headerTopY + 10.5);

    // Divider Line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(marginX, headerBottomY, pageWidth - marginX, headerBottomY);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    const pageStr = `Page ${pageNum} of ${testImages.length}`;
    const pageStrWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - marginX - pageStrWidth, footerY + 2);
    doc.text('Site Installation Photo Report', marginX, footerY + 2);

    // Calculate Aspect Ratio Fit
    const scale = Math.min(availableWidth / item.w, availableHeight / item.h);
    const finalWidth = item.w * scale;
    const finalHeight = item.h * scale;

    const x = marginX + (availableWidth - finalWidth) / 2;
    const y = headerBottomY + 2 + (availableHeight - finalHeight) / 2;

    assert.ok(finalWidth <= availableWidth + 0.01, 'Width must fit within page');
    assert.ok(finalHeight <= availableHeight + 0.01, 'Height must fit within page');

    // Add image
    doc.addImage(minimalJpg, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');

    // Border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(x, y, finalWidth, finalHeight);
  }

  const pdfOutput = doc.output('arraybuffer');
  assert.strictEqual(doc.getNumberOfPages(), 6, 'PDF must contain exactly 6 pages');
  console.log(`✔ Generated 6-page PDF successfully! Total bytes: ${pdfOutput.byteLength}`);
  return pdfOutput;
}

testGenerateFullPdf('Mumbai Fort', '12 Nov 2026');
console.log('✔ Full 6-Page PDF Generation passed all assertions!\n');
