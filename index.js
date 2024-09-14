const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const { MessageChannel } = require('node:worker_threads');

const { port1, port2 } = new MessageChannel();

port1.on('message', (msg) => {
  try{
    if(process.env.K_LOG)console.log("[@k26pl/ts]: ",...msg);
  }catch(e){}
});
port1.unref();

register('./ts-hooks.mjs', pathToFileURL(__filename),{
  data:{port:port2},
  transferList:[port2]
});