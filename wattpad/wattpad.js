class Wattpad extends Novel {
    constructor() {
        super();
        this.baseUrl = "https://www.wattpad.com";
        this.apiUrl  = "https://www.wattpad.com/v4";
    }

    get _headers() {
        return {
            "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer":         "https://www.wattpad.com/"
        };
    }

    _buildQuery(params) {
        return Object.entries(params)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
    }

    getFilters() {
        return {
            sort: {
                label: "Sort By (Only for Explore)",
                type: "select",
                options: [
                    { value: "hot",  label: "Hot (Trending)" },
                    { value: "new",  label: "New (Latest)"   },
                    { value: "paid", label: "Paid Stories"   }
                ],
                default: "hot"
            },
            updated: {
                label: "Last Updated (Search Only)",
                type: "select",
                options: [
                    { value: "",     label: "Any time"   },
                    { value: "24",   label: "Today"      },
                    { value: "168",  label: "This Week"  },
                    { value: "720",  label: "This Month" },
                    { value: "8760", label: "This Year"  }
                ],
                default: ""
            },
            content: {
                label: "Content Filters",
                type: "multiselect",
                options: [
                    { value: "completed", label: "Completed stories only" },
                    { value: "paid",      label: "Paid stories only"      },
                    { value: "free",      label: "Free stories only"      },
                    { value: "mature",    label: "Include mature content"  }
                ]
            },
            tags: {
                label:       "Tags (comma separated)",
                type:        "text",
                placeholder: "e.g. romance, vampire, magic"
            }
        };
    }

    async search({ query = "", page = 1, filters = {} }) {
        const limit  = 15;
        const offset = (page - 1) * limit;

        let finalQuery = query.trim();
        if (filters?.tags) {
            String(filters.tags).split(",").forEach(t => {
                const tag = t.trim();
                if (tag) finalQuery += ` #${tag.replace(/^#/, "")}`;
            });
        }
        finalQuery = finalQuery.trim();

        let isMature  = false;
        let completed = null;
        let paid      = null;

        if (filters?.content) {
            const opts = Array.isArray(filters.content)
                ? filters.content
                : String(filters.content).split(",");
            if (opts.includes("completed")) completed = "1";
            if (opts.includes("paid"))      paid      = "1";
            if (opts.includes("free"))      paid      = "0";
            if (opts.includes("mature"))    isMature  = true;
        }

        const fields = "stories(id,title,cover,user(name),completed,numParts,voteCount),total,nextUrl";

        let url;

        if (finalQuery) {
            const params = {
                query:  finalQuery,
                limit:  limit,
                offset: offset,
                mature: isMature ? "1" : "0",
                fields: fields,
            };
            if (completed)        params.completed         = completed;
            if (paid !== null)    params.paid              = paid;
            if (filters?.updated) params.updateYoungerThan = filters.updated;

            url = `${this.apiUrl}/search/stories/?${this._buildQuery(params)}`;
        } else {
            const params = {
                filter: filters?.sort || "hot",
                limit:  limit,
                offset: offset,
                mature: isMature ? "1" : "0",
                fields: fields,
            };
            if (completed)     params.completed = completed;
            if (paid !== null) params.paid      = paid;

            url = `${this.apiUrl}/stories/?${this._buildQuery(params)}`;
        }

        const res = await fetch(url, { headers: this._headers });
        if (!res.ok) throw new Error(`Wattpad API error: ${res.status}`);

        const json = await res.json();
        if (!json.stories) return [];

        return json.stories.map(s => ({
            id:    String(s.id),
            title: s.title,
            image: s.cover,
            type:  "book",
        }));
    }

    async getMetadata(id) {
        const res  = await fetch(`${this.baseUrl}/story/${id}`, { headers: this._headers });
        const html = await res.text();

        const scripts = parseHTML(html)("script");
        let story = null;

        scripts.forEach(el => {
            if (story) return;
            const text = el.text();
            if (!text.includes("window.__remixContext")) return;
            const m = text.match(/window\.__remixContext\s*=\s*({[\s\S]*?});/);
            if (!m) return;
            try {
                const ctx = JSON.parse(m[1]);
                story = ctx?.state?.loaderData?.["routes/story.$storyid"]?.story;
            } catch (_) {}
        });

        if (story) {
            return {
                id:              String(story.id),
                title:           story.title || "Unknown",
                synopsis:        story.description || "",
                eps_or_chapters: story.numParts   || 0,
                rating:          story.voteCount  ?? null,
                year:            story.createDate
                    ? new Date(story.createDate).getFullYear()
                    : null,
                image:           story.cover || "",
                genres:          story.tags  || [],
                external_ids:    {},
            };
        }

        // Fallback
        const $     = parseHTML(html);
        const title = $("h1")[0]?.text() || "Unknown";
        const image = $(".story-cover img")[0]?.attr("src") || "";
        const desc  = $(".description")[0]?.text() || "";

        return {
            id:              String(id),
            title,
            synopsis:        desc,
            eps_or_chapters: 0,
            rating:          null,
            year:            null,
            image,
            genres:          [],
            external_ids:    {},
        };
    }

    async findChapters(bookId) {
        const res  = await fetch(`${this.baseUrl}/story/${bookId}`, { headers: this._headers });
        const html = await res.text();

        const m = html.match(/window\.__remixContext\s*=\s*({[\s\S]*?});/);
        if (!m?.[1]) return [];

        try {
            const ctx   = JSON.parse(m[1]);
            const parts = ctx?.state?.loaderData?.["routes/story.$storyid"]?.story?.parts;
            if (!parts) return [];

            return parts.map((part, i) => ({
                id:     String(part.id),
                title:  part.title || `Chapter ${i + 1}`,
                number: i + 1,
                index:  i,
            }));
        } catch (_) {
            return [];
        }
    }

    async findChapterPages(chapterId) {
        const res  = await fetch(`${this.baseUrl}/amp/${chapterId}`, { headers: this._headers });
        const html = await res.text();
        const $    = parseHTML(html);

        const title     = $("h2")[0]?.text().trim() || "";
        const container = $(".story-body-type");

        if (!container.length) {
            return "<p>Content not available or paid story.</p>";
        }

        let content = "";
        if (title) content += `<h1>${title}</h1><br>`;

        const inner = parseHTML(container[0].html());
        inner("p, amp-img").forEach(el => {
            if (el._raw.outer.startsWith("<p")) {
                const text = el.text().trim();
                if (text) content += `<p>${text}</p>`;
            } else if (el._raw.outer.startsWith("<amp-img")) {
                const src = el.attr("src");
                if (src) content += `<img src="${src}" style="max-width:100%;display:block;margin:10px auto;">`;
            }
        });

        return content || "<p>No content found.</p>";
    }
}