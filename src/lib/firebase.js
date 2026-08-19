import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Config de cliente de Firebase — esto NO es secreto, está pensado para
// vivir en el código del front-end. Lo que protege los datos son las
// reglas de seguridad de Firestore (ver firestore.rules).
const firebaseConfig = {
  apiKey: "AIzaSyA1M3X06uAT6nd3OIMEStdAGZTYTkaQN8c",
  authDomain: "app-encuentro-596c8.firebaseapp.com",
  projectId: "app-encuentro-596c8",
  storageBucket: "app-encuentro-596c8.firebasestorage.app",
  messagingSenderId: "1087083216601",
  appId: "1:1087083216601:web:a3eeb433afe93d150348c8",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
