(() => {
  const image = document.getElementById("zdeutsch-premium-creative");
  const motionButton = document.getElementById("zdeutsch-premium-motion");

  if (!(image instanceof HTMLImageElement) || !(motionButton instanceof HTMLButtonElement)) return;

  const basePath = "assets/campaigns/zdeutsch-premium-animated-20261006/";
  const mobileQuery = window.matchMedia("(max-width: 699px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let motionEnabled = !reducedMotionQuery.matches;

  const render = () => {
    const layout = mobileQuery.matches ? "mobile" : "desktop";
    const filename = motionEnabled
      ? `zdeutsch-premium-teaser-${layout}-ar.webp`
      : `poster-${layout}.jpg`;

    image.src = `${basePath}${filename}`;
    image.width = layout === "mobile" ? 360 : 900;
    image.height = layout === "mobile" ? 480 : 300;
    motionButton.textContent = motionEnabled ? "إيقاف الحركة" : "تشغيل الحركة";
    motionButton.setAttribute("aria-label", motionEnabled ? "إيقاف حركة الإعلان" : "تشغيل حركة الإعلان");
  };

  const listen = (query, handler) => {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
    } else if (typeof query.addListener === "function") {
      query.addListener(handler);
    }
  };

  motionButton.hidden = false;
  motionButton.addEventListener("click", () => {
    motionEnabled = !motionEnabled;
    render();
  });
  listen(mobileQuery, render);
  listen(reducedMotionQuery, () => {
    motionEnabled = !reducedMotionQuery.matches;
    render();
  });
  render();
})();
