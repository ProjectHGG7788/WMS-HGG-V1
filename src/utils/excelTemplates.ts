import * as XLSX from 'xlsx';
import { InventoryItem, WarehouseLocator } from '../types';
import { calculateAgingDays, normalizeBarcode } from './formatters';

/**
 * Generate and download sample Excel Template for Opening Balance (Stok Awal)
 */
export function downloadOpbalTemplate() {
  const wb = XLSX.utils.book_new();

  const data = [
    {
      'SKU ID *': 'SKU-FMC-001',
      'Barcode': '8991002100311',
      'Deskripsi SKU *': 'Minyak Goreng Sawit Premium 2 Liter',
      'Isi Dus': 6,
      'Satuan (UOM) *': 'Dus',
      'Brand': 'Golden Sun',
      'Kategori *': 'FMCG & Makanan',
      'Kubikasi (m3)': 0.032,
      'Aging / Tanggal Inbound': '2026-08-18',
      'Stok Awal (Qty) *': 420,
      'Kode Lokasi Rak (WMS)': 'GDG01-RAK01-L01-LV1-P01',
      'Batch / No Lot': 'LOT-2026-08A',
      'Tanggal Kadaluarsa (YYYY-MM-DD)': '2027-08-30',
      'Safety Stock (Min)': 50,
      'Catatan / Referensi': 'Saldo awal opbal implementasi WMS',
    },
    {
      'SKU ID *': 'SKU-ELC-002',
      'Barcode': '0', // Jika tidak ada barcode terdaftar -> otomatis 0
      'Deskripsi SKU *': 'Smart SSD NVMe M.2 1TB PCIe 4.0 Pro',
      'Isi Dus': 20,
      'Satuan (UOM) *': 'Pcs',
      'Brand': 'HyperSpeed',
      'Kategori *': 'Elektronik & Komponen',
      'Kubikasi (m3)': 0.001,
      'Aging / Tanggal Inbound': '2026-07-22',
      'Stok Awal (Qty) *': 28,
      'Kode Lokasi Rak (WMS)': 'GDG01-RAK01-L01-LV4-A02',
      'Batch / No Lot': 'LOT-2026-07B',
      'Tanggal Kadaluarsa (YYYY-MM-DD)': '',
      'Safety Stock (Min)': 20,
      'Catatan / Referensi': 'Contoh SKU tanpa barcode fisik (Barcode = 0)',
    },
    {
      'SKU ID *': 'SKU-AUT-002',
      'Barcode': '0',
      'Deskripsi SKU *': 'Kampas Rem Depan Keramik Premium',
      'Isi Dus': 8,
      'Satuan (UOM) *': 'Set',
      'Brand': 'BrakeForce',
      'Kategori *': 'Suku Cadang Otomotif',
      'Kubikasi (m3)': 0.002,
      'Aging / Tanggal Inbound': '2026-05-10',
      'Stok Awal (Qty) *': 15,
      'Kode Lokasi Rak (WMS)': 'GDG03-RAK01-L02-LV3-A03',
      'Batch / No Lot': 'LOT-BK-2026X',
      'Tanggal Kadaluarsa (YYYY-MM-DD)': '',
      'Safety Stock (Min)': 10,
      'Catatan / Referensi': 'Suku cadang mobil',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // 1. SKU ID
    { wch: 18 }, // 2. Barcode
    { wch: 38 }, // 3. Deskripsi SKU
    { wch: 12 }, // 4. Isi Dus
    { wch: 14 }, // 5. Satuan (UOM)
    { wch: 18 }, // 6. Brand
    { wch: 22 }, // 7. Kategori
    { wch: 16 }, // 8. Kubikasi
    { wch: 24 }, // 9. Aging / Tanggal Inbound
    { wch: 18 }, // Stok Awal
    { wch: 28 }, // Lokasi
    { wch: 16 }, // Batch Lot
    { wch: 28 }, // Expiry
    { wch: 18 }, // Safety Stock
    { wch: 35 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Stok_Awal_Opbal');
  XLSX.writeFile(wb, `Template_Opbal_Stok_Awal_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generate and download sample Excel Template for Master SKU (9 Revised Columns)
 */
export function downloadMasterItemTemplate() {
  const wb = XLSX.utils.book_new();

  const data = [
    {
      '1. SKU ID *': 'SKU-ELC-001',
      '2. Barcode': '8992753100101',
      '3. Deskripsi SKU *': 'Router Wi-Fi 6 Gigabit Dual Band AX3000',
      '4. Isi Dus': 10,
      '5. Satuan (UOM) *': 'Unit',
      '6. Brand': 'NetPro',
      '7. Kategori *': 'Elektronik & Komponen',
      '8. Kubikasi (m3)': 0.004,
      '9. Aging (Day) / Tgl Inbound': '2026-08-16',
      'Safety Stock (Min)': 30,
      'Kapasitas Max': 300,
      'Pemasok / Supplier': 'PT Global Komunikasi Mandiri',
      'Kode Lokasi Default': 'GDG01-RAK02-L01-LV3-B01',
      'Catatan': 'Prioritas handling anti-statik',
    },
    {
      '1. SKU ID *': 'SKU-ELC-002',
      '2. Barcode': '0', // Otomatis angka 0 jika tidak ada barcode
      '3. Deskripsi SKU *': 'Smart SSD NVMe M.2 1TB PCIe 4.0 Pro',
      '4. Isi Dus': 20,
      '5. Satuan (UOM) *': 'Pcs',
      '6. Brand': 'HyperSpeed',
      '7. Kategori *': 'Elektronik & Komponen',
      '8. Kubikasi (m3)': 0.001,
      '9. Aging (Day) / Tgl Inbound': '2026-07-22',
      'Safety Stock (Min)': 50,
      'Kapasitas Max': 400,
      'Pemasok / Supplier': 'PT Silicon Tech Nusantara',
      'Kode Lokasi Default': 'GDG01-RAK01-L01-LV4-A02',
      'Catatan': 'Tanpa barcode fisik terdaftar (Barcode = 0)',
    },
    {
      '1. SKU ID *': 'SKU-AUT-002',
      '2. Barcode': '0',
      '3. Deskripsi SKU *': 'Kampas Rem Depan Keramik Premium',
      '4. Isi Dus': 8,
      '5. Satuan (UOM) *': 'Set',
      '6. Brand': 'BrakeForce',
      '7. Kategori *': 'Suku Cadang Otomotif',
      '8. Kubikasi (m3)': 0.002,
      '9. Aging (Day) / Tgl Inbound': '2026-05-10',
      'Safety Stock (Min)': 20,
      'Kapasitas Max': 150,
      'Pemasok / Supplier': 'PT Auto Parts Presisi',
      'Kode Lokasi Default': 'GDG03-RAK01-L02-LV3-A03',
      'Catatan': 'Satuan Set, Kubikasi 0.002 m3',
    },
    {
      '1. SKU ID *': 'SKU-FMC-001',
      '2. Barcode': '8991002100311',
      '3. Deskripsi SKU *': 'Minyak Goreng Sawit Premium 2 Liter',
      '4. Isi Dus': 6,
      '5. Satuan (UOM) *': 'Dus',
      '6. Brand': 'Golden Sun',
      '7. Kategori *': 'FMCG & Makanan',
      '8. Kubikasi (m3)': 0.032,
      '9. Aging (Day) / Tgl Inbound': '2026-08-18',
      'Safety Stock (Min)': 100,
      'Kapasitas Max': 600,
      'Pemasok / Supplier': 'PT Agro Industri Sejahtera',
      'Kode Lokasi Default': 'GDG01-RAK01-L01-LV1-A01',
      'Catatan': 'Fast moving, sistem FIFO',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 18 }, // 1. SKU ID
    { wch: 18 }, // 2. Barcode
    { wch: 38 }, // 3. Deskripsi SKU
    { wch: 12 }, // 4. Isi Dus
    { wch: 16 }, // 5. Satuan (UOM)
    { wch: 18 }, // 6. Brand
    { wch: 22 }, // 7. Kategori
    { wch: 16 }, // 8. Kubikasi
    { wch: 26 }, // 9. Aging / Tanggal Inbound
    { wch: 18 }, // Safety Stock
    { wch: 16 }, // Kapasitas Max
    { wch: 28 }, // Supplier
    { wch: 26 }, // Lokasi
    { wch: 32 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Master_SKU');
  XLSX.writeFile(wb, `Template_Master_SKU_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generate and download sample Excel Template for Master Lokasi / Locator
 */
export function downloadMasterLocatorTemplate() {
  const wb = XLSX.utils.book_new();

  const data = [
    {
      'Kode Gudang *': 'GDG01',
      'Nama Gudang': 'Gudang Utama Distribusi',
      'Kode Rak / Floor *': 'RAK01',
      'Lorong (Aisle)': '01',
      'Level (Tier)': '1',
      'Palet / Slot': 'P01',
      'Kode Full (Opsional)': 'GDG01-RAK01-L01-LV1-P01',
      'Tipe Penyimpanan (RACK/FLOOR/PALLET_BULK/STAGING)': 'RACK',
      'Kapasitas Max (Unit)': 500,
      'Tipe Suhu (AMBIENT/AIR_CONDITIONED/COLD_STORAGE/HAZARDOUS)': 'AMBIENT',
      'Catatan': 'Rak bawah untuk barang berat',
    },
    {
      'Kode Gudang *': 'GDG01',
      'Nama Gudang': 'Gudang Utama Distribusi',
      'Kode Rak / Floor *': 'RAK01',
      'Lorong (Aisle)': '01',
      'Level (Tier)': '2',
      'Palet / Slot': 'P01',
      'Kode Full (Opsional)': 'GDG01-RAK01-L01-LV2-P01',
      'Tipe Penyimpanan (RACK/FLOOR/PALLET_BULK/STAGING)': 'RACK',
      'Kapasitas Max (Unit)': 400,
      'Tipe Suhu (AMBIENT/AIR_CONDITIONED/COLD_STORAGE/HAZARDOUS)': 'AMBIENT',
      'Catatan': 'Tier kedua lorong 01',
    },
    {
      'Kode Gudang *': 'GDG02',
      'Nama Gudang': 'Gudang Komponen & Elektronik',
      'Kode Rak / Floor *': 'FLR-STG',
      'Lorong (Aisle)': '01',
      'Level (Tier)': '1',
      'Palet / Slot': 'STG01',
      'Kode Full (Opsional)': 'GDG02-FLR-STG-L01-LV1-STG01',
      'Tipe Penyimpanan (RACK/FLOOR/PALLET_BULK/STAGING)': 'STAGING',
      'Kapasitas Max (Unit)': 1000,
      'Tipe Suhu (AMBIENT/AIR_CONDITIONED/COLD_STORAGE/HAZARDOUS)': 'AIR_CONDITIONED',
      'Catatan': 'Area staging penerimaan kontainer',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 16 }, // Kode Gudang
    { wch: 28 }, // Nama Gudang
    { wch: 18 }, // Kode Rak
    { wch: 16 }, // Lorong
    { wch: 14 }, // Level
    { wch: 14 }, // Palet
    { wch: 28 }, // Kode Full
    { wch: 26 }, // Tipe Penyimpanan
    { wch: 20 }, // Kapasitas
    { wch: 28 }, // Suhu
    { wch: 32 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Master_Lokasi');
  XLSX.writeFile(wb, `Template_Master_Lokasi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generate and download Complete Multi-Sheet Workbook Template (All in One)
 */
export function downloadAllInOneTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Master SKU (9 Revised Columns)
  const itemData = [
    {
      '1. SKU ID *': 'SKU-ELC-001',
      '2. Barcode': '8992753100101',
      '3. Deskripsi SKU *': 'Router Wi-Fi 6 Gigabit Dual Band AX3000',
      '4. Isi Dus': 10,
      '5. Satuan (UOM) *': 'Unit',
      '6. Brand': 'NetPro',
      '7. Kategori *': 'Elektronik & Komponen',
      '8. Kubikasi (m3)': 0.004,
      '9. Aging (Day) / Tgl Inbound': '2026-08-16',
      'Safety Stock': 30,
      'Pemasok / Supplier': 'PT Global Komunikasi Mandiri',
    },
    {
      '1. SKU ID *': 'SKU-ELC-002',
      '2. Barcode': '0',
      '3. Deskripsi SKU *': 'Smart SSD NVMe M.2 1TB PCIe 4.0 Pro',
      '4. Isi Dus': 20,
      '5. Satuan (UOM) *': 'Pcs',
      '6. Brand': 'HyperSpeed',
      '7. Kategori *': 'Elektronik & Komponen',
      '8. Kubikasi (m3)': 0.001,
      '9. Aging (Day) / Tgl Inbound': '2026-07-22',
      'Safety Stock': 50,
      'Pemasok / Supplier': 'PT Silicon Tech Nusantara',
    },
    {
      '1. SKU ID *': 'SKU-AUT-002',
      '2. Barcode': '0',
      '3. Deskripsi SKU *': 'Kampas Rem Depan Keramik Premium',
      '4. Isi Dus': 8,
      '5. Satuan (UOM) *': 'Set',
      '6. Brand': 'BrakeForce',
      '7. Kategori *': 'Suku Cadang Otomotif',
      '8. Kubikasi (m3)': 0.002,
      '9. Aging (Day) / Tgl Inbound': '2026-05-10',
      'Safety Stock': 20,
      'Pemasok / Supplier': 'PT Auto Parts Presisi',
    },
  ];
  const ws1 = XLSX.utils.json_to_sheet(itemData);
  ws1['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 38 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws1, '1_Master_SKU');

  // Sheet 2: Opbal
  const opbalData = [
    {
      '1. SKU ID *': 'SKU-ELC-001',
      '2. Barcode': '8992753100101',
      '3. Deskripsi SKU *': 'Router Wi-Fi 6 Gigabit Dual Band AX3000',
      '4. Isi Dus': 10,
      '5. Satuan (UOM) *': 'Unit',
      '6. Brand': 'NetPro',
      '7. Kategori *': 'Elektronik & Komponen',
      '8. Kubikasi (m3)': 0.004,
      '9. Aging (Day) / Tgl Inbound': '2026-08-16',
      'Stok Awal (Qty) *': 145,
      'Kode Lokasi Rak (WMS)': 'GDG01-RAK02-L01-LV3-B01',
      'Batch / No Lot': 'LOT-2026-08A',
      'Tanggal Kadaluarsa': '',
      'Safety Stock': 30,
      'Catatan': 'Saldo awal opbal',
    },
    {
      '1. SKU ID *': 'SKU-ELC-002',
      '2. Barcode': '0',
      '3. Deskripsi SKU *': 'Smart SSD NVMe M.2 1TB PCIe 4.0 Pro',
      '4. Isi Dus': 20,
      '5. Satuan (UOM) *': 'Pcs',
      '6. Brand': 'HyperSpeed',
      '7. Kategori *': 'Elektronik & Komponen',
      '8. Kubikasi (m3)': 0.001,
      '9. Aging (Day) / Tgl Inbound': '2026-07-22',
      'Stok Awal (Qty) *': 28,
      'Kode Lokasi Rak (WMS)': 'GDG01-RAK01-L01-LV4-A02',
      'Batch / No Lot': 'LOT-2026-07B',
      'Tanggal Kadaluarsa': '',
      'Safety Stock': 50,
      'Catatan': 'Saldo awal SSD',
    },
  ];
  const ws2 = XLSX.utils.json_to_sheet(opbalData);
  ws2['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 38 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, '2_Stok_Awal_Opbal');

  // Sheet 3: Locator
  const locatorData = [
    {
      'Kode Gudang *': 'GDG01',
      'Nama Gudang': 'Gudang Utama Distribusi',
      'Kode Rak / Floor *': 'RAK01',
      'Lorong (Aisle)': '01',
      'Level (Tier)': '1',
      'Palet / Slot': 'P01',
      'Kode Full': 'GDG01-RAK01-L01-LV1-P01',
      'Tipe Penyimpanan': 'RACK',
      'Kapasitas Max (Unit)': 500,
      'Tipe Suhu': 'AMBIENT',
      'Catatan': 'Tier 1 untuk barang fast-moving',
    },
  ];
  const ws3 = XLSX.utils.json_to_sheet(locatorData);
  ws3['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, '3_Master_Lokasi');

  XLSX.writeFile(wb, `Template_Master_SKU_Opbal_MultiSheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export current active database to Excel with the revised 9 SKU attributes
 */
export function exportCurrentDatabaseToExcel(
  items: InventoryItem[],
  locators: WarehouseLocator[]
) {
  const wb = XLSX.utils.book_new();

  // Export Master SKU & Stok
  const formattedItems = items.map((item) => {
    const aging = calculateAgingDays(item.lastInboundDate, item.lastUpdated);
    return {
      '1. SKU ID': item.sku,
      '2. Barcode': normalizeBarcode(item.barcode),
      '3. Deskripsi SKU': item.name,
      '4. Isi Dus': item.isiDus || 1,
      '5. Satuan (UOM)': item.unit,
      '6. Brand': item.brand,
      '7. Kategori': item.category,
      '8. Kubikasi (m3)': Number(item.cbmPerUnit || 0).toFixed(3),
      '9. Aging (Day)': `${aging} Hari`,
      'Tanggal Inbound Terakhir': item.lastInboundDate || item.lastUpdated || '-',
      'Stok Fisik': item.stock,
      'Total Kubikasi Stok (m3)': Number((item.stock * (item.cbmPerUnit || 0))).toFixed(3),
      'Safety Stock (Min)': item.minStock,
      'Kapasitas Max': item.maxCapacity,
      'Kode Lokasi Rak': item.location?.fullCode || '-',
      'Status Stok': item.status,
      'Kelas ABC': item.abcClass,
      'Batch / Lot': item.batchLot,
      'Expired Date': item.expiryDate || '-',
      'Supplier': item.supplier,
      'Terakhir Update': item.lastUpdated,
    };
  });

  const wsItems = XLSX.utils.json_to_sheet(formattedItems);
  wsItems['!cols'] = [
    { wch: 18 }, // SKU
    { wch: 18 }, // Barcode
    { wch: 38 }, // Deskripsi
    { wch: 12 }, // Isi Dus
    { wch: 14 }, // UOM
    { wch: 18 }, // Brand
    { wch: 22 }, // Kategori
    { wch: 16 }, // Kubikasi
    { wch: 14 }, // Aging
    { wch: 24 }, // Tgl Inbound
    { wch: 14 }, // Stok
    { wch: 22 }, // Total CBM
    { wch: 18 }, // Min
    { wch: 16 }, // Max
    { wch: 28 }, // Lokasi
    { wch: 16 }, // Status
    { wch: 12 }, // ABC
    { wch: 16 }, // Lot
    { wch: 16 }, // Exp
    { wch: 28 }, // Supplier
    { wch: 20 }, // Update
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Data_Stok_Master_SKU');

  // Export Locator List
  const formattedLocators = locators.map((l) => ({
    'Kode Gudang': l.warehouseCode,
    'Nama Gudang': l.warehouseName,
    'Kode Rak / Floor': l.rackOrFloorCode,
    'Lorong': l.aisle || '-',
    'Level': l.level || '-',
    'Palet / Slot': l.pallet || '-',
    'Kode Full': l.fullCode,
    'Tipe Penyimpanan': l.storageType,
    'Kapasitas Max': l.maxCapacityUnits,
    'Tipe Suhu': l.temperatureType,
    'Status': l.status,
    'SKU Terisi': l.occupiedSku || '-',
    'Nama Produk Terisi': l.occupiedProductName || '-',
    'Qty Terisi': l.occupiedStock || 0,
    'Catatan': l.notes || '-',
  }));
  const wsLocators = XLSX.utils.json_to_sheet(formattedLocators);
  XLSX.utils.book_append_sheet(wb, wsLocators, 'Master_Locator_Gudang');

  XLSX.writeFile(wb, `Export_WMS_MasterSKU_Database_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
