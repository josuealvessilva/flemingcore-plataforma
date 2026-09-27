import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Mesmos valores do firebase_options.dart (app web). Chave de API do
// Firebase para cliente é identificador público, não segredo — o controle
// de acesso é feito por regras de segurança e custom claims.
const firebaseConfig = {
  apiKey: 'AIzaSyDGfegJpIEJK5NAp9AJ_Kve9QROfyL4_10',
  appId: '1:258492871250:web:a627337c0c92d05914258b',
  messagingSenderId: '258492871250',
  projectId: 'flemingcore-53272',
  authDomain: 'flemingcore-53272.firebaseapp.com',
  databaseURL: 'https://flemingcore-53272-default-rtdb.firebaseio.com',
  storageBucket: 'flemingcore-53272.firebasestorage.app',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
