class Cooltip {
    #tooltip;
    #arrow;
    #boundHideTooltip;
    #currentElement = null;

    static GAP = 8;
    static ARROW_SIZE = 7;
    static VIEWPORT_MARGIN = 10;
    static DEFAULT_POSITIONS = ['top', 'bottom', 'right', 'left'];

    constructor() {
        this.#createTooltipElement();
        this.#attachToExistingElements();
        this.#observeMutations();
        this.#boundHideTooltip = this.hideTooltip.bind(this);

        window.addEventListener('resize', this.#boundHideTooltip);
        window.addEventListener('scroll', this.#boundHideTooltip, true);
    }

    #createTooltipElement() {
        this.#tooltip = document.createElement('div');
        this.#tooltip.className = 'cooltip-tooltip';
        this.#tooltip.setAttribute('role', 'tooltip');
        this.#tooltip.style.position = 'absolute';
        this.#tooltip.style.zIndex = '1000';
        this.#tooltip.style.visibility = 'hidden';
        this.#tooltip.style.opacity = '0';
        this.#tooltip.style.transition = 'opacity 0.2s, visibility 0.2s';

        this.#arrow = document.createElement('div');
        this.#arrow.className = 'cooltip-tooltip__arrow';

        this.#arrow.style.position = 'absolute';
        this.#arrow.style.width = '0';
        this.#arrow.style.height = '0';

        this.#tooltip.appendChild(this.#arrow);
        document.body.appendChild(this.#tooltip);
    }

    #attachToExistingElements() {
        document.querySelectorAll('[data-tooltip]').forEach(el => this.#attachListeners(el));
    }

    #attachListeners(element) {
        if (element.__cooltipAttached) return;
        element.__cooltipAttached = true;

        const show = () => this.showTooltip(element);
        const hide = () => this.hideTooltip();

        element.addEventListener('mouseenter', show);
        element.addEventListener('mouseleave', hide);
        element.addEventListener('focus', show);
        element.addEventListener('blur', hide);
        element.addEventListener('DOMNodeRemoved', (event) => {
            if (event.target === element && this.#currentElement === element) {
                this.hideTooltip();
            }
        });
    }

    #observeMutations() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute('data-tooltip')) {
                            this.#attachListeners(node);
                        }
                        node.querySelectorAll('[data-tooltip]').forEach(el => this.#attachListeners(el));
                    }
                });
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node === this.#currentElement) {
                        this.hideTooltip();
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    #measureTooltip(htmlContent) {
        const clone = this.#tooltip.cloneNode(true);
        clone.style.visibility = 'hidden';
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.opacity = '0';
        clone.style.transition = 'none';

        const arrowClone = clone.querySelector('.cooltip-tooltip__arrow');

        let contentContainer = null;
        for(let child of clone.childNodes) {
            if(child !== arrowClone) {
                contentContainer = child;
                break;
            }
        }
        if (!contentContainer) {
            contentContainer = document.createElement('div');
            clone.insertBefore(contentContainer, arrowClone);
        }
        contentContainer.innerHTML = htmlContent;

        clone.classList.add('cooltip-tooltip');

        document.body.appendChild(clone);
        const dimensions = {
            width: clone.offsetWidth,
            height: clone.offsetHeight
        };
        document.body.removeChild(clone);
        return dimensions;
    }

    showTooltip(element) {
        const content = element.dataset.tooltip;
        const positionPref = (element.dataset.tooltipPosition || '').split(' ').filter(Boolean);
        const customClass = element.dataset.tooltipClass || '';

        if (!content) return;

        this.#currentElement = element;

        this.#tooltip.innerHTML = '';
        const contentDiv = document.createElement('div'); // Контейнер для контента
        contentDiv.innerHTML = content;
        this.#tooltip.appendChild(contentDiv);

        this.#arrow = document.createElement('div');
        this.#arrow.className = 'cooltip-tooltip__arrow';
        this.#arrow.style.position = 'absolute';
        this.#arrow.style.width = '0';
        this.#arrow.style.height = '0';
        this.#tooltip.appendChild(this.#arrow);


        this.#tooltip.className = 'cooltip-tooltip';
        if (customClass) {
            this.#tooltip.classList.add(...customClass.split(' ').filter(Boolean));
        }

        const tooltipDim = this.#measureTooltip(content);

        const targetRect = element.getBoundingClientRect();
        const positions = positionPref.length > 0 ? positionPref : Cooltip.DEFAULT_POSITIONS;

        let bestPosition = null;

        for (const pos of positions) {
            const { top, left } = this.#calculatePosition(targetRect, tooltipDim, pos);
            if (this.#isInViewport(top, left, tooltipDim)) {
                bestPosition = { top, left, pos };
                break;
            }
        }

        if (!bestPosition) {
            const firstPos = positions[0];
            let { top, left } = this.#calculatePosition(targetRect, tooltipDim, firstPos);

            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            left = Math.max(scrollX + Cooltip.VIEWPORT_MARGIN, Math.min(left, scrollX + window.innerWidth - tooltipDim.width - Cooltip.VIEWPORT_MARGIN));
            top = Math.max(scrollY + Cooltip.VIEWPORT_MARGIN, Math.min(top, scrollY + window.innerHeight - tooltipDim.height - Cooltip.VIEWPORT_MARGIN));

            bestPosition = { top, left, pos: firstPos };
        }

        this.#tooltip.style.left = `${bestPosition.left}px`;
        this.#tooltip.style.top = `${bestPosition.top}px`;
        this.#tooltip.dataset.actualPosition = bestPosition.pos;

        this.#positionArrow(targetRect, bestPosition.pos);

        this.#tooltip.style.visibility = 'visible';
        this.#tooltip.style.opacity = '1';
    }

    #calculatePosition(targetRect, tooltipDim, position) {
        let top, left;
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        switch (position) {
            case 'top':
                top = targetRect.top + scrollY - tooltipDim.height - Cooltip.GAP;
                left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipDim.width / 2);
                break;
            case 'bottom':
                top = targetRect.bottom + scrollY + Cooltip.GAP;
                left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipDim.width / 2);
                break;
            case 'left':
                top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipDim.height / 2);
                left = targetRect.left + scrollX - tooltipDim.width - Cooltip.GAP;
                break;
            case 'right':
                top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipDim.height / 2);
                left = targetRect.right + scrollX + Cooltip.GAP;
                break;
            default:
                top = targetRect.top + scrollY - tooltipDim.height - Cooltip.GAP;
                left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipDim.width / 2);
                break;
        }
        return { top, left };
    }

    #isInViewport(top, left, tooltipDim) {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        return (
            top >= scrollY + Cooltip.VIEWPORT_MARGIN &&
            left >= scrollX + Cooltip.VIEWPORT_MARGIN &&
            (top + tooltipDim.height) <= scrollY + window.innerHeight - Cooltip.VIEWPORT_MARGIN &&
            (left + tooltipDim.width) <= scrollX + window.innerWidth - Cooltip.VIEWPORT_MARGIN
        );
    }

    #positionArrow(targetRect, position) {
        this.#arrow.style.left = '';
        this.#arrow.style.top = '';
        this.#arrow.style.right = '';
        this.#arrow.style.bottom = '';


        const targetCenterX = targetRect.left + window.scrollX + targetRect.width / 2;
        const targetCenterY = targetRect.top + window.scrollY + targetRect.height / 2;

        const tooltipPageX = parseFloat(this.#tooltip.style.left);
        const tooltipPageY = parseFloat(this.#tooltip.style.top);

        const arrowOffsetX = targetCenterX - tooltipPageX;
        const arrowOffsetY = targetCenterY - tooltipPageY;

        switch (position) {
            case 'top':
                this.#arrow.style.left = `${arrowOffsetX - Cooltip.ARROW_SIZE}px`;
                this.#arrow.style.bottom = `-${Cooltip.ARROW_SIZE}px`;
                break;
            case 'bottom':
                this.#arrow.style.left = `${arrowOffsetX - Cooltip.ARROW_SIZE}px`;
                this.#arrow.style.top = `-${Cooltip.ARROW_SIZE}px`;
                break;
            case 'left':
                this.#arrow.style.top = `${arrowOffsetY - Cooltip.ARROW_SIZE}px`;
                this.#arrow.style.right = `-${Cooltip.ARROW_SIZE}px`;
                break;
            case 'right':
                this.#arrow.style.top = `${arrowOffsetY - Cooltip.ARROW_SIZE}px`;
                this.#arrow.style.left = `-${Cooltip.ARROW_SIZE}px`;
                break;
        }
    }

    hideTooltip() {
        if (this.#tooltip.style.visibility === 'visible') {
            this.#tooltip.style.opacity = '0';
            this.#tooltip.style.visibility = 'hidden';
            this.#currentElement = null;

            const baseClass = 'cooltip-tooltip';
            this.#tooltip.className = baseClass;
        }
    }
}

globalThis.cooltip = new Cooltip();