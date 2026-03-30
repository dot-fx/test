class AnimeAV1 extends Anime {
    api = "https://animeav1.com";
    cdnUrl = "https://cdn.animeav1.com";

    getSettings() {
        return {
            episodeServers: ["HLS"],
            supportsDub: true,
        };
    }

    getFilters() {

        return {

            letter: {
                label: 'Letra',
                type: 'select',
                options: [
                    { value: '#', label: '#' },
                    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => ({
                        value: l,
                        label: l
                    }))
                ]
            },
            category: {
                label: 'Tipo',
                type: 'multiselect',
                options: [
                    { value: 'tv-anime', label: 'TV Anime' },
                    { value: 'pelicula', label: 'Película' },
                    { value: 'ova', label: 'OVA' },
                    { value: 'ona', label: 'ONA' },
                    { value: 'especial', label: 'Especial' }
                ]
            },
            genre: {
                label: 'Género',
                type: 'multiselect',
                options: [
                    { value: 'accion', label: 'Acción' },
                    { value: 'aventura', label: 'Aventura' },
                    { value: 'ciencia-ficcion', label: 'Ciencia Ficción' },
                    { value: 'comedia', label: 'Comedia' },
                    { value: 'deportes', label: 'Deportes' },
                    { value: 'drama', label: 'Drama' },
                    { value: 'fantasia', label: 'Fantasía' },
                    { value: 'misterio', label: 'Misterio' },
                    { value: 'recuentos-de-la-vida', label: 'Recuentos de la Vida' },
                    { value: 'romance', label: 'Romance' },
                    { value: 'seinen', label: 'Seinen' },
                    { value: 'shoujo', label: 'Shoujo' },
                    { value: 'shounen', label: 'Shounen' },
                    { value: 'sobrenatural', label: 'Sobrenatural' },
                    { value: 'suspenso', label: 'Suspenso' },
                    { value: 'terror', label: 'Terror' },
                    { value: 'artes-marciales', label: 'Artes Marciales' },
                    { value: 'ecchi', label: 'Ecchi' },
                    { value: 'escolares', label: 'Escolares' },
                    { value: 'gore', label: 'Gore' },
                    { value: 'harem', label: 'Harem' },
                    { value: 'historico', label: 'Histórico' },
                    { value: 'isekai', label: 'Isekai' },
                    { value: 'josei', label: 'Josei' },
                    { value: 'magia', label: 'Magia' },
                    { value: 'mecha', label: 'Mecha' },
                    { value: 'militar', label: 'Militar' },
                    { value: 'mitologia', label: 'Mitología' },
                    { value: 'musica', label: 'Música' },
                    { value: 'parodia', label: 'Parodia' },
                    { value: 'psicologico', label: 'Psicológico' },
                    { value: 'superpoderes', label: 'Superpoderes' },
                    { value: 'vampiros', label: 'Vampiros' },
                    { value: 'yuri', label: 'Yuri' },
                    { value: 'yaoi', label: 'Yaoi' }
                ]
            },
            year: {
                label: 'Año (Máximo)',
                type: 'number'
            },
            status: {
                label: 'Estado',
                type: 'select',
                options: [
                    { value: 'emision', label: 'En emisión' },
                    { value: 'finalizado', label: 'Finalizado' },
                    { value: 'proximamente', label: 'Próximamente' }
                ]
            },
            order: {
                label: 'Ordenar por',
                type: 'select',
                options: [
                    { value: 'default', label: 'Por defecto' },
                    { value: 'updated', label: 'Recientes' },
                    { value: 'likes', label: 'Populares' },
                    { value: 'title', label: 'Alfabético' }
                ]
            }
        };
    }

    _findSvelteData(json, targetKey) {
        if (!json || !json.nodes) return { data: null, root: null };

        for (const node of json.nodes) {
            if (node && node.data) {
                const root = node.data.find(item => item && typeof item === 'object' && targetKey in item);
                if (root) return { data: node.data, root };
            }
        }
        return { data: null, root: null };
    }

    async search({ query, filters }) {
        if (query && (!filters || Object.keys(filters).length === 0)) {
            const res = await fetch(`${this.api}/api/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });

            if (!res.ok) return [];
            const data = await res.json();

            return data.map(anime => ({
                id: anime.slug,
                title: anime.title,
                url: `${this.api}/media/${anime.slug}`,
                image: `${this.cdnUrl}/covers/${anime.id}.jpg`,
            }));
        }

        const params = new URLSearchParams();
        params.append('page', '1');

        if (query) params.append('search', query);

        if (filters) {
            if (filters.category) {
                String(filters.category).split(',').forEach(c => c.trim() && params.append('category', c.trim()));
            }
            if (filters.genre) {
                String(filters.genre).split(',').forEach(g => g.trim() && params.append('genre', g.trim()));
            }
            if (filters.year) params.set('maxYear', String(filters.year));
            if (filters.status) params.set('status', filters.status);
            if (filters.letter) params.set('letter', filters.letter);
            if (filters.order && filters.order !== 'default') params.set('order', filters.order);
        }

        const res = await fetch(`${this.api}/catalogo/__data.json?${params.toString()}`);
        if (!res.ok) return [];
        const json = await res.json();

        const { data, root } = this._findSvelteData(json, 'results');
        if (!data || !root || typeof root.results !== 'number') return [];

        const resultsArray = data[root.results];
        if (!Array.isArray(resultsArray)) return [];

        return resultsArray.map(ptr => {
            const obj = data[ptr];
            if (!obj) return null;

            const realId = data[obj.id];
            const title = data[obj.title];
            const slug = data[obj.slug];

            if (!title || !slug) return null;

            return {
                id: slug,
                title,
                url: `${this.api}/media/${slug}`,
                image: `${this.cdnUrl}/covers/${realId}.jpg`,
            };
        }).filter(Boolean);
    }


    async getMetadata(id) {
        const res = await fetch(`${this.api}/media/${id}/__data.json`);
        if (!res.ok) throw new Error("Metadata no encontrada");
        const json = await res.json();

        const mediaNode = json.nodes?.find(n => n?.data?.[0]?.media !== undefined);
        if (!mediaNode) throw new Error("Nodo de media no encontrado");

        const data     = mediaNode.data;
        const media    = data[data[0].media];
        if (!media) throw new Error("Estructura de media inválida");

        const resolve = (ptr) => (typeof ptr === 'number' ? data[ptr] : ptr);

        const mediaId  = resolve(media.id);
        const epsCount = resolve(media.episodesCount);
        const score    = resolve(media.score);
        const startDate = resolve(media.startDate);
        const malId    = resolve(media.malId);

        const genres = Array.isArray(resolve(media.genres))
            ? resolve(media.genres)
                .map(ptr => { const g = data[ptr]; return g ? resolve(g.name) : null; })
                .filter(Boolean)
            : [];


        return {
            title:           resolve(media.title)    || "Unknown",
            synopsis:        resolve(media.synopsis) || null,
            eps_or_chapters: epsCount                || 0,
            rating:          score                   ? parseFloat((score / 10).toFixed(2)) : null,
            year:            startDate               ? Number(String(startDate).slice(0, 4)) : null,
            image:           mediaId                 ? `${this.cdnUrl}/covers/${mediaId}.jpg` : null,
            genres,
            external_ids:    malId                   ? { myanimelist: String(malId) } : {},
        };
    }

    async findEpisodes(id) {
        let slug = id;
        let type = "sub";

        try {
            const parsed = JSON.parse(id);
            slug = parsed.slug;
            if (parsed.type) type = parsed.type;
        } catch (e) {
            slug = id;
        }

        const url = `${this.api}/media/${slug}/__data.json`;

        const res = await fetch(url);

        if (!res.ok) throw new Error("Error obteniendo episodios");

        const rawText = await res.text();
        const json = JSON.parse(rawText);

        const { data, root } = this._findSvelteData(json, 'episodes');

        if (!data || !root) {
            throw new Error("No se encontraron episodios");
        }

        const episodeIndexes = data[root.episodes];
        const mediaId = data[root.id];
        const image = mediaId ? `${this.cdnUrl}/backdrops/${mediaId}.jpg` : undefined;

        if (!Array.isArray(episodeIndexes)) {
            console.log("episodeIndexes no es un array. Es:", typeof episodeIndexes);
            return [];
        }

        return episodeIndexes.map((epIdx, i) => {
            const ep = data[epIdx];

            let realNumber = i + 1;
            if (typeof ep.number === 'number') {
                const resolvedNum = data[ep.number];
                if (typeof resolvedNum === 'number') realNumber = resolvedNum;
            }

            let realTitle = `Episodio ${realNumber}`;
            if (typeof ep.title === 'number') realTitle = data[ep.title];
            else if (ep.title) realTitle = ep.title;

            return {
                id: slug + "$" + realNumber,
                number: realNumber,
                title: realTitle,
                url: `${this.api}/media/${slug}/${realNumber}`,
                image: image
            };
        });
    }

    async findEpisodeServer(episodeOrId, _server, category = "sub") {
        const idStr = typeof episodeOrId === "string" ? episodeOrId : episodeOrId.id;

        const [slug, number] = idStr.split("$");
        if (!slug || !number) throw new Error("ID de episodio malformado");

        const res = await fetch(`${this.api}/media/${slug}/${number}/__data.json`);
        if (!res.ok) throw new Error("Error obteniendo datos del servidor");
        const json = await res.json();

        const { data, root } = this._findSvelteData(json, 'embeds');
        if (!data || !root) throw new Error("No se encontraron servidores");

        const embedsObj = data[root.embeds];
        const catKey = category.toUpperCase(); // "SUB" o "DUB"

        const listIndex = embedsObj[catKey];

        if (typeof listIndex !== "number") {
            throw new Error(`No hay streams para ${catKey}. Disponibles: ${Object.keys(embedsObj).filter(k => typeof embedsObj[k] === 'number').join(", ")}`);
        }

        const serverList = data[listIndex];
        if (!Array.isArray(serverList)) throw new Error("Lista de servidores vacía");

        console.log(`[Debug] Cantidad de servidores encontrados en ${catKey}:`, serverList.length);

        let hlsUrl = null;

        for (const [i, ptr] of serverList.entries()) {
            const srv = data[ptr];
            if (!srv) continue;

            const serverName = data[srv.server];
            const link = data[srv.url];

            if (serverName === "HLS" && link) {
                hlsUrl = link.replace("/play/", "/m3u8/");
                break;
            }
        }

        if (!hlsUrl) throw new Error(`No se encontró stream HLS para ${catKey}`);

        return {
            headers: { Referer: "null" },
            source: {
                url: hlsUrl,
                subtitles: [],
                chapters: [],
            },
        };
    }
}