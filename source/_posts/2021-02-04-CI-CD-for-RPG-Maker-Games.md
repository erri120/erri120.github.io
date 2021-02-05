---
title: CI/CD for RPG Maker Game Development
date: 2021-02-04 15:41:07
categories:
  - Game Development
tags:
  - Continuous Integration
  - Continuous Deployment
  - Continuous Delivery
  - CI/CD
  - RPG Maker
---

"Continuous Integration and Deployment/Delivery is awesome" is what you will hear most of the time from programmers (who didn't have to set it up themselves) when talking about CI/CD. In programming we have tons of tools that help us automate tedious tasks so we can focus on actual programming which is why I am let down by multiple game engines when you can't automate the build. This post will focus on RPG Maker (MV/MZ only) and how you can build your game for multiple platforms in a pipeline using [RPGMPacker](https://github.com/erri120/rpgmpacker).

## CI/CD for non-programmers

Before we go and talk about the pipeline I want to briefly explain CI/CD for non-programmers as I know a ton of Game Developers who focus on Art and Story instead of Programming. That being said, I still expect you to know about version control with git so make sure you watched the two amazing videos by [Fireship](https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA): [Git in 100 Seconds](https://www.youtube.com/watch?v=hwP7WQkmECE) and [How to use Git and GitHub](https://www.youtube.com/watch?v=HkdAHXoRtos).

Continuous Integration means running a pipeline on every change you commit to a repository. This pipeline consists of one or multiple jobs where one job could be running some tests or building the project. If you run the tests on every change you can easily track down the commit where a bug was introduced to the project. A common pipeline would be the following:

1) setup (checkout, getting all tools)
2) running tests
3) building the project
4) packaging
5) uploading a build artifact (fancy word for an archive containing the packaged project)

Continuous Delivery on the other hand has a workflow that _delivers_ the produced artifact from CI and sends it off to testers, friends, QA team or your mom. Do note that Continuous **Deployment** is also a thing and means actually deploying the artifact to the end user, eg uploading the next release of a software or game. Deployment mostly comes after delivery so you can first send the artifact to your test team and when they say everything is fine, you deploy it.

