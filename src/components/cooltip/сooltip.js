class Cooltip {
    constructor() {
        this.attachedElements = new Set();
        this.observer = null;
        this.sharedTooltip = this.createSharedTooltip();
        this.currentElement = null;
        this.setupMutationObserver();
        this.attachToExistingElements();
        window.addEventListener('resize', () => this.hideTooltip());
        window.addEventListener('scroll', () => this.hideTooltip());
    }

    createSharedTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-element';
        document.body.appendChild(tooltip);
        return tooltip;
    }

    setupMutationObserver() {
        this.observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if (node.classList?.contains('cooltip')) {
                        this.attachTooltip(node);
                    }
                });
            });
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    attachToExistingElements() {
        document.querySelectorAll('.cooltip').forEach(element => {
            this.attachTooltip(element);
        });
    }

    attachTooltip(element) {
        if (this.attachedElements.has(element)) return;
        this.attachedElements.add(element);
        element.addEventListener('mouseenter', () => this.showTooltip(element));
        element.addEventListener('mouseleave', () => this.hideTooltip());
        element.addEventListener('focus', () => this.showTooltip(element));
        // element.addEventListener('blur', () => this.hideTooltip());
    }

    calculatePosition(element) {
        const rect = element.getBoundingClientRect();
        // Для корректного измерения тултипа уже отображаем его (но скрывая от пользователя)
        const tooltipRect = this.sharedTooltip.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const padding = 10;
        let position = null;

        // Если указан атрибут data-tooltip-side – используем его значение
        const sideAttr = element.dataset.tooltipSide;
        if (sideAttr) {
            switch (sideAttr.toLowerCase()) {
                case 'top':
                    position = this.calculateTopPosition(rect, tooltipRect, padding);
                    break;
                case 'bottom':
                    position = this.calculateBottomPosition(rect, tooltipRect, padding);
                    break;
                case 'left':
                    position = this.calculateLeftPosition(rect, tooltipRect, padding);
                    break;
                case 'right':
                    position = this.calculateRightPosition(rect, tooltipRect, padding);
                    break;
                default:
                    position = null;
            }
        }
        // Если атрибут не указан или значение некорректно – выбираем сторону автоматически
        if (!position) {
            if (rect.top > tooltipRect.height + padding) {
                position = this.calculateTopPosition(rect, tooltipRect, padding);
            } else if (rect.bottom + tooltipRect.height + padding < viewportHeight) {
                position = this.calculateBottomPosition(rect, tooltipRect, padding);
            } else if (rect.left > tooltipRect.width + padding) {
                position = this.calculateLeftPosition(rect, tooltipRect, padding);
            } else {
                position = this.calculateRightPosition(rect, tooltipRect, padding);
            }
        }
        return position;
    }

    calculateTopPosition(rect, tooltipRect, padding) {
        return {
            x: rect.left + rect.width / 2 - tooltipRect.width / 2,
            y: rect.top - tooltipRect.height - padding,
            origin: 'top'
        };
    }

    calculateBottomPosition(rect, tooltipRect, padding) {
        return {
            x: rect.left + rect.width / 2 - tooltipRect.width / 2,
            y: rect.bottom + padding,
            origin: 'bottom'
        };
    }

    calculateLeftPosition(rect, tooltipRect, padding) {
        return {
            x: rect.left - tooltipRect.width - padding,
            y: rect.top + rect.height / 2 - tooltipRect.height / 2,
            origin: 'left'
        };
    }

    calculateRightPosition(rect, tooltipRect, padding) {
        return {
            x: rect.right + padding,
            y: rect.top + rect.height / 2 - tooltipRect.height / 2,
            origin: 'right'
        };
    }

    showTooltip(element) {
        if (this.currentElement === element) return;
        this.currentElement = element;
        this.sharedTooltip.textContent = element.dataset.tooltip;
        // Показываем тултип для измерения размеров, но скрываем от пользователя
        this.sharedTooltip.style.visibility = 'hidden';
        this.sharedTooltip.style.display = 'block';

        // Пересчитываем позицию с учётом текущих размеров тултипа
        const position = this.calculatePosition(element);

        // Возвращаем видимость по умолчанию
        this.sharedTooltip.style.visibility = '';

        // Ограничиваем положение, чтобы тултип не выходил за пределы окна
        const tooltipWidth = this.sharedTooltip.offsetWidth;
        const tooltipHeight = this.sharedTooltip.offsetHeight;
        const finalX = Math.max(10, Math.min(position.x, window.innerWidth - tooltipWidth - 10));
        const finalY = Math.max(10, Math.min(position.y, window.innerHeight - tooltipHeight - 10));
        this.sharedTooltip.style.left = `${finalX}px`;
        this.sharedTooltip.style.top = `${finalY}px`;

        // Вычисляем смещение стрелки относительно центра тултипа
        const elementRect = element.getBoundingClientRect();
        let arrowOffset;
        if (position.origin === 'top' || position.origin === 'bottom') {
            const elementCenterX = elementRect.left + elementRect.width / 2;
            const tooltipCenterX = finalX + tooltipWidth / 2;
            arrowOffset = elementCenterX - tooltipCenterX;
        } else {
            const elementCenterY = elementRect.top + elementRect.height / 2;
            const tooltipCenterY = finalY + tooltipHeight / 2;
            arrowOffset = elementCenterY - tooltipCenterY;
        }
        this.sharedTooltip.style.setProperty('--arrow-position', `${arrowOffset}px`);

        this.sharedTooltip.className = `tooltip-element ${position.origin} shown`;
    }

    hideTooltip() {
        this.sharedTooltip.classList.remove('shown');
        this.currentElement = null;
    }
}

document.addEventListener('DOMContentLoaded', () => new Cooltip());
