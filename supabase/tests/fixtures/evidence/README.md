# Evidence image fixtures

These fixed fixtures exercise the server-side F-08 image pipeline.

| File | Source | Purpose |
|---|---|---|
| `sample-gps.jpg` | [`ianare/exif-samples`](https://github.com/ianare/exif-samples/blob/master/jpg/gps/DSCN0010.jpg) | JPEG carrying EXIF GPS and XMP metadata |
| `sample-oriented.jpg` | [`recurser/exif-orientation-examples`](https://github.com/recurser/exif-orientation-examples/blob/master/Landscape_6.jpg) | JPEG with EXIF orientation 6 |
| `sample.heic` | [`strukturag/libheif`](https://github.com/strukturag/libheif/blob/master/tests/data/rainbow-451x461.heic) | Small HEIC decode sample carrying ICC and XMP profiles |
| `sample.png` | Generated from `sample-gps.jpg` with ImageMagick | 2400×1200 resize-boundary input |
| `sample.webp` | Generated from `sample.png` with ImageMagick | WEBP decode sample |

The source fixtures retain their upstream licenses. Generated derivatives are test-only assets.
