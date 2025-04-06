export class RowCheckboxRenderer {
    init(params) {
        this.params = params;
        this.eGui = document.createElement('div');
        this.eGui.innerHTML = `<input type="checkbox" id="rowCheckbox">`;
        this.eCheckbox = this.eGui.querySelector('#rowCheckbox');
        this.eCheckbox.checked = params.node.isSelected();

        this.eGui.style.display = 'flex';
        this.eGui.style.alignItems = 'center';
        this.eGui.style.justifyContent = 'center';
        this.eGui.style.height = '100%';
        this.eGui.style.width = '100%';

        this.onSelectionChanged = this.onSelectionChanged.bind(this);
        this.onCellClicked = this.onCellClicked.bind(this);
        this.onDragStart = this.onDragStart.bind(this);
        this.onDragOver = this.onDragOver.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);

        this.eCheckbox.addEventListener('change', this.onCheckboxChanged.bind(this));
        this.eGui.addEventListener('mousedown', this.onCellClicked);
        this.eGui.addEventListener('dragstart', this.onDragStart);
        this.eGui.addEventListener('dragover', this.onDragOver);
        this.eGui.addEventListener('dragend', this.onDragEnd);

        this.params.api.addEventListener('selectionChanged', this.onSelectionChanged);
    }

    onCheckboxChanged(event) {
        const isChecked = event.target.checked;
        this.params.node.setSelected(isChecked);
    }

    onCellClicked(event) {
        if (event.shiftKey && RowCheckboxRenderer.lastSelectedNode) {
            const start = Math.min(RowCheckboxRenderer.lastSelectedNode.rowIndex, this.params.node.rowIndex);
            const end = Math.max(RowCheckboxRenderer.lastSelectedNode.rowIndex, this.params.node.rowIndex);
            for (let i = start; i <= end; i++) {
                this.params.api.getDisplayedRowAtIndex(i).setSelected(true);
            }
        } else {
            const isSelected = this.params.node.isSelected();
            this.params.node.setSelected(!isSelected);
        }
        RowCheckboxRenderer.lastSelectedNode = this.params.node;
    }

    onDragStart(event) {
        if (event.button !== 2) return; // Только для правой кнопки мыши
        RowCheckboxRenderer.isDragging = true;
        RowCheckboxRenderer.dragStartRowIndex = this.params.node.rowIndex;
        event.dataTransfer.setData('text/plain', ''); // Требуется для Firefox
    }

    onDragOver(event) {
        if (!RowCheckboxRenderer.isDragging) return;
        event.preventDefault();
        const currentRowIndex = this.params.node.rowIndex;
        const start = Math.min(RowCheckboxRenderer.dragStartRowIndex, currentRowIndex);
        const end = Math.max(RowCheckboxRenderer.dragStartRowIndex, currentRowIndex);
        for (let i = start; i <= end; i++) {
            this.params.api.getDisplayedRowAtIndex(i).setSelected(true);
        }
    }

    onDragEnd(event) {
        if (event.button !== 2) return;
        RowCheckboxRenderer.isDragging = false;
    }

    onSelectionChanged() {
        this.eCheckbox.checked = this.params.node.isSelected();
    }

    getGui() {
        return this.eGui;
    }

    destroy() {
    }
}

export class HeaderCheckboxRenderer {
    init(params) {
        this.params = params;
        this.eGui = document.createElement('div');
        this.eGui.innerHTML = `
      <input type="checkbox" id="headerCheckbox">
    `;
        this.eHeaderCheckbox = this.eGui.querySelector('#headerCheckbox');

        this.onSelectionChanged = this.onSelectionChanged.bind(this);
        this.eHeaderCheckbox.addEventListener('change', this.onCheckboxChanged.bind(this));
        this.params.api.addEventListener('selectionChanged', this.onSelectionChanged);
    }

    onCheckboxChanged() {
        if (this.eHeaderCheckbox.checked) {
            this.params.api.selectAllFiltered();
        } else {
            this.params.api.deselectAll();
        }
    }

    onSelectionChanged() {
        const selectedNodes = this.params.api.getSelectedNodes();
        const allRowNodes = this.params.api.getModel().rowsToDisplay;
        this.eHeaderCheckbox.checked = selectedNodes.length > 0 && selectedNodes.length === allRowNodes.length;
        this.eHeaderCheckbox.indeterminate = selectedNodes.length > 0 && selectedNodes.length < allRowNodes.length;
    }

    getGui() {
        return this.eGui;
    }

    destroy() {
        this.eHeaderCheckbox.removeEventListener('change', this.onCheckboxChanged);
        this.params.api.removeEventListener('selectionChanged', this.onSelectionChanged);
    }
}