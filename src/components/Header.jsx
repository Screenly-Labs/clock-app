import { html } from 'hono/html'

const Header = (props) => html`
  <header class="masthead">
    <span class="eyebrow anim" style="--d: 0ms">Local time</span>
    <span class="masthead-date anim" style="--d: 80ms">
      <img class="date-icon" src="/static/images/icons/calendar.svg?v=${props.v}" alt="" width="20" height="20" />
      <span class="date" id="date"></span>
    </span>
  </header>
  `

export default Header
