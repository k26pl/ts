import { transformFile } from "@swc/core";
import { readFile, stat } from "fs/promises";
let logs=[];
let log=(...msg)=>{
  logs.push(msg);
}
export async function initialize({port}) {
  let s=d=>{
    port.postMessage(JSON.parse(JSON.stringify(d)))
  }
  logs.forEach(s)
  log=(...m)=>s(m);
}
//let initial = false;
/**
 * 
 * @param {string} specifier 
 * @param {*} context 
 * @param {*} nextResolve 
 * @returns {*}
 */
export async function resolve(specifier, context, nextResolve) {
  log(specifier,context,nextResolve)
  //if (
  //  (context.parentURL + "").includes("node_modules") ||
  //  (initial && !(specifier.startsWith(".") || specifier.startsWith("/")))
  //)
  //  return nextResolve(specifier);
  //initial = true;
  // Take an `import` or `require` specifier and resolve it to a URL.
  let type;
  if (specifier.endsWith(".ts")) {
    type = "ts";
  } else {
    if(!(specifier.startsWith(".")||specifier.startsWith("/"))){
      let u=new URL(specifier,context.parentURL).pathname
      let w=u.split("/")
      // remove filename
      w.pop()
      // we only need to find relevant node_modules
      let spec=specifier.split("/")[0];
      //try node_modules in all parent directories
      while(w.length>0){
        try{
          let s= await stat(w.join("/")+"/node_modules/"+spec)
          if(s.isDirectory()){
            try{
              let j=JSON.parse(await readFile(w.join("/")+"/node_modules/"+specifier+"/package.json",{encoding:"utf-8"}))
              let main=w.join("/")+"/node_modules/"+specifier+"/"+j.main;
              return resolve(main,context,nextResolve)
            }catch(e){
              //probably package/file was used
              return resolve(w.join("/")+"/node_modules/"+specifier,context,nextResolve)
            }
              
          }
        }catch(e){
          w.pop();
        }
      }
      log("u",w)
    }
    // check if file with .ts added exists
    await stat(new URL(specifier, context.parentURL).toString().replace("file://", "") + ".ts")
      .then((e) => {
        type = e.isDirectory() ? "dir" : "ne";
      })
      .catch(async () => {
        //in some places .ts files are imported as .js
        await stat(
          new URL(specifier, context.parentURL)
            .toString()
            .replace("file://", "")
            .replace(".js", ".ts")
        )
          .then(() => {
            type = "js_as_ts";
          })
          .catch(() => {
            type = "def";
          });
      });
  }
  //check if target is a directory
  if (
    await stat(new URL(specifier, context.parentURL).toString().replace("file://", ""))
      .then((e) => e.isDirectory())
      .catch(() => false)
  )
    type = "dir";
  if (type == "def") {
    return nextResolve(specifier);
  }
  if (type == "ts") {
    return {
      format: "module",
      shortCircuit: true,
      url: new URL(specifier, context.parentURL).toString(),
    };
  }

  if (type == "dir") {
    let ts = await stat(specifier.replace("file://", "") + "/index.ts")
      .then(() => true)
      .catch(() => false);
    let url = new URL(specifier + (ts ? "/index.ts" : "/index.js"), context.parentURL).toString();
    return {
      format: "module",
      shortCircuit: true,
      url,
    };
  }

  return {
    format: "module",
    shortCircuit: true,
    url: new URL(
      type == "ne" ? specifier + ".ts" : specifier.replace(".js", ".ts"),
      context.parentURL
    ).toString(),
  };
}

export async function load(url, context, nextLoad) {
  // Take a resolved URL and return the source code to be evaluated.

  if (url.endsWith(".ts") && context.format == "module") {
    return {
      format: "module",
      shortCircuit: true,
      source: (
        await transformFile(url.replace("file://", ""), {
          inlineSourcesContent: true,
          isModule: true,
          jsc: {
            parser: {
              syntax: "typescript",
              dynamicImport: true,
            },
            target: "es2022",
            preserveAllComments: true,
          },
          swcrc: false,
        })
      ).code,
    };
  } else {
    return nextLoad(url, context);
  }
}
