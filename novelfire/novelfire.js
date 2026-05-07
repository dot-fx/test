const BASE_URL = "https://novelfire.net";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchHtml(url, headers = {}) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return res.text();
}

// ─── Extension ───────────────────────────────────────────────────────────────

class NovelFireExtension extends Novel {

    // ── Search ────────────────────────────────────────────────────────────────────

    async search(query, filters, page) {
        const url = `${BASE_URL}/ajax/searchLive?keyword=${encodeURIComponent(query ?? "")}&type=title`;
        const res = await fetch(url, {
            headers: {
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": `${BASE_URL}/home`,
            },
        });
        const data = await res.json();

        if (!data.data) return [];

        return data.data.map((item) => ({
            id: item.slug,
            title: item.title,
            image: item.image ? `${BASE_URL}/${item.image}` : null,
            url: `${BASE_URL}/book/${item.slug}`,
        }));
    }

    // ── Metadata ──────────────────────────────────────────────────────────────────

    async getMetadata(id) {
        const html = await fetchHtml(`${BASE_URL}/book/${id}`);
        const $ = parseHTML(html);

        const title = $('h1[itemprop="name"]').text().trim() || null;
        const synopsis = $('meta[itemprop="description"]').attr("content") || null;

        const image =
            $("figure.cover img").attr("src") ||
            $("img.cover").attr("src") ||
            $('img[src*="server-"]').attr("src") ||
            null;

        const genres = $(".categories a.property-item").map((el) =>
            el.attr("title") || el.text().trim()
        );

        let eps_or_chapters = null;
        const latestText = $(".chapter-latest-container .latest").text();
        if (latestText) {
            const m = latestText.match(/Chapter\s+(\d+)/i);
            if (m) eps_or_chapters = Number(m[1]);
        }

        return {
            title,
            synopsis,
            image,
            eps_or_chapters,
            rating: null,
            year: null,
            genres,
            nsfw: false,
            anilist_id: null,
            mal_id: null,
            external_ids: {},
        };
    }

    async findChapters(contentId) {
        // Fetch chapter-1 page to extract post_id
        const chapterUrl = `${BASE_URL}/book/${contentId}/chapter-1`;
        const html = await fetchHtml(chapterUrl);
        const $ = parseHTML(html);

        let postId = null;
        $("script").forEach((el) => {
            const txt = el.html() || "";
            const m = txt.match(/post_id\s*=\s*parseInt\("(\d+)"\)/);
            if (m) postId = m[1];
        });
        if (!postId) throw new Error("post_id not found in page scripts");

        const params = new URLSearchParams({
            draw: "1",
            "columns[0][data]": "n_sort",
            "columns[0][name]": "cmm_posts_detail.n_sort",
            "columns[0][searchable]": "true",
            "columns[0][orderable]": "true",
            "columns[0][search][value]": "",
            "columns[0][search][regex]": "false",
            "columns[1][data]": "bookmark_created_at",
            "columns[1][name]": "bookmark_chapters.created_at",
            "columns[1][searchable]": "false",
            "columns[1][orderable]": "true",
            "columns[1][search][value]": "",
            "columns[1][search][regex]": "false",
            "order[0][column]": "0",
            "order[0][dir]": "asc",
            "order[0][name]": "cmm_posts_detail.n_sort",
            start: "0",
            length: "1000",
            "search[value]": "",
            "search[regex]": "false",
            post_id: postId,
            only_bookmark: "false",
        });

        const res = await fetch(
            `${BASE_URL}/ajax/listChapterDataAjax?${params.toString()}`,
            {
                headers: {
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": chapterUrl,
                },
            }
        );

        const json = await res.json();
        if (!json?.data) throw new Error("Invalid chapter list response");

        return json.data.map((c, i) => ({
            id: `${BASE_URL}/book/${contentId}/chapter-${i+1}`,
            title: c.title,
            number: Number(c.n_sort),
            index: i,
        }));
    }


    async findChapterPages(chapterId) {
        const html = await fetchHtml(chapterId, {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
        });

        const $ = parseHTML(html);
        let content = $("#content").html() ?? "";

        if (!content) return "";

        content = content.replace(/<script\b[\s\S]*?<\/script>/gi, "");
        content = content.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
        content = content.replace(/<ins\b[\s\S]*?<\/ins>/gi, "");

        for (let i = 0; i < 3; i++) {
            content = content.replace(/<div[^>]*class="[^"]*nf-ads[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
        }

        return content.trim();
    }
}