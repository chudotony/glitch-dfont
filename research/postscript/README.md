For that, we need fontforge:
```
brew install --cask fontforge
brew install fontforge
```
Then I prepared a test `.sfd` with only 9 glyphs, as before in woff, and saved it as `.pfa`, which was only possible with this command:
```
fontforge -lang=ff -c 'Open("Utopia-Regular.sfd"); Validate(0); Generate("utopia_test.pfa", "", 0x90000)'
```

Then moving on with Hexploder for our new test file.

# .PFA
## Offset 10:
- After 5581, the whole font became sans-serif and condensed in preview, but ok when opened in the fontforge.

## Offset 1:
- 470-472 changed height to super low. 480-482 changed width to super narrow. These changes were not visible in the FontForge, only apple previewer.
- 484 and 486 made the glyphs super wide and super high.

But anyway most of the glitched files did not displayed in the preview or any changes appeared in fontforge :(

*next chapter: bitmap*