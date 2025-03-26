export class DeepCache {
    constructor({
                    defaultTTL = Infinity,
                    storageAdapter = null,
                    serialize = JSON.stringify,
                    deserialize = JSON.parse,
                } = {}) {
        this.memoryCache = new Map();
        this.defaultTTL = defaultTTL;
        this.storageAdapter = storageAdapter;
        this.serialize = serialize;
        this.deserialize = deserialize;
    }

    //#region Main
    async get(key, fetchFn, options = {}) {
        const { ttl = this.defaultTTL, useStorage = true } = options;

        const memoryHit = this._getFromMemory(key);
        if (memoryHit !== undefined) return memoryHit;

        if (useStorage && this.storageAdapter) {
            const storageHit = await this._getFromStorage(key);
            if (storageHit !== undefined) {
                this._setToMemory(key, storageHit, ttl);
                return storageHit;
            }
        }

        const data = await fetchFn();
        await this.set(key, data, options);
        return data;
    }

    async set(key, value, options = {}) {
        const { ttl = this.defaultTTL, useStorage = true } = options;
        this._setToMemory(key, value, ttl);

        if (useStorage && this.storageAdapter) {
            await this._setToStorage(key, value, ttl);
        }
    }

    async delete(key) {
        this.memoryCache.delete(key);
        if (this.storageAdapter) {
            await this.storageAdapter.removeItem(key);
        }
    }

    async clear() {
        this.memoryCache.clear();
        if (this.storageAdapter) {
            await this.storageAdapter.clear();
        }
    }

    async update(key, updater, options = {}) {
        const current = await this.get(key, () => Promise.resolve(undefined), options);
        const updated = updater(current);
        await this.set(key, updated, options);
        return updated;
    }
    async atomicUpdate(key, updater, options = {}) {
        const current = await this.get(key, () => Promise.resolve(undefined), options);
        let updated;

        try {
            updated = updater(this._deepClone(current));
        } catch (error) {
            throw new Error(`Update failed: ${error}`);
        }

        await this.set(key, updated, options);
        return updated;
    }
    //#endregion

    _getFromMemory(key) {
        const entry = this.memoryCache.get(key);
        if (!entry) return undefined;
        if (entry.expiry < Date.now()) {
            this.memoryCache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    async _getFromStorage(key) {
        try {
            const stored = await this.storageAdapter.getItem(key);
            if (!stored) return undefined;

            const { value, expiry } = this.deserialize(stored);
            if (expiry < Date.now()) {
                await this.storageAdapter.removeItem(key);
                return undefined;
            }
            return value;
        } catch (error) {
            console.warn('Storage read failed', error);
            return undefined;
        }
    }

    _setToMemory(key, value, ttl) {
        this.memoryCache.set(key, {
            value,
            expiry: ttl === Infinity ? Infinity : Date.now() + ttl,
        });
    }
    async _setToStorage(key, value, ttl) {
        try {
            await this.storageAdapter.setItem(
                key,
                this.serialize({
                    value,
                    expiry: ttl === Infinity ? Infinity : Date.now() + ttl,
                })
            );
        } catch (error) {
            console.warn('Storage write failed', error);
        }
    }


    _setByPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        let current = obj;

        for (const part of parts) {
            current[part] = current[part] || {};
            current = current[part];
        }

        if (last) {
            current[last] = value;
        }
    }
}

export const localStorageAdapter = {
    async getItem(key) {
        return localStorage.getItem(key);
    },
    async setItem(key, value) {
        localStorage.setItem(key, value);
    },
    async removeItem(key) {
        localStorage.removeItem(key);
    },
    async clear() {
        localStorage.clear();
    }
};