const elemSourceInput = document.getElementById("source-input");
const elemHistory = document.getElementById("history-text");
const historyArray = [];
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

let compiler;
loadCompiler("dist/compiler.wasm");

elemSourceInput.addEventListener("change", onPressEnter);

// -----------------------------------------------------------------

async function onPressEnter(event) {
  const { target } = event;
  const inputText = target.value;

  const { app, compileError } = await compileApp(inputText);
  const ok = !compileError;
  if (ok) {
    const resultAddr = app.exports.run();
    const outputText = stringifyResult(app, resultAddr);
    historyArray.push({ ok, inputText, outputText });
  } else {
    historyArray.push({ ok, inputText, outputText: compileError });
  }

  target.value = "";

  renderHistory();
}

// -----------------------------------------------------------------

async function compileApp(inputText) {
  const inputTextBytes = textEncoder.encode(inputText);

  // Allocate memory in the compiler and copy the text into it
  const inputTextAddr = compiler.exports.malloc(inputTextBytes.length + 1);
  const compilerMemory = new Uint8Array(compiler.exports.memory.buffer);
  compilerMemory.set(inputTextBytes, inputTextAddr);
  compilerMemory[inputTextBytes.length] = 0; // zero-terminated C string

  // Compile the text to a Wasm app
  const resultByteArrayAddr = compiler.exports.compile_app(inputTextAddr);
  const ok = compilerMemory[resultByteArrayAddr] == 1;
  const byteArrayAddr = resultByteArrayAddr + 4;
  const byteArray = getByteArray(compiler, byteArrayAddr);

  if (ok) {
    const { instance: app } = await WebAssembly.instantiate(byteArray);
    return { app, compileError: "" };
  } else {
    const compileError = textDecoder.decode(byteArray);
    return { app: null, compileError };
  }
}

// -----------------------------------------------------------------

function stringifyResult(app, resultAddr) {
  const appMemory = new Uint8Array(app.exports.memory.buffer);
  const bufAddr = compiler.exports.malloc(appMemory.length);
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
