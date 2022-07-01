/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

/// <reference path="../typings/xterm.d.ts"/>

// Use tsc version (yarn watch)
import { Terminal } from "../out/browser/public/Terminal";
import { AttachAddon } from "../addons/xterm-addon-attach/out/AttachAddon";
import { FitAddon } from "../addons/xterm-addon-fit/out/FitAddon";
import { SearchAddon, ISearchOptions } from "../addons/xterm-addon-search/out/SearchAddon";
import { WebLinksAddon } from "../addons/xterm-addon-web-links/out/WebLinksAddon";
import { WebglAddon } from "../addons/xterm-addon-webgl/out/WebglAddon";
import { Unicode11Addon } from "../addons/xterm-addon-unicode11/out/Unicode11Addon";
import { LigaturesAddon } from "../addons/xterm-addon-ligatures/out/LigaturesAddon";

// Use webpacked version (yarn package)
// import { Terminal } from '../lib/xterm';
// import { AttachAddon } from 'xterm-addon-attach';
// import { FitAddon } from 'xterm-addon-fit';
// import { SearchAddon, ISearchOptions } from 'xterm-addon-search';
// import { WebLinksAddon } from 'xterm-addon-web-links';
// import { WebglAddon } from 'xterm-addon-webgl';
// import { Unicode11Addon } from 'xterm-addon-unicode11';
// import { LigaturesAddon } from 'xterm-addon-ligatures';

// Pulling in the module's types relies on the <reference> above, it's looks a
// little weird here as we're importing "this" module
import { Terminal as TerminalType, ITerminalOptions } from "xterm";

export interface IWindowWithTerminal extends Window {
  term: TerminalType;
  Terminal?: typeof TerminalType;
  AttachAddon?: typeof AttachAddon;
  FitAddon?: typeof FitAddon;
  SearchAddon?: typeof SearchAddon;
  WebLinksAddon?: typeof WebLinksAddon;
  WebglAddon?: typeof WebglAddon;
  Unicode11Addon?: typeof Unicode11Addon;
  LigaturesAddon?: typeof LigaturesAddon;
}
declare let window: IWindowWithTerminal;

let term;
let protocol;
let socketURL;
let socket;
let pid;

type AddonType = "attach" | "fit" | "search" | "unicode11" | "web-links" | "webgl" | "ligatures";

interface IDemoAddon<T extends AddonType> {
  name: T;
  canChange: boolean;
  ctor: T extends "attach"
    ? typeof AttachAddon
    : T extends "fit"
    ? typeof FitAddon
    : T extends "search"
    ? typeof SearchAddon
    : T extends "web-links"
    ? typeof WebLinksAddon
    : T extends "unicode11"
    ? typeof Unicode11Addon
    : T extends "ligatures"
    ? typeof LigaturesAddon
    : typeof WebglAddon;
  instance?: T extends "attach"
    ? AttachAddon
    : T extends "fit"
    ? FitAddon
    : T extends "search"
    ? SearchAddon
    : T extends "web-links"
    ? WebLinksAddon
    : T extends "webgl"
    ? WebglAddon
    : T extends "unicode11"
    ? typeof Unicode11Addon
    : T extends "ligatures"
    ? typeof LigaturesAddon
    : never;
}

const addons: { [T in AddonType]: IDemoAddon<T> } = {
  attach: { name: "attach", ctor: AttachAddon, canChange: false },
  fit: { name: "fit", ctor: FitAddon, canChange: false },
  search: { name: "search", ctor: SearchAddon, canChange: true },
  "web-links": { name: "web-links", ctor: WebLinksAddon, canChange: true },
  webgl: { name: "webgl", ctor: WebglAddon, canChange: true },
  unicode11: { name: "unicode11", ctor: Unicode11Addon, canChange: true },
  ligatures: { name: "ligatures", ctor: LigaturesAddon, canChange: true },
};

const terminalContainer = document.getElementById("terminal-container");
const actionElements = {
  find: <HTMLInputElement>document.querySelector('#find'),
  findNext: <HTMLInputElement>document.querySelector('#find-next'),
  findPrevious: <HTMLInputElement>document.querySelector('#find-previous'),
  findResults: document.querySelector('#find-results')
};

function getSearchOptions(e: KeyboardEvent): ISearchOptions {
  return {
    regex: (document.getElementById('regex') as HTMLInputElement).checked,
    wholeWord: (document.getElementById('whole-word') as HTMLInputElement).checked,
    caseSensitive: (document.getElementById('case-sensitive') as HTMLInputElement).checked,
    incremental: e.key !== `Enter`,
    decorations: (document.getElementById('highlight-all-matches') as HTMLInputElement).checked ? {
      matchBackground: '#232422',
      matchBorder: '#555753',
      matchOverviewRuler: '#555753',
      activeMatchBackground: '#ef2929',
      activeMatchBorder: '#ffffff',
      activeMatchColorOverviewRuler: '#ef2929'
    } : undefined
  };
}

const disposeRecreateButtonHandler = () => {
  // If the terminal exists dispose of it, otherwise recreate it
  if (term) {
    term.dispose();
    term = null;
    window.term = null;
    socket = null;
    addons.attach.instance = undefined;
    addons.fit.instance = undefined;
    addons.search.instance = undefined;
    addons.unicode11.instance = undefined;
    addons.ligatures.instance = undefined;
    addons["web-links"].instance = undefined;
    addons.webgl.instance = undefined;
    document.getElementById("dispose").innerHTML = "Recreate Terminal";
  } else {
    createTerminal();
    document.getElementById("dispose").innerHTML = "Dispose terminal";
  }
};

createTerminal();
document.getElementById("dispose").addEventListener("click", disposeRecreateButtonHandler);

