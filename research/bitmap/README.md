Exported a `.dfont` with 9 glyphs via FontForge with 15, 25 and 50 sizes. The worst thing about it is that every file must be explored via font app, without preview available.

- 562-565 and 570-571, the glyphs are empty...
- few files from 589, the glyphs disappear from time to time
- 597 - numbers messed up! 600-601 - glyphs messed up!

But these were just replacements. Here some glyph changed finally:
- starting 2046 - 0
- 2058-2064 - 1
- 2065-2075 - 2
- ...
- and so on till 2142!

Another attempt for the same font, 8 px:
- 0 starts glitching from 2044.
- the latest glytch (for c) is noted on 2114.

- Bytes in 1st font before 2046: 00 02 00 00 09 04 00 09 04 F9 99 99 99 F0 01 01 00 01 04 00 01 01 00 01 04 00
- Bytes in 2nd font before 2044: 00 47 00 02 00 00 05 04 00 05 04 F9 99 F0 01 01 00 01 02 00 01 01 00 01 02 00

It seems like `00 01 01 00 01` is a starting signature!

How about ending?

- Bytes in 1st font after 2142: B8 00 01 00 00 00 01 00 41 9C 4C C6 3C 5F 0F 3C F5 00 0B 03 E8 00 00 00 00 A5 22 3D
- Bytes in 2nd font after 2114: 00 00 01 00 00 00 01 00 41 24 C3 91 34 5F 0F 3C F5 00 0B 03 E8 00 00 00 00 A5 22 3D

could be `00 01 00 00 00 01 00 41`... we should explore more typefaces.

BluuNext, 8px:
- corruptions start from 2492
- ends after 2584

- Bytes before 2492: 00 00 00 48 00 00 00 52 00 00 00 5D 00 02 00 00 01 01 00 01 04 **00 01 01 00 01** 04 00 (starting matches)
- Bytes after 2584: 00 00 00 00 01 00 00 00 01 01 06 5B E4 7D 84 5F 0F 3C F5 00 0B 03 E8 00 00 00 00

Seems like `00 01 00 00 00 01`!