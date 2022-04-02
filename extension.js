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

class Parser {

    constructor(logger, configuration) {
        this.logger = logger;
        this.text;
        this.excludeWordsRegex = null;
        this.decorationParameter;
        this.decorationUnusedParameter;
        this.loadConfigurations(configuration);
    }

    //
    // PUBLIC
    //

    // load from configuration
    loadConfigurations(configuration) {
        this.decorationParameter = vscode.window.createTextEditorDecorationType(configuration.parameterCss);
        this.decorationUnusedParameter = vscode.window.createTextEditorDecorationType(configuration.unusedParameterCss);
        if (configuration.excludeWords.length > 0) {
            this.excludeWordsRegex = "\\b(" + configuration.excludeWords.join("|") + ")\\b";
        }
        else {
            this.excludeWordsRegex = null;
        }
    }

    log(text) {
        let date = new Date()
        this.logger.appendLine('[' +
            ("000" + date.getFullYear()).slice(-4) + '-' +
            ("0" + date.getDate()).slice(-2) + '-' +
            ("0" + (date.getMonth() + 1)).slice(-2) + ' ' +
            ("0" + date.getHours()).slice(-2) + ':' +
            ("0" + date.getMinutes()).slice(-2) + ':' +
            ("0" + date.getSeconds()).slice(-2) + '.' +
            ("00" + date.getMilliseconds()).slice(-3) + "] " +
            text);
    }

    resetDecorations(editor) {
        if (!editor) {
            return ;
        }
        if (editor.document.languageId != "c" && editor.document.languageId != "cpp") {
            return ;
        }
        // disable old decoration
        editor.setDecorations(this.decorationParameter, []);
        editor.setDecorations(this.decorationUnusedParameter, []);
    }

