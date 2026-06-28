# Glitch.dfont

Glitch.dfont is a browser-based `.dfont` bitmap font glitching [app](https://chudotony.github.io/glitch-dfont/).

The app runs entirely in the browser: uploaded files are processed locally and are not sent to a server.

The project began at the Digital Culture II class at IDCE HGK Basel, taught by [Ted Davis](https://teddavis.org/#).


## Use

You can crash your own `.dfont` file or play with one of included samples. 

The program extracts available bitmap strikes and provides the controls for crashing them. When downloading the file, the current glitch settings are applied to all of the strikes.

`docs/samples/licenses/` contains the bundled license and source-context files for these samples.

### Prepare your own `.dfont`

Instruction for using the [FontForge](https://fontforge.org/en-US/) app:
1. open your font file (usually works with `.ufo`, `.ttf`, `.otf` etc. containing a single face);
2. go to Element > Bitmap Strikes Available;
3. set the pixel sizes you wish separated with a comma;
4. go to File > Generate Fonts;
5. select **No Outline Font** for outline selector and **Apple bitmap only sfnt (dfont)** for bitmap selector. Then enter the output directory and filename and click **Generate**.

### Play with samples

You can simply choose one of the samples from the `Choose source` selector.

Bundled samples live in `docs/samples`. All sample files are open source fonts from [Velvetyne](https://velvetyne.fr/):

- Facade Ouest by Eleonore Fines / Velvetyne Type Foundry, SIL Open Font License 1.1
- Trickster by Jean-Baptiste Morizot, SIL Open Font License 1.1
- PicNic by Mariel Nils, CUTE 0.1

## Repository Structure

- `docs/` - GitHub Pages app
- `docs/samples/` - hosted samples
- `research/` - archived original coursework and process materials
