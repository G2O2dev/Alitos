export class AggTotalCellRenderer {
    init(params) {
        this.params = params;
        this.api = params.grid;

        this.eGui = document.createElement('div');
        this.eGui.classList.add('agg-total-cell-renderer');

        this.updateText();
        this.updateText = this.updateText.bind(this);
        this.api.on("selectionChanged", this.updateText);
        this.api.gridApi.addEventListener('modelUpdated', this.updateText);
    }

    updateText() {
        const selectedCount = this.api.gridApi.getSelectedRows().length;

        if (selectedCount > 0) {
            this.eGui.innerHTML = `<span>Выбрано: ${selectedCount}</span>`;
        } else {
            const totalDisplayedRows = this.api.gridApi.getDisplayedRowCount() - 1;
            this.eGui.innerHTML = `<span>Всего: ${totalDisplayedRows}</span>`;
        }
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.updateText();
        return true;
    }

    destroy() {
        this.api.off("selectionChanged", this.updateText);
    }
}