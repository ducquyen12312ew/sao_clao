
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
