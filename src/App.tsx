import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { InventoryTable } from './components/InventoryTable';
import { SKULocatorVisualizer } from './components/SKULocatorVisualizer';
import { InboundManager } from './components/InboundManager';
import { OutboundManager } from './components/OutboundManager';
import { MovementManager } from './components/MovementManager';
import { ReturnManager } from './components/ReturnManager';
import { TransactionLogs } from './components/TransactionLogs';
import { StockOpnameAudit } from './components/StockOpnameAudit';
import { AIWarehouseAdvisor } from './components/AIWarehouseAdvisor';
import { MasterDataOpbalUploader } from './components/MasterDataOpbalUploader';
import { ScanLine, Boxes, MapPin } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const { currentUser } = useAuth();
  const { setIsScannerOpen } = useInventory();

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-slate-300 flex flex-col font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* Top Application Header */}
      <Header onNavigateTab={setActiveTab} />

      {/* Main Split Body: Left Sidebar + Main Content Viewport */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0F1115]">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* View Switcher based on Active Tab */}
            {activeTab === 'dashboard' && (
              <AnalyticsDashboard onNavigateTab={setActiveTab} />
            )}

            {activeTab === 'upload-master' && (
              <MasterDataOpbalUploader onNavigateToTab={setActiveTab} />
            )}

            {activeTab === 'inventory' && (
              <InventoryTable onNavigateTab={setActiveTab} />
            )}

            {activeTab === 'locator' && (
              <SKULocatorVisualizer />
            )}

            {activeTab === 'inbound' && (
              <InboundManager />
            )}

            {activeTab === 'outbound' && (
              <OutboundManager />
            )}

            {activeTab === 'movement' && (
              <MovementManager />
            )}

            {activeTab === 'return' && (
              <ReturnManager />
            )}

            {activeTab === 'scanner' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <ScanLine className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Pusat Operasional Pemindai Barcode & QR
                      </h2>
                      <p className="text-xs text-slate-400">
                        Gunakan kamera perangkat atau pemindai laser optik untuk verifikasi stok masuk, keluar, dan relokasi rak
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4" /> Buka Kamera Pemindai Live
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-[#14161B] border border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-indigo-400" />
                      Prosedur Standar Pemindaian Inbound
                    </h3>
                    <ul className="text-xs text-slate-400 space-y-2 leading-relaxed list-disc list-inside">
                      <li>Pindai barcode pada kemasan fisik barang atau palet masuk.</li>
                      <li>Sistem otomatis mencocokkan SKU, kategori, dan batas stok.</li>
                      <li>Pilih aksi <strong className="text-emerald-400">Masuk (Inbound)</strong> dan masukkan jumlah kuantitas serta nomor PO.</li>
                      <li>Ikuti petunjuk <strong className="text-indigo-400">SKU Locator</strong> untuk menempatkan barang ke rak yang tepat.</li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-[#14161B] border border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-400" />
                      Prosedur Picking & Outbound
                    </h3>
                    <ul className="text-xs text-slate-400 space-y-2 leading-relaxed list-disc list-inside">
                      <li>Buka peta rak untuk melihat koordinat lokasi barang pesanan.</li>
                      <li>Ambil barang dari slot bin yang tertera (misal: A-01-01-L1-A1).</li>
                      <li>Pindai barcode barang untuk verifikasi kebenaran SKU sebelum dikemas.</li>
                      <li>Tekan <strong className="text-indigo-400">Keluar (Picking)</strong> untuk memperbarui inventaris secara real-time.</li>
                    </ul>
                  </div>
                </div>

                {/* Direct Trigger Button */}
                <div className="p-8 rounded-xl bg-[#14161B] border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="w-16 h-16 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 cursor-pointer"
                  >
                    <ScanLine className="w-8 h-8" />
                  </button>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Klik untuk Mengaktifkan Pemindai Barcode</h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-0.5">
                      Mendukung kamera smartphone, tablet, laptop webcam, serta input file gambar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <TransactionLogs />
            )}

            {activeTab === 'opname' && (
              <StockOpnameAudit />
            )}

            {activeTab === 'ai-advisor' && (
              <AIWarehouseAdvisor />
            )}

          </div>
        </main>
      </div>

      {/* Global Modals */}
      <LoginModal />
      <BarcodeScannerModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <MainLayout />
      </InventoryProvider>
    </AuthProvider>
  );
}
