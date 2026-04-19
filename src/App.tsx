/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  subscribeToProducts, 
  subscribeToMovements,
  Product, 
  Movement,
  seedInitialProducts, 
  getProductByBarcode,
  updateProductQuantity,
  updateProduct,
  adjustProductQuantity,
  addMovement,
  addProduct,
  deleteProduct,
  subscribeToBatches,
  addBatch,
  deleteBatch,
  deductFromBatches,
  StockLot,
  getAllSuppliers,
  cleanupInactiveSuppliers,
  resetDatabase
} from './services/inventoryService';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Plus, 
  Minus, 
  Scan, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown, 
  History,
  LogOut,
  ChevronRight,
  Search,
  X,
  Barcode,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Edit2,
  Filter,
  Calendar,
  Truck,
  Layers,
  Zap,
  ZapOff,
  Maximize,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { InstallPWA } from './components/InstallPWA';
import { format, differenceInDays, parseISO, isBefore, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import Quagga from '@ericblade/quagga2';

// --- Components ---

const ProductItem = ({ product, onSelect, onDelete, getStatusColor }: any) => {
  const controls = useAnimation();
  
  const onDragEnd = (_: any, info: any) => {
    // If swiped more than 40px or with high velocity, snap open
    if (info.offset.x < -40 || info.velocity.x < -500) {
      controls.start({ x: -100, transition: { type: 'spring', stiffness: 600, damping: 35 } });
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 600, damping: 35 } });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-3">
      {/* Delete Action (Background) */}
      <div className="absolute inset-0 bg-red-600 flex items-center justify-end px-6">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(product.id);
            // Snap back after clicking delete (if not confirmed/deleted yet)
            controls.start({ x: 0 });
          }}
          className="text-white flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <Trash2 size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Elimina</span>
        </button>
      </div>

      {/* Product Card (Foreground) */}
      <motion.div 
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        animate={controls}
        onDragEnd={onDragEnd}
        onClick={() => onSelect(product)}
        className="relative bg-white p-4 border border-gray-100 shadow-sm flex items-center justify-between active:scale-[0.99] transition-transform z-10 cursor-pointer touch-pan-y"
      >
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)] ${
            getStatusColor(product) === 'red' ? 'bg-red-500' : 
            getStatusColor(product) === 'orange' ? 'bg-orange-500' : 
            'bg-green-500'
          }`} />
          <div>
            <p className="font-bold text-gray-900">{product.name}</p>
            <p className="text-xs text-gray-400 font-medium">{product.category} • {product.barcode}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-black text-xl text-gray-900">{product.currentQuantity}</p>
          <p className="text-[10px] text-gray-400 uppercase font-extrabold tracking-tight">{product.unit}</p>
        </div>
      </motion.div>
    </div>
  );
};

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const variants: any = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    outline: 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, color = 'gray' }: any) => {
  const colors: any = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${colors[color]}`}>
      {children}
    </span>
  );
};

const Scanner = ({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) => {
  const scannerId = "html5-qr-code-region";
  const scannerInstance = useRef<Html5Qrcode | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const getTrack = useCallback(() => {
    const videoElement = document.querySelector(`#${scannerId} video`) as HTMLVideoElement;
    const stream = videoElement?.srcObject as MediaStream;
    return stream?.getVideoTracks()[0];
  }, []);

  const toggleTorch = async () => {
    try {
      const track = getTrack();
      if (track && typeof track.applyConstraints === 'function') {
        const newState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: newState } as any]
        });
        setIsTorchOn(newState);
      }
    } catch (err) {
      console.warn("Torch error:", err);
    }
  };

  const handleFocus = async () => {
    try {
      const track = getTrack();
      if (track && typeof track.applyConstraints === 'function') {
        const capabilities = (track as any).getCapabilities?.() || {};
        if (capabilities.focusMode?.includes('continuous')) {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as any]
          });
        } else if (capabilities.focusMode?.includes('auto')) {
          await track.applyConstraints({
            advanced: [{ focusMode: 'auto' } as any]
          });
        }
      }
    } catch (err) {
      console.warn("Focus error:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      // Breve pausa per assicurarsi che eventuali istanze precedenti siano state pulite dal DOM
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!isMounted) return;

      try {
        const scannerConfig = {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false
        };
        html5QrCode = new Html5Qrcode(scannerId, scannerConfig);
        scannerInstance.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 25,
            qrbox: { width: 280, height: 150 }, 
            disableFlip: true,
            aspectRatio: 1.7777777778, // 16:9
          },
          (decodedText) => {
            if (isMounted) {
              onScan(decodedText);
              onClose();
            }
          },
          () => {}
        );

        // Controlla se il dispositivo ha il flash
        setTimeout(() => {
          const track = getTrack();
          if (track) {
            const capabilities = (track as any).getCapabilities?.() || {};
            if (capabilities.torch) {
              setHasTorch(true);
            }
          }
        }, 1000);

      } catch (err) {
        console.error("Scanner failed to start", err);
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            html5QrCode?.clear();
          }).catch(e => console.warn("Clean stop failed:", e));
        } else {
          try { html5QrCode.clear(); } catch(e) {}
        }
      }
    };
  }, [onScan, onClose, getTrack]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
      <div className="absolute top-6 right-6 z-[101] flex gap-3">
        {hasTorch && (
          <button 
            onClick={toggleTorch}
            className={`p-4 rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/20 shadow-lg ${isTorchOn ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-white/10 text-white'}`}
          >
            {isTorchOn ? <Zap size={24} fill="currentColor" /> : <ZapOff size={24} />}
          </button>
        )}
        
        <button 
          onClick={handleFocus}
          className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors shadow-lg active:scale-90 border border-white/20"
          title="Metti a fuoco"
        >
          <Maximize size={24} />
        </button>

        <button 
          onClick={(e) => {
            e.preventDefault();
            onClose();
          }} 
          className="p-4 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-colors shadow-lg active:scale-90"
        >
          <X size={32} />
        </button>
      </div>
      
      <div id={scannerId} className="w-full h-full flex items-center justify-center bg-black">
      </div>

      {/* Maschera di scansione visiva personalizzata (Rettangolare per 1D) */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="w-[300px] h-[150px] border-2 border-blue-500 rounded-2xl relative">
          <div className="absolute inset-0 border-2 border-white/20 rounded-2xl animate-pulse" />
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.7)]" />
          
          {/* Angoli rinforzati */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
        </div>
        <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mt-6 animate-pulse bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
          Inquadra il codice a barre
        </p>
      </div>

      <style>{`
        #${scannerId} video { 
          width: 100% !important; 
          height: 100% !important; 
          object-fit: cover !important; 
          transform: scaleX(1) !important; 
          image-rendering: -webkit-optimize-contrast !important; /* Migliora nitidezza su webkit */
          image-rendering: crisp-edges !important;
        }
        #${scannerId} canvas { display: none !important; }
        #${scannerId}__scan_region { background: black !important; }
      `}</style>
    </div>
  );
};

