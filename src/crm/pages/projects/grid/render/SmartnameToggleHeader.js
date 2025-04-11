export class SmartnameToggleHeader {
    init(params) {
        this.params = params;
        this.eGui = document.createElement('div');
        const isSmartname = params.column.colId === "static.smartName";

        this.eGui.innerHTML = `
            <div data-ref="eLabel" class="ag-header-cell-label" role="presentation">
                <span data-ref="eText" class="ag-header-cell-text">${params.displayName}</span>
                <span data-ref="eSortIndicator" class="ag-sort-indicator-container">
                    <span data-ref="eSortOrder" class="ag-sort-indicator-icon ag-sort-order ag-hidden" aria-hidden="true"></span>
                    <span data-ref="eSortAsc" class="ag-sort-indicator-icon ag-sort-ascending-icon ag-hidden" aria-hidden="true"><span class="ag-icon ag-icon-asc" unselectable="on" role="presentation"></span></span>
                    <span data-ref="eSortDesc" class="ag-sort-indicator-icon ag-sort-descending-icon ag-hidden" aria-hidden="true"><span class="ag-icon ag-icon-desc" unselectable="on" role="presentation"></span></span>
                    <span data-ref="eSortMixed" class="ag-sort-indicator-icon ag-sort-mixed-icon ag-hidden" aria-hidden="true"><span class="ag-icon ag-icon-none" unselectable="on" role="presentation"></span></span>
                    <span data-ref="eSortNone" class="ag-sort-indicator-icon ag-sort-none-icon ag-hidden" aria-hidden="true"><span class="ag-icon ag-icon-none" unselectable="on" role="presentation"></span></span>
                </span>
            </div>
                    
            <div style="display: flex; gap: 8px;">
                <span data-ref="eTagToggle" class="ag-header-icon ag-header-cell-filter-button" aria-hidden="true"><span class="ag-icon al-icon-tag" unselectable="on" role="presentation"></span></span>
                    ${isSmartname ? `<span data-ref="eFilterButton" class="ag-header-icon ag-header-cell-filter-button" aria-hidden="true"><span class="ag-icon ag-icon-filter" unselectable="on" role="presentation"></span></span>` : ''}
            </div>
        `;

        this.eGui.style.display = 'flex';
        this.eGui.style.justifyContent = 'space-between';
        this.eGui.style.width = '100%';
        this.eGui.style.alignItems = 'center';
        Object.assign(this.eGui.style, {
            cursor: 'pointer',
        });

        this.eHeaderLabel = this.eGui.querySelector('[data-ref="eLabel"]');
        this.eSortIndicator = this.eGui.querySelector('[data-ref="eSortIndicator"]');
        this.eSortAsc = this.eGui.querySelector('[data-ref="eSortAsc"]');
        this.eSortDesc = this.eGui.querySelector('[data-ref="eSortDesc"]');
        this.eSortNone = this.eGui.querySelector('[data-ref="eSortNone"]');
        const tagToggle = this.eGui.querySelector('[data-ref="eTagToggle"]');

        if (isSmartname) {
            this.eFilterIcon = this.eGui.querySelector('[data-ref="eFilterButton"]');
            this.filterClickListener = (event) => {
                event.stopPropagation();
                this.params.showFilter(this.eFilterIcon);
            };
            this.eFilterIcon.addEventListener('click', this.filterClickListener);
        }

        this.tagToggleListener = (event) => {
            event.stopPropagation();
            const api = this.params.api;
            if (this.params.column.getColId() === 'static.tag') {
                api.setColumnsVisible(['static.tag', 'static.name'], false);
                api.setColumnsVisible(['static.smartName'], true);
            } else {
                api.setColumnsVisible(['static.smartName'], false);
                api.setColumnsVisible(['static.tag', 'static.name'], true);
            }
            api.sizeColumnsToFit();
        };
        tagToggle.addEventListener('click', this.tagToggleListener);


        if (this.params.enableSorting) {
            this.sortClickListener = (event) => {
                if (event.target.closest('[data-ref="eFilterButton"]') || event.target.closest('[data-ref="eTagToggle"]')) {
                    return;
                }
                this.params.progressSort(event.shiftKey);
            };

            this.eGui.addEventListener('click', this.sortClickListener);
        }

        this.onSortChanged = this.onSortChanged.bind(this);
        this.params.column.addEventListener('sortChanged', this.onSortChanged);
        this.onSortChanged();
    }

    getGui() {
        return this.eGui;
    }

    onSortChanged() {
        this.eGui.classList.remove('ag-header-cell-sorted-asc', 'ag-header-cell-sorted-desc', 'ag-header-cell-sorted-none');

        this.eSortAsc.classList.add('ag-hidden');
        this.eSortDesc.classList.add('ag-hidden');

        const sort = this.params.column.getSort();
        if (sort === 'asc') {
            this.eGui.classList.add('ag-header-cell-sorted-asc');
            this.eSortAsc.classList.remove('ag-hidden');
        } else if (sort === 'desc') {
            this.eGui.classList.add('ag-header-cell-sorted-desc');
            this.eSortDesc.classList.remove('ag-hidden');
        } else {
            this.eGui.classList.add('ag-header-cell-sorted-none');
        }
    }

    destroy() {
        if (this.filterClickListener) {
            this.eFilterIcon.removeEventListener('click', this.filterClickListener);
        }
        if (this.tagToggleListener) {
            this.eGui.querySelector('[data-ref="eTagToggle"]').removeEventListener('click', this.tagToggleListener);
        }
        if (this.sortClickListener) {
            this.eGui.removeEventListener('click', this.sortClickListener);
        }

        this.params.column.removeEventListener('sortChanged', this.onSortChanged);
    }
}