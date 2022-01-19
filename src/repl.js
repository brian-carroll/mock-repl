const elemSourceInput = document.getElementById("source-input");
const elemHistory = document.getElementById("history-text");
const historyArray = [];
const textDecoder = new TextDecoder("utf8");
let compiler;
loadCompiler("dist/compiler.wasm");

elemSourceInput.addEventListener("change", onPressEnter);

// -----------------------------------------------------------------

async function onPressEnter(event) {
  const { target } = event;
  const inputText = target.value;
  const countdownStart = parseInt(inputText);

  try {
    const outputText = await compileRunStringify(countdownStart);
    historyArray.push({ ok: true, inputText, outputText });
  } catch (e) {
    const outputText = `${e}`;
    historyArray.push({ ok: false, inputText, outputText });
    console.error(e);
  }

  target.value = "";

  renderHistory();
}

// -----------------------------------------------------------------

async function compileRunStringify(countdownStart) {
  const app = await compileApp(countdownStart);

  const resultAddr = app.exports.run();
  const appMemory = new Uint8Array(app.exports.memory.buffer);

  // Create a buffer in the compilerMemory and copy the entire appMemory into it
  const bufSize = appMemory.length;
  const bufAddr = compiler.exports.malloc(bufSize);
  const compilerMemory = new Uint8Array(compiler.exports.memory.buffer);
  compilerMemory.set(appMemory, bufAddr);

  const stringSliceAddr = compiler.exports.stringify_repl_result(
    bufAddr,
    resultAddr
  );
  const stringBytes = getByteArray(compiler, stringSliceAddr);
  const string = textDecoder.decode(stringBytes);
  compiler.exports.free(bufAddr);
  compiler.exports.free(stringSliceAddr);
  return string;
}

// -----------------------------------------------------------------

async function compileApp(countdownStart) {
  if (countdownStart < 0 || countdownStart > 255) {
    throw new Error(
      "I only understand numbers from 0-255, because I'm a fake compiler"
    );
  }
  const sliceAddr = compiler.exports.compile_app(countdownStart);
  const appBytes = getByteArray(compiler, sliceAddr);
  const { instance: app } = await WebAssembly.instantiate(appBytes);
  return app;
}

// -----------------------------------------------------------------

/**
 * Decode a C ByteArray to a Uint8Array
 * @param {WebAssembly.Instance} instance
 * @param {number} addr
 * @returns {Uint8Array}
 */
function getByteArray(instance, addr) {
  const memory32 = new Uint32Array(instance.exports.memory.buffer);
  const memory8 = new Uint8Array(instance.exports.memory.buffer);

  const index32 = addr >> 2;
  const length = memory32[index32];
  const bytesAddr = addr + 4;

  return memory8.slice(bytesAddr, bytesAddr + length);
}

// -----------------------------------------------------------------

function renderHistory() {
  elemHistory.innerHTML = "";
  historyArray.forEach(({ ok, inputText, outputText }) => {
    const inputElem = document.createElement("div");
    const outputElem = document.createElement("div");

    inputElem.textContent = "> " + inputText;
    inputElem.classList.add("input");

    outputElem.textContent = outputText;
    outputElem.classList.add("output");
    outputElem.classList.add(ok ? "output-ok" : "output-error");

    elemHistory.appendChild(inputElem);
    elemHistory.appendChild(outputElem);
  });
  elemHistory.scrollTop = elemHistory.scrollHeight;
}

// -----------------------------------------------------------------

async function loadCompiler(filename) {
  const wasiLinkObject = {};
  const importObject = createFakeWasiImports(wasiLinkObject);
  importObject.env = {
    main: (i32a, i32b) => 0,
  };

  const responsePromise = fetch(filename);
  const { instance } = await WebAssembly.instantiateStreaming(
    responsePromise,
    importObject
  );

  wasiLinkObject.exports = instance.exports;

  compiler = instance;
}
