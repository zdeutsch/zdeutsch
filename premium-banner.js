(() => {
  const image = document.getElementById("zdeutsch-premium-creative");

  if (!(image instanceof HTMLImageElement)) return;

  const basePath = "assets/campaigns/zdeutsch-premium-animated-20261006/";
  const mobileQuery = window.matchMedia("(max-width: 699px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const render = () => {
    const layout = mobileQuery.matches ? "mobile" : "desktop";
    const filename = !reducedMotionQuery.matches
      ? `zdeutsch-premium-teaser-${layout}-ar.webp`
      : `poster-${layout}.jpg`;

    image.src = `${basePath}${filename}`;
    image.width = layout === "mobile" ? 360 : 900;
    image.height = layout === "mobile" ? 480 : 300;
  };

  const listen = (query, handler) => {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
    } else if (typeof query.addListener === "function") {
      query.addListener(handler);
    }
  };

  listen(mobileQuery, render);
  listen(reducedMotionQuery, render);
  render();
})();
