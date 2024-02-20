import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { addDoc, collection, getDocs, getFirestore, onSnapshot, query, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const stuffQuizProxiedURL = 'https://corsproxy.io/?' + encodeURIComponent('https://www.stuff.co.nz/_json/national/quizzes?limit=99');
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
loadFromStorage();
renderOtherLinks(document.getElementById("three-strikes"), stories.threeStrikes);
renderOtherLinks(document.getElementById("hard-words"), stories.hardWords);


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

function renderQuizRow(id, title, link, complete = false, score = 0) {
  const date = /:\s(?<date>[a-z]+\s[0-9]+,\s[0-9]+)/i.exec(title)?.groups?.date;
  const name = /:\s(?<name>(?:Morning|Afternoon)\s[a-z\s]+):/i.exec(title)?.groups?.name;
  const row = document.createElement("tr");
  const td1 = document.createElement("td");
  const label = document.createElement("label");
  label.setAttribute("for", id);
  const checkbox = document.createElement("input");
  checkbox.setAttribute("type", "checkbox");
  checkbox.checked = complete;
  checkbox.id = id;
  checkbox.name = id;
  checkbox.oninput = () => { void markComplete(id, checkbox.checked); };
  label.appendChild(checkbox);
  td1.appendChild(label);
  const td2 = document.createElement("td");
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.target = "_blank";
  anchor.innerText = name;
  td2.appendChild(anchor);
  const td3 = document.createElement("td");
  td3.innerText = date;
  const td4 = document.createElement("td");
  const input = document.createElement("input");
  input.setAttribute("type", "number");
  input.setAttribute("step", "1");
  input.value = score;
  input.oninput = () => { void setScore(id, parseInt(input.value)); };
  td4.appendChild(input);
  row.appendChild(td1);
  row.appendChild(td2);
  row.appendChild(td3);
  row.appendChild(td4);
  return row;
}

function renderQuizLinks(container, quizzes) {
  const list = document.createDocumentFragment();
  for (const quiz of quizzes) {
    const iframeSrc = getIframeSrc(quiz.html_assets[0].data_content);
    const quizLink = renderQuizRow(quiz.id, quiz.title, iframeSrc, quiz.complete, quiz.score);
    list.appendChild(quizLink);
  }
  container.innerHTML = '';
  container.append(list);
}

function renderOtherLinks(container, quizzes) {
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

async function loadFromStorage() {
  onSnapshot(collection(database, "quizzes"), (snapshot) => {
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data) return;
      const quiz = stories.quizzes.find(q => q.id === data.quizId);
      if (!quiz) return;
      quiz.complete = data.complete;
      quiz.score = data.score;
    });
    renderQuizLinks(document.getElementById("quizzes"), stories.quizzes);
  });
}

async function markComplete(quizId, complete) {
  const result = await getDocs(query(collection(database, "quizzes"), where('quizId', '==', quizId)));
  let document = result.docs[0]?.ref;
  if (result.empty || !document) {
    document = await addDoc(collection(database, "quizzes"), { complete, score: 0, quizId });
    return;
  }
  await updateDoc(document, { complete });
}

async function setScore(quizId, score) {
  const result = await getDocs(query(collection(database, "quizzes"), where('quizId', '==', quizId)));
  let document = result.docs[0]?.ref;
  if (result.empty || !document) {
    document = await addDoc(collection(database, "quizzes"), { complete: false, score, quizId });
    return;
  }
  await updateDoc(document, { score });
}
