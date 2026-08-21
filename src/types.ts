export type UserRole = 'manager' | 'operator' | 'auditor' | 'viewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatar: string;
  badgeColor: string;
  permissions: {
    canInbound: boolean;
    canOutbound: boolean;
    canReturn: boolean;
    canTransfer: boolean;
    canAdjustStock: boolean;
    canApproveAdjustments: boolean;
    canPerformOpname: boolean;
    canManageRacks: boolean;
    canManageUsers: boolean;
    canExportReports: boolean;
    canAccessAI: boolean;
  };
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCKED';
export type AbcClassification = 'A' | 'B' | 'C'; // A: Fast Moving (80% flow), B: Medium (15%), C: Slow Moving (5%)

export interface ItemLocation {
  zoneId: string; // 'A', 'B', 'C', 'D'
  zoneName: string; // e.g. "Zona A - Fast Moving"
  aisle: string; // e.g. "Lorong 02"
  rack: string; // e.g. "Rak 04"
  shelfLevel: number; // 1 (Bottom), 2, 3, 4 (Top)
  binSlot: string; // 'B1', 'B2', etc.
  fullCode: string; // 'A-02-04-L3-B1'
}

export interface ItemDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface InventoryItem {
  id: string;
  // 1. SKU ID
  sku: string;
  // 2. Barcode (Standard registered barcode, or "0" if not registered)
  barcode: string;
  // 3. Deskripsi SKU
  name: string;
  // 4. Isi Dus (Pcs/Unit per Dus)
  isiDus: number;
  // 5. Satuan (UOM) - Pcs, Set, Dus, Box, Karton, Unit, etc.
  unit: string;
  // 6. Brand / Merek
  brand: string;
  // 7. Kategori
  category: string;
  // 8. Kubikasi (m³ / CBM manual, 3 decimal places e.g. 0.045)
  cbmPerUnit: number;
  // 9. Aging (Day) & Tanggal Penerimaan Inbound Terakhir
  lastInboundDate?: string;
  agingDays?: number;

  // Operational & Stock Fields
  stock: number;
  minStock: number; // Safety Stock
  maxCapacity: number;
  weightKg?: number;
  dimensionsCm?: ItemDimensions; // P x L x T (cm) - opsional
  location: ItemLocation;
  status: StockStatus;
  abcClass: AbcClassification;
  batchLot: string;
  expiryDate?: string;
  lastUpdated: string;
  supplier: string;
  notes?: string;
  turnoverRateMonth: number;
}

export type TransactionType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'MOVEMENT';
export type TransactionStatus = 'COMPLETED' | 'PENDING_APPROVAL' | 'CANCELLED';

export type OutboundSubType = 'CUSTOMER_REGULER' | 'KONSINYASI' | 'PAMERAN' | 'RETUR_VENDOR';
export type InboundSubType = 'VENDOR_LOKAL' | 'IMPORT' | 'AFILIASI';
export type ReturnSubType = 'RETUR_CUSTOMER_REGULER' | 'RETUR_KONSINYASI' | 'RETUR_PAMERAN';
export type ReturnQCCondition = 'GOOD_RESTOCK' | 'REWORK' | 'SCRAP_DAMAGED';
export type MovementSubType = 'INTERNAL_TRANSFER' | 'MOVE_OUT' | 'MOVE_IN';

export interface TransactionItemDetail {
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  locationCode?: string;
  fromLocationCode?: string;
  toLocationCode?: string;
  batchLot?: string;
  notes?: string;
}

export interface StockTransaction {
  id: string;
  timestamp: string;
  type: TransactionType;
  subType?: OutboundSubType | InboundSubType | ReturnSubType | MovementSubType | string;
  partnerName?: string; // Nama customer, vendor lokal, importir, mitra konsinyasi, lokasi pameran, atau cabang afiliasi
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  fromLocation?: string;
  toLocation?: string;
  referenceNumber: string; // e.g. DO-2026-0891, PO-2026-1142, MOV-2026-003, RMA-2026-003, GRN-2026-042
  operatorName: string;
  operatorRole: string;
  notes?: string;
  status: TransactionStatus;
  batchLot?: string;
  qcCondition?: ReturnQCCondition;
  driverName?: string;
  vehiclePlate?: string;
  shippingExpedition?: string;
  movementReason?: string;
  itemsList?: TransactionItemDetail[];
}

export interface WarehouseLocator {
  id: string; // Unique Locator ID
  warehouseCode: string; // 1. Kode Gudang (Mandatory)
  warehouseName?: string;
  rackOrFloorCode: string; // 2. Kode Rak/Floor (Mandatory)
  aisle?: string; // 3. Lorong
  level?: string; // 4. Level
  pallet?: string; // 5. Palet
  fullCode: string; // Format WMS terintegrasi (e.g. GDG01-RAK01-L01-LV1-P01)
  storageType: 'RACK' | 'FLOOR' | 'PALLET_BULK' | 'STAGING';
  maxCapacityUnits: number;
  temperatureType: 'AMBIENT' | 'AIR_CONDITIONED' | 'COLD_STORAGE' | 'HAZARDOUS';
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  notes?: string;
  createdAt: string;
  occupiedSku?: string;
  occupiedProductName?: string;
  occupiedStock?: number;
}

export interface WarehouseBin {
  id: string; // 'A-01-01-L1-B1'
  level: number;
  slot: string;
  capacityMax: number;
  currentUnits: number;
  occupiedSku?: string;
  occupiedProductName?: string;
  category?: string;
}

export interface WarehouseRack {
  id: string; // 'RACK-A01'
  zoneId: string;
  zoneName: string;
  aisle: string;
  rackNumber: string;
  x: number; // Coordinate for 2D visual layout map
  y: number;
  width: number;
  height: number;
  levelsCount: number; // 4
  slotsPerLevel: number; // 3
  totalCapacity: number;
  currentStock: number;
  bins: WarehouseBin[];
  temperatureType: 'AMBIENT' | 'AIR_CONDITIONED' | 'COLD_STORAGE' | 'HAZARDOUS';
}

export interface WarehouseZone {
  id: string; // 'A', 'B', 'C', 'D'
  name: string;
  description: string;
  color: string;
  accentBg: string;
  borderClass: string;
  racks: WarehouseRack[];
  maxCapacity: number;
  currentLoad: number;
  manager: string;
}

export interface AuditItemRecord {
  sku: string;
  productName: string;
  barcode: string;
  location: string;
  systemStock: number;
  physicalCount: number | null;
  variance: number;
  status: 'MATCHED' | 'DISCREPANCY' | 'PENDING';
  countedAt?: string;
  notes?: string;
}

export interface StockOpnameSession {
  id: string;
  title: string;
  zoneId?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';
  startedAt: string;
  completedAt?: string;
  auditorName: string;
  totalItems: number;
  countedItems: number;
  discrepancyCount: number;
  items: AuditItemRecord[];
  approvedBy?: string;
  approvalNotes?: string;
}

export interface AnalyticsSummary {
  totalSkus: number;
  totalUnits: number;
  totalCbm: number; // Total kubikasi seluruh stok (m³ / CBM)
  lowStockCount: number;
  outOfStockCount: number;
  occupancyRatePct: number;
  todayInboundUnits: number;
  todayOutboundUnits: number;
  totalCapacityUnits: number;
  fastMovingCount: number;
  slowMovingCount: number;
}
