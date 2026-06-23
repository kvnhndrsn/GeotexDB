import type { Product } from './search'
import { searchProducts } from './search'

const searchInput = document.getElementById('searchInput') as HTMLInputElement
const clearBtn = document.getElementById('searchClearBtn') as HTMLButtonElement
const resultsArea = document.getElementById('results') as HTMLDivElement
const emptyState = document.getElementById('emptyState') as HTMLDivElement
const statusBar = document.getElementById('statusBar') as HTMLDivElement
const themeBtn = document.getElementById('themeToggle') as HTMLButtonElement

const pdfEmbed = document.getElementById('pdfEmbed') as HTMLIFrameElement
const pdfEmpty = document.getElementById('pdfEmpty') as HTMLDivElement
const pdfTitle = document.getElementById('pdfTitle') as HTMLSpanElement
const pdfPrevBtn = document.getElementById('pdfPrevBtn') as HTMLButtonElement
const pdfNextBtn = document.getElementById('pdfNextBtn') as HTMLButtonElement
const pdfPageInput = document.getElementById('pdfPageInput') as HTMLInputElement
const pdfPageTotal = document.getElementById('pdfPageTotal') as HTMLSpanElement
const pdfZoomOutBtn = document.getElementById('pdfZoomOutBtn') as HTMLButtonElement
const pdfZoomInBtn = document.getElementById('pdfZoomInBtn') as HTMLButtonElement
const pdfZoomLevel = document.getElementById('pdfZoomLevel') as HTMLSpanElement
const pdfDownloadBtn = document.getElementById('pdfDownloadBtn') as HTMLButtonElement
const pdfOpenBtn = document.getElementById('pdfOpenBtn') as HTMLButtonElement
const pdfNavSection = document.getElementById('pdfNavSection') as HTMLDivElement

const SUPABASE_BASE = 'https://ebcfmvifwkzfblmwgwbu.supabase.co/storage/v1/object/public/'
const SUPABASE_MFRS = new Set(['SKAPS', 'US Fabrics', 'Nilex', 'Propex'])

function pdfUrl(product: Product): string {
    if (product.pdfPath && SUPABASE_MFRS.has(product.manufacturer)) {
        return SUPABASE_BASE + product.pdfPath
    }
    return product.pdfPath ?? ''
}

let allProducts: Product[] = []
let filteredProducts: Product[] = []
let selectedProduct: Product | null = null
let appMode: 'geotexdb' | 'geogriddb' = 'geotexdb'

const GEOGRID_TYPES = ['Geogrid', 'Biaxial Geogrid', 'Uniaxial Geogrid', 'Triax']
function isGeogridProduct(p: Product): boolean {
    return getProductTypes(p).some(t => GEOGRID_TYPES.includes(t))
}

export function initUI(products: Product[]) {
    console.log('geotexdb: initUI start, products:', products?.length)
    allProducts = products
    filteredProducts = products
    setupSearch()
    setupTheme()
    setupMode()
    computeFilterOptions(products)
    setupColumnFilters()
    console.log('geotexdb: setupTheme done, setupPDFControls')
    setupPDFControls()
    console.log('geotexdb: setupPDFControls done, renderSidebarList')
    renderSidebarList(products)
    console.log('geotexdb: setupResizer')
    setupResizer()
    console.log('geotexdb: initUI complete')
    applyFilters()
}

const mfrLogoMap: Record<string, string> = {
    'Ace-Geosynthetics': 'ace.svg',
    'Afitex-Texel': 'texel.svg',
    'Amoco': 'amoco.svg',
    'Belton': 'belton.svg',
    'Carthage': 'carthage.svg',
    'Cetco': 'cetco.svg',
    'Hanes': 'hanes.svg',
    'Huesker': 'huesker.svg',
    'Layfield': 'layfield.svg',
    'Maccaferri': 'maca.svg',
    'Naue': 'naue.svg',
    'Nilex': 'nilex.svg',
    'Propex': 'propex.svg',
    'SKAPS': 'skaps.svg',
    'Soleno': 'soleno.svg',
    'Solmax': 'solmax.svg',
    'Srw': 'SRW.svg',
    'Tensar': 'tensar.svg',
    'Terrafix': 'terrafix.svg',
    'Thrace-LINQ': 'thrace.svg',
    'Titan Environmental': 'titan.svg',
    'Typar': 'typar.svg',
    'US Fabrics': 'usfabrics.svg',
    'Winfab': 'winfab.svg',
}

