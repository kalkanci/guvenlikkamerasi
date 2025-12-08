import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDpp9qj_eCYxexYldZDiQgszYdMQLkIfy4",
  authDomain: "guvenlikkamerasi-ac6d3.firebaseapp.com",
  // Realtime Database URL'i proje ID'sine göre yapılandırıldı.
  // Uygulamanın çalışması için bu satır gereklidir.
  databaseURL: "https://guvenlikkamerasi-ac6d3-default-rtdb.firebaseio.com",
  projectId: "guvenlikkamerasi-ac6d3",
  storageBucket: "guvenlikkamerasi-ac6d3.firebasestorage.app",
  messagingSenderId: "834749084778",
  appId: "1:834749084778:web:a7fba3cb8d43a80c560613",
  measurementId: "G-92JNS48E88"
};

// Gerçek config değerleri girildiği için artık uygulama kurulmuş sayılır.
export const isConfigured = true;

// Uygulama başlatma
const app = initializeApp(firebaseConfig);

// Analytics'i başlat (Tarayıcı ortamındaysa ve destekleniyorsa)
if (typeof window !== 'undefined') {
  try {
    getAnalytics(app);
  } catch (e) {
    console.log("Analytics başlatılamadı veya desteklenmiyor:", e);
  }
}

export const db = getDatabase(app);