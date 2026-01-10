// /static/js/pokedex.js
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

    // Modal (legacy)
    const modalEl = document.getElementById("pokemonModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalSubtitle = document.getElementById("modalSubtitle");
    const modalSprite = document.getElementById("modalSprite");
    const modalTypes = document.getElementById("modalTypes");
    const modalStats = document.getElementById("modalStats");
    const modalInfo = document.getElementById("modalInfo");

    let bsModal = null;
    try {
        if (window.bootstrap && modalEl) bsModal = new bootstrap.Modal(modalEl);
    } catch (_) { }

    // Abort / Cache
    let aborter = null;

    const detailsCache = new Map();
    const pageCache = new Map();
    const typeCache = new Map();

    const MAX_DETAIL_CACHE = 300;
    const MAX_PAGE_CACHE = 80;
    const MAX_TYPE_CACHE = 80;

    let debounceTimer = null;
    let lastResult = null; // { state, pokes, count, hasNext, hasPrev }

    // ===== Utils
    const escapeHtml = (s) =>
        String(s).replace(/[&<>"']/g, (m) =>
        ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        }[m])
        );

    const clampInt = (v, fallback, min, max) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    };

    const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

    function typeLabelES(t) {
        const map = {
            normal: "Normal",
            fire: "Fuego",
            water: "Agua",
            electric: "Eléctrico",
            grass: "Planta",
            ice: "Hielo",
            fighting: "Lucha",
            poison: "Veneno",
            ground: "Tierra",
            flying: "Volador",
            psychic: "Psíquico",
            bug: "Bicho",
            rock: "Roca",
            ghost: "Fantasma",
            dragon: "Dragón",
            dark: "Siniestro",
            steel: "Acero",
            fairy: "Hada",
        };
        return map[t] || cap(t);
    }

    function show(el) {
        if (el) el.hidden = false;
    }
    function hide(el) {
        if (el) el.hidden = true;
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
        if (!errorEl) return;
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

        if (replace) history.replaceState({}, "", u);
        else history.pushState({}, "", u);
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
        if (typeInput) typeInput.value = s.type || "";
        if (viewInput) viewInput.value = s.view || "grid";
        if (offsetInput) offsetInput.value = String(s.offset ?? 0);

        if (qMain) qMain.value = s.q || "";
        if (qPalette) qPalette.value = s.q || "";

        if (sortSelect) sortSelect.value = s.sort || "id_asc";
        if (sortSelectPalette) sortSelectPalette.value = s.sort || "id_asc";
        if (limitSelect) limitSelect.value = String(s.limit ?? 12);

        if (metaLine) {
            metaLine.textContent =
                `limit=${s.limit} • offset=${s.offset}` +
                (s.type ? ` • type=${s.type}` : "") +
                (s.q ? ` • q=${s.q}` : "");
        }
    }

    function sameDataKey(a, b) {
        if (!a || !b) return false;
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
        const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
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
        if (detailsCache.has(k)) return detailsCache.get(k);
        const d = await fetchJson(`${API}/pokemon/${encodeURIComponent(k)}`, signal);
        cacheSetBounded(detailsCache, k, d, MAX_DETAIL_CACHE);
        return d;
    }

    async function getTypeDetail(typeName, signal) {
        const k = String(typeName).toLowerCase();
        if (typeCache.has(k)) return typeCache.get(k);
        const d = await fetchJson(`${API}/type/${encodeURIComponent(k)}`, signal);
        cacheSetBounded(typeCache, k, d, MAX_TYPE_CACHE);
        return d;
    }

    function toVM(detail) {
        const id = detail.id;
        const name = detail.name;

        const types = (detail.types || []).map((x) => x.type?.name).filter(Boolean);
        const stats = Object.fromEntries((detail.stats || []).map((s) => [s.stat?.name, s.base_stat]));

        const sprite =
            detail.sprites?.other?.["official-artwork"]?.front_default ||
            detail.sprites?.front_default ||
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

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
            spriteUrl: sprite,
        };
    }

    // ===== Loaders
    async function loadList(state, signal) {
        const key = `list|limit=${state.limit}|offset=${state.offset}`;
        if (pageCache.has(key)) return pageCache.get(key);

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
        return { pokes: [toVM(d)], count: 1, hasNext: false, hasPrev: false };
    }

    async function loadType(state, signal) {
        const key = `type|${state.type}|limit=${state.limit}|offset=${state.offset}`;
        if (pageCache.has(key)) return pageCache.get(key);

        const t = await fetchJson(`${API}/type/${encodeURIComponent(state.type)}`, signal);
        const all = (t.pokemon || []).map((x) => x.pokemon?.name).filter(Boolean);

        const slice = all.slice(state.offset, state.offset + state.limit);
        const details = await mapLimit(slice, 8, (n) => getPokemonDetail(n, signal));

        const count = all.length;
        const res = {
            pokes: details.map(toVM),
            count,
            hasPrev: state.offset > 0,
            hasNext: state.offset + state.limit < count,
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
        if (gridEl) gridEl.innerHTML = "";
        if (listEl) listEl.innerHTML = "";

        const sorted = sortPokes(pokes, state.sort);
        const total = meta.count ?? null;

        if (countBadge) countBadge.textContent = String(sorted.length);
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
            if (gridEl) hide(gridEl);
            if (listEl) show(listEl);
            sorted.forEach((p) => listEl?.insertAdjacentHTML("beforeend", listRowHTML(p)));
        } else {
            if (gridEl) show(gridEl);
            if (listEl) hide(listEl);
            sorted.forEach((p) => gridEl?.insertAdjacentHTML("beforeend", cardHTML(p)));
        }

        const from = state.offset + 1;
        const to = state.offset + sorted.length;
        if (pageMetaEl) {
            pageMetaEl.textContent = total ? `Mostrando ${from}-${to} de ${total}` : `Mostrando ${from}-${to}`;
        }
    }

    // ===== GRID: Carta (flip + detalles) + fondo por tipo
    function cardHTML(p) {
        const id3 = String(p.id).padStart(3, "0");
        const detailHref = `/pokedetail?id=${p.id}`;

        const types = (p.types || [])
            .map((t) => `<span class="type type-${escapeHtml(t)}">${escapeHtml(typeLabelES(t))}</span>`)
            .join("");

        const primaryType = (p.types?.[0] || "normal").toLowerCase();
        const artClass = `tcg-art tcg-art--${escapeHtml(primaryType)}`;

        return `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="tcg-card" data-id="${p.id}" data-detail-href="${escapeHtml(detailHref)}" role="button" tabindex="0"
             aria-label="Carta de ${escapeHtml(p.name)}">
          <div class="tcg-card-inner">

            <!-- FRONT -->
            <article class="tcg-face tcg-front">
              <div class="tcg-top">
                <div>
                  <div class="tcg-name">${escapeHtml(cap(p.name))}</div>
                  <div class="tcg-sub">Pokémon • <span class="tcg-id">#${id3}</span></div>
                </div>
                <div class="tcg-id">#${id3}</div>
              </div>

              <div class="${artClass}">
                <img class="tcg-art-img" src="${escapeHtml(p.spriteUrl)}" alt="${escapeHtml(p.name)}">
              </div>

              <div class="tcg-types">${types}</div>

              <div class="tcg-actions">
                <button class="btn btn-neo btn-neo-outline btn-sm rounded-3" type="button" data-flip>
                  <i class="bi bi-arrow-repeat me-1"></i> Voltear
                </button>

                <a class="btn btn-neo btn-neo-primary btn-sm rounded-3" href="${detailHref}">
                  <i class="bi bi-box-arrow-up-right me-1"></i> Detalles
                </a>
              </div>
            </article>

            <!-- BACK -->
            <article class="tcg-face tcg-back">
              <div class="tcg-back-head">
                <div>
                  <div class="tcg-name">${escapeHtml(cap(p.name))}</div>
                  <div class="tcg-sub">Stats + relaciones • <span class="tcg-id">#${id3}</span></div>
                </div>
                <div class="tcg-back-badges">${types}</div>
              </div>

              <div class="tcg-panel">
                <div class="tcg-section-title">Stats</div>
                <div class="tcg-meta">
                  <div class="tcg-chip"><span>HP</span><b>${escapeHtml(String(p.hp ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>ATK</span><b>${escapeHtml(String(p.atk ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>DEF</span><b>${escapeHtml(String(p.def ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>SPD</span><b>${escapeHtml(String(p.speed ?? "—"))}</b></div>
                </div>

                <div class="tcg-divider"></div>

                <div class="tcg-section-title">Debilidad / Resistencia</div>
                <div class="tcg-rel" data-slot="relations">
                  <span class="tcg-tag tcg-tag-dashed">Cargando…</span>
                </div>

                <div class="tcg-footnote">Lo demás está en <b>Detalles</b>.</div>
              </div>

              <div class="tcg-actions">
                <button class="btn btn-neo btn-neo-outline btn-sm rounded-3" type="button" data-flip>
                  <i class="bi bi-arrow-left-right me-1"></i> Volver
                </button>

                <a class="btn btn-neo btn-neo-primary btn-sm rounded-3" href="${detailHref}">
                  <i class="bi bi-box-arrow-up-right me-1"></i> Detalles
                </a>
              </div>
            </article>

          </div>
        </div>
      </div>
    `;
    }

    // ===== LIST view (legacy)
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
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-neo btn-neo-primary btn-sm rounded-3" type="button" data-open="${p.id}">
              <i class="bi bi-eye"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    }

    // ===== Back-fill: relations (SOLO 1 debilidad y 1 resistencia)
    async function buildRelations(pokemonId, signal) {
        const d = await getPokemonDetail(pokemonId, signal);
        const primaryType = d.types?.[0]?.type?.name || null;

        let rel = { weak: [], resist: [] };
        if (primaryType) {
            const td = await getTypeDetail(primaryType, signal);
            const dr = td.damage_relations || {};
            rel = {
                weak: (dr.double_damage_from || []).map((x) => x.name).filter(Boolean),
                resist: (dr.half_damage_from || []).map((x) => x.name).filter(Boolean),
            };
        }

        return { rel };
    }

    function renderRelationsIntoCard(card, data) {
        const relEl = card.querySelector('[data-slot="relations"]');
        if (!relEl) return;

        const href = card.getAttribute("data-detail-href") || "#";

        const weakAll = data.rel?.weak || [];
        const resistAll = data.rel?.resist || [];

        const weak = weakAll.slice(0, 1);
        const resist = resistAll.slice(0, 1);

        const overflow = weakAll.length > 1 || resistAll.length > 1;

        const chips = [];

        chips.push(`<span class="tcg-tag tcg-tag-dashed">Debilidad</span>`);
        chips.push(
            weakAll.length
                ? weak
                    .map((t) => `<span class="type type-${escapeHtml(t)}">${escapeHtml(typeLabelES(t))}</span>`)
                    .join("")
                : `<span class="tcg-tag">—</span>`
        );

        chips.push(`<span class="tcg-tag tcg-tag-dashed">Resiste</span>`);
        chips.push(
            resistAll.length
                ? resist
                    .map((t) => `<span class="type type-${escapeHtml(t)}">${escapeHtml(typeLabelES(t))}</span>`)
                    .join("")
                : `<span class="tcg-tag">—</span>`
        );

        if (overflow) {
            chips.push(`
        <a class="tcg-more" href="${escapeHtml(href)}" title="Ver más en Detalles">
          <i class="bi bi-plus-lg"></i> Más
        </a>
      `);
        }

        relEl.innerHTML = chips.join("");
    }

    async function ensureBackLoaded(card, signal) {
        if (!card || card.dataset.backLoaded === "1") return;
        const id = card.getAttribute("data-id");
        if (!id) return;

        card.dataset.backLoaded = "loading";
        try {
            const data = await buildRelations(id, signal);
            renderRelationsIntoCard(card, data);
            card.dataset.backLoaded = "1";
        } catch (_) {
            const relEl = card.querySelector('[data-slot="relations"]');
            if (relEl) relEl.innerHTML = `<span class="tcg-tag tcg-tag-dashed">Error</span>`;
            card.dataset.backLoaded = "0";
        }
    }

    // ✅ FLIP: vuelve a funcionar (click en botón flip O en la carta), pero NO en links
    function wireDelegatedFlip() {
        const root = gridEl || document;

        const shouldIgnoreTarget = (target) => {
            if (!target) return true;
            if (target.closest("a")) return true; // deja navegar Detalles
            if (target.closest("input, select, textarea, label")) return true;
            return false;
        };

        const toggle = async (card) => {
            if (!card) return;
            const willFlipToBack = !card.classList.contains("is-flipped");
            card.classList.toggle("is-flipped");
            if (willFlipToBack) await ensureBackLoaded(card, aborter?.signal);
        };

        root.addEventListener("click", async (e) => {
            const card = e.target.closest(".tcg-card");
            if (!card) return;

            // si clickeas en un link o input, no flip
            if (shouldIgnoreTarget(e.target)) return;

            // flip si: botón [data-flip] o click en cualquier parte de la carta
            const flipBtn = e.target.closest("[data-flip]");
            if (flipBtn || e.target.closest(".tcg-face") || e.target === card) {
                e.preventDefault();
                await toggle(card);
            }
        });

        root.addEventListener("keydown", async (e) => {
            const card = e.target.closest(".tcg-card");
            if (!card) return;

            if (e.key !== "Enter" && e.key !== " ") return;

            // si estás parado en un link o un botón, no forzamos flip por tecla
            if (e.target.closest("a, button, input, select, textarea")) return;

            e.preventDefault();
            await toggle(card);
        });
    }

    // Delegación: abrir modal (LIST view)
    function wireDelegatedOpen() {
        const handler = async (e) => {
            const btn = e.target.closest("[data-open]");
            if (!btn) return;

            const id = btn.getAttribute("data-open");
            if (!id) return;

            try {
                const d = await getPokemonDetail(id, aborter?.signal);
                openModal(toVM(d));
            } catch (_) {
                alert("No se pudo cargar el detalle.");
            }
        };

        gridEl?.addEventListener("click", handler);
        listEl?.addEventListener("click", handler);
    }

    function openModal(p) {
        if (!modalEl) return;

        if (modalTitle) modalTitle.textContent = `${cap(p.name)}  #${String(p.id).padStart(3, "0")}`;
        if (modalSubtitle) modalSubtitle.textContent = `Detalle desde PokeAPI`;

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
                .map(
                    ([k, v]) => `
          <div class="stat">
            <span>${escapeHtml(k)}</span>
            <b>${v ?? "-"}</b>
          </div>
        `
                )
                .join("");
        }

        if (modalInfo) modalInfo.innerHTML = "";
        if (bsModal) bsModal.show();
    }

    // ===== Main load
    async function load() {
        if (aborter) aborter.abort();
        aborter = new AbortController();

        const state = getUrlState();
        syncDomFromState(state);

        setLoading(true);
        hide(errorEl);
        hide(emptyEl);

        try {
            let res;

            if (state.q) {
                state.offset = 0;
                setUrlState(state, { replace: true });
                syncDomFromState(state);
                res = await loadSearch(state, aborter.signal);
            } else if (state.type) {
                res = await loadType(state, aborter.signal);
            } else {
                res = await loadList(state, aborter.signal);
            }

            setLoading(false);

            lastResult = {
                state: { ...state },
                pokes: res.pokes || [],
                count: res.count ?? null,
                hasNext: Boolean(res.hasNext),
                hasPrev: Boolean(res.hasPrev),
            };

            render(state, lastResult.pokes, { count: lastResult.count });

            const hasPrev = !state.q && (res.hasPrev ?? state.offset > 0);
            const hasNext = !state.q && Boolean(res.hasNext);

            if (prevA?.parentElement) prevA.parentElement.classList.toggle("disabled", !hasPrev);
            if (nextA?.parentElement) nextA.parentElement.classList.toggle("disabled", !hasNext);

            if (prevA) {
                prevA.onclick = (e) => {
                    e.preventDefault();
                    if (!hasPrev) return;
                    const next = { ...state, offset: Math.max(0, state.offset - state.limit) };
                    setUrlState(next, { replace: false });
                    load();
                };
            }

            if (nextA) {
                nextA.onclick = (e) => {
                    e.preventDefault();
                    if (!hasNext) return;
                    const next = { ...state, offset: state.offset + state.limit };
                    setUrlState(next, { replace: false });
                    load();
                };
            }

            if (homeA) {
                homeA.onclick = (e) => {
                    e.preventDefault();
                    const next = { ...state, offset: 0 };
                    setUrlState(next, { replace: false });
                    load();
                };
            }
        } catch (err) {
            if (err?.name === "AbortError") return;
            setLoading(false);
            setError(err?.message || String(err));
            show(emptyEl);
        }
    }

    function applyFromDom({ push = false } = {}) {
        const s = getDomState();
        setUrlState(s, { replace: !push });
        load();
    }

    // ===== Events
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            applyFromDom({ push: true });
        });
    }

    function wireSearch(input) {
        if (!input) return;

        input.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const v = input.value;

                if (qMain && qMain !== input) qMain.value = v;
                if (qPalette && qPalette !== input) qPalette.value = v;

                if (typeInput) typeInput.value = "";
                if (offsetInput) offsetInput.value = "0";

                const s = getDomState();
                s.offset = 0;
                s.type = "";
                setUrlState(s, { replace: true });
                load();
            }, 350);
        });
    }
    wireSearch(qMain);
    wireSearch(qPalette);

    function wireSort(sel) {
        if (!sel) return;

        sel.addEventListener("change", () => {
            const v = sel.value;
            if (sortSelect && sortSelect !== sel) sortSelect.value = v;
            if (sortSelectPalette && sortSelectPalette !== sel) sortSelectPalette.value = v;

            const s = getDomState();
            s.sort = v;

            setUrlState(s, { replace: false });

            if (lastResult && sameDataKey(s, lastResult.state)) {
                lastResult.state = { ...lastResult.state, view: s.view, sort: s.sort };
                syncDomFromState(s);
                render(s, lastResult.pokes, { count: lastResult.count });
                return;
            }

            load();
        });
    }
    wireSort(sortSelect);
    wireSort(sortSelectPalette);

    if (limitSelect) {
        limitSelect.addEventListener("change", () => {
            if (offsetInput) offsetInput.value = "0";
            const s = getDomState();
            s.offset = 0;

            setUrlState(s, { replace: false });
            load();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            const reset = { q: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0 };
            setUrlState(reset, { replace: false });
            syncDomFromState(reset);

            lastResult = null;
            load();
        });
    }

    window.addEventListener("popstate", () => load());

    // Init
    (function init() {
        wireDelegatedOpen();
        wireDelegatedFlip();

        const url = new URL(window.location.href);
        if (!url.search) {
            setUrlState({ q: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0 }, { replace: true });
        }
s
        syncDomFromState(getUrlState());
        load();
    })();
})();