const typeGroups: { label: string; types: string[] }[] = [
    { label: 'Non-woven', types: ['Non-woven', 'Environmental', 'Civil'] },
    { label: 'Woven', types: ['Woven', 'High Strength', 'High Tensile Modulus'] },
    { label: 'Geogrid', types: ['Geogrid', 'Biaxial Geogrid', 'Uniaxial Geogrid', 'Triax'] },
    { label: 'Geomembrane', types: ['Geomembrane'] },
    { label: 'TRM', types: ['TRM'] },
    { label: 'Drainage', types: ['Drainage'] },
    { label: 'Silt Fence', types: ['Silt Fence', 'Filter Sock'] },
    { label: 'Bag', types: ['Bag'] },
    { label: 'Wicking', types: ['Wicking', 'H2Ri'] },
]

function getProductTypes(p: Product): string[] {
    return p.type.split('|').map(t => t.trim()).filter(Boolean)
}

function computeFilterOptions(products: Product[]) {
    const existingTypes = new Set(products.flatMap(p => getProductTypes(p)))
    const typeOptions: string[] = []
    for (const group of typeGroups) {
        for (const t of group.types) {
            if (existingTypes.has(t)) typeOptions.push(t)
        }
    }
    allTypeOptions = typeOptions
    allMfrOptions = [...new Set(products.map(p => p.manufacturer))].sort()
}

let allTypeOptions: string[] = []
let allMfrOptions: string[] = []

/* ── Filter State ── */

let filterCode = ''
let filterVal = ''
let filterTypeSelected = ''
let filterMfrSelected = ''
let sortField: string = 'code'
let sortDir: 'asc' | 'desc' = 'asc'

function setupColumnFilters() {
    const ra = document.getElementById('results')!
    ra.addEventListener('input', (e) => {
        const t = e.target as HTMLElement
        if (t.id === 'filterCode') { filterCode = (t as HTMLInputElement).value; applyFilters() }
        else if (t.id === 'filterVal') { filterVal = (t as HTMLInputElement).value; applyFilters() }
    })
    ra.addEventListener('change', (e) => {
        const t = e.target as HTMLElement
        if (t.id === 'filterTypeSelect') { filterTypeSelected = (t as HTMLSelectElement).value; applyFilters() }
    })
}

function setupSearch() {
    searchInput.addEventListener('input', onSearch)
    clearBtn.addEventListener('click', () => {
        searchInput.value = ''
        clearBtn.classList.remove('visible')
        searchInput.focus()
        onSearch()
    })
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.blur()
        }
    })
}

function onSearch() {
    const q = searchInput.value
    clearBtn.classList.toggle('visible', q.length > 0)
    applyFilters()
}

/* ── Filter State ── */

function sortProducts(products: Product[]): Product[] {
    const mult = sortDir === 'asc' ? 1 : -1
    const copy = [...products]
    copy.sort((a, b) => {
        if (sortField === 'code') return a.code.localeCompare(b.code) * mult
        if (sortField === 'mfr') return a.manufacturer.localeCompare(b.manufacturer) * mult
        if (sortField === 'type') return a.type.localeCompare(b.type) * mult
        return 0
    })
    return copy
}

function getValueDisplay(p: Product): string {
    const types = getProductTypes(p)
    const isNonWoven = types.some(t => t === 'Non-woven' || t === 'Environmental' || t === 'Civil')
    const isWoven = types.some(t => t === 'Woven' || t === 'High Strength' || t === 'High Tensile Modulus')

    if (isNonWoven && p.weight_oz) return `${p.weight_oz} oz`
    if (isNonWoven && p.weight_g_m2) return `${p.weight_g_m2} g/m²`
    if (isWoven && p.grab_tensile_lb) return `${p.grab_tensile_lb} lb`
    return '—'
}

function applyFilters() {
    const q = searchInput.value.trim()
    const type = filterTypeSelected
    const mfr = filterMfrSelected

    let results = q ? searchProducts(q) : allProducts
    if (appMode === 'geogriddb') results = results.filter(p => isGeogridProduct(p))
    else results = results.filter(p => !isGeogridProduct(p))
    if (type) results = results.filter(p => getProductTypes(p).includes(type))
    if (mfr) results = results.filter(p => p.manufacturer === mfr)
    if (filterCode) results = results.filter(p => p.code.toLowerCase().includes(filterCode.toLowerCase()))
    if (filterVal) {
        const fl = filterVal.toLowerCase()
        results = results.filter(p => getValueDisplay(p).toLowerCase().includes(fl))
    }

    filteredProducts = results
    renderItems(results)
    updateCount(results.length)
}

