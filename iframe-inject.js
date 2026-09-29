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
    let requestToken = accessToken;
    let requestSequence = 0;
    const pendingRequests = new Map();

    const sendAndWait = (payload) => new Promise((resolve) => {
        const id = `${requestToken}_${Math.random().toString(36).slice(2)}_${++requestSequence}`;
        pendingRequests.set(id, resolve);
        websocket.send(JSON.stringify({ ...payload, id }));
    });
    const wait = (duration) => new Promise(resolve => setTimeout(resolve, duration));

    const getChoiceIds = (block) => {
        const ids = [];
        const visit = (value, key = '', inChoiceData = false) => {
            if (!value || typeof value !== 'object') return;
            const choiceData = inChoiceData || /choice|answer|option|quizItems/i.test(key);

            if (Array.isArray(value)) {
                if (choiceData) {
                    for (const item of value) {
                        if (Number.isInteger(item)) {
                            ids.push(item);
                        } else {
                            const id = Number(item?.choiceId ?? item?.answerId ?? item?.id);
                            if (Number.isInteger(id)) ids.push(id);
                        }
                    }
                }
                value.forEach(item => visit(item, '', choiceData));
                return;
            }

            for (const [childKey, child] of Object.entries(value)) {
                if (choiceData && /^(choiceId|answerId|id)$/i.test(childKey) && Number.isInteger(child)) {
                    ids.push(child);
                }
                visit(child, childKey, choiceData);
            }
        };

        visit(block);
        return [...new Set(ids)];
    };

    const getBlockData = (block) => {
        if (block?.type === "TextEntry") {
            return [Math.random().toString(36).slice(2, 10)];
        }

        const choiceIds = getChoiceIds(block);
        return choiceIds.length > 0 ? [choiceIds[0]] : null;
    };

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

        // The handshake rotates the access token; subsequent command IDs use it.
        if (msgJSON.commandId === 2 && msgJSON.success && msgJSON.accessToken) {
            requestToken = msgJSON.accessToken;
        }

        // Resolve only the request acknowledged by this response. This keeps
        // block submissions ordered even if the server also sends other events.
        if (msgJSON.id && pendingRequests.has(msgJSON.id)) {
            pendingRequests.get(msgJSON.id)(msgJSON);
            pendingRequests.delete(msgJSON.id);
        }

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
            // The first response is the authentication response.
            const firstBlock = blockIds[0];
            void (async () => {
                const firstBlockData = blocks[blockIds.indexOf(firstBlock)];
                const firstSubmissionData = getBlockData(firstBlockData);
                if (!firstSubmissionData) {
                    console.error(`No submission data found for block ${firstBlock}; stopping quiz submission.`, firstBlockData);
                    return;
                }

                const firstResponse = await sendAndWait({
                    commandId: 1,
                    messageType: 1,
                    riddleId,
                    scope: 1,
                    fwd: [
                        { riddleId, messageType: 1, commandId: 1, blockId: firstBlock, blockEvents: { core_metrics: "start" } },
                        { riddleId, messageType: 1, commandId: 1, blockId: firstBlock, blockData: firstSubmissionData, blockEvents: { core_metrics: "submit" } }
                    ]
                });
                if (!firstResponse.success) return;

                for (let i = 1; i < blockIds.length; i++) {
                    const blockId = blockIds[i];
                    const block = blocks[blockIds.indexOf(blockId)];

                    // Ads and other non-quiz blocks do not have answer choices.
                    if (block?.typeGroup !== "Quiz") {
                        continue;
                    }

                    // Match the time the normal client spends moving to the next block.
                    // await wait(900);
                    const viewResponse = await sendAndWait({
                        commandId: 1,
                        messageType: 1,
                        riddleId,
                        scope: 1,
                        fwd: [
                            { riddleId, messageType: 1, commandId: 1, blockId, blockEvents: { core_metrics: "view" } }
                        ]
                    });
                    if (!viewResponse.success) return;

                    // Allow the viewed block's timer/state to settle before submitting.
                    // await wait(900);
                    const submissionData = getBlockData(block);
                    if (!submissionData) {
                        console.error(`No submission data found for block ${blockId}; stopping quiz submission.`, block);
                        return;
                    }

                    const submitResponse = await sendAndWait({
                        commandId: 1,
                        messageType: 1,
                        riddleId,
                        scope: 1,
                        fwd: [
                            { riddleId, messageType: 1, commandId: 1, blockId, blockData: submissionData, blockEvents: { core_metrics: "submit" } }
                        ]
                    });
                    if (!submitResponse.success) return;
                }
            })();
            firstRequest = false;
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

