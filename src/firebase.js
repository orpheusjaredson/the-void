// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDuQXkAEsHPJRumboYGlY62_zhPGMsSnkk",
  authDomain: "the-void-6dc52.firebaseapp.com",
  projectId: "the-void-6dc52",
  storageBucket: "the-void-6dc52.firebasestorage.app",
  messagingSenderId: "1073905511269",
  appId: "1:1073905511269:web:4338376b21aadc79ab4f8c",
  measurementId: "G-EHJPSYQ76C"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };