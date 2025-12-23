document.addEventListener('DOMContentLoaded', () => {
  const timerEl = document.querySelector('.timer-count');
  if (!timerEl) return; 

  let countdown = parseInt(timerEl.textContent, 10) || 5;

  const interval = setInterval(() => {
    countdown--;
    timerEl.textContent = countdown;

    if (countdown <= 0) {
      clearInterval(interval);
      window.location.href = '/home';
    }
  }, 1000);
});
