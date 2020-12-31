---
title: Creating a GitHub Actions Release Pipeline for .NET Core 3.1/.NET 5
date: 2020-12-19 17:11:31
categories:
  - GitHub Actions
  - Release Pipelines
tags:
  - GitHub Actions
  - Release Pipelines
  - .NET
  - .NET Core 3.1
  - .NET 5
---

GitHub Actions Release Workflows can be very tricky to set up and require a lot of experimenting to get right. Your project will also likely have something unique about it which means you need a workflow that is tailored to your project. This being said, the workflow we will set up, builds a .NET Core project for multiple runtimes (Linux and Windows for multiple architectures), compresses all of the builds into zip files and then creates a new GitHub Release with a changelog.

## Step by Step

Before we begin I want to encourage you to create a test repository with some dummy projects before implementing this in your actual repository. Using a test repo will keep your commit log clean and makes the entire process easier and faster as you don't have to wait for your massive project to build.

Now that you have created a dummy repository, head over to the Actions tab and create a new blank workflow.

### Trigger

There are multiple different triggers that you can use (see [GitHub Actions Reference](https://docs.github.com/en/free-pro-team@latest/actions/reference/events-that-trigger-workflows)) but we want to use the `push` trigger, specifically the push trigger for tags:

```yaml
name: Create Release

on:
  push:
    tags:
      - 'v*'
```

`on push` would normally run whenever we push a commit to the repository but we can specify a filter so that we only trigger this workflow when we push a tag that starts with `v`. You can create and push a tag locally with git using `git tag <tag_name>` and then `git push origin --tags`. Alternatively you can also create a GitHub Release manually which will create a tag for you.

### Environment Variables

I recommend using environment variables for stuff like SDK Version or configuration, this makes the workflow very easy to configure further down the line and easy to copy and paste into different repositories without having to change a ton of lines.

```yaml
env:
  PROJECT_FOLDER: FunWithGithubActions
  PROJECT_FILE: FunWithGithubActions/FunWithGithubActions.csproj
  PROJECT_PREFIX: "Fun With GitHub Actions"
  DOTNET_SDK_VERSION: "3.1.x"
  FRAMEWORK: netcoreapp3.1
  CONFIGURATION: Release
```

Here we want SDK `3.1.x` because the project uses `netcoreapp3.1`. If you are targeting `net5` then you want `DOTNET_SDK_VERSION: "5.0.x"`.

### Checkout and SDK Setup

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup .NET Core
        uses: actions/setup-dotnet@v1
        with:
          dotnet-version: ${{ env.DOTNET_SDK_VERSION }}

      - name: Verify .NET Core
        run: dotnet --info
```

Nothing special here, we are just doing a checkout and setting up .NET for the specific SDK Version. You could skip the verification of .NET but this is just to be 100% sure it installed correctly and if something goes wrong then we can always check the log file and see the exact information about the installed .NET SDK.

I recommend using `ubuntu-latest` instead of `windows-latest` because everything from setting up the SDK to building and even testing is faster on Ubuntu than on Windows.

### Building for multiple Runtimes

The main problem with targeting multiple runtimes when dealing with release workflows is figuring out a way to not repeat yourself. Since we want to do the same thing (`dotnet restore`, `dotnet publish` and then compressing) for every runtime we can just use a simple bash script that goes over an array of runtimes:

```yaml
- name: Building
  env:
    VARIANTS: linux-arm linux-arm64 linux-x64 win-x64 win-x86
  shell: bash
  run: |
    set -eu

    publish() {
      #TODO
    }

    for variant in $VARIANTS; do
        publish "$variant"
    done
```

The general idea is to have an array of Runtimes in the Environment Variable `VARIANTS` of the step so we can loop over all the variants and call `publish` on each one.

In publish we will restore the dependencies using `dotnet restore` and then use `dotnet publish` to publish the project to a folder:

```bash
publish() {
  echo "Building for runtime ${1}"
  rm -rf "${PROJECT_FOLDER}/bin"
  rm -rf "${PROJECT_FOLDER}/obj"
  dotnet restore "${PROJECT_FILE}" -r "${1}"
  dotnet publish "${PROJECT_FILE}" -c "${CONFIGURATION}" -f "${FRAMEWORK}" -o "out/${1}" -r "${1}" -p:PublishSingleFile=true -p:PublishTrimmed=true --no-restore
}
```

You can see that we make heavy use of the environment variables we previously declared which keeps this code clean and reuseable. Going over some arguments for the `dotnet` commands, we supply the path the project, set the configuration and framework and publish the project for runtime `-r "${1}"` to the folder `-o "out/${1}"`. The arguments `-p:PublishSingleFile=true` and `-p:PublishTrimmed=true` are optional, I recommend reading up on those in the docs: [dotnet publish](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-publish) and deciding if you want to use them or not. The `--no-restore` makes sure that `dotnet publish` does not restore the dependencies. I added an explicit `dotnet restore` call before because `dotnet publish` did not successfully restore all dependencies.

Since we build the project multiple times, I recommend cleaning up the output directory before each build. I have run into some issues before when building for different runtimes without cleaning the output directory so a simple command will prevent that from happening again.

The remaining step to do in our script is compressing the files to an archive using `7z` or `zip`, depending on what is available:

```bash
if command -v 7z >/dev/null; then
    7z a -bd -slp -tzip -mm=Deflate -mx=1 "out/${PROJECT_PREFIX}-${1}.zip" "${GITHUB_WORKSPACE}/out/${1}/*"
elif command -v zip >/dev/null; then
    (
        cd "${GITHUB_WORKSPACE}/out/${1}"
        zip -1 -q -r "../${PROJECT_PREFIX}-${1}.zip" .
    )
else
    echo "ERROR: No supported zip tool!"
    return 1
fi
```

With this our little bash script is complete:

```bash
set -eu

publish() {
  echo "Building for runtime ${1}"
  rm -rf "${PROJECT_FOLDER}/bin"
  rm -rf "${PROJECT_FOLDER}/obj"
  dotnet restore "${PROJECT_FILE}" -r "${1}"
  dotnet publish "${PROJECT_FILE}" -c "${CONFIGURATION}" -f "${FRAMEWORK}" -o "out/${1}" -r "${1}" -p:PublishSingleFile=true -p:PublishTrimmed=true --no-restore

  if command -v 7z >/dev/null; then
      7z a -bd -slp -tzip -mm=Deflate -mx=1 "out/${PROJECT_PREFIX}-${1}.zip" "${GITHUB_WORKSPACE}/out/${1}/*"
  elif command -v zip >/dev/null; then
      (
          cd "${GITHUB_WORKSPACE}/out/${1}"
          zip -1 -q -r "../${PROJECT_PREFIX}-${1}.zip" .
      )
  else
      echo "ERROR: No supported zip tool!"
      return 1
  fi
}

for variant in $VARIANTS; do
    publish "$variant"
done
```

### Changelog and Versioning

The reason we are doing all of this is because we are lazy and don't want to do tedious and repetitive tasks. Following this trend we are going to use [Changelog Reader](https://github.com/mindsers/changelog-reader-action) to read the Changelog from our Changelog file and use it in our GitHub Release.

**This action only works if your Changelog file follows the [Keep a Changelog](https://github.com/olivierlacan/keep-a-changelog) standard.**

This means your `CHANGELOG.md` should look something like this (see [Keep a Changelog](https://github.com/olivierlacan/keep-a-changelog) for more information):

```markdown
# Changelog

## [Unreleased]

## [1.0.0] - 2020-12-19

### Added

- Added something

### Fixed

- Fixed something
```

[Unreleased]: https://github.com/erri120/fun-with-github-actions/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/erri120/fun-with-github-actions/releases/tag/v1.0.0

#### Getting the Current Version

Lets start by getting the current version with another simple bash script:

```yaml
- name: Get version from tag
  id: tag_name
  shell: bash
  run: |
    echo ::set-output name=current_version::${GITHUB_REF#refs/tags/v}
```

You can get the output of a step in GitHub Actions using `${{ steps.<step id>.outputs }}` (see [GitHub Actions Reference](https://docs.github.com/en/free-pro-team@latest/actions/reference/context-and-expression-syntax-for-github-actions#steps-context)) and we can set the output in a bash script with `echo ::set-output`.

#### Setting the Project Version

Now that we have the current Version of the Release we can actually forward it to `dotnet publish` by adding `PUBLISH_VERSION: ${{ steps.tag_name.outputs.current_version }}` to the `Building` job Environment Variables and adding `-p:Version="${PUBLISH_VERSION}"` to `dotnet publish`:

```yaml
- name: Building
  env:
    VARIANTS: linux-arm linux-arm64 linux-x64 win-x64 win-x86
    PUBLISH_VERSION: ${{ steps.tag_name.outputs.current_version }}
  shell: bash
  run: |
      #...
      dotnet publish "${PROJECT_FILE}" -c "${CONFIGURATION}" -f "${FRAMEWORK}" -o "out/${1}" -r "${1}" -p:PublishSingleFile=true -p:PublishTrimmed=true -p:Version="${PUBLISH_VERSION}" --no-restore
      #...
```

Forwarding the Version with `-p:Version` will set the [`FileVersion`](https://docs.microsoft.com/en-us/dotnet/api/system.diagnostics.fileversioninfo.fileversion?view=net-5.0) and [`ProductVersion`](https://docs.microsoft.com/en-us/dotnet/api/system.diagnostics.fileversioninfo.productversion?view=net-5.0) of the output executable so we don't have to spend a commit on version bumping.

#### Getting the current Changelog

```yaml
- name: Get Changelog Entry
  id: changelog_reader
  uses: mindsers/changelog-reader-action@v2
  with:
    version: ${{ steps.tag_name.outputs.current_version }}
    path: ./CHANGELOG.md
```

We are again using the output of our little bash script to get the Changelog. This action also has some outputs we will later use when creating the release.

### Creating a Release

Now we are finally ready to create a new GitHub Release using the [`create-release`](https://github.com/actions/create-release) action.

```yaml
- name: Create Release
  id: create_release
  uses: actions/create-release@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # This token is provided by Actions, you do not need to create your own token
  with:
    tag_name: v${{ steps.changelog_reader.outputs.version }}
    release_name: Release ${{ steps.changelog_reader.outputs.version }}
    body: ${{ steps.changelog_reader.outputs.changes }}
    draft: ${{ steps.changelog_reader.outputs.status == 'unreleased' }}
    prerelease: ${{ steps.changelog_reader.outputs.status == 'prereleased' }}
```

As you can see, we are only using variables for this action as everything is provided by the `changelog_reader` step.

### Uploading Files

I hope you didn't forget about this step. We created a release and can use the `upload_url` output to upload our archives to GitHub:

```yaml
- name: Upload Release Assets
  id: upload_release_assets
  uses: NBTX/upload-release-assets@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    upload_url: ${{ steps.create_release.outputs.upload_url }}
    targets: "out/${{ env.PROJECT_PREFIX }}-*.*"
```

I'm using [NBTX/upload-release-assets](https://github.com/NBTX/upload-release-assets) instead of [upload-release-asset](https://github.com/actions/upload-release-asset) because it uses glob matching to upload multiple files instead of just one.

## Complete File

You can view the entire [`release.yml`](https://github.com/erri120/fun-with-github-actions/blob/master/.github/workflows/release.yml) file on my [Fun with GitHub Actions](https://github.com/erri120/fun-with-github-actions) repository or below.

{% github_include erri120/fun-with-github-actions/master/.github/workflows/release.yml yaml %}
