/*
MIT License

Copyright (c) 2021 Mickaël Blet

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
const path = require("path");

class Parser {

    constructor(logger, contributions) {
        this.activeEditor;
        this.logger = logger;
        this.text;
        this.decorationParameter;
        this.decorationUnusedParameter;
        this.ranges = [];
        this.unusedRanges = [];
        this.loadConfigurations(contributions);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(contributions) {
        this.decorationParameter = vscode.window.createTextEditorDecorationType(contributions.parameterCss);
        this.decorationUnusedParameter = vscode.window.createTextEditorDecorationType(contributions.unusedParameterCss);
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

    resetDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        if (activeEditor.document.languageId != "c" && activeEditor.document.languageId != "cpp") {
            return ;
        }
        // reset range
        this.ranges.length = 0;
        this.unusedRanges.length = 0;
        // disable old decoration
        activeEditor.setDecorations(this.decorationParameter, this.ranges);
        activeEditor.setDecorations(this.decorationUnusedParameter, this.unusedRanges);
    }

    updateDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        if (activeEditor.document.languageId != "c" && activeEditor.document.languageId != "cpp") {
            return ;
        }
        let startTime = Date.now();
        this.activeEditor = activeEditor;
        // replace by spaces
        this.text = this.replaceCommentsAndStrings(this.activeEditor.document.getText());
        // search all ranges
        this.searchFunctions();
        // set new decoration
        activeEditor.setDecorations(this.decorationParameter, this.ranges);
        activeEditor.setDecorations(this.decorationUnusedParameter, this.unusedRanges);
        // log time
        this.log("Update decorations at \"" + path.basename(activeEditor.document.fileName) + "\" in " + (Date.now() - startTime) + "ms with " + (this.ranges.length + this.unusedRanges.length) + " occurence(s)")
        // reset range
        this.ranges.length = 0;
        this.unusedRanges.length = 0;
    }

    //
    // PRIVATE
    //

    // replace range by spaces
    replaceBySpace(str,start,end) {
        let size = end - start;
        return str.substr(0, start) + ' '.repeat(size) + str.substr(start + size);
    }

    // replace all expect by space
    replaceCommentsAndStrings(text) {
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
        // replace enum
        text = text.replace(/\benum\b\s*(?:struct|class)?\s*(?:\b[a-z_A-Z0-9]+\b)?\s*(?:[:][^]*?(?:}\s*;)+|{[^]*?(?:}\s*;))/gm, replacer);

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
                        textArray[search.index + search[1].length] = ':'; // simulate constructor
                        break;
                    }
                }
            }
        }

        // array to str
        text = textArray.join('');
        // replace all keyword type
        text = text.replace(/\b(?:reinterpret_cast|atomic_noexcept|atomic_commit|atomic_cancel|__has_include|synchronized|dynamic_cast|thread_local|static_cast|const_cast|co_return|constexpr|constexpr|constexpr|co_return|protected|namespace|consteval|noexcept|decltype|template|operator|noexcept|co_yield|co_await|reflexpr|continue|co_await|co_yield|requires|volatile|register|restrict|explicit|volatile|noexcept|typename|default|_Pragma|mutable|include|concept|alignas|virtual|alignof|__asm__|defined|mutable|typedef|warning|private|and_eq|define|pragma|typeid|switch|bitand|return|ifndef|export|struct|sizeof|module|static|public|extern|inline|friend|delete|xor_eq|import|not_eq|class|compl|bitor|throw|or_eq|while|catch|break|union|const|const|endif|ifdef|undef|error|using|else|line|goto|else|elif|this|enum|case|new|asm|not|try|for|and|xor|or|if|do|if)\b/gm, replacer);

        return text;
    }

    // replace <[...]> by spaces
    containerHidden(text) {
        let level = 0;
        let start;
        let end;
        if (text.indexOf("<") >= 0) {
            for (let i = 0 ; i < text.length ; i++) {
                if (text[i] == "<") {
                    level++;
                    if (level == 1)
                        start = i;
                }
                else if (text[i] == ">") {
                    level--;
                    if (level == 0) {
                        end = i;
                        text = this.replaceBySpace(text,start,end+1);
                    }
                }
            }
        }
        level = 0;
        if (text.indexOf("{") >= 0) {
            for (let i = 0 ; i < text.length ; i++) {
                if (text[i] == "{") {
                    level++;
                    if (level == 1)
                        start = i;
                }
                else if (text[i] == "}") {
                    level--;
                    if (level == 0) {
                        end = i;
                        text = this.replaceBySpace(text,start,end+1);
                    }
                }
            }
        }
        return text;
    }

    getParenthesisIndex(index) {
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
            if (this.text[i] == ":" && i + 1 < this.text.length && this.text[i+1] == ":") {
                i++;
            }
            else if (level == 0 && (this.text[i] == ":" || this.text[i] == "{" || this.text[i] == ";")) {
                return [startParenthesis, i];
            }
            else if (level > 0 && this.text[i] == ")") {
                level--;
            }
            else if (level == 0 && this.text[i] == "(") {
                startParenthesis = i;
                level = 1;
            }
            else if (this.text[i] == "(") {
                level++;
            }
        }

        return null;
    }

    getOpenBraceIndex(index) {
        for (let i = index ; i < this.text.length ; i++) {
            if (this.text[i] == "(" || this.text[i] == ";") {
                return null;
            }
            if (this.text[i] == ":" || this.text[i] == "{") {
                return i;
            }
        }
        return null;
    }

    getCloseBraceIndex(index, isConstructor) {
        let level = 0 - isConstructor;
        for (let i = index ; i < this.text.length ; i++) {
            if (level == 0 && this.text[i] == "}") {
                return i;
            }
            else if (level > 0 && this.text[i] == "}") {
                level--;
            }
            else if (this.text[i] == "{") {
                level++;
            }
        }
        return null;
    }

    // search prototype in parenthesis (... [...], ... [...])
    searchPrototypes(start, end) {
        let words = [];
        let ranges = [];

        let text = this.text.substr(start, end - start);
        text = this.containerHidden(text);
        let search;
        let regEx = /([a-z_A-Z0-9]+(?:::[&*]+)?\s*[&*]*\s*(?:[(][&*]*\s*)?)\b([a-z_A-Z][a-z_A-Z0-9]*)\s*(?:,|=[^,]*(?:,|[)(])|\[[^\]]*\]|[)][^,(]*|[(][^,]*)\s*/gm;
        while (search = regEx.exec(text)) {
            if (search[0].length == 0) {
                continue ;
            }
            let startPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length + search[2].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            words.push(search[2]);
            ranges.push(range);
        }
        return [words, ranges];
    }

    // search parameter after function
    searchParameters(wordsAndRanges, start, end) {
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
            let startPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length + search[2].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            this.ranges.push(range);
            countWords[search[2]]++;
        }
        for (let i = 0; i < words.length; i++) {
            if (countWords[words[i]] == 0) {
                this.unusedRanges.push(ranges[i]);
            }
            else {
                this.ranges.push(ranges[i]);
            }
        }
    }

    // search all function in text document
    searchFunctions() {
        let endParenthesis = 0;
        let parenthesis;
        while (parenthesis = this.getParenthesisIndex(endParenthesis)) {
            let startParenthesis = parenthesis[0];
            endParenthesis = parenthesis[1];
            let startBrace = this.getOpenBraceIndex(endParenthesis);
            if (startBrace == null) {
                let wordsAndRanges = this.searchPrototypes(startParenthesis, endParenthesis);
                let words = wordsAndRanges[0];
                let ranges = wordsAndRanges[1];
                for (let i = 0; i < words.length; i++) {
                    this.ranges.push(ranges[i]);
                }
            }
            else {
                let isConstructor = (this.text[startBrace] == ":");
                let endBrace = this.getCloseBraceIndex(++startBrace, isConstructor);
                if (endBrace == null) {
                    continue ;
                }
                let words = this.searchPrototypes(startParenthesis, endParenthesis)
                this.searchParameters(words, startBrace, endBrace);
                endParenthesis = endBrace;
            }
        }
    }

} // class Parser

exports.Parser = Parser;