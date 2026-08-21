// Format quantity with units and Indonesian thousands separator (titik untuk ribuan, contoh: 1.420 Unit)
export function formatQuantity(qty: number, unit: string = 'Unit'): string {
  if (isNaN(qty)) return `0 ${unit}`;
  return `${new Intl.NumberFormat('id-ID').format(Math.round(qty))} ${unit}`;
}

// Format numbers with Indonesian thousands separator (titik untuk ribuan, contoh: 1.420, 25.000)
export function formatNumber(num: number): string {
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('id-ID').format(num);
}

// Format decimal numbers with Indonesian comma for decimal & dot for thousands (contoh: 12,5)
export function formatDecimal(val: number, decimals: number = 2): string {
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

// Calculate CBM (Cubic Meters) from Length x Width x Height in cm
// CBM = (L * W * H) / 1,000,000
export function calculateCbm(lengthCm: number, widthCm: number, heightCm: number): number {
  if (!lengthCm || !widthCm || !heightCm || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
    return 0;
  }
  const cbm = (lengthCm * widthCm * heightCm) / 1000000;
  return Number(cbm.toFixed(4));
}

// Format CBM with Indonesian comma as decimal separator (koma untuk CBM / desimal, contoh: 0,045 m³, 18,452 m³)
export function formatCbm(cbm: number, decimals: number = 3): string {
  if (isNaN(cbm) || cbm === 0) {
    const zeros = '0'.repeat(decimals);
    return `0,${zeros} m³`;
  }
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cbm);
  return `${formatted} m³`;
}

// Format CBM value without unit suffix (contoh: 0,045)
export function formatCbmValue(cbm: number, decimals: number = 3): string {
  if (isNaN(cbm) || cbm === 0) {
    const zeros = '0'.repeat(decimals);
    return `0,${zeros}`;
  }
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cbm);
}

// Normalize barcode: if empty, undefined, null, or whitespace, returns '0'
export function normalizeBarcode(rawBarcode?: string | number | null): string {
  if (rawBarcode === undefined || rawBarcode === null) return '0';
  const str = String(rawBarcode).trim();
  return str === '' || str === 'null' || str === 'undefined' ? '0' : str;
}

// Calculate SKU Aging in days from last Inbound Date
export function calculateAgingDays(lastInboundDate?: string, fallbackDate?: string): number {
  const targetDateStr = lastInboundDate || fallbackDate;
  if (!targetDateStr) return 0;
  
  try {
    const targetTime = new Date(targetDateStr).getTime();
    if (isNaN(targetTime)) return 0;
    
    const nowTime = Date.now();
    const diffMs = nowTime - targetTime;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  } catch {
    return 0;
  }
}

// Visual status categorization for SKU Aging
export function getAgingStatus(days: number): {
  label: string;
  color: string;
  badgeClass: string;
  dotColor: string;
} {
  if (days <= 14) {
    return {
      label: 'Fresh Inbound',
      color: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      dotColor: 'bg-emerald-400',
    };
  }
  if (days <= 30) {
    return {
      label: 'Normal Flow',
      color: 'text-blue-400',
      badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      dotColor: 'bg-blue-400',
    };
  }
  if (days <= 60) {
    return {
      label: 'Moderate Aging',
      color: 'text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      dotColor: 'bg-amber-400',
    };
  }
  if (days <= 90) {
    return {
      label: 'Slow Moving',
      color: 'text-orange-400',
      badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
      dotColor: 'bg-orange-400',
    };
  }
  return {
    label: 'Critical Aging (>90d)',
    color: 'text-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    dotColor: 'bg-rose-400',
  };
}

// Play a pleasant scanner beep tone using Web Audio API
export function generateLocatorFullCode(parts: {
  warehouseCode: string;
  rackOrFloorCode: string;
  aisle?: string;
  level?: string;
  pallet?: string;
}): string {
  const cleanWh = (parts.warehouseCode || '').trim().toUpperCase();
  const cleanRack = (parts.rackOrFloorCode || '').trim().toUpperCase();
  const cleanAisle = (parts.aisle || '').trim().toUpperCase();
  const cleanLevel = (parts.level || '').trim().toUpperCase();
  const cleanPallet = (parts.pallet || '').trim().toUpperCase();

  const segments: string[] = [cleanWh, cleanRack];

  if (cleanAisle) {
    segments.push(cleanAisle.startsWith('L') ? cleanAisle : `L${cleanAisle}`);
  }
  if (cleanLevel) {
    segments.push(cleanLevel.startsWith('LV') || cleanLevel.startsWith('L') ? cleanLevel : `LV${cleanLevel}`);
  }
  if (cleanPallet) {
    segments.push(cleanPallet.startsWith('P') || cleanPallet.startsWith('PL') || cleanPallet.startsWith('B') ? cleanPallet : `P${cleanPallet}`);
  }

  return segments.filter(Boolean).join('-');
}

export function playBeepSound(type: 'success' | 'warning' | 'error' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6 note
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}
