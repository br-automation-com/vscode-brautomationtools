# Change Log

All notable changes to the "vscode-brautomationtools" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
Add new but unreleased features, fixes... here during development
- Read active configuration from the LastUser.set file
- Provide include directories defined in the Cpu.pkg file to the C/C++ extension
- Provide compiler switches (e.g. -D defines) defined in the Cpu.pkg file to the C/C++ extension
- Provide tasks to transfer the AS project
- New setting `vscode-brautomationtools.environment.pviInstallPaths` to find PVITransfer.exe
- Support for AS Versions >= V4.9.x
  - New sub directories in gcc installation were introduced with AS V4.9. These subdirectories are now considered when searching for a gcc installation.
  - The folder name in the installation directory for AS V4.10 is AS410.
    Until now this would be parsed as V4.1.0. From this version on it will be parsed as V4.10.

    This change leads to the restriction, that older pre-release AS versions cannot be used anymore. AS V4.3.3 pre-release e.g. was stored in the folder AS433 which will now be parsed as AS V4.33 instead of AS V4.3.3.
    
    Maybe a more robust solution than parsing directory names can be found in the future.

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