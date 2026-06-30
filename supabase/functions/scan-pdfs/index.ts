import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

interface Product {
    code: string
    manufacturer: string
    description: string
    type: string
    equivalents: { manufacturer: string; code: string }[]
    pdfPath: string
}

interface ProductDB {
    products: Product[]
}

const MFR_DIR_MAP: Record<string, string> = {
    belton: 'Belton',
    carthage: 'Carthage',
    hanes: 'Hanes',
    layfield: 'Layfield',
    nilex: 'Nilex',
    propex: 'Propex',
    skaps: 'SKAPS',
    soleno: 'Soleno',
    solmax: 'Solmax',
    terrafix: 'Terrafix',
    thrace: 'Thrace-LINQ',
    titan: 'Titan Environmental',
    'us-fabrics': 'US Fabrics',
    winfab: 'Winfab',
}

const EXISTING_MFR_ALIASES: Record<string, string[]> = {
    belton: ['Belton'],
    carthage: ['Carthage'],
    hanes: ['Hanes'],
    layfield: ['Layfield'],
    nilex: ['Nilex'],
    propex: ['Propex'],
    skaps: ['SKAPS'],
    soleno: ['Soleno'],
    solmax: ['Solmax', 'Mirafi'],
    terrafix: ['Terrafix'],
    thrace: ['Thrace-LINQ'],
    titan: ['Titan Environmental'],
    'us-fabrics': ['US Fabrics'],
    winfab: ['Winfab'],
}

function cleanPdfName(filename: string): string {
    let name = filename.replace(/\.pdf$/i, '')
    name = name.replace(/[-_ ](?:Datasheet|PDS|Data_Sheet|Product_Data_Sheet|product-data-sheet|Sell_Sheet|Brochure|Spec|Technical_Specs|Catalog)$/i, '')
    name = name.replace(/[-_ ](?:CDN|USA|HR|CA|PA|English)$/i, '')
    name = name.replace(/[-_ ]\d{1,2}_\d{2}_\d{2,4}/, '')
    name = name.replace(/[-_ ]\d{4}$/, '')
    name = name.replace(/^[-_ ]+|[-_ ]+$/g, '')
    return name
}

function normalizeCode(code: string): string {
    return code.replace(/[-_\s]/g, '').toLowerCase()
}

function extractCode(filename: string, dirName: string, mfr: string): string {
    let name = cleanPdfName(filename)

    const prefixes = [
        'WINFAB_', 'WINFAB-', 'GEOTEX_', 'GEOTEX-', 'TerraTex-', 'TerraTex_',
        'Thrace-LINQ_DataSheet-', 'Thrace-LINQ_DataSheet_',
        'MIRAFI_', 'MIRAFI-',
        'Carthage-', 'Carthage_',
        'FX-', 'GBX-', 'SF-',
        'TITAN_', 'TITAN-',
        'TE_', 'TE-',
        'XR_5_', 'XR-5_', 'XR_PW_',
        'COLETANCHE_', 'COLETANCHE-',
        'US-', 'us-',
        'pg',
    ]
    for (const prefix of prefixes) {
        if (name.toUpperCase().startsWith(prefix.toUpperCase())) {
            name = name.slice(prefix.length)
            break
        }
    }

    if (name.includes('_') && !/^\d/.test(name)) {
        const parts = name.split('_', 2)
        if (parts.length > 1 && parts[0].length <= 10) {
            name = parts[1]
        }
    }

    name = name.replace(/[-_]\d$/, '')
    return name
}

function inferType(code: string, mfr: string): string {
    const codeU = code.toUpperCase()
    const codeL = code.toLowerCase()

    if (mfr === 'SKAPS') {
        if (codeU.startsWith('SW')) return 'Woven'
        if (['GC', 'GE', 'GT', 'M'].some(p => codeU.startsWith(p))) return 'Non-woven'
        if (codeU.startsWith('W')) return 'Woven'
        return 'Non-woven'
    }

    if (mfr === 'Nilex') {
        if (/^\d+/.test(code)) return 'Non-woven'
        if (codeL.includes('woven') || codeL.includes('wov')) return 'Woven'
        return 'Non-woven'
    }

    if (mfr === 'Propex') {
        if (codeU.startsWith('GEOTEX')) {
            const num = parseInt(code.replace(/[^0-9]/g, ''))
            if (!isNaN(num)) {
                if (num >= 100 && num < 200) return 'Non-woven'
                if (num >= 200 && num < 300) return 'Woven'
                if (num >= 300) return 'Non-woven'
            }
        }
        if (codeL.includes('woven') || codeL.includes('wov')) return 'Woven'
        return 'Non-woven'
    }

    if (mfr === 'US Fabrics') {
        const codeL = code.toLowerCase()
        if (codeL.includes('nw') || codeL.includes('nwe')) return 'Non-woven'
        if (codeL.includes('gc') || codeL.startsWith('p')) return 'Woven'
        if (codeL.includes('synteen')) return 'Woven'
        if (codeL.includes('ht')) return 'Geogrid'
        return 'Non-woven'
    }

    // Generic
    if (codeL.includes('geogrid') || codeL.includes('bx') || codeL.includes('gbx')) return 'Geogrid'
    if (codeL.includes('geomembrane') || codeL.includes('hdpe') || codeL.includes('lldpe')) return 'Geomembrane'
    if (codeL.includes('nonwoven') || codeL.includes('non-woven') || codeL.includes('nw')) return 'Non-woven'
    if (codeL.includes('woven') || codeL.includes('wov')) return 'Woven'
    if (codeL.includes('trm') || codeL.includes('erosion')) return 'TRM'
    if (codeL.includes('drain')) return 'Drainage'
    if (codeL.includes('silt') || codeL.includes('curtain')) return 'Silt Fence'

    return 'Non-woven'
}

