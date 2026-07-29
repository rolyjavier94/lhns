(() => {
    const themeSelect = document.getElementById("theme");
    if (!themeSelect) {
        return;
    }

    const storageKey = "lhns-theme";
    const validThemes = new Set(
        Array.from(themeSelect.options).map((option) => option.value)
    );

    const storedTheme = localStorage.getItem(storageKey);
    const initialTheme =
        storedTheme && validThemes.has(storedTheme)
            ? storedTheme
            : themeSelect.value;

    if (initialTheme && validThemes.has(initialTheme)) {
        document.body.dataset.theme = initialTheme;
        themeSelect.value = initialTheme;
    }

    themeSelect.addEventListener("change", (event) => {
        const nextTheme = event.target.value;
        if (!validThemes.has(nextTheme)) {
            return;
        }

        document.body.dataset.theme = nextTheme;
        localStorage.setItem(storageKey, nextTheme);
    });
})();
