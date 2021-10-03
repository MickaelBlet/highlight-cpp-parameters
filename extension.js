const vscode = require("vscode");
const parser = require("./src/parser");

function activate(context) {
    let activeEditor;
    let logger = vscode.window.createOutputChannel("Highlight C/C++ parameters");
    let contributions = vscode.workspace.getConfiguration('highlight-cpp-parameters');
    let parserObj = new parser.Parser(logger, contributions);

    // function call by triggerUpdateDecorations
    let updateDecorations = function (useHash = false) {
        if (!activeEditor) {
            return ;
        }
        parserObj.updateDecorations(activeEditor);
    };

    // first launch
    if (vscode.window.visibleTextEditors.length > 0) {
        let textEditors = vscode.window.visibleTextEditors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.updateDecorations(textEditors[i]);
        }
    }

    // set first activeEditor
    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
    }

    // event configuration change
    vscode.workspace.onDidChangeConfiguration(event => {
        contributions = vscode.workspace.getConfiguration('highlight-cpp-parameters');
        let textEditors = vscode.window.visibleTextEditors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.resetDecorations(textEditors[i]);
        }
        parserObj.loadConfigurations(contributions);
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.updateDecorations(textEditors[i]);
        }
    });

    // event change text editor focus
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    // event change all text editor
    vscode.window.onDidChangeVisibleTextEditors(editors => {
        let textEditors = editors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.updateDecorations(textEditors[i]);
        }
    });

    // event change text content
    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    });

    // trigger call update decoration
    var timeout;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, contributions.timeout);
    }
}

function desactivate() {}

module.exports = {
	activate,
	desactivate
}