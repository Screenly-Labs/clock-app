import { html } from 'hono/html'

const Footer = (props) => html`
  <main class="stage">
    <div class="clock anim" style="--d: 200ms">
      <span class="time" id="time"></span><span class="ampm" id="ampm"></span>
    </div>
    <div class="minute-track anim" style="--d: 300ms" aria-hidden="true">
      <span class="minute-fill" id="minute-fill"></span>
    </div>
  </main>

  <aside class="cta-wrap anim" style="--d: 420ms">
    <div class="upgrade-banner">
      <span class="cta-msg" id="cta-msg">Powerful, secure, simple digital signage</span>
      <span class="cta-lockup">
        <img class="cta-logo" src="/static/images/screenly-logo.svg?v=${props.v}" alt="Screenly" width="178" height="40" />
        <span class="cta-url">screenly.io</span>
      </span>
    </div>
  </aside>
  `

export default Footer
