# Change Log

All notable changes to the "vscode-brautomationtools" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Add new but unreleased features, fixes... here during development

### Added
- A new notification is shown after an update of the extension. By clicking the `Show changes` button you will be redirected to the changelog on GitHub.<br/>
  If you don't like the notification you can click the `Don't show again after update` button and we will not bother you anymore.<br/>
  The setting to hide the notification can also be set in the settings menu under `vscode-brautomationtools.notifications.hideNewVersionMessage`
- The activation notification message can now be hidden by clicking the `Don't show on activation` button or in the settings under `vscode-brautomationtools.notifications.hideActivationMessage`


## [0.0.4] - 2021-12-04
This release brings a more robust IntelliSense functionality when some files or file contents are missing in the AS project.
Also the support for C++ and modern C features was enhanced.

### Fixed
- The active configuration was not set, when no LastUser.set file was in the AS project root
  This lead to a not working IntelliSense functionality
  [#24](https://github.com/br-automation-com/vscode-brautomationtools/issues/24)
- Show only warnings and do not fail whole Cpu.pkg parsing functionality when there was no Module ID or AR Version found
  [#23](https://github.com/br-automation-com/vscode-brautomationtools/issues/23)
- The C-Standard was hard coded to gnu-99 which prevented modern C and C++ features to work. The assignment was removed, as newer versions of the C/C++
  extension support automatic querying from the compiler
  [#10](https://github.com/br-automation-com/vscode-brautomationtools/issues/10)
- The default compiler argument `-ansi` lead to an error on vector initilization, e.g. `std::vector<int> v = {1, 2, 42}` (std::initializer_list).
  This argument was removed.
  [#21](https://github.com/br-automation-com/vscode-brautomationtools/issues/21)
  Further investigation of the arguments will be done in [#25](https://github.com/br-automation-com/vscode-brautomationtools/issues/25)


## [0.0.3] - 2021-11-30
This release adds support for Automation Studio Versions >= V4.9.x and new tasks to transfer to a PLC.

### Added
- Reading of the active configuration from the LastUser.set file
  Required for configuration dependent features
- Provide settings of additional includes and build defines to the C/C++ extension
  - Provide include directories defined in the Cpu.pkg file to the C/C++ extension
  - Provide compiler switches (e.g. -D defines) defined in the Cpu.pkg file to the C/C++ extension
- Improved logging and notifications
  - New setting logging.logLevel
- Support for Automation Studio Versions >= V4.9.x
- Provide tasks to transfer the Automation Studio project using PVITransfer.exe
  - New setting `vscode-brautomationtools.environment.pviInstallPaths` to find PVITransfer.exe

### Fixed
- No output was generated for build and transfer tasks anymore

### Changed
- The structure of the readme file was changed and new features are documented
- The extension is now published in a bundled form, which reduces the load time
- Parsing of folder names to AS version due to support for AS V4.10.x

  The folder name in the installation directory for AS V4.10 is AS410.
  Until now this would be parsed as V4.1.0. From this version on it will be parsed as V4.10.

  This change leads to the restriction, that older pre-release AS versions cannot be used anymore. AS V4.3.3 pre-release e.g. was stored in the folder AS433 which will now be parsed as AS V4.33 instead of AS V4.3.3.


## [0.0.2] - 2020-06-19
This release contains only documentation changes.

### Added
- Description of features, settings...

## [0.0.1] - 2020-06-18
This is the first released version of the vscode-brautomationtools extension.

### Added
- Build B&R Automation Studio projects
- Show errors and warnings of Automation Studio build
- Basic auto completion for C/C++ programs and libraries
- Detecting installed B&R Automation Studio versions
- Detecting B&R Automation Studio projects in the workspace folders