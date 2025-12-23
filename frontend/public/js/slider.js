
document.addEventListener('DOMContentLoaded', () => {
  let currentSlide = 0;
  const slides = document.querySelectorAll('.hero-slide');
  const allDots = document.querySelectorAll('.dot');
  function showSlide(index) {
    slides.forEach(s => s.classList.remove('active'));
    allDots.forEach(d => d.classList.remove('active'));
    slides[index].classList.add('active');
    document.querySelectorAll(`.dot[data-slide="${index}"]`).forEach(d => d.classList.add('active'));
  }
  function nextSlide() { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); }
  setInterval(nextSlide, 7000);
  allDots.forEach(dot => { dot.addEventListener('click', () => { currentSlide = parseInt(dot.dataset.slide); showSlide(currentSlide); }); });
  const search = document.getElementById('searchInput');
  if (search) search.addEventListener('keypress', (e) => { if (e.key === 'Enter' && e.target.value) window.location.href = `/search?q=${encodeURIComponent(e.target.value)}`; });
});

 (() => {
      const canvas = document.getElementById('snow-layer');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let flakes = [];
      const baseCount = 140;
      const burstCount = 28;
      const dpr = Math.max(window.devicePixelRatio || 1, 1);

      const resize = () => {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
      };
      resize();
      window.addEventListener('resize', resize);

      const spawnFlake = (x, y, burst = false) => {
        const size = burst ? 1 + Math.random() * 3 : 1 + Math.random() * 2.5;
        flakes.push({
          x: x ?? Math.random() * window.innerWidth,
          y: y ?? Math.random() * window.innerHeight,
          r: size,
          vy: burst ? 1 + Math.random() * 2 : 0.5 + Math.random() * 1.5,
          vx: burst ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 0.6,
          life: burst ? 120 + Math.random() * 60 : null
        });
      };

      for (let i = 0; i < baseCount; i++) spawnFlake();

      window.addEventListener('click', (e) => {
        for (let i = 0; i < burstCount; i++) {
          spawnFlake(e.clientX, e.clientY, true);
        }
      });

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const width = window.innerWidth;
        const height = window.innerHeight;

        flakes = flakes.filter(f => {
          f.x += f.vx;
          f.y += f.vy;
          if (f.life !== null) f.life -= 1;

          if (f.y > height + 10) {
            f.y = -10;
            f.x = Math.random() * width;
          }
          if (f.x < -10) f.x = width + 10;
          if (f.x > width + 10) f.x = -10;

          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
          return f.life === null || f.life > 0;
        });

        while (flakes.length < baseCount) spawnFlake();
        requestAnimationFrame(render);
      };
      render();
    })();
