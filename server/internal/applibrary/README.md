# Library Format

Drop uses a filesystem-based library format, as it targets homelabs and not enterprise-grade solutions. The format works as follows:

## /{game name}

The game name is only used for initial matching, and doesn't affect actual metadata. Metadata is linked to the game's database entry, which is linked to it's filesystem name (they, however, can be completely different).

## /{game name}/{version name}

The version name can be anything. Versions have to manually imported within the web UI. There, you can change the order of the updates and mark them as deltas. Delta updates apply files over the previous versions. 