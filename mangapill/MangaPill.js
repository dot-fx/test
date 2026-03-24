class MangaPill extends Manga {

    constructor() {
        super();
        this.baseUrl = "https://mangapill.com";
    }

    get _headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.baseUrl + "/"
        };
    }

    getFilters() {
        return {
            type: {
                label: "Type",
                type: "select",
                options: [
                    { value: "", label: "All" },
                    { value: "manga", label: "Manga" },
                    { value: "novel", label: "Novel" },
                    { value: "one-shot", label: "One-Shot" },
                    { value: "doujinshi", label: "Doujinshi" },
                    { value: "manhwa", label: "Manhwa" },
                    { value: "manhua", label: "Manhua" },
                    { value: "oel", label: "OEL" }
                ]
            },
            status: {
                label: "Status",
                type: "select",
                options: [
                    { value: "", label: "All" },
                    { value: "publishing", label: "Publishing" },
                    { value: "finished", label: "Finished" },
                    { value: "on hiatus", label: "On Hiatus" },
                    { value: "discontinued", label: "Discontinued" },
                    { value: "not yet published", label: "Not Yet Published" }
                ]
            },
            genre: {
                label: "Genres",
                type: "multiselect",
                options: [
                    { value: "Action", label: "Action" },
                    { value: "Adventure", label: "Adventure" },
                    { value: "Cars", label: "Cars" },
                    { value: "Comedy", label: "Comedy" },
                    { value: "Dementia", label: "Dementia" },
                    { value: "Demons", label: "Demons" },
                    { value: "Drama", label: "Drama" },
                    { value: "Ecchi", label: "Ecchi" },
                    { value: "Fantasy", label: "Fantasy" },
                    { value: "Game", label: "Game" },
                    { value: "Harem", label: "Harem" },
                    { value: "Historical", label: "Historical" },
                    { value: "Horror", label: "Horror" },
                    { value: "Josei", label: "Josei" },
                    { value: "Kids", label: "Kids" },
                    { value: "Magic", label: "Magic" },
                    { value: "Martial Arts", label: "Martial Arts" },
                    { value: "Mecha", label: "Mecha" },
                    { value: "Military", label: "Military" },
                    { value: "Music", label: "Music" },
                    { value: "Mystery", label: "Mystery" },
                    { value: "Parody", label: "Parody" },
                    { value: "Police", label: "Police" },
                    { value: "Psychological", label: "Psychological" },
                    { value: "Romance", label: "Romance" },
                    { value: "Samurai", label: "Samurai" },
                    { value: "School", label: "School" },
                    { value: "Sci-Fi", label: "Sci-Fi" },
                    { value: "Seinen", label: "Seinen" },
                    { value: "Shoujo", label: "Shoujo" },
                    { value: "Shoujo Ai", label: "Shoujo Ai" },
                    { value: "Shounen", label: "Shounen" },
                    { value: "Shounen Ai", label: "Shounen Ai" },
                    { value: "Slice of Life", label: "Slice of Life" },
                    { value: "Space", label: "Space" },
                    { value: "Sports", label: "Sports" },
                    { value: "Super Power", label: "Super Power" },
                    { value: "Supernatural", label: "Supernatural" },
                    { value: "Thriller", label: "Thriller" },
                    { value: "Vampire", label: "Vampire" },
                    { value: "Yaoi", label: "Yaoi" },
                    { value: "Yuri", label: "Yuri" }
                ]
            }
        };
    }

    async search({ query, page = 1, filters }) {
        const url = new URL(`${this.baseUrl}/search`);

        if (query) url.searchParams.set("q", query.trim());
        url.searchParams.set("page", String(page));

        if (filters) {
            if (filters.type)   url.searchParams.set("type", filters.type);
            if (filters.status) url.searchParams.set("status", filters.status);
            if (filters.genre) {
                String(filters.genre).split(',').forEach(g => {
                    if (g.trim()) url.searchParams.append("genre", g.trim());
                });
            }
        }

        const res = await fetch(url.toString(), { headers: this._headers });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);

        const html = await res.text();
        const $    = parseHTML(html);

        const results = [];
        const seen    = new Set();

        $(".grid > div").forEach(el => {
            const anchors = el.find("a");
            if (anchors.length === 0) return;

            const href = anchors[0].attr("href");
            if (!href) return;

            const parts = href.split("/manga/");
            if (parts.length < 2) return;

            const id = parts[1].replace(/\//g, "$");
            if (seen.has(id)) return;
            seen.add(id);

            // Intentar distintos selectores para el título
            let title = "";
            const boldDivs = el.find(".font-bold");
            if (boldDivs.length > 0) title = boldDivs[0].text().trim();

            const imgs  = el.find("img");
            const image = imgs.length > 0
                ? (imgs[0].attr("data-src") || imgs[0].attr("src") || "")
                : "";

            results.push({ id, title, image, type: "book" });
        });

        return results;
    }

    async getMetadata(id) {
        const uriId = id.replace(/\$/g, "/");
        const res   = await fetch(`${this.baseUrl}/manga/${uriId}`, { headers: this._headers });
        if (!res.ok) throw new Error("Failed to fetch metadata");

        const html = await res.text();
        const $    = parseHTML(html);

        const h1s   = $("h1");
        const title = h1s.length > 0 ? h1s[0].text().trim() : "Unknown";

        const summaryEls = $("p");
        const summary    = summaryEls.length > 0 ? summaryEls[0].text().trim() : "";

        const genres = [];
        $("a[href*='genre']").forEach(el => {
            const g = el.text().trim();
            if (g) genres.push(g);
        });

        const imgs  = $("img[data-src]");
        const image = imgs.length > 0 ? (imgs[0].attr("data-src") || "") : "";

        return {
            id,
            title,
            format: "MANGA",
            score: 0,
            genres,
            status: "unknown",
            summary,
            chapters: 0,
            image,
        };
    }

    async findChapters(mangaId) {
        const uriId = mangaId.replace(/\$/g, "/");
        const res   = await fetch(`${this.baseUrl}/manga/${uriId}`, { headers: this._headers });
        const html  = await res.text();
        const $     = parseHTML(html);

        const chapters = [];

        $("#chapters a").forEach(el => {
            const href = el.attr("href");
            if (!href) return;

            const id    = href.split("/chapters/")[1]?.replace(/\//g, "$");
            if (!id) return;

            const title = el.text().trim();
            const match = title.match(/Chapter\s+([\d.]+)/);
            const number = match ? Number(match[1]) : 0;

            chapters.push({ id, title, number, releaseDate: null, index: 0 });
        });

        chapters.reverse();
        chapters.forEach((c, i) => { c.index = i; });
        return chapters;
    }

    async findChapterPages(chapterId) {
        const uriId = chapterId.replace(/\$/g, "/");
        const res   = await fetch(`${this.baseUrl}/chapters/${uriId}`, { headers: this._headers });
        const html  = await res.text();
        const $     = parseHTML(html);

        const pages = [];

        $("picture img").forEach((el, i) => {
            const img = el.attr("data-src");
            if (!img) return;

            pages.push({
                url:   img,
                index: i,
                headers: {
                    "Referer":    this.baseUrl + "/",
                    "User-Agent": this._headers["User-Agent"],
                },
            });
        });

        return pages;
    }
}
