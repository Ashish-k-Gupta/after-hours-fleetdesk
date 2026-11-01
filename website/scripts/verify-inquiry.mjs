import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setupInquiryForm} from '../dist/inquiry.js';

const accepted = () => ({ok:true,status:200,json:async()=>{throw new Error('Netlify returns HTML, not JSON');}});

function fixture({host='after-hours-route-atlas.netlify.app',protocol='https:',registrationAttribute=null,captchaPresent=true,resetThrows=false,fetcher=async()=>accepted()}={}) {
  const controls=Object.fromEntries(['name','email','fleet-size','message','bot-field',...(captchaPresent?['g-recaptcha-response']:[])].map(name=>[name,{
    value:'',message:'',listeners:new Map(),setCustomValidity(message){this.message=message;},addEventListener(event,listener){this.listeners.set(event,listener);},
  }]));
  const button={disabled:true,textContent:'Send inquiry'},fields={disabled:false},status={textContent:'',dataset:{},hidden:false};
  const timers=new Map(),requests=[];
  let timerId=0,resets=0,captchaResets=0;
  const form={
    listeners:new Map(),attributes:{},elements:{namedItem:name=>controls[name]},hasAttribute:name=>name===registrationAttribute,
    querySelector:selector=>selector==='[data-inquiry-submit]'?button:selector==='[data-inquiry-fields]'?fields:status,
    addEventListener(event,listener){this.listeners.set(event,listener);},setAttribute(name,value){this.attributes[name]=value;},
    reportValidity(){return Object.values(controls).every(control=>!control.message)&&/^[^\s@]+@[^\s@]+$/.test(controls.email.value);},
    reset(){resets++;for(const control of Object.values(controls))control.value='';},
  };
  const environment={location:{hostname:host,protocol},AbortController,
    grecaptcha:{reset(){captchaResets++;if(resetThrows)throw new Error('Widget unavailable');if(controls['g-recaptcha-response'])controls['g-recaptcha-response'].value='';}},
    setTimeout(callback){timers.set(++timerId,callback);return timerId;},clearTimeout(id){timers.delete(id);},
    fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);},
  };
  const api=setupInquiryForm(form,environment);
  function values(overrides={}) {
    for(const [name,value]of Object.entries({name:'Fleet owner',email:'owner@example.com','fleet-size':'8',message:'Weekend tracking and driver updates.','g-recaptcha-response':'mock-challenge-token',...overrides}))if(controls[name])controls[name].value=value;
  }
  const submit=()=>form.listeners.get('submit')({preventDefault(){}});
  return{api,form,controls,button,fields,status,timers,requests,values,submit,resets:()=>resets,captchaResets:()=>captchaResets};
}

