import http from "node:http";
import {readFile,stat} from "node:fs/promises";
import {dirname,extname,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {networkInterfaces} from "node:os";
const cloudflare=process.argv.includes('--cloudflare');
const root=resolve(dirname(fileURLToPath(import.meta.url)),cloudflare?"cloudflare-dist":"dist");
const port=Number(process.env.PORT||(cloudflare?4186:4185));
const lan=process.argv.includes('--lan');
const privateIPv4=address=>/^10\./.test(address)||/^192\.168\./.test(address)||/^172\.(1[6-9]|2\d|3[01])\./.test(address);
const interfaces=Object.entries(networkInterfaces()).flatMap(([name,addresses])=>addresses.filter(address=>address.family==='IPv4'&&!address.internal&&privateIPv4(address.address)).map(address=>({name,address:address.address})));
const lanInterface=interfaces.find(item=>/wi-?fi|wireless|wlan/i.test(item.name))||interfaces[0];
if(lan&&!lanInterface)throw new Error('No private IPv4 network address found. Connect to Wi-Fi, then run npm run dev:lan again.');
const host=lan?lanInterface.address:'127.0.0.1';
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".woff2":"font/woff2",".txt":"text/plain; charset=utf-8"};
http.createServer(async(req,res)=>{
  try{
    if(!["GET","HEAD"].includes(req.method)){res.writeHead(405,{Allow:"GET, HEAD"});return res.end("Method not allowed");}
    const url=new URL(req.url,"http://localhost");
    let path=resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end("Forbidden");}
    if((await stat(path)).isDirectory()){
      if(!url.pathname.endsWith("/")){res.writeHead(308,{Location:`${url.pathname}/${url.search}`});return res.end();}
      path=resolve(path,"index.html");
    }
    const data=await readFile(path);res.writeHead(200,{"Content-Type":types[extname(path)]||"application/octet-stream","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});res.end(req.method==="HEAD"?undefined:data);
  }catch{res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});res.end("Not found");}
}).listen(port,host,()=>console.log(lan?`After Hours / Wi-Fi preview: http://${host}:${port}\nShare this URL with devices on the same network. Keep this server running.`:`After Hours / ${cloudflare?'Cloudflare email-only':'The Route Atlas'}: http://localhost:${port}`));
