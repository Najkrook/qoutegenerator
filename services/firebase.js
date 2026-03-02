import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, writeBatch, query, orderBy, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCY5HIOmMH8xZal9LKI4EfLkrmPzA1iwm4",
    authDomain: "quotegenerator-d35ad.firebaseapp.com",
    projectId: "quotegenerator-d35ad",
    storageBucket: "quotegenerator-d35ad.firebasestorage.app",
    messagingSenderId: "134445776553",
    appId: "1:134445776553:web:9bb1d187f50f4d3d40b3b8",
    measurementId: "G-VH64N3R1B9"
};

// Initialize Firebase
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
    getDocs,
    deleteDoc
};
