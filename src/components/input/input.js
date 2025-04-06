export class Input {
    #inputElement;
    #config;
    #allowedRegex = null;
    #invalidClass = 'input-invalid';

    constructor(selectorOrElement, options = {}) {
        this.#inputElement =
            typeof selectorOrElement === 'string'
                ? document.querySelector(selectorOrElement)
                : selectorOrElement instanceof HTMLInputElement
                    ? selectorOrElement
                    : null;
        const defaults = {
            mode: 'text',
            allowedChars: '',
            allowNegative: true,
            allowPercent: false,
            min: null,
            max: null,
            placeholder: '',
            tooltip: ''
        };

        this.#inputElement.classList.add("custom-input");
        this.#config = { ...defaults, ...options };
        if (this.#config.placeholder) this.#inputElement.setAttribute('placeholder', this.#config.placeholder);
        if (this.#config.tooltip) {
            this.#inputElement.dataset.tooltipSide = 'top';
            this.#inputElement.setAttribute('data-tooltip', this.#config.tooltip);
            globalThis.cooltip.attachTooltip(this.#inputElement);
        }
        this.#setupValidationRegex();
        this.#attachEventListeners();
        this.validate();
    }

    #setupValidationRegex = () => {
        if (this.#config.mode === 'number') {
            let pattern = '^';
            if (this.#config.allowNegative) pattern += '-?';
            pattern += '\\d*';
            pattern += '(\\.\\d+)?';
            if (this.#config.allowPercent) pattern += '%?';
            pattern += '$';
            this.#allowedRegex = new RegExp(pattern);
        } else if (this.#config.mode === 'text' && this.#config.allowedChars) {
            const escaped = this.#config.allowedChars.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            this.#allowedRegex = new RegExp(`^[${escaped}]*$`);
        } else {
            this.#allowedRegex = null;
        }
    };

    #attachEventListeners = () => {
        this.#inputElement.addEventListener('keydown', this.#handleKeyDown);
        this.#inputElement.addEventListener('paste', this.#handlePaste);
        this.#inputElement.addEventListener('input', this.#handleInput);
    };

    #handleKeyDown = event => {
        const allowedControls = [
            'Backspace',
            'Tab',
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Delete',
            'Home',
            'End'
        ];
        if (allowedControls.includes(event.key) || event.ctrlKey || event.metaKey) return;
        const { value, selectionStart, selectionEnd } = this.#inputElement;
        const newValue = value.slice(0, selectionStart) + event.key + value.slice(selectionEnd);
        if (this.#allowedRegex && !this.#allowedRegex.test(newValue)) {
            event.preventDefault();
            this.#updateVisuals(false);
        }
    };

    #handlePaste = event => {
        const pasteData = (event.clipboardData || window.clipboardData).getData('text');
        const { value, selectionStart, selectionEnd } = this.#inputElement;
        const newValue = value.slice(0, selectionStart) + pasteData + value.slice(selectionEnd);
        if (this.#allowedRegex && !this.#allowedRegex.test(newValue)) {
            event.preventDefault();
            const filtered = Array.from(pasteData).filter(ch => this.#allowedRegex.test(ch)).join('');
            const finalValue = value.slice(0, selectionStart) + filtered + value.slice(selectionEnd);
            this.#inputElement.value = finalValue;
            this.#updateVisuals(false);
        }
    };

    #handleInput = () => {
        this.validate();
    };

    reconfigure(newOptions = {}) {
        this.#config = { ...this.#config, ...newOptions };
        if (newOptions.invalidClass) this.#invalidClass = newOptions.invalidClass;
        if (newOptions.placeholder !== undefined)
            this.#inputElement.setAttribute('placeholder', newOptions.placeholder);
        globalThis.cooltip.detachTooltip(this.#inputElement);
        if (newOptions.tooltip) {
            this.#inputElement.dataset.tooltipSide = 'top';
            this.#inputElement.setAttribute('data-tooltip', newOptions.tooltip);
            globalThis.cooltip.attachTooltip(this.#inputElement);
        }
        this.#setupValidationRegex();
        this.validate();
    }

    validate() {
        const value = this.#inputElement.value;
        if (value === '') {
            this.#updateVisuals(true);
            return true;
        }
        let isValid = true;
        if (this.#allowedRegex) {
            isValid = this.#allowedRegex.test(value);
            if (isValid && this.#config.mode === 'number') {
                const stripped = value.replace('%', '');
                if (stripped === '-' || stripped === '.' || stripped === '-.') isValid = false;
            }
        }
        if (isValid && this.#config.mode === 'number') {
            const val = this.#config.allowPercent ? value.replace('%', '') : value;
            const num = parseFloat(val);
            if (isNaN(num)) isValid = false;
            else {
                if (this.#config.min !== null && num < this.#config.min) isValid = false;
                if (isValid && this.#config.max !== null && num > this.#config.max) isValid = false;
            }
        }
        this.#updateVisuals(isValid);
        return isValid;
    }

    #updateVisuals(isValid) {
        Array.from(this.#inputElement.classList)
            .filter(c => c.startsWith('input-invalid'))
            .forEach(c => this.#inputElement.classList.remove(c));
        this.#inputElement.removeAttribute('aria-invalid');
        if (!isValid) {
            this.#inputElement.classList.add(this.#invalidClass);
            this.#inputElement.setAttribute('aria-invalid', 'true');
        }
    }

    getValue() {
        return this.#inputElement.value;
    }

    getNumericValue() {
        if (this.#config.mode !== 'number') return NaN;
        if (this.validate()) {
            const value = this.#inputElement.value;
            if (value === '') return NaN;
            const val = this.#config.allowPercent ? value.replace('%', '') : value;
            return parseFloat(val);
        }
        return NaN;
    }

    destroy() {
        this.#inputElement.removeEventListener('keydown', this.#handleKeyDown);
        this.#inputElement.removeEventListener('paste', this.#handlePaste);
        this.#inputElement.removeEventListener('input', this.#handleInput);
        this.#inputElement.classList.remove(this.#invalidClass);
        this.#inputElement.removeAttribute('aria-invalid');
    }
}