// Monty Hall lifeline: turn each answer into a door. Opening a door reveals
// whether it hides the car (correct answer) or a goat (wrong answer).
(() => {
    const state = {
        armed: false,
        passthrough: false,
        blockId: null,
        choiceLayout: null,
        choiceStyles: new Map(),
        lockedChoiceId: null,
        revealing: false,
    };

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

        const choiceContainer = choices[0].parentElement;
        state.choiceLayout = {
            element: choiceContainer,
            display: choiceContainer.style.display,
            flexDirection: choiceContainer.style.flexDirection,
            flexWrap: choiceContainer.style.flexWrap,
            justifyContent: choiceContainer.style.justifyContent,
            gap: choiceContainer.style.gap,
        };
        Object.assign(choiceContainer.style, {
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            justifyContent: 'center',
            gap: '12px',
        });

        for (const choice of choices) {
            choice.dataset.montyHallDoor = 'true';
            state.choiceStyles.set(choice, {
                height: choice.style.height,
                minHeight: choice.style.minHeight,
                flex: choice.style.flex,
                color: choice.style.color,
            });
            const door = document.createElement('span');
            door.className = 'monty-hall-door';
            door.textContent = choice.innerText;
            Object.assign(door.style, {
                position: 'absolute', inset: '0', zIndex: '5', display: 'flex',
                alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: '100%',
                padding: '12px', textAlign: 'center', lineHeight: '1.1', color: '#fff',
                overflow: 'hidden', overflowWrap: 'anywhere',
                fontSize: 'clamp(22px, 3vw, 36px)',
                background: 'linear-gradient(110deg, #8b4513, #c87938 48%, #8b4513)',
                border: '5px solid #5b2d0b', borderRadius: '8px',
                boxShadow: 'inset 0 0 0 3px #e7b16f, 0 5px 10px #0005',
                cursor: 'pointer',
            });
            choice.style.position = 'relative';
            choice.style.overflow = 'hidden';
            choice.style.height = '220px';
            choice.style.minHeight = '220px';
            choice.style.flex = '1 1 200px';
            choice.style.color = 'transparent';
            Array.from(choice.children).forEach(child => child.style.visibility = 'hidden');
            choice.appendChild(door);
        }

        // Capture phase so the quiz never sees the clicks we're stealing.
        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
            document.addEventListener(type, interceptor, true);
        }

        banner('🚪 Choose a door to lock in your answer.', true);
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

        if (choice.style.opacity === '0' || choice.dataset.montyHallOpened === 'true' || state.revealing) {
            return;
        }

        if (state.lockedChoiceId === null) {
            state.lockedChoiceId = choiceId(choice);
            choice.style.outline = '4px solid #7c3aed';
            choice.style.outlineOffset = '-4px';
            const lockedDoor = choice.querySelector('.monty-hall-door');
            lockedDoor.style.background = 'linear-gradient(135deg, #f7d51d, #fff176 48%, #e6a700)';
            lockedDoor.style.borderColor = '#a66b00';
            lockedDoor.style.color = '#422b00';
            state.revealing = true;
            banner('🔒 Answer locked! Monty is opening a goat door…', true);

            setTimeout(() => {
                if (!state.armed || !choice.isConnected) return;
                const answerId = window.results.find(result => result.blockId === state.blockId).answerId;
                const wrongDoors = liveChoices().filter(other =>
                    choiceId(other) !== answerId && choiceId(other) !== state.lockedChoiceId
                );
                state.revealing = false;
                if (!wrongDoors.length) {
                    banner('No goat door can be opened. Choose an answer to finish.', true);
                    return;
                }
                const goatChoice = wrongDoors[Math.floor(Math.random() * wrongDoors.length)];
                const goatDoor = goatChoice.querySelector('.monty-hall-door');
                goatChoice.dataset.montyHallOpened = 'true';
                goatDoor.textContent = '🐐';
                goatDoor.style.background = 'linear-gradient(135deg, #8b342d, #d66b5b)';
                goatDoor.style.borderColor = '#65201b';
                banner('🐐 Monty opened a goat! Switch doors or choose your locked door to stay.', true);
            }, 900);
            return;
        }

        if (choice.dataset.montyHallOpened === 'true') return;
        finish(choice);
    }

    function finish(choice) {
        const answerId = window.results.find(result => result.blockId === state.blockId).answerId;
        const correct = choiceId(choice) === answerId;
        choice.dataset.montyHallOpened = 'true';
        const door = choice.querySelector('.monty-hall-door');
        door.textContent = correct ? '🚗' : '🐐';
        door.style.background = correct ? 'linear-gradient(135deg, #287a37, #61b94f)' : 'linear-gradient(135deg, #8b342d, #d66b5b)';
        door.style.borderColor = correct ? '#155524' : '#65201b';
        banner(correct ? '🚗 You found the car!' : '🐐 A goat!');

        setTimeout(() => {
            if (!choice.isConnected) return;
            disarm();
            for (const other of document.querySelectorAll('.choice')) {
                other.querySelector('.monty-hall-door')?.remove();
                Array.from(other.children).forEach(child => child.style.visibility = '');
                other.style.position = '';
                other.style.overflow = '';
                other.style.outline = '';
                other.style.outlineOffset = '';
                const originalStyles = state.choiceStyles.get(other);
                if (originalStyles) Object.assign(other.style, originalStyles);
                state.choiceStyles.delete(other);
                delete other.dataset.montyHallDoor;
                delete other.dataset.montyHallOpened;
            }
            if (state.choiceLayout?.element) {
                const { element, ...styles } = state.choiceLayout;
                Object.assign(element.style, styles);
                state.choiceLayout = null;
            }
            state.passthrough = true;
            replayClick(choice);
            state.passthrough = false;
        }, 900);
    }

    function abort() {
        disarm();
        window.parent.postMessage({ type: 'montyHallAborted' }, '*');
    }

    function disarm() {
        state.armed = false;
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
