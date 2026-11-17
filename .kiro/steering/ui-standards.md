---
inclusion: fileMatch
fileMatchPattern: ["app/**", "site/**"]
---
# Screen standards

## Clear in five seconds
A new user must be able to say, within five seconds, what this is, what to press now, and what they get. Show it with the picture of the form first.

## Few words
- A label sits on the form line it names, as on paper.
- One instruction at a time, at most 6 words, next to the control it is about.
- An instruction shows at most three times. After that it lives only on the help screen.

## Layout, measured
- Every control is at least 16 px inside the screen and the safe area, at least 44 px wide and high, and at least 12 px from the next control.
- Text and icon sit inside their button with 8 px padding. Nothing overlaps.
- The layout test runs at 360x640, 375x667, 390x844, 412x915, 768x1024, 1280x720 and 1920x1080 and names the control that fails.

## Look
- Paper, a perforated edge, carbon blue for the copy, a red form number. The paper look must make the form easier to read, not harder.
- Body text on its background has a contrast ratio of 4.5 or more. A test checks this.
- Fonts: only the four bundled fonts in app/src/fonts (SIL Open Font Licence) and system fonts. Load no font, script, style or image from another site.

## Sound and motion
- All sound is made in code with WebAudio. No sound files. Sound starts only after the first tap. Settings can turn it off.
- When the system asks for reduced motion, the sheet does not lift or tear. The copy appears with a plain fade.

## Every change is checked in a browser
- A change runs the full path test: pick a form, fill, add a photo, sign twice, press, tear off, open the copy file, verify, change one line, see the broken seal.
- A feature adds one step to the good path test and one step to the bad path test.
- Any page error or console error fails the test.

## Storage
- Drafts and photos live in IndexedDB. The app works when storage is blocked and says once that drafts will not be kept.
