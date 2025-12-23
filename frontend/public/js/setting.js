
function previewAvatar(input) {
  if (!input.files || !input.files[0]) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const preview = document.getElementById('avatarPreview');
    if (!preview) return;

    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
  };

  reader.readAsDataURL(input.files[0]);
}

window.previewAvatar = previewAvatar;
