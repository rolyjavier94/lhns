# Notary Services GitHub Pages Starter

Basic static project scaffold for GitHub Pages using plain HTML, CSS, and Markdown.

## Structure

- `index.html`
- `assets/css/style.css`
- `assets/img/`
- `pages/services.html`
- `pages/pricing.html`
- `pages/contact.html`
- `pages/about.html`

## Local Preview

Open `index.html` in your browser, or use any lightweight static file server.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In repository settings, open Pages.
3. Set source to the default branch root and save.

## Security Hardening Notes

- GitHub Pages does not let you set custom HTTP response headers directly.
- For production hardening, place the site behind a host/CDN that supports headers (for example Cloudflare, Netlify, or Vercel).
- Recommended headers:
	- `Content-Security-Policy`
	- `Strict-Transport-Security`
	- `X-Content-Type-Options: nosniff`
	- `Referrer-Policy`
	- `Permissions-Policy`
- Start with a restrictive CSP and expand only what the app needs:

```txt
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://us-central1-lnhs-eac77.cloudfunctions.net https://formspree.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://formspree.io
```
