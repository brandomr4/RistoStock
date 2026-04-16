import React, { useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (e: ErrorEvent) => {
      const msg = e.error ? (e.error.message || e.error) : e.message;
        if (msg && typeof msg === 'string') {
          if (msg.indexOf('"undefined" is not valid JSON') !== -1) {
            return;
          }
          if (msg.indexOf("is not of type 'long'") !== -1) {
            return;
          }
        }
      console.log('ErrorBoundary: caught ErrorEvent:', e);
      setHasError(true);
      setError(e.error || new Error(e.message || 'Unknown error'));
    };

    const promiseHandler = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
        if (msg && typeof msg === 'string') {
          if (msg.indexOf('"undefined" is not valid JSON') !== -1) {
            return;
          }
          if (msg.indexOf("is not of type 'long'") !== -1) {
            return;
          }
        }
      console.log('ErrorBoundary: caught PromiseRejectionEvent:', e);
      setHasError(true);
      setError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', promiseHandler);
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', promiseHandler);
    };
  }, []);

  if (hasError) {
    let message = 'Qualcosa è andato storto.';
    
    // Safely extract message from error object or string
    let errorMessage = '';
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
    }

    if (errorMessage && errorMessage !== 'undefined') {
      try {
        const trimmedMessage = errorMessage.trim();
        // Explicitly check for 'undefined' string which causes the specific error reported
        if (trimmedMessage !== 'undefined' && (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('['))) {
          const parsed = JSON.parse(trimmedMessage);
          console.log('ErrorBoundary: successfully parsed JSON:', parsed);
          if (parsed && parsed.error && typeof parsed.error === 'string' && parsed.error.includes('insufficient permissions')) {
            message = 'Errore di permessi Firestore. Controlla le regole di sicurezza.';
          }
        }
      } catch (e) {
        // Not JSON or parsing failed, ignore
        console.log('ErrorBoundary: message is not JSON or parsing failed');
      }
    }

    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Ops!</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Ricarica App
        </button>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-8 p-4 bg-gray-100 text-left overflow-auto text-xs">
            {error?.stack}
          </pre>
        )}
      </div>
    );
  }

  return <>{children}</>;
};
