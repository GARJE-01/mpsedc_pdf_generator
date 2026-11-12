/**
 * Site Installation Photo & Report Generator
 * Client-side utility for Field Engineers
 * Generates:
 * 1. 6-Page Professional PDF (jsPDF) preserving exact image aspect ratios
 * 2. ZIP containing 6 original raw uploaded photos (JSZip)
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURATION & STATE
  // ==========================================================================

  const REQUIRED_CATEGORIES = [
    {
      id: 'pre_installation',
      index: 1,
      title: 'Pre-Installation Photo',
      purpose: 'Photograph of the site before installation begins.',
      file: null,
      previewUrl: null,
      width: 0,
      height: 0,
      isReady: false
    },
    {
      id: 'post_installation',
      index: 2,
      title: 'Post-Installation Photo',
      purpose: 'Photograph of the site after installation is completed.',
      file: null,
      previewUrl: null,
      width: 0,
      height: 0,
      isReady: false
    },
    {
      id: 'cmd',
      index: 3,
      title: 'CMD Photo',
      purpose: 'Photograph of the CMD output/evidence required for this project.',
      file: null,
      previewUrl: null,
      width: 0,
      height: 0,
      isReady: false
    },
    {
      id: 'speed_test',
      index: 4,
      title: 'Speed Test Photo',
      purpose: 'Photograph showing the speed test result.',
      file: null,
      previewUrl: null,
      width: 0,
      height: 0,
      isReady: false
    },
    {
      id: 'working_app',
      index: 5,
      title: 'Working Application Photo',
      purpose: 'Photograph showing that the application/system is working successfully.',
      file: null,
      previewUrl: null,
      width: 0,
      height: 0,
      isReady: false
    },
    {
      id: 'sign_off',
      index: 6,
      title: 'Sign-Off Report Photo',
      purpose: 'Photograph of the completed sign-off report.',
      file: null,
      previewUrl: null,
      width: 0,
      height: 0,
      isReady: false
    }
  ];

  // Deep clone initial state
  const state = {
    siteName: '',
    categories: JSON.parse(JSON.stringify(REQUIRED_CATEGORIES)),
    activeCategoryId: null,
    generatedFiles: {
      pdfBlob: null,
      pdfUrl: null,
      pdfFileName: '',
      zipBlob: null,
      zipUrl: null,
      zipFileName: ''
    }
  };

  // ==========================================================================
  // 2. DOM ELEMENTS
  // ==========================================================================

  const dom = {
    // Screens
    formScreen: document.getElementById('formScreen'),
    successScreen: document.getElementById('successScreen'),

    // Site Name
    siteNameInput: document.getElementById('siteNameInput'),
    clearSiteNameBtn: document.getElementById('clearSiteNameBtn'),
    siteNameSection: document.getElementById('siteNameSection'),
    siteNamePreviewText: document.getElementById('siteNamePreviewText'),

    // Progress
    progressCount: document.getElementById('progressCount'),
    progressBarFill: document.getElementById('progressBarFill'),
    barStatusValue: document.getElementById('barStatusValue'),
    categoriesContainer: document.getElementById('categoriesContainer'),
    generateReportBtn: document.getElementById('generateReportBtn'),

    // Modals
    sourceModal: document.getElementById('sourceModal'),
    sourceModalTitle: document.getElementById('sourceModalTitle'),
    modalCameraBtn: document.getElementById('modalCameraBtn'),
    modalGalleryBtn: document.getElementById('modalGalleryBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),

    cameraInput: document.getElementById('cameraInput'),
    galleryInput: document.getElementById('galleryInput'),

    progressModal: document.getElementById('progressModal'),
    progressModalTitle: document.getElementById('progressModalTitle'),
    progressModalDesc: document.getElementById('progressModalDesc'),
    stepPhotos: document.getElementById('step-photos'),
    stepPdf: document.getElementById('step-pdf'),
    stepZip: document.getElementById('step-zip'),

    incompleteModal: document.getElementById('incompleteModal'),
    missingItemsList: document.getElementById('missingItemsList'),
    closeIncompleteBtn: document.getElementById('closeIncompleteBtn'),

    // Success Screen
    successSiteName: document.getElementById('successSiteName'),
    pdfFileNameDisplay: document.getElementById('pdfFileNameDisplay'),
    pdfMetaDisplay: document.getElementById('pdfMetaDisplay'),
    zipFileNameDisplay: document.getElementById('zipFileNameDisplay'),
    zipMetaDisplay: document.getElementById('zipMetaDisplay'),
    downloadPdfBtn: document.getElementById('downloadPdfBtn'),
    downloadZipBtn: document.getElementById('downloadZipBtn'),
    createNewReportBtn: document.getElementById('createNewReportBtn')
  };

  // ==========================================================================
  // 3. INITIALIZATION
  // ==========================================================================

  function init() {
    renderCategoryCards();
    attachEventListeners();
    updateProgressUI();
  }

  // ==========================================================================
  // 4. RENDERING CATEGORY CARDS
  // ==========================================================================

  function renderCategoryCards() {
    dom.categoriesContainer.innerHTML = '';

    state.categories.forEach(cat => {
      const card = document.createElement('article');
      card.className = `photo-card ${cat.isReady ? 'is-ready' : ''}`;
      card.id = `card-${cat.id}`;

      // Card Header
      const header = document.createElement('div');
      header.className = 'photo-card-header';
      header.innerHTML = `
        <div class="photo-card-title-group">
          <h2 class="photo-card-title">
            <span>${cat.index}. ${cat.title}</span>
            <span class="required-star">*</span>
          </h2>
          <p class="photo-card-purpose">${cat.purpose}</p>
        </div>
        <div class="status-badge ${cat.isReady ? 'status-ready' : 'status-pending'}">
          ${cat.isReady ? '✓ Ready' : 'Required'}
        </div>
      `;
      card.appendChild(header);

      // Card Body
      if (cat.isReady && cat.previewUrl) {
        // Loaded state with preview thumbnail
        const previewWrap = document.createElement('div');
        previewWrap.className = 'photo-preview-wrap';

        const sizeFormatted = formatFileSize(cat.file.size);
        const dimensionsFormatted = cat.width && cat.height ? `${cat.width} × ${cat.height} px` : '';

        previewWrap.innerHTML = `
          <div class="preview-container">
            <img src="${cat.previewUrl}" alt="${cat.title} Preview" class="preview-img" loading="lazy">
          </div>
          <div class="preview-meta-bar">
            <span class="meta-ready-tag">✓ Photo Added</span>
            <span class="meta-details-tag">${sizeFormatted} ${dimensionsFormatted ? '• ' + dimensionsFormatted : ''}</span>
          </div>
          <div class="preview-actions-grid">
            <button type="button" class="btn-retake" data-id="${cat.id}">
              <span>🔄</span> Retake / Replace
            </button>
            <button type="button" class="btn-remove" data-id="${cat.id}">
              <span>🗑️</span> Remove
            </button>
          </div>
        `;
        card.appendChild(previewWrap);
      } else {
        // Empty state with upload trigger
        const dropzone = document.createElement('div');
        dropzone.className = 'upload-dropzone';
        dropzone.setAttribute('data-id', cat.id);
        dropzone.innerHTML = `
          <button type="button" class="btn-upload-primary" data-id="${cat.id}">
            <span>📷</span> TAKE / UPLOAD PHOTO
          </button>
          <span class="dropzone-hint">Camera capture &amp; gallery upload supported</span>
        `;
        card.appendChild(dropzone);
      }

      dom.categoriesContainer.appendChild(card);
    });
  }

  // ==========================================================================
  // 5. EVENT LISTENERS
  // ==========================================================================

  function attachEventListeners() {
    // Site Name Input
    dom.siteNameInput.addEventListener('input', handleSiteNameInput);

    dom.clearSiteNameBtn.addEventListener('click', () => {
      dom.siteNameInput.value = '';
      handleSiteNameInput();
      dom.siteNameInput.focus();
    });

    // Delegated Category Card Clicks
    dom.categoriesContainer.addEventListener('click', handleCategoryCardClick);

    // Drag and Drop support
    dom.categoriesContainer.addEventListener('dragover', handleDragOver);
    dom.categoriesContainer.addEventListener('dragleave', handleDragLeave);
    dom.categoriesContainer.addEventListener('drop', handleDrop);

    // Source Selection Modal Buttons
    dom.modalCameraBtn.addEventListener('click', () => {
      hideSourceModal();
      dom.cameraInput.click();
    });

    dom.modalGalleryBtn.addEventListener('click', () => {
      hideSourceModal();
      dom.galleryInput.click();
    });

    dom.modalCancelBtn.addEventListener('click', hideSourceModal);
    dom.sourceModal.addEventListener('click', (e) => {
      if (e.target === dom.sourceModal) hideSourceModal();
    });

    // File Input Changes
    dom.cameraInput.addEventListener('change', handleNativeFileInput);
    dom.galleryInput.addEventListener('change', handleNativeFileInput);

    // Incomplete Report Dialog
    dom.closeIncompleteBtn.addEventListener('click', () => {
      dom.incompleteModal.style.display = 'none';
      scrollToFirstMissingItem();
    });
    dom.incompleteModal.addEventListener('click', (e) => {
      if (e.target === dom.incompleteModal) {
        dom.incompleteModal.style.display = 'none';
      }
    });

    // Generate Report
    dom.generateReportBtn.addEventListener('click', handleGenerateReportClick);

    // Download Buttons
    dom.downloadPdfBtn.addEventListener('click', () => {
      if (state.generatedFiles.pdfUrl && state.generatedFiles.pdfFileName) {
        triggerDownload(state.generatedFiles.pdfUrl, state.generatedFiles.pdfFileName);
      }
    });

    dom.downloadZipBtn.addEventListener('click', () => {
      if (state.generatedFiles.zipUrl && state.generatedFiles.zipFileName) {
        triggerDownload(state.generatedFiles.zipUrl, state.generatedFiles.zipFileName);
      }
    });

    // Reset / Create New Report
    dom.createNewReportBtn.addEventListener('click', handleCreateNewReport);
  }

  // ==========================================================================
  // 6. SITE NAME HANDLING & FILENAME CLEANING
  // ==========================================================================

  function handleSiteNameInput() {
    const rawValue = dom.siteNameInput.value;
    state.siteName = rawValue;

    if (rawValue.trim().length > 0) {
      dom.clearSiteNameBtn.style.display = 'flex';
      dom.siteNameSection.classList.remove('has-error');
      const cleanName = getCleanSiteName(rawValue);
      dom.siteNamePreviewText.innerHTML = `Output files: <strong>${cleanName}.pdf</strong> &bull; <strong>${cleanName}.zip</strong>`;
    } else {
      dom.clearSiteNameBtn.style.display = 'none';
      dom.siteNamePreviewText.innerHTML = `Filename: <em>Enter site name above</em>`;
    }

    updateProgressUI();
  }

  /**
   * Cleans entered Site Name strictly adhering to Section 15:
   * 1. Trim leading and trailing spaces.
   * 2. Replace multiple spaces with a single underscore.
   * 3. Remove or safely replace invalid filename characters (< > : " / \ | ? *).
   * 4. Preserve normal letters and numbers.
   * 5. No SOL ID or prefix.
   */
  function getCleanSiteName(rawName) {
    if (!rawName) return 'Site_Report';
    let cleaned = rawName.trim();
    // Replace whitespace groups with a single underscore
    cleaned = cleaned.replace(/[\s\t\n\r]+/g, '_');
    // Remove characters illegal in filenames across OSes
    cleaned = cleaned.replace(/[\\/:*?"<>|]+/g, '_');
    // Remove non-standard control characters
    cleaned = cleaned.replace(/[\x00-\x1f\x80-\x9f]/g, '');
    // Collapse consecutive underscores
    cleaned = cleaned.replace(/_+/g, '_');
    // Trim leading/trailing underscores
    cleaned = cleaned.replace(/^_+|_+$/g, '');

    return cleaned || 'Site_Report';
  }

  // ==========================================================================
  // 7. PHOTO UPLOAD & CARD INTERACTIONS
  // ==========================================================================

  function handleCategoryCardClick(e) {
    // 1. Upload or Retake trigger
    const uploadBtn = e.target.closest('.btn-upload-primary, .upload-dropzone');
    const retakeBtn = e.target.closest('.btn-retake');
    const removeBtn = e.target.closest('.btn-remove');

    if (removeBtn) {
      const catId = removeBtn.getAttribute('data-id');
      removePhoto(catId);
      return;
    }

    if (uploadBtn || retakeBtn) {
      const target = uploadBtn || retakeBtn;
      const catId = target.getAttribute('data-id');
      if (catId) {
        promptSourceSelection(catId);
      }
    }
  }

  function promptSourceSelection(categoryId) {
    state.activeCategoryId = categoryId;
    const cat = state.categories.find(c => c.id === categoryId);
    if (!cat) return;

    dom.sourceModalTitle.textContent = `${cat.index}. ${cat.title}`;
    dom.sourceModal.style.display = 'flex';
  }

  function hideSourceModal() {
    dom.sourceModal.style.display = 'none';
  }

  function handleNativeFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (file && state.activeCategoryId) {
      processSelectedPhoto(state.activeCategoryId, file);
    }
    // Clear value so the same file can be re-selected if retried
    e.target.value = '';
  }

  // Drag and Drop Handlers
  function handleDragOver(e) {
    const dropzone = e.target.closest('.upload-dropzone');
    if (dropzone) {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--primary)';
      dropzone.style.backgroundColor = 'var(--primary-light)';
    }
  }

  function handleDragLeave(e) {
    const dropzone = e.target.closest('.upload-dropzone');
    if (dropzone) {
      dropzone.style.borderColor = '';
      dropzone.style.backgroundColor = '';
    }
  }

  function handleDrop(e) {
    const dropzone = e.target.closest('.upload-dropzone');
    if (dropzone) {
      e.preventDefault();
      dropzone.style.borderColor = '';
      dropzone.style.backgroundColor = '';
      const catId = dropzone.getAttribute('data-id');
      if (catId && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processSelectedPhoto(catId, e.dataTransfer.files[0]);
      }
    }
  }

  function removePhoto(categoryId) {
    const cat = state.categories.find(c => c.id === categoryId);
    if (!cat) return;

    if (cat.previewUrl) {
      URL.revokeObjectURL(cat.previewUrl);
    }

    cat.file = null;
    cat.previewUrl = null;
    cat.width = 0;
    cat.height = 0;
    cat.isReady = false;

    renderCategoryCards();
    updateProgressUI();
  }

  // ==========================================================================
  // 8. ROBUST IMAGE DECODING & COMPATIBILITY PIPELINE (Section 12)
  // ==========================================================================

  /**
   * Multi-layered browser-compatible image decoding pipeline:
   * 1. Try createImageBitmap with imageOrientation: 'from-image' (hardware EXIF orientation).
   * 2. Fallback to standard Image() with URL.createObjectURL + HTMLImageElement.decode().
   * 3. Fallback to FileReader readAsDataURL.
   * Verifies valid dimensions (> 0) and non-corrupted data before marking ready.
   */
  async function processSelectedPhoto(categoryId, file) {
    const cat = state.categories.find(c => c.id === categoryId);
    if (!cat) return;

    // Check basic file validity
    if (!file || !file.type.startsWith('image/')) {
      alert(`Invalid file selected for "${cat.title}". Please select an image photograph.`);
      return;
    }

    // Indicate loading state on card
    const card = document.getElementById(`card-${categoryId}`);
    if (card) {
      const dropzone = card.querySelector('.upload-dropzone');
      if (dropzone) {
        dropzone.innerHTML = `
          <div class="spinner" style="width: 28px; height: 28px; border-width: 3px;"></div>
          <span style="font-size: 13px; font-weight: 600; color: var(--primary);">Decoding photograph...</span>
        `;
      }
    }

    try {
      const decodedData = await decodeImageWithFallbacks(file);

      // Revoke any previous preview URL for this slot to avoid memory leak
      if (cat.previewUrl) {
        URL.revokeObjectURL(cat.previewUrl);
      }

      // Store the EXACT original File object (Section 14: for ZIP generation)
      cat.file = file;
      cat.previewUrl = decodedData.previewUrl;
      cat.width = decodedData.width;
      cat.height = decodedData.height;
      cat.isReady = true;

      renderCategoryCards();
      updateProgressUI();

      // Clear any previous error styling
      if (card) {
        card.classList.remove('has-missing-error');
      }

    } catch (err) {
      console.error(`Decoding failed for category ${cat.title}:`, err);
      renderCategoryCards();
      alert(`Unable to process "${cat.title}". The image file could not be decoded. Please retake or upload the photograph again.`);
    }
  }

  async function decodeImageWithFallbacks(file) {
    let width = 0;
    let height = 0;
    let previewUrl = null;

    // Attempt 1: createImageBitmap with orientation
    let method1Success = false;
    if (typeof window.createImageBitmap === 'function') {
      try {
        let bitmap = null;
        try {
          // Modern Chromium & Safari support options object with imageOrientation
          bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch (optErr) {
          // Fallback without options if browser rejects dictionary
          bitmap = await window.createImageBitmap(file);
        }

        if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close(); // Clean up GPU memory immediately
          previewUrl = URL.createObjectURL(file);
          method1Success = true;
        }
      } catch (e) {
        console.warn('createImageBitmap failed, trying HTMLImageElement fallback:', e);
      }
    }

    if (method1Success) {
      return { width, height, previewUrl };
    }

    // Attempt 2: HTMLImageElement with URL.createObjectURL & decode()
    let method2Success = false;
    try {
      const objUrl = URL.createObjectURL(file);
      const dimensions = await loadImageElement(objUrl);
      if (dimensions.width > 0 && dimensions.height > 0) {
        width = dimensions.width;
        height = dimensions.height;
        previewUrl = objUrl;
        method2Success = true;
      }
    } catch (e) {
      console.warn('URL.createObjectURL HTMLImageElement failed, trying FileReader fallback:', e);
    }

    if (method2Success) {
      return { width, height, previewUrl };
    }

    // Attempt 3: FileReader with Data URL
    try {
      const dataUrl = await readFileAsDataURL(file);
      const dimensions = await loadImageElement(dataUrl);
      if (dimensions.width > 0 && dimensions.height > 0) {
        width = dimensions.width;
        height = dimensions.height;
        // Use object URL for UI preview if possible to conserve RAM, else dataUrl
        previewUrl = URL.createObjectURL(file);
        return { width, height, previewUrl };
      }
    } catch (e) {
      console.error('All image decoding methods failed:', e);
    }

    throw new Error('All image decoding pipelines failed.');
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      };
      img.onerror = (e) => reject(new Error('Image failed to load in HTMLImageElement'));

      // If decode() is available, use it to ensure it can be rendered
      img.src = src;
      if (typeof img.decode === 'function') {
        img.decode()
          .then(() => {
            resolve({
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height
            });
          })
          .catch(() => {
            // decode() might fail on some WebViews even if onload works; onload handler will resolve
          });
      }
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  // ==========================================================================
  // 9. PROGRESS & VALIDATION UI
  // ==========================================================================

  function updateProgressUI() {
    const readyCount = state.categories.filter(c => c.isReady && c.file).length;
    const totalCount = state.categories.length;
    const percentage = Math.round((readyCount / totalCount) * 100);

    dom.progressCount.textContent = `${readyCount} / ${totalCount} Completed`;
    dom.progressBarFill.style.width = `${percentage}%`;
    dom.barStatusValue.textContent = `${readyCount} of ${totalCount} Photos Ready`;

    if (readyCount === totalCount) {
      dom.progressCount.classList.add('completed');
      dom.progressBarFill.classList.add('all-ready');
    } else {
      dom.progressCount.classList.remove('completed');
      dom.progressBarFill.classList.remove('all-ready');
    }

    const hasSiteName = state.siteName.trim().length > 0;
    if (readyCount === totalCount && hasSiteName) {
      dom.generateReportBtn.classList.add('ready-to-generate');
    } else {
      dom.generateReportBtn.classList.remove('ready-to-generate');
    }
  }

  function validateReportCompleteness() {
    const missing = [];

    // Check Site Name
    if (!state.siteName || state.siteName.trim().length === 0) {
      missing.push({ type: 'site_name', label: 'Site Name' });
    }

    // Check all 6 categories
    state.categories.forEach(cat => {
      if (!cat.isReady || !cat.file) {
        missing.push({ type: 'photo', id: cat.id, label: cat.title });
      }
    });

    return missing;
  }

  function showIncompleteDialog(missingItems) {
    dom.missingItemsList.innerHTML = '';

    const hasSiteMissing = missingItems.some(i => i.type === 'site_name');
    const photoMissingCount = missingItems.filter(i => i.type === 'photo').length;

    const alertMsgEl = dom.incompleteModal.querySelector('.alert-message');
    if (alertMsgEl) {
      if (!hasSiteMissing && photoMissingCount > 0) {
        alertMsgEl.textContent = 'Please upload:';
      } else if (hasSiteMissing && photoMissingCount === 0) {
        alertMsgEl.textContent = 'Please enter Site Name:';
      } else {
        alertMsgEl.textContent = 'Please enter Site Name and upload missing photographs:';
      }
    }

    missingItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.label;
      dom.missingItemsList.appendChild(li);

      // Highlight the corresponding section
      if (item.type === 'site_name') {
        dom.siteNameSection.classList.add('has-error');
      } else if (item.type === 'photo') {
        const card = document.getElementById(`card-${item.id}`);
        if (card) {
          card.classList.add('has-missing-error');
        }
      }
    });

    dom.incompleteModal.style.display = 'flex';
  }

  function scrollToFirstMissingItem() {
    const siteMissing = !state.siteName || state.siteName.trim().length === 0;
    if (siteMissing) {
      dom.siteNameSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dom.siteNameInput.focus();
      return;
    }

    const firstMissingCat = state.categories.find(c => !c.isReady || !c.file);
    if (firstMissingCat) {
      const card = document.getElementById(`card-${firstMissingCat.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // ==========================================================================
  // 10. REPORT GENERATION ORCHESTRATION (PDF + ZIP)
  // ==========================================================================

  async function handleGenerateReportClick() {
    // 1. Validate
    const missing = validateReportCompleteness();
    if (missing.length > 0) {
      showIncompleteDialog(missing);
      return;
    }

    // 2. Open Progress Modal
    showProgressModal();

    try {
      const cleanedSiteName = getCleanSiteName(state.siteName);
      const formattedDate = formatCurrentDate();

      // Step A: Sequential PDF Generation (Section 8, 9, 10, 13)
      updateProgressStep('step-pdf', 'active', 'Building 6-page PDF document...');
      const pdfBlob = await generatePdfDocument(cleanedSiteName, formattedDate);
      updateProgressStep('step-pdf', 'done', 'PDF document generated (6 pages)');

      // Step B: ZIP Generation with Original File Objects (Section 14)
      updateProgressStep('step-zip', 'active', 'Packing original photos into ZIP...');
      const zipBlob = await generateZipArchive();
      updateProgressStep('step-zip', 'done', 'Original photos ZIP packaged');

      // Step C: Verify both files exist
      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error('PDF file generation produced an empty file.');
      }
      if (!zipBlob || zipBlob.size === 0) {
        throw new Error('ZIP file generation produced an empty file.');
      }

      // Step D: Create URLs and prepare success state
      // Revoke any previous generated URLs
      if (state.generatedFiles.pdfUrl) URL.revokeObjectURL(state.generatedFiles.pdfUrl);
      if (state.generatedFiles.zipUrl) URL.revokeObjectURL(state.generatedFiles.zipUrl);

      state.generatedFiles.pdfBlob = pdfBlob;
      state.generatedFiles.pdfUrl = URL.createObjectURL(pdfBlob);
      state.generatedFiles.pdfFileName = `${cleanedSiteName}.pdf`;

      state.generatedFiles.zipBlob = zipBlob;
      state.generatedFiles.zipUrl = URL.createObjectURL(zipBlob);
      state.generatedFiles.zipFileName = `${cleanedSiteName}.zip`;

      // Allow UI to breathe for a moment so FE sees 100% completion
      await new Promise(r => setTimeout(r, 400));
      hideProgressModal();

      // Transition to Success Screen (Section 17)
      displaySuccessScreen();

    } catch (error) {
      console.error('Report Generation Error:', error);
      hideProgressModal();
      alert(`Report Generation Failed: ${error.message || 'An error occurred while generating files.'}\n\nPlease try again.`);
    }
  }

  // ==========================================================================
  // 11. HIGH-QUALITY PROPORTIONAL PDF GENERATION (Sections 8, 9, 10, 13)
  // ==========================================================================

  /**
   * Generates a 6-page PDF using jsPDF.
   * Strictly adheres to proportional aspect ratio scaling (fit-inside/contain).
   * Sequential processing: ensures each page is loaded, validated, and rendered
   * before advancing to the next, preventing blank pages.
   */
  async function generatePdfDocument(cleanedSiteName, formattedDate) {
    const { jsPDF } = window.jspdf || window;
    if (!jsPDF) {
      throw new Error('jsPDF library is not loaded. Please check your internet connection.');
    }

    // A4 dimensions: 210 x 297 mm
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

    // Layout coordinates
    const headerTopY = 10;
    const headerBottomY = 26; // thin line at 25 mm
    const footerY = 290;
    const availableHeight = footerY - headerBottomY - 4; // 290 - 26 - 4 = 260 mm

    const totalPages = state.categories.length; // Exactly 6

    for (let i = 0; i < totalPages; i++) {
      const cat = state.categories[i];
      const pageNum = i + 1;

      if (i > 0) {
        doc.addPage();
      }

      // Update progress modal with active category
      updateProgressStep('step-photos', 'active', `Processing ${cat.title} (Page ${pageNum} of 6)...`);

      // 1. Draw Page Header
      // Section Heading (13pt bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59); // #1e293b
      doc.text(`${cat.index}. ${cat.title.toUpperCase()}`, marginX, headerTopY + 4);

      // Row 2: Site Name & Date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105); // #475569

      // Site Name retains actual entered text with spaces (Section 15)
      const siteDisplay = `Site: ${state.siteName.trim()}`;
      doc.text(siteDisplay, marginX, headerTopY + 10.5);

      const dateDisplay = `Date: ${formattedDate}`;
      const dateWidth = doc.getTextWidth(dateDisplay);
      doc.text(dateDisplay, pageWidth - marginX - dateWidth, headerTopY + 10.5);

      // Divider Line
      doc.setDrawColor(203, 213, 225); // #cbd5e1
      doc.setLineWidth(0.3);
      doc.line(marginX, headerBottomY, pageWidth - marginX, headerBottomY);

      // 2. Footer: Page Indicator
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // #94a3b8
      const pageStr = `Page ${pageNum} of ${totalPages}`;
      const pageStrWidth = doc.getTextWidth(pageStr);
      doc.text(pageStr, pageWidth - marginX - pageStrWidth, footerY + 2);

      // Small utility tag
      doc.text('Site Installation Photo Report', marginX, footerY + 2);

      // 3. Load & Normalize Image for PDF
      // Using canvas normalization ensures standard sRGB JPEG baseline, eliminates
      // camera-specific corrupted chunks, and prevents mobile browser crashes
      const { dataUrl, width: imgW, height: imgH } = await prepareImageForPdf(cat);

      if (!dataUrl || imgW <= 0 || imgH <= 0) {
        throw new Error(`Failed to decode image data for "${cat.title}".`);
      }

      // 4. Proportional Aspect Ratio Calculation (Section 9)
      // scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
      const scale = Math.min(availableWidth / imgW, availableHeight / imgH);
      const finalWidth = imgW * scale;
      const finalHeight = imgH * scale;

      // Center horizontally and vertically within available page area
      const x = marginX + (availableWidth - finalWidth) / 2;
      const y = headerBottomY + 2 + (availableHeight - finalHeight) / 2;

      // 5. Draw Image to PDF
      doc.addImage(dataUrl, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');

      // 6. Subtle professional frame border around photo
      doc.setDrawColor(226, 232, 240); // #e2e8f0
      doc.setLineWidth(0.2);
      doc.rect(x, y, finalWidth, finalHeight);
    }

    updateProgressStep('step-photos', 'done', 'All 6 photographs validated and placed on pages');

    // Return as Blob
    return doc.output('blob');
  }

  /**
   * Prepares and normalizes an image for jsPDF rendering:
   * - Hardware EXIF orientation handling with createImageBitmap
   * - Fallback to HTMLImageElement and FileReader
   * - Clamps maximum dimension to 2560px (providing 340+ DPI on A4 while protecting RAM)
   * - Retains crisp 1:1 original clarity for CMD and Speed Test readings
   * - Converts to standard sRGB baseline JPEG data URL
   */
  async function prepareImageForPdf(cat) {
    const file = cat.file;

    // Attempt Path 1: createImageBitmap with hardware EXIF orientation handling
    if (typeof window.createImageBitmap === 'function') {
      try {
        let bitmap = null;
        try {
          bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch (optErr) {
          bitmap = await window.createImageBitmap(file);
        }

        if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
          const natW = bitmap.width;
          const natH = bitmap.height;

          const MAX_DIM = 2560;
          let targetW = natW;
          let targetH = natH;

          if (natW > MAX_DIM || natH > MAX_DIM) {
            if (natW > natH) {
              targetW = MAX_DIM;
              targetH = Math.round((natH * MAX_DIM) / natW);
            } else {
              targetH = MAX_DIM;
              targetW = Math.round((natW * MAX_DIM) / natH);
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          bitmap.close(); // Clean up GPU memory immediately

          const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
          canvas.width = 0;
          canvas.height = 0;

          return { dataUrl, width: natW, height: natH };
        }
      } catch (e) {
        console.warn(`createImageBitmap in prepareImageForPdf failed for ${cat.title}, using Image fallback:`, e);
      }
    }

    // Attempt Path 2: HTMLImageElement with previewUrl / objectURL
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const natW = img.naturalWidth || img.width;
          const natH = img.naturalHeight || img.height;

          if (!natW || !natH) {
            reject(new Error(`Invalid dimensions for ${cat.title}`));
            return;
          }

          const MAX_DIM = 2560;
          let targetW = natW;
          let targetH = natH;

          if (natW > MAX_DIM || natH > MAX_DIM) {
            if (natW > natH) {
              targetW = MAX_DIM;
              targetH = Math.round((natH * MAX_DIM) / natW);
            } else {
              targetH = MAX_DIM;
              targetW = Math.round((natW * MAX_DIM) / natH);
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
          canvas.width = 0;
          canvas.height = 0;

          resolve({
            dataUrl,
            width: natW,
            height: natH
          });
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => {
        // Attempt Path 3: FileReader with Data URL
        readFileAsDataURL(file)
          .then(dataUrl => {
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              const natW = fallbackImg.naturalWidth || fallbackImg.width;
              const natH = fallbackImg.naturalHeight || fallbackImg.height;
              resolve({ dataUrl, width: natW, height: natH });
            };
            fallbackImg.onerror = () => reject(new Error(`Failed to load ${cat.title} for PDF compilation.`));
            fallbackImg.src = dataUrl;
          })
          .catch(err => reject(new Error(`Failed to read ${cat.title}: ${err.message}`)));
      };

      img.src = cat.previewUrl || URL.createObjectURL(file);
    });
  }

  // ==========================================================================
  // 12. ORIGINAL PHOTOGRAPHS ZIP GENERATION (Section 14)
  // ==========================================================================

  /**
   * Generates a ZIP archive containing the 6 original uploaded photographs.
   * Section 14 Strict Rules:
   * - Uses actual original File objects uploaded by the FE.
   * - No canvas processing, no re-compression, no resolution changes, no screenshots.
   * - Preserves original file extension.
   * - Category-based filenames inside the ZIP.
   */
  async function generateZipArchive() {
    if (typeof window.JSZip !== 'function') {
      throw new Error('JSZip library is not loaded. Please check your internet connection.');
    }

    const zip = new JSZip();

    state.categories.forEach(cat => {
      const originalFile = cat.file;

      // Extract original file extension
      let ext = 'jpg';
      if (originalFile.name && originalFile.name.lastIndexOf('.') !== -1) {
        ext = originalFile.name.substring(originalFile.name.lastIndexOf('.') + 1).toLowerCase();
      } else if (originalFile.type) {
        const mimeExt = originalFile.type.replace('image/', '').toLowerCase();
        if (mimeExt === 'jpeg') ext = 'jpg';
        else if (mimeExt) ext = mimeExt;
      }

      // Meaningful category-based filename preserving original extension
      const zipEntryName = `${cat.title}.${ext}`;

      // Store raw original File object directly
      zip.file(zipEntryName, originalFile);
    });

    // Generate ZIP blob with standard DEFLATE compression
    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  // ==========================================================================
  // 13. SUCCESS SCREEN & DOWNLOADS (Section 16, 17)
  // ==========================================================================

  function displaySuccessScreen() {
    dom.formScreen.style.display = 'none';
    dom.successScreen.style.display = 'block';

    dom.successSiteName.textContent = state.siteName.trim();

    // PDF Card details
    dom.pdfFileNameDisplay.textContent = state.generatedFiles.pdfFileName;
    const pdfSize = formatFileSize(state.generatedFiles.pdfBlob.size);
    dom.pdfMetaDisplay.textContent = `6 Pages • ${pdfSize} • High Resolution`;

    // ZIP Card details
    dom.zipFileNameDisplay.textContent = state.generatedFiles.zipFileName;
    const zipSize = formatFileSize(state.generatedFiles.zipBlob.size);
    dom.zipMetaDisplay.textContent = `6 Original Photos • ${zipSize} • Raw Quality`;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function triggerDownload(blobUrl, filename) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==========================================================================
  // 14. RESET / CREATE NEW REPORT (Section 19)
  // ==========================================================================

  function handleCreateNewReport() {
    const confirmReset = window.confirm(
      'Are you sure you want to create a new report?\n\nPlease make sure you have downloaded both the PDF and ZIP files before continuing.'
    );

    if (!confirmReset) return;

    // Revoke all created Object URLs
    state.categories.forEach(cat => {
      if (cat.previewUrl) URL.revokeObjectURL(cat.previewUrl);
    });

    if (state.generatedFiles.pdfUrl) URL.revokeObjectURL(state.generatedFiles.pdfUrl);
    if (state.generatedFiles.zipUrl) URL.revokeObjectURL(state.generatedFiles.zipUrl);

    // Reset State
    state.siteName = '';
    state.categories = JSON.parse(JSON.stringify(REQUIRED_CATEGORIES));
    state.activeCategoryId = null;
    state.generatedFiles = {
      pdfBlob: null,
      pdfUrl: null,
      pdfFileName: '',
      zipBlob: null,
      zipUrl: null,
      zipFileName: ''
    };

    // Reset Inputs
    dom.siteNameInput.value = '';
    dom.clearSiteNameBtn.style.display = 'none';
    dom.siteNamePreviewText.innerHTML = 'Filename: <em>Enter site name above</em>';
    dom.siteNameSection.classList.remove('has-error');

    // Re-render UI
    renderCategoryCards();
    updateProgressUI();

    // Switch View
    dom.successScreen.style.display = 'none';
    dom.formScreen.style.display = 'flex';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // 15. PROGRESS MODAL HELPERS
  // ==========================================================================

  function showProgressModal() {
    dom.progressModal.style.display = 'flex';
    resetProgressStep('step-photos', 'Processing photographs...');
    resetProgressStep('step-pdf', 'Creating 6-page PDF document...');
    resetProgressStep('step-zip', 'Packing original photographs into ZIP...');
  }

  function hideProgressModal() {
    dom.progressModal.style.display = 'none';
  }

  function resetProgressStep(stepId, text) {
    const el = document.getElementById(stepId);
    if (el) {
      el.className = 'step-item';
      el.querySelector('.step-icon').textContent = '⏳';
      el.querySelector('.step-text').textContent = text;
    }
  }

  function updateProgressStep(stepId, status, text) {
    const el = document.getElementById(stepId);
    if (el) {
      el.className = `step-item ${status}`;
      if (status === 'done') {
        el.querySelector('.step-icon').textContent = '✓';
      } else if (status === 'active') {
        el.querySelector('.step-icon').textContent = '🔄';
      }
      if (text) {
        el.querySelector('.step-text').textContent = text;
      }
    }
  }

  // ==========================================================================
  // 16. FORMATTING UTILITIES
  // ==========================================================================

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatCurrentDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  // Start the application
  document.addEventListener('DOMContentLoaded', init);

})();
