import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { addDoc, collection, getDocs, getFirestore, onSnapshot, query, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const stuffQuizProxiedURL = 'https://corsproxy.io/?' + encodeURIComponent('https://www.stuff.co.nz/_json/national/quizzes?limit=99');
const stories = await fetchQuizzes();

async function fetchQuizzes() {
  const stories = await fetch(stuffQuizProxiedURL)
    .then(response => response.json())
    .then(response => response.stories)
    .catch(() => []);

  return stories
    .sort((a, b) => b.datetime_iso8601.localeCompare(a.datetime_iso8601))
    .reduce((acc, story) => {
      const title = story.title.toLowerCase();
      if (title.includes("trivia challenge") && !title.includes("kids")) {
        acc.quizzes.push(story);
      } else if (title.includes("three strikes trivia")) {
        acc.threeStrikes.push(story);
      } else if (title.includes("hard word")) {
        acc.hardWords.push(story);
      }
      return acc;
    }, { quizzes: [], threeStrikes: [], hardWords: [] });
}

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
    // Subscribe to database changes.
    onSnapshot(collection(this.database, "quizzes"), (snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;
        const quiz = stories.quizzes.find(q => q.id === data.quizId);
        if (!quiz) return;
        quiz.complete = data.complete;
        quiz.score = data.score;
      });
      for (const callback of this.listeners) callback?.(stories);
    });
  }

  /**
   * Register a function to call when updates are received from the database.
   * @param {(stories) => void} callback
   */
  static onUpdate(callback) {
    this.listeners.push(callback);
  }

  /**
   * Mark a quiz as complete/incomplete.
   * @param {string} quizId The ID of the quiz.
   * @param {boolean} complete Set `true` to mark as complete, `false` to mark as incomplete.
   */
  static async markQuizComplete(quizId, complete) {
    const result = await getDocs(query(collection(this.database, "quizzes"), where('quizId', '==', quizId)));
    let document = result.docs[0]?.ref;
    if (result.empty || !document) {
      document = await addDoc(collection(this.database, "quizzes"), { complete, score: 0, quizId });
      return;
    }
    await updateDoc(document, { complete });
  }

  /**
   * Set a quiz's score.
   * @param {string} quizId The ID of the quiz.
   * @param {number} score The score to set.
   */
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
