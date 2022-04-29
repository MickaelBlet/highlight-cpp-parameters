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
        this.excludeRegexes = [];
        this.languageIds = [];
        this.parameterDecoration;
        this.unusedParameterDecoration;
        this.loadConfigurations(configuration);
    }

    //
    // PUBLIC
    //

    // load from configuration
    loadConfigurations(configuration) {
        try {
            this.parameterDecoration = vscode.window.createTextEditorDecorationType(configuration.parameterDecoration);
            this.unusedParameterDecoration = vscode.window.createTextEditorDecorationType(configuration.unusedParameterDecoration);
            this.excludeRegexes.length = 0;
            for (let i = 0 ; i < configuration.excludeRegexes.length ; i++) {
                try {
                    let regex = new RegExp(configuration.excludeRegexes[i], "gm")
                    regex.test();
                    this.excludeRegexes.push(regex);
                }
                catch (e) {
                    this.log(e);
                    console.error(e);
                }
            }
            this.languageIds.length = 0;
            this.languageIds = configuration.languageIds;
        }
        catch (e) {
            this.log(e);
            console.error(e);
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
        // disable old decoration
        editor.setDecorations(this.parameterDecoration, []);
        editor.setDecorations(this.unusedParameterDecoration, []);
    }

    updateDecorations(editor) {
        if (!editor) {
            return ;
        }
        if (this.languageIds.indexOf(editor.document.languageId) < 0) {
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
            let regEx = /(\b__[a-z_A-Z]+(?:__)?|\bthrow|\bnoexcept|\balignas|(?:->\s*)?\bdecltype)\s*[(]/gm;
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
            text = text.replace(/(?:\bthrow\b|\bnoexcept\b|\balignas\b|(?:->\s*)?\bdecltype\b|\bstruct\b|\bstatic\b|\bunion\b|\benum\b|\bconst\b|\bsizeof\b|\boverride\b|\bvolatile\b)/gm, replacer);

            // replace basic type
            function replacerByType(str, offset, input) {
                return ' '.repeat(str.length - 3) + '___';
            }
            text = text.replace(/\bunsigned\b|\bsigned\b|\bchar\b|\bshort\b|\bint\b|\blong\b|\bfloat\b|\bdouble\b/gm, replacerByType);
            text = text.replace(/\b___\b(?:\s+\b___\b)+/gm, replacerByType);

            // replace exclude word
            for (let i = 0 ; i < this.excludeRegexes.length ; i++) {
                text = text.replace(this.excludeRegexes[i], replacer);
            }

            this.text = text;
        }

        var getParenthesisIndex = (index) => {
            let startParenthesis = -1;
            let endParenthesis = -1;
            for (let i = index ; i < this.text.length ; i++) {
                if ('(' === this.text[i]) {
                    startParenthesis = i + 1;
                    break;
                }
            }
            if (startParenthesis < 0) {
                return null;
            }

            let level = 1;
            for (let i = startParenthesis ; i < this.text.length ; i++) {
                if (this.text[i] == ':' && i + 1 < this.text.length && this.text[i+1] == ':') {
                    i++;
                }
                else if (level == 1 && this.text[i] == ')') {
                    endParenthesis = i;
                    level--;
                    i++;
                    while (/\s/gm.test(this.text[i])) {
                        i++;
                    }
                    if (this.text[i] == '-' && this.text[i + 1] == '>') {
                        i+=2;
                        while (/\s/gm.test(this.text[i])) {
                            i++;
                        }
                        while (/;|{|:|=/gm.test(this.text[i]) == false) {
                            i++;
                        }
                    }
                    if (this.text[i] == '=' && this.text[i + 1] != '=') {
                        i++;
                        while (/\s/gm.test(this.text[i])) {
                            i++;
                        }
                        while (/;|{|:/gm.test(this.text[i]) == false) {
                            i++;
                        }
                    }
                    if (this.text[i] == ':' || this.text[i] == '{' || this.text[i] == ';') {
                        return [startParenthesis, endParenthesis, i];
                    }
                    else {
                        i--;
                    }
                }
                else if (level > 0 && this.text[i] == ')') {
                    level--;
                }
                else if (level == 0 && this.text[i] == '(') {
                    startParenthesis = i + 1;
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
                        while (/\s/gm.test(this.text[i])) {
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

        var removeExtraBracket = (text) => {
            let bracketLevelIndex = [];
            let level = 0;
            for (let i = 0 ; i < text.length ; i++) {
                switch (text[i]) {
                    case '(':
                        level++;
                        bracketLevelIndex.push({
                            index: i,
                            level: level,
                            type: '()'
                        });
                        break;
                    case ')':
                        bracketLevelIndex.push({
                            index: i,
                            level: level,
                            type: '()'
                        });
                        level--;
                        break;
                    case '{':
                        level++;
                        bracketLevelIndex.push({
                            index: i,
                            level: level,
                            type: '{}'
                        });
                        break;
                    case '}':
                        bracketLevelIndex.push({
                            index: i,
                            level: level,
                            type: '{}'
                        });
                        level--;
                        break;
                    case '[':
                        level++;
                        bracketLevelIndex.push({
                            index: i,
                            level: level,
                            type: '[]'
                        });
                        break;
                    case ']':
                        bracketLevelIndex.push({
                            index: i,
                            level: level,
                            type: '[]'
                        });
                        level--;
                        break;
                    default:
                        break;
                }
            }
            for (let i = 0 ; i < bracketLevelIndex.length ; i++) {
                if (bracketLevelIndex[i].type === '[]') {
                    if (i > 0 && bracketLevelIndex[i - 1].type !== '[]' && bracketLevelIndex[i - 1].level == bracketLevelIndex[i].level) {
                        // search same level and same type before bracket
                        for (let j = i - 2; j >= 0; j--) {
                            if (bracketLevelIndex[i - 1].level === bracketLevelIndex[j].level && bracketLevelIndex[i - 1].type === bracketLevelIndex[j].type) {
                                // remove extra type
                                text = replaceBySpace(text, bracketLevelIndex[j].index, bracketLevelIndex[j].index + 1);
                                text = replaceBySpace(text, bracketLevelIndex[i - 1].index, bracketLevelIndex[i - 1].index + 1);
                                break;
                            }
                        }
                    }
                    // search end of bracket
                    let start = bracketLevelIndex[i].index;
                    level = bracketLevelIndex[i].level;
                    for (i = i + 1 ;i < bracketLevelIndex.length; i++) {
                        if (bracketLevelIndex[i].level === level && bracketLevelIndex[i].type === '[]') {
                            // remove inside bracket
                            text = replaceBySpace(text, start, bracketLevelIndex[i].index + 1);
                            break;
                        }
                    }
                }
            }
            return text;
        }

        var removeExtraParenthesis = (text) => {
            let parenthesisLevelIndex = [];
            for (let i = 0 ; i < text.length ; i++) {
                if (text[i] == '(') {
                    let level = 1;
                    parenthesisLevelIndex.push({
                        index: i,
                        level: level
                    });
                    while (level > 0) {
                        i++;
                        if (i == text.length) {
                            break;
                        }
                        switch (text[i]) {
                            case '(':
                                level++;
                                parenthesisLevelIndex.push({
                                    index: i,
                                    level: level
                                });
                                break;
                            case ')':
                                parenthesisLevelIndex.push({
                                    index: i,
                                    level: level
                                });
                                level--;
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
            for (let i = 1 ; i < parenthesisLevelIndex.length ; i++) {
                if (parenthesisLevelIndex[i - 1].level < parenthesisLevelIndex[i].level) {
                    let indexStart1 = parenthesisLevelIndex[i - 1].index;
                    let indexStart2 = parenthesisLevelIndex[i].index;
                    // jump to end of level
                    let j = i;
                    for ( ; parenthesisLevelIndex[i - 1].level != parenthesisLevelIndex[j].level ; j++);
                    let indexEnd1 = parenthesisLevelIndex[j - 1].index;
                    let indexEnd2 = parenthesisLevelIndex[j].index;
                    var hasOnlySpaces = (start, end) => {
                        for (; start < end; start++) {
                            if (/\s/gm.test(text[start]) == false) {
                                return false;
                            }
                        }
                        return true;
                    }
                    // check if only space between parenthesis
                    if (hasOnlySpaces(indexStart1 + 1, indexStart2) && hasOnlySpaces(indexEnd1 + 1, indexEnd2)) {
                        // replace by space
                        text = replaceBySpace(text, indexStart1, indexStart1 + 1);
                        text = replaceBySpace(text, indexEnd2, indexEnd2 + 1);
                    }
                }
            }
            return text;
        }

        var removeExtraParenthesis2 = (text) => {
            let parenthesisLevelIndex = [];
            let hasMultiLevel1 = false;
            for (let i = 0 ; i < text.length ; i++) {
                if (text[i] == '(') {
                    let level = 1;
                    if (parenthesisLevelIndex.length > 0) {
                        hasMultiLevel1 = true;
                    }
                    parenthesisLevelIndex.push({
                        index: i,
                        level: level
                    });
                    while (level > 0) {
                        i++;
                        if (i == text.length) {
                            break;
                        }
                        switch (text[i]) {
                            case '(':
                                level++;
                                parenthesisLevelIndex.push({
                                    index: i,
                                    level: level
                                });
                                break;
                            case ')':
                                parenthesisLevelIndex.push({
                                    index: i,
                                    level: level
                                });
                                level--;
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
            if (parenthesisLevelIndex.length > 0) {
                if (hasMultiLevel1) {
                    let j = 0;
                    let start;
                    for (let i = 0 ; i < parenthesisLevelIndex.length ; i++) {
                        if (parenthesisLevelIndex[i].level == 1) {
                            if (j >= 2) {
                                if (j % 2 == 0) {
                                    start = parenthesisLevelIndex[i].index;
                                }
                                else {
                                    text = replaceBySpace(text, start, parenthesisLevelIndex[i].index + 1);
                                }
                            }
                            else {
                                if (j % 2 == 0) {
                                    text = replaceBySpace(text, parenthesisLevelIndex[i].index, parenthesisLevelIndex[i].index + 1);
                                }
                                else {
                                    text = replaceBySpace(text, parenthesisLevelIndex[i].index, parenthesisLevelIndex[i].index + 1);
                                }
                            }
                            j++;
                        }
                    }
                }
                else {
                    if (/([a-z_A-Z0-9]+(?:::[&*\s]+)?[&*\s]*(?:[.][.][.][&*\s]*)?)\b([a-z_A-Z][a-z_A-Z0-9]*)\s*$/gm.test(text.substr(0, parenthesisLevelIndex[0].index))) {
                        // delete inside parenthesis
                        text = replaceBySpace(text, parenthesisLevelIndex[0].index, parenthesisLevelIndex[parenthesisLevelIndex.length-1].index + 1);
                    }
                    else {
                        text = replaceBySpace(text, parenthesisLevelIndex[0].index, parenthesisLevelIndex[0].index + 1);
                        text = replaceBySpace(text, parenthesisLevelIndex[parenthesisLevelIndex.length-1].index, parenthesisLevelIndex[parenthesisLevelIndex.length-1].index + 1);
                    }
                }
            }
            return text;
        }

        var jumpToEndOfParenthesis = (text, index) => {
            let level = 1;
            while (level > 0) {
                index++;
                if (index == text.length) {
                    break;
                }
                switch (text[index]) {
                    case '(':
                        level++;
                        break;
                    case ')':
                        level--;
                        break;
                    default:
                        break;
                }
            }
            return index;
        }

        var jumpToEndOfBrace = (text, index) => {
            let level = 1;
            while (level > 0) {
                index++;
                if (index == text.length) {
                    break;
                }
                switch (text[index]) {
                    case '{':
                        level++;
                        break;
                    case '}':
                        level--;
                        break;
                    default:
                        break;
                }
            }
            return index;
        }

        var jumpToEndOfBracket = (text, index) => {
            let level = 1;
            while (level > 0) {
                index++;
                if (index == text.length) {
                    break;
                }
                switch (text[index]) {
                    case '[':
                        level++;
                        break;
                    case ']':
                        level--;
                        break;
                    case '(':
                        index = jumpToEndOfParenthesis(text, index);
                        break;
                    case '{':
                        index = jumpToEndOfBrace(text, index);
                        break;
                    default:
                        break;
                }
            }
            return index;
        }

        var jumpToEndOfChevron = (text, index) => {
            let level = 1;
            while (level > 0) {
                index++;
                if (index == text.length) {
                    break;
                }
                switch (text[index]) {
                    case '<':
                        level++;
                        break;
                    case '>':
                        level--;
                        break;
                    case '[':
                        index = jumpToEndOfBracket(text, index);
                        break;
                    case '(':
                        index = jumpToEndOfParenthesis(text, index);
                        break;
                    case '{':
                        index = jumpToEndOfBrace(text, index);
                        break;
                    default:
                        break;
                }
            }
            return index;
        }

        // search prototype in parenthesis (... [...], ... [...])
        var searchPrototypes = (start, end) => {
            let words = [];
            let ranges = [];

            let text = this.text.substr(start, end - start);
            // split parameters
            let argsRanges = [];
            let startArg = 0;
            let defaultValue = 0;
            let hasParenthesis = false;
            for (let i = 0 ; i < text.length ; i++) {
                switch (text[i]) {
                    case ',':
                        if (defaultValue > 0) {
                            text = replaceBySpace(text, defaultValue, i);
                        }
                        argsRanges.push({
                            start: startArg,
                            end: i,
                            hasParenthesis: hasParenthesis
                        });
                        startArg = i + 1;
                        defaultValue = 0;
                        hasParenthesis = false;
                        break;
                    case '=':
                        defaultValue = i;
                        break;
                    case '(':
                        hasParenthesis = true;
                        i = jumpToEndOfParenthesis(text, i);
                        break;
                    case '{':
                        const startBrace = i;
                        i = jumpToEndOfBrace(text, i);
                        // remove all {...}
                        text = replaceBySpace(text, startBrace, i + 1);
                        break;
                    case '<':
                        const startChevron = i;
                        i = jumpToEndOfChevron(text, i);
                        // remove all <...>
                        text = replaceBySpace(text, startChevron, i + 1);
                        break;
                    case '[':
                        i = jumpToEndOfBracket(text, i);
                        break;
                    default:
                        break;
                }
            }
            // last argument
            if (defaultValue > 0) {
                text = replaceBySpace(text, defaultValue, text.length);
            }
            argsRanges.push({
                start: startArg,
                end: text.length,
                hasParenthesis: hasParenthesis
            });

            // detect type of argument
            for (let i = 0; i < argsRanges.length; i++) {
                // get text of parameter
                let parameter = text.substr(argsRanges[i].start, argsRanges[i].end - argsRanges[i].start);
                // check parenthesis in parameter definition
                if (argsRanges[i].hasParenthesis === true) {
                    // remove extra parenthesis ((foo))(((bar)))((foo,bar))((foo)(bar)) -> .(foo)...(bar)...(foo,bar)..(foo)(bar).
                    parameter = removeExtraParenthesis(parameter);
                }
                parameter = removeExtraBracket(parameter);
                if (argsRanges[i].hasParenthesis === true) {
                    // remove extra parenthesis (foo)(bar),foo(bar) -> .foo.....,foo.....
                    while (parameter.indexOf('(') >= 0) {
                        parameter = removeExtraParenthesis2(parameter);
                    }
                }
                // get last word if not unique
                const search = parameter.match(
                    /([a-z_A-Z0-9]+(?:::[&*\s]+)?[&*\s]*(?:[.][.][.][&*\s]*)?)\b([a-z_A-Z][a-z_A-Z0-9]*)\s*$/
                );
                if (search == null || search[2] == "___") {
                    continue ;
                }
                words.push(search[2]);
                ranges.push({
                    start: start + argsRanges[i].start + search.index + search[1].length,
                    end: start + argsRanges[i].start + search.index + search[1].length + search[2].length
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
                endParenthesis = parenthesis[2];
                let startBrace = getOpenBraceIndex(endParenthesis);
                if (startBrace == null) {
                    let wordsAndRanges = searchPrototypes(parenthesis[0], parenthesis[1]);
                    for (let i = 0; i < wordsAndRanges[0].length; i++) {
                        rangeParameters.push(wordsAndRanges[1][i]);
                    }
                }
                else {
                    let isConstructor = (this.text[startBrace] == ":");
                    let endBrace = getCloseBraceIndex(++startBrace, isConstructor);
                    if (endBrace == null) {
                        continue ;
                    }
                    let words = searchPrototypes(parenthesis[0], parenthesis[1])
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
                this.parameterDecoration,
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
                this.unusedParameterDecoration,
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
}; // class Parser

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
            let key = visibleTextEditors[i].document.uri.toString(true) + visibleTextEditors[i].viewColumn;
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
        let key = editor.document.uri.toString(true) + editor.viewColumn;
        if (key in timeoutTimer && timeoutTimer[key]) {
            clearTimeout(timeoutTimer[key]);
        }
        timeoutTimer[key] = setTimeout(() => { parserObj.updateDecorations(editor) }, configuration.timeout);
    }
}

function desactivate() { }

module.exports = { activate, desactivate }