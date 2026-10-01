// Deterministic Customer and Quick-Commerce Item generator

const FIRST_NAMES = [
  'Ankit', 'Priya', 'Rohit', 'Sneha', 'Arjun', 'Neha', 'Karan', 'Zara',
  'Rahul', 'Pooja', 'Vikram', 'Ananya', 'Aditya', 'Tanvi', 'Rakesh', 'Ishaan',
  'Meera', 'Kunal', 'Riya', 'Dev', 'Shreya', 'Kabir', 'Diya', 'Yash', 'Sanya',
  'Aman', 'Kavya', 'Siddharth', 'Nisha', 'Varun', 'Roshni', 'Harsh', 'Simran'
];

const LAST_NAMES = [
  'Singh', 'Sharma', 'Patel', 'Gupta', 'Kumar', 'Desai', 'Verma', 'Mehta',
  'Joshi', 'Shah', 'Nair', 'Rao', 'Reddy', 'Agarwal', 'Bhatia', 'Malhotra',
  'Mukherjee', 'Chopra', 'Kapoor', 'Iyer', 'Menon', 'Kulkarni', 'Dubey'
];

const QUICK_COMMERCE_ITEMS = [
  { name: 'Maggi 2-Min Masala Noodles (Pack of 4)', price: 56 },
  { name: 'Amul Taaza Homogenised Toned Milk 1L', price: 72 },
  { name: 'Britannia 100% Whole Wheat Bread 400g', price: 45 },
  { name: 'Tropicana 100% Orange Juice 1L', price: 135 },
  { name: 'Lay\'s India\'s Magic Masala Chips 50g', price: 20 },
  { name: 'Epigamia Greek Yogurt Strawberry 90g', price: 50 },
  { name: 'Coca-Cola Zero Sugar 750ml', price: 40 },
  { name: 'Nescafe Classic Instant Coffee 50g', price: 185 },
  { name: 'Tata Salt Vacuum Evaporated 1kg', price: 28 },
  { name: 'Cadbury Dairy Milk Silk 60g', price: 80 },
  { name: 'Fortune Sunlite Refined Sunflower Oil 1L', price: 145 },
  { name: 'Aashirvaad Superior MP Sharbati Atta 5kg', price: 290 },
  { name: 'Dettol Original Liquid Handwash Refill 675ml', price: 99 },
  { name: 'Surf Excel Matic Liquid Detergent 1L', price: 220 },
  { name: 'Mother Dairy Fresh Paneer 200g', price: 90 },
];

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function getCustomerName(orderId: string, seed: number = 42): string {
  const hash = hashStr(`${orderId}-${seed}`);
  const first = FIRST_NAMES[hash % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(hash / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

export function getOrderItems(orderId: string): { sku: string; name: string; qty: number; price: number }[] {
  const hash = hashStr(orderId);
  const itemCount = (hash % 3) + 1; // 1 to 3 items
  const items: { sku: string; name: string; qty: number; price: number }[] = [];

  for (let i = 0; i < itemCount; i++) {
    const itemIdx = (hash + i * 7) % QUICK_COMMERCE_ITEMS.length;
    const item = QUICK_COMMERCE_ITEMS[itemIdx];
    const qty = ((hash + i) % 2) + 1; // 1 or 2 qty
    items.push({
      sku: `SKU-${100 + itemIdx}`,
      name: item.name,
      qty,
      price: item.price * qty,
    });
  }

  return items;
}

export function getRiderName(riderId: string): string {
  const RIDER_NAMES: Record<string, string> = {
    'rider-1': 'Akshay K.',
    'rider-2': 'Sachin T.',
    'rider-3': 'Ramesh P.',
    'rider-4': 'Deepak S.',
    'rider-5': 'Sunil V.',
    'rider-6': 'Vijay M.',
    'rider-7': 'Pravin G.',
    'rider-8': 'Manoj D.',
  };
  return RIDER_NAMES[riderId] || `Rider ${riderId.replace(/[^0-9]/g, '') || riderId}`;
}
