export class DropDown {
    element;
    config;
    optionsData;
    isOpen;
    selectedOption;
    currentPosition;
    triggerElement;
    triggerTextElement;
    menuElement;
    backdropElement;

    constructor(elementOrSelector, config = {}) {
        this.element = typeof elementOrSelector === 'string'
            ? document.querySelector(elementOrSelector)
            : elementOrSelector;
        this.config = {
            options: [],
            placeholder: 'Выберите...',
            position: 'auto',
            initialValue: null,
            onChange: () => {},
            ...config
        };
        this.optionsData = this.#normalizeOptions(this.config.options);
        this.isOpen = false;
        this.selectedOption = null;
        this.currentPosition = 'bottom';
        this.#validateConfig();
        this.#createDOM();
        this.#attachEventListeners();
        if (this.config.initialValue !== null) {
            this.setValue(this.config.initialValue, true);
        } else {
            this.#updateTriggerText(this.config.placeholder);
        }
        this.element._dropdownInstance = this;
    }

    updateOptions(newOptions) {
        this.config.options = newOptions;
        this.optionsData = this.#normalizeOptions(newOptions);
        const ul = document.createElement('ul');
        this.optionsData.forEach((option, index) => {
            const li = document.createElement('li');
            li.classList.add('dropdown-item');
            li.textContent = option.label;
            li.dataset.value = option.value;
            if (option.tooltip) {
                li.dataset.tooltipSide = 'right';
                li.setAttribute('data-tooltip', option.tooltip);
                globalThis.cooltip.attachTooltip(li);
            }
            li.setAttribute('role', 'option');
            li.id = `dropdown-${this.element.id || Math.random().toString(36).substring(2)}-option-${index}`;
            ul.appendChild(li);
        });
        this.menuElement.innerHTML = '';
        this.menuElement.appendChild(ul);
    }

