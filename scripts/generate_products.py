"""Scan geotextile-repo/pdfs/ and generate data/products.json with pdfPath for every product."""
import json, os, re, sys
from pathlib import Path

# Only scan these manufacturer directories (others not committed to repo)
ALLOWED_DIRS = {'nilex', 'titan', 'us-fabrics', 'propex', 'skaps'}

PDFS_ROOT = Path('/home/kevin/geotextile-repo/pdfs')
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / 'data'
EXISTING_JSON = DATA_DIR / 'products.json'
OUTPUT_JSON = DATA_DIR / 'products.json'

MFR_DIR_MAP = {
    'carthage': 'Carthage',
    'hanes': 'Hanes',
    'layfield': 'Layfield',
    'propex': 'Propex',
    'skaps': 'SKAPS',
    'soleno': 'Soleno',
    'solmax': 'Solmax',
    'terrafix': 'Terrafix',
    'thrace-linq': 'Thrace-LINQ',
    'titan': 'Titan Environmental',
    'us-fabrics': 'US Fabrics',
    'winfab': 'Winfab',
}

# Map PDF directories to the original manufacturer names used in existing products
EXISTING_MFR_ALIASES = {
    'layfield': 'Layfield',
    'winfab': 'Winfab',
    'titan': 'Titan Environmental',
    'skaps': 'SKAPS',
    'terrafix': 'Terrafix',
    'propex': 'Propex',
    'solmax': ['Solmax', 'Mirafi'],  # solmax has both Solmax and Mirafi legacy products
    'hanes': 'Hanes',
    'carthage': 'Carthage',
    'soleno': 'Soleno',
    'thrace-linq': 'Thrace-LINQ',
    'us-fabrics': 'US Fabrics',
}

def clean_pdf_name(filename: str) -> str:
    """Extract a clean product code from a PDF filename."""
    name = filename.replace('.pdf', '')
    # Remove common suffixes
    name = re.sub(r'[-_ ](?:Datasheet|PDS|Data_Sheet|Product_Data_Sheet|product-data-sheet|Sell_Sheet|Brochure|Spec|Technical_Specs|Catalog)$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[-_ ](?:CDN|USA|HR|CA|PA|English)$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[-_ ]\d{1,2}_\d{2}_\d{2,4}', '', name)  # remove date patterns
    name = re.sub(r'[-_ ]\d{4}$', '', name)  # trailing 4-digit year
    # Clean trailing underscores/hyphens
    name = name.strip('-_ ')
    return name

def extract_code_from_mirafi(filename: str) -> str | None:
    """Extract code from MIRAFI_XXXX filename pattern."""
    m = re.match(r'MIRAFI_(\w+)', filename, re.IGNORECASE)
    if m:
        return m.group(1)
    return None

def extract_code_from_terrafix(filename: str) -> str | None:
    """Terrafix filenames: Terrafix_1200R -> 1200R"""
    m = re.match(r'Terrafix_(\w+)', filename, re.IGNORECASE)
    if m:
        return m.group(1)
    return None

def extract_code_from_skaps(filename: str) -> str | None:
    """SKAPS filenames may have version with/without dash."""
    return None  # handled generically

