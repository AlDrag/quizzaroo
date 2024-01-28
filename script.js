const stuffQuizProxiedURL = 'https://corsproxy.io/?' + encodeURIComponent('https://www.stuff.co.nz/_json/national/quizzes?limit=100');

window.onload = async function() {
  const stories = await fetchQuizzes();

  renderQuizLinks(document.getElementById("three-strikes"), stories.threeStrikes);
  renderQuizLinks(document.getElementById("hard-words"), stories.hardWords);
  renderQuizLinks(document.getElementById("quizzes"), stories.quizzes);
};

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
