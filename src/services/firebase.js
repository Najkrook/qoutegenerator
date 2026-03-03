import { initializeApp } from "firebase/app";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    collection,
    writeBatch,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    deleteDoc,
    runTransaction
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCY5HIOmMH8xZal9LKI4EfLkrmPzA1iwm4",
    authDomain: "quotegenerator-d35ad.firebaseapp.com",
    projectId: "quotegenerator-d35ad",
    storageBucket: "quotegenerator-d35ad.firebasestorage.app",
    messagingSenderId: "134445776553",
    appId: "1:134445776553:web:9bb1d187f50f4d3d40b3b8",
    measurementId: "G-VH64N3R1B9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
    app,
    db,
    auth,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    collection,
    writeBatch,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    deleteDoc,
    runTransaction
};
