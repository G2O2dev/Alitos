import {
    calcPercent,
    findStringsWithPhone,
    formatPercentage,
    normalizePhoneNumber,
    range,
} from "./helpers.js";
import {AG_GRID_LOCALE_RU} from "../../lib/ag-grid-ru.js";
import crmApi from "../client/crm-api.js";

export class GridManager {
    _deletedShown = false;
    _rows = new Map();
    _searchCache = {};
    #colDefs;

    gridApi = null;
    gridElement = null;
    searchValue = '';
    isPercentSorting = false;
    sourcesGrouping = false;

    constructor(config) {
        const {selector, periods} = config;
        this.gridElement = document.querySelector(selector);

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
        values.forEach(row => this._rows.set(row.id, row));
    }

    #buildGridOptions(periods) {
        const theme = agGrid.themeQuartz.withParams({
            fontFamily: 'SFPro, Tahoma',
            headerFontFamily: 'SFPro, Tahoma',
            cellFontFamily: 'SFPro, Tahoma',
            accentColor: 'var(--color-accent)',
            backgroundColor: 'var(--color-bg)',
            browserColorScheme: 'dark',
            chromeBackgroundColor: {ref: 'foregroundColor', mix: 0.07, onto: 'backgroundColor'},
            columnHoverColor: 'var(--color-gray-200)',
            foregroundColor: 'var(--color-text-primary)',
            headerBackgroundColor: 'var(--color-gray-100)',
            borderColor: 'var(--color-gray-300)',
            headerFontSize: 14,
            headerRowBorder: true,
            rowHoverColor: 'var(--color-gray-100)',
            spacing: 6,
            headerVerticalPaddingScale: 0.8,
            wrapperBorder: true,
            wrapperBorderRadius: 10,
            rowBorder: {style: 'solid', width: 1, color: 'var(--color-gray-300)'},
            columnBorder: {style: 'solid', width: 1, color: 'var(--color-gray-300)'},
        });

        const autoNameRenderer = (params) => {
            if (params.data)
                return `${params.data.name}<span class="autoname_tag">${params.data.tag ? ` (${params.data.tag})` : ''}</span><span class="autoname_operator">${params.data.operator}</span>`;
        };

        let basicColumns = [
            {
                headerName: 'Id',
                field: 'id',
                minWidth: 90,
                maxWidth: 90,
                resizable: false,
                filter: false,
                tooltipValueGetter: params => this.#getTooltip(params),
                suppressColumnsToolPanel: true,
                suppressMovable: true,
            },
            {
                headerName: 'Оператор',
                field: 'operator',
                minWidth: 44,
                maxWidth: 44,
                resizable: false,
                filterParams: {suppressMiniFilter: true},
                headerTooltip: 'Оператор.\nB1 - Ростелеком\nB2 - Билайн\nB3 - МТС\nB4 - Мегафон',
                hide: true,
                suppressColumnsToolPanel: true,
            },
            {
                headerName: 'Автоназвание',
                field: 'autoName',
                minWidth: 120,
                filter: false,
                aggFunc: "same",
                headerTooltip: 'Автоназвание компилирует название и тег в формате: Название (Тег)',
                cellRenderer: autoNameRenderer,
            },
            {
                headerName: 'Название',
                field: 'name',
                minWidth: 120,
                filter: false,
                aggFunc: "name",
                hide: true,
                suppressColumnsToolPanel: true,
            },
            {
                headerName: 'Тег',
                field: 'tag',
                minWidth: 70,
                filter: false,
                resizable: true,
                aggFunc: "same",
                hide: true,
                suppressColumnsToolPanel: true,
            },
            {
                headerName: 'Статус',
                field: 'state',
                minWidth: 120,
                maxWidth: 120,
                resizable: false,
                filterParams: {suppressMiniFilter: true},
                aggFunc: "activeInactive",
                cellClass: info => this.#getCellClassByStatus(info.data),
                headerTooltip: 'Текущий статус проекта. Если ячейка:\nЖёлтая — при последней отправке лимит проекта был снижен системой из-за нехватки баланса.\nКрасная — проект не был отправлен из-за нехватки баланса.',
            },
            {
                headerName: 'Тип',
                field: 'project_type',
                minWidth: 120,
                maxWidth: 120,
                resizable: false,
                cellRenderer: params => this.#projectTypeRenderer(params),
                headerTooltip: 'Тип проекта и количество источников',
                filterParams: {suppressMiniFilter: true},
                aggFunc: "same",
            },
        ];

