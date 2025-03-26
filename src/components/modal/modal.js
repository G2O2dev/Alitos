export class ModalWindow {
    #isOpen = false;
    #nonModalElements = [];
    #originalBodyOverflow = '';

    modalContainer;
    #modalBackground;
    #modalContent;

    onClosed = null;

    options = {
        backgroundOpenClass: 'modal-bg-open',
        backgroundCloseClass: 'modal-bg-close',

        contentOpenClass: 'modal-content-open',
        contentCloseClass: 'modal-content-close',

        modalActiveClass: 'modal-active',
        contentClasses: '',
    };

    _lastRenderedHTML = null;
    _lastRenderedElement = null;

    constructor(options = {}) {
        this.options = { ...this.options, ...options };
        this.#createModalElements();

        if (this.options.contentClasses) {
            if (typeof this.options.contentClasses === 'string') {
                this.#modalContent.classList.add(this.options.contentClasses);
            } else if (Array.isArray(this.options.contentClasses)) {
                this.options.contentClasses.forEach(cls => {
                    if (cls) this.#modalContent.classList.add(cls);
                });
            }
        }

        this.#setupFocusTrap();
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._applyCustomStyles();
    }

    #createModalElements() {
        this.modalContainer = document.createElement('div');
        this.modalContainer.classList.add('modal-container');
        this.modalContainer.style.display = 'none';
        this.modalContainer.setAttribute('tabindex', '-1');

        this.#modalBackground = document.createElement('div');
        this.#modalBackground.classList.add('modal-background');

        this.#modalBackground.addEventListener('click', (e) => {
            if (e.target === this.#modalBackground) {
                this.close();
            }
        });

        this.#modalContent = document.createElement('div');
        this.#modalContent.classList.add('modal-content');
        this.#modalContent.setAttribute('tabindex', '0');

        this.modalContainer.append(this.#modalBackground, this.#modalContent);
        document.body.appendChild(this.modalContainer);
    }

    #setupFocusTrap() {
        this._focusinHandler = (e) => {
            if (!this.modalContainer.contains(e.target)) {
                const focusable = this.#modalContent.querySelectorAll(
                    'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length > 0) {
                    focusable[0].focus();
                } else {
                    this.#modalContent.focus();
                }
            }
        };
    }

    #makeDocumentInert() {
        this.#nonModalElements = [];
        Array.from(document.body.children).forEach(el => {
            if (el !== this.modalContainer) {
                el.setAttribute('aria-hidden', 'true');
                el.style.pointerEvents = 'none';
                this.#nonModalElements.push(el);
            }
        });

        this.#originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }

    #restoreDocument() {
        if (this.#nonModalElements) {
            this.#nonModalElements.forEach(el => {
                el.removeAttribute('aria-hidden');
                el.style.pointerEvents = '';
            });
            this.#nonModalElements = [];
        }
        document.body.style.overflow = this.#originalBodyOverflow || '';
    }

    open() {
        if (this.#isOpen) return;
        this.#isOpen = true;

        this.#makeDocumentInert();

        this.modalContainer.style.display = '';

        // Принудительный reflow для запуска анимаций
        void this.modalContainer.offsetWidth;

        // Устанавливаем анимационные классы для фона и содержимого
        this.#modalBackground.classList.remove(this.options.backgroundCloseClass);
        this.#modalContent.classList.remove(this.options.contentCloseClass);
        this.#modalBackground.classList.add(this.options.backgroundOpenClass);
        this.#modalContent.classList.add(this.options.contentOpenClass);
        this.modalContainer.classList.add(this.options.modalActiveClass);

        // Вешаем обработчики фокусировки и клавиатуры
        document.addEventListener('focusin', this._focusinHandler);
        document.addEventListener('keydown', this._handleKeyDown);

        // Передаём фокус первому доступному элементу или самому контейнеру
        setTimeout(() => {
            const focusable = this.#modalContent.querySelectorAll(
                'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length > 0) {
                focusable[0].focus();
            } else {
                this.#modalContent.focus();
            }
        }, 0);
    }

    close() {
        if (!this.#isOpen) return;
        this.#isOpen = false;

        this.#restoreDocument();

        document.removeEventListener('focusin', this._focusinHandler);
        document.removeEventListener('keydown', this._handleKeyDown);

        this.#modalBackground.classList.remove(this.options.backgroundOpenClass);
        this.#modalContent.classList.remove(this.options.contentOpenClass);
        this.#modalBackground.classList.add(this.options.backgroundCloseClass);
        this.#modalContent.classList.add(this.options.contentCloseClass);
        this.modalContainer.classList.remove(this.options.modalActiveClass);

        const onAnimationEnd = () => {
            this.modalContainer.style.display = 'none';
            this.#modalBackground.classList.remove(this.options.backgroundCloseClass);
            this.#modalContent.classList.remove(this.options.contentCloseClass);

            this.#modalBackground.removeEventListener('animationend', onAnimationEnd);

            if (typeof this.onClosed === 'function') {
                this.onClosed();
            }
        };

        this.#modalBackground.addEventListener('animationend', onAnimationEnd);

        setTimeout(() => {
            if (!this.#isOpen && this.modalContainer.style.display !== 'none') {
                onAnimationEnd();
            }
        }, 500);
    }

    setContent(content) {
        if (typeof content === 'string') {
            this.#modalContent.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.#modalContent.innerHTML = '';
            this.#modalContent.appendChild(content);
        }
    }

    appendContent(content) {
        if (typeof content === 'string') {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = content;
            this.#modalContent.appendChild(wrapper);
        } else if (content instanceof HTMLElement) {
            this.#modalContent.appendChild(content);
        }
    }

    render(content) {
        if (typeof content === 'string') {
            if (this._lastRenderedHTML === content) return false;
            this._lastRenderedHTML = content;
            this._lastRenderedElement = null;
            this.setContent(content);
        } else if (content instanceof HTMLElement) {
            if (this._lastRenderedElement === content) return false;
            this._lastRenderedElement = content;
            this._lastRenderedHTML = null;
            this.setContent(content);
        } else {
            throw new Error('Unsupported content type in render()');
        }

        return true;
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (typeof this.onEscape === 'function') {
                this.onEscape(e);
            } else {
                this.close();
            }
        }
    }

    _applyCustomStyles() { }

    get contentElement() {
        return this.#modalContent;
    }
}
