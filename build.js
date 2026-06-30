import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en" data-mode="geotexdb">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#f5f5f5">
    <title>geotexdb — Geotextile Cross-Reference</title>
    <link rel="stylesheet" href="__STYLE__">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u25ce</text></svg>">
</head>
<body>

<div id="sidebar" class="sidebar">
    <div class="header">
        <div class="header-main-row">
            <div class="mode-titles">
                <span class="mode-title active" data-mode="geotexdb">geotex<span>db</span></span>
                <span class="mode-title" data-mode="geogriddb">geogri<span>db</span></span>
            </div>
            <button class="btn-icon" id="themeToggle" title="Toggle theme" aria-label="Toggle theme">&#9790;</button>
        </div>
        <div class="sidebar-search">
            <div class="sidebar-search-row">
                <span class="global-search-icon">\u2315</span>
                <input type="text" id="searchInput" class="global-search-input" placeholder="Search product code or name..." autocomplete="off" spellcheck="false">
                <button class="btn-icon gs-clear-btn" id="searchClearBtn" title="Clear" aria-label="Clear">&#10005;</button>
            </div>
        </div>
        <div class="status-bar" id="statusBar" aria-live="polite">Loading database...</div>
    </div>
    <div id="results" class="results-area">
        <div class="drop-zone-empty" id="emptyState">
            <div class="drop-zone-empty-icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="24" cy="24" r="18"/>
                    <path d="M24 14v14M24 32v2"/>
                </svg>
            </div>
            <h2 class="drop-zone-empty-title">Type to search geotextiles</h2>
            <p class="drop-zone-empty-text">Search by product code, manufacturer, or browse by type.</p>
        </div>
    </div>
</div>

<div id="resizer"></div>

<div class="viewer-container">
    <div class="viewer-toolbar" id="pdfToolbar">
        <div class="toolbar-section" style="flex:1;min-width:0">
            <div class="toolbar-row">
                <span class="pdf-toolbar-title" id="pdfTitle">No product selected</span>
            </div>
        </div>
        <div class="toolbar-section" id="pdfNavSection">
            <div class="toolbar-row">
                <button class="toolbar-btn" id="pdfPrevBtn" title="Previous page" disabled>&#8592;</button>
                <input type="number" class="pdf-page-input" id="pdfPageInput" value="1" min="1" disabled>
                <span class="pdf-page-total" id="pdfPageTotal">/ 0</span>
                <button class="toolbar-btn" id="pdfNextBtn" title="Next page" disabled>&#8594;</button>
            </div>
        </div>
        <div class="toolbar-section">
            <div class="toolbar-row">
                <button class="toolbar-btn" id="pdfZoomOutBtn" title="Zoom out" disabled>&#8722;</button>
                <span class="pdf-zoom-level" id="pdfZoomLevel">100%</span>
                <button class="toolbar-btn" id="pdfZoomInBtn" title="Zoom in" disabled>+</button>
            </div>
        </div>
        <div class="toolbar-section">
            <div class="toolbar-row">
                <button class="toolbar-btn" id="pdfDownloadBtn" title="Download PDF" disabled>&#8600;</button>
                <button class="toolbar-btn" id="pdfOpenBtn" title="Open in new tab" disabled>&#8599;</button>
            </div>
        </div>
    </div>
    <div class="viewer-scroll" id="viewerScroll">
        <div id="pdfViewerContainer" class="pdf-viewer-container">
            <div class="pdf-empty" id="pdfEmpty">
                <div class="pdf-empty-icon">&#128196;</div>
                <h2>Select a product to view its datasheet</h2>
                <p>Click on any product in the sidebar.</p>
            </div>
            <iframe id="pdfEmbed" class="pdf-embed" hidden></iframe>
        </div>
    </div>
</div>

<script src="__BUNDLE__"></script>
</body>
</html>`;

const isDev = process.argv.includes('--dev');

// Clean rebuild
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// Bundle JS
await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/index.ts')],
    bundle: true,
    outfile: path.join(dist, 'bundle.js'),
    format: 'iife',
    minify: !isDev,
    sourcemap: isDev,
    define: { 'process.env.NODE_ENV': isDev ? '"development"' : '"production"' },
});

// Copy assets
function copyTo(srcRel, destDir) {
    const src = path.join(__dirname, srcRel);
    const dest = path.join(destDir, path.basename(srcRel));
    if (src !== dest) fs.cpSync(src, dest, { recursive: true });
}
for (const dir of [dist, __dirname]) {
    copyTo('src/style.css', dir);
    copyTo('fonts', dir);
    copyTo('logos', dir);
}

const bundlePath = path.join(dist, 'bundle.js');

// Compute hash of final bundle for cache busting
const finalBundle = fs.readFileSync(bundlePath, 'utf8');
const hash = crypto.createHash('md5').update(finalBundle).digest('hex').slice(0, 8);

// Rename bundle to include hash (hard cache bust — different filename each build)
const hashedBundle = `bundle.${hash}.js`;
fs.renameSync(bundlePath, path.join(dist, hashedBundle));

// Clean up old bundle.*.js files in dist/
for (const f of fs.readdirSync(dist)) {
    if (f !== hashedBundle && /^bundle\..*\.js$/.test(f)) {
        fs.rmSync(path.join(dist, f), { force: true });
    }
}

function renderHtml(styleRef, bundleRef) {
    return HTML_TEMPLATE
        .replace('__STYLE__', styleRef)
        .replace('__BUNDLE__', bundleRef);
}

// Dev version (references dist/bundle.HASH.js from project root)
fs.writeFileSync(path.join(__dirname, 'index.html'), renderHtml(`style.css?v=${hash}`, `dist/${hashedBundle}`));
// Dist version (references bundle.HASH.js from dist/)
fs.writeFileSync(path.join(dist, 'index.html'), renderHtml(`style.css?v=${hash}`, hashedBundle));

console.log(`Build complete (hash: ${hash})`);
