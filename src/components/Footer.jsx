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

  <a
    class="brand"
    href="https://www.screenly.io"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Screenly - opens in a new tab"
  >
    <img src="/static/images/screenly-logo.svg?v=${props.v}" alt="Screenly" />
  </a>
  `

export default Footer