        const periodsColumns = this.#buildPeriodColumns(0);

        const limitCellClass = params => {
            switch (params.data?.limitState) {
                case "warning":
                    return "project-limit-warning";
                case "hint":
                    return "project-limit-hint";
            }
        }

        const limitCellRenderer = (params) => {
            let potential;
            if (params.data) {
                potential = params.data.limitPotential;
            }

            return `${params.value}${potential === undefined ? '' : ` <span class="limitPotential">${potential}</span>`}`;
        }

        const regionCellClass = (params) => {
            if (!params.data?.region_limit) return;

            return params.data.regions_reverse ? "project-region-reverse" : "project-region";
        }

        // Скрытые колонки
        const hiddenColumns = [
            // this.#createNumberColumn('Номеров сегодня', 'today_numbers', { defaultOption: 'greaterThan' }, 'Номеров получено сегодня', null, null, true),
            {
                headerName: 'Дни получения',
                field: 'workdays',
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
                field: 'region_limit',
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
                field: 'creation_date',
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
                field: 'edit_date',
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
                field: 'delete_date',
                minWidth: 110,
                maxWidth: 110,
                resizable: false,
                filter: 'agDateColumnFilter',
                headerTooltip: 'Когда проект был удалён',
                hide: true,
                valueFormatter: p => dateFormatter(p),
                aggFunc: "sameDate",
            },
            this.#createNumberColumn('Дублей всего', 'duplicate_count', {defaultOption: 'greaterThan'}, null, null, null, true),
            this.#createNumberColumn('Дублей сегодня', 'today_duplicate_count', {defaultOption: 'greaterThan'}, null, null, null, true),

            {
                headerName: 'Источник',
                field: 'sources',

                hide: true,
                suppressColumnsToolPanel: true,
            },
        ];

