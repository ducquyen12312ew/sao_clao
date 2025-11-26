document.addEventListener('DOMContentLoaded', () => {
  const covers = document.querySelectorAll('.cover');
  let currentAudio = null;

  covers.forEach((cover) => {
    cover.addEventListener('click', () => {
      const trackId = cover.dataset.trackId;
      const audio = document.getElementById(`audio-${trackId}`);

      // restart animation
      cover.classList.remove('spin');
      void cover.offsetWidth; // force reflow
      cover.classList.add('spin');

      const handlePlay = () => {
        if (currentAudio && currentAudio !== audio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }

        // toggle same track
        if (currentAudio === audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        } else {
          currentAudio = audio;
          audio.play().catch(() => {});
        }
        cover.removeEventListener('animationend', handlePlay);
      };

      cover.addEventListener('animationend', handlePlay);
    });
  });
});
