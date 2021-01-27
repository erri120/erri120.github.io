---
title: Image Steganography in Koikatsu! and AI Shoujo
date: 2021-01-27 10:08:08
categories:
  - Game Development
  - Random Stuff
tags:
  - Koikatsu!/コイカツ！
  - AI Shoujo/AI 少女
---

Image Steganography is nothing new or groundbreaking, steganography has been around since [440 BC](https://en.wikipedia.org/wiki/Steganography#History) and digital steganography started appearing once personal computers became a thing. This post is about the method used in games by [イリュージョン](http://www.illusion.jp/) (Illusion) like コイカツ！ (Koikatsu!) or AI 少女 (AI Shoujo).

## Character Presets in Illusion Games

In most Illusion Games you have an extensive editor for designing the appearance of your character or of characters that are later found in the game world. The preset is stored as a PNG like this one:

![mona-preset](Mona.png)

Opening this image in a hex editor like [HxD](https://mh-nexus.de/en/hxd/) you will find your normal PNG data but at the end of the file after the end-marker `IEND` you have the actual preset data:

![preset-in-hxd](preset-in-hxd.png)

## Why this works

The reason this works is because the PNG file format has a clear structure with indicators for start and end:

[![wikipedia-png-structure](wikipedia-png-structure.png)](https://en.wikipedia.org/wiki/Portable_Network_Graphics#Examples)

A PNG parser will never read beyond `IEND` so the preset data won't be read. You could also use JPEG for this because it also has an End Of Image (EOI) marker (`0xFF`, `0xD9`) and append the preset at the end:

![mona-preset-jpeg](Mona.jpg)

![jpeg-preset-in-hxd](jpeg-preset-in-hxd.png)

## Conclusion

While it might seem very trivial and gimmicky at first, it has been implemented across multiple games and editors and provides a very easy way to share presets with others. Not only can you share character presets in Illusion games, you can also share entire scenes, outfits, textures, materials and more with this method. The community discord for those games is has very active share channels where you simply upload the png and be done with it. No need for an external site or additional files because everything is hidden in the image.
