function setupEvents() {
    document.querySelector(".analyze-btn").addEventListener("click", async (e) => {
        await chrome.runtime.sendMessage({action: "save-crm-url"});

        window.open("../crm/crm.html", '_blank').focus();
    });
}


setupEvents();