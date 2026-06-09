import Fuse from 'fuse.js'

export interface Product {
    code: string
    manufacturer: string
    description: string
    type: string
    subtype?: string
    material?: string
    weight_oz?: number
    weight_g_m2?: number
    marb_lb?: number
    grab_tensile_lb?: number
    grab_elong_pct?: number
    trapezoid_tear_lb?: number
    cbr_burst_lb?: number
    permittivity_s?: number
    aos_us_sieve?: number
    tensile_strength_kN?: number
    roll_width_ft?: number
    aperture_size?: string
    equivalents: { manufacturer: string; code: string }[]
    pdfPath?: string
}

export interface ProductDB {
    products: Product[]
}

// @ts-expect-error Fuse.js v7 type quirk
const fuseOptions: Fuse.IFuseOptions<Product> = {
    keys: [
        { name: 'code', weight: 3 },
        { name: 'manufacturer', weight: 2 },
        { name: 'description', weight: 1.5 },
        { name: 'type', weight: 1 },
        { name: 'subtype', weight: 1 },
        { name: 'material', weight: 1 },
    ],
    threshold: 0.3,
    distance: 100,
    minMatchCharLength: 2,
    ignoreLocation: true,
    shouldSort: true,
}

let fuse: Fuse<Product> | null = null
let allProducts: Product[] = []

export function loadProducts(data: ProductDB) {
    allProducts = data.products
    fuse = new Fuse(allProducts, fuseOptions)
}

export function searchProducts(query: string): Product[] {
    const q = query.trim()
    if (!fuse || !q) return allProducts
    const ql = q.toLowerCase()

    // 1. Exact code match
    const exact = allProducts.filter(p => p.code.toLowerCase() === ql)
    if (exact.length === 1) return exact

    // 2. Code prefix + manufacturer prefix
    const prefix = allProducts.filter(p =>
        p.code.toLowerCase().startsWith(ql) ||
        p.manufacturer.toLowerCase().startsWith(ql)
    )

    // 3. Code or manufacturer contains query
    const contains = allProducts.filter(p =>
        p.code.toLowerCase().includes(ql) ||
        p.manufacturer.toLowerCase().includes(ql)
    )

    // 4. Fuzzy match across all fields
    const fuzzy = fuse.search(q).map(r => r.item)

    // Combine: prefix > contains > fuzzy, deduplicated
    const seen = new Set<string>()
    const results: Product[] = []
    for (const list of [prefix, contains, fuzzy]) {
        for (const p of list) {
            const key = p.code + '\0' + p.manufacturer
            if (!seen.has(key)) {
                seen.add(key)
                results.push(p)
            }
        }
    }
    return results
}

export function findProduct(code: string, manufacturer?: string): Product | undefined {
    return allProducts.find(p => {
        const codeMatch = p.code.toLowerCase() === code.toLowerCase()
        if (manufacturer) {
            return codeMatch && p.manufacturer.toLowerCase() === manufacturer.toLowerCase()
        }
        return codeMatch
    })
}

export function findEquivalents(product: Product): Product[] {
    return product.equivalents
        .map(eq => findProduct(eq.code, eq.manufacturer))
        .filter((p): p is Product => p !== undefined)
}