    #normalizeOptions(options) {
        if (!Array.isArray(options)) {
            console.error("Dropdown: 'options' must be an array.");
            return [];
        }
        return options.map(option =>
            typeof option === 'object' && option !== null && 'value' in option && 'label' in option
                ? option
                : { value: String(option), label: String(option) }
        );
    }

    #validateConfig() {
        const validPositions = ['auto', 'bottom', 'top', 'center'];
        if (!validPositions.includes(this.config.position)) {
            console.warn(`Dropdown: Invalid position "${this.config.position}". Defaulting to "auto".`);
            this.config.position = 'auto';
        }
    }

    #createDOM() {
        this.element.innerHTML = '';
        this.element.classList.add('dropdown-container');
        this.triggerElement = document.createElement('div');
        this.triggerElement.classList.add('dropdown-trigger');
        this.triggerElement.setAttribute('role', 'button');
        this.triggerElement.setAttribute('aria-haspopup', 'listbox');
        this.triggerElement.setAttribute('aria-expanded', 'false');
        this.triggerElement.tabIndex = 0;
        this.triggerTextElement = document.createElement('span');
        this.triggerTextElement.classList.add('dropdown-trigger-text');
        this.triggerElement.appendChild(this.triggerTextElement);
        this.menuElement = document.createElement('div');
        this.menuElement.classList.add('dropdown-menu');
        this.menuElement.setAttribute('role', 'listbox');
        this.menuElement.style.display = 'none';
        const ul = document.createElement('ul');
        this.optionsData.forEach((option, index) => {
            const li = document.createElement('li');
            li.classList.add('dropdown-item');
            li.textContent = option.label;
            li.dataset.value = option.value;
            if (option.tooltip) {
                li.dataset.tooltipSide = 'right';
                li.setAttribute('data-tooltip', option.tooltip);
                globalThis.cooltip.attachTooltip(li);
            }
            li.setAttribute('role', 'option');
            li.id = `dropdown-${this.element.id || Math.random().toString(36).substring(2)}-option-${index}`;
            ul.appendChild(li);
        });
        this.menuElement.appendChild(ul);
        this.backdropElement = document.createElement('div');
        this.backdropElement.classList.add('dropdown-backdrop');
        this.backdropElement.style.display = 'none';
        this.element.appendChild(this.triggerElement);
        this.element.appendChild(this.menuElement);
        document.body.appendChild(this.backdropElement);
    }

    #attachEventListeners() {
        this.triggerElement.addEventListener('click', this.toggle.bind(this));
        this.triggerElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this.isOpen) {
                e.stopPropagation();
                this.close();
            }
        });
        this.menuElement.addEventListener('click', this.#handleItemClick.bind(this));
        document.addEventListener('click', this.#handleClickOutside.bind(this), true);
        this.backdropElement.addEventListener('click', this.close.bind(this));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                if (this.element.contains(document.activeElement) || this.menuElement.contains(document.activeElement) || document.activeElement === this.triggerElement) {
                    this.close();
                } else if(this.currentPosition === 'center') {
                    this.close();
                }
            }
        });
    }

    #handleItemClick(event) {
        const item = event.target.closest('.dropdown-item');
        if (item && !item.classList.contains('is-disabled')) {
            const value = item.dataset.value;
            this.setValue(value);
        }
    }

    #handleClickOutside(event) {
        const isClickInsideTrigger = this.triggerElement.contains(event.target);
        const isClickInsideMenu = this.menuElement.contains(event.target);
        if (isClickInsideTrigger) return;
        if (this.isOpen) {
            if (this.currentPosition === 'center') {
                if (!isClickInsideMenu && !this.backdropElement.contains(event.target)) {
                    this.close();
                }
            } else {
                if (!isClickInsideMenu) {
                    this.close();
                }
            }
        }
    }

    #updateTriggerText(text) {
        this.triggerTextElement.textContent = text;
    }

    #updateSelectionDisplay(selectedValue) {
        const items = this.menuElement.querySelectorAll('.dropdown-item');
        let selectedItem = null;
        items.forEach(item => {
            if (item.dataset.value === selectedValue) {
                item.classList.add('is-selected');
                item.setAttribute('aria-selected', 'true');
                selectedItem = item;
            } else {
                item.classList.remove('is-selected');
                item.setAttribute('aria-selected', 'false');
            }
        });
        if (selectedItem) {
            this.triggerElement.setAttribute('aria-activedescendant', selectedItem.id);
        } else {
            this.triggerElement.removeAttribute('aria-activedescendant');
        }
    }

    #positionMenu() {
        const triggerRect = this.triggerElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        this.menuElement.style.visibility = 'hidden';
        this.menuElement.style.display = 'block';
        const menuHeight = this.menuElement.offsetHeight;
        if (!this.isOpen) {
            this.menuElement.style.display = 'none';
        }
        this.menuElement.style.visibility = '';
        let position = this.config.position;
        this.element.classList.remove('position-top', 'position-center');
        this.menuElement.style.position = 'absolute';
        this.menuElement.style.transform = '';
        this.menuElement.style.top = '';
        this.menuElement.style.left = '';
        this.menuElement.style.bottom = '';
        this.menuElement.style.width = '';
        if (position === 'center') {
            this.currentPosition = 'center';
            this.element.classList.add('position-center');
            this.menuElement.style.position = 'fixed';
            this.menuElement.style.left = '50%';
            this.menuElement.style.top = '50%';
            this.backdropElement.style.display = 'block';
            requestAnimationFrame(() => {
                this.backdropElement.classList.add('is-visible');
            });
        } else {
            if (this.backdropElement.classList.contains('is-visible')) {
                this.backdropElement.classList.remove('is-visible');
                const backdropTransitionDuration = parseFloat(getComputedStyle(this.backdropElement).transitionDuration) * 1000;
                setTimeout(() => {
                    if(!this.backdropElement.classList.contains('is-visible')){
                        this.backdropElement.style.display = 'none';
                    }
                }, backdropTransitionDuration || 250);
            } else {
                this.backdropElement.style.display = 'none';
            }
            const spaceBelow = viewportHeight - triggerRect.bottom;
            const spaceAbove = triggerRect.top;
            const safetyMargin = 10;
            if (position === 'auto') {
                if (spaceBelow >= menuHeight + safetyMargin || spaceBelow >= spaceAbove) {
                    position = 'bottom';
                } else if (spaceAbove >= menuHeight + safetyMargin) {
                    position = 'top';
                } else {
                    position = 'bottom';
                }
            }
            if (position === 'bottom' && spaceBelow < menuHeight + safetyMargin && spaceAbove >= menuHeight + safetyMargin) {
                position = 'top';
            } else if (position === 'top' && spaceAbove < menuHeight + safetyMargin && spaceBelow >= menuHeight + safetyMargin) {
                position = 'bottom';
            }
            this.currentPosition = position;
            this.menuElement.style.width = `${triggerRect.width}px`;
            if (position === 'top') {
                this.element.classList.add('position-top');
            }
        }
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.#positionMenu();
        this.menuElement.style.display = 'block';
        requestAnimationFrame(() => {
            this.element.classList.add('is-open');
            this.triggerElement.setAttribute('aria-expanded', 'true');
            this.menuElement.style.visibility = 'visible';
            const selectedItem = this.menuElement.querySelector('.dropdown-item.is-selected');
            if (selectedItem) {
                requestAnimationFrame(() => {
                    selectedItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                });
            }
        });
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.element.classList.remove('is-open');
        this.triggerElement.setAttribute('aria-expanded', 'false');
        if (this.currentPosition === 'center') {
            this.backdropElement.classList.remove('is-visible');
        }
        const transitionDuration = parseFloat(getComputedStyle(this.menuElement).transitionDuration) * 1000;
        setTimeout(() => {
            if (!this.isOpen) {
                this.menuElement.style.display = 'none';
                this.element.classList.remove('position-top', 'position-center');
                if (this.currentPosition === 'center' && !this.backdropElement.classList.contains('is-visible')) {
                    this.backdropElement.style.display = 'none';
                }
            }
        }, transitionDuration || 250);
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    setValue(value, silent = false) {
        const valueStr = String(value);
        const option = this.optionsData.find(opt => opt.value === valueStr);
        if (option) {
            const previousValue = this.selectedOption ? this.selectedOption.value : null;
            this.selectedOption = option;
            this.#updateTriggerText(option.label);
            this.#updateSelectionDisplay(option.value);
            if (!silent && option.value !== previousValue && typeof this.config.onChange === 'function') {
                try {
                    this.config.onChange(option.value, option.label);
                } catch (error) {
                    console.error("Error in dropdown onChange callback:", error);
                }
            }
            if (this.isOpen) {
                this.close();
            }
        } else {
            console.warn(`Dropdown: Value "${value}" not found in options.`);
        }
    }

    getValue() {
        return this.selectedOption ? this.selectedOption.value : null;
    }

    getLabel() {
        return this.selectedOption ? this.selectedOption.label : null;
    }

    destroy() {
        document.removeEventListener('click', this.#handleClickOutside, true);
        if (this.backdropElement && this.backdropElement.parentNode) {
            this.backdropElement.parentNode.removeChild(this.backdropElement);
        }
        if (this.element) {
            this.element.innerHTML = '';
            this.element.classList.remove('dropdown-container', 'is-open', 'position-top', 'position-center');
            if (this.element._dropdownInstance === this) {
                delete this.element._dropdownInstance;
            }
        }
        this.element = null;
        this.triggerElement = null;
        this.menuElement = null;
        this.optionsData = [];
        this.config = {};
        this.selectedOption = null;
        this.backdropElement = null;
        this.isOpen = false;
    }
}
