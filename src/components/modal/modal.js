export class ModalWindow {
    _isOpen = false;
    _nonModalElements = [];
    _originalBodyOverflow = '';
    _originalActiveElement = null;

    modalContainer = null;
    modalBackground = null;
    modalContent = null;

    onClosed = null;
    onEscape = null;

    options = {
        backgroundOpenClass: 'modal-bg-open',
        backgroundCloseClass: 'modal-bg-close',
        contentOpenClass: 'modal-content-open',
        contentCloseClass: 'modal-content-close',
        modalActiveClass: 'modal-active',
        contentClasses: [],
        containerClasses: [],
        renderOnShow: false, // окно уничтожается после закрытия и рендерится заново при открытии
        closeOnBackgroundClick: true,
        transitionDuration: 300 // Примерная длительность анимации для transitionend
    };

    _lastRenderedHTML = null;
    _lastRenderedElement = null;

    constructor(options = {}) {
        const mergedOptions = { ...this.options, ...options };
        mergedOptions.contentClasses = this._normalizeClasses(mergedOptions.contentClasses);
        mergedOptions.containerClasses = this._normalizeClasses(mergedOptions.containerClasses);
        this.options = mergedOptions;

        if (!this.options.renderOnShow) {
            this._createModalElements();
        }

        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleFocusIn = this._handleFocusIn.bind(this);
        this._handleBackgroundClick = this._handleBackgroundClick.bind(this);
    }

    _normalizeClasses(classes) {
        if (typeof classes === 'string') {
            return classes.split(' ').filter(cls => cls);
        }
        if (Array.isArray(classes)) {
            return classes.filter(cls => cls);
        }
        return [];
    }


    _applyClasses() {
        if (!this.modalContainer) return;
        this.modalContainer.classList.add(...this.options.containerClasses);
        this.modalContent.classList.add(...this.options.contentClasses);
    }

    _createModalElements() {
        this.modalContainer = document.createElement('div');
        this.modalContainer.classList.add('modal-container');
        this.modalContainer.style.visibility = 'hidden';
        this.modalContainer.setAttribute('role', 'dialog');
        this.modalContainer.setAttribute('aria-modal', 'true');
        this.modalContainer.setAttribute('tabindex', '-1');

        this.modalBackground = document.createElement('div');
        this.modalBackground.classList.add('modal-background');

        this.modalContent = document.createElement('div');
        this.modalContent.classList.add('modal-content');
        this.modalContent.setAttribute('tabindex', '0');

        this._applyClasses();

        this.modalContainer.append(this.modalBackground, this.modalContent);
        document.body.appendChild(this.modalContainer);

        if (this.options.closeOnBackgroundClick) {
            this.modalBackground.addEventListener('click', this._handleBackgroundClick);
        }
    }

    _getFocusableElements() {
        if (!this.modalContent) return [];
        return Array.from(
            this.modalContent.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        );
    }

    _handleFocusIn(e) {
        if (this._isOpen && this.modalContent && !this.modalContent.contains(e.target)) {
            this._setInitialFocus();
        }
    }

    _handleBackgroundClick(e) {
        if (e.target === this.modalBackground) {
            this.close();
        }
    }

    _makeDocumentInert() {
        this._nonModalElements = [];
        this._originalActiveElement = document.activeElement;

        Array.from(document.body.children).forEach(el => {
            if (el !== this.modalContainer && el.tagName !== 'SCRIPT' && el.tagName !== 'LINK') {
                el.setAttribute('aria-hidden', 'true');
                el.style.pointerEvents = 'none';
                this._nonModalElements.push(el);
            }
        });

        this._originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }

    _restoreDocument() {
        this._nonModalElements.forEach(el => {
            el.removeAttribute('aria-hidden');
            el.style.pointerEvents = '';
        });
        this._nonModalElements = [];
        document.body.style.overflow = this._originalBodyOverflow;

        if (this._originalActiveElement && typeof this._originalActiveElement.focus === 'function') {
            this._originalActiveElement.focus();
        }
        this._originalActiveElement = null;
    }

    _setInitialFocus() {
        requestAnimationFrame(() => {
            const focusableElements = this._getFocusableElements();
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            } else {
                this.modalContent?.focus();
            }
        });
    }

    open() {
        if (this._isOpen) return;

        if (!this.modalContainer) {
            this._createModalElements();
        }

        this._isOpen = true;
        this._makeDocumentInert();

        this.modalContainer.style.visibility = 'visible';

        // Принудительный перерасчет стилей для запуска перехода
        void this.modalContainer.offsetWidth;

        this.modalBackground.classList.remove(this.options.backgroundCloseClass);
        this.modalContent.classList.remove(this.options.contentCloseClass);
        this.modalBackground.classList.add(this.options.backgroundOpenClass);
        this.modalContent.classList.add(this.options.contentOpenClass);
        this.modalContainer.classList.add(this.options.modalActiveClass);

        document.addEventListener('keydown', this._handleKeyDown);
        document.addEventListener('focusin', this._handleFocusIn);

        this._setInitialFocus();
    }

    _waitForTransitionEnd() {
        return new Promise((resolve) => {
            if (!this.modalContainer) {
                resolve();
                return;
            }

            const transitionHandler = (event) => {
                if (
                    event.target === this.modalContainer ||
                    event.target === this.modalBackground ||
                    event.target === this.modalContent
                ) {
                    this.modalContainer.removeEventListener('transitionend', transitionHandler);
                    this.modalContainer.removeEventListener('animationend', transitionHandler);
                    resolve();
                }
            };

            this.modalContainer.addEventListener('transitionend', transitionHandler);
            this.modalContainer.addEventListener('animationend', transitionHandler);

            // Резерв на случай, если событие не сработало
            setTimeout(resolve, this.options.transitionDuration + 50);
        });
    }

    async close() {
        if (!this._isOpen || !this.modalContainer) return;
        this._isOpen = false;

        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('focusin', this._handleFocusIn);

        this.modalBackground.classList.remove(this.options.backgroundOpenClass);
        this.modalContent.classList.remove(this.options.contentOpenClass);
        this.modalBackground.classList.add(this.options.backgroundCloseClass);
        this.modalContent.classList.add(this.options.contentCloseClass);
        this.modalContainer.classList.remove(this.options.modalActiveClass);

        await this._waitForTransitionEnd();

        if (!this._isOpen && this.modalContainer) {
            this.modalContainer.style.visibility = 'hidden';
            this.modalBackground.classList.remove(this.options.backgroundCloseClass);
            this.modalContent.classList.remove(this.options.contentCloseClass);

            this._restoreDocument();

            if (typeof this.onClosed === 'function') {
                this.onClosed();
            }

            if (this.options.renderOnShow) {
                this._destroy();
            }
        }
    }

    _destroy() {
        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('focusin', this._handleFocusIn);

        if (this.modalBackground) {
            this.modalBackground.removeEventListener('click', this._handleBackgroundClick);
        }

        if (this.modalContainer && this.modalContainer.parentElement) {
            this.modalContainer.parentElement.removeChild(this.modalContainer);
        }

        this.modalContainer = null;
        this.modalBackground = null;
        this.modalContent = null;
        this._nonModalElements = [];
        this._originalActiveElement = null;
        this._isOpen = false;
        this._lastRenderedElement = null;
        this._lastRenderedHTML = null;
    }

    setContent(content) {
        if (!this.modalContent) {
            return;
        }

        this._lastRenderedElement = null;
        this._lastRenderedHTML = null;

        if (typeof content === 'string') {
            this.modalContent.innerHTML = content;
            this._lastRenderedHTML = content;
        } else if (content instanceof HTMLElement) {
            this.modalContent.innerHTML = '';
            this.modalContent.appendChild(content);
            this._lastRenderedElement = content;
        } else {
            console.error('Unsupported content type for setContent:', content);
        }
    }

    appendContent(content) {
        if (!this.modalContent) {
            console.warn("Modal content area does not exist for appending.");
            return;
        }

        if (typeof content === 'string') {
            this.modalContent.insertAdjacentHTML('beforeend', content);
        } else if (content instanceof HTMLElement) {
            this.modalContent.appendChild(content);
        } else {
            console.error('Unsupported content type for appendContent:', content);
        }
    }

    render(content) {
        if (!this.modalContent) {
            if (!this.options.renderOnShow) {
                console.warn("Modal content area does not exist for rendering.");
            }
            return false;
        }

        if (typeof content === 'string') {
            if (this._lastRenderedHTML === content) return false;
            this.setContent(content);
        } else if (content instanceof HTMLElement) {
            if (this._lastRenderedElement === content) return false;
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

        if (e.key === 'Tab' && this._isOpen && this.modalContent) {
            const focusableElements = this._getFocusableElements();
            if (focusableElements.length === 0) {
                e.preventDefault();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    }

    get contentElement() {
        return this.modalContent;
    }
    get containerElement() {
        return this.modalContainer;
    }
    get isOpen() {
        return this._isOpen;
    }
}