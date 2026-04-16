import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  getDoc,
  serverTimestamp,
  getDocs,
  where,
  limit,
  increment,
  collectionGroup
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Product {
  id?: string;
  name: string;
  category: string;
  barcode: string;
  supplier: string;
  unit: string;
  currentQuantity: number;
  minQuantity: number;
  expiryDate?: string; // ISO date string (legacy, will be derived from batches)
  lastUpdated: any;
}

export interface StockLot {
  id?: string;
  productId: string;
  quantity: number;
  expiryDate: string;
  supplier: string;
  barcode: string;
  receivedDate: any;
}

export interface Movement {
  id?: string;
  productId: string;
  productName?: string; // Store name for history even if product is deleted
  type: 'IN' | 'OUT' | 'CREATE' | 'DELETE' | 'UPDATE';
  quantity?: number;
  details?: string;
  timestamp: any;
  userId: string;
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  throw new Error(JSON.stringify(errInfo));
}

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  const q = query(collection(db, 'products'), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    callback(products);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
};

export const addProduct = async (product: Omit<Product, 'id' | 'lastUpdated'>) => {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      lastUpdated: serverTimestamp()
    });
    
    // Only log creation if no initial quantity is provided (it will be logged by addBatch otherwise)
    if (product.currentQuantity === 0) {
      await addMovement({
        productId: docRef.id,
        productName: product.name,
        type: 'CREATE',
        quantity: 0,
        details: 'Prodotto creato nel sistema'
      });
    }
    
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'products');
  }
};

export const updateProductQuantity = async (productId: string, newQuantity: number) => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      currentQuantity: newQuantity,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
  }
};

export const adjustProductQuantity = async (productId: string, delta: number) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    const productData = productSnap.data() as Product;

    await updateDoc(productRef, {
      currentQuantity: increment(delta),
      lastUpdated: serverTimestamp()
    });

    await addMovement({
      productId,
      productName: productData.name,
      type: delta > 0 ? 'IN' : 'OUT',
      quantity: Math.abs(delta),
      details: 'Regolazione manuale quantità'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
  }
};

export const updateProduct = async (productId: string, product: Partial<Omit<Product, 'id' | 'lastUpdated'>>) => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      ...product,
      lastUpdated: serverTimestamp()
    });
    
    await addMovement({
      productId,
      productName: product.name || 'Prodotto',
      type: 'UPDATE'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
  }
};

export const deleteProduct = async (productId: string, productName?: string) => {
  try {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
    
    await addMovement({
      productId,
      productName: productName || 'Prodotto',
      type: 'DELETE'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
};

export const addMovement = async (movement: Omit<Movement, 'id' | 'timestamp' | 'userId'>) => {
  try {
    if (!auth.currentUser) throw new Error('User not authenticated');
    return await addDoc(collection(db, 'movements'), {
      ...movement,
      timestamp: serverTimestamp(),
      userId: auth.currentUser.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'movements');
  }
};

export const subscribeToMovements = (limitCount: number | 'all', callback: (movements: Movement[]) => void) => {
  let q = query(collection(db, 'movements'), orderBy('timestamp', 'desc'));
  
  if (limitCount !== 'all') {
    q = query(q, limit(limitCount));
  }

  return onSnapshot(q, (snapshot) => {
    const movements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movement));
    callback(movements);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'movements'));
};

// --- Batch Management ---

export const subscribeToBatches = (productId: string, callback: (batches: StockLot[]) => void) => {
  const q = query(collection(db, 'products', productId, 'batches'), orderBy('expiryDate', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const batches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockLot));
    callback(batches);
  }, (error) => handleFirestoreError(error, OperationType.LIST, `products/${productId}/batches`));
};

export const addBatch = async (productId: string, batch: Omit<StockLot, 'id' | 'productId' | 'receivedDate'>, isInitial: boolean = false) => {
  try {
    const batchData = {
      ...batch,
      productId,
      receivedDate: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'products', productId, 'batches'), batchData);
    
    // Update total product quantity and next expiry date
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error("Prodotto non trovato");
    }
    
    const productData = productSnap.data() as Product;
    
    const updates: any = {
      currentQuantity: increment(batch.quantity),
      lastUpdated: serverTimestamp()
    };
    
    if (!productData.expiryDate || batch.expiryDate < productData.expiryDate) {
      updates.expiryDate = batch.expiryDate;
    }
    
    await updateDoc(productRef, updates);

    // Add movement
    await addMovement({
      productId,
      productName: productData.name,
      type: 'IN',
      quantity: batch.quantity,
      details: isInitial ? 'Prodotto creato con scorta iniziale' : `Carico da ${batch.supplier}`
    });
    
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `products/${productId}/batches`);
  }
};

