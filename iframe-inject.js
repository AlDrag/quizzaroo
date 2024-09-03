// NOTE: Any code in here will be executed when the iframe is loaded.

// Important: This is to override the `document.referrer` property that get sent to riddle.com for access token.
Object.defineProperty(document, "referrer", { get: () => 'http://www.riddle.com' });

// Allow iframe scrolling.
document.querySelector('html').style.overflow = 'auto'

// Global riddle ID
window.riddleID = window.data.uniqid;

// Score tracking when quiz finish
new MutationObserver(function (_, mutationInstance) {
    const scoreElement = document.querySelector('.result-score .score');
    if (scoreElement) {
        const score = scoreElement.textContent;
        const id = window.quizID;
        window.parent.postMessage({ type: 'quizFinished', id, score }, '*');
        mutationInstance.disconnect();
    }
}).observe(document, {
    childList: true,
    subtree: true
});

const obtainWSAccessToken = async () => {
    const riddleID = window.riddleID;
    const contentVersion = window.contentVersion;
    const referrer = btoa("http://www.riddle.com");
    const url = `/embed/ws/handshake/access-token/${riddleID}?v=${contentVersion}&r=${referrer}`;

    const response = await fetch(url);
    const accessToken = response.headers.get("x-access-token");
    const websocketBaseURL = response.headers.get("x-websocket-base-url");

    return { accessToken, websocketBaseURL };
}

obtainWSAccessToken().then(({ accessToken, websocketBaseURL }) => {
    const riddleId = window.riddleID;
    const blockIds = window.meta.logic.initialBlockIds;
    const blocks = window.data.blocks;
    const websocket = new WebSocket(websocketBaseURL + "/1");

    let firstRequest = true;

    window.results = [];

    websocket.onopen = () => {
        // authenticate first
        websocket.send(JSON.stringify({
            accessToken,
            commandId: 2,
            messageType: 1
        }));
    };

    websocket.onmessage = (msg) => {
        const msgJSON = JSON.parse(msg.data);

        if (Array.isArray(msgJSON.votingResult) && msgJSON.votingResult.length === 1) {
            const result = msgJSON.votingResult[0];
            const questionIndex = blockIds.indexOf(result.blockId);

            if (Array.isArray(result.correctChoiceIds) && result.correctChoiceIds.length === 1) {
                const block = blocks[questionIndex];

                if (!block) {
                    return;
                }

                const answerId = result.correctChoiceIds[0];

                window.results.push({ blockId: result.blockId, answerId });
            }
        } else if (firstRequest) {
            // The first request response is always the authentication response so we send the start msg & loop through the quiz
            const firstBlock = blockIds[0];
            websocket.send(JSON.stringify({
                commandId: 1,
                id: btoa('randomID') + Math.random().toString(),
                messageType: 1,
                riddleId,
                scope: 1,
                fwd: [
                    { riddleId, messageType: 1, commandId: 1, blockId: firstBlock, blockEvents: { core_metrics: "start" } },
                    { riddleId, messageType: 1, commandId: 1, blockId: firstBlock, blockData: [3], blockEvents: { core_metrics: "submit" } }
                ]
            }));

            firstRequest = false;

            for (let i = 1; i < blockIds.length; i++) {
                setTimeout(() => {
                    websocket.send(JSON.stringify({
                        commandId: 1,
                        id: btoa('randomID') + Math.random().toString(),
                        messageType: 1,
                        riddleId,
                        scope: 1,
                        fwd: [
                            { riddleId, messageType: 1, commandId: 1, blockId: blockIds[i], blockData: [3], blockEvents: { core_metrics: "submit" } }
                        ]
                    }));
                }, i * 100);
            }
        }
    }
});

// Function for filtering out only one right & one wrong answer
window.fiftyFifty = () => {
    const choices = document.querySelectorAll('.choice');
    const block = document.querySelector('.block');

    if (choices && block) {
        const blockId = parseInt(block.dataset.blockId);
        const arrayChoices = Array.from(choices);
        const result = window.results.find(result => result.blockId === blockId);

        // Oi! Already do 50/50. No cheating!
        if (arrayChoices.filter(choice => choice.style.opacity === '0').length > 0) {
            return;
        }

        const correctChoiceIndex = arrayChoices.findIndex(choice => parseInt(choice.dataset.choiceId) === result.answerId);

        if (correctChoiceIndex === -1) {
            return;
        }

        let randomWrongIndex;

        let safeGuard = 1000;

        while (true) {
            const randomIndex = Math.floor(Math.random() * choices.length);

            if (randomIndex !== correctChoiceIndex) {
                randomWrongIndex = randomIndex;
                break;
            }

            if (safeGuard < 0) {
                break;
            }

            safeGuard--;
        }

        choices.forEach((choice, index) => {
            if (index !== correctChoiceIndex && index !== randomWrongIndex) {
                choice.style.opacity = '0'
            }
        });
    }
}

// Function for picking a random choice in the quiz
window.randomChoice = () => {
    const choices = document.querySelectorAll('.choice');
    if (choices) {
        choices.forEach(choice => choice.style.background = '');

        const randomIndex = Math.floor(Math.random() * choices.length);
        const choice = choices[randomIndex];
        choice.style.background = 'purple';
    }
};