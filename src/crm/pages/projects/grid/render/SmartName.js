import { replaceDomainsWithLinks } from '../../../../utils/helpers.js';

export class SmartNameRenderer {
    #smartnameCache = new WeakMap();

    static createCellHtml(name, tag, operator = '') {
        return `<span class="smartname_cell ${operator ? 'smartname_cell--operator' : ''}">
            <span class="smartname_name">${name}</span>
            ${tag ? `<span class="smartname_tag"> (${tag})</span>` : ''}
            ${operator ? `<span class="smartname_operator">${operator}</span>` : ''}
        </span>`;
    }

    static genCellWithDomainsOfChild(childNodes) {
        const domains = [...new Set(
            childNodes.flatMap(c => c.data.static.smartName.domains || [])
        )];
        const displayed = domains.slice(0, 5).join(', ');
        return SmartNameRenderer.createCellHtml(
            replaceDomainsWithLinks(displayed, true)
        );
    }

    renderSmartnameForCell(params, renderOptions = {}) {
        const { node } = params;
        if (node.footer) return;
        const opts = { renderOperator: true, ...renderOptions };

        const cached = this.#smartnameCache.get(node);
        if (cached) return cached;

        const data = node.data;
        if (data) {
            return SmartNameRenderer.createCellHtml(
                data.static.smartName.name,
                data.static.smartName.tag,
                opts.renderOperator ? data.static.operator : ''
            );
        }

        const leaves = node.childrenAfterFilter;
        const first = leaves[0].data.static.smartName;
        const uniform = leaves.every(({ data: { static: { smartName: sn } } }) =>
            sn.name === first.name && sn.tag === first.tag
        );

        let result;
        if (uniform) {
            result = this.renderSmartnameForCell(
                { node: node.allLeafChildren[0] },
                { ...opts, renderOperator: false }
            );
        } else {
            result = SmartNameRenderer.genCellWithDomainsOfChild(node.allLeafChildren);
        }

        this.#smartnameCache.set(node, result);
        return result;
    }
}
