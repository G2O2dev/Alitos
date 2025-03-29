export class ExpandAllHeader {
    expanded = false;

    init(params) {
        this.params = params;
        this.eGui = document.createElement('div');
        this.eGui.innerHTML = `
            <span class="ag-header-cell-text">${params.displayName}</span>
            <span data-ref="eFilterButton" class="ag-header-btn ag-header-icon" aria-hidden="true">
                <span class="ag-icon ag-icon-tree-closed" unselectable="on" role="presentation"></span>
            </span>
        `;
        this.eGui.classList.add('ag-cell-label-container', 'ag-header-cell-sorted-none');
        Object.assign(this.eGui.style, {
            gap: '9px',
            cursor: 'pointer',
            justifyContent: 'flex-end'
        });

        const button = this.eGui.querySelector('.ag-header-btn');
        const buttonIcon = button.querySelector('.ag-icon');
        button.addEventListener('click', () => {
            const isOpen = buttonIcon.classList.contains('ag-icon-tree-open');
            buttonIcon.classList.toggle('ag-icon-tree-open', !isOpen);
            buttonIcon.classList.toggle('ag-icon-tree-closed', isOpen);
            isOpen ? this.params.api.collapseAll() : this.params.api.expandAll();
        });
    }

    getGui() {
        return this.eGui;
    }
}