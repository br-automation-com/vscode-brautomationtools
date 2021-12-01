# Change Log

All notable changes to the "vscode-brautomationtools" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Add new but unreleased features, fixes... here during development

### Fixed
- The active configuration was not set, when no LastUser.set file was in the AS project root
  This lead to a not working IntelliSense functionality [#24](https://github.com/br-automation-com/vscode-brautomationtools/issues/24)

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