export const deleteBatch = async (productId: string, batchId: string, quantity: number) => {
  try {
    await deleteDoc(doc(db, 'products', productId, 'batches', batchId));
    
    // Update total product quantity and next expiry date
    const remainingBatches = await getDocs(query(collection(db, 'products', productId, 'batches'), orderBy('expiryDate', 'asc'), limit(1)));
    const nextExpiry = remainingBatches.empty ? null : (remainingBatches.docs[0].data() as StockLot).expiryDate;

    await updateDoc(doc(db, 'products', productId), {
      currentQuantity: increment(-quantity),
      expiryDate: nextExpiry,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}/batches/${batchId}`);
  }
};

export const deductFromBatches = async (productId: string, quantityToDeduct: number) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    const productData = productSnap.data() as Product;

    // FEFO: First Expired First Out
    const q = query(collection(db, 'products', productId, 'batches'), orderBy('expiryDate', 'asc'));
    const snapshot = await getDocs(q);
    
    let remainingToDeduct = quantityToDeduct;
    
    for (const batchDoc of snapshot.docs) {
      if (remainingToDeduct <= 0) break;
      
      const batch = batchDoc.data() as StockLot;
      const batchRef = doc(db, 'products', productId, 'batches', batchDoc.id);
      
      if (batch.quantity <= remainingToDeduct) {
        remainingToDeduct -= batch.quantity;
        await deleteDoc(batchRef);
      } else {
        await updateDoc(batchRef, {
          quantity: batch.quantity - remainingToDeduct
        });
        remainingToDeduct = 0;
      }
    }
    
    // Update total product quantity and next expiry date
    const remainingBatches = await getDocs(query(collection(db, 'products', productId, 'batches'), orderBy('expiryDate', 'asc'), limit(1)));
    const nextExpiry = remainingBatches.empty ? null : (remainingBatches.docs[0].data() as StockLot).expiryDate;
    
    await updateDoc(productRef, {
      currentQuantity: increment(-quantityToDeduct),
      expiryDate: nextExpiry,
      lastUpdated: serverTimestamp()
    });

    await addMovement({
      productId,
      productName: productData.name,
      type: 'OUT',
      quantity: quantityToDeduct,
      details: 'Scarico magazzino (FEFO)'
    });
    
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}/batches`);
  }
};

export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  try {
    // 1. Check direct product barcode
    const q1 = query(collection(db, 'products'), where('barcode', '==', barcode), limit(1));
    const snapshot1 = await getDocs(q1);
    if (!snapshot1.empty) {
      return { id: snapshot1.docs[0].id, ...snapshot1.docs[0].data() } as Product;
    }

    // 2. Check batch barcodes (fallback)
    const q2 = query(collectionGroup(db, 'batches'), where('barcode', '==', barcode), limit(1));
    const snapshot2 = await getDocs(q2);
    if (!snapshot2.empty) {
      const batchData = snapshot2.docs[0].data() as StockLot;
      const productRef = doc(db, 'products', batchData.productId);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        return { id: productSnap.id, ...productSnap.data() } as Product;
      }
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'batches-collection-group');
    return null;
  }
};

export const seedInitialProducts = async () => {
  const today = new Date();
  const getFutureDate = (days: number) => {
    const d = new Date();
    d.setDate(today.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const initialProducts = [
    { name: 'Costine di maiale', category: 'Carne', barcode: '8001234567890', supplier: 'Fornitore A', unit: 'kg', currentQuantity: 10, minQuantity: 5, expiryDate: getFutureDate(3) },
    { name: 'Braccioli di maiale', category: 'Carne', barcode: '8001234567891', supplier: 'Fornitore B', unit: 'kg', currentQuantity: 8, minQuantity: 4, expiryDate: getFutureDate(5) },
    { name: 'Filetto di manzo', category: 'Carne', barcode: '8001234567892', supplier: 'Dante di Ferenza', unit: 'kg', currentQuantity: 5, minQuantity: 3, expiryDate: getFutureDate(2) },
    { name: 'Costata', category: 'Carne', barcode: '8001234567893', supplier: 'Fornitore A', unit: 'kg', currentQuantity: 12, minQuantity: 6, expiryDate: getFutureDate(7) },
    { name: 'Pomodori Pelati', category: 'Dispensa', barcode: '8001234567894', supplier: 'Mutti', unit: 'confezioni', currentQuantity: 24, minQuantity: 12, expiryDate: getFutureDate(180) },
    { name: 'Farina 00', category: 'Dispensa', barcode: '8001234567895', supplier: 'Molino Bianco', unit: 'kg', currentQuantity: 50, minQuantity: 20, expiryDate: getFutureDate(365) },
    { name: 'Olio Extra Vergine', category: 'Dispensa', barcode: '8001234567896', supplier: 'Uliveto', unit: 'litri', currentQuantity: 15, minQuantity: 5, expiryDate: getFutureDate(200) },
    { name: 'Vino Rosso Casa', category: 'Bevande', barcode: '8001234567897', supplier: 'Cantina Sociale', unit: 'bottiglie', currentQuantity: 36, minQuantity: 12, expiryDate: getFutureDate(730) },
    { name: 'Mozzarella', category: 'Latticini', barcode: '8001234567898', supplier: 'Granarolo', unit: 'kg', currentQuantity: 10, minQuantity: 5, expiryDate: getFutureDate(4) },
    { name: 'Pasta Penne', category: 'Dispensa', barcode: '8001234567899', supplier: 'Barilla', unit: 'kg', currentQuantity: 20, minQuantity: 10, expiryDate: getFutureDate(300) },
  ];

  const q = query(collection(db, 'products'), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    for (const p of initialProducts) {
      const { currentQuantity, expiryDate, ...rest } = p;
      const docRef = await addProduct({ ...rest, currentQuantity: 0 });
      if (docRef && currentQuantity > 0) {
        await addBatch(docRef.id, {
          quantity: currentQuantity,
          supplier: 'Fornitore Predefinito',
          barcode: p.barcode,
          expiryDate: expiryDate || getFutureDate(30)
        });
      }
    }
  }
};
