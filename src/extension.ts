// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as yaxmAst from '@md-to-latex/converter/dist/ast/parsing/index';
import { Node, NodeType, positionToTextPosition, splitLinesWithTextPositions, TextNode, textPositionEq, traverseNodeChildrenDeepDepth } from '@md-to-latex/converter/dist/ast/node';

const enum EphemeralNodeType {
    MacroName = 'MacroName',
    Label = 'Label',
    Href = 'Href',
    Key = 'Key',
}

interface TokenMapItem {
    nodeType: NodeType | EphemeralNodeType,
    vscodeName: string,
}

const tokenTypesLegend: TokenMapItem[] = [
    {nodeType: NodeType.Blockquote,
    vscodeName: 'quote'},
    {nodeType: NodeType.Code,
    vscodeName: 'code'},
    {nodeType: NodeType.CodeSpan,
    vscodeName: 'enumMember'},
    {nodeType: NodeType.Comment,
    vscodeName: 'comment'},
    {nodeType: NodeType.Del,
    vscodeName: 'strikethrough'},
    {nodeType: NodeType.Em,
    vscodeName: 'emphasis'},
    {nodeType: NodeType.Formula,
    vscodeName: 'struct'},
    {nodeType: NodeType.FormulaSpan,
    vscodeName: 'struct'},
    {nodeType: NodeType.Heading,
    vscodeName: 'heading'},
    {nodeType: NodeType.Hr,
    vscodeName: 'hr'},
    // {nodeType: NodeType.Image,
    // vscodeName: 'class'},
    {nodeType: NodeType.Latex,
    vscodeName: 'latex'},
    {nodeType: NodeType.LatexSpan,
    vscodeName: 'latex'},
    // {nodeType: NodeType.Link,
    // vscodeName: 'class'},
    // {nodeType: NodeType.OpCode,
    // vscodeName: 'macro'},
    {nodeType: NodeType.TableControlCell,
    vscodeName: 'regexp'}, //
    {nodeType: NodeType.Strong,
    vscodeName: 'bold'},
    {nodeType: NodeType.Underline,
    vscodeName: 'underline'},

    {nodeType: EphemeralNodeType.MacroName,
    vscodeName: 'macro'},
    {nodeType: EphemeralNodeType.Label,
    vscodeName: 'variable'},
    {nodeType: EphemeralNodeType.Href,
    vscodeName: 'method'},
    {nodeType: EphemeralNodeType.Key,
    vscodeName: 'keyword'},
];
const tokenTypes = new Map<string, number>();

tokenTypesLegend.forEach((v, i) => tokenTypes.set(v.nodeType, i));


const legend = (function () {
    const tokenModifiersLegend: string[] = [];

    return new vscode.SemanticTokensLegend(tokenTypesLegend.map(v => v.vscodeName), tokenModifiersLegend);
})();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "yaxm-sample" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('extension.yaxm', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('yaxm!');
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'yaxm' },
            new DocumentSemanticTokensProvider(),
            legend
        )
    );
}

interface NodeWithProbLabel {
    label?: TextNode;
}

interface NodeWithProbMacroName {
    opcode?: TextNode;
}

interface NodeWithProbHref {
    href?: string | TextNode;
}

interface NodeWithProbKeys {
    keys?: string | TextNode;
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    // onDidChangeSemanticTokens?: vscode.Event<void> | undefined;

    private getTokenId(node: Node): number | undefined {
        const mapped = tokenTypes.get(node.type as string);
        if (mapped !== undefined) {
            return mapped;
        }
        
        if ((node.parent as NodeWithProbMacroName)?.opcode === node) {
            return tokenTypes.get(EphemeralNodeType.MacroName);
        }
        if ((node.parent as NodeWithProbLabel)?.label === node) {
            return tokenTypes.get(EphemeralNodeType.Label);
        }
        if ((node.parent as NodeWithProbHref)?.href === node) {
            return tokenTypes.get(EphemeralNodeType.Href);
        }
        if (Object.values((node.parent as NodeWithProbKeys)?.keys ?? {}).includes(node)) {
            return tokenTypes.get(EphemeralNodeType.Key);
        }
    }

    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder()
        const text = document.getText();
        const lines = splitLinesWithTextPositions(text).map(v => v.str);

        const { result, diagnostic } = yaxmAst.parseFile(text, document.fileName);

        const iter = traverseNodeChildrenDeepDepth(result);
        let value = iter.next()
        while (!value.done) {
            const node = value.value.node;

            const tokenId = this.getTokenId(node)

            if (tokenId === undefined) {
                value = iter.next();
                continue;
            }

            const textStartPosition = positionToTextPosition(text, node.pos.start);
            const textEndPosition = positionToTextPosition(text, node.pos.end);

            for (let line = textStartPosition.line - 1; line < textEndPosition.line; ++line) {
                let column;
                if (line === textStartPosition.line - 1) {
                    column = textStartPosition.column - 1;
                } else {
                    column = 0;
                }

                let length;
                if (line === textEndPosition.line - 1) {
                    if (line === textStartPosition.line - 1) {
                        length = textEndPosition.column - textStartPosition.column;
                    } else {
                        length = textEndPosition.column - 1;
                    }
                } else {
                    length = lines[line].length;
                }

                // console.log(`Amon line=${line} column=${column} length=${length}`)

                builder.push(
                    line,
                    column,
                    length,
                    tokenId,
                )
            }

            value = iter.next();
        }

        const builderResult = builder.build();
        console.log('ok, built')
        return builderResult;
    }
}