def infer_type(filename: str, path: str, mfr: str, code: str) -> str:
    lower = filename.lower()
    code_lower = code.lower()

    # Check for specific type keywords in filename or code
    if any(kw in lower for kw in ['geogrid', 'grid', 'bx', 'gbx', 'gg']):
        return 'Geogrid'
    if any(kw in lower for kw in ['geomembrane', 'lldpe', 'hdpe', 'hppe', 'xr-5', 'xr_5', 'xr-pw']):
        return 'Geomembrane'
    if any(kw in lower for kw in ['turbidity', 'silt fence', 'silt_fence', 'curtain']):
        return 'Silt Fence'
    if any(kw in lower for kw in ['trm', 'erosion', 'coir', 'jute', 'blanket', 'pyramat', 'conforce', 'shoreflex', 'armormax']):
        return 'TRM'
    if any(kw in lower for kw in ['drain', 'drainatex', 'draincotex', 'pipe', 'stormtank', 'multiflow', 'multi_flow']):
        return 'Drainage'
    if any(kw in lower for kw in ['filter sock', 'filter_sock', 'sock']):
        return 'Filter Sock'
    if any(kw in lower for kw in ['dewatering', 'inlet bag']):
        return 'Bag'

    # Manufacturer-specific type inference
    if mfr == 'SKAPS':
        if code.upper().startswith('SW'):
            return 'Woven'
        if code.upper().startswith(('GC', 'GE', 'GT', 'M')):
            return 'Non-woven'
        if code.upper().startswith('W'):
            return 'Woven'
        return 'Non-woven'

    if mfr == 'Winfab':
        # WINFAB naming: N = non-woven, W = woven, HP = high performance, SF = silt fence
        if re.search(r'\d+N', code, re.IGNORECASE):
            return 'Non-woven'
        if re.search(r'\d+W$', code, re.IGNORECASE):
            return 'Woven'
        if re.search(r'\d+W\d', code, re.IGNORECASE):
            return 'Woven'
        if re.search(r'\d+HP', code, re.IGNORECASE):
            return 'Woven'
        if re.search(r'\d+HTM', code, re.IGNORECASE):
            return 'Woven'
        if 'BX' in code.upper():
            return 'Geogrid'
        if 'UX' in code.upper():
            return 'Non-woven'
        if 'SF' in code.upper():
            return 'Silt Fence'
        if 'NE' in code.upper() or 'N-CA' in code.upper():
            return 'Non-woven'
        if 'NP' in code.upper():
            return 'Non-woven'
        if 'DIAMONDBACK' in code.upper():
            return 'Geogrid'
        if any(kw in code_lower for kw in ['coir', 'jute']):
            return 'TRM'
        return 'Non-woven'  # default

    if mfr in ('Mirafi', 'Solmax'):
        if any(kw in code_lower for kw in ['hp']):
            return 'Woven'
        if any(kw in code_lower for kw in ['rs']):
            return 'Geogrid'
        if any(kw in code_lower for kw in ['n']):
            return 'Non-woven'
        if any(kw in code_lower for kw in ['s']):
            return 'Woven'
        if any(kw in code_lower for kw in ['x']):
            return 'Woven'
        return 'Non-woven'

    if mfr == 'Terrafix':
        if re.search(r'\d+R', code):
            return 'Non-woven'
        if re.search(r'\d+W', code):
            return 'Woven'
        if re.search(r'\d+E', code):
            return 'TRM'
        return 'Non-woven'

    if mfr == 'Carthage':
        if code.upper().startswith('GBX'):
            return 'Geogrid'
        if code.upper().startswith('SF'):
            return 'Silt Fence'
        if code.upper().startswith('FX'):
            return 'Non-woven'
        return 'Non-woven'

    if mfr == 'Titan Environmental':
        code_u = code.upper()
        if code_u.startswith(('TE-', 'TE_')):
            return 'Non-woven'
        if 'GRID' in code_u or 'GRID' in code_u:
            return 'Geogrid'
        if 'MIL' in code_u or 'HDPE' in code_u or 'LLDPE' in code_u:
            return 'Geomembrane'
        if any(kw in code_lower for kw in ['pyramat', 'conforce', 'shoreflex', 'armormax', 'mine_shield']):
            return 'TRM'
        if 'PIPE' in code_u or 'DRAIN' in code_u or 'STORM' in code_u or 'MULTI' in code_u:
            return 'Drainage'
        if 'CURTAIN' in code_u or 'TURBIDITY' in code_u:
            return 'Silt Fence'
        if any(kw in code_lower for kw in ['nonwoven', 'non-woven']):
            return 'Non-woven'
        return 'Non-woven'

    if mfr == 'Soleno':
        code_l = code.lower()
        if any(kw in code_l for kw in ['bx', 'grid']):
            return 'Geogrid'
        if any(kw in code_l for kw in ['drain', 'tex']):
            return 'Drainage'
        if 'tx' in code_l:
            return 'Non-woven'
        if any(kw in code_l for kw in ['woven', 'wov']):
            return 'Woven'
        # Soleno has many product types
        return 'Non-woven'

    if mfr == 'US Fabrics':
        code_l = code.lower()
        if any(kw in code_l for kw in ['nw', 'nwe']):
            return 'Non-woven'
        if any(kw in code_l for kw in ['gc', 'p']):
            return 'Woven'
        if any(kw in code_l for kw in ['synteen']):
            return 'Woven'
        if any(kw in code_l for kw in ['ht']):
            return 'Geogrid'
        return 'Non-woven'

    if mfr == 'Hanes':
        code_l = code.lower()
        if any(kw in code_l for kw in ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9']):
            return 'Non-woven'
        if 'hm' in code_l:
            return 'Woven'
        return 'Non-woven'

    if mfr == 'Thrace-LINQ':
        code_l = code.lower()
        if 'ex' in code_l:
            return 'Non-woven'
        if 'gtf' in code_l:
            return 'Woven'
        return 'Non-woven'

    # Wicking
    if any(kw in lower for kw in ['wick', 'h2ri']):
        return 'Wicking'

    # Wicking
    if any(kw in lower for kw in ['wick', 'h2ri']):
        return 'Wicking'

    # Biaxial / Uniaxial / Triax (sub-types of Geogrid)
    if any(kw in lower for kw in ['bx', 'biaxial', 'ux', 'uniaxial', 'triax']):
        if any(kw in lower for kw in ['bx', 'biaxial']):
            return 'Biaxial Geogrid'
        if any(kw in lower for kw in ['ux', 'uniaxial']):
            return 'Uniaxial Geogrid'
        if 'triax' in lower:
            return 'Triax'

    # Environmental / Civil (sub-types of Non-woven)
    if 'environmental' in lower or 'env' in lower:
        return 'Environmental'
    if 'civil' in lower:
        return 'Civil'

    # High Performance
    if any(kw in lower for kw in ['hp-', '_hp', '-hp']):
        return 'High Performance'

    # High Tensile Modulus
    if any(kw in lower for kw in ['htm-', '_htm', '-htm']):
        return 'High Tensile Modulus'

    # Generic fallback from filename
    if any(kw in lower for kw in ['nonwoven', 'non-woven']):
        return 'Non-woven'
    if any(kw in lower for kw in ['woven']):
        return 'Woven'

    return 'Non-woven'

def extract_code(filename: str, dir_name: str, mfr: str) -> str:
    """Extract a clean product code from the PDF filename."""
    name = clean_pdf_name(filename)

    # Mirafi special case: MIRAFI_1100N -> 1100N
    if mfr in ('Solmax', 'Mirafi'):
        m = extract_code_from_mirafi(name)
        if m:
            return m

    # Terrafix special case: Terrafix_1200R -> 1200R
    if mfr == 'Terrafix':
        m = extract_code_from_terrafix(name)
        if m:
            return m

    # Strip known manufacturer prefixes
    for prefix in ['WINFAB_', 'WINFAB-', 'GEOTEX_', 'GEOTEX-', 'TerraTex-', 'TerraTex_',
                   'Thrace-LINQ_DataSheet-', 'Thrace-LINQ_DataSheet_',
                   'MIRAFI_', 'MIRAFI-',
                   'Carthage-', 'Carthage_',
                   'FX-', 'GBX-', 'SF-',
                   'TITAN_', 'TITAN-',
                   'TE_', 'TE-',
                   'XR_5_', 'XR-5_', 'XR_PW_',
                   'COLETANCHE_', 'COLETANCHE-',
                   'US-', 'us-',
                   'pg']:
        if name.upper().startswith(prefix.upper()):
            name = name[len(prefix):]
            break

    # If name now starts with a digit, it's probably clean
    # If it still has long prefix, try removing first segment
    if '_' in name and not name[0].isdigit():
        parts = name.split('_', 1)
        if len(parts) > 1 and len(parts[0]) <= 10:
            name = parts[1]

    # Remove trailing _1, _2, _3 etc (duplicate markers)
    name = re.sub(r'[-_]\d$', '', name)

    return name

def type_sort_key(type_name):
    order = {'Non-woven': 0, 'Woven': 1, 'Geogrid': 2, 'Geomembrane': 3, 'TRM': 4, 'Drainage': 5, 'Silt Fence': 6, 'Filter Sock': 7, 'Bag': 8, 'High Performance': 9, 'High Tensile Modulus': 10, 'Wicking': 11, 'Biaxial Geogrid': 12, 'Uniaxial Geogrid': 13, 'Triax': 14, 'Environmental': 15, 'Civil': 16}
    return order.get(type_name, 99)

def normalize_code(code: str) -> str:
    """Normalize a code for comparison by stripping separators and lowercasing."""
    return re.sub(r'[-_\s]', '', code).lower()

def main():
    # Load existing products
    existing = {}
    if EXISTING_JSON.exists():
        with open(EXISTING_JSON) as f:
            data = json.load(f)
        for p in data['products']:
            key = (normalize_code(p['code']), p['manufacturer'].lower())
            existing[key] = p
        print(f"Loaded {len(existing)} existing products")
    else:
        data = {'products': []}
        print("No existing products.json found, starting fresh")

    seen = set()
    products = []
    # Only scan allowed manufacturer directories
    pdf_files = []
    for d in ALLOWED_DIRS:
        dir_path = PDFS_ROOT / d
        if dir_path.is_dir():
            pdf_files.extend(sorted(dir_path.rglob('*.pdf')))
    # Filter out brochure/catalog PDFs that are not individual product datasheets
    pdf_files = [p for p in pdf_files if not any(
        kw in p.stem.lower() for kw in ['catalog', 'brochure', 'cross-reference', 'transparency_in']
    )]
    print(f"Found {len(pdf_files)} product PDFs in allowed directories: {', '.join(sorted(ALLOWED_DIRS))}")

    matched_count = 0
    unmatched = []
    preserved_existing = set()

    for pdf_path in pdf_files:
        rel = pdf_path.relative_to(PDFS_ROOT)
        pdf_rel = f"pdfs/{rel}"
        dir_name = rel.parts[0]
        filename = pdf_path.stem
        mfr = MFR_DIR_MAP.get(dir_name, dir_name.title())

        code = extract_code(filename, dir_name, mfr)

        # Try to match existing product
        norm_code = normalize_code(code)
        # Try exact manufacturer match first
        aliases = EXISTING_MFR_ALIASES.get(dir_name, mfr)
        if isinstance(aliases, str):
            aliases = [aliases]
        match = None
        for alias in aliases:
            key = (norm_code, alias.lower())
            if key in existing:
                match = existing[key]
                break

        # Try broader match: code contained in existing code or vice versa
        if not match:
            for (ec, em), ep in existing.items():
                # Allow different manufacturer if code matches well
                em_norm = em.lower()
                # Check if manufacturers are related
                mfr_match = any(em_norm == a.lower() for a in aliases) or any(
                    em_norm in mfr.lower() or mfr.lower() in em_norm for a in aliases
                )
                if not mfr_match:
                    continue
                # Check if codes match
                if norm_code == ec or norm_code in ec or ec in norm_code:
                    if abs(len(norm_code) - len(ec)) < 6:
                        match = ep
                        break

        if match:
            entry = dict(match)
            entry['pdfPath'] = pdf_rel
            prod_key = (entry['code'].lower(), entry['manufacturer'].lower())
            if prod_key not in seen:
                seen.add(prod_key)
                products.append(entry)
                preserved_existing.add(prod_key)
                matched_count += 1
                if code.upper() != entry['code'].upper():
                    pass  # slight name variation, keeping original
        else:
            ptype = infer_type(filename, str(pdf_path), mfr, code)
            entry = {
                'code': code,
                'manufacturer': mfr,
                'description': '',
                'type': ptype,
                'pdfPath': pdf_rel,
                'equivalents': [],
            }
            prod_key = (entry['code'].lower(), entry['manufacturer'].lower())
            if prod_key not in seen:
                seen.add(prod_key)
                products.append(entry)
                unmatched.append(code)

    # Sort
    products.sort(key=lambda p: (type_sort_key(p.get('type', '')), p['manufacturer'].lower(), p['code'].lower()))

    output = {'products': products}
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWritten {len(products)} products to {OUTPUT_JSON}")
    print(f"  Matched existing to PDF: {matched_count}")
    print(f"  New from unmatched PDFs: {len(unmatched)}")
    if unmatched:
        print(f"  Sample new codes: {unmatched[:15]}")

if __name__ == '__main__':
    main()
