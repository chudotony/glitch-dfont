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
  
