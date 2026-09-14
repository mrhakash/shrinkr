import React from 'react';

export function Landing() {
  return (
    <div className="landing">
      <nav className="spread" style={{ padding: '10px 0' }}>
        <div className="brand">Shrink<span>r</span></div>
        <div className="row">
          <a className="btn" href="/login">Log in</a>
          <a className="btn primary" href="/signup">Get started</a>
        </div>
      </nav>
      <div className="hero">
        <h1>Short links. <span>Real numbers.</span></h1>
        <p>Shrinkr shortens your URLs and counts every click — under your workspace, with plan quotas and admin control. Built autonomously by the saas-factory skill.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn primary" href="/signup" style={{ padding: '12px 26px', fontSize: 16 }}>Create free account</a>
        </div>
      </div>
      <div className="steps">
        <div className="card">
          <h3>1 · Shorten</h3>
          <p className="muted">Paste any http(s) URL. Get a short slug instantly — custom slugs allowed.</p>
        </div>
        <div className="card">
          <h3>2 · Share</h3>
          <p className="muted">Public redirect works without login, records referrer and time per click.</p>
        </div>
        <div className="card">
          <h3>3 · Watch</h3>
          <p className="muted">Per-link click counts and recent-click detail, capped by your plan.</p>
        </div>
      </div>
      <footer className="muted" style={{ textAlign: 'center', marginTop: 60 }}>
        Sandbox billing — no real payments in v1.0. · <a href="https://github.com/mrhakash/shrinkr">GitHub</a>
      </footer>
    </div>
  );
}
