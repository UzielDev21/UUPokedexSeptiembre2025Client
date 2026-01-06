(() => {
    const API = "https://pokeapi.co/api/v2";

    // DOM
    const form = document.getElementById("pokedexForm");

    const typeInput = document.getElementById("typeInput");
    const viewInput = document.getElementById("viewInput");
    const offsetInput = document.getElementById("offsetInput");

    const qMain = document.getElementById("qInputMain");
    const qPalette = document.getElementById("qInputPalette");

    const sortSelect = document.getElementById("sortSelect");
    const sortSelectPalette = document.getElementById("sortSelectPalette");
    const limitSelect = document.getElementById("limitSelect");

    const clearBtn = document.getElementById("clearBtn");

    const gridEl = document.getElementById("pokeGrid");
    const listEl = document.getElementById("pokeList");

    const loadingEl = document.getElementById("loadingState");
    const errorEl = document.getElementById("errorState");
    const emptyEl = document.getElementById("emptyState");

    const countBadge = document.getElementById("countBadge");
    const metaLine = document.getElementById("metaLine");
    const pageMetaEl = document.getElementById("pageMeta");

    const prevA = document.getElementById("prevPage");
    const nextA = document.getElementById("nextPage");
    const homeA = document.getElementById("homePage");

    // Modal
    const modalEl = document.getElementById("pokemonModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalSubtitle = document.getElementById("modalSubtitle");
    const modalSprite = document.getElementById("modalSprite");
    const modalTypes = document.getElementById("modalTypes");
    const modalStats = document.getElementById("modalStats");
    const modalInfo = document.getElementById("modalInfo");

    let bsModal = null;
    try {
        if (window.bootstrap && modalEl)
            bsModal = new bootstrap.Modal(modalEl);
    } catch (_) {
    }

    // Abort / Cache
    let aborter = null;

    const detailsCache = new Map(); // key: name/id -> detail JSON
    const pageCache = new Map();    // key: list/type -> {pokes,count,hasNext,hasPrev}

    const MAX_DETAIL_CACHE = 300;
    const MAX_PAGE_CACHE = 80;

    let debounceTimer = null;

    // Último resultado renderizado (para re-render sin refetch en view/sort)
    let lastResult = null; // { state, pokes, count, hasNext, hasPrev }

    // ===== Utils
    const escapeHtml = (s) =>
        String(s).replace(/[&<>"']/g, (m) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            }[m]));

    const clampInt = (v, fallback, min, max) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n))
            return fallback;
        return Math.max(min, Math.min(max, n));
    };

    const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

    function typeLabelES(t) {
        const map = {
            normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico", grass: "Planta",
            ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador",
            psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón",
            dark: "Siniestro", steel: "Acero", fairy: "Hada",
        };
        return map[t] || cap(t);
    }

    function show(el) {
        if (el)
            el.hidden = false;
    }
    function hide(el) {
        if (el)
            el.hidden = true;
    }

    function setLoading(on) {
        if (on) {
            show(loadingEl);
            hide(errorEl);
            hide(emptyEl);
        } else {
            hide(loadingEl);
        }
    }

    function setError(msg) {
        if (!errorEl)
            return;
        errorEl.innerHTML = `
      <div class="d-flex align-items-start gap-2">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <div>
          <div class="fw-bold">Error</div>
          <div class="small">${escapeHtml(msg)}</div>
        </div>
      </div>`;
        show(errorEl);
    }

    function getUrlState() {
        const u = new URL(window.location.href);
        return {
            q: (u.searchParams.get("q") || "").trim().toLowerCase(),
            type: (u.searchParams.get("type") || "").trim().toLowerCase(),
            view: (u.searchParams.get("view") || "grid").trim().toLowerCase(),
            sort: (u.searchParams.get("sort") || "id_asc").trim().toLowerCase(),
            limit: clampInt(u.searchParams.get("limit"), 12, 1, 48),
            offset: clampInt(u.searchParams.get("offset"), 0, 0, 999999),
        };
    }

    function setUrlState(s, { replace = true } = {}) {
        const u = new URL(window.location.href);
        u.searchParams.set("q", s.q || "");
        u.searchParams.set("type", s.type || "");
        u.searchParams.set("view", s.view || "grid");
        u.searchParams.set("sort", s.sort || "id_asc");
        u.searchParams.set("limit", String(s.limit ?? 12));
        u.searchParams.set("offset", String(s.offset ?? 0));

        if (replace)
            history.replaceState({}, "", u);
        else
            history.pushState({}, "", u);
    }

    function getDomState() {
        return {
            q: (qMain?.value || qPalette?.value || "").trim().toLowerCase(),
            type: (typeInput?.value || "").trim().toLowerCase(),
            view: (viewInput?.value || "grid").trim().toLowerCase(),
            sort: (sortSelect?.value || sortSelectPalette?.value || "id_asc").trim().toLowerCase(),
            limit: clampInt(limitSelect?.value, 12, 1, 48),
            offset: clampInt(offsetInput?.value, 0, 0, 999999),
        };
    }

    function syncDomFromState(s) {
        if (typeInput)
            typeInput.value = s.type || "";
        if (viewInput)
            viewInput.value = s.view || "grid";
        if (offsetInput)
            offsetInput.value = String(s.offset ?? 0);

        if (qMain)
            qMain.value = s.q || "";
        if (qPalette)
            qPalette.value = s.q || "";

        if (sortSelect)
            sortSelect.value = s.sort || "id_asc";
        if (sortSelectPalette)
            sortSelectPalette.value = s.sort || "id_asc";

        if (limitSelect)
            limitSelect.value = String(s.limit ?? 12);

        // buttons (vista)
        const gridBtn = document.querySelectorAll('[data-view="grid"]');
        const listBtn = document.querySelectorAll('[data-view="list"]');
        gridBtn.forEach((b) => {
            b.classList.toggle("btn-neo-primary", (s.view || "grid") === "grid");
            b.classList.toggle("btn-neo-outline", (s.view || "grid") !== "grid");
        });
        listBtn.forEach((b) => {
            b.classList.toggle("btn-neo-primary", (s.view || "grid") === "list");
            b.classList.toggle("btn-neo-outline", (s.view || "grid") !== "list");
        });

        // chips active (type)
        document.querySelectorAll("[data-type]").forEach((btn) => {
            const t = (btn.getAttribute("data-type") || "").trim().toLowerCase();
            const isActive = t === (s.type || "");

            if (btn.classList.contains("chip-neo")) {
                btn.classList.toggle("chip-neo-active", isActive);
            } else {
                btn.classList.toggle("ring-active", isActive);
            }
        });

        if (metaLine) {
            metaLine.textContent =
                    `limit=${s.limit} • offset=${s.offset}` +
                    (s.type ? ` • type=${s.type}` : "") +
                    (s.q ? ` • q=${s.q}` : "");
        }
    }

    function sameDataKey(a, b) {
        // mismo dataset si coinciden: q/type/limit/offset
        if (!a || !b)
            return false;
        return (
                (a.q || "") === (b.q || "") &&
                (a.type || "") === (b.type || "") &&
                (a.limit ?? 12) === (b.limit ?? 12) &&
                (a.offset ?? 0) === (b.offset ?? 0)
                );
    }

    function cacheSetBounded(map, key, value, max) {
        if (map.size >= max && !map.has(key)) {
            const firstKey = map.keys().next().value;
            map.delete(firstKey);
        }
        map.set(key, value);
    }

    // ===== Fetch helpers
    async function fetchJson(url, signal) {
        const r = await fetch(url, {signal, headers: {Accept: "application/json"}});
        if (!r.ok)
            throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
    }

    async function mapLimit(items, limit, fn) {
        const out = new Array(items.length);
        let i = 0;
        const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
            while (i < items.length) {
                const idx = i++;
                out[idx] = await fn(items[idx], idx);
            }
        });
        await Promise.all(workers);
        return out;
    }

    async function getPokemonDetail(key, signal) {
        const k = String(key).toLowerCase();
        if (detailsCache.has(k))
            return detailsCache.get(k);

        const d = await fetchJson(`${API}/pokemon/${encodeURIComponent(k)}`, signal);
        cacheSetBounded(detailsCache, k, d, MAX_DETAIL_CACHE);
        return d;
    }

    function toVM(detail) {
        const id = detail.id;
        const name = detail.name;

        const types = (detail.types || [])
                .map((x) => x.type?.name)
                .filter(Boolean);

        const stats = Object.fromEntries(
                (detail.stats || []).map((s) => [s.stat?.name, s.base_stat])
                );

        const sprite =
                detail.sprites?.other?.["official-artwork"]?.front_default ||
                detail.sprites?.front_default ||
                `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

        // PokeAPI: height en decímetros, weight en hectogramos
        const heightM = detail.height != null ? detail.height / 10 : null; // m
        const weightKg = detail.weight != null ? detail.weight / 10 : null; // kg

        return {
            id,
            name,
            types,
            hp: stats.hp ?? null,
            atk: stats.attack ?? null,
            def: stats.defense ?? null,
            spAtk: stats["special-attack"] ?? null,
            spDef: stats["special-defense"] ?? null,
            speed: stats.speed ?? null,
            height: heightM,
            weight: weightKg,
            baseExp: detail.base_experience ?? null,
            spriteUrl: sprite,
        };
    }

    // ===== Loaders (con cache de páginas)
    async function loadList(state, signal) {
        const key = `list|limit=${state.limit}|offset=${state.offset}`;
        if (pageCache.has(key))
            return pageCache.get(key);

        const page = await fetchJson(`${API}/pokemon?limit=${state.limit}&offset=${state.offset}`, signal);
        const names = (page.results || []).map((r) => r.name);

        const details = await mapLimit(names, 8, (n) => getPokemonDetail(n, signal));
        const res = {
            pokes: details.map(toVM),
            count: page.count ?? null,
            hasNext: Boolean(page.next),
            hasPrev: Boolean(page.previous),
        };

        cacheSetBounded(pageCache, key, res, MAX_PAGE_CACHE);
        return res;
    }

    async function loadSearch(state, signal) {
        const d = await getPokemonDetail(state.q, signal);
        return {pokes: [toVM(d)], count: 1, hasNext: false, hasPrev: false};
    }

    async function loadType(state, signal) {
        const key = `type|${state.type}|limit=${state.limit}|offset=${state.offset}`;
        if (pageCache.has(key))
            return pageCache.get(key);

        const t = await fetchJson(`${API}/type/${encodeURIComponent(state.type)}`, signal);
        const all = (t.pokemon || []).map((x) => x.pokemon?.name).filter(Boolean);

        const slice = all.slice(state.offset, state.offset + state.limit);
        const details = await mapLimit(slice, 8, (n) => getPokemonDetail(n, signal));

        const count = all.length;
        const res = {
            pokes: details.map(toVM),
            count,
            hasPrev: state.offset > 0,
            hasNext: (state.offset + state.limit) < count,
        };

        cacheSetBounded(pageCache, key, res, MAX_PAGE_CACHE);
        return res;
    }

    function sortPokes(pokes, sort) {
        const arr = [...pokes];
        switch (sort) {
            case "id_desc":
                return arr.sort((a, b) => (b.id || 0) - (a.id || 0));
            case "name_asc":
                return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            case "name_desc":
                return arr.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
            case "id_asc":
            default:
                return arr.sort((a, b) => (a.id || 0) - (b.id || 0));
        }
    }

    // ===== Render
    function render(state, pokes, meta) {
        if (gridEl)
            gridEl.innerHTML = "";
        if (listEl)
            listEl.innerHTML = "";

        const sorted = sortPokes(pokes, state.sort);
        const total = meta.count ?? null;

        if (countBadge)
            countBadge.textContent = String(sorted.length);
        if (metaLine) {
            metaLine.textContent =
                    `limit=${state.limit} • offset=${state.offset}` +
                    (state.type ? ` • type=${state.type}` : "") +
                    (state.q ? ` • q=${state.q}` : "");
        }

        if (!sorted.length) {
            show(emptyEl);
            return;
        }
        hide(emptyEl);

        const view = state.view || "grid";
        if (view === "list") {
            if (gridEl)
                hide(gridEl);
            if (listEl)
                show(listEl);
            sorted.forEach((p) => listEl?.insertAdjacentHTML("beforeend", listRowHTML(p)));
        } else {
            if (gridEl)
                show(gridEl);
            if (listEl)
                hide(listEl);
            sorted.forEach((p) => gridEl?.insertAdjacentHTML("beforeend", cardHTML(p)));
        }

        const from = state.offset + 1;
        const to = state.offset + sorted.length;
        if (pageMetaEl) {
            pageMetaEl.textContent = total ? `Mostrando ${from}-${to} de ${total}` : `Mostrando ${from}-${to}`;
        }
    }

    function cardHTML(p) {
        const id3 = String(p.id).padStart(3, "0");
        const types = (p.types || [])
                .map((t) => `<span class="type type-${escapeHtml(t)}">${escapeHtml(typeLabelES(t))}</span>`)
                .join("");

        return `
      <div class="col-12 col-md-6 col-xl-4">
        <article class="poke-card" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
          <div class="poke-card-top">
            <div class="poke-id">#${id3}</div>
            <div class="poke-name">${escapeHtml(cap(p.name))}</div>
            <div class="poke-types">${types}</div>
          </div>

          <div class="poke-card-mid">
            <div class="poke-sprite-wrap">
              <img class="poke-sprite" src="${escapeHtml(p.spriteUrl)}" alt="${escapeHtml(p.name)}">
            </div>

            <div class="poke-stats">
              <div class="stat"><span>HP</span><b>${p.hp ?? "-"}</b></div>
              <div class="stat"><span>ATK</span><b>${p.atk ?? "-"}</b></div>
              <div class="stat"><span>DEF</span><b>${p.def ?? "-"}</b></div>
            </div>
          </div>

          <div class="poke-card-actions">
            <button class="btn btn-neo btn-neo-primary btn-sm rounded-3 w-100" type="button" data-open="${p.id}">
              <i class="bi bi-eye me-1"></i> Ver
            </button>
            <button class="btn btn-neo btn-neo-outline btn-sm rounded-3" type="button" disabled title="Favoritos (pendiente)">
              <i class="bi bi-heart"></i>
            </button>
          </div>
        </article>
      </div>
    `;
    }

    function listRowHTML(p) {
        const id3 = String(p.id).padStart(3, "0");
        const types = (p.types || [])
                .map((t) => `<span class="type type-${escapeHtml(t)}">${escapeHtml(typeLabelES(t))}</span>`)
                .join("");

        return `
      <div class="list-row">
        <div class="d-flex align-items-center gap-3">
          <div class="list-sprite">
            <img class="poke-sprite" src="${escapeHtml(p.spriteUrl)}" alt="${escapeHtml(p.name)}">
          </div>

          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="poke-id">#${id3}</span>
              <span class="fw-bold">${escapeHtml(cap(p.name))}</span>
              <div class="d-flex flex-wrap gap-2 ms-0 ms-md-2">${types}</div>
            </div>

            <div class="d-flex gap-2 mt-2 flex-wrap">
              <span class="mini-stat"><b>HP</b> <span>${p.hp ?? "-"}</span></span>
              <span class="mini-stat"><b>ATK</b> <span>${p.atk ?? "-"}</span></span>
              <span class="mini-stat"><b>DEF</b> <span>${p.def ?? "-"}</span></span>
              <span class="mini-stat"><b>SPD</b> <span>${p.speed ?? "-"}</span></span>
            </div>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-neo btn-neo-primary btn-sm rounded-3" type="button" data-open="${p.id}">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-neo btn-neo-outline btn-sm rounded-3" type="button" disabled>
              <i class="bi bi-heart"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    }

    // Delegación: un solo listener para abrir modal
    function wireDelegatedOpen() {
        const handler = async (e) => {
            const btn = e.target.closest("[data-open]");
            if (!btn)
                return;

            const id = btn.getAttribute("data-open");
            if (!id)
                return;

            try {
                // NO usar aborter.signal: el modal no debe abortarse por navegación/list load
                const d = await getPokemonDetail(id);
                openModal(toVM(d));
            } catch (_) {
                alert("No se pudo cargar el detalle.");
            }
        };

        gridEl?.addEventListener("click", handler);
        listEl?.addEventListener("click", handler);
    }

    function openModal(p) {
        if (!modalEl)
            return;

        if (modalTitle) {
            modalTitle.textContent = `${cap(p.name)}  #${String(p.id).padStart(3, "0")}`;
        }

        const h = (p.height != null) ? `${p.height} m` : "-";
        const w = (p.weight != null) ? `${p.weight} kg` : "-";

        if (modalSubtitle) {
            modalSubtitle.textContent = `altura=${h} • peso=${w} • baseExp=${p.baseExp ?? "-"}`;
        }

        if (modalSprite) {
            modalSprite.src = p.spriteUrl;
            modalSprite.alt = p.name;
        }

        if (modalTypes) {
            modalTypes.innerHTML = (p.types || [])
                    .map((t) => `<span class="type type-${escapeHtml(t)}">${escapeHtml(typeLabelES(t))}</span>`)
                    .join("");
        }

        const statRows = [
            ["HP", p.hp],
            ["ATK", p.atk],
            ["DEF", p.def],
            ["SpATK", p.spAtk],
            ["SpDEF", p.spDef],
            ["SPEED", p.speed],
        ];

        if (modalStats) {
            modalStats.innerHTML = statRows
                    .map(([k, v]) => `
          <div class="stat">
            <span>${escapeHtml(k)}</span>
            <b>${v ?? "-"}</b>
          </div>
        `)
                    .join("");
        }

        const infoBits = [
            ["Altura", h],
            ["Peso", w],
            ["Base Exp", p.baseExp ?? "-"],
        ];

        if (modalInfo) {
            modalInfo.innerHTML = infoBits
                    .map(([k, v]) => `
          <span class="mini-stat"><b>${escapeHtml(k)}</b> <span>${escapeHtml(String(v))}</span></span>
        `)
                    .join("");
        }

        if (bsModal)
            bsModal.show();
    }

    // ===== Main load
    async function load() {
        if (aborter)
            aborter.abort();
        aborter = new AbortController();

        const state = getUrlState();
        syncDomFromState(state);

        setLoading(true);
        hide(errorEl);
        hide(emptyEl);

        try {
            let res;

            if (state.q) {
                // Búsqueda ignora paginación
                state.offset = 0;
                setUrlState(state, {replace: true});
                syncDomFromState(state);
                res = await loadSearch(state, aborter.signal);
            } else if (state.type) {
                res = await loadType(state, aborter.signal);
            } else {
                res = await loadList(state, aborter.signal);
            }

            setLoading(false);

            // Guardar último resultado (para re-render rápido)
            lastResult = {
                state: {...state},
                pokes: res.pokes || [],
                count: res.count ?? null,
                hasNext: Boolean(res.hasNext),
                hasPrev: Boolean(res.hasPrev),
            };

            render(state, lastResult.pokes, {count: lastResult.count});

            // paginación
            const hasPrev = !state.q && (res.hasPrev ?? (state.offset > 0));
            const hasNext = !state.q && Boolean(res.hasNext);

            if (prevA?.parentElement)
                prevA.parentElement.classList.toggle("disabled", !hasPrev);
            if (nextA?.parentElement)
                nextA.parentElement.classList.toggle("disabled", !hasNext);

            if (prevA) {
                prevA.onclick = (e) => {
                    e.preventDefault();
                    if (!hasPrev)
                        return;
                    const next = {...state, offset: Math.max(0, state.offset - state.limit)};
                    setUrlState(next, {replace: false});
                    load();
                };
            }

            if (nextA) {
                nextA.onclick = (e) => {
                    e.preventDefault();
                    if (!hasNext)
                        return;
                    const next = {...state, offset: state.offset + state.limit};
                    setUrlState(next, {replace: false});
                    load();
                };
            }

            if (homeA) {
                homeA.onclick = (e) => {
                    e.preventDefault();
                    const next = {...state, offset: 0};
                    setUrlState(next, {replace: false});
                    load();
                };
            }
        } catch (err) {
            if (err?.name === "AbortError")
                return;
            setLoading(false);
            setError(err?.message || String(err));
            show(emptyEl);
        }
    }

    // ===== Apply state from DOM -> URL -> load
    function applyFromDom( { push = false } = {}) {
        const s = getDomState();
        setUrlState(s, {replace: !push});
        load();
    }

    // ===== Events
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            applyFromDom({push: true});
        });
    }

    // Debounced search (NO llena historial)
    function wireSearch(input) {
        if (!input)
            return;

        input.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const v = input.value;

                // sync ambos inputs
                if (qMain && qMain !== input)
                    qMain.value = v;
                if (qPalette && qPalette !== input)
                    qPalette.value = v;

                // opcional: si buscas por q, limpia type para evitar confusión
                if (typeInput)
                    typeInput.value = "";

                // reset offset
                if (offsetInput)
                    offsetInput.value = "0";

                const s = getDomState();
                s.offset = 0;
                s.type = ""; // aseguramos
                // ✅ replace: true para no llenar historial
                setUrlState(s, {replace: true});
                load();
            }, 350);
        });
    }
    wireSearch(qMain);
    wireSearch(qPalette);

    // Type chips
    document.querySelectorAll("[data-type]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const t = (btn.getAttribute("data-type") || "").trim().toLowerCase();
            if (typeInput)
                typeInput.value = t;
            if (offsetInput)
                offsetInput.value = "0";

            // si eliges tipo, limpia q (para coherencia visual)
            if (qMain)
                qMain.value = "";
            if (qPalette)
                qPalette.value = "";

            const s = getDomState();
            s.type = t;
            s.q = "";
            s.offset = 0;

            setUrlState(s, {replace: false});
            load();
        });
    });

    // View buttons (re-render sin refetch si dataset igual)
    document.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const v = (btn.getAttribute("data-view") || "grid").trim().toLowerCase();
            if (viewInput)
                viewInput.value = v;

            const s = getDomState();
            s.view = v;

            setUrlState(s, {replace: false});

            if (lastResult && sameDataKey(s, lastResult.state)) {
                lastResult.state = {...lastResult.state, view: s.view, sort: s.sort};
                syncDomFromState(s);
                render(s, lastResult.pokes, {count: lastResult.count});
                return;
            }

            load();
        });
    });

    // Sort change (re-render sin refetch si dataset igual)
    function wireSort(sel) {
        if (!sel)
            return;

        sel.addEventListener("change", () => {
            const v = sel.value;
            if (sortSelect && sortSelect !== sel)
                sortSelect.value = v;
            if (sortSelectPalette && sortSelectPalette !== sel)
                sortSelectPalette.value = v;

            const s = getDomState();
            s.sort = v;

            setUrlState(s, {replace: false});

            if (lastResult && sameDataKey(s, lastResult.state)) {
                lastResult.state = {...lastResult.state, view: s.view, sort: s.sort};
                syncDomFromState(s);
                render(s, lastResult.pokes, {count: lastResult.count});
                return;
            }

            load();
        });
    }
    wireSort(sortSelect);
    wireSort(sortSelectPalette);

    // Limit change
    if (limitSelect) {
        limitSelect.addEventListener("change", () => {
            if (offsetInput)
                offsetInput.value = "0";
            const s = getDomState();
            s.offset = 0;

            setUrlState(s, {replace: false});
            load();
        });
    }

    // Clear
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const reset = {q: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0};
            setUrlState(reset, {replace: false});
            syncDomFromState(reset);

            lastResult = null;
            load();
        });
    }

    // Back/forward
    window.addEventListener("popstate", () => load());

    // Init
    (function init() {
        wireDelegatedOpen();

        const url = new URL(window.location.href);
        if (!url.search) {
            setUrlState({q: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0}, {replace: true});
        } else {
            const s = getUrlState();
            if (!s.view)
                s.view = "grid";
            if (!s.sort)
                s.sort = "id_asc";
        }

        syncDomFromState(getUrlState());
        load();
    })();
})();
