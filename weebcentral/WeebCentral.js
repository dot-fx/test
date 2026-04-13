class WeebCentral extends Manga {

    constructor() {
        super();
        this.baseUrl = "https://weebcentral.com";
    }

    get _headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.baseUrl + "/"
        };
    }

    getFilters() {
        return {
            sort: {
                label: "Sort By",
                type: "select",
                options: [
                    { value: "Best Match",      label: "Best Match" },
                    { value: "Alphabet",         label: "Alphabet" },
                    { value: "Popularity",       label: "Popularity" },
                    { value: "Subscribers",      label: "Subscribers" },
                    { value: "Recently Added",   label: "Recently Added" },
                    { value: "Latest Updates",   label: "Latest Updates" }
                ],
                default: "Popularity"
            },
            order: {
                label: "Sort Order",
                type: "select",
                options: [
                    { value: "Descending", label: "Descending" },
                    { value: "Ascending",  label: "Ascending" }
                ],
                default: "Descending"
            },
            official: {
                label: "Official Translation",
                type: "select",
                options: [
                    { value: "Any",   label: "Any" },
                    { value: "True",  label: "True" },
                    { value: "False", label: "False" }
                ],
                default: "Any"
            },
            status: {
                label: "Status",
                type: "multiselect",
                options: [
                    { value: "Ongoing",   label: "Ongoing" },
                    { value: "Complete",  label: "Complete" },
                    { value: "Hiatus",    label: "Hiatus" },
                    { value: "Canceled",  label: "Canceled" }
                ]
            },
            type: {
                label: "Type",
                type: "multiselect",
                options: [
                    { value: "Manga",   label: "Manga" },
                    { value: "Manhwa",  label: "Manhwa" },
                    { value: "Manhua",  label: "Manhua" },
                    { value: "OEL",     label: "OEL" }
                ]
            },
            tags: {
                label: "Tags",
                type: "multiselect",
                options: [
                    { value: "Action",        label: "Action" },
                    { value: "Adult",         label: "Adult" },
                    { value: "Adventure",     label: "Adventure" },
                    { value: "Comedy",        label: "Comedy" },
                    { value: "Doujinshi",     label: "Doujinshi" },
                    { value: "Drama",         label: "Drama" },
                    { value: "Ecchi",         label: "Ecchi" },
                    { value: "Fantasy",       label: "Fantasy" },
                    { value: "Gender Bender", label: "Gender Bender" },
                    { value: "Harem",         label: "Harem" },
                    { value: "Historical",    label: "Historical" },
                    { value: "Horror",        label: "Horror" },
                    { value: "Isekai",        label: "Isekai" },
                    { value: "Josei",         label: "Josei" },
                    { value: "Martial Arts",  label: "Martial Arts" },
                    { value: "Mature",        label: "Mature" },
                    { value: "Mecha",         label: "Mecha" },
                    { value: "Mystery",       label: "Mystery" },
                    { value: "Psychological", label: "Psychological" },
                    { value: "Romance",       label: "Romance" },
                    { value: "School Life",   label: "School Life" },
                    { value: "Sci-fi",        label: "Sci-fi" },
                    { value: "Seinen",        label: "Seinen" },
                    { value: "Shoujo",        label: "Shoujo" },
                    { value: "Shoujo Ai",     label: "Shoujo Ai" },
                    { value: "Shounen",       label: "Shounen" },
                    { value: "Shounen Ai",    label: "Shounen Ai" },
                    { value: "Slice of Life", label: "Slice of Life" },
                    { value: "Smut",          label: "Smut" },
                    { value: "Sports",        label: "Sports" },
                    { value: "Supernatural",  label: "Supernatural" },
                    { value: "Tragedy",       label: "Tragedy" },
                    { value: "Yaoi",          label: "Yaoi" },
                    { value: "Yuri",          label: "Yuri" },
                    { value: "Other",         label: "Other" }
                ]
            }
        };
    }

    async search(query, filters, page) {
        const limit  = 32;
        const offset = (page - 1) * limit;

        if (query && query.trim().length > 0 && (!filters || Object.keys(filters).length === 0)) {
            console.log("[search] using simple search for query:", query);

            const body = "text=" + encodeURIComponent(query.trim());
            const res  = await fetch(`${this.baseUrl}/search/simple?location=main`, {
                method: "POST",
                headers: {
                    ...this._headers,
                    "Content-Type":    "application/x-www-form-urlencoded",
                    "HX-Request":      "true",
                    "HX-Trigger":      "quick-search-input",
                    "HX-Trigger-Name": "text",
                    "HX-Target":       "quick-search-result",
                    "HX-Current-URL":  this.baseUrl + "/",
                    "Origin":          this.baseUrl,
                },
                body,
            });
            if (!res.ok) return [];

            const html = await res.text();

            const $       = parseHTML(html);
            const anchors = $("section a");

            const results = [];
            anchors.forEach(el => {
                const href = el.attr("href");
                if (!href) return;

                const idMatch = href.match(/\/series\/([^/]+)/);
                if (!idMatch) return;

                const divs  = el.find("div");
                let title = "";
                divs.forEach(d => {
                    const t = d.text().trim();
                    if (t && t.length > title.length) title = t;
                });

                const sources = el.find("source");
                const imgs    = el.find("img");
                let image     = sources.length > 0
                    ? (sources[0].attr("srcset") || "")
                    : (imgs.length > 0 ? (imgs[0].attr("src") || "") : "");
                if (image) image = image.replace("small", "normal");

                console.log("[search] item:", idMatch[1], "|", title, "|", image.slice(0, 60));
                results.push({ id: idMatch[1], title, image, type: "book" });
            });

            console.log("[search] total results:", results.length);
            return results;
        }

        const url = new URL(`${this.baseUrl}/search/data`);
        url.searchParams.set("limit",        String(limit));
        url.searchParams.set("offset",       String(offset));
        url.searchParams.set("display_mode", "Full Display");

        if (query && query.trim().length > 0) url.searchParams.set("text", query.trim());

        if (filters) {
            if (filters.sort)     url.searchParams.set("sort",     filters.sort);
            if (filters.order)    url.searchParams.set("order",    filters.order);
            if (filters.official) url.searchParams.set("official", filters.official);

            if (filters.status) {
                String(filters.status).split(',').forEach(v => {
                    if (v.trim()) url.searchParams.append("included_status", v.trim());
                });
            }
            if (filters.type) {
                String(filters.type).split(',').forEach(v => {
                    if (v.trim()) url.searchParams.append("included_type", v.trim());
                });
            }
            if (filters.tags) {
                String(filters.tags).split(',').forEach(v => {
                    if (v.trim()) url.searchParams.append("included_tag", v.trim());
                });
            }
        } else {
            url.searchParams.set("sort", "Popularity");
        }

        const res = await fetch(url.toString(), { headers: this._headers });
        if (!res.ok) return [];

        const html = await res.text();

        const $       = parseHTML(html);
        const anchors = $("article a");
        const results = [];
        anchors.forEach(el => {
            const href = el.attr("href");
            if (!href) return;

            const idMatch = href.match(/\/series\/([^/]+)/);
            if (!idMatch) return;

            const divs  = el.find("div");
            const title = divs.length > 0 ? divs[divs.length - 1].text().trim() : "";

            const sources = el.find("source");
            const imgs    = el.find("img");
            let image     = sources.length > 0
                ? (sources[0].attr("srcset") || "")
                : (imgs.length > 0 ? (imgs[0].attr("src") || "") : "");
            if (image) image = image.replace("small", "normal");

            results.push({ id: idMatch[1], title, image, type: "book" });
        });

        return results;
    }

    async getMetadata(id) {
        const res = await fetch(`${this.baseUrl}/series/${id}`, { headers: this._headers });
        if (!res.ok) throw new Error("Metadata failed");

        const html = await res.text();
        const $ = parseHTML(html);

        const h1s = $("h1");
        const sources = $("source");
        const imgs    = $("img");
        let image     = sources.length > 0
            ? (sources[0].attr("srcset") || "")
            : (imgs.length > 0 ? (imgs[0].attr("src") || "") : "");
        if (image) image = image.replace("small", "normal");
        const genres = [];
        const liAnchors = $("li a");
        liAnchors.forEach((el, i) => {
            const href = el.attr("href") || "";
            const text = el.text().trim();
            if (i < 15) console.log(`  [${i}] href: ${href} text: ${text}`);
            if (href.includes("/tags/") || href.includes("/type/")) {
                if (text) genres.push(text);
            }
        });

        let status = "unknown";
        liAnchors.forEach(el => {
            const href = el.attr("href") || "";
            if (href.includes("/status/")) {
                const raw = el.text().trim().toLowerCase();
                if      (raw.includes("ongoing"))  status = "ongoing";
                else if (raw.includes("complete")) status = "completed";
                else if (raw.includes("hiatus"))   status = "hiatus";
                else if (raw.includes("canceled")) status = "cancelled";
            }
        });

        let summary = "";
        const paras = $("p");
        paras.forEach((el, i) => {
            const t = el.text().trim();
            if (i < 3) console.log(`  p[${i}]: "${t.slice(0, 100)}"`);
            if (t.length > summary.length) summary = t;
        });

        return {
            id,
            title:    h1s.length > 0 ? h1s[0].text().trim() : "Unknown",
            format:   "MANGA",
            score:    0,
            genres,
            status,
            summary,
            chapters: 0,
            image,
        };
    }

    async findChapters(mangaId) {
        const res = await fetch(
            `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            { headers: this._headers }
        );
        if (!res.ok) return [];

        const html     = await res.text();

        const $        = parseHTML(html);
        const chapters = [];
        const numRegex = /(\d+(?:\.\d+)?)/;

        const chapterLinks = $("a[href*='/chapters/']");

        chapterLinks.forEach(el => {
            const href = el.attr("href");
            if (!href) return;

            const idMatch = href.match(/\/chapters\/([^/]+)/);
            if (!idMatch) return;

            const spans = el.find("span");
            const title = spans.length > 0 ? spans[0].text().trim() : "";
            const numMatch = title.match(numRegex);

            chapters.push({
                id:          idMatch[1],
                title,
                number:      numMatch ? Number(numMatch[1]) : 0,
                releaseDate: null,
                index:       0,
            });
        });
        chapters.reverse();
        chapters.forEach((c, i) => { c.index = i; });
        return chapters;
    }

    async findChapterPages(chapterId) {
        const res = await fetch(
            `${this.baseUrl}/chapters/${chapterId}/images?is_prev=False&reading_style=long_strip`,
            { headers: this._headers }
        );
        if (!res.ok) return [];

        const html  = await res.text();
        const $     = parseHTML(html);
        const pages = [];
        let   i     = 0;

        const sectionImgs = $("section img");
        sectionImgs.forEach(el => {
            const src = el.attr("src");
            if (!src) return;
            if (i < 3) console.log(`  page[${i}] src: ${src.slice(0, 80)}`);
            pages.push({
                url:     src,
                index:   i++,
                headers: { Referer: this.baseUrl },
            });
        });
        return pages;
    }
}
