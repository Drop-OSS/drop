---
title: Arch Linux
---

To install the client application on your system, you will need to be able to install packages from the [AUR](https://aur.archlinux.org/). This is usually done using `yay` or `paru` package managers. These extend the default package manager `pacman` with the ability to download and install packages from the AUR. If you do not have one installed, you can [install yay](https://github.com/Jguer/yay).

## Installing drop-app

```bash
yay -S drop-oss-app-bin
```

## Updating drop-app

To update drop-app, run `yay`. If an update is available, `yay` will prompt you to update it.

## Uninstalling drop-app

```bash
yay -R drop-oss-app-bin
```
