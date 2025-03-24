import {AlitosModal} from "../../../components/modal/AlitosModal.js";
import adviceSystem, {advicePriority} from "../../client/advices.js";

export class AdviceModal extends AlitosModal {
    #firstRender = true;

    constructor() {
        super({
            header: 'Рекомендации',
            contentClasses: ['advice-modal'],
        });
    }

    #buildAdvicePriority(advice) {
        let priorityLocale;
        switch (advice.priority) {
            case advicePriority.Low:
                priorityLocale = 'Низкий';
                break;
            case advicePriority.Medium:
                priorityLocale = 'Средний';
                break;
            case advicePriority.High:
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
    onLoadComplete() {
        this.setLoading(false);
    }

    hide() {
        super.hide();

        // adviceSystem.offNewAdvice(this.onNewAdvice);
        // adviceSystem.offLoadComplete(this.onLoadComplete);
    }

    async render() {
        let content = ``;

        if (this.#firstRender) {
            this.#firstRender = false;
        }

        adviceSystem.onNewAdvice((e) => this.onNewAdvice(e.detail.advice));
        adviceSystem.onLoadComplete(() => this.onLoadComplete());

        const advices = adviceSystem.getAdvices();
        for (const advice of advices) {
            content += this.#buildAdviceCard(advice);
        }

        if (super.render(content)) {
            for (const card of this.innerCcontentElement.querySelectorAll('.advice-card')) {
                this.#setupEventsForCard(card);
            }
        }


        if (adviceSystem.isLoading())
            this.setLoading(true);
    }
}