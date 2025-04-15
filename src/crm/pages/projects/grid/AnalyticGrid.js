import {
    calcPercent,
    findStringsWithPhone,
    formatPercentage,
    normalizePhoneNumber, pluralize,
    range, replaceDomainsWithLinks,
} from "../../../utils/helpers.js";
import {AG_GRID_LOCALE_RU} from "../../../../lib/ag-grid-ru.js";
import {aggFuncs} from "./helpers/aggFuncs.js";
import {dateFormatter, weekdaysFormatter} from "./helpers/formatters.js";
import {ExpandAllHeader} from "./render/ExpandAllHeader.js";
import {SmartnameToggleHeader} from "./render/SmartnameToggleHeader.js";
import {AggTotalCellRenderer} from "./render/AggTotal.js";

export class AnalyticGrid {
    _deletedShown = false;
    _rows = new Map();
    _searchCache = {};
    #eventTarget = new EventTarget();

    gridApi = null;
    gridElement = null;
    searchValue = '';
    isPercentSorting = false;
    sourcesGrouping = false;

    #smartnameCache = new WeakMap();

    renderSmartnameForCell(params) {
        if (params.node.footer) return;

        const node = params.node;
        const data = node.data;

        const cached = this.#smartnameCache.get(node);
        if (cached) return cached;

        const setToCache = (node, value) => this.#smartnameCache.set(node, value);
        const createCellHtml = (name, tag, operator = '') => {
            return `<span class="smartname_cell">
                <span class="smartname_name">${name}</span>
                ${tag ? `<span class="smartname_tag"> (${tag})</span>` : ''}
                ${operator ? `<span class="smartname_operator">${operator}</span>` : ''}
            </span>`;
        };
        const getDomains = (childNodes) => {
            const allDomains = childNodes.flatMap(child => child.data.static.smartName.domains || []);
            const uniqueDomains = [...new Set(allDomains)];
            const displayed = uniqueDomains.slice(0, 5).join(', ');
            return createCellHtml(replaceDomainsWithLinks(displayed, true));
        };

        if (data) {
            return createCellHtml(data.static.smartName.name, data.static.smartName.tag, data.static.operator);
        }
        const firstLeafSn = node.childrenAfterFilter[0].data.static.smartName;
        if (node.childrenAfterFilter.every(val => {
            const sn = val.data.static.smartName;
            return sn.name === firstLeafSn.name && sn.tag === firstLeafSn.tag;
        })) {
            return this.renderSmartnameForCell({node: node.allLeafChildren[0]});
        }
        const result = getDomains(node.allLeafChildren);
        setToCache(node, result);
        return result;
    }

    constructor(config) {
        const {selector, periods} = config;
        this.gridElement = document.querySelector(selector);
        this.periods = periods;

        this.gridOptions = this.#buildGridOptions(periods);
        this.gridApi = agGrid.createGrid(this.gridElement, this.gridOptions);

        this.#registerGlobalEvents();
    }

    get deletedShown() {
        return this._deletedShown;
    }

    set deletedShown(value) {
        this._deletedShown = value;
        this.gridApi?.onFilterChanged();
    }

    get rows() {
        return this._rows;
    }

    set rows(values) {
        this._rows.clear();
        values.forEach(row => this._rows.set(row.static.id, row));
    }

    //#region Options builder
    #buildGridOptions() {
        const theme = agGrid.themeQuartz.withParams({
            accentColor: 'var(--color-accent)',
            backgroundColor: 'var(--color-bg)',
            chromeBackgroundColor: {ref: 'foregroundColor', mix: 0.07, onto: 'backgroundColor'},
            columnHoverColor: 'var(--color-gray-200)',
            foregroundColor: 'var(--color-text-primary)',
            headerBackgroundColor: 'var(--color-gray-100)',
            borderColor: 'var(--color-gray-300)',
            headerFontSize: 14,
            headerRowBorder: true,
            rowHoverColor: 'var(--color-gray-100)',
            selectedRowBackgroundColor: "var(--color-gray-200)",
            spacing: 6,
            headerVerticalPaddingScale: 0.8,
            wrapperBorder: true,
            wrapperBorderRadius: 'var(--corner-radius)',
            rowBorder: {style: 'solid', width: 1, color: 'var(--color-gray-300)'},
            columnBorder: {style: 'solid', width: 1, color: 'var(--color-gray-300)'},
        });

        const colDefs = this.#buildColDefs();

