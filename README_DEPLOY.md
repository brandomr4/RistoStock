# RistoStock - Guida al Deployment

Questa guida spiega come pubblicare l'applicazione su **Cloudflare Pages** collegandola a un repository **GitHub**.

## 1. Preparazione su GitHub
1. Crea un nuovo repository su GitHub.
2. Inizializza il repository locale (se non lo hai già fatto):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TUO_UTENTE/TUO_REPO.git
   git push -u origin main
   ```
   *Nota: Il file `firebase-applet-config.json` è escluso dal git per sicurezza.*

## 2. Configurazione su Cloudflare Pages
1. Accedi alla dashboard di Cloudflare e vai su **Workers & Pages**.
2. Clicca su **Create application** -> **Pages** -> **Connect to Git**.
3. Seleziona il tuo repository GitHub.
4. Imposta i parametri di build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. **Variabili d'Ambiente (Opzionale ma Consigliato)**:
   Se preferisci non caricare il file JSON, puoi convertire i valori in variabili d'ambiente `VITE_` su Cloudflare e modificare `src/firebase.ts`.

## 3. Configurazione su Firebase
1. Vai nella [Console Firebase](https://console.firebase.google.com/).
2. In **Authentication** -> **Settings** -> **Authorized domains**, aggiungi il dominio di Cloudflare (es. `ristostock.pages.dev`).
3. Assicurati che le **Firestore Rules** siano pubblicate (usa il file `firestore.rules` incluso nel progetto).

## 4. Comandi Locali
- Installazione: `npm install`
- Sviluppo: `npm run dev`
- Build: `npm run build`
