class NHentai extends Manga {
    constructor() {
        super();
        this.baseUrl = "https://nhentai.net";
    }

    getFilters() {
        return {
            sort: {
                label: "Order",
                type: "select",
                options: [
                    { value: "date",           label: "Recent" },
                    { value: "popular",        label: "Popular: All time" },
                    { value: "popular-month",  label: "Popular: Month" },
                    { value: "popular-week",   label: "Popular: Week" },
                    { value: "popular-today",  label: "Popular: Today" }
                ],
                default: "date"
            },
            tags:       { label: "Tags",       type: "text", placeholder: "big breasts, stocking" },
            categories: { label: "Categories", type: "text", placeholder: "doujinshi, manga" },
            groups:     { label: "Groups",     type: "text", placeholder: "fakku" },
            artists:    { label: "Artists",    type: "text", placeholder: "shindo l" },
            parodies:   { label: "Parodies",   type: "text", placeholder: "naruto" },
            characters: { label: "Characters", type: "text", placeholder: "sakura haruno" },
            pages:      { label: "Pages (e.g. >20)",                type: "text", placeholder: ">20" },
            uploaded:   { label: "Uploaded (e.g. >20d)",            type: "text", placeholder: ">20d" }
        };
    }


    _shortenTitle(title) {
        return title.replace(/(\[[^\]]*]|[({][^)}]*[)}])/g, "").trim();
    }

    _parseId(str) {
        return str.replace(/\D/g, "");
    }

    _extractJson(scriptText) {
        const m = scriptText.match(/JSON\.parse\("([\s\S]*?)"\)/);
        if (!m) throw new Error("JSON.parse block not found in script");

        const unicodeFixed = m[1].replace(
            /\\u([0-9A-Fa-f]{4})/g,
            (_, h) => String.fromCharCode(parseInt(h, 16))
        );
        return JSON.parse(unicodeFixed);
    }

    _findDataScript(html) {
        const $ = parseHTML(html);
        let found = null;
        $("script").forEach(el => {
            const text = el.text();
            if (
                text.includes("JSON.parse") &&
                !text.includes("media_server") &&
                !text.includes("avatar_url")
            ) {
                found = text;
            }
        });
        return found;
    }

    async search({ query = "", page = 1, filters = null }) {
        if (query.startsWith("id:") || (!isNaN(query) && query.length > 0 && query.length <= 7)) {
            return [await this.getMetadata(this._parseId(query))];
        }

        let advQuery  = "";
        let sortParam = "";

        if (filters) {
            const textFilters = [
                { key: "tags",       prefix: "tag" },
                { key: "categories", prefix: "category" },
                { key: "groups",     prefix: "group" },
                { key: "artists",    prefix: "artist" },
                { key: "parodies",   prefix: "parody" },
                { key: "characters", prefix: "character" },
                { key: "uploaded",   prefix: "uploaded", noQuote: true },
                { key: "pages",      prefix: "pages",    noQuote: true }
            ];

            textFilters.forEach(({ key, prefix, noQuote }) => {
                if (!filters[key]) return;
                String(filters[key]).split(",").forEach(term => {
                    const t = term.trim();
                    if (!t) return;
                    const exclude = t.startsWith("-");
                    const clean   = exclude ? t.slice(1) : t;
                    advQuery += ` ${exclude ? "-" : ""}${prefix}:${noQuote ? clean : `"${clean}"`}`;
                });
            });

            if (filters.sort && filters.sort !== "date") {
                sortParam = `&sort=${filters.sort}`;
            }
        }

        const finalQuery = (query + " " + advQuery).trim() || '""';
        const url = `${this.baseUrl}/search/?q=${encodeURIComponent(finalQuery)}&page=${page}${sortParam}`;


        try {

            const result = await headless.fetch(url, {
                waitFor: { selector: ".gallery" },
                block:   ["fonts", "media"],
            });

            const { html } = result;


            if (html && (html.includes("Just a moment...") || html.includes("cf-browser-verification"))) {
                console.warn(`[NHentai Search] ⚠️ Cloudflare bloqueó la petición.`);
            }

            const $ = parseHTML(html);
            const galleries = $(".gallery");
            console.log("[NHentai] galleries found:", galleries.length);

            const results = [];


            galleries.forEach((el) => {
                const href  = el.find("a").attr("href") || "";
                const img   = el.find("img");
                const image = img.attr("data-src") || img.attr("src") || "";
                const title = el.find(".caption").text().trim();
                const id    = this._parseId(href);
                results.push({
                    id,
                    title,
                    image,
                    url: `${this.baseUrl}${href}`,
                });
            });

            return results;

        } catch (error) {
            console.error(`[NHentai Search] ❌ Error: ${JSON.stringify(error)} - Stack: ${error.stack}`);
        }
    }


    async getMetadata(id) {
        const url = `${this.baseUrl}/g/${id}/`;

        const { html } = await headless.fetch(url, {
            waitFor: "networkidle",
            block:   ["fonts", "media"],
        });

        const scriptText = this._findDataScript(html);
        if (!scriptText) throw new Error("Gallery data script not found");

        const data = this._extractJson(scriptText);

        const cdnMatch = html.match(/thumb_cdn_urls:\s*(\[[^\]]*])/);
        const cdn      = cdnMatch ? JSON.parse(cdnMatch[1])[0] : "t3.nhentai.net";

        const tags   = (data.tags || []).filter(t => t.type === "tag").map(t => t.name);
        const artists = (data.tags || []).filter(t => t.type === "artist").map(t => t.name);

        return {
            id:              id.toString(),
            title:           data.title?.pretty || data.title?.english || "Unknown",
            synopsis:        `Pages: ${data.images?.pages?.length ?? 0}\nFavorites: ${data.num_favorites ?? 0}`,
            eps_or_chapters: 1,
            rating:          null,
            year:            data.upload_date ? new Date(data.upload_date * 1000).getFullYear() : null,
            image:           `https://${cdn}/galleries/${data.media_id}/cover.webp`,
            genres:          tags,
            external_ids:    {},
        };
    }

    async findChapters(mangaId) {
        return [{
            id:     mangaId.toString(),
            title:  "Chapter",
            number: 1,
            index:  0,
        }];
    }

    async findChapterPages(chapterId) {
        const url = `${this.baseUrl}/g/${chapterId}/`;

        if (!headless.available) throw new Error("nhentai requires headless browser");

        const { html } = await headless.fetch(url, {
            waitFor: "networkidle",
            block:   ["fonts", "media"],
        });

        const scriptText = this._findDataScript(html);
        if (!scriptText) throw new Error("Gallery data script not found");

        const data = this._extractJson(scriptText);

        const cdnMatch  = html.match(/image_cdn_urls:\s*(\[[^\]]*])/);
        const cdn       = cdnMatch ? JSON.parse(cdnMatch[1])[0] : "i.nhentai.net";
        const mediaId   = data.media_id;

        return (data.images?.pages || []).map((p, i) => {
            const ext = p.t === "j" ? "jpg" : p.t === "p" ? "png" : "webp";
            return {
                url:   `https://${cdn}/galleries/${mediaId}/${i + 1}.${ext}`,
                index: i,
            };
        });
    }
}
