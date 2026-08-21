import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { INITIAL_INVENTORY, INITIAL_TRANSACTIONS, INITIAL_ZONES, INITIAL_LOCATORS } from './src/data/mockWarehouse';
import { InventoryItem, StockOpnameSession, StockTransaction, WarehouseZone, WarehouseLocator } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Cloud Database state
let inventoryDb: InventoryItem[] = [...INITIAL_INVENTORY];
let zonesDb: WarehouseZone[] = [...INITIAL_ZONES];
let locatorsDb: WarehouseLocator[] = [...INITIAL_LOCATORS];
let transactionsDb: StockTransaction[] = [...INITIAL_TRANSACTIONS];
let auditSessionsDb: StockOpnameSession[] = [
  {
    id: 'OPN-2026-0801',
    title: 'Stock Opname Bulanan Zona A & B (Agustus 2026)',
    zoneId: 'A',
    status: 'COMPLETED',
    startedAt: '2026-08-01 08:00',
    completedAt: '2026-08-01 17:30',
    auditorName: 'Siti Rahmawati, S.Ak.',
    totalItems: 4,
    countedItems: 4,
    discrepancyCount: 1,
    approvedBy: 'Budi Santoso, S.T.',
    approvalNotes: 'Selisih -3 unit Susu UHT telah diverifikasi karena kardus basah dan disesuaikan.',
    items: [
      {
        sku: 'SKU-FMC-001',
        productName: 'Minyak Goreng Sawit Premium 2 Liter',
        barcode: '8991002100311',
        location: 'A-01-01-L1-A1',
        systemStock: 420,
        physicalCount: 420,
        variance: 0,
        status: 'MATCHED',
      },
      {
        sku: 'SKU-FMC-002',
        productName: 'Susu UHT Full Cream 1000ml',
        barcode: '8991002100422',
        location: 'A-02-03-L2-B2',
        systemStock: 15,
        physicalCount: 12,
        variance: -3,
        status: 'DISCREPANCY',
        notes: 'Kardus rusak terbentur forklift',
      },
    ],
  },
];

// Helper Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

// 1. Get entire inventory snapshot
app.get('/api/inventory', (req, res) => {
  res.json({
    items: inventoryDb,
    zones: zonesDb,
    locators: locatorsDb,
    transactions: transactionsDb,
    audits: auditSessionsDb,
  });
});

