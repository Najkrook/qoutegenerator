import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import readline from 'readline';

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function run() {
    console.log("=== Firebase Inventory Cleaner (BLACK rack) ===");
    console.log("Du måste logga in med ditt admin-konto för att ändra i databasen.");

    rl.question('Email: ', async (email) => {
        rl.question('Lösenord: ', async (password) => {
            try {
                console.log("Loggar in...");
                await signInWithEmailAndPassword(auth, email, password);
                console.log("Inloggad!");

                const ref = doc(db, "stock", "main_inventory");
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    console.log("Kunde inte hitta inventory i Firebase.");
                    process.exit(1);
                }

                let data = snap.data();
                const originalLen = data.bahama.length;

                // Remove incorrectly parsed legend rows BLACK.2.3 and up
                data.bahama = data.bahama.filter(item => {
                    const id = item.ID || '';
                    if (id.startsWith('BLACK.2.')) {
                        const num = parseInt(id.split('.')[2]);
                        if (num >= 3) return false;
                    }
                    return true;
                });

                const removed = originalLen - data.bahama.length;

                if (removed > 0) {
                    await setDoc(ref, data);
                    console.log(`\\nLÖST: Tog bort ${removed} ogiltiga (legend) artiklar från Firebase!`);
                } else {
                    console.log("\\nKlar! Inga ogiltiga rader hittades (redan fixat).");
                }
            } catch (err) {
                console.error("\\nFel:", err.message);
            }
            process.exit(0);
        });
    });
}

run();