function createTerminal(): void {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }

  const isWindows = ["Windows", "Win16", "Win32", "WinCE"].indexOf(navigator.platform) >= 0;
  term = new Terminal({
    windowsMode: isWindows,
    fontFamily: "Fira Code, courier-new, courier, monospace",
  } as ITerminalOptions);

  // Load addons
  const typedTerm = term as TerminalType;
  addons.search.instance = new SearchAddon();
  addons.fit.instance = new FitAddon();
  addons.unicode11.instance = new Unicode11Addon();
  // TODO: Remove arguments when link provider API is the default
  addons["web-links"].instance = new WebLinksAddon(undefined, undefined, true);
  typedTerm.loadAddon(addons.fit.instance);
  typedTerm.loadAddon(addons.search.instance);
  typedTerm.loadAddon(addons.unicode11.instance);
  typedTerm.loadAddon(addons["web-links"].instance);

  window.term = term; // Expose `term` to window for debugging purposes
  term.onResize((size: { cols: number; rows: number }) => {
    if (!pid) {
      return;
    }
    const cols = size.cols;
    const rows = size.rows;
    const url = "/terminals/" + pid + "/size?cols=" + cols + "&rows=" + rows;

    fetch(url, { method: "POST" });
  });
  protocol = location.protocol === "https:" ? "wss://" : "ws://";
  socketURL =
    protocol + location.hostname + (location.port ? ":" + location.port : "") + "/terminals/";

  term.open(terminalContainer);
  addons.fit.instance!.fit();
  term.focus();

  addDomListener(actionElements.findNext, "keyup", (e) => {
    addons.search.instance.findNext(actionElements.findNext.value, getSearchOptions(e));
  });
  addDomListener(actionElements.findPrevious, 'keyup', (e) => {
    addons.search.instance.findPrevious(actionElements.findPrevious.value, getSearchOptions(e));
  });
  addDomListener(actionElements.findNext, 'blur', (e) => {
    addons.search.instance.clearActiveDecoration();
  });
  addDomListener(actionElements.findPrevious, 'blur', (e) => {
    addons.search.instance.clearActiveDecoration();
  });

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(() => {
    // Set terminal size again to set the specific dimensions on the demo
    updateTerminalSize();

    fetch("/terminals?cols=" + term.cols + "&rows=" + term.rows, { method: "POST" }).then((res) => {
      res.text().then((processId) => {
        pid = processId;
        socketURL += processId;
        socket = new WebSocket(socketURL);
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;
      });
    });
  }, 0);
}

function runRealTerminal(): void {
  addons.attach.instance = new AttachAddon(socket);
  term.loadAddon(addons.attach.instance);
  term._initialized = true;
  initAddons(term);
}

function runFakeTerminal(): void {
  if (term._initialized) {
    return;
  }

  term._initialized = true;
  initAddons(term);

  term.prompt = () => {
    term.write("\r\n$ ");
  };

  term.writeln("Welcome to xterm.js");
  term.writeln("This is a local terminal emulation, without a real terminal in the back-end.");
  term.writeln("Type some keys and commands to play around.");
  term.writeln("");
  term.prompt();

  term.onKey((e: { key: string; domEvent: KeyboardEvent }) => {
    const ev = e.domEvent;
    const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

    if (ev.keyCode === 13) {
      term.prompt();
    } else if (ev.keyCode === 8) {
      // Do not delete the prompt
      if (term._core.buffer.x > 2) {
        term.write("\b \b");
      }
    } else if (printable) {
      term.write(e.key);
    }
  });
}

function initAddons(term: TerminalType): void {
  const fragment = document.createDocumentFragment();
  Object.keys(addons).forEach((name: AddonType) => {
    const addon = addons[name];
    const checkbox = document.createElement("input") as HTMLInputElement;
    checkbox.type = "checkbox";
    checkbox.checked = !!addon.instance;
    if (!addon.canChange) {
      checkbox.disabled = true;
    }
    if (name === 'unicode11' && checkbox.checked) {
      term.unicode.activeVersion = '11';
    }
    if (name === 'search' && checkbox.checked) {
      addon.instance.onDidChangeResults(e => updateFindResults(e));
    }
    addDomListener(checkbox, 'change', () => {
      if (checkbox.checked) {
        addon.instance = new addon.ctor();
        term.loadAddon(addon.instance);
        if (name === "unicode11") {
          term.unicode.activeVersion = "11";
        } else if (name === 'search') {
          addon.instance.onDidChangeResults(e => updateFindResults(e));
        }
      } else {
        if (name === "unicode11") {
          term.unicode.activeVersion = "6";
        }
        addon.instance!.dispose();
        addon.instance = undefined;
      }
    });
    const label = document.createElement("label");
    label.classList.add("addon");
    if (!addon.canChange) {
      label.title = "This addon is needed for the demo to operate";
    }
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(name));
    const wrapper = document.createElement("div");
    wrapper.classList.add("addon");
    wrapper.appendChild(label);
    fragment.appendChild(wrapper);
  });
  const container = document.getElementById("addons-container");
  container.innerHTML = "";
  container.appendChild(fragment);
}

function updateFindResults(e: { resultIndex: number, resultCount: number } | undefined) {
  let content: string;
  if (e === undefined) {
    content = 'undefined';
  } else {
    content = `index: ${e.resultIndex}, count: ${e.resultCount}`;
  }
  actionElements.findResults.textContent = content;
}

function addDomListener(element: HTMLElement, type: string, handler: (...args: any[]) => any): void {
  element.addEventListener(type, handler);
  term._core.register({ dispose: () => element.removeEventListener(type, handler) });
}

function updateTerminalSize(): void {
  addons.fit.instance.fit();
}

window.onresize = () => updateTerminalSize();
