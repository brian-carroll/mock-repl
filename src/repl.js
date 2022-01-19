const elemHistory = document.getElementById("history-text");
const elemSourceInput = document.getElementById("source-input");
elemSourceInput.addEventListener("change", onPressEnter);

const historyArray = [];
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

// -----------------------------------------------------------------

let compiler;
loadCompiler("dist/compiler.wasm").then((instance) => {
  compiler = instance;
});

// Byte buffers for communicating with the compiler
// Input buffers are copied into the compiler's heap at an address that it allocates.
// Output buffers are copied out of the compiler's heap so it can drop them afterwards.
const buffers = {
  compilerInput: new Uint8Array(),
  compilerOutput: { ok: true, bytes: new Uint8Array() },
  stringifyInput: new Uint8Array(),
  stringifyOutput: new Uint8Array(),
};

// We need a getter for the compiler memory because whenever it grows,
// the JS ArrayBuffer becomes "detached" and replaced with a new one.
// The ArrayBuffer interface object cannot be resized. I imagine the
// implementation doesn't actually move the bytes unless it has to?
function getCompilerMemory() {
  return new Uint8Array(compiler.exports.memory.buffer);
}

async function loadCompiler(filename) {
  const wasiLinkObject = {};
  const importObject = createFakeWasiImports(wasiLinkObject);

  importObject.env = {
    main: (i32a, i32b) => 0,
    repl_read_compiler_input: (dest) => {
      getCompilerMemory().set(buffers.compilerInput, dest);
    },
    repl_write_compiler_output: (ok, src, size) => {
      const bytes = getCompilerMemory().slice(src, src + size);
      buffers.compilerOutput = { ok: !!ok, bytes };
    },
    repl_read_stringify_input: (dest) => {
      getCompilerMemory().set(buffers.stringifyInput, dest);
    },
    repl_write_stringify_output: (src, size) => {
      buffers.stringifyOutput = getCompilerMemory().slice(src, size + src);
    },
  };

  const responsePromise = fetch(filename);
  const { instance } = await WebAssembly.instantiateStreaming(
    responsePromise,
    importObject
  );

  wasiLinkObject.exports = instance.exports;

  return instance;
}

// -----------------------------------------------------------------

async function onPressEnter(event) {
  const { target } = event;
  const inputText = target.value;

  const { ok, bytes } = compile(inputText);

  if (ok) {
    const { instance: app } = await WebAssembly.instantiate(bytes);
    const resultAddr = app.exports.run();
    const outputText = stringify(app, resultAddr);
    historyArray.push({ ok, inputText, outputText });
  } else {
    const error = textDecoder.decode(bytes);
    historyArray.push({ ok, inputText, outputText: error });
  }

  target.value = "";

  renderHistory();
}

// -----------------------------------------------------------------

function compile(inputText) {
  buffers.compilerInput = textEncoder.encode(inputText);

  compiler.exports.repl_compile(buffers.compilerInput.length);

  return buffers.compilerOutput;
}

// -----------------------------------------------------------------

function stringify(app, appResultAddr) {
  buffers.stringifyInput = new Uint8Array(app.exports.memory.buffer);

  compiler.exports.repl_stringify(buffers.stringifyInput.length, appResultAddr);

  return textDecoder.decode(buffers.stringifyOutput);
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
