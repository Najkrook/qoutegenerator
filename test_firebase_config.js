
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCY5HIOmMH8xZaL9LKI4EfLkrmPzA1iwm4",
    authDomain: "quotegenerator-d35ad.firebaseapp.com",
    projectId: "quotegenerator-d35ad",
    storageBucket: "quotegenerator-d35ad.firebasestorage.app",
    messagingSenderId: "134445776553",
    appId: "1:134445776553:web:9bb1d187f50f4d3d40b3b8",
    measurementId: "G-VH64N3R1B9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirebase() {
    try {
        console.log("Testing Firestore connection...");
        const docRef = doc(db, "stock", "main_inventory");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log("SUCCESS: Connected to Firestore. Data found.");
        } else {
            console.log("SUCCESS: Connected to Firestore. No data found at 'stock/main_inventory'.");
        }
    } catch (err) {
        console.error("FAILURE: Could not connect to Firestore.", err);
    }
}

testFirebase();
