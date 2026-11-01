# After Hours - The Route Atlas

Interactive 3D fleet-support portfolio, with local fonts, vendored Three.js, license notices, and verification scripts.

## Run locally

Use Node.js 22 or newer. No npm dependency installation is needed. Run commands from `website/`.

- `npm run dev`: Netlify edition at http://localhost:4185
- `npm run dev:cloudflare`: Cloudflare email-only edition at http://localhost:4186
- `npm run dev:lan`: local network preview

## Deployment

`dist/` is the canonical editable website source, including the Netlify form/CAPTCHA edition. `cloudflare-dist/` is the generated email-only edition used by the current Cloudflare website. Run `npm run build:cloudflare` after changing the source to regenerate it.

Deploy only the corresponding public folder. For Netlify Git deployments of this combined repository, set the base directory to `website`; `netlify.toml` is relative to that directory. Enable Netlify form detection and verify hosted submission delivery separately.

Current website: https://route-atlas.afterhours-fleetdesk.workers.dev/

## Verification

- `npm run check`
- `npm run verify`
- `npm run verify:stages`
- `npm run verify:atlas`
- `npm run verify:clearance`
- `npm run verify:inquiry`

The FMCSA automation is in the adjacent `automation/` folder. Website deployments and Apps Script updates are separate operations.
