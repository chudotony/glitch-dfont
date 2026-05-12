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

Bytes in 1st font before 2046: 00 02 00 00 09 04 00 09 04 F9 99 99 99 F0 01 01 00 01 04 00 01 01 00 01 04 00
Bytes in 2nd font before 2044: 00 47 00 02 00 00 05 04 00 05 04 F9 99 F0 01 01 00 01 02 00 01 01 00 01 02 00

It seems like `00 01 01 00 01` is a signature!

