(() => {
    const button = document.getElementById("toggle-dark-mode-button");
    if (!button) return;

    const key = "darkmode";
    const forcedark = "forcedark";
    const forcelight = "forcelight";

    function set(darkMode) {
        document.documentElement.classList.toggle(forcedark, darkMode);
        document.documentElement.classList.toggle(forcelight, !darkMode);
        localStorage.setItem(key, darkMode);
    }

    button.onclick = () => {
        const darkMode = document.documentElement.classList.contains(forcedark);
        set(!darkMode);
    };
})();
