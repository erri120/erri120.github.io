(() => {
    const key = "darkmode";
    const forcedark = "forcedark";
    const forcelight = "forcelight";

    let darkMode = localStorage.getItem(key);
    if (!darkMode) {
        darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches.toString();
    }

    function set(darkMode) {
        document.documentElement.classList.toggle(forcedark, darkMode);
        document.documentElement.classList.toggle(forcelight, !darkMode);
        localStorage.setItem(key, darkMode);
    }

    set(darkMode === "true");
})();
