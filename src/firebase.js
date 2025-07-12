// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCQiBNQy74Glx6vEoptwe6lTpdJGHZr07U",
  authDomain: "the-void-8250c.firebaseapp.com",
  projectId: "the-void-8250c",
  storageBucket: "the-void-8250c.firebasestorage.app",
  messagingSenderId: "213813191010",
  appId: "1:213813191010:web:2fb315ba58645c42628c3b",
  measurementId: "G-88K8S9XWZ8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };