import {AlitosModal} from "../../../components/modal/AlitosModal.js";
import adviceSystem from "../../client/advices.js";

export class AdviceModal extends AlitosModal {
    constructor() {
        super({
            header: 'Рекомендации',
            contentClasses: ['advice-modal'],
            renderOnShow: true,
        });
    }

    #buildAdvicePriority(advice) {
        let priorityLocale;
        switch (advice.priority) {
            case 'low':
                priorityLocale = 'Низкий';
                break;
            case 'medium':
                priorityLocale = 'Средний';
                break;
            case 'high':
                priorityLocale = 'Высокий';
                break;
        }

        return `
            <p class="advice-card__priority">Приоритет: <span class="${advice.priority}">${priorityLocale}</span></p>
        `;
    }
    #buildAdviceActions(advice) {
        let actions = ``;

        for (const action of advice.actions) {
            actions += `
                <div class="advice-card__action ${action.class ? action.class : ''}">${action.name}</div>
            `;
        }


        return actions;
    }
    #buildAdviceCard(advice) {
        return `
            <div class="advice-card">
                <p class="advice-card__description">
                ${advice.description}
                </p>
                <div class="advice-card__bottom">
                    ${this.#buildAdvicePriority(advice)}
                    <div class="advice-card__actions">
                        ${this.#buildAdviceActions(advice)}
                    </div>
                </div>
            </div>
        `;
    }
    #setupEventsForCard(card) {
        card.querySelectorAll('.advices__inlined-projects').forEach((el) => {
            el.addEventListener('click', () => {
                this.close();
                globalThis.pageNav.getPage('projects').search(el.textContent);
            });
        })
    }

    onNewAdvice(advice) {
        const card = this.#buildAdviceCard(advice);

        const fragment = document.createRange().createContextualFragment(card);
        const cardEl = fragment.querySelector(".advice-card");

        this.#setupEventsForCard(cardEl);

        this.innerCcontentElement.appendChild(fragment);
    }

    hide() {
        super.hide();
    }

    async render() {
        let content = ``;
        const firstRender = super.render(content);

        for await (const advice of adviceSystem.loadAdvices()) {
            this.onNewAdvice(advice);
        }

        if (firstRender) {
            for (const card of this.innerCcontentElement.querySelectorAll('.advice-card')) {
                this.#setupEventsForCard(card);
            }
        }
    }
}