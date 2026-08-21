import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventoryItem, WarehouseLocator, UserProfile } from '../types';
import { formatNumber, formatCbm, formatCbmValue, calculateAgingDays, normalizeBarcode } from './formatters';

export interface WarehouseInfo {
  code: string;
  name: string;
  typeLabel: string;
  color: string;
}

export const KNOWN_WAREHOUSES: WarehouseInfo[] = [
  {
    code: 'GDG-01',
    name: 'Gudang Pusat Cikarang',
    typeLabel: 'Pusat Distribusi Nasional (Central Hub)',
    color: '#6366f1',
  },
  {
    code: 'GDG-02',
    name: 'Gudang Transit Surabaya',
    typeLabel: 'Cabang Hub Logistik Regional Timur',
    color: '#06b6d4',
  },
  {
    code: 'GDG-03',
    name: 'Gudang Hub Medan',
    typeLabel: 'Fasilitas Distribusi Wilayah Sumatera',
    color: '#10b981',
  },
];

/**
 * Resolves the warehouse code for a given item based on locators or location code
 */
export function resolveItemWarehouseCode(item: InventoryItem, locators: WarehouseLocator[]): string {
  // 1. Check if matching locator with occupiedSku or fullCode has warehouseCode
  const loc = locators.find(
    (l) => l.fullCode === item.location?.fullCode || l.occupiedSku === item.sku
  );
  if (loc && loc.warehouseCode) {
    return loc.warehouseCode;
  }

  const fullCode = item.location?.fullCode || '';
  if (fullCode.startsWith('GDG02') || fullCode.startsWith('GDG-02')) return 'GDG-02';
  if (fullCode.startsWith('GDG03') || fullCode.startsWith('GDG-03')) return 'GDG-03';
  if (fullCode.startsWith('GDG01') || fullCode.startsWith('GDG-01')) return 'GDG-01';

  // Default zones A, B, C, D belong to GDG-01
  return 'GDG-01';
}

/**
 * Gets all unique available warehouses with item and stock counts
 */
export function getAvailableWarehouseList(
  items: InventoryItem[],
  locators: WarehouseLocator[]
): Array<WarehouseInfo & { itemCount: number; totalUnits: number; totalCbm: number }> {
  // Collect all known and dynamic warehouse codes
  const foundCodes = new Set<string>();
  KNOWN_WAREHOUSES.forEach((w) => foundCodes.add(w.code));
  locators.forEach((l) => {
    if (l.warehouseCode) foundCodes.add(l.warehouseCode);
  });

  const list = Array.from(foundCodes).map((code) => {
    const known = KNOWN_WAREHOUSES.find((k) => k.code === code);
    const locWithCode = locators.find((l) => l.warehouseCode === code);
    const name = known?.name || locWithCode?.warehouseName || `Gudang ${code}`;
    const typeLabel = known?.typeLabel || 'Fasilitas Pergudangan Logistik';
    const color = known?.color || '#8b5cf6';

    const whItems = items.filter((it) => resolveItemWarehouseCode(it, locators) === code);
    const totalUnits = whItems.reduce((acc, it) => acc + it.stock, 0);
    const totalCbm = whItems.reduce((acc, it) => acc + (it.stock * (it.cbmPerUnit || 0)), 0);

    return {
      code,
      name,
      typeLabel,
      color,
      itemCount: whItems.length,
      totalUnits,
      totalCbm,
    };
  });

  return list;
}

export interface ExportStockOptions {
  selectedWarehouseCodes: string[];
  includeCbm?: boolean;
  includeAging?: boolean;
  includeBatchLot?: boolean;
  includeLocatorsSheet?: boolean;
  customTitle?: string;
  scopeNote?: string;
}

/**
 * Export filtered inventory stock data to Excel (.xlsx)
 */
