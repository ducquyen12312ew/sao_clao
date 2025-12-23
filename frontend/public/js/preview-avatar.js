    // preview avatar
    function previewAvatar(input) {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById('avatarPreview').innerHTML =
          `<img src="${e.target.result}" alt="Preview">`;
      };
      reader.readAsDataURL(input.files[0]);
    }