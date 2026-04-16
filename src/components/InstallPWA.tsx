import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Share, PlusSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed/in standalone mode
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')
      );
    };

    setIsStandalone(checkStandalone());

    // Check if it's iOS
    const checkIOS = () => {
      return (
        ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
        (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
      );
    };

    setIsIOS(checkIOS());

    // Intercept beforeinstallprompt (Android/Windows)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setIsStandalone(true);
      setDeferredPrompt(null);
    });

    // If it's iOS and not standalone, show the button to reveal instructions
    if (checkIOS() && !checkStandalone()) {
      setShowInstallButton(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || !showInstallButton) return null;

  return (
    <>
      <AnimatePresence>
        {showInstallButton && !showIOSInstructions && (
          <div className="fixed bottom-28 left-4 right-4 z-[60] flex justify-center pointer-events-none">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-700/50 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 pointer-events-auto"
            >
              <button 
                onClick={handleInstallClick}
                className="flex flex-1 items-center gap-3 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <Download size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold">Installa RistoStock</div>
                  <div className="text-[10px] text-slate-400 font-medium">App veloce sulla tua Home</div>
                </div>
              </button>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleInstallClick}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold px-3 py-2 rounded-lg uppercase transition-colors"
                >
                  Installa
                </button>
                <button 
                  onClick={() => setShowInstallButton(false)}
                  className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* iOS Instructions Overlay */}
      <AnimatePresence>
        {showIOSInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] p-8 relative overflow-hidden"
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setShowIOSInstructions(false)}
                  className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center">
                  <PlusSquare size={32} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Installa su iPhone</h3>
                  <p className="text-slate-400 text-sm">
                    Segui questi passaggi per aggiungere RistoStock alla tua schermata principale:
                  </p>
                </div>

                <div className="w-full space-y-4">
                  <div className="flex items-start gap-4 bg-slate-800/50 p-4 rounded-2xl">
                    <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-400 border border-slate-600">1</div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">Clicca il tasto Condividi</p>
                      <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                        In basso al centro in Safari <Share size={12} className="inline" />
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 bg-slate-800/50 p-4 rounded-2xl">
                    <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-400 border border-slate-600">2</div>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">Aggiungi alla Home</p>
                      <p className="text-slate-500 text-xs mt-1">
                        Scorri e seleziona "Aggiungi alla schermata Home"
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowIOSInstructions(false)}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all"
                >
                  Ho capito
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
