import {openDB} from '../lib/idb.js';

class Database {
    db = null;

    async open() {
        if (!this.db) {
            this.db = await openDB("alitos", 1, {
                upgrade(db, oldVersion) {
                    if (oldVersion < 1) {
                        const settingsStore = db.createObjectStore('settings', {keyPath: "name"});
                        settingsStore.createIndex("value", "value", {unique: false});
                        settingsStore.put({name: "dark-theme", value: true});
                    }
                },
            });
        }

        return this.db;
    }

    async getSettings() {
        try {
            const store = await (await this.open()).transaction('settings', 'readonly').store;
            return await store.getAll();
        } catch (error) {
            console.error('Failed to get settings: ', error);
        }
    }

    async getSetting(name) {
        try {
            const store = await (await this.open()).transaction('settings', 'readonly').store;
            return (await store.get(name)).value;
        } catch (error) {
            console.error('Failed to get setting: ' + name, error);
            return null;
        }
    }

    async setSetting(name, value) {
        try {
            const store = await (await this.open()).transaction('settings', 'readwrite').store;
            await store.put({name: name, value: value});
        } catch (error) {
            console.error('Failed to set setting:', error);
        }
    }
}

const db = new Database();


async function processRequest(request) {
    try {
        switch (request.action) {
            case "save-crm-url": {
                await chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    if (tabs.length === 0) return;

                    const url = new URL(tabs[0].url);
                    const activeDomain = `${url.protocol}//${url.hostname}`;
                    db.setSetting("crm-url", activeDomain);
                });
                break;
            }
            case "get-setting":
                return await db.getSetting(request.settingName);
            case "get-settings":
                return await db.getSettings();
            case "set-setting":
                await db.setSetting(request.settingName, request.value);
                return;
            case "fetch": {
                const activeDomain = await db.getSetting("crm-url");
                const req_url = activeDomain + request.url;

                request.params ??= {};
                Object.assign(request.params, {
                    method: 'GET',
                    credentials: 'include',
                    redirect: "manual",
                });

                let response;
                let tryWithNoCors = false;
                try {
                    response = await fetch(req_url, request.params);
                    tryWithNoCors = !response.ok;
                } catch (err) {
                    tryWithNoCors = true;
                    console.log("Fetch error 1", err);
                }

                if (tryWithNoCors) {
                    request.params.mode = "no-cors";
                    response = await fetch(req_url, request.params);
                }

                if (!response.ok) console.error("Fetch error", response);

                return await response.text();
            }
            case "open-window-with-links": {
                const urls = request.urls;
                const newWindow = await chrome.windows.create({
                    url: urls[0],
                    ...request.windowParams,
                });

                for (let i = 1; i < urls.length; i++) {
                    await chrome.tabs.create({
                        windowId: newWindow.id,
                        url: urls[i],
                        active: false
                    });
                }
                break;
            }
            default: {
                console.warn('Неизвестное действие:', request.action);
            }
        }
    } catch (e) {
        console.error('Error on request:', e, request);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    processRequest(request).then(sendResponse);

    return true;
});