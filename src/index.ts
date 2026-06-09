import { loadProducts } from './search'
import { initUI } from './ui'
import type { ProductDB } from './search'

function main(data: ProductDB) {
    console.log('geotexdb: main() called, products count:', data?.products?.length)
    try {
        console.log('geotexdb: calling loadProducts')
        loadProducts(data)
        console.log('geotexdb: loadProducts OK, calling initUI')
        initUI(data.products)
        console.log('geotexdb: initUI OK')
        const el = document.getElementById('statusBar')
        if (el) {
            el.textContent = `${data.products.length} products indexed`
            console.log('geotexdb: status set to success')
        } else {
            console.log('geotexdb: statusBar element not found')
        }
    } catch (err) {
        console.log('geotexdb: CAUGHT error in main():', err)
        const el = document.getElementById('statusBar')
        if (el) el.textContent = 'Failed to load product database.'
        console.error('geotexdb:', err)
    }
}

declare global {
    interface Window { __PRODUCTS_DATA__?: ProductDB }
}

// Gate: wait for either DOM ready or data ready
function boot() {
    const data = window.__PRODUCTS_DATA__
    if (data) {
        main(data)
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            main(window.__PRODUCTS_DATA__!)
        })
    }
}

boot()
