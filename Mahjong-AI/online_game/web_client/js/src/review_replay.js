(function () {
    const SNAPSHOT_MESSAGE = "mahjonglab-review-snapshot";
    const READY_MESSAGE = "mahjonglab-review-ready";
    let pendingPayload = null;
    let lastRenderedKey = null;
    let readySent = false;

    function hideConnectForm() {
        const form = document.getElementById("connecting-form");
        if (form) {
            form.style.display = "none";
        }
    }

    function sceneReady() {
        return (
            typeof handleMessage === "function" &&
            typeof scene !== "undefined" &&
            scene &&
            typeof scene.renderGameInfo === "function" &&
            typeof scene.resetReviewTable === "function" &&
            typeof scene.renderReviewDraw === "function"
        );
    }

    function notifyReady() {
        if (readySent) {
            return;
        }
        readySent = true;
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
        }
    }

    function renderPending() {
        hideConnectForm();
        if (!sceneReady()) {
            setTimeout(renderPending, 60);
            return;
        }

        notifyReady();
        if (!pendingPayload || !pendingPayload.startMessage) {
            return;
        }
        if (pendingPayload.snapshotKey && pendingPayload.snapshotKey === lastRenderedKey) {
            return;
        }

        hideConnectForm();
        scene.resetReviewTable();
        resetReviewGameObject();
        handleMessage({ event: "join", status: -1, message: "" });
        handleMessage(pendingPayload.startMessage);
        if (Number.isInteger(pendingPayload.reviewDrawTileId)) {
            scene.renderReviewDraw(pendingPayload.reviewDrawTileId);
        }
        lastRenderedKey = pendingPayload.snapshotKey ?? null;
        hideConnectForm();
    }

    function resetReviewGameObject() {
        if (typeof gameObj === "undefined" || !gameObj) {
            return;
        }
        gameObj.username = null;
        gameObj.seat = null;
        gameObj.machi = [];
        gameObj._furiten = false;
        gameObj.oya = null;
        gameObj._game_round = null;
        gameObj.honba = null;
        gameObj._riichi_ba = null;
        gameObj._dora_indicator = [];
        gameObj._agents = [];
        gameObj._left_num = null;
        gameObj._tiles = [];
        gameObj.furo = {};
        gameObj.furo_count = 0;
        gameObj.observe = true;
        gameObj.game_start = false;
        gameObj.end = false;
    }

    window.addEventListener("message", function (event) {
        if (event.origin !== window.location.origin) {
            return;
        }
        const data = event.data;
        if (!data || data.type !== SNAPSHOT_MESSAGE) {
            return;
        }
        pendingPayload = data.payload;
        renderPending();
    });

    window.addEventListener("load", function () {
        hideConnectForm();
        renderPending();
    });

    renderPending();
})();