for(const host of ['localhost','127.0.0.1','127.2.3.4','::1','[::1]','test.localhost','192.168.1.10','10.0.0.2','172.16.0.3','172.31.255.1','']) {
  const f=fixture({host});f.values();await f.submit();
  assert.equal(f.api.available,false);assert.equal(f.button.disabled,true);assert.equal(f.requests.length,0);assert.ok(f.status.textContent.includes('Preview only'));
}
for(const config of [{protocol:'http:'},{protocol:'file:'},{registrationAttribute:'data-netlify'},{registrationAttribute:'netlify'},{host:'route-atlas.afterhours-fleetdesk.workers.dev',registrationAttribute:'data-netlify'}]) {
  const f=fixture(config);f.values();await f.submit();assert.equal(f.requests.length,0);assert.equal(f.button.disabled,true);assert.equal(f.status.dataset.state,'info');
}
const success=fixture();success.values({name:'  Jordan & team  ',message:'  Tracking + ETA checks = clear updates & handovers.  '});await success.submit();
assert.equal(success.requests.length,1);assert.equal(success.requests[0].url,'/');
assert.equal(success.requests[0].options.method,'POST');
assert.equal(success.requests[0].options.headers['Content-Type'],'application/x-www-form-urlencoded');
assert.equal(success.requests[0].options.mode,'same-origin');assert.equal(success.requests[0].options.credentials,'same-origin');
assert.equal(success.requests[0].options.redirect,'error','A CAPTCHA rejection redirect must not become a success-page HTTP 200');
const body=Object.fromEntries(new URLSearchParams(success.requests[0].options.body));
assert.equal(body.name,'Jordan & team');assert.equal(body.email,'owner@example.com');
assert.equal(body.message,'Tracking + ETA checks = clear updates & handovers.');
assert.equal(body['fleet-size'],'8');
assert.equal(body['bot-field'],'');assert.equal(body.subject,'After Hours - weekend and after-hours coverage inquiry');
assert.equal(body['form-name'],'after-hours-inquiry');
assert.equal(body['g-recaptcha-response'],'mock-challenge-token');
assert.deepEqual(Object.keys(body).sort(),['bot-field','email','fleet-size','form-name','g-recaptcha-response','message','name','subject']);
assert.equal(success.resets(),1);assert.equal(success.status.dataset.state,'success');
assert.equal(success.captchaResets(),1);
assert.equal(success.button.disabled,false);assert.equal(success.fields.disabled,false);assert.equal(success.form.attributes['aria-busy'],'false');
assert.equal(success.timers.size,0);assert.ok(!/inbox|delivered/i.test(success.status.textContent));
success.controls.name.listeners.get('input')();assert.equal(success.status.hidden,true);

for(const overrides of [{name:'   '},{email:''},{email:'Doe'},{email:'invalid'},{message:'\n  '},{'fleet-size':'0'},{'fleet-size':'-1'},{'fleet-size':'2.5'},{'fleet-size':'1000'},{'fleet-size':'eight'},{name:'x'.repeat(81)},{email:'x'.repeat(255)+'@example.com'},{message:'x'.repeat(3001)}]) {
  const f=fixture();f.values(overrides);await f.submit();assert.equal(f.requests.length,0,JSON.stringify(overrides).slice(0,60));assert.equal(f.resets(),0);assert.equal(f.status.dataset.state,'error');
}
for(const size of ['', '1', '999']) {const f=fixture();f.values({'fleet-size':size});await f.submit();assert.equal(f.requests.length,1);assert.equal(f.status.dataset.state,'success');}
const bot=fixture();bot.values({'bot-field':'filled'});await bot.submit();assert.equal(bot.requests.length,0);assert.notEqual(bot.status.dataset.state,'success');
for(const token of ['', '   ']) {
  const f=fixture();f.values({'g-recaptcha-response':token});await f.submit();
  assert.equal(f.requests.length,0);assert.equal(f.resets(),0);assert.equal(f.status.dataset.state,'error');
  assert.match(f.status.textContent,/robot/);assert.equal(f.controls.name.value,'Fleet owner');assert.equal(f.button.disabled,false);
}
const missingWidget=fixture({captchaPresent:false});missingWidget.values();await missingWidget.submit();
assert.equal(missingWidget.requests.length,0);assert.match(missingWidget.status.textContent,/does not load/);
for(const statusCode of [400,404,429,500]) {
  const f=fixture({fetcher:async()=>({ok:false,status:statusCode})});f.values();await f.submit();
  assert.equal(f.status.dataset.state,'error');assert.equal(f.resets(),0);assert.equal(f.controls.message.value,'Weekend tracking and driver updates.');
  assert.equal(f.button.disabled,false);assert.equal(f.fields.disabled,false);assert.equal(f.timers.size,0);
  assert.equal(f.captchaResets(),1);assert.equal(f.controls['g-recaptcha-response'].value,'');
  if(statusCode===429)assert.ok(f.status.textContent.includes('Too many attempts'));
}
const offline=fixture({fetcher:async()=>{throw new TypeError('Offline');}});offline.values();await offline.submit();
assert.equal(offline.status.dataset.state,'error');assert.equal(offline.resets(),0);assert.equal(offline.controls.email.value,'owner@example.com');assert.equal(offline.button.disabled,false);
assert.equal(offline.captchaResets(),1);
const rejectedCaptcha=fixture({fetcher:async()=>{throw new TypeError('Redirect rejected');}});rejectedCaptcha.values();await rejectedCaptcha.submit();
assert.equal(rejectedCaptcha.resets(),0);assert.equal(rejectedCaptcha.status.dataset.state,'error');assert.equal(rejectedCaptcha.controls.name.value,'Fleet owner');
const resetFailure=fixture({resetThrows:true});resetFailure.values();await resetFailure.submit();
assert.equal(resetFailure.status.dataset.state,'success');assert.equal(resetFailure.button.disabled,false);assert.equal(resetFailure.fields.disabled,false);

