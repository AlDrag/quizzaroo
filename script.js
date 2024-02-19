const stuffQuizProxiedURL = 'https://corsproxy.io/?' + encodeURIComponent('https://www.stuff.co.nz/_json/national/quizzes?limit=99');
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const stories = await fetchQuizzes();
const firebaseConfig = {
  apiKey: "AIzaSyAoYRHH_PI7IPE9zwDiP4tfeGVwHFNhBUU",
  authDomain: "quizzaroo-f98dc.firebaseapp.com",
  projectId: "quizzaroo-f98dc",
  storageBucket: "quizzaroo-f98dc.appspot.com",
  messagingSenderId: "728917953883",
  appId: "1:728917953883:web:66fc2f6eb3cccd7c7cde7e"
};
const app = initializeApp(firebaseConfig);
const database = getFirestore(app);

renderQuizLinks(document.getElementById("three-strikes"), stories.threeStrikes);
renderQuizLinks(document.getElementById("hard-words"), stories.hardWords);
renderQuizLinks(document.getElementById("quizzes"), stories.quizzes);

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

function renderQuizLinks(container, quizzes) {
  const list = document.createDocumentFragment();
  for (const quiz of quizzes) {
    const iframeSrc = getIframeSrc(quiz.html_assets[0].data_content);
    const quizLink = document.createElement("a");
    quizLink.href = iframeSrc;
    quizLink.target = "_blank";
    quizLink.textContent = quiz.title;
    list.appendChild(quizLink); 
  }
  container.append(list);
}

function getIframeSrc(htmlContent) {
  const regex = /iframe.*src="([^?]+)/;
  const match = regex.exec(htmlContent);
  return match ? match[1] : '';
}
