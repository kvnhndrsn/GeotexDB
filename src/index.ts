import { loadProducts } from './search'
import { initUI } from './ui'
import type { ProductDB } from './search'

const PRODUCTS_URL = 'https://ebcfmvifwkzfblmwgwbu.supabase.co/storage/v1/object/public/products.json'

async function main() {
    try {
        console.log('geotexdb: fetching products from Supabase')
        const resp = await fetch(PRODUCTS_URL)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data: ProductDB = await resp.json()
        console.log('geotexdb: loaded', data.products.length, 'products')
        loadProducts(data)
        initUI(data.products)
        const el = document.getElementById('statusBar')
        if (el) el.textContent = `${data.products.length} products indexed`
    } catch (err) {
        console.error('geotexdb:', err)
        const el = document.getElementById('statusBar')
        if (el) el.textContent = 'Failed to load product database.'
    }
}

document.addEventListener('DOMContentLoaded', () => main())