const expired=fixture();expired.values();expired.controls['g-recaptcha-response'].value='';await expired.submit();
assert.equal(expired.requests.length,0,'Expired token requires a new challenge');
expired.controls['g-recaptcha-response'].value='fresh-token';await expired.submit();assert.equal(expired.status.dataset.state,'success');

const customDomain=fixture({host:'example.com'});customDomain.values({name:'Jörg & Co',message:'Weekend coverage: 18:00–06:00 + PODs & ETAs.\nPlease reply.'});await customDomain.submit();
assert.equal(customDomain.status.dataset.state,'success');
const encoded=new URLSearchParams(customDomain.requests[0].options.body);
assert.equal(encoded.get('name'),'Jörg & Co');assert.equal(encoded.get('message'),'Weekend coverage: 18:00–06:00 + PODs & ETAs.\nPlease reply.');

let release;
const pending=fixture({fetcher:()=>new Promise(resolve=>{release=resolve;})});pending.values();
const first=pending.submit();assert.equal(pending.requests.length,1);assert.equal(pending.button.disabled,true);assert.equal(pending.fields.disabled,true);
await pending.submit();assert.equal(pending.requests.length,1,'Rapid double-submit sends only once');
release(accepted());await first;assert.equal(pending.status.dataset.state,'success');

const timeout=fixture({fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});timeout.values();
const timed=timeout.submit();assert.equal(timeout.timers.size,1);[...timeout.timers.values()][0]();await timed;
assert.equal(timeout.status.dataset.state,'error');assert.equal(timeout.resets(),0);assert.equal(timeout.button.disabled,false);assert.equal(timeout.timers.size,0);

const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const form=html.match(/<form class="inquiry-form"([\s\S]*?)<\/form>/)?.[0];assert.ok(form);
for(const value of ['action="/"','method="POST"','data-netlify="true"','netlify-honeypot="bot-field"','data-netlify-recaptcha="true"','<div data-netlify-recaptcha="true" data-size="compact"></div>','name="after-hours-inquiry"','name="bot-field"','name="form-name" value="after-hours-inquiry"','name="subject" value="After Hours - weekend and after-hours coverage inquiry"','name="name"','name="email"','name="fleet-size"','name="message"'])assert.ok(form.includes(value),value);
assert.equal((form.match(/data-netlify-recaptcha="true"/g)||[]).length,2,'Exactly one form and one widget registration');
assert.ok(!form.includes('formsubmit'));assert.ok(!form.includes('name="_subject"'));
assert.ok(!form.match(/id="inquiry-fleet-size"[^>]*\brequired\b/));
assert.ok(html.includes('mailto:afterhours.fleetdesk@gmail.com?subject=Fleet%20coverage'));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(ids.length,new Set(ids).size);
for(const match of html.matchAll(/\b(?:for|aria-describedby|aria-labelledby)="([^"]+)"/g))for(const id of match[1].split(' '))assert.ok(ids.includes(id),id);
console.log('PASS: Netlify registration/preview gating, field validation, same-origin encoded POST, CAPTCHA registration/token forwarding, missing/expired check prevention, single-use challenge reset, rejection redirects, widget reset failures, HTTP/offline/timeout recovery, duplicate prevention, honeypot and accessible labels. Fetch and CAPTCHA are stubbed; server enforcement and inbox delivery are not simulated.');