function updateCount(count: number) {
    const parts: string[] = [`${count} product${count !== 1 ? 's' : ''}`]
    const q = searchInput.value.trim()
    const type = filterTypeSelected
    const mfr = filterMfrSelected
    if (q) parts.push(`for "${q}"`)
    if (type) parts.push(`in ${type}`)
    if (mfr) parts.push(`by ${mfr}`)
    if (filterCode) parts.push(`code ${filterCode}`)
    if (filterVal) parts.push(`prop ${filterVal}`)
    statusBar.textContent = parts.join(' ')
}

function renderSidebarList(_?: Product[]) {
    resultsArea.innerHTML = ''

    // Sticky header + filter row container
    const sticky = document.createElement('div')
    sticky.className = 'sidebar-sticky'

    // Column header row (clickable for sort)
    const header = document.createElement('div')
    header.className = 'sidebar-list-header sidebar-grid'
    header.innerHTML =
        `<span class="sh-code" data-sort="code">Product</span>` +
        `<span class="sh-mfr" data-sort="mfr">Manufacturer</span>` +
        `<span class="sh-type" data-sort="type">Type</span>` +
        `<span class="sh-val">Properties</span>`
    header.querySelectorAll('[data-sort]').forEach(el => {
        el.addEventListener('click', () => {
            const field = (el as HTMLElement).dataset.sort!
            if (sortField === field) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc'
            } else {
                sortField = field
                sortDir = 'asc'
            }
            renderItems(filteredProducts)
        })
    })
    sticky.appendChild(header)

    // Column filter row — inline text inputs (code, properties) + dropdowns (mfr, type)
    const filters = document.createElement('div')
    filters.className = 'sidebar-list-filters sidebar-grid'

    // Code filter
    const codeInput = document.createElement('input')
    codeInput.type = 'text'
    codeInput.className = 'sf-input sf-code'
    codeInput.id = 'filterCode'
    codeInput.placeholder = 'Code...'
    codeInput.value = filterCode
    filters.appendChild(codeInput)

    // Manufacturer custom dropdown with SVGs
    const mfrDropdown = createMfrDropdown()
    filters.appendChild(mfrDropdown)

    // Type native select
    const typeSelect = document.createElement('select')
    typeSelect.className = 'sf-select sf-type'
    typeSelect.id = 'filterTypeSelect'
    typeSelect.innerHTML = `<option value="">All</option>${typeOptionsHtml()}`
    typeSelect.value = filterTypeSelected
    filters.appendChild(typeSelect)

    // Properties filter
    const valInput = document.createElement('input')
    valInput.type = 'text'
    valInput.className = 'sf-input sf-val'
    valInput.id = 'filterVal'
    valInput.placeholder = 'Prop...'
    valInput.value = filterVal
    filters.appendChild(valInput)

    sticky.appendChild(filters)

    const list = document.createElement('div')
    list.className = 'sidebar-list'
    list.appendChild(sticky)
    list.appendChild(document.createElement('div')) // placeholder for items

    resultsArea.appendChild(list)
    renderItems(filteredProducts)
}

