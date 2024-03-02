import { Database } from "./database.js";

Database.load((stories) => {
  renderQuizLinks(document.getElementById("quizzes"), stories.quizzes)
  renderOtherLinks(document.getElementById("three-strikes"), stories.threeStrikes);
  renderOtherLinks(document.getElementById("hard-words"), stories.hardWords);
});

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
  td2.appendChild(anchor);
  const td3 = document.createElement("td");
  td3.innerText = date;
  const td4 = document.createElement("td");
  const input = document.createElement("input");
  input.setAttribute("type", "number");
  input.setAttribute("step", "1");
  input.value = score;
  input.oninput = () => { void Database.setQuizScore(id, parseInt(input.value)); };
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

function getIframeSrc(htmlContent) {
  const regex = /iframe.*src="([^?]+)/;
  const match = regex.exec(htmlContent);
  return match ? match[1] : '';
}
