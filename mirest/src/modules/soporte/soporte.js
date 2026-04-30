const y = document.getElementById("currentYear");
if (y) y.textContent = String(new Date().getFullYear());
if (typeof lucide !== "undefined") lucide.createIcons();
