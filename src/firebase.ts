import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Importa la configurazione di Firebase generata durante il setup
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Importante: Rispettiamo l'ID del database Firestore specificato nel setup (per istanze Enterprise multi-database)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
