async function updateTheme() {
    document.documentElement.classList.add('them-switching');
    const isDarkTheme = await chrome.runtime.sendMessage({action: "get-setting", settingName: "dark-theme"});

    if (isDarkTheme) {
        document.documentElement.classList.add('dark');
    }

    setTimeout(() => document.documentElement.classList.remove('them-switching'), 100);
}

updateTheme();