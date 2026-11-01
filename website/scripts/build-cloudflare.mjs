import assert from 'node:assert/strict';
import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(project, 'dist');
const output = resolve(project, 'cloudflare-dist');
// This directory is generated; never remove the source or a computed outside path.
assert.equal(dirname(output), project);
assert.equal(output, project + sep + 'cloudflare-dist');
assert.notEqual(output, source);

const sourceHtml = await readFile(resolve(source, 'index.html'), 'utf8');
const dialog = /<dialog\b[^>]*\bid="coverage-contact"[^>]*>[\s\S]*?<\/dialog>/;
assert.match(sourceHtml, dialog, 'Contact dialog must exist before generating the Cloudflare edition');
const contact = `<dialog class="coverage-dialog coverage-dialog-email-only" id="coverage-contact" aria-labelledby="coverage-title" aria-describedby="coverage-status">
 <form method="dialog" class="coverage-close-form"><button class="coverage-close" type="submit" aria-label="Close coverage details" autofocus><span aria-hidden="true">&times;</span></button></form>
 <p class="small-label">WEEKEND &amp; AFTER-HOURS / SMALL-FLEET SUPPORT</p>
 <h2 id="coverage-title">Let&rsquo;s talk coverage.</h2>
 <p class="coverage-intro" id="coverage-status">Email us to discuss weekend or after-hours coverage for your fleet.</p>
 <p class="direct-email-label">EMAIL YOUR INQUIRY</p>
 <a class="contact-email" href="mailto:afterhours.fleetdesk@gmail.com?subject=Fleet%20coverage">afterhours.fleetdesk@gmail.com</a>
 <p class="coverage-status">Include your fleet size, the days and hours you need covered, and your time zone.</p>
</dialog>`;
const html = sourceHtml.replace(dialog, contact).replace(/<script\b[^>]*\bsrc="inquiry\.js"[^>]*><\/script>/, '');
assert.doesNotMatch(html, /data-inquiry-form|data-netlify|netlify-honeypot|inquiry\.js|<input\b|<textarea\b|method="POST"/i);
assert.match(html, /mailto:afterhours\.fleetdesk@gmail\.com\?subject=Fleet%20coverage/);
assert.equal((html.match(/data-open-coverage/g) || []).length, 3, 'All three contact entry points remain');

const css = await readFile(resolve(source, 'atlas.css'), 'utf8');
const emailCss = `\n/* Email-only contact edition for Cloudflare static uploads. */
.coverage-dialog-email-only .direct-email-label{margin:0;padding-top:0;border-top:0}
.coverage-dialog-email-only .contact-email{padding:8px 0 22px}
`;

await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(source, output, {recursive: true, filter: path => path !== resolve(source, 'inquiry.js')});
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, 'atlas.css'), css + emailCss);

async function verifyFiles(directory, prefix = '') {
  let count = 0;
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) count += await verifyFiles(resolve(directory, entry.name), relative + '/');
    else {
      count++;
      if (!['index.html', 'atlas.css'].includes(relative)) {
        assert.ok((await readFile(resolve(source, relative))).equals(await readFile(resolve(output, relative))), relative + ' must match the latest source');
      }
    }
  }
  return count;
}
console.log(`Cloudflare email-only edition: ${output} (${await verifyFiles(output)} public files). Netlify dist preserved.`);
