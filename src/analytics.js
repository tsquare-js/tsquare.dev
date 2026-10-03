// Usage statistics with PostHog, as described on /privacy:
// - no cookies or local storage (persistence: "memory"), so nothing recognizes a visitor across visits;
// - no session recording, autocapture, heatmaps or surveys;
// - events say what happened ("link_copied"), never what was written: the playground's
//   tsquare:event details carry no wireframe text, and nothing here reads the page;
// - requests go to /ingest on this site, which vercel.json forwards to PostHog (US).
// Only tsquare.dev counts: preview deploys and local dev send nothing.
(() => {
  if (location.hostname !== "tsquare.dev") return;

  const queue = [];
  let ready = false;
  const capture = (name, props) => (ready ? window.posthog.capture(name, props) : queue.push([name, props]));

  // The playground and the landing page announce actions as tsquare:event { name, ...props }.
  addEventListener("tsquare:event", (e) => {
    const { name, ...props } = e.detail || {};
    if (typeof name === "string") capture(name, props);
  });
  // Links and buttons marked data-track="name" (the landing page's calls to action).
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target.closest("[data-track]") : null;
    if (el) capture(el.dataset.track, el.dataset.trackLabel ? { label: el.dataset.trackLabel } : {});
  });

  const script = document.createElement("script");
  script.src = "/ingest/static/array.js";
  script.async = true;
  script.onload = () => {
    window.posthog.init("phc_CueHddqJSpsn8qsKAqCXVKikkQF3bu6upxKwHhSTUjaU", {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      persistence: "memory",
      person_profiles: "identified_only", // nobody is ever identified, so no person profiles
      capture_pageview: true,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      advanced_disable_flags: true, // no feature flags, so no /flags request
    });
    ready = true;
    for (const [name, props] of queue.splice(0)) window.posthog.capture(name, props);
  };
  document.head.appendChild(script);
})();