    updateDecorations(editor) {
        if (!editor) {
            return ;
        }
        if (editor.document.languageId != "c" && editor.document.languageId != "cpp") {
            return ;
        }
        let rangeParameters = [];
        let rangeUnusedParameters = [];

        // replace range by spaces
        var replaceBySpace = function(str,start,end) {
            let size = end - start;
            return str.substr(0, start) + ' '.repeat(size) + str.substr(start + size);
        }

        // replace all expect by space
        var replaceCommentsAndStrings = (text) => {
            // replacer common
            function replacer(str, offset, input) {
                return ' '.repeat(str.length);
            }
            // replace all \\
            text = text.replace(/\\\\(?<!$)/gm, replacer);
            // replace all containers
            text = text.replace(/"[^]*?(?:(?<!\\)")|'[^]*?(?:(?<!\\)')|\/\*[^]*?\*\/|\/\/[^]*?(?:(?<!\\)$)/gm, replacer);
            // replace define line
            text = text.replace(/#[^]*?(?:(?<!\\)$)/gm, replacer);

            // str to array
            let textArray = text.split('')

            // replace end function
            let search;
            let regEx = /\b(__[a-z_A-Z]+(?:__)?|throw|noexcept|alignas|decltype)\s*[(]/gm;
            while (search = regEx.exec(text)) {
                let level = 0;
                for (let i = search.index + search[1].length ; i < text.length ; i++) {
                    if (text[i] == '{' || text[i] == '}') {
                        textArray[i] = ' '; // delete in parenthesis
                    }
                    if (text[i] == '(') {
                        textArray[i] = ' '; // delete in parenthesis
                        level++;
                    }
                    else if (text[i] == ')') {
                        textArray[i] = ' '; // delete in parenthesis
                        level--;
                        if (level == 0) {
                            let isPrototype = false;
                            for (let j = i + 1 ; j < text.length ; j++) {
                                if (text[j] == ' ' || text[j] == '\t' || text[j] == '\r' || text[j] == '\n') {
                                    continue;
                                }
                                else if (text[j] == ';') {
                                    isPrototype = true;
                                    break;
                                }
                                else {
                                    break;
                                }
                            }
                            if (isPrototype == false) {
                                textArray[search.index + search[1].length] = ':'; // simulate constructor
                            }
                            break;
                        }
                    }
                }
            }

            // array to str
            text = textArray.join('');
            // replace all keyword type
            text = text.replace(/\b(?:throw|noexcept|alignas|decltype|struct|static|union|const|sizeof)\b/gm, replacer);
            // replace exclude word
            if (this.excludeWordsRegex != null) {
                text = text.replace(new RegExp(this.excludeWordsRegex, 'gm'), replacer);
            }

            this.text = text;
        }

        // replace <[...]> by spaces
        var containerHidden = (text) => {
            let level = 0;
            let levelParenthesis = 0;
            let start;
            let end;
            if (text.indexOf('<') >= 0) {
                for (let i = 0 ; i < text.length ; i++) {
                    if (text[i] == '(' && level > 0) {
                        for (let j = i ; j < text.length ; j++) {
                            if (text[j] == '(') {
                                levelParenthesis++;
                            }
                            else if (text[i] == ')') {
                                levelParenthesis--;
                                if (levelParenthesis == 0) {
                                    i = j;
                                    break;
                                }
                            }
                        }
                    }
                    if (text[i] == '{') {
                        for (let j = i ; j < text.length ; j++) {
                            if (text[j] == '{') {
                                levelParenthesis++;
                            }
                            else if (text[i] == '}') {
                                levelParenthesis--;
                                if (levelParenthesis == 0) {
                                    i = j;
                                    break;
                                }
                            }
                        }
                    }
                    if (text[i] == '<') {
                        level++;
                        if (level == 1)
                            start = i;
                    }
                    else if (text[i] == '>') {
                        level--;
                        if (level == 0) {
                            end = i;
                            text = replaceBySpace(text,start,end+1);
                        }
                    }
                }
            }
            level = 0;
            if (text.indexOf('{') >= 0) {
                for (let i = 0 ; i < text.length ; i++) {
                    if (text[i] == '{') {
                        level++;
                        if (level == 1)
                            start = i;
                    }
                    else if (text[i] == '}') {
                        level--;
                        if (level == 0) {
                            end = i;
                            text = replaceBySpace(text,start,end+1);
                        }
                    }
                }
            }
            return text;
        }

        var getParenthesisIndex = (index) => {
            let startParenthesis = -1;
            for (let i = index ; i < this.text.length ; i++) {
                if ('(' === this.text[i]) {
                    startParenthesis = i;
                    break;
                }
            }
            if (startParenthesis < 0) {
                return null;
            }

            let level = 1;
            for (let i = startParenthesis + 1 ; i < this.text.length ; i++) {
                if (this.text[i] == ':' && i + 1 < this.text.length && this.text[i+1] == ':') {
                    i++;
                }
                else if (level == 0 && (this.text[i] == ':' || this.text[i] == '{' || this.text[i] == ';')) {
                    return [startParenthesis, i];
                }
                else if (level > 0 && this.text[i] == ')') {
                    level--;
                }
                else if (level == 0 && this.text[i] == '(') {
                    startParenthesis = i;
                    level = 1;
                }
                else if (this.text[i] == '(') {
                    level++;
                }
            }

            return null;
        }

        var getOpenBraceIndex = (index) => {
            for (let i = index ; i < this.text.length ; i++) {
                if (this.text[i] == '(' || this.text[i] == ';') {
                    return null;
                }
                if (this.text[i] == ':' || this.text[i] == '{') {
                    return i;
                }
            }
            return null;
        }

        var getCloseBraceIndex = (index, isConstructor) => {
            let level = 0 - isConstructor;
            for (let i = index ; i < this.text.length ; i++) {
                if (level < 0 && this.text[i] == ';') {
                    return i;
                }
                else if (level == 0 && this.text[i] == '}') {
                    if (isConstructor) {
                        let save = i;
                        i++;
                        while (/\s/g.test(this.text[i])) {
                            i++;
                        }
                        if (this.text[i] != ',' && this.text[i] != '{') {
                            return save;
                        }
                        level--;
                        i--;
                    }
                    else {
                        return i;
                    }
                }
                else if (level > 0 && this.text[i] == '}') {
                    level--;
                }
                else if (this.text[i] == '{') {
                    level++;
                }
            }
            return null;
        }

        // search prototype in parenthesis (... [...], ... [...])
        var searchPrototypes = (start, end) => {
            let words = [];
            let ranges = [];

            let text = this.text.substr(start, end - start);
            text = containerHidden(text);
            let search;
            let regEx = /([a-z_A-Z0-9]+(?:::[&*\s]+)?[&*\s]*(?:[.][.][.][&*\s]*)?(?:[(][&*\s]*)?)\b([a-z_A-Z][a-z_A-Z0-9]*)\s*(?:,|=[^,]*(?:,|[)(])|\[[^\]]*\]|[)][^,(]*|[(][^,]*)\s*/gm;
            while (search = regEx.exec(text)) {
                if (search[0].length == 0) {
                    continue ;
                }
                words.push(search[2]);
                ranges.push({
                    start: start + search.index + search[1].length,
                    end: start + search.index + search[1].length + search[2].length
                });
            }
            return [words, ranges];
        }

        // search parameter after function
        var searchParameters = (wordsAndRanges, start, end) => {
            let words = wordsAndRanges[0];
            let ranges = wordsAndRanges[1];
            if (words.length == 0) {
                return ;
            }
            let countWords = [];
            for (let i = 0; i < words.length; i++) {
                countWords[words[i]] = 0;
            }
            let text = this.text.substr(start, end - start);
            let search;
            // generate regex for all parameters names
            let regEx = new RegExp("((?<![.]\\s*|[-][>]\\s*|[:][:]\\s*))\\b(" +
                                words.join("|") +
                                ")\\b",
                                "gm");
            while (search = regEx.exec(text)) {
                if (search[2].length == 0) {
                    continue ;
                }
                ranges.push({
                    start: start + search.index + search[1].length,
                    end: start + search.index + search[1].length + search[2].length
                });
                rangeParameters.push({
                    start: start + search.index + search[1].length,
                    end: start + search.index + search[1].length + search[2].length
                });
                countWords[search[2]]++;
            }
            for (let i = 0; i < words.length; i++) {
                if (countWords[words[i]] == 0) {
                    rangeUnusedParameters.push(ranges[i]);
                }
                else {
                    rangeParameters.push(ranges[i]);
                }
            }
        }

        // search all function in text document
        var searchFunctions = () => {
            let endParenthesis = 0;
            let parenthesis;
            while (parenthesis = getParenthesisIndex(endParenthesis)) {
                let startParenthesis = parenthesis[0];
                endParenthesis = parenthesis[1];
                let startBrace = getOpenBraceIndex(endParenthesis);
                if (startBrace == null) {
                    let wordsAndRanges = searchPrototypes(startParenthesis, endParenthesis);
                    let words = wordsAndRanges[0];
                    let ranges = wordsAndRanges[1];
                    for (let i = 0; i < words.length; i++) {
                        rangeParameters.push(ranges[i]);
                    }
                }
                else {
                    let isConstructor = (this.text[startBrace] == ":");
                    let endBrace = getCloseBraceIndex(++startBrace, isConstructor);
                    if (endBrace == null) {
                        continue ;
                    }
                    let words = searchPrototypes(startParenthesis, endParenthesis)
                    searchParameters(words, startBrace, endBrace);
                    endParenthesis = endBrace;
                }
            }
        }
        let startTime = Date.now();
        try {
            replaceCommentsAndStrings(editor.document.getText());
            searchFunctions();
        }
        catch (error) {
            console.error(error);
        }
        let countDecoration = 0;
        try {
            // create parameter range
            let ranges = [];
            for (let range of rangeParameters) {
                let startPosition = editor.document.positionAt(range.start);
                let endPosition = editor.document.positionAt(range.end);
                let vsRange = new vscode.Range(startPosition, endPosition);
                ranges.push({range: vsRange});
            }
            // update decoration
            countDecoration += rangeParameters.length;
            editor.setDecorations(
                this.decorationParameter,
                ranges
            );
            ranges.length = 0;
            let unusedRanges = [];
            for (let range of rangeUnusedParameters) {
                let startPosition = editor.document.positionAt(range.start);
                let endPosition = editor.document.positionAt(range.end);
                let vsRange = new vscode.Range(startPosition, endPosition);
                unusedRanges.push({range: vsRange});
            }
            // update decoration
            countDecoration += rangeUnusedParameters.length;
            editor.setDecorations(
                this.decorationUnusedParameter,
                unusedRanges
            );
            unusedRanges.length = 0;
            this.log("Update decorations at \"" + editor.document.fileName + "\" in " + (Date.now() - startTime) + "ms with " + (countDecoration) + " occurence(s)")
        }
        catch (error) {
            console.error(error);
            this.log(error);
        }
    }
} // class Parser

const nameOfProperties = "highlight.cpp-parameters";

function activate(context) {
    let lastVisibleEditors = [];
    let timeoutTimer = [];
    let configuration = vscode.workspace.getConfiguration(nameOfProperties);
    let logger = vscode.window.createOutputChannel("Highlight C/C++ parameters");
    let parserObj = new Parser(logger, configuration);

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