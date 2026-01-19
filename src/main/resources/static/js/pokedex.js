(() => {
    "use strict";
    
    const DATA_ENDPOINT = "/pokedex/data";

    const pokedexForm = document.getElementById("pokedexForm");

    const idInput = document.getElementById("idInput");
    const nameInput = document.getElementById("nameInput");
    const typeSelect = document.getElementById("typeSelect");

    const hiddenViewInput = document.getElementById("viewInput");
    const hiddenOffsetInput = document.getElementById("offsetInput");

    const limitHidden = document.querySelector('input[name="limit"]');
    const sortHidden = document.querySelector('input[name="sort"]');

    const gridContainer = document.getElementById("pokeGrid");
    const listContainer = document.getElementById("pokeList"); // opcional

    const loadingState = document.getElementById("loadingState"); // opcional
    const errorState = document.getElementById("errorState");     // existe en tu HTML
    const emptyState = document.getElementById("emptyState");     // existe en tu HTML
    const countBadge = document.getElementById("countBadge");     // existe
    const pageMeta = document.getElementById("pageMeta");         // existe
    const metaLine = document.getElementById("metaLine");         // opcional

    const prevPageLink = document.getElementById("prevPage");
    const nextPageLink = document.getElementById("nextPage");
    const homePageLink = document.getElementById("homePage");

    const pokemonModalElement = document.getElementById("pokemonModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalSubtitle = document.getElementById("modalSubtitle");
    const modalSprite = document.getElementById("modalSprite");
    const modalTypes = document.getElementById("modalTypes");
    const modalStats = document.getElementById("modalStats");
    const modalInfo = document.getElementById("modalInfo");

    let bootstrapModalInstance = null;
    try {
        if (window.bootstrap && pokemonModalElement) {
            bootstrapModalInstance = new bootstrap.Modal(pokemonModalElement);
        }
    } catch (_) {
    }

    let activeAbortController = null;
    let debounceTimerId = null;

    const pageCache = new Map();
    const MAX_PAGE_CACHE = 80;

    let lastLoadedResult = null;

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, (m) => {
            const map = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"};
            return map[m];
        });
    }

    function clampInteger(value, fallback, min, max) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed))
            return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function capitalize(text) {
        const s = String(text || "");
        return s ? s[0].toUpperCase() + s.slice(1) : "";
    }

    function toLower(text) {
        return String(text || "").trim().toLowerCase();
    }

    function show(el) {
        if (el)
            el.hidden = false;
    }
    function hide(el) {
        if (el)
            el.hidden = true;
    }

    function setLoading(isLoading) {
        if (!loadingState)
            return;
        if (isLoading)
            show(loadingState);
        else
            hide(loadingState);
    }

    function setError(message) {
        if (!errorState)
            return;
        errorState.innerHTML = `
      <div class="d-flex align-items-start gap-2">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <div>
          <div class="fw-bold">Error</div>
          <div class="small">${escapeHtml(message)}</div>
        </div>
      </div>`;
        show(errorState);
    }

    function clearError() {
        if (!errorState)
            return;
        hide(errorState);
    }

    function setCacheBounded(cacheMap, key, value, maxSize) {
        if (cacheMap.size >= maxSize && !cacheMap.has(key)) {
            const firstKey = cacheMap.keys().next().value;
            cacheMap.delete(firstKey);
        }
        cacheMap.set(key, value);
    }

    // Estado: ahora soporta id, name, type (y conserva view/sort/limit/offset)
    function readStateFromUrl() {
        const url = new URL(window.location.href);
        return {
            id: url.searchParams.get("id") ? clampInteger(url.searchParams.get("id"), 0, 1, 999999) : null,
            name: toLower(url.searchParams.get("name") || ""),
            type: toLower(url.searchParams.get("type") || ""),
            view: toLower(url.searchParams.get("view") || "grid"),
            sort: toLower(url.searchParams.get("sort") || (sortHidden?.value || "id_asc")),
            limit: clampInteger(url.searchParams.get("limit"), clampInteger(limitHidden?.value, 12, 1, 48), 1, 48),
            offset: clampInteger(url.searchParams.get("offset"), clampInteger(hiddenOffsetInput?.value, 0, 0, 999999), 0, 999999),
        };
    }

    function writeStateToUrl(state, { replace = true } = {}) {
        const url = new URL(window.location.href);

        if (state.id)
            url.searchParams.set("id", String(state.id));
        else
            url.searchParams.delete("id");

        if (state.name)
            url.searchParams.set("name", state.name);
        else
            url.searchParams.delete("name");

        url.searchParams.set("type", state.type || "");
        url.searchParams.set("view", state.view || "grid");
        url.searchParams.set("sort", state.sort || "id_asc");
        url.searchParams.set("limit", String(state.limit ?? 12));
        url.searchParams.set("offset", String(state.offset ?? 0));

        if (replace)
            history.replaceState({}, "", url);
        else
            history.pushState({}, "", url);
    }

    function readStateFromDom() {
        const idVal = idInput?.value ? clampInteger(idInput.value, 0, 1, 999999) : null;
        const nameVal = toLower(nameInput?.value || "");
        const typeVal = toLower(typeSelect?.value || "");

        return {
            id: idVal && String(idVal).trim() !== "" ? idVal : null,
            name: nameVal,
            type: typeVal,
            view: toLower(hiddenViewInput?.value || "grid"),
            sort: toLower(sortHidden?.value || "id_asc"),
            limit: clampInteger(limitHidden?.value, 12, 1, 48),
            offset: clampInteger(hiddenOffsetInput?.value, 0, 0, 999999)
        };
    }

    function syncDomFromState(state) {
        if (idInput)
            idInput.value = state.id ? String(state.id) : "";
        if (nameInput)
            nameInput.value = state.name || "";
        if (typeSelect)
            typeSelect.value = state.type || "";

        if (hiddenViewInput)
            hiddenViewInput.value = state.view || "grid";
        if (hiddenOffsetInput)
            hiddenOffsetInput.value = String(state.offset ?? 0);

        if (limitHidden)
            limitHidden.value = String(state.limit ?? 12);
        if (sortHidden)
            sortHidden.value = state.sort || "id_asc";

        if (metaLine) {
            metaLine.textContent =
                    `limit=${state.limit} • offset=${state.offset}` +
                    (state.type ? ` • type=${state.type}` : "") +
                    (state.id ? ` • id=${state.id}` : "") +
                    (state.name ? ` • name=${state.name}` : "");
        }
    }

    function hasSameDataKey(a, b) {
        if (!a || !b)
            return false;
        return (
                (a.id || null) === (b.id || null) &&
                (a.name || "") === (b.name || "") &&
                (a.type || "") === (b.type || "") &&
                (a.limit ?? 12) === (b.limit ?? 12) &&
                (a.offset ?? 0) === (b.offset ?? 0)
                );
    }

    async function fetchJson(url, signal) {
        const resp = await fetch(url, {signal, headers: {Accept: "application/json"}});
        if (!resp.ok)
            throw new Error(`${resp.status} ${resp.statusText}`);
        return resp.json();
    }

    function buildDataUrl(state) {
        const params = new URLSearchParams();
        params.set("limit", String(state.limit ?? 12));
        params.set("offset", String(state.offset ?? 0));
        params.set("sort", state.sort || "id_asc");
        if (state.type)
            params.set("type", state.type);

        // prioridad: id > name
        if (state.id)
            params.set("id", String(state.id));
        else if (state.name)
            params.set("name", state.name);

        return `${DATA_ENDPOINT}?${params.toString()}`;
    }

    function sortPokemons(pokemons, sortKey) {
        const copy = [...pokemons];
        switch (sortKey) {
            case "id_desc":
                return copy.sort((a, b) => (b.id || 0) - (a.id || 0));
            case "name_asc":
                return copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            case "name_desc":
                return copy.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
            case "id_asc":
            default:
                return copy.sort((a, b) => (a.id || 0) - (b.id || 0));
        }
    }

    function buildTypeChipsHtml(types) {
        return (types || [])
                .map((t) => {
                    const safe = escapeHtml(String(t).toLowerCase());
                    return `<span class="type type-${safe}">${escapeHtml(capitalize(t))}</span>`;
                })
                .join("");
    }

    function buildCardHtml(p) {
        const paddedId = String(p.id).padStart(3, "0");
        const detailsHref = `/pokedetail?id=${p.id}`;
        const primaryType = String(p.types?.[0] || "normal").toLowerCase();
        const artClass = `tcg-art tcg-art--${escapeHtml(primaryType)}`;

        const typeChipsHtml = buildTypeChipsHtml(p.types);

        return `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="tcg-card js-flip-card"
             data-id="${escapeHtml(p.id)}"
             data-name="${escapeHtml(p.name)}"
             data-sprite="${escapeHtml(p.spriteUrl || "")}"
             data-types="${escapeHtml((p.types || []).join(","))}"
             data-hp="${escapeHtml(String(p.hp ?? ""))}"
             data-atk="${escapeHtml(String(p.atk ?? ""))}"
             data-def="${escapeHtml(String(p.def ?? ""))}"
             data-spatk="${escapeHtml(String(p.spAtk ?? ""))}"
             data-spdef="${escapeHtml(String(p.spDef ?? ""))}"
             data-speed="${escapeHtml(String(p.speed ?? ""))}"
             role="button" tabindex="0">

          <div class="tcg-card-inner">

            <article class="tcg-face tcg-front">
              <div class="tcg-top">
                <div>
                  <div class="tcg-name">${escapeHtml(capitalize(p.name))}</div>
                  <div class="tcg-sub">Pokémon • <span class="tcg-id">#${paddedId}</span></div>
                </div>
                <div class="tcg-id">#${paddedId}</div>
              </div>

              <div class="${artClass}">
                <img class="tcg-art-img" src="${escapeHtml(p.spriteUrl || "")}" alt="${escapeHtml(p.name)}">
              </div>

              <div class="tcg-types">${typeChipsHtml}</div>

              <div class="tcg-actions">
                <button class="btn btn-neo btn-neo-outline btn-sm rounded-3 js-flip-btn" type="button">
                  <i class="bi bi-arrow-repeat me-1"></i> Voltear
                </button>

                <a class="btn btn-neo btn-neo-primary btn-sm rounded-3" href="${escapeHtml(detailsHref)}">
                  <i class="bi bi-box-arrow-up-right me-1"></i> Detalles
                </a>
              </div>
            </article>

            <article class="tcg-face tcg-back">
              <div class="tcg-back-head">
                <div>
                  <div class="tcg-name">${escapeHtml(capitalize(p.name))}</div>
                  <div class="tcg-sub">Stats • <span class="tcg-id">#${paddedId}</span></div>
                </div>
              </div>

              <div class="tcg-panel">
                <div class="tcg-section-title">Stats</div>

                <div class="tcg-meta">
                  <div class="tcg-chip"><span>HP</span><b>${escapeHtml(String(p.hp ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>ATK</span><b>${escapeHtml(String(p.atk ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>DEF</span><b>${escapeHtml(String(p.def ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>SP.ATK</span><b>${escapeHtml(String(p.spAtk ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>SP.DEF</span><b>${escapeHtml(String(p.spDef ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>SPD</span><b>${escapeHtml(String(p.speed ?? "—"))}</b></div>
                </div>

                <div class="tcg-divider"></div>

                <div class="tcg-actions">
                  <button class="btn btn-neo btn-neo-outline btn-sm rounded-3 js-flip-btn" type="button">
                    <i class="bi bi-arrow-left-right me-1"></i> Volver
                  </button>

                  <button class="btn btn-neo btn-neo-primary btn-sm rounded-3 js-open-modal" type="button">
                    <i class="bi bi-eye me-1"></i> Ver
                  </button>
                </div>
              </div>
            </article>

          </div>
        </div>
      </div>
    `;
    }

    function renderView(state, pokemons, meta) {
        if (gridContainer)
            gridContainer.innerHTML = "";
        if (listContainer)
            listContainer.innerHTML = "";

        const sorted = sortPokemons(pokemons || [], state.sort);
        const totalCount = meta?.count ?? null;

        if (countBadge)
            countBadge.textContent = String(sorted.length);

        if (!sorted.length) {
            show(emptyState);
            return;
        }
        hide(emptyState);

        // En tu vista actual solo usas grid; list queda opcional
        if (gridContainer) {
            sorted.forEach((p) => gridContainer.insertAdjacentHTML("beforeend", buildCardHtml(p)));
        }

        const from = state.offset + 1;
        const to = state.offset + sorted.length;

        if (pageMeta) {
            pageMeta.textContent = totalCount ? `Mostrando ${from}-${to} de ${totalCount}` : `Mostrando ${from}-${to}`;
        }
    }

    function wirePagination(state, hasPrev, hasNext) {
        if (prevPageLink?.parentElement)
            prevPageLink.parentElement.classList.toggle("disabled", !hasPrev);
        if (nextPageLink?.parentElement)
            nextPageLink.parentElement.classList.toggle("disabled", !hasNext);

        if (prevPageLink) {
            prevPageLink.onclick = (e) => {
                e.preventDefault();
                if (!hasPrev)
                    return;
                const nextState = {...state, offset: Math.max(0, state.offset - state.limit)};
                writeStateToUrl(nextState, {replace: false});
                loadAndRender();
            };
        }

        if (nextPageLink) {
            nextPageLink.onclick = (e) => {
                e.preventDefault();
                if (!hasNext)
                    return;
                const nextState = {...state, offset: state.offset + state.limit};
                writeStateToUrl(nextState, {replace: false});
                loadAndRender();
            };
        }

        if (homePageLink) {
            homePageLink.onclick = (e) => {
                e.preventDefault();
                const nextState = {...state, offset: 0};
                writeStateToUrl(nextState, {replace: false});
                loadAndRender();
            };
        }
    }

    function toggleFlip(card) {
        if (!card)
            return;
        card.classList.toggle("is-flipped");
    }

    function wireDelegatedFlip() {
        const root = gridContainer || document;

        root.addEventListener("click", (e) => {
            const btn = e.target.closest(".js-flip-btn, [data-flip]");
            if (!btn)
                return;
            const card = btn.closest(".tcg-card");
            if (!card)
                return;
            e.preventDefault();
            e.stopPropagation();
            toggleFlip(card);
        });

        root.addEventListener("keydown", (e) => {
            const card = e.target.closest(".tcg-card");
            if (!card)
                return;
            if (e.key !== "Enter" && e.key !== " ")
                return;
            if (e.target.closest("a, button, input, select, textarea"))
                return;
            e.preventDefault();
            toggleFlip(card);
        });
    }

    function openModalFromCard(card) {
        if (!bootstrapModalInstance || !card)
            return;

        const id = card.dataset.id || "";
        const name = card.dataset.name || "";
        const sprite = card.dataset.sprite || "";
        const typesCsv = card.dataset.types || "";

        const hp = card.dataset.hp || "-";
        const atk = card.dataset.atk || "-";
        const def = card.dataset.def || "-";
        const spAtk = card.dataset.spatk || "-";
        const spDef = card.dataset.spdef || "-";
        const speed = card.dataset.speed || "-";

        if (modalTitle) {
            const padded = String(id).padStart(3, "0");
            modalTitle.textContent = `${capitalize(name)}  #${padded}`;
        }

        if (modalSubtitle)
            modalSubtitle.textContent = "Detalle desde tu Service";

        if (modalSprite) {
            modalSprite.src = sprite;
            modalSprite.alt = name;
        }

        if (modalTypes) {
            modalTypes.innerHTML = buildTypeChipsHtml(typesCsv.split(",").filter(Boolean));
        }

        if (modalStats) {
            modalStats.innerHTML = `
        <div class="stat"><span>HP</span><b>${escapeHtml(hp)}</b></div>
        <div class="stat"><span>ATK</span><b>${escapeHtml(atk)}</b></div>
        <div class="stat"><span>DEF</span><b>${escapeHtml(def)}</b></div>
        <div class="stat"><span>SpATK</span><b>${escapeHtml(spAtk)}</b></div>
        <div class="stat"><span>SpDEF</span><b>${escapeHtml(spDef)}</b></div>
        <div class="stat"><span>SPEED</span><b>${escapeHtml(speed)}</b></div>
      `;
        }

        if (modalInfo) {
            modalInfo.innerHTML = `
        <span class="tcg-tag">id: ${escapeHtml(id)}</span>
        <span class="tcg-tag">type: ${escapeHtml(typesCsv || "-")}</span>
      `;
        }

        bootstrapModalInstance.show();
    }

    function wireDelegatedOpenModal() {
        const root = gridContainer || document;

        root.addEventListener("click", (e) => {
            const btn = e.target.closest(".js-open-modal");
            if (!btn)
                return;
            const card = btn.closest(".tcg-card");
            if (!card)
                return;
            e.preventDefault();
            e.stopPropagation();
            openModalFromCard(card);
        });
    }

    async function loadAndRender() {
        if (activeAbortController)
            activeAbortController.abort();
        activeAbortController = new AbortController();

        const state = readStateFromUrl();
        syncDomFromState(state);

        setLoading(true);
        clearError();
        hide(emptyState);

        try {
            const cacheKey = buildDataUrl(state);

            let result;
            if (pageCache.has(cacheKey)) {
                result = pageCache.get(cacheKey);
            } else {
                result = await fetchJson(cacheKey, activeAbortController.signal);
                setCacheBounded(pageCache, cacheKey, result, MAX_PAGE_CACHE);
            }

            setLoading(false);

            // Normaliza nombres de tu DTO: el tuyo suele ser { pokes, count, hasNext, hasPrev }
            const pokes = result.pokes || result.pokemons || [];
            const count = result.count ?? result.totalCount ?? null;
            const hasNext = Boolean(result.hasNext);
            const hasPrev = Boolean(result.hasPrev);

            lastLoadedResult = {
                state: {...state},
                pokemons: pokes,
                count,
                hasNext,
                hasPrev
            };

            renderView(state, pokes, {count});

            const canGoPrev = hasPrev;
            const canGoNext = hasNext;

            wirePagination(state, canGoPrev, canGoNext);
        } catch (err) {
            if (err?.name === "AbortError")
                return;
            setLoading(false);
            setError(err?.message || String(err));
            show(emptyState);
        }
    }

    function applyStateFromDom( { pushHistory = false } = {}) {
        const state = readStateFromDom();
        state.offset = 0;
        if (hiddenOffsetInput)
            hiddenOffsetInput.value = "0";

        // prioridad: id manda, name se ignora
        if (state.id)
            state.name = "";

        writeStateToUrl(state, {replace: !pushHistory});
        loadAndRender();
    }

    function wireInputs() {
        // Evitar id + name al mismo tiempo
        if (idInput && nameInput) {
            idInput.addEventListener("input", () => {
                if (String(idInput.value || "").trim() !== "")
                    nameInput.value = "";
            });

            nameInput.addEventListener("input", () => {
                if (String(nameInput.value || "").trim() !== "")
                    idInput.value = "";
            });
        }

        // Debounce para name
        if (nameInput) {
            nameInput.addEventListener("input", () => {
                clearTimeout(debounceTimerId);
                debounceTimerId = setTimeout(() => {
                    applyStateFromDom({pushHistory: true});
                }, 350);
            });
        }

        // id: aplica directo
        if (idInput) {
            idInput.addEventListener("change", () => applyStateFromDom({pushHistory: true}));
        }

        // type: aplica directo
        if (typeSelect) {
            typeSelect.addEventListener("change", () => applyStateFromDom({pushHistory: true}));
        }
    }

    function init() {
        wireDelegatedFlip();
        wireDelegatedOpenModal();
        wireInputs();

        // Si el usuario presiona "Filtrar", no recargamos: usamos el estado
        if (pokedexForm) {
            pokedexForm.addEventListener("submit", (e) => {
                e.preventDefault();
                applyStateFromDom({pushHistory: true});
            });
        }

        window.addEventListener("popstate", () => loadAndRender());

        // Si no hay querystring, inicializa con defaults
        const url = new URL(window.location.href);
        if (!url.search) {
            writeStateToUrl(
                    {id: null, name: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0},
                    {replace: true}
            );
        }

        syncDomFromState(readStateFromUrl());
        loadAndRender();
    }

    init();
})();
