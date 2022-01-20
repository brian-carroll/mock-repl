// REPL state
const repl = {
  elemHistory: document.getElementById("history-text"),
  elemSourceInput: document.getElementById("source-input"),

  historyArray: [],
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),

  compiler: null,

  // Byte buffers for communicating with the compiler
  buffers: {
    compilerInput: new Uint8Array(),
    compilerOutput: { ok: false, bytes: new Uint8Array() },
    stringifyInput: new Uint8Array(),
    stringifyOutput: new Uint8Array(),
  },
};

// Initialise the REPL
repl.elemSourceInput.addEventListener("change", onPressEnter);
loadCompiler("dist/compiler.wasm").then((instance) => {
  repl.compiler = instance;
});

// We need a getter for the compiler memory because whenever it grows,
// the JS ArrayBuffer becomes "detached" and replaced with a new one.
// The ArrayBuffer interface object cannot be resized. I imagine the
// implementation doesn't actually move the bytes unless it has to?
function getCompilerMemory() {
  return new Uint8Array(repl.compiler.exports.memory.buffer);
}

// -----------------------------------------------------------------

async function loadCompiler(filename) {
  const wasiLinkObject = {};
  const importObject = createFakeWasiImports(wasiLinkObject);

  // JS callbacks for the compiler
  // Input buffers are copied into the compiler's heap at whatever address it allocates.
  // Output buffers are copied out of the compiler's heap so it can drop them afterwards.
  // This setup makes it easy to manage lifetimes inside the compiler.
  importObject.env = {
    repl_read_compiler_input: (dest) => {
      getCompilerMemory().set(repl.buffers.compilerInput, dest);
    },
    repl_write_compiler_output: (ok, src, size) => {
      const bytes = getCompilerMemory().slice(src, src + size);
      repl.buffers.compilerOutput = { ok: !!ok, bytes };
    },
    repl_read_stringify_input: (dest) => {
      getCompilerMemory().set(repl.buffers.stringifyInput, dest);
    },
    repl_write_stringify_output: (src, size) => {
      repl.buffers.stringifyOutput = getCompilerMemory().slice(src, size + src);
    },

    // C-style main function. We don't use it, but the compiler module imports it.
    main: (i32a, i32b) => 0,
  };

  // Streaming API allows browser to start processing Wasm while the file is still loading.
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
    repl.historyArray.push({ ok, inputText, outputText });
  } else {
    const error = repl.textDecoder.decode(bytes);
    repl.historyArray.push({ ok, inputText, outputText: error });
  }

  target.value = "";

  renderHistory();
}

// -----------------------------------------------------------------

function compile(inputText) {
  repl.buffers.compilerInput = repl.textEncoder.encode(inputText);

  repl.compiler.exports.repl_compile(repl.buffers.compilerInput.length);

  return repl.buffers.compilerOutput;
}

// -----------------------------------------------------------------

function stringify(app, appResultAddr) {
  repl.buffers.stringifyInput = new Uint8Array(app.exports.memory.buffer);

  repl.compiler.exports.repl_stringify(
    repl.buffers.stringifyInput.length,
    appResultAddr
  );

  return repl.textDecoder.decode(repl.buffers.stringifyOutput);
}

// -----------------------------------------------------------------

function renderHistory() {
  repl.elemHistory.innerHTML = "";
  repl.historyArray.forEach(({ ok, inputText, outputText }) => {
    const inputElem = document.createElement("div");
    const outputElem = document.createElement("div");

    inputElem.textContent = "> " + inputText;
    inputElem.classList.add("input");

    outputElem.textContent = outputText;
    outputElem.classList.add("output");
    outputElem.classList.add(ok ? "output-ok" : "output-error");

    repl.elemHistory.appendChild(inputElem);
    repl.elemHistory.appendChild(outputElem);
  });
  repl.elemHistory.scrollTop = repl.elemHistory.scrollHeight;
}