function renderItems(products: Product[]) {
    const list = resultsArea.querySelector('.sidebar-list')
    if (!list) return

    const sorted = sortProducts(products)
    const container = list.children[1] // second child is items container
    container.innerHTML = ''

    if (sorted.length === 0) {
        const empty = emptyState.cloneNode(true) as HTMLElement
        empty.style.display = 'flex'
        empty.querySelector('h2')!.textContent = 'No products match your filters'
        empty.querySelector('p')!.textContent = 'Try adjusting your filter criteria.'
        container.appendChild(empty)
        return
    }

    // Update sort indicators in header
    const header = list.querySelector('.sidebar-list-header')!
    header.querySelectorAll('[data-sort]').forEach(el => {
        const field = (el as HTMLElement).dataset.sort!
        const arrow = sortField === field ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''
        const base = field === 'code' ? 'Product' : field === 'mfr' ? 'Manufacturer' : 'Type'
        el.textContent = base + arrow
    })

    const itemsFragment = document.createDocumentFragment()
    sorted.slice(0, 500).forEach((p) => {
        const item = document.createElement('div')
        item.className = 'sidebar-item sidebar-grid'
        if (selectedProduct === p) item.classList.add('selected')

        const types = getProductTypes(p)
        const hasPdf = p.pdfPath ? '<span class="pdf-indicator">&#128196;</span>' : ''
        const typePills = types.map(t => {
            const tc = t.toLowerCase().replace(/[\s/]+/g, '-')
            return `<span class="sidebar-item-type ${tc}">${esc(t)}</span>`
        }).join('')
        const val = esc(getValueDisplay(p))
        const logoFile = mfrLogoMap[p.manufacturer]
        const logoHtml = logoFile ? `<img class="mfr-logo" src="logos/${logoFile}" alt="">` : ''

        item.innerHTML = `<span class="sidebar-item-code">${esc(p.code)} ${hasPdf}</span><span class="sidebar-item-mfr">${logoHtml}<span class="mfr-name">${esc(p.manufacturer)}</span></span><span class="sidebar-item-types">${typePills}</span><span class="sidebar-item-val">${val}</span>`

        item.addEventListener('click', () => selectProduct(p))
        itemsFragment.appendChild(item)
    })
    container.appendChild(itemsFragment)
}

function mfrOptionInner(mfr: string): string {
    const logoFile = mfrLogoMap[mfr]
    return logoFile
        ? `<img class="mfr-dd-logo" src="logos/${logoFile}" alt=""> <span>${esc(mfr)}</span>`
        : esc(mfr)
}

function createMfrDropdown(): HTMLDivElement {
    const container = document.createElement('div')
    container.className = 'mfr-dropdown'
    container.id = 'mfrDropdown'

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'mfr-dropdown-trigger'
    trigger.id = 'mfrDropdownTrigger'
    const updateTrigger = () => {
        const sel = filterMfrSelected
        trigger.innerHTML = sel
            ? mfrOptionInner(sel) + ' <span class="dd-arrow">▾</span>'
            : 'All <span class="dd-arrow">▾</span>'
    }
    updateTrigger()
    container.appendChild(trigger)

    const panel = document.createElement('div')
    panel.className = 'mfr-dropdown-panel'

    // "All" option
    const allOpt = document.createElement('div')
    allOpt.className = 'mfr-dd-opt'
    allOpt.dataset.value = ''
    allOpt.textContent = 'All'
    if (!filterMfrSelected) allOpt.classList.add('selected')
    allOpt.addEventListener('click', () => {
        filterMfrSelected = ''
        updateTrigger()
        panel.classList.remove('open')
        panel.querySelectorAll('.mfr-dd-opt').forEach(opt => opt.classList.remove('selected'))
        allOpt.classList.add('selected')
        applyFilters()
    })
    panel.appendChild(allOpt)

    for (const mfr of allMfrOptions) {
        const opt = document.createElement('div')
        opt.className = 'mfr-dd-opt'
        if (filterMfrSelected === mfr) opt.classList.add('selected')
        opt.dataset.value = mfr
        opt.innerHTML = mfrOptionInner(mfr)
        opt.addEventListener('click', () => {
            filterMfrSelected = mfr
            updateTrigger()
            panel.classList.remove('open')
            panel.querySelectorAll('.mfr-dd-opt').forEach(o => o.classList.remove('selected'))
            opt.classList.add('selected')
            applyFilters()
        })
        panel.appendChild(opt)
    }

    container.appendChild(panel)

    // Toggle panel on trigger click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation()
        const wasOpen = panel.classList.contains('open')
        // Close all other dropdown panels
        document.querySelectorAll('.mfr-dropdown-panel.open').forEach(p => p.classList.remove('open'))
        if (!wasOpen) {
            // Refresh selected class to prevent multi-highlight bug
            panel.querySelectorAll('.mfr-dd-opt').forEach(opt => {
                const val = (opt as HTMLElement).dataset.value ?? ''
                opt.classList.toggle('selected', val === filterMfrSelected)
            })
            panel.classList.add('open')
        }
    })

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
        if (!container.contains(e.target as Node)) {
            panel.classList.remove('open')
        }
    }
    document.addEventListener('click', closeHandler)

    return container
}

