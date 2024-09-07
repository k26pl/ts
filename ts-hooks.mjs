import { transformFile } from "@swc/core";
import { appendFile, stat } from "fs/promises";
export async function initialize() {}
let initial = false;

export async function resolve(specifier, context, nextResolve) {
  if (
    (context.parentURL + "").includes("node_modules") ||
    (initial && !(specifier.startsWith(".") || specifier.startsWith("/")))
  )
    return nextResolve(specifier);
  initial = true;
  // Take an `import` or `require` specifier and resolve it to a URL.
  let type;
  if (specifier.endsWith(".ts")) {
    type = "ts";
  } else {
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