serve(async (_req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
        return new Response('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // List all PDFs in the pdfs bucket recursively
    const { data: files, error: listError } = await supabase.storage
        .from('pdfs')
        .list('', { recursive: true, limit: 1000 })

    if (listError) {
        return new Response(`Failed to list files: ${listError.message}`, { status: 500 })
    }

    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf') && f.id)
    console.log(`Found ${pdfFiles.length} PDF files`)

    // Load existing products.json from storage root
    let existingProducts: Product[] = []
    try {
        const { data: existingData } = await supabase.storage
            .from('pdfs')
            .download('products.json')
        if (existingData) {
            const text = await existingData.text()
            const parsed: ProductDB = JSON.parse(text)
            existingProducts = parsed.products || []
            console.log(`Loaded ${existingProducts.length} existing products`)
        }
    } catch {
        console.log('No existing products.json found, starting fresh')
    }

    // Build lookup by (normalized code, manufacturer)
    const existingMap = new Map<string, Product>()
    for (const p of existingProducts) {
        const key = `${normalizeCode(p.code)}|${p.manufacturer.toLowerCase()}`
        existingMap.set(key, p)
    }

    const seen = new Set<string>()
    const products: Product[] = []
    let matched = 0
    let newFromPdf = 0

    for (const file of pdfFiles) {
        const pathParts = file.name.split('/')
        const dirName = pathParts[0]
        const filename = file.name.split('/').pop() || file.name

        const mfr = MFR_DIR_MAP[dirName]
        if (!mfr) {
            console.log(`Skipping unknown directory: ${dirName}`)
            continue
        }

        const relPath = `pdfs/${file.name}`
        const code = extractCode(filename, dirName, mfr)

        // Try to match existing
        const normCode = normalizeCode(code)
        const aliases = EXISTING_MFR_ALIASES[dirName] || [mfr]

        let match: Product | undefined
        for (const alias of aliases) {
            const key = `${normCode}|${alias.toLowerCase()}`
            const found = existingMap.get(key)
            if (found) {
                match = found
                break
            }
        }

        // Broader match
        if (!match) {
            for (const [key, p] of existingMap) {
                const [ec, em] = key.split('|')
                const aliasMatch = aliases.some(a => em === a.toLowerCase() || em.includes(mfr.toLowerCase()) || mfr.toLowerCase().includes(em))
                if (!aliasMatch) continue
                if (normCode === ec || normCode.includes(ec) || ec.includes(normCode)) {
                    if (Math.abs(normCode.length - ec.length) < 6) {
                        match = p
                        break
                    }
                }
            }
        }

        if (match) {
            const entry = { ...match, pdfPath: relPath }
            const pk = `${normalizeCode(entry.code)}|${entry.manufacturer.toLowerCase()}`
            if (!seen.has(pk)) {
                seen.add(pk)
                products.push(entry)
                matched++
            }
        } else {
            const ptype = inferType(code, mfr)
            const entry: Product = {
                code,
                manufacturer: mfr,
                description: '',
                type: ptype,
                equivalents: [],
                pdfPath: relPath,
            }
            const pk = `${normalizeCode(entry.code)}|${entry.manufacturer.toLowerCase()}`
            if (!seen.has(pk)) {
                seen.add(pk)
                products.push(entry)
                newFromPdf++
            }
        }
    }

    // Sort
    products.sort((a, b) => {
        const ta = a.type || ''
        const tb = b.type || ''
        if (ta !== tb) return ta.localeCompare(tb)
        const ma = a.manufacturer.toLowerCase()
        const mb = b.manufacturer.toLowerCase()
        if (ma !== mb) return ma.localeCompare(mb)
        return a.code.toLowerCase().localeCompare(b.code.toLowerCase())
    })

    const output: ProductDB = { products }

    const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload('products.json', JSON.stringify(output, null, 2), {
            contentType: 'application/json',
            upsert: true,
        })

    if (uploadError) {
        return new Response(`Failed to upload products.json: ${uploadError.message}`, { status: 500 })
    }

    return new Response(
        JSON.stringify({ ok: true, total: products.length, matched, newFromPdf }),
        { headers: { 'Content-Type': 'application/json' } },
    )
})
