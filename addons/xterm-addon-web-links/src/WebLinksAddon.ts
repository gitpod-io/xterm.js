/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ILinkMatcherOptions, ITerminalAddon, IDisposable } from 'xterm';
import { ILinkProviderOptions, WebLinkProvider } from './WebLinkProvider';

const protocolClause = '(https?:\\/\\/)';
const domainCharacterSet = '[\\da-z\\.-]+';
const negatedDomainCharacterSet = '[^\\da-z\\.-]+';
const domainBodyClause = '(' + domainCharacterSet + ')';
const tldClause = '([a-z\\.]{2,18})';
const ipClause = '((\\d{1,3}\\.){3}\\d{1,3})';
const localHostClause = '(localhost)';
const portClause = '(:\\d{1,5})';
const hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + '|' + localHostClause + ')' + portClause + '?';
const pathCharacterSet = '(\\/[\\/\\w\\.\\-%~:+@]*)*([^:"\'\\s])';
const pathClause = '(' + pathCharacterSet + ')?';
const queryStringHashFragmentCharacterSet = '[0-9\\w\\[\\]\\(\\)\\/\\?\\!#@$%&\'*+,:;~\\=\\.\\-]*';
const queryStringClause = '(\\?' + queryStringHashFragmentCharacterSet + ')?';
const hashFragmentClause = '(#' + queryStringHashFragmentCharacterSet + ')?';
const negatedPathCharacterSet = '[^\\/\\w\\.\\-%]+';
const bodyClause = hostClause + pathClause + queryStringClause + hashFragmentClause;
const start = '(?:^|' + negatedDomainCharacterSet + ')(';
const end = ')($|' + negatedPathCharacterSet + ')';
const strictUrlRegex = new RegExp(start + protocolClause + bodyClause + end);

function handleLink(event: MouseEvent, uri: string): void {
  const newWindow = window.open();
  if (newWindow) {
    try {
      newWindow.opener = null;
    } catch {
      // no-op, Electron can throw
    }

    const uriToOpen = new URL(uri);
    const localHostnames = ['0.0.0.0', 'localhost', '127.0.0.1'];

    const shouldRewrite = localHostnames.indexOf(uriToOpen.hostname) !== -1;

    const workspaceUrl = new URL(location.href).hostname.replace(/\d{1,5}-/, '');
    uriToOpen.protocol = 'https:';
    uriToOpen.hostname = `${uriToOpen.port}-${workspaceUrl}`;
    uriToOpen.port = '';

    newWindow.location.href = shouldRewrite ? uriToOpen.toString() : uri;
  } else {
    console.warn('Opening link blocked as opener could not be cleared');
  }
}

export class WebLinksAddon implements ITerminalAddon {
  private _linkMatcherId: number | undefined;
  private _terminal: Terminal | undefined;
  private _linkProvider: IDisposable | undefined;

  constructor(
    private _handler: (event: MouseEvent, uri: string) => void = handleLink,
    private _options: ILinkMatcherOptions | ILinkProviderOptions = {},
    private _useLinkProvider: boolean = false
  ) {
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;

    if (this._useLinkProvider && 'registerLinkProvider' in this._terminal) {
      const options = this._options as ILinkProviderOptions;
      const regex = options.urlRegex || strictUrlRegex;
      this._linkProvider = this._terminal.registerLinkProvider(new WebLinkProvider(this._terminal, regex, this._handler, options));
    } else {
      // TODO: This should be removed eventually
      const options = this._options as ILinkMatcherOptions;
      options.matchIndex = 1;
      this._linkMatcherId = (this._terminal as Terminal).registerLinkMatcher(strictUrlRegex, this._handler, options);
    }
  }

  public dispose(): void {
    if (this._linkMatcherId !== undefined && this._terminal !== undefined) {
      this._terminal.deregisterLinkMatcher(this._linkMatcherId);
    }

    this._linkProvider?.dispose();
  }
}