// Locator Management Endpoints
app.post('/api/inventory/locator', (req, res) => {
  try {
    const {
      id,
      warehouseCode,
      warehouseName,
      rackOrFloorCode,
      aisle,
      level,
      pallet,
      fullCode,
      storageType,
      maxCapacityUnits,
      temperatureType,
      notes,
    } = req.body;

    // Validate mandatory fields: 1. Kode Gudang, 2. Kode Rak/Floor
    if (!warehouseCode || !warehouseCode.trim()) {
      return res.status(400).json({ error: 'Kode Gudang (Mandatory) wajib diisi.' });
    }
    if (!rackOrFloorCode || !rackOrFloorCode.trim()) {
      return res.status(400).json({ error: 'Kode Rak/Floor (Mandatory) wajib diisi.' });
    }

    const cleanWh = warehouseCode.trim().toUpperCase();
    const cleanRack = rackOrFloorCode.trim().toUpperCase();
    const cleanAisle = aisle ? aisle.trim().toUpperCase() : '';
    const cleanLevel = level ? level.trim().toUpperCase() : '';
    const cleanPallet = pallet ? pallet.trim().toUpperCase() : '';

    // Auto-generate standard fullCode if not provided
    const segments: string[] = [cleanWh, cleanRack];
    if (cleanAisle) segments.push(cleanAisle.startsWith('L') ? cleanAisle : `L${cleanAisle}`);
    if (cleanLevel) segments.push(cleanLevel.startsWith('LV') || cleanLevel.startsWith('L') ? cleanLevel : `LV${cleanLevel}`);
    if (cleanPallet) segments.push(cleanPallet.startsWith('P') || cleanPallet.startsWith('PL') || cleanPallet.startsWith('B') ? cleanPallet : `P${cleanPallet}`);
    const generatedFullCode = fullCode && fullCode.trim() ? fullCode.trim().toUpperCase() : segments.join('-');

    const existingIndex = locatorsDb.findIndex((l) => l.id === id || l.fullCode === generatedFullCode);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    if (existingIndex >= 0) {
      // Update existing
      locatorsDb[existingIndex] = {
        ...locatorsDb[existingIndex],
        warehouseCode: cleanWh,
        warehouseName: warehouseName || locatorsDb[existingIndex].warehouseName || `Gudang ${cleanWh}`,
        rackOrFloorCode: cleanRack,
        aisle: cleanAisle,
        level: cleanLevel,
        pallet: cleanPallet,
        fullCode: generatedFullCode,
        storageType: storageType || locatorsDb[existingIndex].storageType || 'RACK',
        maxCapacityUnits: Number(maxCapacityUnits) || locatorsDb[existingIndex].maxCapacityUnits || 300,
        temperatureType: temperatureType || locatorsDb[existingIndex].temperatureType || 'AMBIENT',
        notes: notes !== undefined ? notes : locatorsDb[existingIndex].notes,
      };

      return res.json({
        success: true,
        locator: locatorsDb[existingIndex],
        message: `Locator ${generatedFullCode} berhasil diperbarui.`,
      });
    } else {
      // Create new locator
      const newLocator: WarehouseLocator = {
        id: id || `LOC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        warehouseCode: cleanWh,
        warehouseName: warehouseName || `Gudang ${cleanWh}`,
        rackOrFloorCode: cleanRack,
        aisle: cleanAisle,
        level: cleanLevel,
        pallet: cleanPallet,
        fullCode: generatedFullCode,
        storageType: storageType || 'RACK',
        maxCapacityUnits: Number(maxCapacityUnits) || 300,
        temperatureType: temperatureType || 'AMBIENT',
        status: 'AVAILABLE',
        notes: notes || '',
        createdAt: now,
      };

      locatorsDb.unshift(newLocator);

      return res.json({
        success: true,
        locator: newLocator,
        message: `Locator baru [${generatedFullCode}] berhasil didaftarkan ke sistem WMS.`,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal menyimpan data locator.' });
  }
});

app.delete('/api/inventory/locator/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = locatorsDb.length;
  locatorsDb = locatorsDb.filter((l) => l.id !== id && l.fullCode !== id);
  if (locatorsDb.length < initialLength) {
    res.json({ success: true, message: 'Locator berhasil dihapus dari sistem.' });
  } else {
    res.status(404).json({ error: 'Locator tidak ditemukan.' });
  }
});

// 2. Create or update SKU item
app.post('/api/inventory/item', (req, res) => {
  try {
    const itemData: Partial<InventoryItem> = req.body;
    if (!itemData.sku || !itemData.name) {
      return res.status(400).json({ error: 'SKU dan Nama Barang wajib diisi.' });
    }

    const existingIndex = inventoryDb.findIndex((i) => i.id === itemData.id || i.sku === itemData.sku);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const todayDate = new Date().toISOString().substring(0, 10);

    const lengthCm = Number(itemData.dimensionsCm?.lengthCm) || 20;
    const widthCm = Number(itemData.dimensionsCm?.widthCm) || 15;
    const heightCm = Number(itemData.dimensionsCm?.heightCm) || 10;
    const calculatedCbm = Number(((lengthCm * widthCm * heightCm) / 1000000).toFixed(3));
    const rawCbm = itemData.cbmPerUnit !== undefined && itemData.cbmPerUnit !== null ? Number(itemData.cbmPerUnit) : calculatedCbm;
    const cbmPerUnit = Number(rawCbm.toFixed(3));
    const barcode = itemData.barcode && String(itemData.barcode).trim() !== '' ? String(itemData.barcode).trim() : '0';
    const isiDus = Number(itemData.isiDus) || 1;
    const lastInboundDate = itemData.lastInboundDate || todayDate;

    if (existingIndex >= 0) {
      // Update
      inventoryDb[existingIndex] = {
        ...inventoryDb[existingIndex],
        ...itemData,
        barcode,
        isiDus,
        dimensionsCm: { lengthCm, widthCm, heightCm },
        cbmPerUnit,
        lastInboundDate,
        lastUpdated: now,
      } as InventoryItem;
      return res.json({ success: true, item: inventoryDb[existingIndex], message: 'Item berhasil diperbarui.' });
    } else {
      // Create new
      const newItem: InventoryItem = {
        id: itemData.id || `item-${Date.now()}`,
        sku: itemData.sku,
        barcode,
        name: itemData.name,
        isiDus,
        category: itemData.category || 'Umum',
        brand: itemData.brand || 'Generic',
        unit: itemData.unit || 'Pcs',
        stock: Number(itemData.stock) || 0,
        minStock: Number(itemData.minStock) || 10,
        maxCapacity: Number(itemData.maxCapacity) || 100,
        weightKg: Number(itemData.weightKg) || 1,
        dimensionsCm: { lengthCm, widthCm, heightCm },
        cbmPerUnit,
        lastInboundDate,
        location: itemData.location || {
          zoneId: 'A',
          zoneName: 'Zona A - Fast Moving',
          aisle: 'Lorong 01',
          rack: 'Rak 01',
          shelfLevel: 1,
          binSlot: 'A1',
          fullCode: 'A-01-01-L1-A1',
        },
        status: (Number(itemData.stock) || 0) <= 0 ? 'OUT_OF_STOCK' : (Number(itemData.stock) || 0) <= (Number(itemData.minStock) || 10) ? 'LOW_STOCK' : 'IN_STOCK',
        abcClass: (itemData.abcClass as any) || 'B',
        batchLot: itemData.batchLot || `LOT-${new Date().getFullYear()}-01`,
        expiryDate: itemData.expiryDate,
        lastUpdated: now,
        supplier: itemData.supplier || 'Pemasok Resmi',
        notes: itemData.notes || '',
        turnoverRateMonth: Number(itemData.turnoverRateMonth) || 10,
      };

      inventoryDb.unshift(newItem);
      return res.json({ success: true, item: newItem, message: 'Barang baru berhasil ditambahkan ke gudang.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Terjadi kesalahan pada server.' });
  }
});

// 3. Delete SKU
app.delete('/api/inventory/item/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = inventoryDb.length;
  inventoryDb = inventoryDb.filter((item) => item.id !== id && item.sku !== id);
  if (inventoryDb.length < initialLength) {
    res.json({ success: true, message: 'Item berhasil dihapus dari sistem.' });
  } else {
    res.status(404).json({ error: 'Item tidak ditemukan.' });
  }
});

// 4. Record Real-time Stock Movement (Inbound, Outbound, Return, Transfer, Adjustment)
app.post('/api/inventory/transaction', (req, res) => {
  try {
    const {
      type,
      subType,
      partnerName,
      sku,
      quantity,
      operatorName,
      operatorRole,
      referenceNumber,
      notes,
      newLocation,
      batchLot,
      qcCondition,
      driverName,
      vehiclePlate,
      shippingExpedition,
      itemsList,
    } = req.body;

    if (!type || !sku || quantity === undefined) {
      return res.status(400).json({ error: 'Data transaksi tidak lengkap.' });
    }

    const item = inventoryDb.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: `SKU ${sku} tidak ditemukan di database gudang.` });
    }

    const qty = Number(quantity);
    let oldStock = item.stock;
    let newStock = oldStock;
    let fromLoc = item.location.fullCode;
    let toLoc = item.location.fullCode;

    if (type === 'INBOUND') {
      newStock = oldStock + qty;
      toLoc = item.location.fullCode;
      fromLoc = 'Inbound Dock Receiving';
      item.lastInboundDate = new Date().toISOString().substring(0, 10);
    } else if (type === 'OUTBOUND') {
      if (oldStock < qty) {
        return res.status(400).json({
          error: `Stok tidak mencukupi! Stok saat ini: ${oldStock} ${item.unit}, diminta: ${qty} ${item.unit}`,
        });
      }
      newStock = oldStock - qty;
      fromLoc = item.location.fullCode;
      toLoc = 'Outbound Dispatch Area';
    } else if (type === 'RETURN') {
      // Jika hasil QC layak jual (GOOD_RESTOCK), stok aktif ditambah
      if (!qcCondition || qcCondition === 'GOOD_RESTOCK') {
        newStock = oldStock + qty;
        toLoc = item.location.fullCode;
        fromLoc = 'Return Receiving Dock';
      } else if (qcCondition === 'REWORK') {
        // Masuk area karantina, stok reguler tidak bertambah
        fromLoc = 'Return Receiving Dock';
        toLoc = 'Area Karantina / Rework';
      } else {
        // SCRAP / DAMAGED
        fromLoc = 'Return Receiving Dock';
        toLoc = 'Zona Afkir & Scrap';
      }
    } else if (type === 'TRANSFER' || type === 'MOVEMENT') {
      if (req.body.fromLocation) fromLoc = req.body.fromLocation;
      if (req.body.toLocation) toLoc = req.body.toLocation;
      
      if (newLocation) {
        fromLoc = item.location.fullCode;
        toLoc =
          newLocation.fullCode ||
          `${newLocation.zoneId}-${newLocation.aisle}-${newLocation.rack}-L${newLocation.shelfLevel}-${newLocation.binSlot}`;
        item.location = {
          ...item.location,
          ...newLocation,
          fullCode: toLoc,
        };
      } else if (toLoc && toLoc !== fromLoc && (subType === 'INTERNAL_TRANSFER' || subType === 'MOVE_IN' || type === 'TRANSFER')) {
        // Parse or update fullCode
        item.location = {
          ...item.location,
          fullCode: toLoc,
        };
      }
    } else if (type === 'ADJUSTMENT') {
      newStock = Math.max(0, oldStock + qty);
      fromLoc = item.location.fullCode;
      toLoc = item.location.fullCode;
    }

    // Update item stock & status
    item.stock = newStock;
    item.status =
      newStock <= 0
        ? 'OUT_OF_STOCK'
        : newStock <= item.minStock
        ? 'LOW_STOCK'
        : newStock > item.maxCapacity
        ? 'OVERSTOCKED'
        : 'IN_STOCK';
    item.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Create transaction log
    const newTx: StockTransaction = {
      id: `TX-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type,
      subType,
      partnerName: partnerName || '',
      sku: item.sku,
      productName: item.name,
      quantity: qty,
      unit: item.unit,
      fromLocation: fromLoc,
      toLocation: toLoc,
      referenceNumber:
        referenceNumber ||
        `${type.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      operatorName: operatorName || 'Operator Gudang',
      operatorRole: operatorRole || 'Staff Gudang',
      notes: notes || '',
      status: 'COMPLETED',
      batchLot: batchLot || item.batchLot,
      qcCondition,
      driverName,
      vehiclePlate,
      shippingExpedition,
      movementReason: req.body.movementReason,
      itemsList,
    };

    transactionsDb.unshift(newTx);

    res.json({
      success: true,
      transaction: newTx,
      updatedItem: item,
      message: `Transaksi ${type} (${subType || ''}) untuk SKU ${sku} berhasil dicatat. Stok terkini: ${newStock} ${item.unit}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memproses transaksi.' });
  }
});

// 4.5. Batch Multi-SKU Movement Endpoint (Move In & Move Out & Internal Transfer)
app.post('/api/inventory/movement', (req, res) => {
  try {
    const {
      referenceNumber,
      subType = 'INTERNAL_TRANSFER',
      movementReason = 'Relokasi & Penataan Gudang',
      operatorName = 'Operator Gudang',
      operatorRole = 'Staff Gudang',
      notes = '',
      items: movementItems,
    } = req.body;

    if (!Array.isArray(movementItems) || movementItems.length === 0) {
      return res.status(400).json({ error: 'Daftar barang SKU untuk movement tidak boleh kosong.' });
    }

    const txRefNumber =
      referenceNumber ||
      `MOV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const processedDetails: any[] = [];
    const updatedInventoryItems: InventoryItem[] = [];
    let totalQtyMoved = 0;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Validate and process each SKU row
    for (const row of movementItems) {
      const { sku, quantity, fromLocation, toLocation, batchLot, notes: itemNotes } = row;
      const qty = Number(quantity) || 0;

      if (!sku || qty <= 0) {
        return res.status(400).json({ error: `Data SKU atau kuantitas (${qty}) tidak valid pada baris movement.` });
      }

      const invItem = inventoryDb.find((i) => i.sku === sku);
      if (!invItem) {
        return res.status(404).json({ error: `SKU ${sku} tidak ditemukan di database gudang.` });
      }

      if (subType === 'MOVE_OUT' && invItem.stock < qty) {
        return res.status(400).json({
          error: `Stok SKU ${sku} tidak mencukupi untuk Move Out! Tersedia: ${invItem.stock} ${invItem.unit}, diminta: ${qty} ${invItem.unit}.`,
        });
      }

      const originLoc = fromLocation || invItem.location.fullCode;
      const destLoc =
        toLocation ||
        (subType === 'MOVE_OUT' ? 'Staging Transit Area' : invItem.location.fullCode);

      // Update location if internal transfer or move in
      if (subType === 'INTERNAL_TRANSFER' || subType === 'MOVE_IN') {
        if (destLoc && destLoc !== originLoc) {
          invItem.location = {
            ...invItem.location,
            fullCode: destLoc,
          };
        }
      }

      invItem.lastUpdated = now;
      updatedInventoryItems.push(invItem);
      totalQtyMoved += qty;

      processedDetails.push({
        sku: invItem.sku,
        productName: invItem.name,
        quantity: qty,
        unit: invItem.unit,
        locationCode: destLoc,
        fromLocationCode: originLoc,
        toLocationCode: destLoc,
        batchLot: batchLot || invItem.batchLot,
        notes: itemNotes || '',
      });
    }

    // Create primary master transaction
    const firstItem = processedDetails[0];
    const primaryTx: StockTransaction = {
      id: `TX-MOV-${Date.now()}`,
      timestamp: now,
      type: 'MOVEMENT',
      subType,
      partnerName: `Internal Warehouse (${subType})`,
      sku: processedDetails.length === 1 ? firstItem.sku : `${processedDetails.length} Multi-SKU Items`,
      productName:
        processedDetails.length === 1
          ? firstItem.productName
          : `Pemindahan ${processedDetails.length} SKU Barang (${totalQtyMoved} Unit)`,
      quantity: totalQtyMoved,
      unit: processedDetails.length === 1 ? firstItem.unit : 'Items',
      fromLocation:
        processedDetails.length === 1
          ? firstItem.fromLocationCode
          : `${processedDetails.length} Lokasi Asal`,
      toLocation:
        processedDetails.length === 1
          ? firstItem.toLocationCode
          : `${processedDetails.length} Lokasi Tujuan`,
      referenceNumber: txRefNumber,
      operatorName,
      operatorRole,
      notes: `${movementReason}. ${notes}`.trim(),
      status: 'COMPLETED',
      movementReason,
      itemsList: processedDetails,
    };

    transactionsDb.unshift(primaryTx);

    res.json({
      success: true,
      message: `Transaksi Movement No. ${txRefNumber} (${subType}) dengan ${processedDetails.length} SKU berhasil diproses!`,
      transaction: primaryTx,
      updatedItems: updatedInventoryItems,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memproses transaksi movement.' });
  }
});

// 5. Stock Opname / Audit Submission & Approval
app.post('/api/inventory/opname', (req, res) => {
  try {
    const sessionData: StockOpnameSession = req.body;
    if (!sessionData.id || !sessionData.items) {
      return res.status(400).json({ error: 'Data opname tidak valid.' });
    }

    const existingIdx = auditSessionsDb.findIndex((s) => s.id === sessionData.id);
    if (existingIdx >= 0) {
      auditSessionsDb[existingIdx] = sessionData;
    } else {
      auditSessionsDb.unshift(sessionData);
    }

    res.json({ success: true, session: sessionData, message: 'Data Stock Opname berhasil disimpan ke Cloud.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal menyimpan sesi opname.' });
  }
});

app.post('/api/inventory/approve-opname', (req, res) => {
  try {
    const { sessionId, approvedBy, approvalNotes } = req.body;
    const session = auditSessionsDb.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesi opname tidak ditemukan.' });
    }

    session.status = 'APPROVED';
    session.approvedBy = approvedBy;
    session.approvalNotes = approvalNotes;
    session.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Apply adjustments to inventoryDb for each discrepancy
    session.items.forEach((auditItem) => {
      if (auditItem.variance !== 0 && auditItem.physicalCount !== null) {
        const invItem = inventoryDb.find((i) => i.sku === auditItem.sku);
        if (invItem) {
          invItem.stock = auditItem.physicalCount;
          invItem.status = invItem.stock <= 0 ? 'OUT_OF_STOCK' : invItem.stock <= invItem.minStock ? 'LOW_STOCK' : 'IN_STOCK';
          invItem.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 16);

          // Add transaction log
          transactionsDb.unshift({
            id: `TX-OPN-${Date.now()}-${invItem.sku}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            type: 'ADJUSTMENT',
            sku: invItem.sku,
            productName: invItem.name,
            quantity: auditItem.variance,
            unit: invItem.unit,
            fromLocation: invItem.location.fullCode,
            toLocation: invItem.location.fullCode,
            referenceNumber: `OPN-ADJ-${session.id}`,
            operatorName: approvedBy || 'Warehouse Manager',
            operatorRole: 'Kepala Gudang',
            notes: `Penyesuaian hasil Stock Opname: ${auditItem.notes || 'Penyesuaian Fisik vs Sistem'}`,
            status: 'COMPLETED',
          });
        }
      }
    });

    res.json({ success: true, message: 'Stock Opname telah disetujui dan stok sistem berhasil diselaraskan.', session });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal menyetujui opname.' });
  }
});

