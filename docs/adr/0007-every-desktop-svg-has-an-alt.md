# Every desktop Svg has a non-empty alt, decorative ones too

On the desktop surface spindle gives every Svg a short, true, non-empty alt, including purely decorative pieces such as the band's ticks and the rail's connectors, against the usual web convention of an empty alt for decoration. The desktop app did not draw the Svgs that carried an empty alt, and the band's bar vanished with them, while the test engine accepts an empty alt, so only a test that refuses one keeps the regression from returning.

Status: accepted

## Consequences

A decorative alt says what the piece shows in a few words ('start of Fix', 'Spec to Build') and never repeats or contradicts another alt's meaning; a piece whose alt would be false, such as a lanes remainder when every lane is built, is not drawn. No layout may rest its height on a single decorative Svg.
