(function () {
  const trackCards = Array.from(document.querySelectorAll(".trackCard"));
  const player = document.querySelector(".player");
  const playerTitle = document.getElementById("playerTitle");
  const playerBtn = document.querySelector(".playerBtn");
  const tabs = Array.from(document.querySelectorAll(".tab"));

  let current = null;

  function setPlaying(card) {
    trackCards.forEach(c => c.classList.remove("is-playing"));
    if (!card) {
      current = null;
      player.classList.remove("is-playing");
      playerTitle.textContent = "-";
      return;
    }
    current = card;
    card.classList.add("is-playing");
    player.classList.add("is-playing");
    const title = card.querySelector(".trackTitle__main")?.textContent?.trim() || "-";
    playerTitle.textContent = title;
  }

  trackCards.forEach(card => {
    const btn = card.querySelector(".playBtn");
    btn?.addEventListener("click", () => {
      if (current === card) setPlaying(null);
      else setPlaying(card);
    });
  });

  playerBtn?.addEventListener("click", () => {
    if (!current && trackCards[0]) setPlaying(trackCards[0]);
    else setPlaying(null);
  });

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("tab--active"));
      tab.classList.add("tab--active");
    });
  });
})();
