from fontTools.misc.macRes import ResourceReader
from fontTools.ttLib import macUtils
from pathlib import Path

path = "/Users/antonina/Documents/GitHub/hgk_glitch_26/postscript/utopia_test/Utopia-Regular.dfont"

# 1. list Mac resources
rr = ResourceReader(path)
print("Resource types:", rr.types)

for typ in rr.types:
    print("\n", typ, "count:", rr.countResources(typ))
    print("indices:", rr.getIndices(typ))
    print("names:", rr.getNames(typ))

# 2. try extracting sfnt resources as normal TTF/OTF
try:
    fonts = macUtils.openTTFonts(path)
    for i, font in enumerate(fonts):
        out = f"extracted-{i}.ttf"
        font.save(out)
        print("saved", out)
except Exception as e:
    print("No readable sfnt resources via fontTools:", e)