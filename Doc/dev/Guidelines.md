# Release procedure

1. Adjust version in package.json
   - run npm install to also update package-lock.json
2. Adjust CHANGELOG
   - Create new header for version `## [x.y.z]`
   - Move all changes listed under `## [Unreleased]` to the new version header
3. Adjust README
   - Write a description for new / changed functionality
4. Commit changes
5. Create a git tag `git tag -a vx.y.z`
6. Create a VSIX package
   - Use `vsce package` in the terminal
   - Or run the `Create VSIX package` task
   - See also: [_Publishing Extensions_](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions)
7. Add data to the [_GitHub release_](https://github.com/br-automation-com/vscode-brAutomationTools/releases)
   - Add text of this version from CHANGELOG
   - Add created VSIX package as binary file

# Guidelines for documentation

## Links

| Target           | Style   | Sample                             |
|------------------|---------|------------------------------------|
| In same document | Regular | [Ideas](#sources-for-ideas)        |
| External in web  | Cursive | [_Google_](https://www.google.com) |

## Sources for ideas

Following links contain information for nice markdown or are nice markdown files ;)

*  [_GitLens README_](https://github.com/eamodio/vscode-gitlens/blob/master/README.md)

## TODOs in documentation

### README
*  Use animations (GIF) in description of tasks (should be short and focused)
   *  One animation for direct execution of provided tasks
   *  One animation for configuration with the gear icon

--------------------------------------------------------------

# Working with Markdown

**Note:** You can author your README using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux)
* Toggle preview (`Shift+CMD+V` on macOS or `Shift+Ctrl+V` on Windows and Linux)
* Press `Ctrl+Space` (Windows, Linux) or `Cmd+Space` (macOS) to see a list of Markdown snippets

### For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
