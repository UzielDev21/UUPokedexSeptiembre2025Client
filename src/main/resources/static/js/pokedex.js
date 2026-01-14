(() => {
    "use strict";

    const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";

    const pokedexForm = document.getElementById("pokedexForm");

    const hiddenTypeInput = document.getElementById("typeInput");
    const hiddenViewInput = document.getElementById("viewInput");
    const hiddenOffsetInput = document.getElementById("offsetInput");

    const searchInputMain = document.getElementById("qInputMain");
    const searchInputPalette = document.getElementById("qInputPalette");

    const sortSelectMain = document.getElementById("sortSelect");
    const sortSelectPalette = document.getElementById("sortSelectPalette");
    const limitSelect = document.getElementById("limitSelect");

    const clearButton = document.getElementById("clearBtn");

    const gridContainer = document.getElementById("pokeGrid");
    const listContainer = document.getElementById("pokeList");

    const loadingState = document.getElementById("loadingState");
    const errorState = document.getElementById("errorState");
    const emptyState = document.getElementById("emptyState");

    const countBadge = document.getElementById("countBadge");
    const metaLine = document.getElementById("metaLine");
    const pageMeta = document.getElementById("pageMeta");

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

    const pokemonDetailCache = new Map();
    const pageCache = new Map();
    const typeDetailCache = new Map();

    const MAX_POKEMON_DETAIL_CACHE = 300;
    const MAX_PAGE_CACHE = 80;
    const MAX_TYPE_DETAIL_CACHE = 80;

    let lastLoadedResult = null;

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, (match) => {
            const map = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            };
            return map[match];
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

    function show(element) {
        if (element)
            element.hidden = false;
    }

    function hide(element) {
        if (element)
            element.hidden = true;
    }

    function setLoading(isLoading) {
        if (isLoading) {
            show(loadingState);
            hide(errorState);
            hide(emptyState);
        } else {
            hide(loadingState);
        }
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

    function typeLabelSpanish(typeLowercase) {
        const dictionary = {
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
        return dictionary[typeLowercase] || capitalize(typeLowercase);
    }

    function setCacheBounded(cacheMap, key, value, maxSize) {
        if (cacheMap.size >= maxSize && !cacheMap.has(key)) {
            const firstKey = cacheMap.keys().next().value;
            cacheMap.delete(firstKey);
        }
        cacheMap.set(key, value);
    }

    function readStateFromUrl() {
        const url = new URL(window.location.href);
        return {
            query: toLower(url.searchParams.get("q") || ""),
            type: toLower(url.searchParams.get("type") || ""),
            view: toLower(url.searchParams.get("view") || "grid"),
            sort: toLower(url.searchParams.get("sort") || "id_asc"),
            limit: clampInteger(url.searchParams.get("limit"), 12, 1, 48),
            offset: clampInteger(url.searchParams.get("offset"), 0, 0, 999999),
        };
    }

    function writeStateToUrl(state, { replace = true } = {}) {
        const url = new URL(window.location.href);
        url.searchParams.set("q", state.query || "");
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
        return {
            query: toLower(searchInputMain?.value || searchInputPalette?.value || ""),
            type: toLower(hiddenTypeInput?.value || ""),
            view: toLower(hiddenViewInput?.value || "grid"),
            sort: toLower(sortSelectMain?.value || sortSelectPalette?.value || "id_asc"),
            limit: clampInteger(limitSelect?.value, 12, 1, 48),
            offset: clampInteger(hiddenOffsetInput?.value, 0, 0, 999999),
        };
    }

    function syncDomFromState(state) {
        if (hiddenTypeInput)
            hiddenTypeInput.value = state.type || "";
        if (hiddenViewInput)
            hiddenViewInput.value = state.view || "grid";
        if (hiddenOffsetInput)
            hiddenOffsetInput.value = String(state.offset ?? 0);

        if (searchInputMain)
            searchInputMain.value = state.query || "";
        if (searchInputPalette)
            searchInputPalette.value = state.query || "";

        if (sortSelectMain)
            sortSelectMain.value = state.sort || "id_asc";
        if (sortSelectPalette)
            sortSelectPalette.value = state.sort || "id_asc";
        if (limitSelect)
            limitSelect.value = String(state.limit ?? 12);

        if (metaLine) {
            metaLine.textContent =
                    `limit=${state.limit} • offset=${state.offset}` +
                    (state.type ? ` • type=${state.type}` : "") +
                    (state.query ? ` • q=${state.query}` : "");
        }
    }

    function hasSameDataKey(stateA, stateB) {
        if (!stateA || !stateB)
            return false;
        return (
                (stateA.query || "") === (stateB.query || "") &&
                (stateA.type || "") === (stateB.type || "") &&
                (stateA.limit ?? 12) === (stateB.limit ?? 12) &&
                (stateA.offset ?? 0) === (stateB.offset ?? 0)
                );
    }

    async function fetchJson(url, signal) {
        const response = await fetch(url, {signal, headers: {Accept: "application/json"}});
        if (!response.ok)
            throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
    }

    async function mapWithConcurrencyLimit(items, concurrencyLimit, asyncMapper) {
        const results = new Array(items.length);
        let sharedIndex = 0;
        const workers = new Array(Math.min(concurrencyLimit, items.length)).fill(0).map(async () => {
            while (sharedIndex < items.length) {
                const currentIndex = sharedIndex++;
                results[currentIndex] = await asyncMapper(items[currentIndex], currentIndex);
            }
        });
        await Promise.all(workers);
        return results;
    }

    async function getPokemonDetail(pokemonKeyOrName, signal) {
        const cacheKey = String(pokemonKeyOrName).toLowerCase();
        if (pokemonDetailCache.has(cacheKey))
            return pokemonDetailCache.get(cacheKey);

        const detail = await fetchJson(
                `${POKEAPI_BASE_URL}/pokemon/${encodeURIComponent(cacheKey)}`,
                signal
                );

        setCacheBounded(pokemonDetailCache, cacheKey, detail, MAX_POKEMON_DETAIL_CACHE);
        return detail;
    }

    async function getTypeDetail(typeName, signal) {
        const cacheKey = String(typeName).toLowerCase();
        if (typeDetailCache.has(cacheKey))
            return typeDetailCache.get(cacheKey);

        const detail = await fetchJson(
                `${POKEAPI_BASE_URL}/type/${encodeURIComponent(cacheKey)}`,
                signal
                );

        setCacheBounded(typeDetailCache, cacheKey, detail, MAX_TYPE_DETAIL_CACHE);
        return detail;
    }

    function toPokemonViewModel(pokemonDetail) {
        const pokemonId = pokemonDetail.id;
        const pokemonName = pokemonDetail.name;

        const typesLowercase = (pokemonDetail.types || [])
                .map((slot) => slot.type?.name)
                .filter(Boolean)
                .map((t) => String(t).toLowerCase());

        const statsMap = Object.fromEntries(
                (pokemonDetail.stats || []).map((statSlot) => [statSlot.stat?.name, statSlot.base_stat])
                );

        const spriteUrl =
                pokemonDetail.sprites?.other?.["official-artwork"]?.front_default ||
                pokemonDetail.sprites?.front_default ||
                `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;

        return {
            id: pokemonId,
            name: pokemonName,
            types: typesLowercase,
            hp: statsMap.hp ?? null,
            atk: statsMap.attack ?? null,
            def: statsMap.defense ?? null,
            spAtk: statsMap["special-attack"] ?? null,
            spDef: statsMap["special-defense"] ?? null,
            speed: statsMap.speed ?? null,
            spriteUrl,
        };
    }

    async function loadPokemonPageList(state, signal) {
        const cacheKey = `list|limit=${state.limit}|offset=${state.offset}`;
        if (pageCache.has(cacheKey))
            return pageCache.get(cacheKey);

        const page = await fetchJson(
                `${POKEAPI_BASE_URL}/pokemon?limit=${state.limit}&offset=${state.offset}`,
                signal
                );

        const pokemonNames = (page.results || []).map((r) => r.name);

        const detailList = await mapWithConcurrencyLimit(pokemonNames, 8, (name) =>
            getPokemonDetail(name, signal)
        );

        const result = {
            pokemons: detailList.map(toPokemonViewModel),
            count: page.count ?? null,
            hasNext: Boolean(page.next),
            hasPrev: Boolean(page.previous),
        };

        setCacheBounded(pageCache, cacheKey, result, MAX_PAGE_CACHE);
        return result;
    }

    async function loadPokemonBySearch(state, signal) {
        const detail = await getPokemonDetail(state.query, signal);
        return {pokemons: [toPokemonViewModel(detail)], count: 1, hasNext: false, hasPrev: false};
    }

    async function loadPokemonByType(state, signal) {
        const cacheKey = `type|${state.type}|limit=${state.limit}|offset=${state.offset}`;
        if (pageCache.has(cacheKey))
            return pageCache.get(cacheKey);

        const typeDetail = await fetchJson(
                `${POKEAPI_BASE_URL}/type/${encodeURIComponent(state.type)}`,
                signal
                );

        const allPokemonNames = (typeDetail.pokemon || [])
                .map((entry) => entry.pokemon?.name)
                .filter(Boolean);

        const slice = allPokemonNames.slice(state.offset, state.offset + state.limit);

        const detailList = await mapWithConcurrencyLimit(slice, 8, (name) =>
            getPokemonDetail(name, signal)
        );

        const totalCount = allPokemonNames.length;

        const result = {
            pokemons: detailList.map(toPokemonViewModel),
            count: totalCount,
            hasPrev: state.offset > 0,
            hasNext: state.offset + state.limit < totalCount,
        };

        setCacheBounded(pageCache, cacheKey, result, MAX_PAGE_CACHE);
        return result;
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

    function buildTypeChipsHtml(typesLowercase) {
        return (typesLowercase || [])
                .map((typeNameLowercase) => {
                    const safeType = escapeHtml(String(typeNameLowercase).toLowerCase());
                    return `<span class="type type-${safeType}">${escapeHtml(typeLabelSpanish(safeType))}</span>`;
                })
                .join("");
    }

    function buildTypeIconsHtml(typesLowercase) {
        return (typesLowercase || [])
                .slice(0, 2)
                .map((typeNameLowercase) => {
                    const typeLower = String(typeNameLowercase).toLowerCase();
                    const label = typeLabelSpanish(typeLower);
                    return `
          <span class="type-icon type-icon-${escapeHtml(typeLower)}"
                title="${escapeHtml(label)}"
                aria-label="${escapeHtml(label)}"></span>`;
                })
                .join("");
    }

    function buildCardHtml(pokemon) {
        const paddedId = String(pokemon.id).padStart(3, "0");
        const detailsHref = `/pokedetail?id=${pokemon.id}`;

        const primaryTypeLowercase = String(pokemon.types?.[0] || "normal").toLowerCase();
        const artClass = `tcg-art tcg-art--${escapeHtml(primaryTypeLowercase)}`;

        const typeChipsHtml = buildTypeChipsHtml(pokemon.types);
        const typeIconsHtml = buildTypeIconsHtml(pokemon.types);

        return `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="tcg-card"
             data-id="${pokemon.id}"
             data-detail-href="${escapeHtml(detailsHref)}"
             role="button"
             tabindex="0"
             aria-label="Carta de ${escapeHtml(pokemon.name)}">

          <div class="tcg-card-inner">

            <article class="tcg-face tcg-front">
              <div class="tcg-top">
                <div>
                  <div class="tcg-name">${escapeHtml(capitalize(pokemon.name))}</div>
                  <div class="tcg-sub">Pokémon • <span class="tcg-id">#${paddedId}</span></div>
                </div>
                <div class="tcg-id">#${paddedId}</div>
              </div>

              <div class="${artClass}">
                <img class="tcg-art-img" src="${escapeHtml(pokemon.spriteUrl)}" alt="${escapeHtml(pokemon.name)}">
              </div>

              <div class="tcg-types">${typeChipsHtml}</div>

              <div class="tcg-actions">
                <button class="btn btn-neo btn-neo-outline btn-sm rounded-3" type="button" data-flip>
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
                  <div class="tcg-name">${escapeHtml(capitalize(pokemon.name))}</div>
                  <div class="tcg-sub">Stats + relaciones • <span class="tcg-id">#${paddedId}</span></div>
                </div>
                <div class="tcg-type-icons">${typeIconsHtml}</div>
              </div>

              <div class="tcg-panel">
                <div class="tcg-section-title">Stats</div>

                <div class="tcg-meta">
                  <div class="tcg-chip"><span>HP</span><b>${escapeHtml(String(pokemon.hp ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>ATK</span><b>${escapeHtml(String(pokemon.atk ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>DEF</span><b>${escapeHtml(String(pokemon.def ?? "—"))}</b></div>
                  <div class="tcg-chip"><span>SPD</span><b>${escapeHtml(String(pokemon.speed ?? "—"))}</b></div>
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

                <a class="btn btn-neo btn-neo-primary btn-sm rounded-3" href="${escapeHtml(detailsHref)}">
                  <i class="bi bi-box-arrow-up-right me-1"></i> Detalles
                </a>
              </div>
            </article>

          </div>
        </div>
      </div>
    `;
    }

    function buildListRowHtml(pokemon) {
        const paddedId = String(pokemon.id).padStart(3, "0");
        const typeChipsHtml = buildTypeChipsHtml(pokemon.types);

        return `
      <div class="list-row">
        <div class="d-flex align-items-center gap-3">
          <div class="list-sprite">
            <img class="poke-sprite" src="${escapeHtml(pokemon.spriteUrl)}" alt="${escapeHtml(pokemon.name)}">
          </div>

          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="poke-id">#${paddedId}</span>
              <span class="fw-bold">${escapeHtml(capitalize(pokemon.name))}</span>
              <div class="d-flex flex-wrap gap-2 ms-0 ms-md-2">${typeChipsHtml}</div>
            </div>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-neo btn-neo-primary btn-sm rounded-3" type="button" data-open="${pokemon.id}">
              <i class="bi bi-eye"></i>
            </button>
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

        const sortedPokemons = sortPokemons(pokemons, state.sort);
        const totalCount = meta.count ?? null;

        if (countBadge)
            countBadge.textContent = String(sortedPokemons.length);

        if (metaLine) {
            metaLine.textContent =
                    `limit=${state.limit} • offset=${state.offset}` +
                    (state.type ? ` • type=${state.type}` : "") +
                    (state.query ? ` • q=${state.query}` : "");
        }

        if (!sortedPokemons.length) {
            show(emptyState);
            return;
        }
        hide(emptyState);

        const viewMode = state.view || "grid";

        if (viewMode === "list") {
            if (gridContainer)
                hide(gridContainer);
            if (listContainer)
                show(listContainer);
            sortedPokemons.forEach((pokemon) => {
                listContainer?.insertAdjacentHTML("beforeend", buildListRowHtml(pokemon));
            });
        } else {
            if (gridContainer)
                show(gridContainer);
            if (listContainer)
                hide(listContainer);
            sortedPokemons.forEach((pokemon) => {
                gridContainer?.insertAdjacentHTML("beforeend", buildCardHtml(pokemon));
            });
        }

        const from = state.offset + 1;
        const to = state.offset + sortedPokemons.length;

        if (pageMeta) {
            pageMeta.textContent = totalCount ? `Mostrando ${from}-${to} de ${totalCount}` : `Mostrando ${from}-${to}`;
        }
    }

    async function buildRelationsForPokemon(pokemonId, signal) {
        const pokemonDetail = await getPokemonDetail(pokemonId, signal);
        const primaryTypeLowercase = pokemonDetail.types?.[0]?.type?.name
                ? String(pokemonDetail.types[0].type.name).toLowerCase()
                : null;

        let relations = {weak: [], resist: []};

        if (primaryTypeLowercase) {
            const typeDetail = await getTypeDetail(primaryTypeLowercase, signal);
            const damageRelations = typeDetail.damage_relations || {};

            relations = {
                weak: (damageRelations.double_damage_from || []).map((x) => String(x.name).toLowerCase()).filter(Boolean),
                resist: (damageRelations.half_damage_from || []).map((x) => String(x.name).toLowerCase()).filter(Boolean),
            };
        }

        return relations;
    }

    function renderRelationsIntoCard(cardElement, relations) {
        const relationsContainer = cardElement.querySelector('[data-slot="relations"]');
        if (!relationsContainer)
            return;

        const weaknessTypes = (relations?.weak || []).map((t) => String(t).toLowerCase());
        const resistanceTypes = (relations?.resist || []).map((t) => String(t).toLowerCase());

        const weaknessPreview = weaknessTypes.slice(0, 1);
        const resistancePreview = resistanceTypes.slice(0, 1);

        const buildChip = (typeLower) =>
                `<span class="type type-${escapeHtml(typeLower)}">${escapeHtml(typeLabelSpanish(typeLower))}</span>`;

        const buildChipsOrDash = (previewList) => {
            if (!previewList.length)
                return `<span class="tcg-rel-empty">—</span>`;
            return previewList.map(buildChip).join("");
        };

        relationsContainer.innerHTML = `
      <div class="tcg-rel">
        <div class="tcg-rel-row">
          <div class="tcg-rel-label">Debilidad</div>
          <div class="tcg-rel-chips">${buildChipsOrDash(weaknessPreview)}</div>
          <span></span>
        </div>

        <div class="tcg-rel-row">
          <div class="tcg-rel-label">Resiste</div>
          <div class="tcg-rel-chips">${buildChipsOrDash(resistancePreview)}</div>
          <span></span>
        </div>
      </div>
    `;
    }

    async function ensureCardBackRelationsLoaded(cardElement, signal) {
        if (!cardElement || cardElement.dataset.backLoaded === "1")
            return;

        const pokemonId = cardElement.getAttribute("data-id");
        if (!pokemonId)
            return;

        cardElement.dataset.backLoaded = "loading";

        try {
            const relations = await buildRelationsForPokemon(pokemonId, signal);
            renderRelationsIntoCard(cardElement, relations);
            cardElement.dataset.backLoaded = "1";
        } catch (_) {
            const relationsContainer = cardElement.querySelector('[data-slot="relations"]');
            if (relationsContainer)
                relationsContainer.innerHTML = `<span class="tcg-tag tcg-tag-dashed">Error</span>`;
            cardElement.dataset.backLoaded = "0";
        }
    }

    function wireDelegatedFlip() {
        const eventRoot = gridContainer || document;

        function shouldIgnoreFlipTarget(target) {
            if (!target)
                return true;
            if (target.closest("a"))
                return true;
            if (target.closest("input, select, textarea, label"))
                return true;
            return false;
        }

        async function toggleCardFlip(cardElement) {
            if (!cardElement)
                return;

            const willFlipToBack = !cardElement.classList.contains("is-flipped");
            cardElement.classList.toggle("is-flipped");

            if (willFlipToBack) {
                await ensureCardBackRelationsLoaded(cardElement, activeAbortController?.signal);
            }
        }

        eventRoot.addEventListener("click", async (event) => {
            const cardElement = event.target.closest(".tcg-card");
            if (!cardElement)
                return;

            if (shouldIgnoreFlipTarget(event.target))
                return;

            const clickedFlipButton = event.target.closest("[data-flip]");
            if (clickedFlipButton || event.target.closest(".tcg-face") || event.target === cardElement) {
                event.preventDefault();
                await toggleCardFlip(cardElement);
            }
        });

        eventRoot.addEventListener("keydown", async (event) => {
            const cardElement = event.target.closest(".tcg-card");
            if (!cardElement)
                return;

            if (event.key !== "Enter" && event.key !== " ")
                return;
            if (event.target.closest("a, button, input, select, textarea"))
                return;

            event.preventDefault();
            await toggleCardFlip(cardElement);
        });
    }

    function wireDelegatedOpenModal() {
        async function handleOpen(event) {
            const openButton = event.target.closest("[data-open]");
            if (!openButton)
                return;

            const pokemonId = openButton.getAttribute("data-open");
            if (!pokemonId)
                return;

            try {
                const detail = await getPokemonDetail(pokemonId, activeAbortController?.signal);
                openModalWithPokemon(toPokemonViewModel(detail));
            } catch (_) {
                alert("No se pudo cargar el detalle.");
            }
        }

        gridContainer?.addEventListener("click", handleOpen);
        listContainer?.addEventListener("click", handleOpen);
    }

    function openModalWithPokemon(pokemon) {
        if (!pokemonModalElement)
            return;

        if (modalTitle)
            modalTitle.textContent = `${capitalize(pokemon.name)}  #${String(pokemon.id).padStart(3, "0")}`;
        if (modalSubtitle)
            modalSubtitle.textContent = "Detalle desde PokeAPI";

        if (modalSprite) {
            modalSprite.src = pokemon.spriteUrl;
            modalSprite.alt = pokemon.name;
        }

        if (modalTypes)
            modalTypes.innerHTML = buildTypeChipsHtml(pokemon.types);

        const statsRows = [
            ["HP", pokemon.hp],
            ["ATK", pokemon.atk],
            ["DEF", pokemon.def],
            ["SpATK", pokemon.spAtk],
            ["SpDEF", pokemon.spDef],
            ["SPEED", pokemon.speed],
        ];

        if (modalStats) {
            modalStats.innerHTML = statsRows
                    .map(
                            ([label, value]) => `
          <div class="stat">
            <span>${escapeHtml(label)}</span>
            <b>${value ?? "-"}</b>
          </div>
        `
                    )
                    .join("");
        }

        if (modalInfo)
            modalInfo.innerHTML = "";
        if (bootstrapModalInstance)
            bootstrapModalInstance.show();
    }

    function wirePagination(state, hasPrev, hasNext) {
        if (prevPageLink?.parentElement)
            prevPageLink.parentElement.classList.toggle("disabled", !hasPrev);
        if (nextPageLink?.parentElement)
            nextPageLink.parentElement.classList.toggle("disabled", !hasNext);

        if (prevPageLink) {
            prevPageLink.onclick = (event) => {
                event.preventDefault();
                if (!hasPrev)
                    return;
                const nextState = {...state, offset: Math.max(0, state.offset - state.limit)};
                writeStateToUrl(nextState, {replace: false});
                loadAndRender();
            };
        }

        if (nextPageLink) {
            nextPageLink.onclick = (event) => {
                event.preventDefault();
                if (!hasNext)
                    return;
                const nextState = {...state, offset: state.offset + state.limit};
                writeStateToUrl(nextState, {replace: false});
                loadAndRender();
            };
        }

        if (homePageLink) {
            homePageLink.onclick = (event) => {
                event.preventDefault();
                const nextState = {...state, offset: 0};
                writeStateToUrl(nextState, {replace: false});
                loadAndRender();
            };
        }
    }

    async function loadAndRender() {
        if (activeAbortController)
            activeAbortController.abort();
        activeAbortController = new AbortController();

        const state = readStateFromUrl();
        syncDomFromState(state);

        setLoading(true);
        hide(errorState);
        hide(emptyState);

        try {
            let result;

            if (state.query) {
                state.offset = 0;
                writeStateToUrl(state, {replace: true});
                syncDomFromState(state);
                result = await loadPokemonBySearch(state, activeAbortController.signal);
            } else if (state.type) {
                result = await loadPokemonByType(state, activeAbortController.signal);
            } else {
                result = await loadPokemonPageList(state, activeAbortController.signal);
            }

            setLoading(false);

            lastLoadedResult = {
                state: {...state},
                pokemons: result.pokemons || [],
                count: result.count ?? null,
                hasNext: Boolean(result.hasNext),
                hasPrev: Boolean(result.hasPrev),
            };

            renderView(state, lastLoadedResult.pokemons, {count: lastLoadedResult.count});

            const canGoPrev = !state.query && (result.hasPrev ?? state.offset > 0);
            const canGoNext = !state.query && Boolean(result.hasNext);

            wirePagination(state, canGoPrev, canGoNext);
        } catch (error) {
            if (error?.name === "AbortError")
                return;
            setLoading(false);
            setError(error?.message || String(error));
            show(emptyState);
        }
    }

    function applyStateFromDom( { pushHistory = false } = {}) {
        const state = readStateFromDom();
        writeStateToUrl(state, {replace: !pushHistory});
        loadAndRender();
    }

    function wireSearchInput(inputElement) {
        if (!inputElement)
            return;

        inputElement.addEventListener("input", () => {
            clearTimeout(debounceTimerId);
            debounceTimerId = setTimeout(() => {
                const newQuery = inputElement.value;

                if (searchInputMain && searchInputMain !== inputElement)
                    searchInputMain.value = newQuery;
                if (searchInputPalette && searchInputPalette !== inputElement)
                    searchInputPalette.value = newQuery;

                if (hiddenTypeInput)
                    hiddenTypeInput.value = "";
                if (hiddenOffsetInput)
                    hiddenOffsetInput.value = "0";

                const state = readStateFromDom();
                state.offset = 0;
                state.type = "";

                writeStateToUrl(state, {replace: true});
                loadAndRender();
            }, 350);
        });
    }

    function wireSortSelect(selectElement) {
        if (!selectElement)
            return;

        selectElement.addEventListener("change", () => {
            const selectedSort = selectElement.value;

            if (sortSelectMain && sortSelectMain !== selectElement)
                sortSelectMain.value = selectedSort;
            if (sortSelectPalette && sortSelectPalette !== selectElement)
                sortSelectPalette.value = selectedSort;

            const state = readStateFromDom();
            state.sort = selectedSort;

            writeStateToUrl(state, {replace: false});

            if (lastLoadedResult && hasSameDataKey(state, lastLoadedResult.state)) {
                lastLoadedResult.state = {...lastLoadedResult.state, view: state.view, sort: state.sort};
                syncDomFromState(state);
                renderView(state, lastLoadedResult.pokemons, {count: lastLoadedResult.count});
                return;
            }

            loadAndRender();
        });
    }

    function wireLimitSelect() {
        if (!limitSelect)
            return;

        limitSelect.addEventListener("change", () => {
            if (hiddenOffsetInput)
                hiddenOffsetInput.value = "0";
            const state = readStateFromDom();
            state.offset = 0;
            writeStateToUrl(state, {replace: false});
            loadAndRender();
        });
    }

    function wireClearButton() {
        if (!clearButton)
            return;

        clearButton.addEventListener("click", () => {
            const resetState = {query: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0};
            writeStateToUrl(resetState, {replace: false});
            syncDomFromState(resetState);
            lastLoadedResult = null;
            loadAndRender();
        });
    }

    function init() {
        wireDelegatedOpenModal();
        wireDelegatedFlip();

        wireSearchInput(searchInputMain);
        wireSearchInput(searchInputPalette);

        wireSortSelect(sortSelectMain);
        wireSortSelect(sortSelectPalette);

        wireLimitSelect();
        wireClearButton();

        if (pokedexForm) {
            pokedexForm.addEventListener("submit", (event) => {
                event.preventDefault();
                applyStateFromDom({pushHistory: true});
            });
        }

        window.addEventListener("popstate", () => loadAndRender());

        const currentUrl = new URL(window.location.href);
        if (!currentUrl.search) {
            writeStateToUrl({query: "", type: "", view: "grid", sort: "id_asc", limit: 12, offset: 0}, {replace: true});
        }

        syncDomFromState(readStateFromUrl());
        loadAndRender();
    }

    init();
})();
