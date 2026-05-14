(function () {
    "use strict";

    const DEFAULT_TIMEOUT_MS = 8000;
    const GET_FALLBACK_STATUSES = new Set([405, 501]);

    function normalizeHref(value) {
        const href = String(value).trim();

        if (/^(https?:)?\/\//i.test(href)) {
            return href;
        }

        return `https://${href}`;
    }

    function renderNavList(navList, navItems, options = {}) {
        navList.replaceChildren();

        navItems.forEach(({ href, label }) => {
            const li = document.createElement("li");
            const link = document.createElement("a");

            link.href = href;
            link.textContent = label || href;
            link.dataset.status = "checking";

            if (isExternalHref(link.href)) {
                link.rel = "noopener noreferrer";
            }

            li.appendChild(link);
            navList.appendChild(li);

            checkLink(link, options);
        });
    }

    async function checkLink(link, options = {}) {
        const result = await checkLinkStatus(link.href, options);

        link.dataset.status = result.ok ? "ok" : "error";
        link.dataset.statusCode = result.status || "";
        link.title = getStatusTitle(result);
    }

    async function checkLinkStatus(href, options = {}) {
        const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
        let result = await requestLink(href, "HEAD", timeoutMs);

        if (result.response && GET_FALLBACK_STATUSES.has(result.response.status)) {
            result = await requestLink(href, "GET", timeoutMs);
        }

        if (!result.response) {
            return {
                ok: false,
                error: result.error,
            };
        }

        return {
            ok: result.response.ok,
            status: result.response.status,
            statusText: result.response.statusText,
        };
    }

    async function requestLink(href, method, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(href, {
                method,
                cache: "no-store",
                redirect: "follow",
                signal: controller.signal,
            });

            return { response };
        } catch (error) {
            if (method === "HEAD") {
                return requestLink(href, "GET", timeoutMs);
            }

            return { error };
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    function getStatusTitle(result) {
        if (result.ok) {
            return result.status ? `링크 확인됨 (${result.status})` : "링크 확인됨";
        }

        if (result.status) {
            const statusText = result.statusText ? ` ${result.statusText}` : "";
            return `링크 오류 (${result.status}${statusText})`;
        }

        return "링크 확인 실패";
    }

    function isExternalHref(href) {
        return new URL(href, window.location.href).origin !== window.location.origin;
    }

    window.SiteLinks = {
        checkLink,
        checkLinkStatus,
        normalizeHref,
        renderNavList,
    };
}());
