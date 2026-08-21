import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ScanLine, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Volume2, 
  VolumeX, 
  Upload
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { playBeepSound } from '../utils/formatters';
import { InventoryItem } from '../types';

export const BarcodeScannerModal: React.FC = () => {
  const { isScannerOpen, setIsScannerOpen, items, getItemBySkuOrBarcode, recordMovement, locateSku } = useInventory();
  const { currentUser, hasPermission } = useAuth();

  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Quick Action Form states
  const [activeAction, setActiveAction] = useState<'VIEW' | 'INBOUND' | 'OUTBOUND' | 'TRANSFER'>('VIEW');
  const [actionQty, setActionQty] = useState<number>(1);
  const [actionNotes, setActionNotes] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Target Location for Transfer
  const [targetZone, setTargetZone] = useState('A');
  const [targetAisle, setTargetAisle] = useState('Lorong 01');
  const [targetRack, setTargetRack] = useState('Rak 01');
  const [targetLevel, setTargetLevel] = useState(1);
  const [targetSlot, setTargetSlot] = useState('A1');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isScannerOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedResult(null);
      setFoundItem(null);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);
    }
    return () => {
      stopCamera();
    };
  }, [isScannerOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}
      }

      const html5QrCode = new Html5Qrcode('barcode-reader-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.333334,
        },
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {}
      );
      setIsCameraActive(true);
    } catch (err: any) {
      setIsCameraActive(false);
      setCameraError('Kamera tidak aktif atau izin kamera belum diizinkan.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsCameraActive(false);
  };

  const handleBarcodeDetected = (code: string) => {
    if (!code) return;
    setScannedResult(code);
    if (soundEnabled) playBeepSound('success');

    const item = getItemBySkuOrBarcode(code);
    if (item) {
      setFoundItem(item);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);
      setActionQty(1);
    } else {
      setFoundItem(null);
      setActionErrorMsg(`Barcode/SKU "${code}" tidak ditemukan dalam database.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    try {
      const decodedText = await scannerRef.current.scanFile(file, true);
      handleBarcodeDetected(decodedText);
    } catch {
      setActionErrorMsg('Tidak dapat mendeteksi barcode dari gambar yang diunggah.');
    }
  };

  const handleExecuteAction = async () => {
    if (!foundItem) return;
    setIsSubmitting(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    let res;
    if (activeAction === 'INBOUND') {
      res = await recordMovement({
        type: 'INBOUND',
        sku: foundItem.sku,
        quantity: actionQty,
        notes: actionNotes || 'Barang masuk via Barcode Scanner',
      });
    } else if (activeAction === 'OUTBOUND') {
      res = await recordMovement({
        type: 'OUTBOUND',
        sku: foundItem.sku,
        quantity: actionQty,
        notes: actionNotes || 'Barang keluar / picking via Barcode Scanner',
      });
    } else if (activeAction === 'TRANSFER') {
      const newFullCode = `${targetZone}-${targetAisle.replace('Lorong ', '')}-${targetRack.replace('Rak ', '')}-L${targetLevel}-${targetSlot}`;
      res = await recordMovement({
        type: 'TRANSFER',
        sku: foundItem.sku,
        quantity: foundItem.stock,
        notes: actionNotes || 'Relokasi rak via Barcode Scanner',
        newLocation: {
          zoneId: targetZone,
          zoneName: `Zona ${targetZone}`,
          aisle: targetAisle,
          rack: targetRack,
          shelfLevel: targetLevel,
          binSlot: targetSlot,
          fullCode: newFullCode,
        },
      });
    }

    setIsSubmitting(false);

    if (res?.success) {
      setActionSuccessMsg(res.message);
      if (soundEnabled) playBeepSound('success');
      const updated = getItemBySkuOrBarcode(foundItem.sku);
      if (updated) setFoundItem(updated);
      setActiveAction('VIEW');
      setActionNotes('');
    } else {
      setActionErrorMsg(res?.message || 'Gagal mengeksekusi aksi.');
      if (soundEnabled) playBeepSound('error');
    }
  };

  if (!isScannerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Pemindai Barcode & QR Real-Time
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Arahkan kamera ke Barcode 1D (EAN-13, Code128) atau QR Code
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
                  : 'bg-[#0A0B0E] border-slate-800 text-slate-500'
              }`}
              title={soundEnabled ? 'Suara Scanner Aktif' : 'Suara Scanner Dibisukan'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsScannerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto flex-1">
          
          {/* Left Column: Live Camera Video Viewport */}
          <div className="lg:col-span-6 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between bg-[#0A0B0E]">
            <div>
              <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-[4/3] flex items-center justify-center shadow-inner group">
                
                {/* HTML5 Qrcode container */}
                <div id="barcode-reader-container" className="w-full h-full object-cover" />

                {/* Overlaid Target Laser Crosshair */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  <div className="w-64 h-40 border-2 border-dashed border-indigo-500/60 rounded-xl relative flex items-center justify-center">
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan-line shadow-[0_0_8px_#22d3ee]" />
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-300 mt-2 px-2.5 py-0.5 rounded bg-[#14161B] border border-slate-800">
                    Arahkan Barcode ke Kotak
                  </span>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-[#14161B]/95 flex flex-col items-center justify-center p-6 text-center z-10">
                    <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-xs text-slate-300 mb-3">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Coba Ulang Kamera
                    </button>
                  </div>
                )}
              </div>

              {/* Upload image controls */}
              <div className="flex items-center justify-between gap-2 mt-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#14161B] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" /> Upload Foto Barcode
                </button>
                <button
                  onClick={startCamera}
                  className="py-2 px-3 rounded-lg bg-[#14161B] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Refresh Kamera"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Quick Test Barcode Pills */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Simulasi Scan Barcode Demo:</span>
                <span className="text-[10px] text-indigo-400 font-normal">Klik untuk uji coba</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {items.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleBarcodeDetected(item.barcode)}
                    className="px-2.5 py-1 rounded bg-[#14161B] hover:border-indigo-500 border border-slate-800 text-[11px] font-mono text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{item.sku}</span>
                    <span className="text-slate-500">({item.barcode})</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Scanned SKU Result Card */}
          <div className="lg:col-span-6 p-4 sm:p-5 flex flex-col justify-between">
            {foundItem ? (
              <div className="space-y-4">
                
                {/* Result Top Pill */}
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-emerald-300">Barcode Teridentifikasi</div>
                      <div className="font-mono text-[11px] text-emerald-400/80">{scannedResult}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    foundItem.status === 'IN_STOCK' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    foundItem.status === 'LOW_STOCK' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {foundItem.status === 'IN_STOCK' ? 'Stok Aman' : foundItem.status === 'LOW_STOCK' ? 'Stok Menipis' : 'Stok Kosong'}
                  </span>
                </div>

                {/* Item Details Card */}
                <div className="p-4 rounded-xl bg-[#0A0B0E] border border-slate-800 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-600/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {foundItem.sku}
                      </span>
                      <span className="text-xs text-slate-500">
                        {foundItem.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-1">
                      {foundItem.name}
                    </h3>
                  </div>

                  {/* Stock and Value Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                    <div className="p-2 rounded-lg bg-[#14161B] border border-slate-800">
                      <div className="text-[10px] text-slate-500">Stok Saat Ini</div>
                      <div className="font-mono font-bold text-xs text-white mt-0.5">
                        {foundItem.stock} <span className="text-[10px] font-normal text-slate-500">{foundItem.unit}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#14161B] border border-slate-800">
                      <div className="text-[10px] text-slate-500">Safety Stock</div>
                      <div className="font-mono font-bold text-xs text-amber-400 mt-0.5">
                        {foundItem.minStock} <span className="text-[10px] font-normal text-slate-500">{foundItem.unit}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#14161B] border border-slate-800">
                      <div className="text-[10px] text-slate-500">Kapasitas Maks</div>
                      <div className="font-mono font-bold text-xs text-indigo-400 mt-0.5 truncate">
                        {foundItem.maxStock} <span className="text-[10px] font-normal text-slate-500">{foundItem.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Exact SKU Locator Coordinate Card */}
                  <div className="p-3 rounded-lg bg-[#14161B] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                          Koordinat Rak Gudang
                        </div>
                        <div className="font-mono text-xs font-bold text-emerald-400">
                          {foundItem.location.fullCode}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        locateSku(foundItem.sku);
                        setIsScannerOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Buka Peta</span> →
                    </button>
                  </div>
                </div>

                {/* Fast Movement Action Form */}
                <div className="p-4 rounded-xl bg-[#0A0B0E] border border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Aksi Cepat:</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      Operator: <span className="text-indigo-400">{currentUser.name}</span>
                    </span>
                  </div>

                  {/* Action Mode Tabs */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setActiveAction('INBOUND')}
                      disabled={!hasPermission('canInbound')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeAction === 'INBOUND'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#14161B] text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40'
                      }`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Inbound
                    </button>
                    <button
                      onClick={() => setActiveAction('OUTBOUND')}
                      disabled={!hasPermission('canOutbound')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeAction === 'OUTBOUND'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#14161B] text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" /> Outbound
                    </button>
                    <button
                      onClick={() => setActiveAction('TRANSFER')}
                      disabled={!hasPermission('canTransfer')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeAction === 'TRANSFER'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#14161B] text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40'
                      }`}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" /> Pindah Rak
                    </button>
                  </div>

                  {/* Form fields for Inbound / Outbound / Transfer */}
                  {activeAction !== 'VIEW' && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-800 animate-in fade-in">
                      {activeAction !== 'TRANSFER' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Jumlah ({foundItem.unit}):
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={actionQty}
                              onChange={(e) => setActionQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Catatan / No. PO:
                            </label>
                            <input
                              type="text"
                              placeholder={activeAction === 'INBOUND' ? 'cth: PO-2026-08' : 'cth: DO-2026-11'}
                              value={actionNotes}
                              onChange={(e) => setActionNotes(e.target.value)}
                              className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-medium text-slate-400">
                            Lokasi Rak Tujuan:
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            <select
                              value={targetZone}
                              onChange={(e) => setTargetZone(e.target.value)}
                              className="bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                            >
                              <option value="A">Zona A</option>
                              <option value="B">Zona B</option>
                              <option value="C">Zona C</option>
                              <option value="D">Zona D</option>
                            </select>
                            <select
                              value={targetAisle}
                              onChange={(e) => setTargetAisle(e.target.value)}
                              className="bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                            >
                              <option value="Lorong 01">Lorong 01</option>
                              <option value="Lorong 02">Lorong 02</option>
                            </select>
                            <select
                              value={targetRack}
                              onChange={(e) => setTargetRack(e.target.value)}
                              className="bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                            >
                              <option value="Rak 01">Rak 01</option>
                              <option value="Rak 02">Rak 02</option>
                              <option value="Rak 03">Rak 03</option>
                            </select>
                            <select
                              value={targetSlot}
                              onChange={(e) => setTargetSlot(e.target.value)}
                              className="bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                            >
                              <option value="A1">Slot A1</option>
                              <option value="A2">Slot A2</option>
                              <option value="B1">Slot B1</option>
                              <option value="B2">Slot B2</option>
                              <option value="C1">Slot C1</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Success / Error Banner */}
                      {actionSuccessMsg && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{actionSuccessMsg}</span>
                        </div>
                      )}
                      {actionErrorMsg && (
                        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{actionErrorMsg}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleExecuteAction}
                          disabled={isSubmitting}
                          className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSubmitting ? 'Memproses...' : 'Konfirmasi & Catat Transaksi'}
                        </button>
                        <button
                          onClick={() => setActiveAction('VIEW')}
                          className="py-2 px-3 rounded-lg bg-[#14161B] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              /* Empty state before scanning */
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 rounded-xl bg-[#0A0B0E] border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <ScanLine className="w-6 h-6 animate-pulse text-indigo-400" />
                </div>
                <h4 className="text-xs font-semibold text-slate-300 mb-1">
                  Menunggu Pemindaian Barcode...
                </h4>
                <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                  Arahkan barcode fisik ke kamera atau gunakan tombol simulasi barcode di sebelah kiri.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
