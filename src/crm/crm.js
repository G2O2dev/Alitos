import {PageNavigator} from "./pages/PageNavigator.js";
import {ProjectPage} from "./pages/projects/ProjectPage.js";
import {SettingsPage} from "./pages/settings/SettingsPage.js";
import {TaskTracker} from "../lib/task-tracker.js";
import {Loader} from "../components/loader/loader.js";


globalThis.pageNav = new PageNavigator({
    'projects': ProjectPage,
    // 'calls': CallsPage,
    // 'manager-view': ManagerPage,
    'settings': SettingsPage,
}, 'projects');

document.addEventListener("DOMContentLoaded", async () => {
    globalThis.pageNav.init();
    initSidebar();
    initThemes();
});

let isSidebarMinified = true;

function initSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const activeBtn = sidebar.querySelector(`[data-page='${globalThis.pageNav.activePage}']`);
    activeBtn.classList.add("sidebar__item--active");

    const sidebarExpandBtn = sidebar.querySelector(".sidebar__expand-btn");

    function closeSidebar() {
        sidebar.classList.remove("sidebar--expanded");
        document.removeEventListener("click", closeSidebar);
    }

    sidebarExpandBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("sidebar--expanded");
        isSidebarMinified = !isSidebarMinified;

        if (sidebar.classList.contains("sidebar--expanded")) {
            setTimeout(() => {
                document.addEventListener("click", closeSidebar);
            }, 0);
        }
    });

    const navBtns = document.querySelectorAll(".sidebar__item");
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.remove("sidebar--expanded");
            document.removeEventListener("click", closeSidebar);

            const pageId = btn.getAttribute('data-page');
            if (globalThis.pageNav.navigate(pageId)) {
                navBtns.forEach(btn => btn.classList.remove('sidebar__item--active'));
                btn.classList.add('sidebar__item--active');
            }
        });
    });
}

function initThemes() {
    const themBtn = document.querySelector(".them-switch");

    themBtn.addEventListener('click', () => {
        document.documentElement.classList.add('them-switching');
        document.documentElement.classList.toggle('dark');

        chrome.runtime.sendMessage({
            action: "set-setting",
            settingName: "dark-theme",
            value: document.documentElement.classList.contains('dark')
        });

        setTimeout(() => document.documentElement.classList.remove('them-switching'), 100);
    });
}