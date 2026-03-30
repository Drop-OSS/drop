#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Bash script to update version for native_model_macro

# Semantic release version obtained from argument
NEW_VERSION=$1

# Exit if NEW_VERSION is not set
if [ -z "$NEW_VERSION" ]; then
  echo "NEW_VERSION argument not set"
  exit 1
fi

# Directories containing Cargo.toml files to update
declare -a directories=("." "native_model_macro")

for directory in "${directories[@]}"
do
  # Check if Cargo.toml exists in the directory
  if [ -f "$directory/Cargo.toml" ]; then
    echo "Updating version in $directory/Cargo.toml to $NEW_VERSION"
    # Use sed to find and replace the version string
    sed -i -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$NEW_VERSION\"/g" "$directory/Cargo.toml"

    # Update the dependency version for native_model_macro in native_model_macro's Cargo.toml
    if [ "$directory" == "." ]; then
      sed -i -E "s/native_model_macro = \{ version = \"[0-9]+\.[0-9]+\.[0-9]+\", path = \"native_model_macro\" \}/native_model_macro = { version = \"$NEW_VERSION\", path = \"native_model_macro\" }/g" "$directory/Cargo.toml"
    fi
  fi
done


cd "$DIR/"

# Commit
git commit --all --message "chore: update version to $NEW_VERSION"
git push