function typeOptionsHtml(): string {
    return allTypeOptions.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')
}

function selectProduct(product: Product) {
    selectedProduct = product
    renderSidebarList(filteredProducts)

    if (pdfUrl(product)) {
        loadPDF(product)
    } else {
        showPDFEmpty(`${product.code} — no datasheet available`)
    }
}

function loadPDF(product: Product) {
    pdfEmpty.style.display = 'none'
    pdfEmbed.hidden = false

    const url = pdfUrl(product)
    pdfEmbed.src = url + '#view=FitH&toolbar=0'
    pdfTitle.textContent = `${product.code} — ${product.manufacturer}`

    // Enable toolbar controls
    pdfPrevBtn.disabled = false
    pdfNextBtn.disabled = false
    pdfPageInput.disabled = false
    pdfZoomOutBtn.disabled = false
    pdfZoomInBtn.disabled = false
    pdfDownloadBtn.disabled = false
    pdfOpenBtn.disabled = false

    // Set up download link
    pdfDownloadBtn.onclick = () => {
        const a = document.createElement('a')
        a.href = url
        a.download = url.split('/').pop() || 'datasheet.pdf'
        a.click()
    }

    // Open in new tab
    pdfOpenBtn.onclick = () => {
        window.open(url, '_blank', 'noopener')
    }

    // Fallback if embed fails (server doesn't serve PDFs at symlink target)
    pdfEmbed.dataset.errored = ''
    pdfEmbed.onerror = () => {
        if (pdfEmbed.dataset.errored) return
        pdfEmbed.dataset.errored = '1'
        console.warn('PDF embed failed to load, trying fetch + object URL fallback')
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.blob()
            })
            .then(blob => {
                const url = URL.createObjectURL(blob)
                pdfEmbed.src = url
            })
            .catch(() => {
                pdfEmbed.hidden = true
                pdfEmpty.style.display = 'flex'
                const h2 = pdfEmpty.querySelector('h2')!
                h2.textContent = 'Could not load datasheet'
                const p = pdfEmpty.querySelector('p')!
                p.innerHTML = `Try <a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--accent)">opening the PDF directly</a>.`
            })
    }
}

function showPDFEmpty(msg?: string) {
    pdfEmbed.src = ''
    pdfEmbed.hidden = true
    pdfEmpty.style.display = 'flex'

    const title = pdfEmpty.querySelector('h2')!
    const desc = pdfEmpty.querySelector('p')!
    if (msg) {
        title.textContent = msg
        desc.textContent = 'This product does not have a datasheet PDF yet.'
    } else {
        title.textContent = 'Select a product to view its datasheet'
        desc.textContent = 'Click on any product in the sidebar.'
    }

    pdfTitle.textContent = 'No product selected'
    pdfPrevBtn.disabled = true
    pdfNextBtn.disabled = true
    pdfPageInput.disabled = true
    pdfZoomOutBtn.disabled = true
    pdfZoomInBtn.disabled = true
    pdfDownloadBtn.disabled = true
    pdfOpenBtn.disabled = true
}

/* ── PDF Toolbar Controls ── */

function setupPDFControls() {
    // Zoom controls work by scaling the embed via CSS transform
    let zoom = 1.0

    pdfZoomInBtn.addEventListener('click', () => {
        zoom = Math.min(3, zoom + 0.25)
        updateZoom()
    })

    pdfZoomOutBtn.addEventListener('click', () => {
        zoom = Math.max(0.25, zoom - 0.25)
        updateZoom()
    })

    function updateZoom() {
        pdfZoomLevel.textContent = Math.round(zoom * 100) + '%'
        pdfEmbed.style.transform = `scale(${zoom})`
        pdfEmbed.style.transformOrigin = 'top left'
    }

    // Page controls work with the embed's built-in viewer
    // Note: These only work if the embed exposes the PDF viewer API
    // For most browsers, the native PDF viewer handles its own navigation
    pdfPrevBtn.addEventListener('click', () => {
        try {
            const pdfDoc = (pdfEmbed as any).getPDFDocument?.()
            if (pdfDoc) {
                const currentPage = parseInt(pdfPageInput.value) || 1
                if (currentPage > 1) {
                    pdfPageInput.value = String(currentPage - 1)
                    // Most embed viewers don't expose page control externally
                }
            }
        } catch {}
    })

    pdfNextBtn.addEventListener('click', () => {
        try {
            const currentPage = parseInt(pdfPageInput.value) || 1
            pdfPageInput.value = String(currentPage + 1)
        } catch {}
    })

    pdfPageInput.addEventListener('change', () => {
        // Page navigation in native PDF viewer is limited
        // This is a placeholder for potential PDF.js integration
    })
}

