import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { InventoryItem, StockOpnameSession, StockTransaction, WarehouseZone, WarehouseLocator, AnalyticsSummary, MovementSubType } from '../types';
import { INITIAL_INVENTORY, INITIAL_TRANSACTIONS, INITIAL_ZONES, INITIAL_LOCATORS } from '../data/mockWarehouse';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  items: InventoryItem[];
  zones: WarehouseZone[];
  locators: WarehouseLocator[];
  transactions: StockTransaction[];
  audits: StockOpnameSession[];
  isLoading: boolean;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline';
  selectedSkuForLocator: string | null;
  setSelectedSkuForLocator: (sku: string | null) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  analytics: AnalyticsSummary;
  locateSku: (sku: string) => void;
  getItemBySkuOrBarcode: (code: string) => InventoryItem | undefined;
  saveItem: (item: Partial<InventoryItem>) => Promise<{ success: boolean; message: string }>;
  deleteItem: (id: string) => Promise<{ success: boolean; message: string }>;
  saveLocator: (locator: Partial<WarehouseLocator>) => Promise<{ success: boolean; message: string; locator?: WarehouseLocator }>;
  deleteLocator: (id: string) => Promise<{ success: boolean; message: string }>;
  recordMovement: (data: {
    type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'MOVEMENT';
    subType?: string;
    partnerName?: string;
    sku: string;
    quantity: number;
    referenceNumber?: string;
    notes?: string;
    newLocation?: any;
    fromLocation?: string;
    toLocation?: string;
    batchLot?: string;
    qcCondition?: any;
    driverName?: string;
    vehiclePlate?: string;
    shippingExpedition?: string;
    movementReason?: string;
    itemsList?: any[];
  }) => Promise<{ success: boolean; message: string }>;
  recordBatchMovement: (data: {
    referenceNumber?: string;
    subType?: MovementSubType | string;
    movementReason?: string;
    notes?: string;
    items: Array<{
      sku: string;
      quantity: number;
      fromLocation?: string;
      toLocation?: string;
      batchLot?: string;
      notes?: string;
    }>;
  }) => Promise<{ success: boolean; message: string; transaction?: StockTransaction }>;
  saveOpnameSession: (session: StockOpnameSession) => Promise<boolean>;
  approveOpname: (sessionId: string, notes?: string) => Promise<{ success: boolean; message: string }>;
  importOpbalData: (rows: any[], mode?: 'replace_all' | 'merge_update' | 'append_add', notes?: string) => Promise<{ success: boolean; message: string; createdCount?: number; updatedCount?: number }>;
  importMasterItemsData: (rows: any[]) => Promise<{ success: boolean; message: string; createdCount?: number; updatedCount?: number }>;
  importMasterLocatorsData: (rows: any[]) => Promise<{ success: boolean; message: string; createdCount?: number; updatedCount?: number }>;
  cleanSlateDatabase: (keepLocators?: boolean) => Promise<{ success: boolean; message: string }>;
  refreshData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('wms_items');
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
  });
  const [zones, setZones] = useState<WarehouseZone[]>(INITIAL_ZONES);
  const [locators, setLocators] = useState<WarehouseLocator[]>(() => {
    const saved = localStorage.getItem('wms_locators');
    return saved ? JSON.parse(saved) : INITIAL_LOCATORS;
  });
  const [transactions, setTransactions] = useState<StockTransaction[]>(() => {
    const saved = localStorage.getItem('wms_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });
  const [audits, setAudits] = useState<StockOpnameSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [selectedSkuForLocator, setSelectedSkuForLocator] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Fetch initial data from server
  const refreshData = useCallback(async () => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setItems(data.items);
          localStorage.setItem('wms_items', JSON.stringify(data.items));
        }
        if (data.zones) setZones(data.zones);
        if (data.locators && data.locators.length > 0) {
          setLocators(data.locators);
          localStorage.setItem('wms_locators', JSON.stringify(data.locators));
        }
        if (data.transactions) {
          setTransactions(data.transactions);
          localStorage.setItem('wms_transactions', JSON.stringify(data.transactions));
        }
        if (data.audits) setAudits(data.audits);
        setCloudSyncStatus('synced');
      } else {
        setCloudSyncStatus('offline');
      }
    } catch {
      setCloudSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Compute analytics
  const analytics: AnalyticsSummary = {
    totalSkus: items.length,
    totalUnits: items.reduce((acc, curr) => acc + curr.stock, 0),
    totalCbm: Number(
      items.reduce((acc, curr) => acc + (curr.stock * (curr.cbmPerUnit || 0)), 0).toFixed(4)
    ),
    lowStockCount: items.filter((i) => i.status === 'LOW_STOCK').length,
    outOfStockCount: items.filter((i) => i.status === 'OUT_OF_STOCK').length,
    occupancyRatePct: Math.round(
      (items.reduce((acc, curr) => acc + curr.stock, 0) /
        (zones.reduce((acc, z) => acc + z.maxCapacity, 0) || 1)) *
        100
    ),
    todayInboundUnits: transactions
      .filter((t) => t.type === 'INBOUND')
      .reduce((acc, curr) => acc + curr.quantity, 0),
    todayOutboundUnits: transactions
      .filter((t) => t.type === 'OUTBOUND')
      .reduce((acc, curr) => acc + curr.quantity, 0),
    totalCapacityUnits: zones.reduce((acc, z) => acc + z.maxCapacity, 0),
    fastMovingCount: items.filter((i) => i.abcClass === 'A').length,
    slowMovingCount: items.filter((i) => i.abcClass === 'C').length,
  };

  const locateSku = (sku: string) => {
    setSelectedSkuForLocator(sku);
  };

  const getItemBySkuOrBarcode = (code: string): InventoryItem | undefined => {
    if (!code) return undefined;
    const cleanCode = code.trim().toLowerCase();
    return items.find(
      (i) =>
        i.sku.toLowerCase() === cleanCode ||
        i.barcode.toLowerCase() === cleanCode ||
        i.name.toLowerCase().includes(cleanCode)
    );
  };

  const saveItem = async (itemData: Partial<InventoryItem>) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshData();
        return { success: true, message: data.message || 'Data SKU berhasil disimpan.' };
      } else {
        // Fallback local update
        const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const existingIdx = items.findIndex((i) => i.id === itemData.id || i.sku === itemData.sku);
        let updatedList: InventoryItem[];
        const lengthCm = Number(itemData.dimensionsCm?.lengthCm) || 20;
        const widthCm = Number(itemData.dimensionsCm?.widthCm) || 15;
        const heightCm = Number(itemData.dimensionsCm?.heightCm) || 10;
        const calculatedCbm = Number(((lengthCm * widthCm * heightCm) / 1000000).toFixed(4));
        const cbmPerUnit = itemData.cbmPerUnit !== undefined ? Number(itemData.cbmPerUnit) : calculatedCbm;

        if (existingIdx >= 0) {
          updatedList = [...items];
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            ...itemData,
            barcode: itemData.barcode && String(itemData.barcode).trim() !== '' ? String(itemData.barcode).trim() : '0',
            isiDus: Number(itemData.isiDus) || 1,
            dimensionsCm: { lengthCm, widthCm, heightCm },
            cbmPerUnit,
            lastInboundDate: itemData.lastInboundDate || updatedList[existingIdx].lastInboundDate || now.substring(0, 10),
            lastUpdated: now,
          } as InventoryItem;
        } else {
          const newItem: InventoryItem = {
            id: itemData.id || `item-${Date.now()}`,
            sku: itemData.sku || `SKU-${Date.now().toString().slice(-4)}`,
            barcode: itemData.barcode && String(itemData.barcode).trim() !== '' ? String(itemData.barcode).trim() : '0',
            name: itemData.name || 'Barang Baru',
            isiDus: Number(itemData.isiDus) || 1,
            category: itemData.category || 'Umum',
            brand: itemData.brand || 'Generic',
            unit: itemData.unit || 'Pcs',
            stock: Number(itemData.stock) || 0,
            minStock: Number(itemData.minStock) || 10,
            maxCapacity: Number(itemData.maxCapacity) || 100,
            weightKg: Number(itemData.weightKg) || 1,
            dimensionsCm: { lengthCm, widthCm, heightCm },
            cbmPerUnit,
            lastInboundDate: itemData.lastInboundDate || now.substring(0, 10),
            location: itemData.location || {
              zoneId: 'A',
              zoneName: 'Zona A - Fast Moving Goods',
              aisle: 'Lorong 01',
              rack: 'Rak 01',
              shelfLevel: 1,
              binSlot: 'A1',
              fullCode: 'A-01-01-L1-A1',
            },
            status: 'IN_STOCK',
            abcClass: 'B',
            batchLot: itemData.batchLot || 'LOT-2026-01',
            lastUpdated: now,
            supplier: itemData.supplier || 'Pemasok Resmi',
            turnoverRateMonth: 10,
          };
          updatedList = [newItem, ...items];
        }
        setItems(updatedList);
        localStorage.setItem('wms_items', JSON.stringify(updatedList));
        setCloudSyncStatus('synced');
        return { success: true, message: 'Item berhasil diperbarui (Local Cache).' };
      }
    } catch {
      setCloudSyncStatus('offline');
      return { success: false, message: 'Gagal menghubungi server database.' };
    }
  };

  const deleteItem = async (id: string) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch(`/api/inventory/item/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshData();
        return { success: true, message: 'Item berhasil dihapus.' };
      }
      const updated = items.filter((i) => i.id !== id && i.sku !== id);
      setItems(updated);
      localStorage.setItem('wms_items', JSON.stringify(updated));
      return { success: true, message: 'Item dihapus dari penyimpanan lokal.' };
    } catch {
      return { success: false, message: 'Gagal menghapus item.' };
    }
  };

  const saveLocator = async (locatorData: Partial<WarehouseLocator>) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/locator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locatorData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshData();
        return { success: true, message: data.message, locator: data.locator };
      } else {
        // Fallback local update
        if (!locatorData.warehouseCode || !locatorData.rackOrFloorCode) {
          return { success: false, message: 'Kode Gudang dan Kode Rak/Floor (Mandatory) wajib diisi.' };
        }
        const cleanWh = locatorData.warehouseCode.trim().toUpperCase();
        const cleanRack = locatorData.rackOrFloorCode.trim().toUpperCase();
        const cleanAisle = locatorData.aisle ? locatorData.aisle.trim().toUpperCase() : '';
        const cleanLevel = locatorData.level ? locatorData.level.trim().toUpperCase() : '';
        const cleanPallet = locatorData.pallet ? locatorData.pallet.trim().toUpperCase() : '';

        const segments: string[] = [cleanWh, cleanRack];
        if (cleanAisle) segments.push(cleanAisle.startsWith('L') ? cleanAisle : `L${cleanAisle}`);
        if (cleanLevel) segments.push(cleanLevel.startsWith('LV') || cleanLevel.startsWith('L') ? cleanLevel : `LV${cleanLevel}`);
        if (cleanPallet) segments.push(cleanPallet.startsWith('P') || cleanPallet.startsWith('PL') || cleanPallet.startsWith('B') ? cleanPallet : `P${cleanPallet}`);
        const generatedFullCode = locatorData.fullCode || segments.join('-');

        const existingIdx = locators.findIndex((l) => l.id === locatorData.id || l.fullCode === generatedFullCode);
        const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

        let updatedLocators: WarehouseLocator[];
        let savedLoc: WarehouseLocator;

        if (existingIdx >= 0) {
          savedLoc = {
            ...locators[existingIdx],
            ...locatorData,
            warehouseCode: cleanWh,
            rackOrFloorCode: cleanRack,
            aisle: cleanAisle,
            level: cleanLevel,
            pallet: cleanPallet,
            fullCode: generatedFullCode,
            maxCapacityUnits: Number(locatorData.maxCapacityUnits) || locators[existingIdx].maxCapacityUnits || 300,
          } as WarehouseLocator;
          updatedLocators = [...locators];
          updatedLocators[existingIdx] = savedLoc;
        } else {
          savedLoc = {
            id: locatorData.id || `LOC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            warehouseCode: cleanWh,
            warehouseName: locatorData.warehouseName || `Gudang ${cleanWh}`,
            rackOrFloorCode: cleanRack,
            aisle: cleanAisle,
            level: cleanLevel,
            pallet: cleanPallet,
            fullCode: generatedFullCode,
            storageType: locatorData.storageType || 'RACK',
            maxCapacityUnits: Number(locatorData.maxCapacityUnits) || 300,
            temperatureType: locatorData.temperatureType || 'AMBIENT',
            status: 'AVAILABLE',
            notes: locatorData.notes || '',
            createdAt: now,
          };
          updatedLocators = [savedLoc, ...locators];
        }

        setLocators(updatedLocators);
        localStorage.setItem('wms_locators', JSON.stringify(updatedLocators));
        setCloudSyncStatus('synced');
        return { success: true, message: `Locator [${generatedFullCode}] berhasil disimpan.`, locator: savedLoc };
      }
    } catch {
      setCloudSyncStatus('offline');
      return { success: false, message: 'Gagal menghubungi server database.' };
    }
  };

  const deleteLocator = async (id: string) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch(`/api/inventory/locator/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshData();
        return { success: true, message: 'Locator berhasil dihapus.' };
      }
      const updated = locators.filter((l) => l.id !== id && l.fullCode !== id);
      setLocators(updated);
      localStorage.setItem('wms_locators', JSON.stringify(updated));
      return { success: true, message: 'Locator dihapus dari penyimpanan lokal.' };
    } catch {
      return { success: false, message: 'Gagal menghapus locator.' };
    }
  };

  const recordMovement = async (data: {
    type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'MOVEMENT';
    subType?: string;
    partnerName?: string;
    sku: string;
    quantity: number;
    referenceNumber?: string;
    notes?: string;
    newLocation?: any;
    fromLocation?: string;
    toLocation?: string;
    batchLot?: string;
    qcCondition?: any;
    driverName?: string;
    vehiclePlate?: string;
    shippingExpedition?: string;
    movementReason?: string;
    itemsList?: any[];
  }) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          operatorName: currentUser.name,
          operatorRole: currentUser.roleTitle,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.error || 'Gagal memproses pergerakan barang.' };
      }
    } catch {
      // Local fallback execution
      const item = items.find((i) => i.sku === data.sku);
      if (!item) return { success: false, message: `SKU ${data.sku} tidak ditemukan.` };

      const qty = Number(data.quantity);
      let newStock = item.stock;
      if (data.type === 'INBOUND') newStock += qty;
      if (data.type === 'OUTBOUND') {
        if (item.stock < qty) return { success: false, message: 'Stok tidak mencukupi!' };
        newStock -= qty;
      }
      if (data.type === 'RETURN') {
        if (!data.qcCondition || data.qcCondition === 'GOOD_RESTOCK') {
          newStock += qty;
        }
      }
      if (data.type === 'ADJUSTMENT') newStock = Math.max(0, item.stock + qty);

      const targetLocCode = data.toLocation || (data.newLocation ? data.newLocation.fullCode : item.location.fullCode);
      const updatedLocation = (data.type === 'TRANSFER' || data.type === 'MOVEMENT') && targetLocCode
        ? { ...item.location, fullCode: targetLocCode }
        : item.location;

      const updatedItem = {
        ...item,
        location: updatedLocation,
        stock: newStock,
        status: (newStock <= 0 ? 'OUT_OF_STOCK' : newStock <= item.minStock ? 'LOW_STOCK' : 'IN_STOCK') as any,
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };

      const newTx: StockTransaction = {
        id: `TX-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: data.type,
        subType: data.subType,
        partnerName: data.partnerName,
        sku: item.sku,
        productName: item.name,
        quantity: qty,
        unit: item.unit,
        fromLocation: data.fromLocation || (data.type === 'INBOUND' ? 'Inbound Dock' : data.type === 'RETURN' ? 'Return Dock' : item.location.fullCode),
        toLocation: data.toLocation || (data.newLocation ? data.newLocation.fullCode : (data.type === 'OUTBOUND' ? 'Outbound Dispatch' : item.location.fullCode)),
        referenceNumber: data.referenceNumber || `${data.type.substring(0, 3)}-${Date.now().toString().slice(-5)}`,
        operatorName: currentUser.name,
        operatorRole: currentUser.roleTitle,
        notes: data.notes || '',
        status: 'COMPLETED',
        batchLot: data.batchLot || item.batchLot,
        qcCondition: data.qcCondition,
        driverName: data.driverName,
        vehiclePlate: data.vehiclePlate,
        shippingExpedition: data.shippingExpedition,
        movementReason: data.movementReason,
        itemsList: data.itemsList,
      };

      const newItems = items.map((i) => (i.sku === item.sku ? updatedItem : i));
      const newTransactions = [newTx, ...transactions];
      setItems(newItems);
      setTransactions(newTransactions);
      localStorage.setItem('wms_items', JSON.stringify(newItems));
      localStorage.setItem('wms_transactions', JSON.stringify(newTransactions));
      setCloudSyncStatus('synced');

      return { success: true, message: `Transaksi ${data.type} berhasil diproses (Mode Offline).` };
    }
  };

  const recordBatchMovement = async (data: {
    referenceNumber?: string;
    subType?: MovementSubType | string;
    movementReason?: string;
    notes?: string;
    items: Array<{
      sku: string;
      quantity: number;
      fromLocation?: string;
      toLocation?: string;
      batchLot?: string;
      notes?: string;
    }>;
  }) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          operatorName: currentUser.name,
          operatorRole: currentUser.roleTitle,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        await refreshData();
        return { success: true, message: result.message, transaction: result.transaction };
      } else {
        return { success: false, message: result.error || 'Gagal memproses batch movement.' };
      }
    } catch {
      // Local fallback
      const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const subType = (data.subType as MovementSubType) || 'INTERNAL_TRANSFER';
      const refNum = data.referenceNumber || `MOV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const processedDetails: any[] = [];
      let currentItems = [...items];
      let totalQty = 0;

      for (const row of data.items) {
        const itm = currentItems.find((i) => i.sku === row.sku);
        if (!itm) continue;
        const q = Number(row.quantity) || 0;
        totalQty += q;
        const origLoc = row.fromLocation || itm.location.fullCode;
        const dstLoc = row.toLocation || (subType === 'MOVE_OUT' ? 'Staging Transit Area' : itm.location.fullCode);

        if (subType === 'INTERNAL_TRANSFER' || subType === 'MOVE_IN') {
          currentItems = currentItems.map((i) =>
            i.sku === row.sku ? { ...i, location: { ...i.location, fullCode: dstLoc }, lastUpdated: now } : i
          );
        }

        processedDetails.push({
          sku: itm.sku,
          productName: itm.name,
          quantity: q,
          unit: itm.unit,
          locationCode: dstLoc,
          fromLocationCode: origLoc,
          toLocationCode: dstLoc,
          batchLot: row.batchLot || itm.batchLot,
          notes: row.notes || '',
        });
      }

      const firstRow = processedDetails[0];
      const masterTx: StockTransaction = {
        id: `TX-MOV-${Date.now()}`,
        timestamp: now,
        type: 'MOVEMENT',
        subType,
        partnerName: `Internal Warehouse (${subType})`,
        sku: processedDetails.length === 1 ? firstRow.sku : `${processedDetails.length} Multi-SKU Items`,
        productName:
          processedDetails.length === 1
            ? firstRow.productName
            : `Pemindahan ${processedDetails.length} SKU Barang (${totalQty} Unit)`,
        quantity: totalQty,
        unit: processedDetails.length === 1 ? firstRow.unit : 'Items',
        fromLocation: processedDetails.length === 1 ? firstRow.fromLocationCode : `${processedDetails.length} Lokasi Asal`,
        toLocation: processedDetails.length === 1 ? firstRow.toLocationCode : `${processedDetails.length} Lokasi Tujuan`,
        referenceNumber: refNum,
        operatorName: currentUser.name,
        operatorRole: currentUser.roleTitle,
        notes: `${data.movementReason || 'Movement Relokasi'}. ${data.notes || ''}`.trim(),
        status: 'COMPLETED',
        movementReason: data.movementReason,
        itemsList: processedDetails,
      };

      const newTxList = [masterTx, ...transactions];
      setItems(currentItems);
      setTransactions(newTxList);
      localStorage.setItem('wms_items', JSON.stringify(currentItems));
      localStorage.setItem('wms_transactions', JSON.stringify(newTxList));
      setCloudSyncStatus('synced');

      return {
        success: true,
        message: `Transaksi Movement ${refNum} (${subType}) berhasil diproses (Mode Offline).`,
        transaction: masterTx,
      };
    }
  };

  const saveOpnameSession = async (session: StockOpnameSession) => {
    try {
      const res = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      const newAudits = [session, ...audits.filter((a) => a.id !== session.id)];
      setAudits(newAudits);
      return true;
    } catch {
      const newAudits = [session, ...audits.filter((a) => a.id !== session.id)];
      setAudits(newAudits);
      return true;
    }
  };

  const approveOpname = async (sessionId: string, notes?: string) => {
    try {
      const res = await fetch('/api/inventory/approve-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          approvedBy: currentUser.name,
          approvalNotes: notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.error || 'Gagal menyetujui opname.' };
    } catch {
      return { success: false, message: 'Gagal menghubungi server.' };
    }
  };

  const importOpbalData = async (
    rows: any[],
    mode: 'replace_all' | 'merge_update' | 'append_add' = 'replace_all',
    notes?: string
  ) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/import-opbal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows,
          mode,
          operatorName: currentUser.name,
          operatorRole: currentUser.roleTitle,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshData();
        return {
          success: true,
          message: data.message,
          createdCount: data.createdCount,
          updatedCount: data.updatedCount,
        };
      }
      return { success: false, message: data.error || 'Gagal mengimpor data Opbal.' };
    } catch {
      setCloudSyncStatus('offline');
      return { success: false, message: 'Gagal menghubungi server untuk import Opbal.' };
    }
  };

  const importMasterItemsData = async (rows: any[]) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshData();
        return {
          success: true,
          message: data.message,
          createdCount: data.createdCount,
          updatedCount: data.updatedCount,
        };
      }
      return { success: false, message: data.error || 'Gagal mengimpor master item.' };
    } catch {
      setCloudSyncStatus('offline');
      return { success: false, message: 'Gagal menghubungi server untuk import master item.' };
    }
  };

  const importMasterLocatorsData = async (rows: any[]) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/import-locators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locators: rows }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshData();
        return {
          success: true,
          message: data.message,
          createdCount: data.createdCount,
          updatedCount: data.updatedCount,
        };
      }
      return { success: false, message: data.error || 'Gagal mengimpor master lokasi.' };
    } catch {
      setCloudSyncStatus('offline');
      return { success: false, message: 'Gagal menghubungi server untuk import master lokasi.' };
    }
  };

  const cleanSlateDatabase = async (keepLocators: boolean = true) => {
    try {
      setCloudSyncStatus('syncing');
      const res = await fetch('/api/inventory/clean-slate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepLocators }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems([]);
        setTransactions([]);
        setAudits([]);
        if (!keepLocators) setLocators([]);
        localStorage.removeItem('wms_items');
        localStorage.removeItem('wms_transactions');
        if (!keepLocators) localStorage.removeItem('wms_locators');
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.error || 'Gagal mereset database.' };
    } catch {
      return { success: false, message: 'Gagal menghubungi server untuk reset database.' };
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        zones,
        locators,
        transactions,
        audits,
        isLoading,
        cloudSyncStatus,
        selectedSkuForLocator,
        setSelectedSkuForLocator,
        isScannerOpen,
        setIsScannerOpen,
        analytics,
        locateSku,
        getItemBySkuOrBarcode,
        saveItem,
        deleteItem,
        saveLocator,
        deleteLocator,
        recordMovement,
        saveOpnameSession,
        approveOpname,
        importOpbalData,
        importMasterItemsData,
        importMasterLocatorsData,
        cleanSlateDatabase,
        refreshData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
