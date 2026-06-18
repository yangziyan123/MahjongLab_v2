(function () {
    const SNAPSHOT_MESSAGE = "mahjonglab-review-snapshot";
    const READY_MESSAGE = "mahjonglab-review-ready";
    const TILE_SELECTED_MESSAGE = "mahjonglab-training-tile-selected";
    let pendingPayload = null;
    let lastRenderedKey = null;
    let readySent = false;
    let trainingControlState = null;

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

    function tileIdToLabel(tileId) {
        const kind = Math.floor(tileId / 4);
        const honors = ["东", "南", "西", "北", "白", "发", "中"];
        if (kind >= 27) {
            return honors[kind - 27] || "字牌";
        }
        const suits = ["万", "筒", "索"];
        const rank = kind % 9 + 1;
        const suit = suits[Math.floor(kind / 9)] || "";
        const red = [16, 52, 88].includes(tileId) ? "赤" : "";
        return `${red}${rank}${suit}`;
    }

    function clearTrainingControls() {
        const controls = document.getElementById("training-hand-controls");
        if (controls) {
            controls.replaceChildren();
        }
    }

    function renderTrainingControls(tileIds, onSelect) {
        const controls = document.getElementById("training-hand-controls");
        const canvas = scene && scene.sys ? scene.sys.canvas : null;
        if (!controls || !canvas || !Array.isArray(tileIds) || tileIds.length === 0) {
            return;
        }

        trainingControlState = { tileIds: tileIds, onSelect: onSelect };
        clearTrainingControls();
        const canvasRect = canvas.getBoundingClientRect();
        const canvasScaleX = canvasRect.width / canvas.width;
        const canvasScaleY = canvasRect.height / canvas.height;
        const tileScale = globalScaleRate * 0.45;
        const tileWidth = 117 * tileScale;
        const tileHeight = 177 * tileScale;
        const baseLength = Number.isInteger(pendingPayload.reviewDrawTileId) ? tileIds.length - 1 : tileIds.length;
        const y = canvas.height - 60 * globalScaleRate;

        tileIds.forEach((tileId, index) => {
            const isDrawnTile = index >= baseLength;
            const x = isDrawnTile
                ? 40 * globalScaleRate + (117 + 2) * tileScale * (baseLength + 1) + 10 * tileScale
                : 40 * globalScaleRate + (117 + 2) * tileScale * (index + 1);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "training-tile-control";
            button.setAttribute("aria-label", `打出 ${tileIdToLabel(tileId)}`);
            button.title = `打出 ${tileIdToLabel(tileId)}`;
            button.style.left = `${canvasRect.left + (x - tileWidth / 2) * canvasScaleX}px`;
            button.style.top = `${canvasRect.top + (y - tileHeight / 2) * canvasScaleY}px`;
            button.style.width = `${tileWidth * canvasScaleX}px`;
            button.style.height = `${tileHeight * canvasScaleY}px`;
            button.addEventListener("click", function () {
                onSelect(index, tileId);
            });
            controls.appendChild(button);
        });
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
        const renderKey = `${pendingPayload.snapshotKey ?? "snapshot"}:${pendingPayload.interactive ? "interactive" : "readonly"}`;
        if (renderKey === lastRenderedKey) {
            return;
        }

        hideConnectForm();
        trainingControlState = null;
        clearTrainingControls();
        scene.resetReviewTable();
        resetReviewGameObject();
        handleMessage({ event: "join", status: -1, message: "" });
        handleMessage(pendingPayload.startMessage);
        if (Number.isInteger(pendingPayload.reviewDrawTileId)) {
            scene.renderReviewDraw(pendingPayload.reviewDrawTileId);
        }
        if (pendingPayload.interactive && typeof scene.setReviewTileSelectHandler === "function") {
            let selectionSent = false;
            const sendSelection = function (index, tileId) {
                if (selectionSent) {
                    return;
                }
                selectionSent = true;
                trainingControlState = null;
                scene.selectTile = false;
                clearTrainingControls();
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(
                        {
                            type: TILE_SELECTED_MESSAGE,
                            payload: {
                                snapshotKey: pendingPayload.snapshotKey ?? null,
                                index: index,
                                tileId: tileId
                            }
                        },
                        window.location.origin
                    );
                }
            };
            scene.setReviewTileSelectHandler(sendSelection);
            scene.selectTile = true;
            const tileIds = [
                ...pendingPayload.startMessage.self.tiles,
                ...(Number.isInteger(pendingPayload.reviewDrawTileId) ? [pendingPayload.reviewDrawTileId] : [])
            ];
            renderTrainingControls(tileIds, sendSelection);
        }
        lastRenderedKey = renderKey;
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

    window.addEventListener("resize", function () {
        if (!trainingControlState) {
            return;
        }
        window.requestAnimationFrame(function () {
            if (trainingControlState) {
                renderTrainingControls(trainingControlState.tileIds, trainingControlState.onSelect);
            }
        });
    });

    renderPending();
})();
