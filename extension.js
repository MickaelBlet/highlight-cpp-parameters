/*
MIT License

Copyright (c) 2022 Mickaël Blet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const vscode = require("vscode");
const parser = require("./src/parser");

const nameOfProperties = "highlight.cpp-parameters";

function activate(context) {
    let lastVisibleEditors = [];
    let timeoutTimer = [];
    let configuration = vscode.workspace.getConfiguration(nameOfProperties);
    let logger = vscode.window.createOutputChannel("Highlight C/C++ parameters");
    let parserObj = new parser.Parser(logger, configuration);

    // first launch
    let visibleTextEditors = vscode.window.visibleTextEditors;
    for (let i = 0; i < visibleTextEditors.length; i++) {
        triggerUpdate(visibleTextEditors[i]);
    }

    // event configuration change
    vscode.workspace.onDidChangeConfiguration(event => {
        configuration = vscode.workspace.getConfiguration(nameOfProperties);
        let visibleTextEditors = vscode.window.visibleTextEditors;
        for (let i = 0; i < visibleTextEditors.length; i++) {
            parserObj.resetDecorations(visibleTextEditors[i]);
        }
        parserObj.loadConfigurations(configuration);
        for (let i = 0; i < visibleTextEditors.length; i++) {
            triggerUpdate(visibleTextEditors[i]);
        }
    });

    // event change all text editor
    vscode.window.onDidChangeVisibleTextEditors(visibleTextEditors => {
        let newVisibleEditors = [];
        for (let i = 0; i < visibleTextEditors.length; i++) {
            let key = [visibleTextEditors[i].document.uri.path, visibleTextEditors[i].viewColumn];
            newVisibleEditors[key] = true;
            if (!(key in lastVisibleEditors)) {
                triggerUpdate(visibleTextEditors[i]);
            }
        }
        lastVisibleEditors = newVisibleEditors;
    });

    // event change text content
    vscode.workspace.onDidChangeTextDocument(event => {
        let openEditors = vscode.window.visibleTextEditors.filter(
            (editor) => editor.document.uri === event.document.uri
        );
        for (let i = 0; i < openEditors.length; i++) {
            triggerUpdate(openEditors[i]);
        }
    });

    // trigger call update decoration
    function triggerUpdate(editor) {
        let key = [editor.document.uri.path, editor.viewColumn];
        if (key in timeoutTimer && timeoutTimer[key]) {
            clearTimeout(timeoutTimer[key]);
        }
        timeoutTimer[key] = setTimeout(() => { parserObj.updateDecorations(editor) }, configuration.timeout);
    }
}

function desactivate() { }

module.exports = { activate, desactivate }