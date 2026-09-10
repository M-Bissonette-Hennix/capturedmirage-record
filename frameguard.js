// GitHub Pages cannot emit a frame-ancestors CSP header. This is defense-in-depth only,
// not a replacement for a response-header frame-ancestors policy on a hardened origin.
try { if (window.top !== window.self) window.top.location = window.self.location.href; } catch { document.documentElement.hidden = true; }
