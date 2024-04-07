import { Database } from "./database.js";

Database.load((stories) => {
  renderGraphs(stories.quizzes);
  renderQuizLinks(document.getElementById("quizzes"), stories.quizzes)
  renderOtherLinks(document.getElementById("three-strikes"), stories.threeStrikes);
  renderOtherLinks(document.getElementById("hard-words"), stories.hardWords);
  contextMenuMeme(document.getElementsByTagName('a'));

  document.getElementById("close").addEventListener('click', () => closeQuiz());
  document.getElementById("fullscreen").addEventListener('click', () => enterFullScreen());
});

function renderGraphs(quizzes) {
  const filtered = quizzes.filter(quiz => quiz.complete).reverse();
  new roughViz.Bar({
    element: '#graphs',
    data: {
      values: filtered.map(quiz => quiz.score),
      labels: filtered.map(quiz => quiz.title),
    },
    roughness: 0,
    margin: {
      top: 20,
      bottom: 5,
      right: 0,
      left: 20
    }
  });
}

function enterFullScreen() {
  if (!document.fullscreenElement) {
    const quizViewer = document.getElementById("quiz-viewer");
    quizViewer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function openQuiz(link) {
  const quizViewer = document.getElementById("quiz-viewer");
  const quizIframe = quizViewer.querySelector("iframe");
  const url = new URL(link);
  const embedURL = 'https://riddle-proxy.viethungax-cloudflare.workers.dev' + url.pathname;
  quizIframe.src = embedURL;
  quizViewer.style.display = 'block';
  quizIframe.onload = () => {
    // Important: This is to override the `document.referrer` property that get sent to riddle.com for access token.
    quizIframe.contentWindow.postMessage({ script: `Object.defineProperty(document, "referrer", {get : () => 'http://www.riddle.com'});` }, "*");
    quizIframe.contentWindow.postMessage({ script: `document.querySelector('html').style.overflow = 'auto'` }, "*");
  };
}

function closeQuiz() {
  const quizViewer = document.getElementById("quiz-viewer");
  const quizIframe = quizViewer.querySelector("iframe");
  quizIframe.src = "data:text/html, <body style='background: white;display: flex; align-items: center;'><h1 style='text-align: center; width: 100%;'>LOADING...</h1></body>";
  quizViewer.style.display = 'none';
  document.exitFullscreen();
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
  checkbox.oninput = () => { void Database.markQuizComplete(id, checkbox.checked); };
  label.appendChild(checkbox);
  td1.appendChild(label);
  const td2 = document.createElement("td");
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.target = "_blank";
  anchor.innerText = name;
  anchor.onclick = (e) => {
    e.preventDefault();
    openQuiz(link);
  };
  td2.appendChild(anchor);
  const td3 = document.createElement("td");
  td3.innerText = date;
  const td4 = document.createElement("td");
  const input = document.createElement("input");
  input.setAttribute("type", "number");
  input.setAttribute("step", "1");
  input.value = score;
  input.oninput = debounce(() => Database.setQuizScore(id, parseInt(input.value)), 2000);
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
  container.innerHTML = '';
  container.append(list);
}

function contextMenuMeme(tags) {
  const message = 'Use left click!!!';
  const warningElement = document.createElement('div');
  warningElement.textContent = message;
  warningElement.classList.add('context-menu-warning');

  for (const tag of tags) {
    tag.addEventListener('contextmenu', (() => rightClickWarning(warningElement)));
  }
}

let timeoutRef;
function rightClickWarning(warningElement) {
  if (timeoutRef) {
    clearTimeout(timeoutRef);
  }

  warningElement.style.left = `${(window.innerWidth) - (1600) / 2}px`;
  warningElement.style.top = '100px';

  document.body.appendChild(warningElement);

  timeoutRef = setTimeout(() => {
    document.body.removeChild(warningElement);
}, 3000);
}

function getIframeSrc(htmlContent) {
  const regex = /iframe.*src="([^?]+)/;
  const match = regex.exec(htmlContent);
  return match ? match[1] : '';
}

function debounce(callback, delay) {
  let timeoutId;
  
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}