export function exportStockToExcel(
  items: InventoryItem[],
  locators: WarehouseLocator[],
  options: ExportStockOptions
): { filename: string; totalExported: number } {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().slice(0, 10);
  const selectedWarehouses = getAvailableWarehouseList(items, locators).filter((w) =>
    options.selectedWarehouseCodes.includes(w.code)
  );

  // Filter items matching selected warehouses
  const targetItems = items.filter((item) =>
    options.selectedWarehouseCodes.includes(resolveItemWarehouseCode(item, locators))
  );

  // 1. Sheet: Data Stok SKU
  const formattedItems = targetItems.map((item, index) => {
    const whCode = resolveItemWarehouseCode(item, locators);
    const whInfo = selectedWarehouses.find((w) => w.code === whCode);
    const agingDays = calculateAgingDays(item.lastInboundDate, item.lastUpdated);
    const itemCbm = Number(item.cbmPerUnit || 0);
    const totalCbm = item.stock * itemCbm;

    const row: Record<string, any> = {
      'No': index + 1,
      'Kode Gudang': whCode,
      'Nama Gudang': whInfo?.name || `Gudang ${whCode}`,
      '1. SKU ID': item.sku,
      '2. Barcode': normalizeBarcode(item.barcode),
      '3. Deskripsi SKU': item.name,
      'Brand': item.brand || '-',
      'Kategori': item.category || 'Umum',
      '4. Isi Dus': item.isiDus || 1,
      '5. Satuan (UOM)': item.unit || 'Pcs',
      'Stok Fisik (Qty)': item.stock,
    };

    if (options.includeCbm !== false) {
      row['Kubikasi per Unit (m3)'] = Number(itemCbm.toFixed(3));
      row['Total Kubikasi Stok (m3)'] = Number(totalCbm.toFixed(3));
    }

    row['Kode Lokasi Rak'] = item.location?.fullCode || '-';
    row['Zona'] = item.location?.zoneId || '-';
    row['Safety Stock (Min)'] = item.minStock;
    row['Kapasitas Max'] = item.maxCapacity || 0;
    row['Status Stok'] = item.status === 'IN_STOCK' ? 'In Stock (Aman)' : item.status === 'LOW_STOCK' ? 'Low Stock (Menipis)' : 'Out of Stock (Habis)';
    row['Kelas ABC'] = item.abcClass;

    if (options.includeAging !== false) {
      row['Aging (Hari)'] = agingDays;
      row['Tgl Inbound Terakhir'] = item.lastInboundDate || item.lastUpdated?.substring(0, 10) || '-';
    }

    if (options.includeBatchLot !== false) {
      row['Batch / No Lot'] = item.batchLot || '-';
      row['Expired Date'] = item.expiryDate || '-';
      row['Pemasok / Supplier'] = item.supplier || '-';
    }

    row['Terakhir Diperbarui'] = item.lastUpdated || '-';

    return row;
  });

  const wsItems = XLSX.utils.json_to_sheet(formattedItems);

  // Set column widths
  wsItems['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Kode Gudang
    { wch: 28 }, // Nama Gudang
    { wch: 18 }, // SKU
    { wch: 18 }, // Barcode
    { wch: 38 }, // Deskripsi
    { wch: 18 }, // Brand
    { wch: 22 }, // Kategori
    { wch: 12 }, // Isi Dus
    { wch: 14 }, // UOM
    { wch: 16 }, // Stok Fisik
    { wch: 22 }, // CBM per unit
    { wch: 24 }, // Total CBM
    { wch: 26 }, // Lokasi Rak
    { wch: 10 }, // Zona
    { wch: 18 }, // Safety Stock
    { wch: 16 }, // Max
    { wch: 22 }, // Status
    { wch: 12 }, // ABC
    { wch: 14 }, // Aging
    { wch: 20 }, // Tgl Inbound
    { wch: 18 }, // Batch Lot
    { wch: 16 }, // Exp
    { wch: 28 }, // Supplier
    { wch: 20 }, // Update
  ];

  XLSX.utils.book_append_sheet(wb, wsItems, 'Rekap_Stok_SKU');

  // 2. Sheet: Ringkasan Per Gudang
  const warehouseSummaryData = selectedWarehouses.map((wh) => {
    const whItems = targetItems.filter((it) => resolveItemWarehouseCode(it, locators) === wh.code);
    const totalUnits = whItems.reduce((acc, it) => acc + it.stock, 0);
    const totalCbm = whItems.reduce((acc, it) => acc + (it.stock * (it.cbmPerUnit || 0)), 0);

    return {
      'Kode Gudang': wh.code,
      'Nama Fasilitas Gudang': wh.name,
      'Tipe / Deskripsi Gudang': wh.typeLabel,
      'Jumlah SKU': whItems.length,
      'Total Kuantitas Fisik (Unit)': totalUnits,
      'Total Kubikasi Stok (m3)': Number(totalCbm.toFixed(3)),
    };
  });

  // Total summary row
  warehouseSummaryData.push({
    'Kode Gudang': 'TOTAL',
    'Nama Fasilitas Gudang': `${selectedWarehouses.length} Gudang Terpilih`,
    'Tipe / Deskripsi Gudang': 'Akumulasi Seluruh Gudang',
    'Jumlah SKU': targetItems.length,
    'Total Kuantitas Fisik (Unit)': targetItems.reduce((a, b) => a + b.stock, 0),
    'Total Kubikasi Stok (m3)': Number(
      targetItems.reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0).toFixed(3)
    ),
  });

  const wsSummary = XLSX.utils.json_to_sheet(warehouseSummaryData);
  wsSummary['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 38 },
    { wch: 16 },
    { wch: 26 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan_Per_Gudang');

  // 3. Optional Sheet: Master Locators
  if (options.includeLocatorsSheet) {
    const targetLocators = locators.filter((l) =>
      options.selectedWarehouseCodes.includes(l.warehouseCode || 'GDG-01')
    );
    const formattedLocators = targetLocators.map((l) => ({
      'Kode Gudang': l.warehouseCode,
      'Nama Gudang': l.warehouseName || '-',
      'Kode Rak / Floor': l.rackOrFloorCode,
      'Lorong': l.aisle || '-',
      'Level': l.level || '-',
      'Palet / Slot': l.pallet || '-',
      'Kode Full Lokasi': l.fullCode,
      'Tipe Penyimpanan': l.storageType,
      'Kapasitas Max (Unit)': l.maxCapacityUnits,
      'Tipe Suhu': l.temperatureType,
      'Status': l.status,
      'SKU Terisi': l.occupiedSku || '-',
      'Nama Produk Terisi': l.occupiedProductName || '-',
      'Qty Terisi': l.occupiedStock || 0,
      'Catatan': l.notes || '-',
    }));
    const wsLocators = XLSX.utils.json_to_sheet(formattedLocators);
    wsLocators['!cols'] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 30 },
      { wch: 14 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLocators, 'Master_Locator');
  }

  const whCodeSuffix =
    options.selectedWarehouseCodes.length === 1
      ? options.selectedWarehouseCodes[0]
      : `${options.selectedWarehouseCodes.length}_Gudang`;

  const filename = `Laporan_Stok_SKU_${whCodeSuffix}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);

  return { filename, totalExported: targetItems.length };
}

/**
 * Generate and download professional PDF report for stock data
 */
export function exportStockToPDF(
  items: InventoryItem[],
  locators: WarehouseLocator[],
  options: ExportStockOptions,
  currentUser?: UserProfile | null
): { filename: string; totalExported: number } {
  // Create landscape document for high density data table
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const selectedWarehouses = getAvailableWarehouseList(items, locators).filter((w) =>
    options.selectedWarehouseCodes.includes(w.code)
  );

  const targetItems = items.filter((item) =>
    options.selectedWarehouseCodes.includes(resolveItemWarehouseCode(item, locators))
  );

  const totalUnits = targetItems.reduce((acc, it) => acc + it.stock, 0);
  const totalCbm = targetItems.reduce((acc, it) => acc + (it.stock * (it.cbmPerUnit || 0)), 0);

  // 1. Header & Title Banner (Navy Blue Theme)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PT GUDANG PINTAR LOGISTIK', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Warehouse Management & Inventory Control System', 14, 16);

  // Right Header metadata
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text(`Dicetak: ${dateStr} ${timeStr} WIB`, 283, 10, { align: 'right' });
  doc.text(`Operator: ${currentUser?.name || 'Staff WMS'} (${currentUser?.roleTitle || 'Administrator'})`, 283, 16, { align: 'right' });

  // 2. Document Title & Sub-header
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(options.customTitle || 'LAPORAN REKAPITULASI POSISI STOK BARANG (SKU)', 14, 32);

  // Warehouse selection pill badges text
  const whNamesText = selectedWarehouses.map((w) => `${w.code} (${w.name})`).join('  |  ');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Filter Gudang Target: ${whNamesText}`, 14, 37);

  if (options.scopeNote) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Catatan Cakupan: ${options.scopeNote}`, 14, 41.5);
  }

  // 3. KPI Summary Boxes
  const kpiTop = options.scopeNote ? 44.5 : 40.5;
  const boxWidth = 64;
  const boxHeight = 13;
  const gap = 5;

  // Box 1: Gudang
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(14, kpiTop, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL GUDANG TERPILIH', 18, kpiTop + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`${selectedWarehouses.length} Fasilitas Gudang`, 18, kpiTop + 10);

  // Box 2: Total SKU
  const box2X = 14 + boxWidth + gap;
  doc.roundedRect(box2X, kpiTop, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL SKU REGISTERED', box2X + 4, kpiTop + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`${formatNumber(targetItems.length)} SKU`, box2X + 4, kpiTop + 10);

  // Box 3: Total Unit Fisik
  const box3X = box2X + boxWidth + gap;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(box3X, kpiTop, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('TOTAL STOK FISIK', box3X + 4, kpiTop + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(4, 120, 87);
  doc.text(`${formatNumber(totalUnits)} Unit / Pcs`, box3X + 4, kpiTop + 10);

  // Box 4: Total CBM
  const box4X = box3X + boxWidth + gap;
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.roundedRect(box4X, kpiTop, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229);
  doc.text('TOTAL VOLUME KUBIKASI', box4X + 4, kpiTop + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(67, 56, 202);
  doc.text(formatCbm(totalCbm), box4X + 4, kpiTop + 10);

  // 4. Detailed SKU Table
  const tableData = targetItems.map((item, index) => {
    const whCode = resolveItemWarehouseCode(item, locators);
    const agingDays = calculateAgingDays(item.lastInboundDate, item.lastUpdated);
    const itemCbm = Number(item.cbmPerUnit || 0);
    const totalItemCbm = item.stock * itemCbm;

    return [
      (index + 1).toString(),
      whCode,
      item.sku,
      normalizeBarcode(item.barcode),
      item.name,
      item.category || 'Umum',
      `${formatNumber(item.stock)} ${item.unit || 'Pcs'}`,
      item.location?.fullCode || '-',
      `${formatCbmValue(itemCbm)} m³`,
      `${formatCbmValue(totalItemCbm)} m³`,
      `${agingDays} Hari`,
      item.status === 'IN_STOCK' ? 'Aman' : item.status === 'LOW_STOCK' ? 'Menipis' : 'Habis',
    ];
  });

  autoTable(doc, {
    startY: kpiTop + boxHeight + 4,
    head: [
      [
        'No',
        'Gudang',
        'SKU ID',
        'Barcode',
        'Deskripsi SKU',
        'Kategori',
        'Stok Fisik',
        'Lokasi Rak',
        'CBM / U',
        'Total CBM',
        'Aging',
        'Status',
      ],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 24, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 24 },
      4: { halign: 'left', cellWidth: 56 },
      5: { halign: 'left', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 32 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      10: { halign: 'center', cellWidth: 16 },
      11: { halign: 'center', cellWidth: 18 },
    },
    didDrawPage: (data) => {
      // Footer page number
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${currentPage} dari ${pageCount}  •  Dokumen Otomatis Sistem WMS PT Gudang Pintar Logistik`,
        14,
        202
      );
      doc.text(
        `WMS-REP-STK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        283,
        202,
        { align: 'right' }
      );
    },
  });

  // 5. Signatures Block on last page
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  if (finalY < 165) {
    const sigY = finalY + 8;
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Dibuat & Ditarik Oleh,', 25, sigY);
    doc.text('_________________________', 25, sigY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(currentUser?.name || 'Staff Operasional WMS', 25, sigY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(currentUser?.roleTitle || 'Operator Gudang', 25, sigY + 23.5);

    doc.text('Diperiksa Oleh (QC / Auditor),', 125, sigY);
    doc.text('_________________________', 125, sigY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text('Siti Rahmawati, S.Ak.', 125, sigY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text('Staff QC & Auditor Stock', 125, sigY + 23.5);

    doc.text('Disetujui Kepala Gudang,', 220, sigY);
    doc.text('_________________________', 220, sigY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text('Budi Santoso, S.T.', 220, sigY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text('Kepala Operasional Gudang', 220, sigY + 23.5);
  }

  const whCodeSuffix =
    options.selectedWarehouseCodes.length === 1
      ? options.selectedWarehouseCodes[0]
      : `${options.selectedWarehouseCodes.length}_Gudang`;

  const filename = `Laporan_Stok_SKU_${whCodeSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);

  return { filename, totalExported: targetItems.length };
}