The aforementioned pipelines can be something like a simple bash or powershell script, a [Gruntfile](https://gruntjs.com/), a [GitHub Actions workflow](https://github.com/features/actions) or some [Azure DevOps Pipeline](https://dev.azure.com/).

## Release Pipeline for RPG Maker

Know that we know why CI/CD is awesome, let's talk about how to apply it to your RPG Maker Game development process:

RPG Maker is a very _simple_ game engine that doesn't require any programming skills. It also doesn't have any compilation and uses a simple copy paste method for deploying your game. The pipeline we are going to build does the following:

1) setup (get all tools)
2) run [RPGMPacker](https://github.com/erri120/rpgmpacker)
3) zip the output
4) upload the output to itch.io using [Butler](https://itch.io/docs/butler/)

This is, as you can see, very simple but will save you tons of time and mental health (there is nothing more annoying than uploading a broken build and having to re-upload the fixed version by hand). We will create a local script for this because I assume you don't have a GitHub, GitLab or Azure DevOps repository for your game. If you do have one then you should be able to adapt the code used to the pipeline system of your choice.

### Setup

Let's start by creating a new file called `pipeline.sh`. This will be a bash script that can be executed on all platforms, even on Windows using Git Bash. The first thing we need is getting the tools. We can download files using programs such as `curl` or `wget`:

```bash
curl -L -o butler.zip https://broth.itch.ovh/butler/windows-amd64/LATEST/archive/default
```

This would download Butler to `butler.zip`. I want to make this a bit more generic because the link above would only get us the latest Windows x64 version but you might be on a Mac or on Linux and then you can't use this so let's introduce some variables:

```bash
#see https://broth.itch.ovh/butler
butlerChannel="windows-amd64" #darwin-amd64 for Mac and linux-amd64 for Linux
butlerVersion="15.20.0"

curl -L -o butler.zip https://broth.itch.ovh/butler/$butlerChannel/$butlerVersion/archive/default
```

You can go to [this link](https://broth.itch.ovh/butler) to find what platforms and version are available, if you are on a Mac then you want `butlerChannel="darwin-amd64"` and if you are on Linux `linux-amd64`. Now we want to extract the archive which we can do with `unzip`:

```bash
unzip -o butler.zip
```

This will extract all files in the `butler.zip` archive to the current directory which does not really look nice so let's create a downloads and tools folder:

```bash
tools="./tools"

mkdir $tools/downloads -p
mkdir $tools/butler -p

curl -L -o $tools/downloads/butler.zip https://broth.itch.ovh/butler/$butlerChannel/$butlerVersion/archive/default
unzip -o $tools/downloads/butler.zip -d $tools/butler
```

We are again using a variable for the tools folder location, we create the download and Butler directory using `mkdir` with the `-p` flag, so it doesn't complain about the folder already existing, and then download and extract Butler to the new folders.

If you follow this guide step by step and run the script multiple times you will notice that we download and extract Butler every single time. To circumvent this we can simply check if we already extracted the archive and skip download and extraction if we did:

```bash
if [ ! -d "$tools/butler/$butlerVersion" ]; then
    curl -L -o $tools/downloads/butler.zip https://broth.itch.ovh/butler/$butlerChannel/$butlerVersion/archive/default
    unzip -o $tools/downloads/butler.zip -d $tools/butler/$butlerVersion
else
    echo "Butler version $butlerVersion ($butlerChannel) already downloaded"
fi
```

If statements in bash are a bit weird but we are simply checking if the folder at `$tools/butler/$butlerVersion` does not exist (notice the use of `$butlerVersion` so we can increase the version number and it will download the new version) and then download if that is the case. One thing we have to do is make sure is that we can actually execute the file:

```bash
butlerFile="butler" #butler.exe on Windows

chmod +x $tools/butler/$butlerVersion/$butlerFile #only for Linux
```

`chmod +x` changes the file permission to be executable but this is only needed if you are on Linux.

Getting RPGMPacker is basically the same process except we don't have to extract any archive because we can just download the executable:

```bash
#see https://github.com/erri120/rpgmpacker/releases
rpgmpackerFile="RPGMPacker-Windows.exe" #RPGMPacker-Linux for Linux
rpgmpackerVersion="1.0.0"

mkdir $tools/RPGMPacker -p

if [ ! -d "$tools/RPGMPacker/$rpgmpackerVersion" ]; then
    curl -L -o $tools/downloads/$rpgmpackerFile https://github.com/erri120/rpgmpacker/releases/download/v$rpgmpackerVersion/$rpgmpackerFile
    mkdir $tools/RPGMPacker/$rpgmpackerVersion -p
    cp $tools/downloads/$rpgmpackerFile $tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile
    #chmod +x $tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile
else
    echo "RPGMPacker version $rpgmpackerVersion ($rpgmpackerFile) already downloaded"
fi
```

Notice that we are again declaring the version and what file we want to download (see [RPGMPacker Releases](https://github.com/erri120/rpgmpacker/releases) and use either `rpgmpackerFile="RPMGPacker-Linux"` or `RPMGPacker-Windows.exe`), checking if the directory exists and downloading the file if it doesn't.

Now we have the tools we need at the following locations:

```bash
butler="$tools/butler/$butlerVersion/$butlerFile"
rpgmpacker="$tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile"
```

Entire script up to this point:

```bash
tools="./tools"

#see https://broth.itch.ovh/butler
butlerChannel="windows-amd64" #darwin-amd64 for Mac and linux-amd64 for Linux
butlerVersion="15.20.0"
butlerFile="butler.exe" #butler for Mac or Linux
#see https://github.com/erri120/rpgmpacker/releases
rpgmpackerFile="RPGMPacker-Windows.exe" #RPGMPacker-Linux for Linux
rpgmpackerVersion="1.0.0"

mkdir $tools/downloads -p

mkdir $tools/butler -p

if [ ! -d "$tools/butler/$butlerVersion" ]; then
    curl -L -o $tools/downloads/butler.zip https://broth.itch.ovh/butler/$butlerChannel/$butlerVersion/archive/default
    unzip -o $tools/downloads/butler.zip -d $tools/butler/$butlerVersion
    #chmod +x $tools/butler/$butlerVersion/$butlerFile
else
    echo "Butler version $butlerVersion ($butlerChannel) already downloaded"
fi

mkdir $tools/RPGMPacker -p

if [ ! -d "$tools/RPGMPacker/$rpgmpackerVersion" ]; then
    curl -L -o $tools/downloads/$rpgmpackerFile https://github.com/erri120/rpgmpacker/releases/download/v$rpgmpackerVersion/$rpgmpackerFile
    mkdir $tools/RPGMPacker/$rpgmpackerVersion -p
    cp $tools/downloads/$rpgmpackerFile $tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile
    #chmod +x $tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile
else
    echo "RPGMPacker version $rpgmpackerVersion ($rpgmpackerFile) already downloaded"
fi

butler="$tools/butler/$butlerVersion/$butlerFile"
rpgmpacker="$tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile"
```

### Deploying with RPGMPacker

[RPGMPacker](https://github.com/erri120/rpgmpacker) is a simple CLI tool for quickly deploying an RPG Maker Game for multiple platforms. It requires some parameters that we define with variables:

```bash
input="./Project1"
output="./build"
rpgmaker="M:\SteamLibrary\steamapps\common\RPG Maker MV"

#see https://github.com/erri120/rpgmpacker#Usage for all possible arguments
platforms="win,linux"
encryptImages="true"
encryptAudio="true"
encryptionKey="1337"
hardlinks="true"
cache="true"
```

You should check the [GitHub README](https://github.com/erri120/rpgmpacker#Usage) for all possible arguments and change the variables depending on what you need (don't forget to change the `input`, `output` and `rpgmaker` paths!). Now we only need to pass those variables to the program:

```bash
mkdir $output -p

./$rpgmpacker -i $input -o $output --rpgmaker="$rpgmaker" --platforms="$platforms" --encryptImages=$encryptImages --encryptAudio=$encryptAudio --encryptionKey="$encryptionKey" --hardlinks=$hardlinks --cache=$cache
```

### Zipping

After RPGMPacker ran, the builds can be found in the output directory where each folder is one platform you specified:

```txt
./output
./output/Windows
./output/Linux
```

This means we can simply loop through all top-level directories in the output folder and zip them:

```bash
for platform in $output/*; do
    if command -v 7z >/dev/null; then
        7z a -tzip -o$output $platform.zip $platform/*
    else
        echo "7z not found!"
        break
    fi
done
```

This is a simple foreach loop in bash where we check if 7z is installed and then zip the folder to `$output/$platform.zip`. Do note that you need to add the 7z installation folder to the PATH environment variable if you are on Windows. You can find a guide on how to do it [here](https://stackoverflow.com/a/44272417) (the default 7z folder is `C:\Program Files\7-Zip`). The 7z CLI options are a bit whack so let's break them down:

```bash
7z              # program name
  a             # command, a = add files to archive
  -tzip         # set archive type, and yes you can't have a space between "-t" and "zip"
  -o$output     # set the output directory, same as "-t": no space
  $platform.zip # output file name
  $platform/*   # files to compress, the * means everything
```

### Uploading to itch.io using Butler

This step simply showcases what you can do with the final build archive. If your game is not on itch.io or you want to upload it somewhere else then you can replace or skip this step.

Butler requires an API key that you can get [here](https://itch.io/user/settings/api-keys). Butler will normally request the API key via an input prompt but we can also just set an environment variable:

```bash
export BUTLER_API_KEY="your-key"

./$butler login
```

This should log us in and we can now use `butler push` to push our builds:

```bash
butlerProject="erri120/testing"

./$butler push $output/Windows.zip $butlerProject:windows-beta
./$butler push $output/Linux.zip $butlerProject:linux-beta
```

Butler also supports setting the version of the build using `--userversion` so let's just take the version number from a variable:

```bash
version="1.0.0"
```

If you don't want to manually change this you can also pass the version number as an argument when executing the script:

```bash
version=$1
```

The `$1` means it's the first argument after the script name: `some-script.sh $1 $2 $3 $4 ... $n`. This means you have to use the command `./pipeline.sh x.y.z` to start the pipeline so you can pass the version number to the script. Since we now have a version number we can also include it in the build name:

```bash
# Zipping files

for platform in $output/*; do
    if command -v 7z >/dev/null; then
        7z a -tzip -o$output $platform-$version.zip $platform/*
    else
        echo "7z not found!"
        break
    fi
done

# Uploading to itch.io using Butler

./$butler login
./$butler push $output/Windows-$version.zip $butlerProject:windows-beta --userversion $version
./$butler push $output/Linux-$version.zip $butlerProject:linux-beta --userversion $version
```

## Conclusion

This is the end of my little guide on creating a simple build pipeline in bash that will help you speed up your deployment process. Since this was also an introduction to bash scripting itself, you should be able to modify the script to further suit your needs because every project has something unique about it and there is no "One Pipeline to rule them all".

If you have any issues with RPGMPacker itself, create an [Issue on GitHub](https://github.com/erri120/rpgmpacker) so I can see and fix it.

## Final Script

```bash
#-Variables
#$1 is the first argument, this can be replaced with a static version number
version=$1

#--Directories
input="./Project1"
output="./build"
tools="./tools"
rpgmaker="M:\SteamLibrary\steamapps\common\RPG Maker MV"

#--Versions
#see https://broth.itch.ovh/butler
butlerChannel="windows-amd64" #darwin-amd64 for Mac and linux-amd64 for Linux
butlerVersion="15.20.0"
butlerFile="butler.exe" #butler for Mac or Linux
#see https://github.com/erri120/rpgmpacker/releases
rpgmpackerFile="RPGMPacker-Windows.exe" #RPGMPacker-Linux for Linux
rpgmpackerVersion="1.0.0"

#--RPGMPacker Variables
#see https://github.com/erri120/rpgmpacker#Usage for all possible arguments
platforms="win,linux"
encryptImages="true"
encryptAudio="true"
encryptionKey="1337"
hardlinks="true"
cache="true"

#--Butler Variables
export BUTLER_API_KEY="your-key"
butlerProject="erri120/testing"

#-Tools
mkdir $tools/downloads -p

#--Butler
mkdir $tools/butler -p

if [ ! -d "$tools/butler/$butlerVersion" ]; then
    curl -L -o $tools/downloads/butler.zip https://broth.itch.ovh/butler/$butlerChannel/$butlerVersion/archive/default
    unzip -o $tools/downloads/butler.zip -d $tools/butler/$butlerVersion
    #chmod +x $tools/butler/$butlerVersion/$butlerFile
else
    echo "Butler version $butlerVersion ($butlerChannel) already downloaded"
fi

#--RPGMPacker
mkdir $tools/RPGMPacker -p

if [ ! -d "$tools/RPGMPacker/$rpgmpackerVersion" ]; then
    curl -L -o $tools/downloads/$rpgmpackerFile https://github.com/erri120/rpgmpacker/releases/download/v$rpgmpackerVersion/$rpgmpackerFile
    mkdir $tools/RPGMPacker/$rpgmpackerVersion -p
    cp $tools/downloads/$rpgmpackerFile $tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile
    #chmod +x $tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile
else
    echo "RPGMPacker version $rpgmpackerVersion ($rpgmpackerFile) already downloaded"
fi

butler="$tools/butler/$butlerVersion/$butlerFile"
rpgmpacker="$tools/RPGMPacker/$rpgmpackerVersion/$rpgmpackerFile"

# Deployment using RPGMPacker

mkdir $output -p

./$rpgmpacker -i $input -o $output --rpgmaker="$rpgmaker" --platforms="$platforms" --encryptImages=$encryptImages --encryptAudio=$encryptAudio --encryptionKey="$encryptionKey" --hardlinks=$hardlinks --cache=$cache

# Zipping files

for platform in $output/*; do
    if command -v 7z >/dev/null; then
        7z a -tzip -o$output $platform-$version.zip $platform/*
    else
        echo "7z not found!"
        break
    fi
done

# Uploading to itch.io using Butler

./$butler login
./$butler push $output/Windows-$version.zip $butlerProject:windows-beta --userversion $version
./$butler push $output/Linux-$version.zip $butlerProject:linux-beta --userversion $version
```
