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

// Remove Google Ads.
const googleAdElement = document.querySelector('.ad.ad--bottom');
googleAdElement?.remove();

// Technically this is a leaking event listener, as it isn't cleaned up. But it's in an iframe, so it doesn't matter (not our origin, it'll get closed).
document.addEventListener("keydown", keydownHandler, false);

function keydownHandler(event) {
    if (event.key === "Escape") {
        window.parent.postMessage({ type: 'quizClose' }, '*');
    }
}

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

// Monty Hall lifeline: lock in an answer, one of the wrong answers you didn't
// pick gets revealed, then you can switch to another answer or stay with your
// pick. Staying just submits your pick and the quiz carries on as normal.
(() => {
    const state = {
        armed: false,
        passthrough: false,
        revealing: false,
        blockId: null,
        lockedChoiceId: null,
    };

    let revealTimeout;

    // Choices dimmed to nothing were removed by the 50:50 lifeline.
    const liveChoices = () =>
        Array.from(document.querySelectorAll('.choice')).filter(choice => choice.style.opacity !== '0');

    const choiceId = (choice) => parseInt(choice.dataset.choiceId);

    window.montyHall = () => {
        if (state.armed) {
            return;
        }

        const block = document.querySelector('.block');
        const choices = liveChoices();

        if (!block || choices.length < 3) {
            banner("Monty Hall needs at least 3 answers to play with!");
            abort();
            return;
        }

        const blockId = parseInt(block.dataset.blockId);

        if (!window.results?.some(result => result.blockId === blockId)) {
            banner("Monty Hall hasn't peeked at this question yet. Try again in a sec!");
            abort();
            return;
        }

        state.armed = true;
        state.blockId = blockId;
        state.lockedChoiceId = null;

        // Capture phase so the quiz never sees the clicks we're stealing.
        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
            document.addEventListener(type, interceptor, true);
        }

        banner('🐐 Monty Hall: click an answer to lock it in.', true);
    };

    function interceptor(event) {
        if (state.passthrough) {
            return;
        }

        const choice = event.target.closest?.('.choice');

        if (!choice) {
            return;
        }

        // The quiz moved on without us (its own submit button, say), so let go.
        if (parseInt(choice.closest('.block')?.dataset.blockId) !== state.blockId) {
            disarm();
            return;
        }

        // Swallow everything aimed at a choice, so only the clicks we replay
        // reach the quiz.
        event.preventDefault();
        event.stopImmediatePropagation();

        if (event.type !== 'click') {
            return;
        }

        if (choice.style.opacity === '0' || choice.dataset.montyHallRevealed === 'true') {
            return;
        }

        // Mid-reveal: hold the drumroll, no committing yet.
        if (state.revealing) {
            return;
        }

        if (state.lockedChoiceId === null) {
            lockIn(choice);
        } else {
            commit(choice);
        }
    }

    function lockIn(choice) {
        state.lockedChoiceId = choiceId(choice);
        choice.style.outline = '4px solid purple';
        choice.style.outlineOffset = '-4px';

        const answerId = window.results.find(result => result.blockId === state.blockId).answerId;
        const revealable = liveChoices().filter(
            other => choiceId(other) !== answerId && choiceId(other) !== state.lockedChoiceId,
        );

        if (!revealable.length) {
            // Nothing left to reveal, so there's nothing to switch to either.
            banner('No wrong answer left to reveal — locking that in!');
            commit(choice);
            return;
        }

        state.revealing = true;
        banner('🐐 Locked in! Looking for a wrong answer...', true);

        revealTimeout = setTimeout(() => {
            state.revealing = false;

            // The quiz may have moved on while we were being dramatic.
            if (!state.armed || !choice.isConnected) {
                return;
            }

            const revealed = revealable[Math.floor(Math.random() * revealable.length)];
            revealed.dataset.montyHallRevealed = 'true';
            revealed.style.outline = '4px solid red';
            revealed.style.outlineOffset = '-4px';

            banner('🐐 A wrong answer highlighted! Click another answer to switch, or click your pick again to stay.', true);
        }, 1000);
    }

    function commit(choice) {
        const switched = choiceId(choice) !== state.lockedChoiceId;

        disarm();
        banner(switched ? 'Switched! 🐐' : 'Sticking with it! 🐐');

        for (const other of document.querySelectorAll('.choice')) {
            other.style.outline = '';
            other.style.outlineOffset = '';
            delete other.dataset.montyHallRevealed;
        }

        // Replay the click for real so the quiz registers the answer, whether it
        // submits on click or waits for its own submit button.
        state.passthrough = true;
        replayClick(choice);
        state.passthrough = false;
    }

    function abort() {
        disarm();
        window.parent.postMessage({ type: 'montyHallAborted' }, '*');
    }

    function disarm() {
        state.armed = false;
        state.revealing = false;
        clearTimeout(revealTimeout);
        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
            document.removeEventListener(type, interceptor, true);
        }
    }

    function replayClick(element) {
        const init = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 };
        const pointerInit = { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true };
        element.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
        element.dispatchEvent(new MouseEvent('mousedown', init));
        element.dispatchEvent(new PointerEvent('pointerup', pointerInit));
        element.dispatchEvent(new MouseEvent('mouseup', init));
        element.click();
    }

    let bannerTimeout;
    function banner(text, persist = false) {
        let element = document.getElementById('monty-hall-banner');

        if (!element) {
            element = document.createElement('div');
            element.id = 'monty-hall-banner';
            Object.assign(element.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                zIndex: '9999',
                padding: '10px',
                background: 'purple',
                color: 'white',
                font: 'bold 14px sans-serif',
                textAlign: 'center',
            });
            document.body.appendChild(element);
        }

        element.textContent = text;
        clearTimeout(bannerTimeout);

        if (!persist) {
            bannerTimeout = setTimeout(() => element.remove(), 3000);
        }
    }
})();
