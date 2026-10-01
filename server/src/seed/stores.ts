import { DarkStore } from '../types';
import { CONFIG } from '../config';

export const SKUS = [
  'SKU-MILK-1L',
  'SKU-BREAD-WHITE',
  'SKU-EGGS-6P',
  'SKU-BANANA-1KG',
  'SKU-MAGGI-4P',
  'SKU-CHIPS-50G',
  'SKU-COKE-750ML',
  'SKU-WATER-2L',
  'SKU-CURD-500G',
  'SKU-BUTTER-100G',
  'SKU-ICE-CREAM-500ML',
  'SKU-CHOCOLATE-BAR',
  'SKU-APPLE-1KG',
  'SKU-TOMATO-1KG',
  'SKU-ONION-1KG',
  'SKU-POTATO-1KG',
  'SKU-RICE-5KG',
  'SKU-ATTAPACK-5KG',
  'SKU-OIL-1L',
  'SKU-SUGAR-1KG',
  'SKU-SALT-1KG',
  'SKU-TEA-250G',
  'SKU-COFFEE-100G',
  'SKU-BISCUITS-200G',
  'SKU-SOAP-100G',
  'SKU-SHAMPOO-200ML',
  'SKU-TOOTHPASTE-100G',
  'SKU-TISSUE-ROLL',
  'SKU-DETERGENT-1KG',
  'SKU-DISHWASH-500ML',
  'SKU-SODA-500ML',
  'SKU-ENERGY-DRINK',
  'SKU-OATS-500G',
  'SKU-CEREAL-350G',
  'SKU-PB-350G',
  'SKU-JAM-500G',
  'SKU-CHEESE-SLICES',
  'SKU-PANEER-200G',
  'SKU-FROZEN-PEAS',
  'SKU-NUTS-200G'
];

// 6 anchor stores + 9 fabricated fill-ins, ~2.5 km apart (see CONTEXT.md §2)
const STORE_DEFS = [
  { id: 'store-andheri', name: 'Andheri West Dark Store', loc: { lat: 19.1364, lng: 72.8296 } },
  { id: 'store-bandra', name: 'Bandra West Dark Store', loc: { lat: 19.0596, lng: 72.8295 } },
  { id: 'store-powai', name: 'Powai Dark Store', loc: { lat: 19.1176, lng: 72.9060 } },
  { id: 'store-parel', name: 'Lower Parel Dark Store', loc: { lat: 18.9953, lng: 72.8300 } },
  { id: 'store-chembur', name: 'Chembur Dark Store', loc: { lat: 19.0449, lng: 72.8842 } },
  { id: 'store-ghatkopar', name: 'Ghatkopar Dark Store', loc: { lat: 19.0860, lng: 72.9081 } },
  { id: 'store-dadar', name: 'Dadar Dark Store', loc: { lat: 19.0190, lng: 72.8430 } },
  { id: 'store-mahim', name: 'Mahim Dark Store', loc: { lat: 19.0400, lng: 72.8410 } },
  { id: 'store-santacruz', name: 'Santacruz Dark Store', loc: { lat: 19.0810, lng: 72.8370 } },
  { id: 'store-vileparle', name: 'Vile Parle Dark Store', loc: { lat: 19.1000, lng: 72.8440 } },
  { id: 'store-andheri-e', name: 'Andheri East Dark Store', loc: { lat: 19.1190, lng: 72.8580 } },
  { id: 'store-sion', name: 'Sion Dark Store', loc: { lat: 19.0410, lng: 72.8620 } },
  { id: 'store-bkc', name: 'BKC Dark Store', loc: { lat: 19.0640, lng: 72.8640 } },
  { id: 'store-kurla', name: 'Kurla Dark Store', loc: { lat: 19.0726, lng: 72.8845 } },
  { id: 'store-marol', name: 'Marol Dark Store', loc: { lat: 19.1000, lng: 72.8800 } },
];

export function generateSeedStores(): DarkStore[] {
  return STORE_DEFS.map(def => ({
    id: def.id,
    name: def.name,
    loc: def.loc,
    packingSlots: CONFIG.PACKING_SLOTS,
    packQueue: [],
    packTimeSec: CONFIG.AVG_PACK_TIME_SEC,
  }));
}

/**
 * Shared catalog: storeId -> sku -> quantity on the shelf. Owned by the order stream (not by a world),
 * so every world sees the same orders. Uneven by store; about 1 SKU in 7 starts out of stock at a store
 * (customers simply can't add it to their cart).
 */
export function generateSeedInventory(): Record<string, Record<string, number>> {
  const catalog: Record<string, Record<string, number>> = {};
  STORE_DEFS.forEach((def, idx) => {
    const inv: Record<string, number> = {};
    SKUS.forEach((sku, sIdx) => {
      inv[sku] = (sIdx + idx) % 7 === 0 ? 0 : 50 + ((sIdx * 13 + idx * 17) % 80);
    });
    catalog[def.id] = inv;
  });
  return catalog;
}
