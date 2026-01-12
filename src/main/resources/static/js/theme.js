(function () {
    const KEY = "uu_theme";

    function getIsNight() {
        const saved = localStorage.getItem(KEY);
        return saved ? saved === "night" : false; // default día
    }

    function updateButton() {
        const btn = document.getElementById("themeToggle");
        if (!btn) return;

        const isNight = document.documentElement.classList.contains("dark");
        const day = btn.querySelector(".theme-day");
        const night = btn.querySelector(".theme-night");

        if (day) day.style.display = isNight ? "none" : "inline-flex";
        if (night) night.style.display = isNight ? "inline-flex" : "none";
    }

    function setTheme(isNight) {
        document.documentElement.classList.toggle("dark", isNight);
        localStorage.setItem(KEY, isNight ? "night" : "day");
        updateButton();
    }

    document.addEventListener("DOMContentLoaded", () => {
        setTheme(getIsNight());

        const btn = document.getElementById("themeToggle");
        if (!btn) return;

        btn.addEventListener("click", () => {
            const isNight = document.documentElement.classList.contains("dark");
            setTheme(!isNight);
        });

        new MutationObserver(updateButton).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"]
        });
    });
})();
