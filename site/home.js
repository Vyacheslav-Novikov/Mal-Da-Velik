const brandFace = document.querySelector('.brand-face');

if (brandFace) {
  const pupils = brandFace.querySelectorAll('.brand-eye > span');
  const canTrack = matchMedia('(any-pointer: fine) and (prefers-reduced-motion: no-preference)');
  let frame;
  let pointerX;
  let pointerY;

  function followPointer() {
    frame = undefined;
    const { left, top, width, height } = brandFace.getBoundingClientRect();
    const x = pointerX - (left + width / 2);
    const y = pointerY - (top + height / 2);
    const distance = Math.max(20, Math.hypot(x, y));
    const offset = `${x / distance * width * .095}px ${y / distance * height * .115}px`;

    pupils.forEach((pupil) => {
      pupil.style.translate = offset;
    });
  }

  function resetGaze() {
    cancelAnimationFrame(frame);
    frame = undefined;
    pupils.forEach((pupil) => {
      pupil.style.removeProperty('translate');
    });
  }

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !canTrack.matches) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    frame ??= requestAnimationFrame(followPointer);
  }, { passive: true });

  document.addEventListener('pointerleave', resetGaze);
  window.addEventListener('blur', resetGaze);
  canTrack.addEventListener('change', resetGaze);
}
