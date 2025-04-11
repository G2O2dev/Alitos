export class SmartnameToggleHeader {
    init(params) {
        this.params = params;
        this.eGui = document.createElement('div');
        this.eGui.innerHTML = `
            <span data-ref="eFilterButton" class="ag-header-btn ag-header-icon" aria-hidden="true">
                <span class="ag-icon al-icon-tag" unselectable="on" role="presentation"></span>
            </span>
            <span class="ag-header-cell-text">${params.displayName}</span>
        `;
        this.eGui.classList.add('ag-cell-label-container', 'ag-header-cell-sorted-none');
        Object.assign(this.eGui.style, {
            cursor: 'pointer',
        });

        const button = this.eGui.querySelector('.ag-header-btn');
        button.addEventListener('click', () => {
            const api = this.params.api;
            if (this.params.column.getColId() === 'static.tag') {
                api.setColumnsVisible(['static.tag', 'static.name'], false);
                api.setColumnsVisible(['static.smartName'], true);
            } else {
                api.setColumnsVisible(['static.smartName'], false);
                api.setColumnsVisible(['static.tag', 'static.name'], true);
            }
            api.sizeColumnsToFit();
        });
    }

    getGui() {
        return this.eGui;
    }
}