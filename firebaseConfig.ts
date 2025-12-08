import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// NOT: Bu alanı kendi Firebase Console -> Project Settings -> General kısmından alacağınız config ile doldurun.
// Realtime Database kurallarını (Rules) test için read: true, write: true yapmayı unutmayın.
const firebaseConfig = {
  apiKey: "API_KEY_BURAYA",
  authDomain: "PROJECT_ID.firebaseapp.com",
  databaseURL: "https://PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Uygulama başlatma (Singleton pattern)
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);