/* ── Theme ── */

function setupTheme() {
    const saved = localStorage.getItem('geotexdb-theme')
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
    }
    updateThemeButton()

    themeBtn.addEventListener('click', toggleTheme)
}

function toggleTheme() {
    const html = document.documentElement
    html.classList.add('transitioning')
    const isDark = html.getAttribute('data-theme') === 'dark'
    const next = isDark ? '' : 'dark'
    html.setAttribute('data-theme', next)
    localStorage.setItem('geotexdb-theme', next)
    updateThemeButton()
    setTimeout(() => html.classList.remove('transitioning'), 850)
}

function updateThemeButton() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    themeBtn.innerHTML = isDark ? '&#9728;' : '&#9790;'
}

/* ── Mode Toggle ── */

function setupMode() {
    const saved = localStorage.getItem('geotexdb-mode') as 'geotexdb' | 'geogriddb' | null
    if (saved) {
        appMode = saved
        document.documentElement.dataset.mode = appMode
    }
    updateModeUI()
    document.querySelectorAll('.mode-title').forEach(el => {
        el.addEventListener('click', () => {
            const mode = (el as HTMLElement).dataset.mode as 'geotexdb' | 'geogriddb'
            if (mode === appMode) return
            appMode = mode
            document.documentElement.dataset.mode = appMode
            localStorage.setItem('geotexdb-mode', appMode)
            updateModeUI()
            filterMfrSelected = ''
            filterTypeSelected = ''
            filterCode = ''
            filterVal = ''
            const searchInp = document.getElementById('searchInput') as HTMLInputElement
            if (searchInp) searchInp.value = ''
            const clear = document.getElementById('searchClearBtn')
            if (clear) clear.classList.remove('visible')
            applyFilters()
        })
    })
}

function updateModeUI() {
    document.querySelectorAll('.mode-title').forEach(el => {
        const mode = (el as HTMLElement).dataset.mode
        el.classList.toggle('active', mode === appMode)
    })
    const titleDoc = document.querySelector('title')!
    const emptyTitle = emptyState.querySelector('h2')!
    const emptyText = emptyState.querySelector('p')!
    if (appMode === 'geogriddb') {
        titleDoc.textContent = 'GeogriDB — Geogrid Cross-Reference'
        emptyTitle.textContent = 'Type to search geogrids'
        emptyText.textContent = 'Search by product code, manufacturer, or browse by type.'
    } else {
        titleDoc.textContent = 'geotexdb — Geotextile Cross-Reference'
        emptyTitle.textContent = 'Type to search geotextiles'
        emptyText.textContent = 'Search by product code, manufacturer, or browse by type.'
    }
}

/* ── Sidebar Resizer ── */

function setupResizer() {
    const resizer = document.getElementById('resizer')
    const sidebarEl = document.getElementById('sidebar')
    if (!resizer || !sidebarEl) return

    let rafId = 0
    let pendingWidth = 0

    function applyWidth() {
        rafId = 0
        const w = Math.max(150, Math.min(900, pendingWidth))
        sidebarEl.style.width = w + 'px'
        sidebarEl.style.flexBasis = w + 'px'
    }

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault()
        document.body.classList.add('dragging')
        // Disable pointer events on PDF iframe during drag to prevent re-triggering layout
        const iframe = document.getElementById('pdfEmbed') as HTMLElement | null
        if (iframe) iframe.style.pointerEvents = 'none'
        const startX = e.clientX
        const startWidth = sidebarEl.offsetWidth

        const onMove = (e: MouseEvent) => {
            pendingWidth = startWidth + (e.clientX - startX)
            if (!rafId) rafId = requestAnimationFrame(applyWidth)
        }

        const onUp = () => {
            document.body.classList.remove('dragging')
            if (iframe) iframe.style.pointerEvents = ''
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            if (rafId) {
                cancelAnimationFrame(rafId)
                rafId = 0
                applyWidth()
            }
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    })
}

/* ── Helpers ── */

function esc(s: string): string {
    const d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
}
