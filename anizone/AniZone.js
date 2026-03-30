class Anizone extends Anime {
    constructor() {
        super();
        this.api = "https://anizone.to";
    }

    getSettings() {
        return {
            episodeServers: ["HLS"],
            supportsDub: false,
        };
    }

    async search(queryObj) {
        const query = queryObj.query ?? "";
        const res = await fetch(
            `${this.api}/anime?search=${encodeURIComponent(query)}`,
            {
                headers: {
                    "referer": "https://anizone.to/",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
                },
            }
        );

        const html = await res.text();
        const $ = parseHTML(html);
        const results = [];

        // Buscamos los contenedores de anime
        $("div.relative.overflow-hidden.h-26.rounded-lg").forEach((el) => {
            const anchor = el.find("a[title]");
            const img = el.find("img");

            const href = anchor.attr("href") || "";
            const animeId = href.split("/").pop();

            results.push({
                id: animeId,
                title: anchor.attr("title") || img.attr("alt") || "Unknown",
                image: img.attr("src"),
                url: href,
                nsfw: false
            });
        });

        return results;
    }

    async getMetadata(id) {
        const url = `${this.api}/anime/${id}`;
        const res = await fetch(url);
        const html = await res.text();
        const $ = parseHTML(html);

        const title = $("div.flex.flex-col.items-center.lg\\:items-start h1").text();
        const synopsis = $("div.text-slate-100.text-center.lg\\:text-start.text-sm.md\\:text-base.xl\\:text-lg div").text();

        // Extraer episodios
        let eps_or_chapters = 0;
        $("span.flex.items-center.gap-1").forEach(el => {
            const text = el.text();
            const match = text.match(/(\d+)\s+Episodes?/i);
            if (match) eps_or_chapters = parseInt(match[1], 10);
        });

        // Extraer año
        const yearText = $("span.flex.items-center.gap-1 span.inline-block").text();
        const year = yearText ? parseInt(yearText, 10) : null;

        const genres = [];
        $("div.flex.flex-wrap.gap-2.justify-center.lg\\:justify-start a").forEach(el => {
            const genre = el.attr("title");
            if (genre) genres.push(genre);
        });

        const image = $("div.mx-auto.lg\\:mx-0 img").attr("src");

        return {
            title: title.trim() || "Unknown",
            synopsis: synopsis.trim() || "",
            eps_or_chapters,
            rating: 0,
            year,
            genres,
            image,
            nsfw: false
        };
    }

    async findEpisodes(id) {
        // Usamos el ID del anime (slug) para cargar la página del primer episodio
        const html = await fetch(`${this.api}/anime/${id}/1`).then(r => r.text());
        const $ = parseHTML(html);
        const episodes = [];

        // Buscamos los enlaces a los episodios
        $("a[href*='/anime/']").forEach(el => {
            const numEl = el.find("div.min-w-10");
            const titleEl = el.find("div.line-clamp-1");

            if (numEl.length > 0) {
                const href = el.attr("href"); // Ejemplo: "/anime/sousou-no-frieren/1"

                // Extraemos la parte "slug/numero" del href
                const match = href.match(/\/anime\/(.+)$/);
                if (match) {
                    const fullId = match[1]; // Esto guarda "sousou-no-frieren/1"

                    episodes.push({
                        id: fullId, // ESTO es lo que recibirá findEpisodeServer
                        number: parseInt(numEl.text(), 10),
                        title: titleEl.text().trim(),
                        url: href
                    });
                }
            }
        });

        return episodes;
    }

    async findEpisodeServer(episodeId, server, category = "sub") {
        const url = `${this.api}/anime/${episodeId}`;
        const res = await fetch(url);
        const html = await res.text();
        const $ = parseHTML(html);
        const mediaPlayers = $("media-player");

        let m3u8Url = null;
        if (mediaPlayers.length > 0) {
            m3u8Url = mediaPlayers.attr("src");
        } else {
            m3u8Url = $("video").attr("src") || $("source").attr("src") || $("iframe").attr("src");
        }

        if (!m3u8Url) {
            const rawMatch = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
            if (rawMatch) m3u8Url = rawMatch[0];
        }

        if (!m3u8Url) throw new Error(`No se pudo encontrar el stream m3u8.`);

        const subtitles = [];
        let chapterUrl = null;

        // 1. Separar subtítulos de capítulos
        $("track").forEach(el => {
            const src = el.attr("src");
            const label = el.attr("label") || "";
            const kind = el.attr("kind");
            const srclang = el.attr("srclang") || "en";

            // Detectamos si es un track de capítulos por el label o el nombre del archivo
            if (kind === "chapters" || label.toLowerCase().includes("chapter") || src.toLowerCase().includes("chapters.vtt")) {
                chapterUrl = src;
            } else if (src) {
                subtitles.push({
                    id: srclang, // ID necesario para el srclang de Vidstack
                    url: src,
                    language: label || "Unknown",
                    is_default: el.attr("default") !== null
                });
            }
        });

        // 2. Si encontramos capítulos, los descargamos y parseamos a JSON
        let chapters = [];
        if (chapterUrl) {
            try {
                console.log(`[AniZone] Descargando capítulos desde: ${chapterUrl}`);
                const vttText = await fetch(chapterUrl).then(r => r.text());
                chapters = this._parseVttChapters(vttText);
                console.log(`[AniZone] ${chapters.length} capítulos procesados.`);
            } catch (e) {
                console.error("[AniZone] Error al parsear capítulos:", e);
            }
        }

        return {
            headers: {
                "Origin": "https://anizone.to",
                "Referer": "https://anizone.to/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
            },
            source: {
                url: m3u8Url,
                subtitles: subtitles,
                chapters: chapters // Ahora es el array de objetos que espera el Player
            }
        };
    }

// Helper para convertir WebVTT a JSON compatible con el Player
    _parseVttChapters(vtt) {
        const chapters = [];
        const blocks = vtt.split(/\r?\n\r?\n/); // Separar por bloques de tiempo

        for (const block of blocks) {
            const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            const timeLine = lines.find(l => l.includes("-->"));

            if (timeLine) {
                const timeIndex = lines.indexOf(timeLine);
                const title = lines.slice(timeIndex + 1).join(" ") || "Chapter";
                const [startStr, endStr] = timeLine.split("-->");

                chapters.push({
                    start: this._vttTimeToSeconds(startStr),
                    end: this._vttTimeToSeconds(endStr),
                    title: title
                });
            }
        }
        return chapters;
    }

// Helper para convertir timestamps (00:00:00.000) a segundos
    _vttTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':');
        let seconds = 0;
        if (parts.length === 3) {
            seconds += parseFloat(parts[0]) * 3600; // Horas
            seconds += parseFloat(parts[1]) * 60;   // Minutos
            seconds += parseFloat(parts[2]);        // Segundos
        } else if (parts.length === 2) {
            seconds += parseFloat(parts[0]) * 60;   // Minutos
            seconds += parseFloat(parts[1]);        // Segundos
        }
        return seconds;
    }
}