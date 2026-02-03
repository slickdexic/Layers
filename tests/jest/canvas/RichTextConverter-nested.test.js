// Quick test for nested font-size spans
const RichTextConverter = require('../../../resources/ext.layers.editor/canvas/RichTextConverter.js');

describe('RichTextConverter nested fontSize', () => {
    test('should use innermost fontSize when spans are nested', () => {
        // This simulates what happens when user applies fontSize to already-styled text
        const html = '<span style="font-size: 33px" data-font-size="33"><span style="font-size: 32px" data-font-size="32">Text</span></span>';
        const result = RichTextConverter.htmlToRichText(html, 1);
        console.log('Result:', JSON.stringify(result, null, 2));
        // The innermost span has fontSize 32, so that should be the result
        expect(result[0].style.fontSize).toBe(32);
    });

    test('should apply outer fontSize when inner has no fontSize', () => {
        const html = '<span style="font-size: 33px" data-font-size="33"><span style="font-weight: bold">Text</span></span>';
        const result = RichTextConverter.htmlToRichText(html, 1);
        console.log('Result:', JSON.stringify(result, null, 2));
        // The inner span has no fontSize, should inherit 33 from outer
        expect(result[0].style.fontSize).toBe(33);
    });

    test('partial selection - text outside span has no fontSize', () => {
        // User selects only "World" and applies fontSize 33
        // "Hello " has no fontSize but editor container has fontSize from layer
        const html = 'Hello <span style="font-size: 16.5px" data-font-size="33">World</span>';
        const result = RichTextConverter.htmlToRichText(html, 0.5);
        console.log('Partial result:', JSON.stringify(result, null, 2));
        // "Hello " should have no fontSize (style may be empty or undefined)
        expect(result[0].text).toBe('Hello ');
        expect(result[0].style?.fontSize).toBeUndefined();
        // "World" should have fontSize 33
        expect(result[1].text).toBe('World');
        expect(result[1].style.fontSize).toBe(33);
    });

    test('multiple font size changes WITHOUT cleanup would use inner value (demonstrates bug)', () => {
        // Without the fix in InlineTextEditor._applyFormatToSelection:
        // When user changes fontSize multiple times, outer wraps inner
        // First change: fontSize 33, then change again to 34
        // The parser uses the innermost value, NOT the latest outer one
        const html = '<span style="font-size: 17px" data-font-size="34"><span style="font-size: 16.5px" data-font-size="33">Text</span></span>';
        const result = RichTextConverter.htmlToRichText(html, 0.5);
        console.log('Nested changes result:', JSON.stringify(result, null, 2));
        // This test documents the parser behavior - it uses innermost value
        // The FIX is in InlineTextEditor._removeFontSizeFromFragment which
        // cleans up nested spans BEFORE wrapping in new font-size span
        expect(result[0].style.fontSize).toBe(33);  // Parser correctly uses innermost
    });

    test('after cleanup, single font size is parsed correctly', () => {
        // After the fix removes inner font-size spans, only outer remains
        const html = '<span style="font-size: 17px" data-font-size="34">Text</span>';
        const result = RichTextConverter.htmlToRichText(html, 0.5);
        console.log('Cleaned result:', JSON.stringify(result, null, 2));
        expect(result[0].style.fontSize).toBe(34);  // Correct value after cleanup
    });
});
