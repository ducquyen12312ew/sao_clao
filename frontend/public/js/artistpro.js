(function () {
  // smooth anchor scroll like the PDF flow
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    const id = a.getAttribute("href");
    const el = document.querySelector(id);
    if (!el) return;

    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
