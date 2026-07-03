# Screenly Clock App

![Clock App Screenshot](assets/screenshot.jpg)

This is an example asset for Screenly as part of the [Screenly Playground](https://github.com/Screenly/playground).

You can view the live demo at [clock.srly.io](https://clock.srly.io/). The clock detects the viewer's location at the Cloudflare edge (country + timezone) and displays the correct local time, in the local 12/24-hour format and language.

## Requirements

This project uses [Bun](https://bun.sh/) as its package manager. Install dependencies with:

```bash
bun install
```

This installs [Wrangler](https://developers.cloudflare.com/workers/wrangler/) locally. Run it via `bunx wrangler` (or install it globally with `bun add -g wrangler`).

Login to Cloudflare

```bash
bunx wrangler login
```

Run the project in dev mode

```bash
bun run dev
```

Lint and test

```bash
bun run lint
bun test
```

Build the static assets (vendors webfonts, then minifies JS/CSS in place)

```bash
bun run build
```

Deploy worker

```bash
bunx wrangler deploy --env [environment name]
```