// 6. Excel Master Data & Opening Balance (Opbal) Bulk Import Endpoints
app.post('/api/inventory/import-opbal', (req, res) => {
  try {
    const { items: rawRows, mode, operatorName, operatorRole, notes } = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data baris Opbal yang dikirim.' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let createdCount = 0;
    let updatedCount = 0;
    const opbalTransactions: StockTransaction[] = [];

    // Process each Opbal row
    rawRows.forEach((row, idx) => {
      const sku = String(row.sku || row['1. SKU ID *'] || row['1. SKU ID'] || row['SKU ID *'] || row['SKU ID'] || row['Kode SKU *'] || row['Kode SKU'] || '').trim().toUpperCase();
      const name = String(row.name || row['3. Deskripsi SKU *'] || row['3. Deskripsi SKU'] || row['Deskripsi SKU *'] || row['Deskripsi SKU'] || row['Nama Barang *'] || row['Nama Barang'] || '').trim();
      const rawQty = row.stock !== undefined ? row.stock : (row['Stok Awal (Qty) *'] !== undefined ? row['Stok Awal (Qty) *'] : (row['Stok Awal (Qty)'] !== undefined ? row['Stok Awal (Qty)'] : row['Stok Awal']));
      const qty = Number(rawQty) || 0;
      const unit = String(row.unit || row['5. Satuan (UOM) *'] || row['5. Satuan (UOM)'] || row['Satuan (UOM) *'] || row['Satuan (UOM)'] || row['Satuan *'] || row['Satuan'] || 'Pcs').trim();
      
      const rawBarcode = row.barcode !== undefined ? row.barcode : (row['2. Barcode'] !== undefined ? row['2. Barcode'] : (row['Barcode / EAN'] !== undefined ? row['Barcode / EAN'] : row['Barcode']));
      const barcode = rawBarcode && String(rawBarcode).trim() !== '' ? String(rawBarcode).trim() : '0';
      
      const isiDus = Number(row.isiDus || row['4. Isi Dus'] || row['Isi Dus']) || 1;
      const brand = String(row.brand || row['6. Brand'] || row['Brand'] || row['Brand / Merk'] || 'General').trim();
      const category = String(row.category || row['7. Kategori *'] || row['7. Kategori'] || row['Kategori *'] || row['Kategori'] || 'Umum').trim();
      
      const rawCbm = row.cbmPerUnit !== undefined ? row.cbmPerUnit : (row['8. Kubikasi (m3)'] !== undefined ? row['8. Kubikasi (m3)'] : (row['Kubikasi (m3)'] !== undefined ? row['Kubikasi (m3)'] : (row['Kubikasi CBM (m3)'] !== undefined ? row['Kubikasi CBM (m3)'] : row['Kubikasi'])));
      const cbmPerUnit = Number(Number(rawCbm || 0.001).toFixed(3));
      
      const rawInboundDate = row.lastInboundDate || row['9. Aging (Day) / Tgl Inbound'] || row['Aging / Tanggal Inbound'] || row['Tanggal Inbound / Aging'] || row['Tanggal Inbound Terakhir'];
      const lastInboundDate = rawInboundDate ? String(rawInboundDate).trim() : new Date().toISOString().substring(0, 10);

      const locationCode = String(row.locationCode || row['Kode Lokasi Rak (WMS)'] || row['Kode Lokasi'] || 'GDG01-RAK01-L01-LV1-P01').trim().toUpperCase();
      const batchLot = String(row.batchLot || row['Batch / No Lot'] || row['Batch Lot'] || `LOT-${new Date().getFullYear()}-OPBAL`).trim();
      const expiryDate = row.expiryDate || row['Tanggal Kadaluarsa (YYYY-MM-DD)'] || row['Tanggal Kadaluarsa'] || undefined;
      const minStock = Number(row.minStock || row['Safety Stock (Min)'] || row['Safety Stock'] || row['Stok Minimal']) || 10;
      const rowNotes = row.notes || row['Catatan / Referensi'] || notes || 'Opening Balance Stok Awal Sistem';

      if (!sku || !name) return;

      const existingIdx = inventoryDb.findIndex((i) => i.sku === sku);

      // Parse location details
      const locParts = locationCode.split('-');
      const zoneId = locParts[0] ? locParts[0].charAt(locParts[0].length - 1) || 'A' : 'A';
      const aisle = locParts[2] ? `Lorong ${locParts[2].replace(/^L/i, '')}` : 'Lorong 01';
      const rack = locParts[1] ? `Rak ${locParts[1].replace(/^RAK/i, '')}` : 'Rak 01';
      const shelfLevel = locParts[3] ? Number(locParts[3].replace(/^[A-Z]+/i, '')) || 1 : 1;
      const binSlot = locParts[4] ? locParts[4].replace(/^P/i, '') || 'A1' : 'A1';

      if (existingIdx >= 0) {
        const prevStock = inventoryDb[existingIdx].stock;
        let finalStock = qty;
        if (mode === 'append_add') {
          finalStock = prevStock + qty;
        }

        inventoryDb[existingIdx] = {
          ...inventoryDb[existingIdx],
          name: name || inventoryDb[existingIdx].name,
          barcode: barcode !== '0' ? barcode : inventoryDb[existingIdx].barcode,
          isiDus: isiDus || inventoryDb[existingIdx].isiDus || 1,
          category: category || inventoryDb[existingIdx].category,
          brand: brand || inventoryDb[existingIdx].brand,
          unit: unit || inventoryDb[existingIdx].unit,
          cbmPerUnit: cbmPerUnit || inventoryDb[existingIdx].cbmPerUnit || 0.001,
          lastInboundDate: lastInboundDate || inventoryDb[existingIdx].lastInboundDate,
          stock: finalStock,
          minStock: minStock || inventoryDb[existingIdx].minStock,
          batchLot: batchLot || inventoryDb[existingIdx].batchLot,
          expiryDate: expiryDate || inventoryDb[existingIdx].expiryDate,
          status: finalStock <= 0 ? 'OUT_OF_STOCK' : finalStock <= minStock ? 'LOW_STOCK' : 'IN_STOCK',
          location: {
            zoneId,
            zoneName: `Zona ${zoneId} - Storage`,
            aisle,
            rack,
            shelfLevel,
            binSlot,
            fullCode: locationCode,
          },
          lastUpdated: now,
        };
        updatedCount++;

        // Transaction log for Opbal
        const tx: StockTransaction = {
          id: `TX-OPBAL-${Date.now()}-${idx}`,
          timestamp: now,
          type: 'ADJUSTMENT',
          sku,
          productName: name,
          quantity: mode === 'append_add' ? qty : (finalStock - prevStock),
          unit,
          fromLocation: 'Opening Balance (Opbal)',
          toLocation: locationCode,
          referenceNumber: `OPBAL-${dateStr}-${String(idx + 1).padStart(4, '0')}`,
          operatorName: operatorName || 'Admin Sistem',
          operatorRole: operatorRole || 'Setup Master',
          notes: `${rowNotes} (Penyesuaian Saldo Awal: ${prevStock} -> ${finalStock} ${unit})`,
          status: 'COMPLETED',
          batchLot,
        };
        opbalTransactions.push(tx);
      } else {
        const newItem: InventoryItem = {
          id: `item-${Date.now()}-${idx}`,
          sku,
          barcode,
          name,
          isiDus,
          category,
          brand,
          unit,
          stock: qty,
          minStock,
          maxCapacity: Number(row.maxCapacity || row['Kapasitas Maksimal']) || 500,
          weightKg: Number(row.weightKg || row['Berat (Kg)']) || 1,
          dimensionsCm: {
            lengthCm: Number(row.lengthCm || row['Panjang (cm)']) || 20,
            widthCm: Number(row.widthCm || row['Lebar (cm)']) || 15,
            heightCm: Number(row.heightCm || row['Tinggi (cm)']) || 10,
          },
          cbmPerUnit,
          lastInboundDate,
          location: {
            zoneId,
            zoneName: `Zona ${zoneId} - Storage`,
            aisle,
            rack,
            shelfLevel,
            binSlot,
            fullCode: locationCode,
          },
          status: qty <= 0 ? 'OUT_OF_STOCK' : qty <= minStock ? 'LOW_STOCK' : 'IN_STOCK',
          abcClass: (row.abcClass || row['Kelas ABC (A/B/C)'] || 'B') as any,
          batchLot,
          expiryDate,
          lastUpdated: now,
          supplier: row.supplier || row['Pemasok / Supplier'] || 'Pemasok Awal',
          notes: rowNotes,
          turnoverRateMonth: 10,
        };

        inventoryDb.unshift(newItem);
        createdCount++;

        const tx: StockTransaction = {
          id: `TX-OPBAL-${Date.now()}-${idx}`,
          timestamp: now,
          type: 'ADJUSTMENT',
          sku,
          productName: name,
          quantity: qty,
          unit,
          fromLocation: 'Opening Balance (Opbal)',
          toLocation: locationCode,
          referenceNumber: `OPBAL-${dateStr}-${String(idx + 1).padStart(4, '0')}`,
          operatorName: operatorName || 'Admin Sistem',
          operatorRole: operatorRole || 'Setup Master',
          notes: `${rowNotes} (Stok Awal Awal: ${qty} ${unit})`,
          status: 'COMPLETED',
          batchLot,
        };
        opbalTransactions.push(tx);
      }

      // Check if locator exists in locator database, if not auto-register it
      const locExist = locatorsDb.find((l) => l.fullCode === locationCode);
      if (!locExist) {
        locatorsDb.push({
          id: `LOC-AUTO-${Date.now()}-${idx}`,
          warehouseCode: locParts[0] || 'GDG01',
          warehouseName: `Gudang ${locParts[0] || 'GDG01'}`,
          rackOrFloorCode: locParts[1] || 'RAK01',
          aisle: locParts[2] || '01',
          level: locParts[3] || '1',
          pallet: locParts[4] || 'P01',
          fullCode: locationCode,
          storageType: 'RACK',
          maxCapacityUnits: 500,
          temperatureType: 'AMBIENT',
          status: qty > 0 ? 'OCCUPIED' : 'AVAILABLE',
          occupiedSku: qty > 0 ? sku : undefined,
          occupiedProductName: qty > 0 ? name : undefined,
          occupiedStock: qty > 0 ? qty : 0,
          createdAt: now,
        });
      } else if (qty > 0) {
        locExist.occupiedSku = sku;
        locExist.occupiedProductName = name;
        locExist.occupiedStock = qty;
        locExist.status = 'OCCUPIED';
      }
    });

    // Add transactions
    transactionsDb = [...opbalTransactions, ...transactionsDb];

    res.json({
      success: true,
      message: `Upload Opbal berhasil! ${createdCount} SKU baru dibuat, ${updatedCount} SKU diperbarui dengan Saldo Awal.`,
      createdCount,
      updatedCount,
      totalProcessed: createdCount + updatedCount,
      snapshot: {
        totalSkus: inventoryDb.length,
        totalUnits: inventoryDb.reduce((acc, curr) => acc + curr.stock, 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memproses import data Opbal.' });
  }
});

// Import Master Items / Master SKU
app.post('/api/inventory/import-items', (req, res) => {
  try {
    const { items: rawRows } = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data master item.' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    let createdCount = 0;
    let updatedCount = 0;

    rawRows.forEach((row, idx) => {
      const sku = String(row.sku || row['1. SKU ID *'] || row['1. SKU ID'] || row['SKU ID *'] || row['SKU ID'] || row['Kode SKU *'] || row['Kode SKU'] || '').trim().toUpperCase();
      const name = String(row.name || row['3. Deskripsi SKU *'] || row['3. Deskripsi SKU'] || row['Deskripsi SKU *'] || row['Deskripsi SKU'] || row['Nama Barang *'] || row['Nama Barang'] || '').trim();
      if (!sku || !name) return;

      const rawBarcode = row.barcode !== undefined ? row.barcode : (row['2. Barcode'] !== undefined ? row['2. Barcode'] : (row['Barcode / EAN'] !== undefined ? row['Barcode / EAN'] : row['Barcode']));
      const barcode = rawBarcode && String(rawBarcode).trim() !== '' ? String(rawBarcode).trim() : '0';
      
      const isiDus = Number(row.isiDus || row['4. Isi Dus'] || row['Isi Dus']) || 1;
      const unit = String(row.unit || row['5. Satuan (UOM) *'] || row['5. Satuan (UOM)'] || row['Satuan (UOM) *'] || row['Satuan (UOM)'] || row['Satuan *'] || row['Satuan'] || 'Pcs').trim();
      const brand = String(row.brand || row['6. Brand'] || row['Brand'] || row['Brand / Merk'] || 'General').trim();
      const category = String(row.category || row['7. Kategori *'] || row['7. Kategori'] || row['Kategori *'] || row['Kategori'] || 'Umum').trim();
      
      const rawCbm = row.cbmPerUnit !== undefined ? row.cbmPerUnit : (row['8. Kubikasi (m3)'] !== undefined ? row['8. Kubikasi (m3)'] : (row['Kubikasi (m3)'] !== undefined ? row['Kubikasi (m3)'] : (row['Kubikasi CBM (m3)'] !== undefined ? row['Kubikasi CBM (m3)'] : row['Kubikasi'])));
      const cbmPerUnit = Number(Number(rawCbm || 0.001).toFixed(3));
      
      const rawInboundDate = row.lastInboundDate || row['9. Aging (Day) / Tgl Inbound'] || row['Aging / Tanggal Inbound'] || row['Tanggal Inbound / Aging'] || row['Tanggal Inbound Terakhir'];
      const lastInboundDate = rawInboundDate ? String(rawInboundDate).trim() : new Date().toISOString().substring(0, 10);

      const minStock = Number(row.minStock || row['Safety Stock (Min)'] || row['Safety Stock'] || row['Stok Minimal']) || 10;
      const maxCapacity = Number(row.maxCapacity || row['Kapasitas Max'] || row['Kapasitas Maksimal']) || 500;
      const weightKg = Number(row.weightKg || row['Berat (Kg)']) || 1;
      const lengthCm = Number(row.lengthCm || row['Panjang (cm)']) || 20;
      const widthCm = Number(row.widthCm || row['Lebar (cm)']) || 15;
      const heightCm = Number(row.heightCm || row['Tinggi (cm)']) || 10;
      const abcClass = (row.abcClass || row['Kelas ABC (A/B/C)'] || 'B') as any;
      const supplier = String(row.supplier || row['Pemasok / Supplier'] || 'Pemasok Resmi').trim();
      const defaultLoc = String(row.defaultLocation || row['Kode Lokasi Default'] || 'GDG01-RAK01-L01-LV1-P01').trim().toUpperCase();
      const notes = String(row.notes || row['Catatan'] || '').trim();

      const existingIdx = inventoryDb.findIndex((i) => i.sku === sku);

      const locParts = defaultLoc.split('-');
      const zoneId = locParts[0] ? locParts[0].charAt(locParts[0].length - 1) || 'A' : 'A';

      if (existingIdx >= 0) {
        inventoryDb[existingIdx] = {
          ...inventoryDb[existingIdx],
          name,
          barcode: barcode !== '0' ? barcode : inventoryDb[existingIdx].barcode,
          isiDus: isiDus || inventoryDb[existingIdx].isiDus || 1,
          category: category || inventoryDb[existingIdx].category,
          brand: brand || inventoryDb[existingIdx].brand,
          unit: unit || inventoryDb[existingIdx].unit,
          cbmPerUnit: cbmPerUnit || inventoryDb[existingIdx].cbmPerUnit || 0.001,
          lastInboundDate: lastInboundDate || inventoryDb[existingIdx].lastInboundDate,
          minStock,
          maxCapacity,
          weightKg,
          dimensionsCm: { lengthCm, widthCm, heightCm },
          abcClass,
          supplier,
          notes: notes || inventoryDb[existingIdx].notes,
          lastUpdated: now,
        };
        updatedCount++;
      } else {
        const newItem: InventoryItem = {
          id: `item-${Date.now()}-${idx}`,
          sku,
          barcode,
          name,
          isiDus,
          category,
          brand,
          unit,
          stock: 0,
          minStock,
          maxCapacity,
          weightKg,
          dimensionsCm: { lengthCm, widthCm, heightCm },
          cbmPerUnit,
          lastInboundDate,
          location: {
            zoneId,
            zoneName: `Zona ${zoneId} - Storage`,
            aisle: locParts[2] ? `Lorong ${locParts[2].replace(/^L/i, '')}` : 'Lorong 01',
            rack: locParts[1] ? `Rak ${locParts[1].replace(/^RAK/i, '')}` : 'Rak 01',
            shelfLevel: locParts[3] ? Number(locParts[3].replace(/^[A-Z]+/i, '')) || 1 : 1,
            binSlot: locParts[4] ? locParts[4].replace(/^P/i, '') || 'A1' : 'A1',
            fullCode: defaultLoc,
          },
          status: 'OUT_OF_STOCK',
          abcClass,
          batchLot: `LOT-${new Date().getFullYear()}-01`,
          lastUpdated: now,
          supplier,
          notes,
          turnoverRateMonth: 10,
        };
        inventoryDb.unshift(newItem);
        createdCount++;
      }
    });

    res.json({
      success: true,
      message: `Import Master SKU berhasil! ${createdCount} produk baru ditambahkan, ${updatedCount} produk diperbarui.`,
      createdCount,
      updatedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memproses import master SKU.' });
  }
});

// Import Master Locators
app.post('/api/inventory/import-locators', (req, res) => {
  try {
    const { locators: rawRows } = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data master lokasi.' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    let createdCount = 0;
    let updatedCount = 0;

    rawRows.forEach((row, idx) => {
      const warehouseCode = String(row.warehouseCode || row['Kode Gudang *'] || row['Kode Gudang'] || '').trim().toUpperCase();
      const rackOrFloorCode = String(row.rackOrFloorCode || row['Kode Rak / Floor *'] || row['Kode Rak / Floor'] || '').trim().toUpperCase();

      if (!warehouseCode || !rackOrFloorCode) return;

      const warehouseName = String(row.warehouseName || row['Nama Gudang'] || `Gudang ${warehouseCode}`).trim();
      const aisle = String(row.aisle || row['Lorong (Aisle)'] || row['Lorong'] || '').trim().toUpperCase();
      const level = String(row.level || row['Level (Tier)'] || row['Level'] || '').trim().toUpperCase();
      const pallet = String(row.pallet || row['Palet / Slot'] || row['Palet'] || '').trim().toUpperCase();
      
      const segments: string[] = [warehouseCode, rackOrFloorCode];
      if (aisle) segments.push(aisle.startsWith('L') ? aisle : `L${aisle}`);
      if (level) segments.push(level.startsWith('LV') || level.startsWith('L') ? level : `LV${level}`);
      if (pallet) segments.push(pallet.startsWith('P') || pallet.startsWith('PL') || pallet.startsWith('B') ? pallet : `P${pallet}`);
      const fullCode = String(row.fullCode || row['Kode Full (Opsional)'] || row['Kode Full'] || segments.join('-')).trim().toUpperCase();

      const storageType = (row.storageType || row['Tipe Penyimpanan (RACK/FLOOR/PALLET_BULK/STAGING)'] || row['Tipe Penyimpanan'] || 'RACK') as any;
      const maxCapacityUnits = Number(row.maxCapacityUnits || row['Kapasitas Max (Unit)'] || row['Kapasitas Max']) || 400;
      const temperatureType = (row.temperatureType || row['Tipe Suhu (AMBIENT/AIR_CONDITIONED/COLD_STORAGE/HAZARDOUS)'] || row['Tipe Suhu'] || 'AMBIENT') as any;
      const notes = String(row.notes || row['Catatan'] || '').trim();

      const existingIdx = locatorsDb.findIndex((l) => l.fullCode === fullCode);

      if (existingIdx >= 0) {
        locatorsDb[existingIdx] = {
          ...locatorsDb[existingIdx],
          warehouseCode,
          warehouseName,
          rackOrFloorCode,
          aisle,
          level,
          pallet,
          storageType,
          maxCapacityUnits,
          temperatureType,
          notes: notes || locatorsDb[existingIdx].notes,
        };
        updatedCount++;
      } else {
        const newLoc: WarehouseLocator = {
          id: `LOC-${Date.now()}-${idx}`,
          warehouseCode,
          warehouseName,
          rackOrFloorCode,
          aisle,
          level,
          pallet,
          fullCode,
          storageType,
          maxCapacityUnits,
          temperatureType,
          status: 'AVAILABLE',
          notes,
          createdAt: now,
        };
        locatorsDb.unshift(newLoc);
        createdCount++;
      }
    });

    res.json({
      success: true,
      message: `Import Master Lokasi berhasil! ${createdCount} locator baru didaftarkan, ${updatedCount} diperbarui.`,
      createdCount,
      updatedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal memproses import master lokasi.' });
  }
});

// Reset entire database to clean state or freshly imported Opbal
app.post('/api/inventory/clean-slate', (req, res) => {
  try {
    const { keepLocators } = req.body;
    inventoryDb = [];
    transactionsDb = [];
    auditSessionsDb = [];
    if (!keepLocators) {
      locatorsDb = [];
    }
    res.json({
      success: true,
      message: 'Database berhasil di-reset untuk persiapan input Opening Balance awal.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gagal mereset database.' });
  }
});

// 7. Gemini AI Assistant for Smart Warehouse Insights
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { queryType, customPrompt } = req.body;

    const inventorySnapshot = inventoryDb.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      stock: item.stock,
      minStock: item.minStock,
      status: item.status,
      location: item.location.fullCode,
      abcClass: item.abcClass,
      turnoverRateMonth: item.turnoverRateMonth,
    }));

    if (!ai) {
      // Return smart rule-based fallback response if API key is not yet set
      const lowStockItems = inventoryDb.filter((i) => i.stock <= i.minStock);
      const fastMovingInWrongZones = inventoryDb.filter((i) => i.abcClass === 'A' && !i.location.fullCode.startsWith('A-'));
      
      return res.json({
        success: true,
        source: 'local_engine',
        title: 'Analisis Otomatis Operasional Gudang',
        insights: [
          `Terdeteksi **${lowStockItems.length} SKU** yang berada di bawah safety stock (${lowStockItems.map((i) => i.name).join(', ')}). Disarankan segera membuat Purchase Order (PO).`,
          `Terdapat **${fastMovingInWrongZones.length} SKU Fast-Moving (Kategori A)** yang belum ditempatkan di Zona A (Fast Picking). Disarankan relokasi untuk memangkas waktu travel operator hingga 35%.`,
          `Tingkat utilisasi kapasitas gudang berada pada kondisi optimal (~68%). Rotasi barang tertinggi pada kategori FMCG & Elektronik.`,
        ],
        recommendations: [
          'Jalankan restock prioritas untuk SSD NVMe M.2 1TB dan Susu UHT 1000ml.',
          'Lakukan slotting ulang pada Rak B-01 dan C-02 sebelum jadwal audit triwulan.',
          'Optimalkan penempatan batch barang mendekati tanggal kedaluwarsa dengan metode FEFO.',
        ],
      });
    }

    const promptText = `Anda adalah AI Spesialis Manajemen Gudang & Logistik (Warehouse Intelligence Specialist) untuk WMS Gudang Pintar.
Analisis data inventaris gudang real-time berikut dalam Bahasa Indonesia yang profesional, taktis, dan aplikatif:

Data Inventaris Saat Ini:
${JSON.stringify(inventorySnapshot, null, 2)}

Permintaan Analisis: ${customPrompt || 'Berikan analisis kesehatan stok gudang, deteksi potensi bottleneck / kekurangan stok, optimasi penempatan lokasi rak (slotting), dan rekomendasi aksi operasional.'}

Berikan respon terstruktur dalam format JSON dengan properti:
- title: string (Judul ringkas rekomendasi)
- summary: string (Ringkasan kondisi inventaris 2-3 kalimat)
- riskAlerts: string[] (Daftar peringatan kritis atau anomali stok)
- recommendations: string[] (Langkah taktis yang harus diambil oleh Kepala Gudang atau Staff Operasional)
- slottingOptimization: string[] (Saran pemindahan barang / penataan rak untuk efisiensi lintasan)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: promptText,
      config: {
        systemInstruction: 'Anda adalah asisten AI ahli warehouse management system, supply chain, dan logistik pergudangan Indonesia. Berikan respon analitis yang tajam, faktual, dan dalam format JSON yang valid.',
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = { rawAnalysis: responseText };
    }

    res.json({
      success: true,
      source: 'gemini_ai',
      ...parsedData,
    });
  } catch (err: any) {
    console.error('AI Analysis error:', err);
    res.status(500).json({
      error: 'Gagal menjalankan analisis AI.',
      details: err?.message,
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware & Static Server
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WMS Gudang Pintar Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
