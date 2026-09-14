#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSString *imagePath = nil;
        NSString *outputPath = nil;

        for (int i = 1; i < argc; i++) {
            NSString *arg = [NSString stringWithUTF8String:argv[i]];
            if ([arg isEqualToString:@"--image"] && i + 1 < argc) {
                imagePath = [NSString stringWithUTF8String:argv[++i]];
            } else if ([arg isEqualToString:@"--output"] && i + 1 < argc) {
                outputPath = [NSString stringWithUTF8String:argv[++i]];
            }
        }

        if (!imagePath) {
            fprintf(stderr, "Usage: measure_pixels --image <path.png> [--output <path.json>]\n");
            return 1;
        }

        NSData *imageData = [NSData dataWithContentsOfFile:imagePath];
        if (!imageData) {
            fprintf(stderr, "Error: Could not read file at %s\n", [imagePath UTF8String]);
            return 1;
        }

        NSBitmapImageRep *bitmapRep = [NSBitmapImageRep imageRepWithData:imageData];
        if (!bitmapRep) {
            fprintf(stderr, "Error: Could not decode image at %s\n", [imagePath UTF8String]);
            return 1;
        }

        NSInteger width = [bitmapRep pixelsWide];
        NSInteger height = [bitmapRep pixelsHigh];

        printf("Analyzing pixel borders in image: %s (%ldx%ld)\n", [imagePath UTF8String], (long)width, (long)height);

        NSArray *scanYs = @[
            @( (NSInteger)(height * 0.35) ),
            @( (NSInteger)(height * 0.50) ),
            @( (NSInteger)(height * 0.65) )
        ];

        NSMutableArray *edgeTransitions = [NSMutableArray array];

        for (NSNumber *yNum in scanYs) {
            NSInteger y = [yNum integerValue];
            NSInteger prevAlpha = -1;
            BOOL edgeFound = NO;

            for (NSInteger x = 0; x < width; x++) {
                NSColor *c = [bitmapRep colorAtX:x y:y];
                // Convert to device RGB if needed
                NSColor *rgb = [c colorUsingColorSpace:[NSColorSpace deviceRGBColorSpace]];
                if (!rgb) rgb = c;

                NSInteger a = (NSInteger)round([rgb alphaComponent] * 255.0);

                if (prevAlpha != -1) {
                    NSInteger diff = labs(a - prevAlpha);
                    if (diff > 20 && !edgeFound) {
                        NSInteger startIdx = MAX(0, x - 2);
                        NSInteger endIdx = MIN(width - 1, x + 2);
                        NSMutableArray *pixels = [NSMutableArray array];

                        for (NSInteger tx = startIdx; tx <= endIdx; tx++) {
                            NSColor *tp = [[bitmapRep colorAtX:tx y:y] colorUsingColorSpace:[NSColorSpace deviceRGBColorSpace]];
                            if (!tp) tp = [bitmapRep colorAtX:tx y:y];
                            NSInteger pr = (NSInteger)round([tp redComponent] * 255.0);
                            NSInteger pg = (NSInteger)round([tp greenComponent] * 255.0);
                            NSInteger pb = (NSInteger)round([tp blueComponent] * 255.0);
                            NSInteger pa = (NSInteger)round([tp alphaComponent] * 255.0);

                            [pixels addObject:@{
                                @"X": @(tx),
                                @"Y": @(y),
                                @"R": @(pr),
                                @"G": @(pg),
                                @"B": @(pb),
                                @"A": @(pa)
                            }];
                        }

                        NSString *typeStr = (a > prevAlpha) ? @"EnteringBody" : @"ExitingBody";
                        [edgeTransitions addObject:@{
                            @"ScanY": @(y),
                            @"EdgeX": @(x),
                            @"Type": typeStr,
                            @"Pixels": pixels
                        }];

                        edgeFound = YES;
                    }
                }
                prevAlpha = a;
            }
        }

        NSMutableArray *semiTransparentPixels = [NSMutableArray array];
        BOOL hasDarkFringing = NO;
        NSMutableArray *fringeSamples = [NSMutableArray array];

        for (NSDictionary *et in edgeTransitions) {
            NSArray *pixels = et[@"Pixels"];
            for (NSDictionary *pix in pixels) {
                NSInteger a = [pix[@"A"] integerValue];
                if (a > 10 && a < 245) {
                    [semiTransparentPixels addObject:pix];
                    double r = [pix[@"R"] doubleValue];
                    double g = [pix[@"G"] doubleValue];
                    double b = [pix[@"B"] doubleValue];
                    double luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                    if (luminance < 15.0 && a > 40) {
                        hasDarkFringing = YES;
                        [fringeSamples addObject:pix];
                    }
                }
            }
        }

        NSString *verdict = hasDarkFringing ? @"DIRTY_HALO_DETECTED" : @"CLEAN_ANTI_ALIASING";

        NSDictionary *result = @{
            @"ImagePath": imagePath,
            @"Width": @(width),
            @"Height": @(height),
            @"TotalTransitionsFound": @([edgeTransitions count]),
            @"SemiTransparentPixelCount": @([semiTransparentPixels count]),
            @"HasDarkFringing": @(hasDarkFringing),
            @"Verdict": verdict,
            @"SampleTransitions": edgeTransitions,
            @"FringeSamples": fringeSamples
        };

        NSError *jsonError = nil;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:&jsonError];

        if (outputPath && jsonData) {
            [jsonData writeToFile:outputPath atomically:YES];
            printf("Edge analysis saved to: %s\n", [outputPath UTF8String]);
        }

        printf("Pixel analysis verdict: %s (Found %lu transitions, %lu anti-aliased border pixels)\n",
               [verdict UTF8String], (unsigned long)[edgeTransitions count], (unsigned long)[semiTransparentPixels count]);
    }
    return 0;
}