        const dateFormatter = (params) => {
            if (!params.value || typeof params.value.getMonth !== 'function') return "";
            return params.value.toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
            });
        }
        const weekdaysFormatter = (params) => {
            if (!params.value) return "";

            const daysMapping = {
                '1': 'Пн',
                '2': 'Вт',
                '3': 'Ср',
                '4': 'Чт',
                '5': 'Пт',
                '6': 'Сб',
                '7': 'Вс'
            };

            const daysArr = Array.from(new Set(params.value.split('')))
                .map(Number)
                .sort((a, b) => a - b);

            let ranges = [];
            let start = daysArr[0];
            let end = daysArr[0];

            for (let i = 1; i < daysArr.length; i++) {
                if (daysArr[i] === end + 1) {
                    end = daysArr[i];
                } else {
                    ranges.push([start, end]);
                    start = daysArr[i];
                    end = daysArr[i];
                }
            }
            ranges.push([start, end]);

            return ranges.map(range => {
                if (range[0] === range[1]) {
                    return daysMapping[range[0].toString()] + '.';
                } else {
                    return daysMapping[range[0].toString()] + '-' + daysMapping[range[1].toString()];
                }
            }).join(' ');
        }

        const afterPeriodsColumns = [
            this.#createNumberColumn('Лимит', 'limit', {
                defaultOption: 'greaterThan',
                filterOptions: ['equals', 'notEqual', 'greaterThan', 'lessThan', 'inRange'],
            }, 'Лимит проекта. Если ячейка:\nГолубая — проект коснулся лимита 1 или 2 раза за последние 7 дней.\nЗелёная — проект коснулся лимита более 2 раз за последние 7 дней.', limitCellRenderer, limitCellClass),
        ];

        this.#colDefs = basicColumns.concat(periodsColumns, afterPeriodsColumns, hiddenColumns);

        return {
            theme,
            scrollbarWidth: 8,
            colResizeDefault: 'shift',
            tooltipShowDelay: 1000,
            localeText: AG_GRID_LOCALE_RU,
            grandTotalRow: "bottom",
            rowData: null,
            suppressAggFuncInHeader: true,

            isExternalFilterPresent: () => true,
            doesExternalFilterPass: node => this.#filter(node),
            getRowId: params => typeof params.data === 'string' ? params.data : params.data.id,
            cellSelection: {
                suppressMultiRanges: true,
                enableHeaderHighlight: true,
            },
            defaultColDef: {
                flex: 1,
                filter: true,
                filterParams: {closeOnApply: true, suppressSelectAll: true},
                suppressHeaderMenuButton: true,
            },
            aggFuncs: {
                activeInactive: params => {
                    let active = 0;
                    let inactive = 0;
                    let deleted = 0;

                    const countChildLeaf = (rowNode) => {
                        for (const child of rowNode.childrenAfterFilter) {
                            if (child.childrenAfterFilter) {
                                countChildLeaf(child);
                            } else {
                                switch (child.data.state) {
                                    case "Активен":
                                        active++;
                                        break;
                                    case "Неактивен":
                                        inactive++;
                                        break;
                                    case "Удалён":
                                        deleted++;
                                        break;
                                }
                            }
                        }
                    }

                    countChildLeaf(params.rowNode);

                    return `${active} / ${inactive}${deleted ? ` / ${deleted}` : ''}`;
                },
                same: params => {
                    let reference = params.values[0];
                    for (let i = 1; i < params.values.length; i++) {
                        const value = params.values[i];
                        if (value === '')
                            continue;

                        if (reference === '') {
                            reference = value;
                            continue;
                        }

                        if (params.values[i] !== reference) {
                            return null;
                        }
                    }

                    return reference;
                },
                sameDate: params => {
                    let refDate = null;
                    for (const value of params.values) {
                        if (!value) continue;

                        const date = new Date(value);
                        date.setHours(0, 0, 0, 0);

                        if (!refDate) {
                            refDate = date;
                        } else if (date.getTime() !== refDate.getTime()) {
                            return;
                        }
                    }

                    return refDate;
                },
                period: params => {
                    let sum = 0;
                    const periodId = params.colDef.context.periodId;
                    const field = params.colDef.field;

                    const countChildLeaf = (rowNode) => {
                        for (const child of rowNode.childrenAfterFilter) {
                            if (child.data) {
                                const periodData = child.data.periodsData[periodId];
                                if (periodData === undefined || periodData === null) continue;

                                const value = periodData[field];

                                sum += value.value === undefined ? value : value.value;
                            }

                            if (child.childrenAfterFilter) {
                                countChildLeaf(child);
                            }
                        }
                    }
                    countChildLeaf(params.rowNode);
                    return sum;
                },
                name: params => {
                    let reference = params.values[0];
                    if (reference && reference.length > 3) {
                        reference = reference.slice(3);
                    }

                    for (let i = 1; i < params.values.length; i++) {
                        let value = params.values[i];
                        if (value === '' || !value) {
                            continue;
                        }
                        if (value.length > 3) {
                            value = value.slice(3);
                        }

                        if (reference === '') {
                            reference = value;
                            continue;
                        }

                        if (value !== reference) {
                            return null;
                        }
                    }

                    return reference;
                }
            },
            columnDefs: this.#colDefs,
            autoGroupColumnDef: {
                minWidth: 160,
                maxWidth: 320,
                headerName: 'Источник',

                // cellRenderer: 'agGroupCellRenderer',
            },
            onGridSizeChanged: params => this.#fitColumns(),
            onFirstDataRendered: params => this.#fitColumns(),
            getContextMenuItems: ({defaultItems, column}) => {
                const newDefaultItems = defaultItems?.filter(i =>
                    !['cut', 'copyWithHeaders', 'copyWithGroupHeaders', 'paste'].includes(i)
                );
                const newItems = [];
                if (column.colDef.field === "id") {
                    const deleteItem = {
                        name: 'Удалить',
                        action: () => {
                            const toRemove = this.getSelectedRows().map(row => row.data.id);
                            crmApi.deleteProjects(toRemove);
                        },
                    };
                    const disableItem = {
                        name: 'Отключить',
                        action: () => {
                            const toRemove = this.getSelectedRows().map(row => row.data.id);
                            crmApi.disableProjects(toRemove);
                        },
                    };
                    const enableItem = {
                        name: 'Включить',
                        action: () => {
                            const toRemove = this.getSelectedRows().map(row => row.data.id);
                            crmApi.enableProjects(toRemove);
                        },
                    };
                    const copyContentItem = {
                        name: 'Копировать источники',
                        action: () => this.copySourcesOfSelected(),
                    };
                    newItems.push(enableItem);
                    newItems.push(disableItem);
                    newItems.push(deleteItem);
                    newItems.push(copyContentItem);
                }
                return [...newDefaultItems, ...newItems];
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
            onFilterChanged: () => this.#refreshAggregated(),
        };
    }

    #refreshAggregated() {
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
                if (selectedCells && selectedCells.startColumn.colId === "id") {
                    const toRemove = this.getSelectedRows().map(row => row.data.id);
                    this.gridApi.clearCellSelection();
                    this.gridApi.clearFocusedCell();
                    this.gridApi.applyTransaction({remove: toRemove});
                    this.gridApi.refreshCells({force: true});
                }
            }
            if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
                this.copySourcesOfSelected();
            }
        });
    }

    #projectTypeRenderer({value, data}) {
        return data?.sources
            ? `${value} <span class="sources_count">${data.sources.length}</span>`
            : value;
    }

    #getCellClassByStatus(data) {
        if (!data || data.send_status === null) return '';
        return data.send_status === 0 ? 'project-limited-completely' : data.send_status > 0 ? 'project-limited' : '';
    }

    #buildPeriodColumns(periodDataIndex, periodName = '', visibleColumns = ['processed', 'leads', 'missed', 'declined']) {
        const createPeriodColumn = (header, field, headerTooltip, cellRenderer, cellClass) => {
            const colDef = {
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
                comparator: (a, b, aNode, bNode, isDesc) => {
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
                                const aPeriodData = aNode.data.periodsData[periodId];
                                if (aPeriodData === undefined) continue;
                                const aData = aPeriodData[field];

                                const bPeriodData = aNode.data.periodsData[periodId];
                                if (bPeriodData === undefined) continue;
                                const bData = bPeriodData[field];

                                aPercent = aData.percent === undefined ? aData : aData.percent;
                                bPercent = bData.percent === undefined ? bData : bData.percent;
                            }

                            if (aPercent !== bPercent) {
                                return aPercent - bPercent;
                            }
                        }

                        return 0;
                    }

                    return a - b;
                },
                context: {
                    periodId: periodDataIndex
                },
                valueGetter: periodValueGetter,
                suppressColumnsToolPanel: true,
            };
            if (cellRenderer) colDef.cellRenderer = cellRenderer;
            if (cellClass) colDef.cellClass = cellClass;
            return colDef;
        };
        const periodValueGetter = (params) => {
            const periodId = params.colDef.context.periodId;
            const filed = params.colDef.field;

            const periodData = params.data.periodsData[periodId];
            if (periodData === undefined || periodData === null) return 0;

            const fieldData = periodData[filed];

            return fieldData.value !== undefined ? (this.isPercentSorting ? fieldData.percent : fieldData.value) : fieldData;
        }
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
                const periodData = params.data.periodsData[periodId];
                if (periodData === undefined) return 0;

                const fieldData = periodData[field];

                if (!showPercent) {
                    return fieldData.value !== undefined ? fieldData.value : fieldData;
                }
                value = fieldData.value;
                percent = fieldData.percent;
            }

            const percentStr = formatPercentage(percent);
            return `${value} <span class="percent">${percentStr}%</span>`;
        };

        const getColumnNameByField = (field) => {
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
                default:
                    return field;
            }
        };

        const columns = [];
        for (const columnField of visibleColumns) {
            const columnName = getColumnNameByField(columnField);
            const column = createPeriodColumn(
                `${columnName}${periodName ? ` ${periodName}` : ''}`,
                columnField,
                `Количество '${columnName}' за ${periodName} период`,
                params => cellRender(params, columnField !== 'processed'),
                columnField + "-cell",
            );
            columns.push(column);
        }
        return columns;
    }

    #sendSelectedToClipboard = params => {
        const text = params.data.split("\r\n").join(", ");
        navigator.clipboard.writeText(text);
    };

    #getTooltip(params) {
        if (params.node.rowPinned) return null;
        return params.api
            .getAllGridColumns()
            .filter(col => !col.visible)
            .map(col => {
                const {field, headerName} = col.getColDef();
                if (!params.data) return null;
                const value = params.data[field];
                return value !== null ? `${headerName}: ${value}` : null;
            })
            .filter(val => val !== null)
            .join('\n');
    }

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
        const {data} = node;

        // Пропускаем удалённые элементы, если они не должны отображаться
        if (!this.deletedShown && data.delete_date !== null) return false;

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
            if (data.id.includes(lowerCase)) return true;

            if (isNumberSearch && findStringsWithPhone([data.tag, data.name], normalizedNumber).length > 0) {
                return true;
            }

            if ((data.tag && data.tag.toLowerCase().includes(lowerCase)) ||
                (data.name && data.name.toLowerCase().includes(lowerCase))) {
                return true;
            }

            switch (data.project_type) {
                case "Звонки":
                    if (isNumberSearch) {
                        for (const number of data.sources) {
                            if (normalizePhoneNumber(number).includes(normalizedNumber)) {
                                return true;
                            }
                        }
                    }
                    break;
                case "Сайты (П)":
                case "Сайты":
                    for (const domain of data.sources) {
                        if (domain.toLowerCase().includes(lowerCase)) {
                            return true;
                        }
                    }
                    break;
            }
        }

        return false;
    }


    //#region Rows/Cells
    addRows(rows) {
        rows.forEach(row => this._rows.set(row.id, row));
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
        if (!cellRanges || !cellRanges[0]) return [];
        const {startRow, endRow} = cellRanges[0];
        const selected = [];
        range(startRow.rowIndex, endRow.rowIndex).forEach(i => {
            const row = this.gridApi.getDisplayedRowAtIndex(i);
            if (row?.data) selected.push(row);
        });
        return selected;
    }

    //#endregion Rows/Cell API

    //#region Public
    toggleSourcesGrouping() {
        this.sourcesGrouping = !this.sourcesGrouping;

        this.gridApi.setRowGroupColumns(this.sourcesGrouping ? ['sources'] : []);

        if (!this.sourcesGrouping) {
            this.gridApi.applyColumnState({
                state: [
                    {colId: 'sources', hide: true}
                ],
                applyOrder: false,
            });
        }

        this.#fitColumns();

        return this.sourcesGrouping;
    }

    togglePercentSort() {
        this.isPercentSorting = !this.isPercentSorting;
        this.gridApi.refreshClientSideRowModel('sort');
        return this.isPercentSorting;
    }

    search(searchValue) {
        this.searchValue = searchValue;
        this.gridApi.onFilterChanged();
    }

    copySourcesOfSelected() {
        const toCopy = this.getSelectedRows().map(row => row.data.sources);
        navigator.clipboard.writeText(toCopy.toString());
    }

    resetColumns() {
        this.sourcesGrouping = false;
        this.gridApi.resetColumnState();

        this.onReset?.();
    }

    togglePeriodGrouping() {
        this.gridApi.updateGridOptions({
            ...this.gridOptions,
            columnDefs: [
                ...this.gridOptions.columnDefs,
            ]
        });
    }

    //#endregion
}