const stuffQuizProxiedURL = 'https://corsproxy.io/?' + encodeURIComponent('https://www.stuff.co.nz/_json/national/quizzes?limit=100');

window.onload = async function() {
  const stories = await fetch(stuffQuizProxiedURL)
    .then(response => response.json())
    .then(response => response.stories)
    .catch(() => []);

  renderQuizLinks(stories);
};

function renderQuizLinks(quizzes) {
  const quizListContainer = document.getElementById('quiz-list');
  quizzes.sort((a, b) => new Date(b.datetime_iso8601) - new Date(a.datetime_iso8601));
  const list = document.createDocumentFragment();
  for (const quiz of quizzes) {
    const iframeSrc = getIframeSrc(quiz.html_assets[0].data_content);
    const quizLink = document.createElement("a");
    quizLink.href = iframeSrc;
    quizLink.textContent = quiz.title;
    list.appendChild(quizLink); 
  }
  quizListContainer.append(list);
}

function getIframeSrc(htmlContent) {
  const regex = /iframe.*src="([^?]+)/;
  const match = regex.exec(htmlContent);
  return match ? match[1] : '';
}
