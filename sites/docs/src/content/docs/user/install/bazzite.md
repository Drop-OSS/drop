---
title: Bazzite
---

To install the client app, you will need to use distrobox which allows
us to install packages from other distributions inside a container.

The first thing you'll need to do is open a terminal application.
In the terminal, you need to create a distrobox container.
This container will be created using the archlinux image.

```bash
# Create the distrobox container called drop-app
distrobox create --image archlinux drop-app
distrobox enter drop-app
```

It will take a few seconds to prepare the container.
Once ready, you need to install the `yay` package manager to be able to install packages from the [AUR](https://aur.archlinux.org/).

```bash
# This enables the multilib repository which is needed to install umu-launcher and drop-app
sudo sh -c 'printf "\n\n[multilib]\nInclude = /etc/pacman.d/mirrorlist\n" >> /etc/pacman.conf'
# Updates repositories and system
sudo pacman -Syu --noconfirm
sudo pacman -S --needed --noconfirm base-devel git
git clone https://aur.archlinux.org/yay.git
cd yay
# This will build and install yay
makepkg -si --noconfirm
# We can now delete the yay folder
cd .. && rm -rf ./yay
```

Next, you can install dependencies:

```bash
yay -S --noconfirm gnu-free-fonts
```

Then you will need to install a vulkan driver.
If you are using an Intel GPU, you can run:

```bash
yay -S --noconfirm lib32-vulkan-intel
```

If you are using an AMD GPU, you can run:

```bash
yay -S --noconfirm lib32-vulkan-radeon
```

Then you can install drop-app:

```bash
yay -S --noconfirm drop-oss-app-bin
```

```bash
distrobox-export --app drop-app
# Go back to Bazzite
exit
```

The drop-app application should be appear in your application menu.

## Update drop-app

In the terminal, you need to enter the drop-app container and update system packages within in.

```bash
distrobox enter drop-app
yay
exit
```

## Uninstall the drop-app client

The following command will delete the distrobox container and delete the drop-app application from your system.

```bash
distrobox rm drop-app --force
```
