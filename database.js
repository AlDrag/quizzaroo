import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { addDoc, collection, getDocs, getFirestore, onSnapshot, query, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class Database {
    static firebaseConfig = {
      apiKey: "AIzaSyAoYRHH_PI7IPE9zwDiP4tfeGVwHFNhBUU",
      authDomain: "quizzaroo-f98dc.firebaseapp.com",
      projectId: "quizzaroo-f98dc",
      storageBucket: "quizzaroo-f98dc.appspot.com",
      messagingSenderId: "728917953883",
      appId: "1:728917953883:web:66fc2f6eb3cccd7c7cde7e"
    };
    static app = initializeApp(this.firebaseConfig);
    static database = getFirestore(this.app);
    static listeners = [];

    static {
      onSnapshot(collection(this.database, "quizzes"), (snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data) return;
          const quiz = stories.quizzes.find(q => q.id === data.quizId);
          if (!quiz) return;
          quiz.complete = data.complete;
          quiz.score = data.score;
        });
        for (const callback of this.listeners) callback?.();
      });
    }

    static onUpdate(callback) {
      this.listeners.push(callback);
    }

    static async markQuizComplete(quizId, complete) {
      const result = await getDocs(query(collection(this.database, "quizzes"), where('quizId', '==', quizId)));
      let document = result.docs[0]?.ref;
      if (result.empty || !document) {
        document = await addDoc(collection(this.database, "quizzes"), { complete, score: 0, quizId });
        return;
      }
      await updateDoc(document, { complete });
    }
    
    static async setQuizScore(quizId, score) {
      const result = await getDocs(query(collection(this.database, "quizzes"), where('quizId', '==', quizId)));
      let document = result.docs[0]?.ref;
      if (result.empty || !document) {
        document = await addDoc(collection(this.database, "quizzes"), { complete: false, score, quizId });
        return;
      }
      await updateDoc(document, { score });
    }
}