        return {
            theme,
            scrollbarWidth: 8,
            colResizeDefault: 'shift',
            tooltipShowDelay: 1000,
            localeText: AG_GRID_LOCALE_RU,
            grandTotalRow: "bottom",
            rowData: null,
            suppressAggFuncInHeader: true,

            rowSelection: {
                mode: "multiRow",
                hideDisabledCheckboxes: true,
                groupSelects: "filteredDescendants",

                headerCheckbox: true,
                selectAll: "filtered",
            },
            selectionColumnDef: {
                colId: "checkboxColumn",
                maxWidth: 35,
                minWidth: 35,
                cellStyle: (p) => {
                    if (!p.node.footer) {
                        return {padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center'}
                    }
                },
                colSpan: (p) => {
                    if (p.node.footer) {
                        return this.sourcesGrouping ? 4 : 3;
                    }
                    return 1;
                },
                cellRendererSelector: (params) => {
                    if (params.node.footer) {
                        return {
                            component: AggTotalCellRenderer,
                            params: {
                                grid: this,
                            },
                        };
                    }
                },
            },

            onSelectionChanged: () => this.#onSelectionChanged(),

            isExternalFilterPresent: () => true,
            doesExternalFilterPass: node => this.#filter(node),
            getRowId: params => typeof params.data === 'string' ? params.data : params.data.static.id,
            cellSelection: {
                enableHeaderHighlight: true,
            },
            defaultColDef: {
                flex: 1,
                filter: true,
                filterParams: {closeOnApply: true, suppressSelectAll: true},
                suppressHeaderMenuButton: true,
            },
            aggFuncs: aggFuncs,
            columnDefs: colDefs,
            autoGroupColumnDef: {
                minWidth: 160,
                maxWidth: 320,
                headerName: 'Источник',

                headerComponent: ExpandAllHeader,
            },
            onGridSizeChanged: params => this.#fitColumns(),
            onFirstDataRendered: params => this.#fitColumns(),
            getContextMenuItems: ({defaultItems, column}) => {
                const newDefaultItems = defaultItems?.filter(i =>
                    !['cut', 'copyWithHeaders', 'copyWithGroupHeaders', 'paste'].includes(i)
                );
                const newItems = [];
                newItems.push({
                    name: 'Копировать источники',
                    action: () => this.copySourcesOfSelected(),
                });

                const selectedCells = this.gridApi.getCellRanges()[0];
                if (selectedCells) {
                    const selected = this.getSelectedRows();
                    newItems.push({
                        name: `Скрыть ${pluralize(selected.length, 'проект', '', 'а', 'ов')}`,
                        action: () => {
                            this.gridApi.clearCellSelection();
                            this.gridApi.clearFocusedCell();
                            this.#hideCells(selected);
                        },
                    });
                }

                const items = newItems;
                if (newDefaultItems)
                    items.push(...newDefaultItems);

                return items;
            },
            getMainMenuItems: ({defaultItems}) => {
                const filtered = defaultItems?.filter(i => !['pinSubMenu', 'autoSizeThis', 'autoSizeAll', 'resetColumns'].includes(i));

                filtered.push({
                    name: 'Сбросить столбцы',
                    action: () => this.resetColumns(),
                });

                return filtered;
            },
            onColumnVisible: ({api}) => api.sizeColumnsToFit(),
            sendToClipboard: this.#sendSelectedToClipboard,
            onFilterChanged: () => this.refreshAggregated(),

            processCellForClipboard: (params) => {
                if (params.column.colId === 'static.smartName') {
                    if (!params.data) {
                        return params.node?.data?.static.name ?? params.node.aggData["static.name"];
                    }
                    // const parser = new DOMParser();
                    // const doc = parser.parseFromString(params.data.static.name, 'text/html');
                    return params.data.static.name;
                }
                return params.value;
            },

            onGridReady: (params) => {
                this.gridElement.addEventListener('auxclick', function(event) {
                    if (event.button !== 1) return;

                    const headerCell = event.target.closest('.ag-header-cell');
                    if (!headerCell) return;

                    const colId = headerCell.getAttribute('col-id');
                    if (!colId) return;

                    const filterModel = params.api.getFilterModel();
                    if (filterModel && filterModel[colId]) {
                        delete filterModel[colId];
                        gridApi.setFilterModel(filterModel);
                    }

                    event.preventDefault();
                    event.stopPropagation();
                });


                const gridApi = params.api;
                let isDragSelecting = false;
                let dragSelectAction = null;
                let startRowNode = null;
                let initialRowIndex = -1;
                const gridBodyViewport = this.gridElement.querySelector('.ag-body-viewport');

                const getRowNodeFromEvent = (event) => {
                    const scrollTop = gridBodyViewport.scrollTop;
                    const mouseYRelative = event.clientY - gridBodyViewport.getBoundingClientRect().top;
                    const absolutePixel = mouseYRelative + scrollTop;
                    const renderedNodes = gridApi.getRenderedNodes();
                    if (renderedNodes.length === 0) return null;

                    let foundNode = renderedNodes.find(node =>
                        node && node.rowTop != null && node.rowHeight != null &&
                        absolutePixel >= node.rowTop && absolutePixel < (node.rowTop + node.rowHeight)
                    ) || (mouseYRelative < 0 ? renderedNodes.find(n => n?.selectable) :
                        mouseYRelative > gridBodyViewport.getBoundingClientRect().height ? renderedNodes.slice().reverse().find(n => n?.selectable) : null);

                    return foundNode?.selectable ? foundNode : null;
                };

                const onMouseDown = (e) => {
                    if (e.button !== 0 || !e.target.closest('[col-id="ag-Grid-SelectionColumn"]') || !e.target.closest('.ag-body-viewport')) return;
                    e.preventDefault();
                    const node = getRowNodeFromEvent(e);
                    if (node && node.selectable && node.rowIndex != null) {
                        isDragSelecting = true;
                        startRowNode = node;
                        initialRowIndex = node.rowIndex;
                        dragSelectAction = node.isSelected() ? 'deselect' : 'select';
                        document.addEventListener('mousemove', onMouseMove, {passive: false});
                        document.addEventListener('mouseup', onMouseUp);
                    }
                };

                const onMouseMove = (e) => {
                    if (!isDragSelecting || !startRowNode) return;
                    e.preventDefault();
                    const currentRowNode = getRowNodeFromEvent(e);
                    if (!currentRowNode || !currentRowNode.selectable || currentRowNode.rowIndex == null || currentRowNode.rowIndex === startRowNode.rowIndex) return;

                    const currentRowIndex = currentRowNode.rowIndex;
                    const targetSelectionState = dragSelectAction === 'select';
                    const lowerIndex = Math.min(startRowNode.rowIndex, currentRowIndex);
                    const upperIndex = Math.max(startRowNode.rowIndex, currentRowIndex);
                    const currentDragMin = Math.min(initialRowIndex, currentRowIndex);
                    const currentDragMax = Math.max(initialRowIndex, currentRowIndex);
                    const nodesToSelect = [];
                    const nodesToDeselect = [];

                    for (let i = lowerIndex; i <= upperIndex; i++) {
                        const node = gridApi.getDisplayedRowAtIndex(i);
                        if (node && node.selectable && node.rowIndex != null) {
                            const shouldBeSelected = (node.rowIndex >= currentDragMin && node.rowIndex <= currentDragMax) ? targetSelectionState : !targetSelectionState;
                            if (node.isSelected() !== shouldBeSelected) {
                                (shouldBeSelected ? nodesToSelect : nodesToDeselect).push(node);
                            }
                        }
                    }

                    if (nodesToSelect.length) gridApi.setNodesSelected({
                        nodes: nodesToSelect,
                        newValue: true,
                        suppressFinishActions: true
                    });
                    if (nodesToDeselect.length) gridApi.setNodesSelected({
                        nodes: nodesToDeselect,
                        newValue: false,
                        suppressFinishActions: true
                    });

                    startRowNode = currentRowNode;
                };

                const onMouseUp = (e) => {
                    if (e.button !== 0 || !isDragSelecting) return;
                    const isClick = startRowNode.rowIndex === initialRowIndex;

                    if (isClick && startRowNode) {
                        const newValue = dragSelectAction === 'select';
                        gridApi.setNodesSelected({nodes: [startRowNode], newValue});
                    } else {
                        gridApi.setNodesSelected({nodes: [], newValue: false});
                    }

                    isDragSelecting = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    startRowNode = null;
                    initialRowIndex = -1;
                    dragSelectAction = null;
                };

                this.gridElement.addEventListener('mousedown', onMouseDown);
                gridApi.addEventListener('gridPreDestroy', () => {
                    this.gridElement.removeEventListener('mousedown', onMouseDown);
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                });
            }
        };
    }