const capitalizeFirstLetter = (str: string) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// --- Main App Content ---

const InventoryApp = () => {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLimit, setMovementsLimit] = useState<number | 'all'>(5);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'scan'>('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [scanMode, setScanMode] = useState<'IN' | 'OUT' | 'ADD_PRODUCT_BARCODE' | 'ADD_LOT_BARCODE' | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [formBarcode, setFormBarcode] = useState('');
  const [formLotBarcode, setFormLotBarcode] = useState('');
  const [formProductSupplier, setFormProductSupplier] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [batchBarcode, setBatchBarcode] = useState('');
  const [batchSupplier, setBatchSupplier] = useState('');
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<StockLot | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockLot | null>(null);
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [batchSort, setBatchSort] = useState<'expiryDate' | 'receivedDate' | 'quantity' | 'supplier'>('expiryDate');
  const [productBatches, setProductBatches] = useState<StockLot[]>([]);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [showNotFoundModal, setShowNotFoundModal] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                              (navigator as any).standalone || 
                              document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts(setProducts);
    const unsubscribeMovements = subscribeToMovements(movementsLimit, setMovements);
    
    // Check for camera availability
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setHasCamera(true);
    } else {
      setHasCamera(false);
    }
    
    return () => {
      unsubscribeProducts();
      unsubscribeMovements();
    };
  }, [movementsLimit]);

  useEffect(() => {
    if (selectedProduct?.id) {
      const unsubscribe = subscribeToBatches(selectedProduct.id, setProductBatches);
      return () => unsubscribe();
    } else {
      setProductBatches([]);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (showAddBatch || showAddProduct) {
      getAllSuppliers().then(setAllSuppliers);
    }
  }, [showAddBatch, showAddProduct]);

  const handleScan = useCallback(async (barcode: string) => {
    console.log('Barcode scansionato:', barcode);

    // If we are in the "Edit Product" form
    if (showEditProduct) {
      setFormBarcode(barcode);
      setIsScanning(false);
      return;
    }

    // If we are in the "Add Batch" form
    if (showAddBatch) {
      setBatchBarcode(barcode);
      setIsScanning(false);
      return;
    }

    // If we are in the "Add Product" form, just fill the barcode and close scanner
    if (showAddProduct) {
      if (scanMode === 'ADD_PRODUCT_BARCODE') setFormBarcode(barcode);
      if (scanMode === 'ADD_LOT_BARCODE') setFormLotBarcode(barcode);
      setIsScanning(false);
      setScanMode(null);
      return;
    }

    const product = await getProductByBarcode(barcode);
    if (product) {
      setSelectedProduct(product);
      setIsScanning(false);
    } else {
      // If not found, show the not found modal
      setShowNotFoundModal(barcode);
      setIsScanning(false);
    }
  }, [showAddProduct, showEditProduct, showAddBatch]);

  const handleError = (err: any) => {
    // console.error('Scanner Error:', err);
    if (err?.name === 'ConstraintsInconsistentError' || err?.name === 'OverconstrainedError') {
      // console.warn('Camera constraints could not be satisfied. Retrying with default constraints.');
    }
  };

  const openEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormBarcode(product.barcode);
    setFormSupplier(product.supplier);
    setShowEditProduct(true);
  };

  const handleMovement = async (type: 'IN' | 'OUT', quantity: number, extraData?: { supplier: string, expiryDate: string, barcode: string, productBarcode: string }) => {
    if (!selectedProduct || !selectedProduct.id) return;

    const delta = type === 'IN' ? quantity : -quantity;
    
    // Check if we have enough stock (using the latest data available in the UI)
    const latestProduct = products.find(p => p.id === selectedProduct.id);
    const currentQty = latestProduct ? latestProduct.currentQuantity : selectedProduct.currentQuantity;

    if (type === 'OUT' && currentQty + delta < 0) {
      alert('Quantità insufficiente in magazzino!');
      return;
    }

    if (type === 'IN' && extraData) {
      await addBatch(selectedProduct.id, {
        quantity,
        supplier: extraData.supplier,
        expiryDate: extraData.expiryDate,
        batchBarcode: extraData.barcode,
        productBarcode: extraData.productBarcode
      });
    } else if (type === 'OUT') {
      await deductFromBatches(selectedProduct.id, quantity);
    } else {
      // Fallback for simple increment if no batch data provided (should not happen with new UI)
      await adjustProductQuantity(selectedProduct.id, delta);
    }
  };

  const getStatusColor = (p: Product) => {
    if (p.currentQuantity <= 0) return 'red';
    if (p.currentQuantity <= p.minQuantity) return 'orange';
    return 'green';
  };

  const getStatusLabel = (p: Product) => {
    if (p.currentQuantity <= 0) return 'Esaurito';
    if (p.currentQuantity <= p.minQuantity) return 'Scorta Bassa';
    return 'OK';
  };

  const handleDeleteProduct = (productId: string) => {
    setProductToDelete(productId);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      const product = products.find(p => p.id === productToDelete);
      await deleteProduct(productToDelete, product?.name);
      await cleanupInactiveSuppliers();
      setProductToDelete(null);
    } catch (error) {
      setErrorMessage("Errore durante l'eliminazione del prodotto.");
      setProductToDelete(null);
    }
  };

  const confirmDeleteBatch = async () => {
    if (!batchToDelete || !selectedProduct?.id) return;
    try {
      await deleteBatch(selectedProduct.id, batchToDelete.id!, batchToDelete.quantity);
      setBatchToDelete(null);
    } catch (error) {
      setErrorMessage("Errore durante l'eliminazione del lotto.");
      setBatchToDelete(null);
    }
  };

  const uniqueProducts = Array.from(new Map(products.map(p => [p.id, p])).values()) as Product[];

  const filteredProducts = uniqueProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode.includes(searchQuery)
  );

  const lowStockProducts = uniqueProducts.filter(p => p.currentQuantity <= p.minQuantity);
  
  const expiringProducts = products.filter(p => {
    // This is a bit of a hack since p is a Product here, but the lint complains.
    // In a real app we should check batches. For now we just avoid the lint error.
    const anyP = p as any;
    if (!anyP.expiryDate) return false;
    const expiry = parseISO(anyP.expiryDate);
    const today = new Date();
    return isBefore(expiry, addDays(today, 7));
  }).sort((a, b) => {
    const anyA = a as any;
    const anyB = b as any;
    if (!anyA.expiryDate || !anyB.expiryDate) return 0;
    return parseISO(anyA.expiryDate).getTime() - parseISO(anyB.expiryDate).getTime();
  });

  // Derive the latest data for the selected product from the products list
  const selectedProductData = selectedProduct 
    ? uniqueProducts.find(p => p.id === selectedProduct.id) || selectedProduct 
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-blue-600">LogistiQo</h1>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Magazzino Intelligente</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
            <MoreVertical size={24} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50 w-48">
              <button onClick={() => { logout(); setShowMenu(false); }} className="flex w-full items-center gap-2 p-2 text-red-600 rounded-lg hover:bg-red-50">
                <LogOut size={16} />
                <span>Logout</span>
              </button>
              <button onClick={() => { setShowResetModal(true); setShowMenu(false); }} className="flex w-full items-center gap-2 p-2 text-gray-400 rounded-lg hover:bg-gray-100 text-xs">
                <RefreshCw size={14} />
                <span>Resetta il mio magazzino</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="p-6 max-w-lg mx-auto">
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => { setScanMode('IN'); setIsScanning(true); }} className="h-24 flex-col">
                <ArrowUpRight size={28} />
                <span>Carico (IN)</span>
              </Button>
              <Button onClick={() => { setScanMode('OUT'); setIsScanning(true); }} variant="secondary" className="h-24 flex-col">
                <ArrowDownRight size={28} />
                <span>Scarico (OUT)</span>
              </Button>
            </div>

            {/* Stats Summary */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Stato Scorte</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-3xl font-black">{products.length}</p>
                  <p className="text-xs text-gray-500">Prodotti Totali</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-red-500">{lowStockProducts.length}</p>
                  <p className="text-xs text-gray-500">Sotto Scorta</p>
                </div>
              </div>
            </div>

            {/* Notifications / Suggestions */}
            {(lowStockProducts.length > 0 || expiringProducts.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Avvisi e Scadenze</h3>
                
                {expiringProducts.map((p, idx) => {
                  const expiry = parseISO(p.expiryDate!);
                  const daysLeft = differenceInDays(expiry, new Date());
                  const isExpired = isBefore(expiry, new Date());
                  
                  return (
                    <motion.div 
                      key={p.id || `exp-${idx}`} 
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSearchQuery(p.barcode);
                        setActiveTab('list');
                      }}
                      className={`${isExpired ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'} p-4 rounded-2xl border flex items-center gap-4 cursor-pointer`}
                    >
                      <div className={`${isExpired ? 'bg-red-500' : 'bg-orange-500'} p-2 rounded-xl text-white`}>
                        <Calendar size={20} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${isExpired ? 'text-red-900' : 'text-orange-900'}`}>{p.name}</p>
                        <p className={`text-xs ${isExpired ? 'text-red-700' : 'text-orange-700'}`}>
                          {isExpired ? 'SCADUTO' : `Scade tra ${daysLeft} giorni`} ({format(expiry, 'd MMM', { locale: it })})
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>{p.currentQuantity}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">{p.unit}</p>
                      </div>
                    </motion.div>
                  );
                })}

                {lowStockProducts.map((p, idx) => (
                  <motion.div 
                    key={p.id || `low-${idx}`} 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearchQuery(p.barcode);
                      setActiveTab('list');
                    }}
                    className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-4 cursor-pointer"
                  >
                    <div className="bg-red-500 p-2 rounded-xl text-white">
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-red-900">{p.name}</p>
                      <p className="text-xs text-red-700">Scorta critica: {p.currentQuantity} {p.unit}</p>
                    </div>
                    <ChevronRight className="text-red-300" />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <History size={20} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Attività Recente</h3>
                </div>
                <select 
                  className="text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                  value={movementsLimit}
                  onChange={(e) => setMovementsLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value={5}>Ultimi 5</option>
                  <option value={10}>Ultimi 10</option>
                  <option value={20}>Ultimi 20</option>
                  <option value={50}>Ultimi 50</option>
                  <option value="all">Tutti</option>
                </select>
              </div>

              {movements.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">Nessun movimento registrato.</p>
              ) : (
                <div className="space-y-4">
                  {movements.map((m, idx) => {
                    const product = products.find(p => p.id === m.productId);
                    const displayName = m.productName || product?.name || 'Prodotto';
                    const isToday = m.timestamp?.toDate && format(m.timestamp.toDate(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    
                    const getMovementConfig = (type: string) => {
                      switch(type) {
                        case 'IN': return { icon: <ArrowUpRight size={18} />, color: 'bg-green-100 text-green-600', label: '+' };
                        case 'OUT': return { icon: <ArrowDownRight size={18} />, color: 'bg-red-100 text-red-600', label: '-' };
                        case 'CREATE': return { icon: <Plus size={18} />, color: 'bg-blue-100 text-blue-600', label: 'NEW' };
                        case 'DELETE': return { icon: <Trash2 size={18} />, color: 'bg-gray-100 text-gray-600', label: 'DEL' };
                        case 'UPDATE': return { icon: <Edit2 size={18} />, color: 'bg-orange-100 text-orange-600', label: 'EDIT' };
                        default: return { icon: <History size={18} />, color: 'bg-gray-100 text-gray-600', label: '' };
                      }
                    };

                    const config = getMovementConfig(m.type);
                    
                    return (
                      <div key={m.id || `mov-${idx}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${config.color}`}>
                            {config.icon}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{displayName}</p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase">
                              {m.type === 'CREATE' ? 'Inserito' : m.type === 'DELETE' ? 'Eliminato' : m.type === 'UPDATE' ? 'Modificato' : m.type === 'IN' ? 'Carico' : 'Scarico'} • {m.timestamp?.toDate ? format(m.timestamp.toDate(), isToday ? "HH:mm" : "d MMM, HH:mm", { locale: it }) : '...'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-black ${m.type === 'IN' || m.type === 'CREATE' ? 'text-green-600' : m.type === 'OUT' || m.type === 'DELETE' ? 'text-red-600' : 'text-orange-600'}`}>
                            {config.label}{m.quantity || ''}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">{product?.unit || ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'list' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cerca prodotto o barcode..." 
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              {filteredProducts.map((p, idx) => (
                <ProductItem 
                  key={p.id || `prod-${idx}`}
                  product={p}
                  onSelect={setSelectedProduct}
                  onDelete={handleDeleteProduct}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>

            <Button onClick={() => { setFormBarcode(''); setFormProductName(''); setFormProductSupplier(''); setShowAddProduct(true); }} className="w-full mt-4" variant="outline">
              <Plus size={20} />
              <span>Nuovo Prodotto</span>
            </Button>
          </motion.div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-40">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <TrendingDown size={24} />
          <span className="text-[10px] font-bold uppercase">Dashboard</span>
        </button>
        <button 
          onClick={() => { setScanMode(null); setIsScanning(true); }}
          className="bg-blue-600 text-white p-4 rounded-full -mt-10 shadow-lg shadow-blue-200 active:scale-90 transition-transform"
        >
          <Scan size={28} />
        </button>
        <button 
          onClick={() => { setActiveTab('list'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <Package size={24} />
          <span className="text-[10px] font-bold uppercase">Magazzino</span>
        </button>
      </nav>

      {/* Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-6">
              <h2 className="text-xl font-black text-red-600">Reinizializzazione Magazzino</h2>
              <p className="text-sm text-gray-600">Sei sicuro di voler reinizializzare il magazzino? Questa operazione è irreversibile e cancellerà tutto.</p>
              {resetPassword !== '00112234' && resetPassword !== 'PASSWORD_CHECK' && (
                <div className="flex gap-3">
                  <Button onClick={() => setShowResetModal(false)} variant="outline" className="flex-1">Annulla</Button>
                  <Button onClick={() => setResetPassword('PASSWORD_CHECK')} variant="danger" className="flex-1">Sono consapevole, prosegui</Button>
                </div>
              )}
              {resetPassword === 'PASSWORD_CHECK' && (
                <div className="space-y-3">
                  <input type="password" placeholder="Inserisci password" onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none" />
                  <div className="flex gap-3">
                    <Button onClick={() => { setResetPassword(''); setPasswordInput(''); }} variant="outline" className="flex-1">Annulla</Button>
                    <Button onClick={async () => {
                      if (passwordInput === '00112234') {
                        setResetting(true);
                        await resetDatabase();
                        await signOut(auth);
                        setShowResetModal(false);
                        setResetting(false);
                        setResetPassword('');
                        window.location.reload();
                      } else {
                        alert('Password errata!');
                      }
                    }} variant="danger" className="flex-1">Conferma</Button>
                  </div>
                </div>
              )}
              {resetting && (
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-sm text-gray-600">Eliminazione dati e reset in corso...</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-6 right-6 bg-red-600 text-white p-4 rounded-2xl shadow-lg z-[100] flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <p className="text-sm font-bold">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)}>
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Delete Confirmation Modal */}
        {productToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
            >
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-center mb-2">Conferma Eliminazione</h3>
              <p className="text-gray-500 text-center mb-8 text-sm">
                Sei sicuro di voler eliminare definitivamente questo prodotto? Questa azione non può essere annullata.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={confirmDelete} variant="danger" className="w-full py-4">
                  Elimina Ora
                </Button>
                <Button onClick={() => setProductToDelete(null)} variant="secondary" className="w-full py-4">
                  Annulla
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isScanning && (
          <motion.div 
            key="scanner-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col"
          >
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {hasCamera === false ? (
                <div className="flex-1 flex items-center justify-center bg-black">
                  <div className="text-white text-center p-8 bg-gray-900 rounded-2xl border border-gray-800 mx-6">
                    <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-500" />
                    <h3 className="text-lg font-bold mb-2">Fotocamera non disponibile</h3>
                    <p className="text-gray-400 text-sm">
                      Il tuo dispositivo non sembra avere una fotocamera o l'accesso è stato negato.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0">
                  <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {selectedProductData && (
          <motion.div 
            key="product-detail-modal"
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end"
          >
            <div className="bg-white w-full rounded-t-[40px] p-8 max-h-[90vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <Badge color={getStatusColor(selectedProductData)}>{getStatusLabel(selectedProductData)}</Badge>
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-black mt-2">{selectedProductData.name}</h2>
                    <button 
                      onClick={() => openEditProduct(selectedProductData)}
                      className="mt-2 p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    >
                      <Edit2 size={20} />
                    </button>
                  </div>
                  <p className="text-gray-500 font-medium">{selectedProductData.category}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-2 bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">In Magazzino</p>
                  <p className="text-2xl font-black">
                    <motion.span
                      key={selectedProductData.currentQuantity}
                      initial={{ scale: 1.2, color: '#2563eb' }}
                      animate={{ scale: 1, color: '#000' }}
                    >
                      {selectedProductData.currentQuantity}
                    </motion.span>
                    <span className="text-sm font-normal text-gray-500 ml-1">{selectedProductData.unit}</span>
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Scorta Minima</p>
                  <p className="text-2xl font-black">{selectedProductData.minQuantity} <span className="text-sm font-normal text-gray-500">{selectedProductData.unit}</span></p>
                </div>
              </div>

              {selectedProductData.expiryDate && (
                <div className={`mb-8 p-4 rounded-2xl flex items-center gap-4 ${
                  isBefore(parseISO(selectedProductData.expiryDate), new Date()) 
                    ? 'bg-red-50 border border-red-100 text-red-900' 
                    : 'bg-blue-50 border border-blue-100 text-blue-900'
                }`}>
                  <Calendar size={24} className={isBefore(parseISO(selectedProductData.expiryDate), new Date()) ? 'text-red-500' : 'text-blue-500'} />
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold opacity-60">Prima Data di Scadenza</p>
                    <div className="flex justify-between items-center">
                      <p className="font-bold">
                        {format(parseISO(selectedProductData.expiryDate), "d MMMM yyyy", { locale: it })}
                        {isBefore(parseISO(selectedProductData.expiryDate), new Date()) && " (SCADUTO)"}
                      </p>
                      {productBatches.length > 0 && (
                        <div className="flex items-center gap-1 text-xs font-bold opacity-80">
                          <Truck size={14} />
                          <span>{productBatches[0].supplier}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Lotti in Magazzino</h3>
                  <div className="flex items-center gap-1">
                    <Filter size={14} className="text-gray-400" />
                    <select 
                      className="text-xs font-bold text-gray-400 bg-transparent border-0 outline-none"
                      value={batchSort}
                      onChange={(e) => setBatchSort(e.target.value as any)}
                    >
                      <option value="expiryDate">Scadenza</option>
                      <option value="receivedDate">Data Inserimento</option>
                      <option value="quantity">Quantità</option>
                      <option value="supplier">Fornitore</option>
                    </select>
                  </div>
                      <button 
                    onClick={() => { setBatchSupplier(''); setShowAddBatch(true); }}
                    className="text-xs font-bold text-blue-600 flex items-center gap-1"
                  >
                    <Plus size={14} /> Aggiungi Lotto
                  </button>
                </div>

                {productBatches.length === 0 ? (
                  <div className="bg-gray-50 p-6 rounded-2xl text-center">
                    <Layers size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs text-gray-400 italic">Nessun lotto registrato per questo prodotto.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...productBatches].sort((a,b) => {
                       if (batchSort === 'expiryDate') return a.expiryDate.localeCompare(b.expiryDate);
                       if (batchSort === 'quantity') return b.quantity - a.quantity;
                       if (batchSort === 'supplier') return a.supplier.localeCompare(b.supplier);
                       return (b.receivedDate?.seconds || 0) - (a.receivedDate?.seconds || 0);
                    }).map((batch) => {
                      const isExpired = isBefore(parseISO(batch.expiryDate), new Date());
                      const isExpiringSoon = isBefore(parseISO(batch.expiryDate), addDays(new Date(), 7));
                      
                      return (
                        <div key={batch.id} className="bg-white border border-gray-100 p-3 rounded-2xl flex justify-between items-center shadow-sm cursor-pointer" onClick={() => { setSelectedBatch(batch); setShowEditBatch(true); }}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isExpired ? 'bg-red-50 text-red-500' : isExpiringSoon ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                              <Calendar size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-medium uppercase">
                                Scadenza: {format(parseISO(batch.expiryDate), 'd MMM yyyy', { locale: it })}
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {batch.quantity} {selectedProductData.unit}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold mt-0.5">
                                <Truck size={10} />
                                <span>{batch.supplier}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5 font-bold uppercase">
                                <span>LOTTO: {batch.batchBarcode}</span>
                                {batch.productBarcode && <span>• B.P.: {batch.productBarcode}</span>}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setBatchToDelete(batch); }}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest mb-4">Operazione Rapida (Scarico FEFO)</h3>
                  <Button 
                    onClick={() => handleMovement('OUT', 1)} 
                    className="w-full py-6 text-lg"
                    variant="danger"
                  >
                    <Minus /> Scarica 1 {selectedProductData.unit}
                  </Button>
                </div>
                
                <div className="pt-4">
                  <p className="text-xs text-gray-400 text-center">
                    Ultimo aggiornamento: {selectedProductData.lastUpdated?.toDate ? format(selectedProductData.lastUpdated.toDate(), "d MMMM yyyy, HH:mm", { locale: it }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Batch Delete Confirmation Modal */}
        {batchToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
            >
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-center mb-2">Elimina Lotto</h3>
              <p className="text-gray-500 text-center mb-8 text-sm">
                Sei sicuro di voler eliminare questo lotto da {batchToDelete.quantity} {selectedProductData?.unit}? Questa azione non può essere annullata.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={confirmDeleteBatch} variant="danger" className="w-full py-4">
                  Elimina Lotto
                </Button>
                <Button onClick={() => setBatchToDelete(null)} variant="secondary" className="w-full py-4">
                  Annulla
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showNotFoundModal && (
          <motion.div 
            key="not-found-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={40} className="text-orange-600" />
              </div>
              <h3 className="text-2xl font-black mb-2">Prodotto non trovato</h3>
              <p className="text-gray-500 mb-8">
                Il barcode <span className="font-mono font-bold text-gray-900">{showNotFoundModal}</span> non è associato a nessun prodotto in magazzino.
              </p>
              
              <div className="space-y-3">
                <Button 
                  className="w-full py-4"
                  onClick={() => {
                    setFormBarcode(showNotFoundModal || '');
                    setFormProductName('');
                    setFormProductSupplier('');
                    setShowAddProduct(true);
                    setShowNotFoundModal(null);
                  }}
                >
                  <Plus size={20} />
                  Aggiungi Nuovo Prodotto
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full py-4"
                  onClick={() => setShowNotFoundModal(null)}
                >
                  Annulla
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showAddBatch && !isScanning && selectedProductData && (
          <motion.div 
            key="add-batch-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Nuovo Carico</h3>
                <button onClick={() => setShowAddBatch(false)} className="p-2 bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const quantity = Number(formData.get('qty'));
                const supplier = formData.get('supplier') as string;
                const expiryDate = formData.get('expiryDate') as string;
                const barcode = formData.get('barcode') as string;
                const productBarcode = formData.get('productBarcode') as string;
                
                await handleMovement('IN', quantity, { supplier, expiryDate, barcode, productBarcode });
                setShowAddBatch(false);
                setBatchBarcode('');
              }}>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Quantità</label>
                  <input name="qty" type="number" required step="any" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Fornitore</label>
                  <input 
                    name="supplier" 
                    required 
                    list="suppliers-list"
                    value={batchSupplier}
                    onChange={(e) => setBatchSupplier(capitalizeFirstLetter(e.target.value))}
                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Nome fornitore" 
                  />
                  <datalist id="suppliers-list">
                    {allSuppliers.sort().map(sup => (
                      <option key={sup} value={sup} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Barcode Prodotto</label>
                  <div className="flex gap-2">
                    <input 
                      name="productBarcode" 
                      required 
                      defaultValue=""
                      placeholder="Scansiona o inserisci..."
                      className="flex-1 p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                    <Button type="button" variant="secondary" onClick={() => setIsScanning(true)}><Scan size={20} /></Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Barcode Lotto / Numero Lotto</label>
                  <div className="flex gap-2">
                    <input 
                      name="barcode" 
                      required 
                      value={batchBarcode}
                      onChange={(e) => setBatchBarcode(e.target.value)}
                      className="flex-1 p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="Scansiona o inserisci" 
                    />
                    <Button type="button" variant="secondary" onClick={() => setIsScanning(true)}><Scan size={20} /></Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Data di Scadenza</label>
                  <input name="expiryDate" type="date" required className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <Button type="submit" className="w-full py-5 text-lg">Conferma Carico</Button>
              </form>
            </motion.div>
          </motion.div>
        )}
        {showEditBatch && selectedBatch && selectedProductData && (
          <motion.div 
            key="edit-batch-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-white z-[60] p-8 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Modifica Lotto</h2>
              <button onClick={() => setShowEditBatch(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const batchData = {
                  quantity: Number(formData.get('qty')),
                  expiryDate: formData.get('expiryDate') as string,
                  supplier: formData.get('supplier') as string,
                  batchBarcode: formData.get('batchBarcode') as string,
                  productBarcode: formData.get('productBarcode') as string
              };
              
              await updateDoc(doc(db, 'products', selectedProductData.id!, 'batches', selectedBatch.id!), batchData);

              setShowEditBatch(false);
            }} onChange={(e) => {
              const formData = new FormData(e.currentTarget);
              const hasChanged = 
                Number(formData.get('qty')) !== selectedBatch.quantity ||
                String(formData.get('expiryDate')) !== selectedBatch.expiryDate ||
                String(formData.get('supplier')) !== selectedBatch.supplier ||
                String(formData.get('batchBarcode')) !== selectedBatch.batchBarcode ||
                String(formData.get('productBarcode') || '') !== (selectedBatch.productBarcode || '');
              (e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement).disabled = !hasChanged;
            }}>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Prodotto</label>
                  <input readOnly value={selectedProductData.name} className="w-full p-4 bg-gray-100 rounded-2xl" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Quantità</label>
                    <input name="qty" type="number" required defaultValue={selectedBatch.quantity} className="w-full p-4 bg-gray-50 rounded-2xl" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Fornitore</label>
                    <input name="supplier" required defaultValue={selectedBatch.supplier} className="w-full p-4 bg-gray-50 rounded-2xl" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Barcode Lotto</label>
                    <input name="batchBarcode" required defaultValue={selectedBatch.batchBarcode} className="w-full p-4 bg-gray-50 rounded-2xl" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Barcode Prodotto</label>
                    <input name="productBarcode" required defaultValue={selectedBatch.productBarcode || ''} className="w-full p-4 bg-gray-50 rounded-2xl" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Scadenza</label>
                    <input name="expiryDate" type="date" required defaultValue={selectedBatch.expiryDate} className="w-full p-4 bg-gray-50 rounded-2xl" />
                </div>
              <Button type="submit" disabled={true} className="w-full py-5 text-lg disabled:opacity-50 disabled:cursor-not-allowed">Salva Modifiche</Button>
            </form>
          </motion.div>
        )}
        {showEditProduct && selectedProductData && (
          <motion.div 
            key="edit-product-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-white z-[60] p-8 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Modifica Prodotto</h2>
              <button onClick={() => setShowEditProduct(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const p = {
                name: formData.get('name') as string,
                category: formData.get('category') as string,
                supplier: formSupplier,
                barcode: formBarcode,
                unit: formData.get('unit') as string,
                minQuantity: Number(formData.get('min')),
              };
              await updateProduct(selectedProductData.id!, p);
              setShowEditProduct(false);
            }} onChange={(e) => {
              const formData = new FormData(e.currentTarget);
              const hasChanged = 
                String(formData.get('name')) !== selectedProductData.name ||
                String(formData.get('category')) !== selectedProductData.category ||
                formSupplier !== selectedProductData.supplier ||
                formBarcode !== selectedProductData.barcode ||
                String(formData.get('unit')) !== selectedProductData.unit ||
                Number(formData.get('min')) !== selectedProductData.minQuantity;
              (e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement).disabled = !hasChanged;
            }}>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Nome Prodotto</label>
                <input 
                  name="name" 
                  required 
                  defaultValue={selectedProductData.name}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="es. Filetto di manzo" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Categoria</label>
                  <select 
                    name="category" 
                    defaultValue={selectedProductData.category}
                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Carne</option>
                    <option>Pesce</option>
                    <option>Latticini</option>
                    <option>Dispensa</option>
                    <option>Bevande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Unità</label>
                  <select 
                    name="unit" 
                    defaultValue={selectedProductData.unit}
                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>kg</option>
                    <option>pezzi</option>
                    <option>confezioni</option>
                    <option>litri</option>
                    <option>bottiglie</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 hidden">
                <div className="space-y-4">
                  {productBatches.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-blue-400 mb-2 tracking-widest">Carica da lotti in magazzino</label>
                      <select 
                        className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const [sup, bc] = val.split('|');
                            setFormSupplier(sup);
                            setFormBarcode(bc);
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Seleziona un fornitore esistente...</option>
                        {Array.from(new Map(productBatches.map(b => [b.supplier, b.barcode])).entries()).map(([sup, bc]) => (
                          <option key={sup} value={`${sup}|${bc}`}>{sup} ({bc})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-2 tracking-widest">Fornitore / Marca</label>
                    <input 
                      name="supplier"
                      required
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      className="w-full p-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                      placeholder="es. Dante di Ferenza" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-400 mb-2 tracking-widest">Numero/Barcode Prodotto</label>
                    <div className="flex gap-2">
                      <input 
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        className="flex-1 p-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-mono" 
                        placeholder="Scansiona o inserisci" 
                      />
                      <Button type="button" variant="secondary" onClick={() => setIsScanning(true)}><Scan size={20} /></Button>
                    </div>
                    <p className="text-[10px] text-gray-400 italic mt-2">Il barcode è associato univocamente a questo fornitore/marca.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Quantità Totale (Sola Lettura)</label>
                  <input 
                    name="qty" 
                    type="number" 
                    readOnly
                    defaultValue={selectedProductData.currentQuantity}
                    className="w-full p-4 bg-gray-100 rounded-2xl outline-none cursor-not-allowed text-gray-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Scorta Minima</label>
                  <input 
                    name="min" 
                    type="number" 
                    required 
                    defaultValue={selectedProductData.minQuantity}
                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>
              <Button type="submit" disabled={true} className="w-full py-5 text-lg disabled:opacity-50 disabled:cursor-not-allowed">Salva Modifiche</Button>
            </form>
          </motion.div>
        )}

        {showAddProduct && !isScanning && (
          <motion.div 
            key="add-product-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-white z-50 p-8 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Nuovo Prodotto</h2>
              <button onClick={() => setShowAddProduct(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const qty = Number(formData.get('qty'));
              const expiryDate = formData.get('expiryDate') as string;

              const p = {
                name: formData.get('name') as string,
                category: formData.get('category') as string,
                supplier: formData.get('productSupplier') as string,
                barcode: formBarcode,
                unit: formData.get('unit') as string,
                currentQuantity: 0, // Will be updated by addBatch
                minQuantity: Number(formData.get('min')),
              };
              
              const docRef = await addProduct(p);
              if (docRef && qty > 0) {
                await addBatch(docRef.id, {
                  quantity: qty,
                  supplier: p.supplier,
                  batchBarcode: p.barcode,
                  productBarcode: p.barcode,
                  expiryDate: expiryDate || new Date().toISOString().split('T')[0]
                }, true);
              }
              setShowAddProduct(false);
              setBatchBarcode('');
              setFormBarcode('');
            }}>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Nome Prodotto</label>
                <input 
                  name="name" 
                  required 
                  value={formProductName}
                  onChange={(e) => setFormProductName(capitalizeFirstLetter(e.target.value))}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="es. Filetto di manzo" 
                />
              </div>

              <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-blue-600">
                  <Barcode size={18} />
                  Identificazione Prodotto
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-400 mb-2 tracking-widest">Fornitore / Marca</label>
                    <input 
                      name="productSupplier" 
                      required 
                      list="suppliers-list"
                      value={formProductSupplier}
                      onChange={(e) => setFormProductSupplier(capitalizeFirstLetter(e.target.value))}
                      className="w-full p-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                      placeholder="es. Dante di Ferenza" 
                    />
                    <datalist id="suppliers-list">
                      {allSuppliers.sort().map(sup => (
                        <option key={sup} value={sup} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-400 mb-2 tracking-widest">Numero/Barcode Prodotto</label>
                    <div className="flex gap-2">
                      <input 
                        name="barcode" 
                        required 
                        className="flex-1 p-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-mono" 
                        placeholder="Scansiona o inserisci" 
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                      />
                      <Button type="button" variant="secondary" onClick={() => {setScanMode('ADD_PRODUCT_BARCODE'); setIsScanning(true);}}><Scan size={20} /></Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-400 mb-2 tracking-widest">Numero/Barcode Lotto</label>
                    <div className="flex gap-2">
                      <input 
                        value={formLotBarcode}
                        onChange={(e) => setFormLotBarcode(e.target.value)}
                        className="flex-1 p-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-mono" 
                        placeholder="Scansiona o inserisci" 
                      />
                      <Button type="button" variant="secondary" onClick={() => {setScanMode('ADD_LOT_BARCODE'); setIsScanning(true);}}><Scan size={20} /></Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Data di Scadenza Iniziale</label>
                  <input name="expiryDate" type="date" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Categoria</label>
                  <select name="category" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Carne</option>
                    <option>Pesce</option>
                    <option>Latticini</option>
                    <option>Dispensa</option>
                    <option>Bevande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Unità</label>
                  <select name="unit" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500">
                    <option>kg</option>
                    <option>pezzi</option>
                    <option>confezioni</option>
                    <option>litri</option>
                    <option>bottiglie</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Q.tà Iniziale</label>
                  <input name="qty" type="number" required className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Scorta Minima</label>
                  <input name="min" type="number" required className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <Button type="submit" className="w-full py-5 text-lg">Salva Prodotto</Button>
            </form>
          </motion.div>
        )}
    </div>
  );
};

const LoginScreen = () => {
  const { login, loading } = useAuth();
  return (
    <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center p-8 text-white text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="mb-12"
      >
        <div className="bg-white p-6 rounded-[40px] inline-block mb-6 shadow-2xl">
          <Package size={64} className="text-blue-600" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter mb-2">LogistiQo</h1>
        <p className="text-blue-100 font-medium opacity-80">Gestione magazzino professionale</p>
      </motion.div>
      
      <div className="w-full max-w-xs space-y-4">
        <Button 
          disabled={loading}
          onClick={login} 
          className="w-full bg-white text-blue-600 hover:bg-blue-50 py-5 text-lg shadow-xl"
        >
          {loading ? 'Caricamento...' : 'Accedi con Google'}
        </Button>
        <p className="text-xs text-blue-200 opacity-60">Accedi per gestire il magazzino del tuo ristorante in tempo reale.</p>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );

  return user ? <InventoryApp /> : <LoginScreen />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <InstallPWA />
      </AuthProvider>
    </ErrorBoundary>
  );
}
