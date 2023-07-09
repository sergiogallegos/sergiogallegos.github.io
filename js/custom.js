document.addEventListener("DOMContentLoaded", function() {
    var hour = new Date().getHours();
    var themeStylesheet = document.getElementById("theme-style");

    if (hour >= 6 && hour < 18) {
        themeStylesheet.href = "light-theme.css"; // Load the light theme stylesheet
    } else {
        themeStylesheet.href = "dark-theme.css"; // Load the dark theme stylesheet
    }
});
