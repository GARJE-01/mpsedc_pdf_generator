# Site Installation Photo & Report Generator

> **Live Application**: [https://mpsedc.netlify.app](https://mpsedc.netlify.app)

A mobile-friendly, client-side web application designed for Field Engineers (FE) to document site installations with zero friction.

The application allows Field Engineers to enter the Site Name, capture or upload 6 compulsory installation photographs, and instantly generate two deliverables:
1. **Professionally Formatted PDF Report (`<Site_Name>.pdf`)**: Exactly 6 pages containing one photo per page with mathematical aspect ratio preservation, high visual clarity, section headings, Site Name, and date.
2. **Original Photographs ZIP (`<Site_Name>.zip`)**: Contains the unmodified, full-quality original `File` objects uploaded by the engineer.

---

## 🌐 Live Application

Access the live web utility here:  
👉 **[https://mpsedc.netlify.app](https://mpsedc.netlify.app)**

---

## 🚀 Key Features

- **100% Client-Side Processing**: Operates entirely in the browser using HTML5, CSS3, and Vanilla JavaScript. No data or photographs are ever uploaded to an external server or cloud database.
- **Mobile-First & Touch-Friendly**: Designed for Android smartphones with large touch targets (minimum 48px), high contrast for outdoor sunlight readability, and camera/gallery bottom sheet triggers.
- **Strict Aspect Ratio Preservation**: Images are mathematically scaled using fit-inside logic (`scale = Math.min(availW / imgW, availH / imgH)`). Images are **never stretched, squeezed, or cropped**.
- **Multi-Layered Mobile Image Compatibility**:
  - Immediate in-memory `ArrayBuffer` ingestion to completely prevent Android OS `NotReadableError` file permission expiration.
  - Primary decoding via `createImageBitmap` with hardware EXIF orientation (`imageOrientation: 'from-image'`).
  - Graceful fallback to `HTMLImageElement` with `URL.createObjectURL` and `decode()`.
  - Secondary fallback to `FileReader` with `readAsDataURL`.
  - Canvas normalization protects against memory crashes on high-megapixel mobile cameras while preserving crystal-clear readability for CMD terminal outputs and Speed Test values.
- **Sequential PDF Generation**: Guaranteed zero blank pages by awaiting full validation and decoding of each photo before advancing to the next page.
- **True Original ZIP Archive**: Preserves the exact uploaded camera files (including original metadata, resolution, and file extensions like `.jpg`, `.jpeg`, `.png`) without re-compression.
- **Clean Standardized Filenames**: Automatic sanitation converts spaces to single underscores (e.g. `Mumbai Fort` → `Mumbai_Fort.pdf` and `Mumbai_Fort.zip`).
- **No SOL ID**: Strictly uses Site Name only.

---

## 📁 Project Structure

```text
site-report-generator/
│
├── index.html         # Semantic, mobile-first interface with accessibility support
├── style.css          # Responsive styling, touch targets, and visual feedback
├── script.js          # Core application logic, image decoding pipeline, jsPDF & JSZip
├── README.md          # Project documentation with live application link
└── lib/
    ├── jspdf.umd.min.js  # Bundled jsPDF (with automatic CDN fallback)
    └── jszip.min.js      # Bundled JSZip (with automatic CDN fallback)
```

---

## 📋 Required Photo Categories (In Order)

1. **Pre-Installation Photo** — Photograph of the site before installation begins.
2. **Post-Installation Photo** — Photograph of the site after installation is completed.
3. **CMD Photo** — Photograph of the CMD output/evidence.
4. **Speed Test Photo** — Photograph showing the speed test result.
5. **Working Application Photo** — Photograph showing that the application/system is working.
6. **Sign-Off Report Photo** — Photograph of the completed sign-off report.

---

## 🌐 Netlify Deployment

The application is deployed live at:  
👉 **[https://mpsedc.netlify.app](https://mpsedc.netlify.app)**

Continuous deployment is configured directly with the GitHub repository:
- **Repository**: `https://github.com/GARJE-01/mpsedc_pdf_generator.git`
- **Branch**: `main`
- **Build command**: *(none required / static)*
- **Publish directory**: `.` or `site-report-generator`

---

## 🧪 Automated Verification Suite

Run the included verification suite to validate filename sanitization, aspect ratio math, ZIP packaging, and 6-page PDF generation:

```bash
node test-suite.js
```
