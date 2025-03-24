export class PageNavigator {
    constructor(pageClasses, defaultPage) {
        this.pages = {};
        this.defaultPage = defaultPage;

        for (const [pageId, PageClass] of Object.entries(pageClasses)) {
            this.pages[pageId] = new PageClass();
        }

        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('popstate', (e) => {
            const state = e.state;
            if (state && state.page && this.pages[state.page]) {
                this.showPage(state.page);
            } else {
                this.showPage(this.defaultPage);
            }
        });

        window.addEventListener('hashchange', () => {
            const pageId = location.hash.slice(1);
            if (pageId && this.pages[pageId]) {
                this.showPage(pageId);
            } else {
                this.showPage(this.defaultPage);
            }
        });
    }

    navigate(pageId) {
        if (pageId === this.activePage)
            return false;

        this.showPage(pageId);
        history.pushState({ page: pageId }, '', `#${pageId}`);

        return true;
    }

    showPage(pageId) {
        this.pages[this.activePage]?.hide();
        this.activePage = pageId;

        if (this.pages[pageId]) {
            this.pages[pageId].show();
        } else {
            this.pages[this.defaultPage].show();
        }
    }

    getPage(pageId) {
        return this.pages[pageId];
    }

    init() {
        let initialPage = location.hash.slice(1);
        if (!initialPage || !this.pages[initialPage]) {
            initialPage = this.defaultPage;
        }
        this.showPage(initialPage);
        history.replaceState({ page: initialPage }, '', `#${initialPage}`);
    }
}
