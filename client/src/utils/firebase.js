
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "ai-interview-project-3216f.firebaseapp.com",
  projectId: "ai-interview-project-3216f",
  storageBucket: "ai-interview-project-3216f.firebasestorage.app",
  messagingSenderId: "213649006300",
  appId: "1:213649006300:web:d6d8e4257da6001e9b1e19",
}; 

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider()

export {auth , provider}
