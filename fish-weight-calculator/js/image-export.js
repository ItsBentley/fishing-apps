async function savePageImage() {
  const button = $('save-image');
  const status = $('image-status');
  button.disabled = true;
  status.textContent = 'Creating image...';

  try {
    if (typeof window.html2canvas !== 'function') {
      throw new Error('The image capture library is unavailable.');
    }

    await document.fonts.ready;
    const canvas = await window.html2canvas($('page-capture'), {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      logging: false
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the image.');

    const file = new File([blob], 'fish-weight-calculator.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'Fish Weight Calculator' });
      status.textContent = 'Image shared. If you chose Save Image, it is now in your photos.';
    } else {
      const url = URL.createObjectURL(blob);
      const download = document.createElement('a');
      download.href = url;
      download.download = file.name;
      document.body.appendChild(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Image downloaded. Open it and choose Save Image to add it to your photos.';
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      status.textContent = 'Image sharing canceled.';
    } else {
      console.error('Unable to save the calculator image:', error);
      status.textContent = 'Could not create the image. Please try again.';
    }
  } finally {
    button.disabled = false;
  }
}