    #buildColDefs() {
        const periodsColumns = this.#buildPeriodsColumns();
        const colDefs = this.#buildBasicColumns().concat(periodsColumns);

        colDefs.push(this.#buildLimitColumn(), ...this.#buildHiddenColumns());

        return colDefs;
    }
    #buildBasicColumns() {
        return [
            {
                headerName: 'Id',
                field: 'static.id',
                minWidth: 90,
                maxWidth: 90,
                resizable: false,
                filter: false,
                suppressColumnsToolPanel: true,
                suppressMovable: true,
            },
            {
                headerName: 'Умное имя',
                field: 'static.smartName',
                minWidth: 220,
                headerTooltip: 'Умное имя имеет ряд улучшений над названием и тегом:\n- Компилирует название и тег в формате: Название (Тег).\n- В конце ячейки отображается реальный оператор.\n- При клике на домен, он будет открыт\n- Если тег повторяет название он не будет отображён.',
                cellRenderer: (p) => this.renderSmartnameForCell(p),

                suppressColumnsToolPanel: true,
                filterParams: {suppressMiniFilter: true},
                filterValueGetter: params => params.data.static.operator,
                headerComponent: SmartnameToggleHeader,

                comparator: (valueA, valueB, nodeA, nodeB, isDescending) => {
                    const isEmpty = (val) => val == null || String(val).trim() === '';

                    const aIsNull = valueA == null;
                    const bIsNull = valueB == null;
                    if (aIsNull && bIsNull) return 0;
                    if (aIsNull) return isDescending ? -1 : 1;
                    if (bIsNull) return isDescending ? 1 : -1;

                    const compareFields = (fieldA, fieldB) => {
                        const fieldAEmpty = isEmpty(fieldA);
                        const fieldBEmpty = isEmpty(fieldB);
                        if (fieldAEmpty && fieldBEmpty) return 0;
                        if (fieldAEmpty) return 1;
                        if (fieldBEmpty) return -1;
                        return String(fieldA).localeCompare(String(fieldB));
                    };

                    const nameComparison = compareFields(valueA ? valueA.name : '', valueB ? valueB.name : '');
                    if (nameComparison !== 0) return nameComparison;

                    return compareFields(valueA ? valueA.tag : '', valueB ? valueB.tag : '');
                }
            },
            {
                headerName: 'Название',
                field: 'static.name',
                minWidth: 120,
                filter: false,
                aggFunc: "name",
                hide: true,
                suppressColumnsToolPanel: true,
            },
            {
                headerName: 'Тег',
                field: 'static.tag',
                minWidth: 70,
                filter: false,
                resizable: true,
                aggFunc: "same",
                hide: true,
                suppressColumnsToolPanel: true,
                headerComponent: SmartnameToggleHeader,
            },
            {
                headerName: 'Статус',
                field: 'static.status',
                minWidth: 120,
                maxWidth: 120,
                resizable: false,
                filterParams: {suppressMiniFilter: true},
                aggFunc: "activeInactive",
                cellClass: info => this.#getCellClassByStatus(info.data),
                valueGetter: params => {
                    if (params.data) {
                        if (params.data.static.delete_date)
                            return 'Удалён';

                        if (params.data.static.status === 1) {
                            return 'Активен';
                        } else {
                            return 'Неактивен';
                        }
                    }
                },
                headerTooltip: 'Текущий статус проекта. Если ячейка:\nЖёлтая — при последней отправке лимит проекта был снижен системой из-за нехватки баланса.\nКрасная — проект не был отправлен из-за нехватки баланса.',
            },
            {
                headerName: 'Тип',
                field: 'static.project_type',
                minWidth: 120,
                maxWidth: 120,
                resizable: false,
                cellRenderer: params => this.#projectTypeRenderer(params),
                headerTooltip: 'Тип проекта и количество источников',
                filterParams: {suppressMiniFilter: true},
                aggFunc: "same",
            },
        ];
    }
    #buildPeriodsColumns() {
        const periodsColumns = [];
        for (const period of this.periods) {
            periodsColumns.push(...this.#buildPeriodColumns(period, this.#usedPeriodColumns));
        }

        return periodsColumns;
    }
    #buildLimitColumn() {
        const limitCellClass = params => {
            switch (params.data?.static.limitState) {
                case "warning":
                    return "project-limit-warning";
                case "hint":
                    return "project-limit-hint";
            }
        }
        const limitCellRenderer = (params) => {
            let potential;
            if (params.data) {
                potential = params.data.static.limitPotential;
            }

            return `${params.value}${potential === undefined ? '' : ` <span class="limitPotential">${potential}</span>`}`;
        }

        return this.#createNumberColumn('Лимит', 'static.limit', {
            defaultOption: 'greaterThan',
            filterOptions: [
                'equals',
                'notEqual',
                'greaterThan',
                'lessThan',
                'inRange',
                {
                    displayKey: 'canGiveMoreThanLimit',
                    displayName: 'Может давать больше',
                    predicate: () => true,
                    numberOfInputs: 0,
                },
            ],
        }, 'Лимит проекта. Если ячейка:\nГолубая — проект коснулся лимита 1 или 2 раза за последние 7 дней.\nЗелёная — проект коснулся лимита более 2 раз за последние 7 дней.', limitCellRenderer, limitCellClass);
    }
    #buildHiddenColumns() {
        const regionCellClass = (params) => {
            if (!params.data?.static.region_limit) return;

            return params.data.static.regions_reverse ? "project-region-reverse" : "project-region";
        }

        return [
            {
                headerName: 'Дни получения',
                field: 'static.workdays',
                minWidth: 160,
                maxWidth: 180,
                resizable: false,
                filter: 'agTextColumnFilter',
                filterParams: {defaultOption: 'contains'},
                headerTooltip: 'В какие дни работает проект',
                hide: true,
                aggFunc: "same",
                valueFormatter: p => weekdaysFormatter(p),
            },
            {
                headerName: 'Регион',
                field: 'static.region_limit',
                minWidth: 160,
                maxWidth: 180,
                resizable: false,
                filter: 'agTextColumnFilter',
                filterParams: {defaultOption: 'contains'},
                headerTooltip: 'Ограничение по регионам, отображается в виде кода региона. Если ячейка:\nЗелёная — Номера будут поступать только из этого региона.\nКрасная — Номера будут поступать из всех регионов кроме указанного.',
                hide: true,
                aggFunc: "same",
                cellClass: regionCellClass,
            },
            {
                headerName: 'Добавлен',
                field: 'static.creation_date',
                minWidth: 110,
                maxWidth: 110,
                resizable: false,
                filter: 'agDateColumnFilter',
                headerTooltip: 'Когда проект был добавлен',
                hide: true,
                valueFormatter: p => dateFormatter(p),
                aggFunc: "sameDate",
            },
            {
                headerName: 'Изменён',
                field: 'static.edit_date',
                minWidth: 110,
                maxWidth: 110,
                resizable: false,
                filter: 'agDateColumnFilter',
                headerTooltip: 'Когда проект был изменён',
                hide: true,
                valueFormatter: p => dateFormatter(p),
                aggFunc: "sameDate",
            },
            {
                headerName: 'Удалён',
                field: 'static.delete_date',
                minWidth: 110,
                maxWidth: 110,
                resizable: false,
                filter: 'agDateColumnFilter',
                headerTooltip: 'Когда проект был удалён',
                hide: true,
                valueFormatter: p => dateFormatter(p),
                aggFunc: "sameDate",
            },
            this.#createNumberColumn('Дублей всего', 'static.duplicate_cnt', {defaultOption: 'greaterThan'}, null, null, null, true),
            this.#createNumberColumn('Дублей сегодня', 'static.duplicate_cnt_now', {defaultOption: 'greaterThan'}, null, null, null, true),

            {
                headerName: 'Источник',
                field: 'static.sources',

                hide: true,
                suppressColumnsToolPanel: true,
            },
        ]
    }

    #getPeriodColumnTooltip(field, periodName) {
        switch (field) {
            case 'processed':
                return `Всего номеров за ${periodName}.`;
            case 'leads':
                return `Лиды за ${periodName}.\nКолонка является суммой статусов:\n- Переговоры\n- Ожидаем оплаты\n- Партнёрка\n- Оплачено\n- Тест драйв\n- Горячий`;
            case 'missed':
                return `Недозвоны за ${periodName}.\nКолонка является суммой статусов:\n- Недозвон\n- Конечный недозвон`;
            case 'declined':
                return `Отказы за ${periodName}.\nКолонка является суммой статусов:\n- Закрыто и не реализовано\n- На замену`;
            default:
                return field;
        }
    }
    #buildPeriodColumns(period, renderColumns) {
        const periodValueGetter = (params) => {
            const periodId = params.colDef.context.periodId;
            const field = params.colDef.field;
            const periodData = params.data?.periods[periodId];
            if (!periodData) return 0;
            const fieldData = periodData[field];
            return (fieldData.value !== undefined) ? (this.isPercentSorting ? fieldData.percent : fieldData.value) : fieldData;
        };

        const cellRender = (params, showPercent = true) => {
            const {field} = params.colDef;
            const periodId = params.colDef.context.periodId;
            let value, percent;
            if (params.node.group) {
                if (!showPercent) return params.value;
                if (params.value && typeof params.value === 'object' && params.value.value !== undefined) {
                    ({value, percent} = params.value);
                } else {
                    value = params.value;
                    const totalKey = `processed${periodId === 0 ? '' : `_${periodId}`}`;
                    const total = params.node.aggData[totalKey];
                    percent = calcPercent(total, value);
                }
            } else {
                const periodData = params.data.periods[periodId];
                if (!periodData) return 0;
                const fieldData = periodData[field];
                if (!showPercent) return fieldData.value !== undefined ? fieldData.value : fieldData;
                value = fieldData.value;
                percent = fieldData.percent;
            }
            const percentStr = formatPercentage(percent);
            return `${value} <span class="percent">${percentStr}%</span>`;
        };

        const getColumnName = (field) => {
            switch (field) {
                case 'processed':
                    return 'Номера';
                case 'leads':
                    return 'Лиды';
                case 'missed':
                    return 'Недозвоны';
                case 'declined':
                    return 'Отказы';

                case 'crm_base':
                    return 'База';
                case 'crm_missed':
                    return 'Недозвон';
                case 'crm_conversation':
                    return 'Переговоры';
                case 'crm_payexpect':
                    return 'Ожидаем оплаты';
                case 'crm_partner':
                    return 'Партнёрка';
                case 'crm_payed':
                    return 'Оплачено';
                case 'crm_closed':
                    return 'Закрыто и не реализовано';
                case 'crm_test':
                    return 'Тест драйв';
                case 'crm_hot':
                    return 'Горячий';
                case 'crm_finalymissed':
                    return 'Конечный недозвон';
                case 'crm_forreplace':
                    return 'На замену';
                default:
                    return field;
            }
        };

        const createPeriodColumn = (header, field, headerTooltip, cellRenderer, cellClass) => {
            return {
                headerName: header,
                field,
                minWidth: 120,
                maxWidth: 120,
                resizable: false,
                filter: 'agNumberColumnFilter',
                filterParams: {
                    filterOptions: ['equals', 'notEqual', 'greaterThan', 'lessThan', 'inRange'],
                },
                headerTooltip,
                aggFunc: "period",
                comparator: (a, b, aNode, bNode) => {
                    if (this.isPercentSorting && this.sourcesGrouping) {
                        const columnStates = this.gridApi.getColumnState();
                        const sortedColumns = columnStates.filter(col => col.sort)
                            .sort((colA, colB) => colA.sortIndex - colB.sortIndex);
                        for (const sortInfo of sortedColumns) {
                            const column = this.gridApi.getColumn(sortInfo.colId);
                            const colDef = column.getColDef();
                            const periodId = colDef.context.periodId;
                            let aPercent, bPercent;
                            if (aNode.aggData) {
                                const processedName = `processed${periodId === 0 ? '' : `_${periodId}`}`;
                                const aProcessed = aNode.aggData[processedName];
                                const bProcessed = bNode.aggData[processedName];
                                const aValue = aNode.aggData[colDef.field];
                                const bValue = bNode.aggData[colDef.field];
                                aPercent = calcPercent(aProcessed, aValue);
                                bPercent = calcPercent(bProcessed, bValue);
                            } else {
                                const aPeriodData = aNode.data.periods[periodId];
                                const bPeriodData = bNode.data.periods[periodId];
                                if (!aPeriodData || !bPeriodData) continue;
                                const aData = aPeriodData[field];
                                const bData = bPeriodData[field];
                                aPercent = aData.percent === undefined ? aData : aData.percent;
                                bPercent = bData.percent === undefined ? bData : bData.percent;
                            }
                            if (aPercent !== bPercent) return aPercent - bPercent;
                        }
                        return 0;
                    }
                    return a - b;
                },
                context: {periodId: period.index},
                valueGetter: periodValueGetter,
                cellRenderer: cellRenderer,
                cellClass: cellClass,
                suppressColumnsToolPanel: true,
            };
        };

        return renderColumns.map(columnField => {
            return createPeriodColumn(
                getColumnName(columnField),
                columnField,
                this.#getPeriodColumnTooltip(columnField, period.name),
                params => cellRender(params, columnField !== 'processed'),
                `${columnField}-cell`
            );
        });
    }
    //#endregion

    #onSelectionChanged() {
        this.#emit("selectionChanged");
    }

    refreshAggregated() {
        const groupNodes = [];
        this.gridApi.forEachNode(node => {
            if (node.group) groupNodes.push(node);
        });
        this.gridApi.refreshCells({
            rowNodes: groupNodes,
            force: true
        });
    }

    #registerGlobalEvents() {
        this.gridElement.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') {
                const selectedCells = this.gridApi.getCellRanges()[0];
                if (selectedCells && selectedCells.startColumn.colId === "static.id") {
                    const toRemove = this.getSelectedRows().map(row => row.data.static.id);
                    this.gridApi.clearCellSelection();
                    this.gridApi.clearFocusedCell();
                    this.#hideCells(toRemove);
                }
            }
            if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
                this.copySourcesOfSelected();
            }
            if (e.ctrlKey && e.altKey && e.code === "KeyC") {
                this.copyWebpagesOfSelected();
            }
        });
    }

    #hideCells(cells) {
        this.gridApi.applyTransaction({remove: cells});
        this.gridApi.refreshCells({force: true});
    }

    #projectTypeRenderer(p) {
        const openWebpages = (domains) => {
            setTimeout(() => {
                const anchor = p.eGridCell.querySelector("a");
                if (anchor && !anchor.dataset.clickListenerAdded) {
                    anchor.dataset.clickListenerAdded = "true";
                    anchor.addEventListener("click", (e) => {
                        e.preventDefault();
                        // Преобразуем все найденные сайты в корректные URL
                        const webpages = domains.map(w => `https://${w}`);
                        if (domains > 1) {
                            chrome.runtime.sendMessage({
                                action: "open-window-with-links",
                                urls: webpages,
                                windowParams: {
                                    left: Math.round((screen.availWidth - 1280) / 2),
                                    top: Math.round((screen.availHeight - 768) / 2),
                                    width: 1280,
                                    height: 768,
                                    focused: true,
                                    type: "normal"
                                }
                            });
                        } else {
                            window.open(webpages[0], '_blank');
                        }
                    });
                }
            }, 0);
        }

        if (!p.data && !p.node.footer && p.node.childrenAfterFilter.length) {
            // если сгруппировано по источникам, то источники одни для всех строк внутри, берём первую
            const firstRowStatic = p.node.childrenAfterFilter[0].data.static;
            const sourcesCount = firstRowStatic.sources.length ?? (
                firstRowStatic.sources.hosts_content.length +
                firstRowStatic.sources.calls_content.length +
                firstRowStatic.sources.sms_content.length
            );
            const sourcesCounter = `<span class="sources_count">${sourcesCount}</span>`;
            let aggregatedHosts = [];

            const hasSites = p.value.includes('Сайты');
            let sourceType = p.value;

            if (hasSites) {
                p.node.childrenAfterFilter.forEach(child => {
                    const data = child.data;

                    if (data.static.sources.hosts_content && data.static.sources.hosts_content.length) {
                        aggregatedHosts = aggregatedHosts.concat(data.static.sources.hosts_content);
                    } else if (data.static.sources && Array.isArray(data.static.sources)) {
                        aggregatedHosts = aggregatedHosts.concat(data.static.sources);
                    }
                });

                sourceType = `<a href="#">${p.value}</a>`;
                openWebpages(aggregatedHosts);
            }

            return `${sourceType} ${sourcesCounter}`;
        }

        if (!p.data || !p.value) return p.value;

        const sourcesCount = p.data.static.sources.length ?? (
            p.data.static.sources.hosts_content.length +
            p.data.static.sources.calls_content.length +
            p.data.static.sources.sms_content.length
        );

        const sourcesCounter = `<span class="sources_count">${sourcesCount}</span>`;
        let sourceType = p.value;
        const hasSites = (p.data.static.sources.hosts_content && p.data.static.sources.hosts_content.length) || p.value.includes('Сайты');

        if (hasSites) {
            sourceType = `<a href="#">${p.value}</a>`;
            openWebpages(p.data.static.sources.hosts_content ?? p.data.static.sources);
        }

        return `${sourceType} ${sourcesCounter}`;
    }

    #getCellClassByStatus(data) {
        if (!data || data.static.status !== 1 || data.static.delete_date) return '';

        return data.static.state === 0 ? 'project-limited-completely' : data.static.state > 0 ? 'project-limited' : '';
    }

    #sendSelectedToClipboard = params => {
        const text = params.data.split("\r\n").join(", ");
        navigator.clipboard.writeText(text);
    };

    #createNumberColumn(header, field, filterParams, headerTooltip, cellRenderer = null, cellClass = null, hide = false) {
        const colDef = {
            headerName: header,
            field,
            minWidth: 120,
            maxWidth: 120,
            resizable: false,
            filter: 'agNumberColumnFilter',
            filterParams,
            headerTooltip,
            hide,
            aggFunc: 'sum',
        };

        if (cellRenderer) colDef.cellRenderer = cellRenderer;
        if (cellClass) colDef.cellClass = cellClass;
        return colDef;
    }

    #fitColumns() {
        this.gridApi.sizeColumnsToFit();
    }

    #filter(node) {
        const filterModel = this.gridApi.getFilterModel();
        const filterType = filterModel["static.limit"];
        const canGiveMoreFilter = filterType?.type === "canGiveMoreThanLimit" || filterType?.conditions?.some(c => c.type === "canGiveMoreThanLimit");

        if (canGiveMoreFilter) {
            if (!node.data.static.limitState && (!node.data.static.limitPotential || node.data.static.limitPotential < node.data.static.limit))
                return false;
        }

        const {data} = node;

        // Пропускаем удалённые элементы, если они не должны отображаться
        if (!this.deletedShown && data.static.delete_date !== null) return false;

        // Приводим значение поиска к нужному виду
        const trimmedSearch = this.searchValue && this.searchValue.trim();
        if (!trimmedSearch) return true;
        this.searchValue = trimmedSearch;

        // Разбиваем поисковую строку на токены, разделённые запятой (с пробелами или без)
        const tokens = this.searchValue.split(/\s*,\s*/).filter(Boolean);

        // Обновляем кэш поиска, если значение изменилось
        if (this._searchCache.req !== this.searchValue) {
            this._searchCache.req = this.searchValue;
            this._searchCache.tokens = tokens.map(token => {
                const lowerCase = token.toLowerCase();
                const isNumberSearch = [...lowerCase].filter(c => c >= '0' && c <= '9').length >= 2;
                const normalizedNumber = normalizePhoneNumber(lowerCase);
                return {token, lowerCase, isNumberSearch, normalizedNumber};
            });
        }

        for (const {lowerCase, isNumberSearch, normalizedNumber} of this._searchCache.tokens) {
            if (data.static.id.includes(lowerCase)) return true;

            if (isNumberSearch && findStringsWithPhone([data.static.tag, data.static.name], normalizedNumber).length > 0) {
                return true;
            }

            if ((data.static.tag && data.static.tag.toLowerCase().includes(lowerCase)) ||
                (data.static.name && data.static.name.toLowerCase().includes(lowerCase))) {
                return true;
            }

            switch (data.static.project_type) {
                case "Звонки":
                    if (isNumberSearch) {
                        for (const number of data.static.sources) {
                            if (normalizePhoneNumber(number).includes(normalizedNumber)) {
                                return true;
                            }
                        }
                    }
                    break;
                case "Сайты (П)":
                case "Сайты":
                    for (const domain of data.static.sources) {
                        if (domain.toLowerCase().includes(lowerCase)) {
                            return true;
                        }
                    }
                    break;
            }
        }

        return false;
    }

    //#region Events

    #emit(eventName, detail = {}) {
        this.#eventTarget.dispatchEvent(new CustomEvent(eventName, {detail}));
    }

    on(eventName, callback) {
        this.#eventTarget.addEventListener(eventName, callback);
    }

    off(eventName, callback) {
        this.#eventTarget.removeEventListener(eventName, callback);
    }

    //#endregion

    //#region Rows/Cells
    addRows(rows) {
        rows.forEach(row => this._rows.set(row.static.id, row));
        this.gridApi?.applyTransaction({add: rows});
    }

    forEachNode(callback) {
        this.gridApi.forEachNode(callback);
    }

    refreshCells() {
        this.gridApi.refreshCells({force: true});
    }

    getSelectedRows() {
        const cellRanges = this.gridApi.getCellRanges();
        if (!cellRanges || cellRanges.length === 0) return [];
        const selected = [];

        for (const cellRange of cellRanges) {
            const {startRow, endRow} = cellRange;
            range(startRow.rowIndex, endRow.rowIndex).forEach(i => {
                const row = this.gridApi.getDisplayedRowAtIndex(i);
                selected.push(row);
            });
        }
        return selected;
    }

    //#endregion Rows/Cell API

    //#region Public
    refresh({ sort = false, filter = false, aggregation = false, cells = false, cellForce = false } = {}) {
        if (sort) this.gridApi.refreshClientSideRowModel('sort');
        if (aggregation) this.gridApi.refreshClientSideRowModel('aggregate');

        if (filter) this.gridApi.onFilterChanged();

        if (cells) {
            this.gridApi.refreshCells({ force: cellForce });
        }
    }

    applyAnalyticToPeriod(staticData, analytic, periodIndex) {
        const newRows = [];
        const updatedRows = [];
        const rowsMap = this.rows;

        for (const [pId, periodData] of analytic) {
            const existingRow = rowsMap.get(pId);
            if (existingRow) {
                if (existingRow.periods[periodIndex] !== periodData) {
                    existingRow.periods[periodIndex] = periodData;
                    updatedRows.push(existingRow);
                }
            } else {
                const periodsData = [];
                periodsData[periodIndex] = periodData;
                newRows.push({
                    periods: periodsData,
                    static: staticData.get(pId),
                });
            }
        }

        if (newRows.length) {
            this.addRows(newRows);
        }

        if (updatedRows.length) {
            this.gridApi.applyTransaction({ update: updatedRows });

            this.refresh({
                sort: true,
                filter: true,
                aggregation: true,
                cells: newRows.length > 0 || updatedRows.length > 0,
                cellForce: false
            });
        }
    }
    updatePeriodTooltip(period) {
        const colDefs = this.gridApi.getColumnDefs();
        for (const columnDef of colDefs) {
            if (columnDef.context?.periodId === period.index) {
                columnDef.headerTooltip = this.#getPeriodColumnTooltip(columnDef.field, period.name);
            }
        }

        this.gridApi.setGridOption('columnDefs', colDefs);
        this.gridApi.refreshHeader();
    }


    toggleSourcesGrouping() {
        this.sourcesGrouping = !this.sourcesGrouping;

        this.gridApi.setRowGroupColumns(this.sourcesGrouping ? ['static.sources'] : []);

        if (!this.sourcesGrouping) {
            this.gridApi.applyColumnState({
                state: [
                    {colId: 'static.sources', hide: true}
                ],
                applyOrder: false,
            });
        }

        this.#fitColumns();

        return this.sourcesGrouping;
    }

    togglePercentSort() {
        this.isPercentSorting = !this.isPercentSorting;
        this.refresh({
            sort: true,
            filter: true,
        });
        return this.isPercentSorting;
    }

    search(searchValue) {
        this.searchValue = searchValue;
        this.gridApi.onFilterChanged();
    }

    copyItemsOfSelected(itemExtractor, formatFunc = items => items.toString()) {
        const selectedRows = this.getSelectedRows();

        const items = selectedRows.flatMap(row => {
            return row.group
                ? row.allLeafChildren.flatMap(child => itemExtractor(child))
                : itemExtractor(row);
        });

        navigator.clipboard.writeText(formatFunc(items));
    }

    copySourcesOfSelected() {
        this.copyItemsOfSelected(
            row => row.data.static.sources,
            items => Array.from(new Set(items)).join('\n')
        );
    }

    copyWebpagesOfSelected() {
        this.copyItemsOfSelected(
            row => row.data.static.smartName.domains,
            items => Array.from(new Set(items)).join('\n')
        );
    }

    resetColumns() {
        this.sourcesGrouping = false;
        this.gridApi.resetColumnState();

        this.onReset?.();
    }

    #usedPeriodColumns = ['processed', 'leads', 'missed', 'declined'];
    setPeriodColumns(usedCrmColumns) {
        const statusOrder = [
            'processed', 'leads', 'missed', 'declined', 'crm_base', 'crm_missed', 'crm_conversation', 'crm_payexpect', 'crm_partner', 'crm_payed', 'crm_closed', 'crm_test', 'crm_hot', 'crm_forreplace', 'crm_finalymissed'
        ];
        usedCrmColumns.sort((a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b));
        if (usedCrmColumns[0] !== 'processed') usedCrmColumns.unshift('processed');

        this.#usedPeriodColumns = usedCrmColumns;

        this.gridOptions.columnDefs = this.#buildColDefs();
        this.gridApi.setGridOption('columnDefs', this.gridOptions.columnDefs);
    }

    updatePeriods(periods) {
        this.periods = periods;
        const periodsColumns = this.#buildPeriodsColumns();

        const startIndex = this.gridOptions.columnDefs.findIndex(colDef => colDef.field === this.#usedPeriodColumns[0]);

        this.gridOptions.columnDefs.splice(startIndex, this.#usedPeriodColumns.length);
        this.gridOptions.columnDefs.splice(startIndex, 0, ...periodsColumns);

        this.gridApi.setGridOption('columnDefs', this.gridOptions.columnDefs);
    }

    //#endregion
}