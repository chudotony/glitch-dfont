# Interesting results
TBD

# How the corruption went
Played with Karrik-Regular. Removed all the OTF features and all glyphs except 9 symbols in the file.
<ol>
  <li>With offset 10:</li>
    <ul>
      <li>Letters and numbers were changing interestingly ca. from `773` to `1156`.</li>
      <li>`NO GLYPH` was changing interestingly ca. from `298` to `486`. In the beginning, it was changinf the spatial position, then the contour.</li>
    </ul>

  <li>With offset 1:</li>
    <ul>
      <li>Tested "letter" diapason — from `740` to `1201`. Way more files were renderable, but changes are mainly suble.</li>
      <li>Tested "NO GLYPH" diapason — from `289` to `530`. Again, more files are renderable with smaller offset, but changes are only noticeable from `378`. Many interesting results there. My favs are `385`, `362`. I tried to find a pattern of changes depending on the position, but couldn't.</li>
    </ul>
</ol>
  
Started investigating the files that Glitched interestingly, and what could be signatures of glyph start / end.
- between `a` and `b` (857-876, excluding end points): CE 59 BB DC 6A A7 51 90 70 1C 92 F3 DC AF 38 48 98
- between `b` and `c` (926-959, excluding end points): 8D 8E F8 FD C7 8F DC D6 F9 BD DB A7 5B C6 E9 6A 85 5E 65 E2 2E 08 B2 5C 7A B2 46 D1 AF C9 0A 37
No more than 1 bite...
- between `1` and `2` (1079-1123, excluding end points): EC FB 89 4A 33 BE DD 7C 98 5B E1 D7 87 37 EE D1 98 3C A3 02 8B 22 EF 9F 18 AA A5 A8 53 60 35 5B 41 12 1F C1 8A 61 50 2D CF C2 CC

None of the bites appears in all of the 3 gaps 👍👍👍