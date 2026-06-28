import { html } from 'hono/html'

const Layout = (props) => html`<!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Screenly Clock App</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="A clean, full-screen clock for digital signage — local time and date, automatically localized to the screen's location." />
      <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='none' stroke='%23f6c455' stroke-width='2'/%3E%3Cpath d='M16 8v8l5 3' fill='none' stroke='%23f6c455' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
      <link
        rel="preload"
        href="/static/fonts/fraunces-latin-standard-normal.woff2?v=${props.v}"
        as="font"
        type="font/woff2"
        crossorigin
      />
      <link
        rel="preload"
        href="/static/fonts/hanken-grotesk-latin-wght-normal.woff2?v=${props.v}"
        as="font"
        type="font/woff2"
        crossorigin
      />
      <link rel="stylesheet" href="/static/styles/main.css?v=${props.v}" />
      ${props.sentryId
        ? html`<script
            src="https://js.sentry-cdn.com/${props.sentryId}.min.js"
            crossorigin="anonymous"
          ></script>`
        : ''}
      ${props.gaId
        ? html`<!-- Google tag (gtag.js) -->
          <script async src="https://www.googletagmanager.com/gtag/js?id=${props.gaId}"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${props.gaId}');
          </script>`
        : ''}
      <script src="/static/js/main.js?v=${props.v}" async defer></script>
    </head>
    <body>
      ${props.children}
    </body>
  </html>`

export default Layout
