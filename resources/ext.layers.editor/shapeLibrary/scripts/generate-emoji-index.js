#!/usr/bin/env node
/**
 * Generate Emoji Library Index for Layers Extension
 *
 * This script generates a lightweight EmojiLibraryIndex.js with just metadata
 * (no inline SVG data). SVGs are loaded on-demand from the server.
 *
 * Usage: node generate-emoji-index.js
 *
 * @file
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

// Paths
const SCRIPT_DIR = __dirname;
const SHAPE_LIB_DIR = path.dirname( SCRIPT_DIR );
const ASSETS_DIR = path.join( SHAPE_LIB_DIR, 'assets', 'noto_emoji' );
const OUTPUT_FILE = path.join( SHAPE_LIB_DIR, 'EmojiLibraryIndex.js' );
const EMOJI_NAMES_FILE = path.join( SCRIPT_DIR, 'emoji-names.json' );

// Load emoji names/keywords data
let emojiNamesData = {};
if ( fs.existsSync( EMOJI_NAMES_FILE ) ) {
	try {
		emojiNamesData = JSON.parse( fs.readFileSync( EMOJI_NAMES_FILE, 'utf8' ) );
		console.log( `Loaded ${ Object.keys( emojiNamesData ).length } emoji names from emoji-names.json` );
	} catch ( e ) {
		console.warn( 'Warning: Could not load emoji-names.json:', e.message );
	}
} else {
	console.warn( 'Warning: emoji-names.json not found, emoji will have no descriptive names' );
}

/**
 * Unicode emoji categories based on official Unicode categorization
 * More granular and accurate than simple codepoint ranges
 */
const EMOJI_CATEGORIES = {
	'smileys': {
		name: 'Smileys & Faces',
		icon: '😀',
		order: 1,
		ranges: [
			[ 0x1F600, 0x1F64F ], // Emoticons
			[ 0x1F910, 0x1F92F ], // Supplemental faces
			[ 0x1F970, 0x1F976 ], // More faces
			[ 0x1F978, 0x1F97A ], // Pleading face etc
			[ 0x1F972, 0x1F972 ], // Smiling face with tear
			[ 0x2639, 0x263A ],   // White frowning/smiling face
			[ 0x1F9D0, 0x1F9D0 ]  // Face with monocle
		]
	},
	'gestures': {
		name: 'Hands & Gestures',
		icon: '👋',
		order: 2,
		ranges: [
			[ 0x1F44A, 0x1F44F ], // Hands (fist, wave, clap)
			[ 0x1F446, 0x1F449 ], // Pointing hands
			[ 0x1F450, 0x1F450 ], // Open hands
			[ 0x1F590, 0x1F596 ], // Hand splayed, vulcan
			[ 0x1F91A, 0x1F91F ], // Hand gestures
			[ 0x1F932, 0x1F932 ], // Palms up
			[ 0x270A, 0x270D ],   // Fist, hand, writing hand
			[ 0x261D, 0x261D ],   // Index pointing up
			[ 0x1F90C, 0x1F90C ], // Pinched fingers
			[ 0x1F90F, 0x1F90F ]  // Pinching hand
		]
	},
	'people': {
		name: 'People',
		icon: '🧑',
		order: 3,
		ranges: [
			[ 0x1F466, 0x1F487 ], // People
			[ 0x1F574, 0x1F575 ], // Person in suit
			[ 0x1F645, 0x1F64E ], // Person gestures
			[ 0x1F926, 0x1F926 ], // Face palm
			[ 0x1F937, 0x1F937 ], // Shrug
			[ 0x1F9D1, 0x1F9DD ], // People continued
			[ 0x1F385, 0x1F385 ], // Santa
			[ 0x1F3C2, 0x1F3C4 ], // Sports people (snowboarder, surfer)
			[ 0x1F3C7, 0x1F3C7 ], // Horse racing
			[ 0x1F3CA, 0x1F3CC ], // Swimming, weightlifting, golfing (people)
			[ 0x1F46E, 0x1F478 ], // Professions
			[ 0x1F934, 0x1F936 ], // Prince, Mrs Claus
			[ 0x1F9B8, 0x1F9B9 ], // Superhero, villain
			[ 0x1F9CD, 0x1F9CF ], // Standing, kneeling, deaf
			[ 0x1F57A, 0x1F57A ], // Man dancing
			[ 0x1F930, 0x1F931 ], // Pregnant, breastfeeding
			[ 0x1F933, 0x1F933 ], // Selfie
			[ 0x1F5E3, 0x1F5E3 ], // Speaking head
			[ 0x1F464, 0x1F465 ], // Bust silhouettes
			[ 0x1F440, 0x1F445 ], // Eyes, ear, nose, mouth, tongue (body parts)
			[ 0x1F6B6, 0x1F6B6 ], // Person walking
			[ 0x1F977, 0x1F977 ], // Ninja
			[ 0x1F9DE, 0x1F9DF ], // Genie, zombie
			[ 0x1F9E0, 0x1F9E0 ], // Brain
			[ 0x1F9B4, 0x1F9B7 ], // Bone, leg, foot, tooth (body parts)
			[ 0x1F9BB, 0x1F9BB ]  // Ear with hearing aid
		]
	},
	'animals': {
		name: 'Animals',
		icon: '🐱',
		order: 4,
		ranges: [
			[ 0x1F400, 0x1F43F ], // Animal faces and mammals (including chipmunk 0x1F43F)
			[ 0x1F980, 0x1F9AE ], // More animals (crab, scorpion, etc)
			[ 0x1F54A, 0x1F54A ], // Dove
			[ 0x1F577, 0x1F578 ], // Spider, web
			[ 0x1F981, 0x1F984 ], // Lion, unicorn
			[ 0x1F985, 0x1F99F ]  // More animals
		]
	},
	'nature': {
		name: 'Plants & Nature',
		icon: '🌸',
		order: 5,
		ranges: [
			[ 0x1F330, 0x1F335 ], // Plants (chestnut, seeds)
			[ 0x1F337, 0x1F343 ], // Flowers
			[ 0x1F344, 0x1F344 ], // Mushroom
			[ 0x1F490, 0x1F490 ], // Bouquet
			[ 0x1F33F, 0x1F33F ], // Herb
			[ 0x2618, 0x2618 ],   // Shamrock
			[ 0x1F940, 0x1F940 ]  // Wilted flower
		]
	},
	'food': {
		name: 'Food & Drink',
		icon: '🍔',
		order: 6,
		ranges: [
			[ 0x1F32D, 0x1F32F ], // Hot dog, taco, burrito
			[ 0x1F345, 0x1F37F ], // Food items
			[ 0x1F950, 0x1F96B ], // More food (croissant to takeout)
			[ 0x1F9C0, 0x1F9C9 ], // Cheese, cupcake, etc
			[ 0x2615, 0x2615 ],   // Hot beverage
			[ 0x1F336, 0x1F336 ], // Hot pepper
			[ 0x1F96C, 0x1F96F ], // Leafy greens, mango, moon cake, bagel
			[ 0x1F941, 0x1F944 ]  // Drum (🥁), glasses (🥂🥃), spoon (🥄)
		]
	},
	'travel': {
		name: 'Travel & Transport',
		icon: '✈️',
		order: 7,
		ranges: [
			[ 0x1F680, 0x1F6A9 ], // Transport (before prohibition signs)
			[ 0x1F6D0, 0x1F6D2 ], // More places
			[ 0x1F6E0, 0x1F6EC ], // More transport
			[ 0x1F6F0, 0x1F6F6 ], // Satellites, vehicles (before sled)
			[ 0x1F6F9, 0x1F6FA ], // Skateboard, auto rickshaw
			[ 0x1F6FB, 0x1F6FC ], // Pickup truck, roller skate
			[ 0x2708, 0x2708 ],   // Airplane
			[ 0x26F5, 0x26F5 ],   // Sailboat
			[ 0x26FD, 0x26FD ],   // Fuel pump
			[ 0x26F4, 0x26F4 ],   // Ferry
			[ 0x1F3CD, 0x1F3CE ], // Motorcycle, racing car
			[ 0x1F6B2, 0x1F6B2 ], // Bicycle (the vehicle itself)
			[ 0x1F6AC, 0x1F6AC ], // Smoking symbol
			[ 0x1F6B0, 0x1F6B0 ]  // Potable water
		]
	},
	'places': {
		name: 'Places & Buildings',
		icon: '🏠',
		order: 8,
		ranges: [
			[ 0x1F3D4, 0x1F3DF ], // Landscapes
			[ 0x1F3E0, 0x1F3F0 ], // Buildings
			[ 0x26F0, 0x26F2 ],   // Mountain, fountain (not golf flag)
			[ 0x26FA, 0x26FA ],   // Tent
			[ 0x1F5FB, 0x1F5FF ], // Mount Fuji, landmarks
			[ 0x26E9, 0x26EA ],   // Shinto shrine, church
			[ 0x1F6D5, 0x1F6D7 ], // Hindu temple, hut, elevator
			[ 0x1F54B, 0x1F54D ]  // Kaaba, mosque, synagogue
		]
	},
	'weather': {
		name: 'Weather & Sky',
		icon: '☀️',
		order: 9,
		ranges: [
			[ 0x2600, 0x2604 ],   // Sun, cloud, comet
			[ 0x2614, 0x2614 ],   // Umbrella with rain
			[ 0x26A1, 0x26A1 ],   // Lightning
			[ 0x26C4, 0x26C8 ],   // Snowman, clouds
			[ 0x1F300, 0x1F321 ], // Weather phenomena
			[ 0x1F324, 0x1F32C ], // More weather
			[ 0x2744, 0x2744 ],   // Snowflake
			[ 0x2728, 0x2728 ]    // Sparkles
		]
	},
	'activities': {
		name: 'Sports & Activities',
		icon: '⚽',
		order: 10,
		ranges: [
			[ 0x1F3A3, 0x1F3A3 ], // Fishing pole only
			[ 0x1F3AF, 0x1F3B4 ], // Target, games, dice, bowling
			[ 0x1F3BD, 0x1F3C1 ], // Sports gear (running shirt, tennis, ski, basketball, flag)
			[ 0x1F3C8, 0x1F3C9 ], // American football, rugby ball
			[ 0x26BD, 0x26BE ],   // Soccer, baseball
			[ 0x1F3C5, 0x1F3C6 ], // Medal, trophy
			[ 0x1F3CF, 0x1F3D3 ], // Cricket, sports equipment
			[ 0x1F6F7, 0x1F6F8 ], // Sled, flying saucer
			[ 0x1F94A, 0x1F94F ], // Boxing glove, sports
			[ 0x26F3, 0x26F3 ],   // Golf flag
			[ 0x26F7, 0x26F9 ],   // Skier, ice skate, person with ball
			[ 0x1F3F8, 0x1F3F9 ], // Badminton, bow and arrow
			[ 0x1F938, 0x1F93E ], // Cartwheeling, wrestling, playing water polo, handball, juggling
			[ 0x1F93C, 0x1F93E ], // Wrestlers, water polo, handball, juggling
			[ 0x265F, 0x265F ],   // Chess pawn
			[ 0x1F6B4, 0x1F6B5 ], // Person biking, mountain biking
			[ 0x1F93F, 0x1F93F ], // Diving mask
			[ 0x1F945, 0x1F945 ], // Goal net
			[ 0x1F947, 0x1F949 ]  // 1st, 2nd, 3rd place medals
		]
	},
	'entertainment': {
		name: 'Arts & Entertainment',
		icon: '🎬',
		order: 11,
		ranges: [
			[ 0x1F3A0, 0x1F3A2 ], // Carousel, circus, ferris wheel
			[ 0x1F3A4, 0x1F3AE ], // Microphone, movie, cinema, performing arts, games
			[ 0x1F3B5, 0x1F3BC ], // Music notes, musical score
			[ 0x1F39E, 0x1F39F ], // Film frames, admission tickets
			[ 0x1F4F7, 0x1F4FD ], // Camera, video
			[ 0x1F399, 0x1F39B ], // Studio mic
			[ 0x1F3AD, 0x1F3AD ], // Performing arts
			[ 0x1F4FA, 0x1F4FC ], // Television, radio, videocassette
			[ 0x1F579, 0x1F579 ], // Joystick
			[ 0x1F380, 0x1F393 ], // Ribbon, gift, birthday, Christmas, celebrations, backpack, graduation
			[ 0x1F396, 0x1F397 ], // Military medal, reminder ribbon
			[ 0x1F941, 0x1F941 ]  // Drum
		]
	},
	'objects': {
		name: 'Objects',
		icon: '💡',
		order: 12,
		ranges: [
			[ 0x1F4A1, 0x1F4A1 ], // Light bulb
			[ 0x1F4B0, 0x1F4B8 ], // Money
			[ 0x1F4BB, 0x1F4DA ], // Computer, books
			[ 0x1F4DC, 0x1F4F6 ], // Documents, phone
			[ 0x1F4FE, 0x1F4FF ], // Portable stereo
			[ 0x1F550, 0x1F567 ], // Clocks
			[ 0x1F5A4, 0x1F5A8 ], // Printer, keyboard
			[ 0x1F5B1, 0x1F5B2 ], // Mouse, trackball
			[ 0x1F5BC, 0x1F5C4 ], // Pictures, folders
			[ 0x2702, 0x2702 ],   // Scissors
			[ 0x2709, 0x2709 ],   // Envelope
			[ 0x1F4A3, 0x1F4AF ], // Objects (bomb, speech, etc)
			[ 0x231A, 0x231B ],   // Watch, hourglass
			[ 0x2328, 0x2328 ],   // Keyboard
			[ 0x23F0, 0x23F3 ],   // Alarm clock, stopwatch, timer, hourglass
			[ 0x270F, 0x2712 ],   // Pencil, pen
			[ 0x1F4B9, 0x1F4BA ], // Chart, seat
			[ 0x1F488, 0x1F48A ], // Barber pole, syringe, pill
			[ 0x1F451, 0x1F463 ], // Crown, hats, glasses, clothing, footwear, footprints
			[ 0x1F56F, 0x1F570 ], // Candle, clock
			[ 0x1F576, 0x1F576 ], // Sunglasses
			[ 0x1F587, 0x1F587 ], // Linked paperclips
			[ 0x1F58A, 0x1F58D ], // Pen, fountain pen, paintbrush, crayon
			[ 0x1F5D1, 0x1F5D3 ], // Wastebasket, card file
			[ 0x1F5DC, 0x1F5DE ], // Compression, newspaper
			[ 0x1F5E1, 0x1F5E1 ], // Dagger
			[ 0x1F573, 0x1F573 ], // Hole
			[ 0x1F5F3, 0x1F5F3 ], // Ballot box
			[ 0x1F5FA, 0x1F5FA ], // World map
			[ 0x260E, 0x260E ],   // Telephone
			[ 0x2692, 0x2697 ],   // Hammer, pick, swords, scales, alembic
			[ 0x2699, 0x2699 ],   // Gear
			[ 0x26CF, 0x26CF ],   // Pick
			[ 0x26D1, 0x26D1 ],   // Helmet
			[ 0x26D3, 0x26D3 ],   // Chains
			[ 0x2693, 0x2693 ],   // Anchor
			[ 0x1F3FA, 0x1F3FA ], // Amphora
			[ 0x1F3F5, 0x1F3F5 ], // Rosette
			[ 0x1F3F7, 0x1F3F7 ], // Label
			[ 0x1F4DB, 0x1F4DB ], // Name badge
			[ 0x1F6DD, 0x1F6DF ], // Playground slide, wheel, ring buoy
			[ 0x1F97B, 0x1F97F ], // Sari, lab coat, goggles, hiking boot, flat shoe
			[ 0x1F9AF, 0x1F9AF ], // Probing cane
			[ 0x1F9BA, 0x1F9BA ], // Safety vest
			[ 0x1F9BC, 0x1F9BF ], // Motorized wheelchair, manual wheelchair, mechanical arm, mechanical leg
			[ 0x1F9E2, 0x1F9FF ]  // Billed cap, scarf, gloves, coat, socks, red envelope, firecracker, puzzle, test tube, petri dish, dna, compass, abacus, fire extinguisher, toolbox, brick, magnet, luggage, lotion bottle, thread, yarn, safety pin, teddy bear, broom, basket, roll of paper, soap, sponge, receipt, nazar amulet
		]
	},
	'hearts': {
		name: 'Hearts & Love',
		icon: '❤️',
		order: 13,
		ranges: [
			[ 0x1F491, 0x1F49F ], // Heart decorations
			[ 0x1F48B, 0x1F48F ], // Kiss, rings
			[ 0x2764, 0x2764 ],   // Red heart
			[ 0x2763, 0x2763 ],   // Heart exclamation
			[ 0x1F493, 0x1F49F ], // Heart symbols
			[ 0x1F5A4, 0x1F5A4 ], // Black heart
			[ 0x1F90D, 0x1F90E ], // White, brown heart
			[ 0x1F9E1, 0x1F9E1 ]  // Orange heart
		]
	},
	'symbols': {
		name: 'Symbols & Signs',
		icon: '✅',
		order: 14,
		ranges: [
			[ 0x1F170, 0x1F19A ], // Squared letters
			[ 0x1F4A2, 0x1F4A2 ], // Anger symbol
			[ 0x1F4AC, 0x1F4AF ], // Speech bubbles
			[ 0x2611, 0x2612 ],   // Checkbox
			[ 0x2705, 0x2705 ],   // Check mark
			[ 0x274C, 0x274E ],   // Cross marks
			[ 0x2753, 0x2757 ],   // Question, exclamation
			[ 0x2795, 0x2797 ],   // Math symbols
			[ 0x303D, 0x303D ],   // Part alternation mark
			[ 0x3030, 0x3030 ],   // Wavy dash
			[ 0x3297, 0x3299 ],   // Circled ideographs
			[ 0x1F51E, 0x1F52D ], // Symbols
			[ 0x1F530, 0x1F53D ], // Shapes, triangles
			[ 0x2622, 0x2623 ],   // Radioactive, biohazard
			[ 0x2626, 0x262F ],   // Religious symbols
			[ 0x1F4A0, 0x1F4A0 ], // Diamond
			[ 0x269B, 0x269C ],   // Atom, fleur-de-lis
			[ 0x0023, 0x0039 ],   // # * 0-9 (keycap bases)
			[ 0x00A9, 0x00AE ],   // Copyright, registered
			[ 0x2122, 0x2122 ],   // Trademark
			[ 0x2139, 0x2139 ],   // Information
			[ 0x203C, 0x2049 ],   // Double exclamation, interrobang
			[ 0x24C2, 0x24C2 ],   // Circled M
			[ 0x2640, 0x2642 ],   // Female, male signs
			[ 0x2660, 0x2668 ],   // Card suits, hot springs
			[ 0x267B, 0x267F ],   // Recycling, infinity, wheelchair
			[ 0x26A7, 0x26A7 ],   // Transgender symbol
			[ 0x26AA, 0x26AB ],   // White/black circles
			[ 0x2714, 0x2716 ],   // Check, X marks
			[ 0x271D, 0x2721 ],   // Crosses, star of david
			[ 0x2733, 0x2734 ],   // Asterisks
			[ 0x2747, 0x2747 ],   // Sparkle
			[ 0x27B0, 0x27BF ],   // Curly loops
			[ 0x2B1B, 0x2B1C ],   // Black/white squares
			[ 0x2B50, 0x2B55 ],   // Star, circle
			[ 0x1F7E0, 0x1F7F0 ], // Colored circles and squares
			[ 0x1F004, 0x1F0CF ], // Mahjong, playing cards
			[ 0x1F200, 0x1F251 ], // Japanese buttons
			[ 0x1F500, 0x1F53D ], // Media controls, shuffle, repeat
			[ 0x23CF, 0x23FA ],   // Eject, play, pause, stop, record, fast forward/rewind
			[ 0x1F5E8, 0x1F5EF ], // Speech bubbles
			[ 0x26B0, 0x26B1 ],   // Coffin, urn
			[ 0x1F3F3, 0x1F3F4 ], // White flag, black flag (and their variants)
			[ 0x1F549, 0x1F549 ], // Om symbol
			[ 0x1F54E, 0x1F54E ]  // Menorah
		]
	},
	'zodiac': {
		name: 'Zodiac & Astrology',
		icon: '♈',
		order: 15,
		ranges: [
			[ 0x2648, 0x2653 ],   // Zodiac signs
			[ 0x26CE, 0x26CE ]    // Ophiuchus
		]
	},
	'arrows': {
		name: 'Arrows & Directions',
		icon: '➡️',
		order: 16,
		ranges: [
			[ 0x2194, 0x2199 ],   // Arrows
			[ 0x21A9, 0x21AA ],   // Return arrows
			[ 0x27A1, 0x27A1 ],   // Right arrow
			[ 0x2934, 0x2935 ],   // Curved arrows
			[ 0x25AA, 0x25FE ],   // Geometric shapes (small squares, circles)
			[ 0x1F517, 0x1F51D ], // Link, top, end symbols
			[ 0x1F53A, 0x1F53D ], // Triangles
			[ 0x2B05, 0x2B07 ]    // Left, up, down arrows
		]
	},
	'warnings': {
		name: 'Warnings & Prohibitions',
		icon: '⚠️',
		order: 17,
		ranges: [
			[ 0x26A0, 0x26A1 ],   // Warning, high voltage
			[ 0x2620, 0x2620 ],   // Skull and crossbones
			[ 0x2622, 0x2623 ],   // Radioactive, biohazard
			[ 0x1F6AB, 0x1F6B1 ], // Prohibited signs (no entry, no smoking, etc)
			[ 0x1F6B3, 0x1F6B3 ], // No bicycles
			[ 0x1F6B7, 0x1F6B8 ], // No pedestrians, children crossing
			[ 0x1F6C2, 0x1F6C5 ], // Passport control, customs, baggage claim, left luggage
			[ 0x26D4, 0x26D4 ]    // No entry
		]
	},
	'household': {
		name: 'Home & Furniture',
		icon: '🛋️',
		order: 18,
		ranges: [
			[ 0x1F6CB, 0x1F6CB ], // Couch and lamp
			[ 0x1F6CC, 0x1F6CC ], // Person in bed (base only)
			[ 0x1F6CD, 0x1F6CD ], // Shopping bags
			[ 0x1F6CE, 0x1F6CE ], // Bellhop bell
			[ 0x1F6CF, 0x1F6CF ], // Bed
			[ 0x1F6BD, 0x1F6BD ], // Toilet
			[ 0x1F6BF, 0x1F6BF ], // Shower
			[ 0x1F6C0, 0x1F6C0 ], // Bathtub (base only)
			[ 0x1F6C1, 0x1F6C1 ], // Bathtub
			[ 0x1F6B9, 0x1F6BC ], // Restroom signs (men, women, baby symbol, baby changing)
			[ 0x1F6AA, 0x1F6AA ], // Door
			[ 0x1FA91, 0x1FA91 ], // Chair (if available)
			[ 0x1F5D1, 0x1F5D3 ], // Wastebasket, card index
			[ 0x1F5DC, 0x1F5DE ], // Compression, newspaper
			[ 0x1F6BE, 0x1F6BE ]  // Water closet (WC)
		]
	},
	'misc': {
		name: 'Miscellaneous',
		icon: '🔮',
		order: 19,
		ranges: [
			// This should catch anything not matched by other categories
			// Keep this list minimal - items here should be truly uncategorizable
			[ 0x1F9E0, 0x1F9FF ], // Fantasy, supplemental symbols (brain, etc)
			[ 0x1F9AF, 0x1F9AF ], // Probing cane
			[ 0x1F97D, 0x1F97F ], // Goggles, swim brief, diving mask
			[ 0x1F96C, 0x1F97B ], // Leafy greens, socks, etc
			[ 0x20E3, 0x20E3 ],   // Combining enclosing keycap (standalone)
			[ 0x1F549, 0x1F54E ], // Religious symbols (om, menorah)
			[ 0x1F54A, 0x1F54A ], // Dove
			[ 0x1F336, 0x1F336 ], // Hot pepper
			[ 0x1F3F3, 0x1F3F7 ], // Flags, rosette, label
			[ 0x1F6D8, 0x1F6DF ], // More travel/objects
			[ 0x1F6DC, 0x1F6DC ], // Wireless
			[ 0x1F9E1, 0x1F9E1 ], // Orange heart (supplemental)
			[ 0x2638, 0x2638 ]    // Wheel of dharma
		]
	}
};

/**
 * Parse codepoint from filename (returns first codepoint for categorization)
 * @param {string} filename
 * @return {number|null}
 */
function parseCodepoint( filename ) {
	const match = filename.match( /emoji_u([0-9a-f]+)/i );
	if ( match ) {
		return parseInt( match[ 1 ], 16 );
	}
	return null;
}

/**
 * Parse all codepoints from filename (for multi-codepoint sequences like skin tones)
 * @param {string} filename - e.g., "emoji_u1f3c3_1f3fb.svg"
 * @return {number[]} Array of codepoints
 */
function parseAllCodepoints( filename ) {
	// Remove prefix and extension
	const codepointPart = filename.replace( /^emoji_u/, '' ).replace( /\.svg$/i, '' );
	// Split by underscore and parse each as hex, filtering out ZWJ (200d) for display
	const parts = codepointPart.split( '_' );
	const codepoints = [];
	for ( const part of parts ) {
		const cp = parseInt( part, 16 );
		if ( !isNaN( cp ) ) {
			codepoints.push( cp );
		}
	}
	return codepoints;
}

/**
 * Get emoji character from codepoints (handles multi-codepoint sequences)
 * @param {number[]} codepoints
 * @return {string}
 */
function getEmojiCharFromCodepoints( codepoints ) {
	try {
		return String.fromCodePoint( ...codepoints );
	} catch ( e ) {
		return '';
	}
}

/**
 * Get category for a codepoint
 * Uses a priority system where more specific categories are checked first
 * @param {number} codepoint
 * @return {string}
 */
function getCategoryForCodepoint( codepoint ) {
	// Priority order for category matching (more specific categories first)
	// This ensures sports equipment goes to sports, not people doing sports
	const priorityOrder = [
		'activities',    // Sports equipment first
		'hearts',        // Hearts before generic symbols
		'zodiac',        // Zodiac before generic symbols
		'arrows',        // Arrows before generic symbols
		'warnings',      // Warnings before travel
		'weather',       // Weather before generic symbols
		'household',     // Household items
		'entertainment', // Entertainment before objects
		'animals',       // Animals
		'nature',        // Plants
		'food',          // Food
		'gestures',      // Hand gestures
		'smileys',       // Faces
		'people',        // People (broad category, check later)
		'travel',        // Travel
		'places',        // Places
		'objects',       // Objects (broad)
		'symbols',       // Symbols (broad)
		'misc'           // Catch-all last
	];

	// Check categories in priority order
	for ( const catId of priorityOrder ) {
		const catInfo = EMOJI_CATEGORIES[ catId ];
		if ( !catInfo ) {
			continue;
		}
		for ( const [ min, max ] of catInfo.ranges ) {
			if ( codepoint >= min && codepoint <= max ) {
				return catId;
			}
		}
	}

	// Check any remaining categories not in priority list
	for ( const [ catId, catInfo ] of Object.entries( EMOJI_CATEGORIES ) ) {
		if ( priorityOrder.includes( catId ) ) {
			continue;
		}
		for ( const [ min, max ] of catInfo.ranges ) {
			if ( codepoint >= min && codepoint <= max ) {
				return catId;
			}
		}
	}

	return 'misc';
}

// Main execution
console.log( 'Generating EmojiLibraryIndex.js (lightweight, no inline SVG)...\n' );

if ( !fs.existsSync( ASSETS_DIR ) ) {
	console.error( `Error: Assets directory not found: ${ ASSETS_DIR }` );
	process.exit( 1 );
}

/**
 * Check if an emoji sequence is likely to render correctly
 * Filters out complex ZWJ sequences and newer emoji that often don't have font support
 * @param {number[]} codepoints
 * @param {string} filename
 * @return {boolean}
 */
function isRenderableEmoji( codepoints, filename ) {
	// Skip emoji with more than 4 codepoints (complex ZWJ sequences)
	// These often show as stacked characters or empty boxes
	if ( codepoints.length > 4 ) {
		return false;
	}

	// Skip emoji with directional arrows (27a1) - often not supported
	if ( codepoints.includes( 0x27a1 ) ) {
		return false;
	}

	// Skip certain problematic codepoint ranges
	for ( const cp of codepoints ) {
		// Skip Regional Indicator Symbols (U+1F1E0-1F1FF)
		// These are individual letters A-Z that combine to form flags
		// Standalone they just show as letter blocks, not useful
		if ( cp >= 0x1F1E0 && cp <= 0x1F1FF ) {
			return false;
		}

		// Skip component/invisible codepoints
		// Skip hair style components (1F9B0-1F9B3: red/curly/white/bald hair)
		if ( cp >= 0x1F9B0 && cp <= 0x1F9B3 ) {
			return false;
		}

		// Skip entire Unicode 13.0+ "Symbols and Pictographs Extended-A" block (U+1FA70-1FAFF)
		// These newer emoji have very poor browser font support and often show as empty boxes:
		// - U+1FA70-1FA7C: chess pieces, sewing, etc.
		// - U+1FA80-1FAA8: objects (yo-yo, kite, etc.)
		// - U+1FAB0-1FABF: animals (fly, worm, beetle, etc.)
		// - U+1FAC0-1FACF: people/body parts
		// - U+1FAD0-1FADF: food
		// - U+1FAE0-1FAFF: faces
		if ( cp >= 0x1FA70 && cp <= 0x1FAFF ) {
			return false;
		}

		// Skip some other problematic newer emoji
		// U+1F979 (face holding back tears) - Unicode 14.0, poor support
		if ( cp === 0x1F979 ) {
			return false;
		}

		// Skip newer food emoji that lack support (U+1F9C3-1F9CF)
		if ( cp >= 0x1F9C3 && cp <= 0x1F9CF ) {
			return false;
		}

		// Skip skin tone modifiers when standalone (U+1F3FB-1F3FF)
		// These should only appear combined with person emoji
		if ( cp >= 0x1F3FB && cp <= 0x1F3FF && codepoints.length === 1 ) {
			return false;
		}
	}

	return true;
}

// Collect all emoji
const allEmoji = [];
let skippedCount = 0;
const files = fs.readdirSync( ASSETS_DIR );

for ( const file of files ) {
	if ( !file.endsWith( '.svg' ) ) {
		continue;
	}

	const codepoint = parseCodepoint( file );
	const allCodepoints = parseAllCodepoints( file );

	// Filter out emoji that are unlikely to render correctly
	if ( !isRenderableEmoji( allCodepoints, file ) ) {
		skippedCount++;
		continue;
	}

	const category = codepoint ? getCategoryForCodepoint( codepoint ) : 'symbols';
	// Use all codepoints for proper display of skin tone variants and ZWJ sequences
	const char = allCodepoints.length > 0 ? getEmojiCharFromCodepoints( allCodepoints ) : '';

	// Get name and keywords from emoji-names.json
	// Try various key formats: just hex, with underscores for ZWJ sequences
	const hexCode = codepoint ? codepoint.toString( 16 ).toLowerCase() : '';
	const filenameKey = file.replace( /^emoji_u/, '' ).replace( /\.svg$/, '' ).toLowerCase();
	const nameData = emojiNamesData[ hexCode ] || emojiNamesData[ filenameKey ] || null;

	allEmoji.push( {
		id: file.replace( /\.svg$/i, '' ),
		filename: file,
		category,
		codepoint: codepoint || 0,
		char,
		name: nameData ? nameData.name : '',
		keywords: nameData ? nameData.keywords : []
	} );
}

console.log( `Skipped ${ skippedCount } emoji with complex/unsupported sequences` );

// Group by category
const categories = {};
for ( const emoji of allEmoji ) {
	if ( !categories[ emoji.category ] ) {
		categories[ emoji.category ] = [];
	}
	categories[ emoji.category ].push( emoji );
}

// Sort each category by codepoint
for ( const cat of Object.keys( categories ) ) {
	categories[ cat ].sort( ( a, b ) => a.codepoint - b.codepoint );
}

// Generate output
let output = `/**
 * Emoji Library Index for Layers Extension
 *
 * Auto-generated by generate-emoji-index.js
 * Generated: ${ new Date().toISOString() }
 *
 * Lightweight index with ${ allEmoji.length } emoji.
 * SVG data is loaded on-demand from the server.
 *
 * @file
 */

( function () {
	'use strict';

	/**
	 * Emoji categories
	 */
	const CATEGORIES = [
`;

// Add categories sorted by order
const sortedCats = Object.entries( EMOJI_CATEGORIES ).sort( ( a, b ) => a[ 1 ].order - b[ 1 ].order );
for ( const [ catId, catInfo ] of sortedCats ) {
	const count = categories[ catId ] ? categories[ catId ].length : 0;
	output += `\t\t{ id: '${ catId }', name: '${ catInfo.name }', icon: '${ catInfo.icon }', count: ${ count } },\n`;
}

output += `\t];

	/**
	 * Emoji index by category
	 */
	const EMOJI_INDEX = {
`;

// Track stats
let withNames = 0;
let withoutNames = 0;

// Add emoji index
for ( const [ catId ] of sortedCats ) {
	if ( !categories[ catId ] || categories[ catId ].length === 0 ) {
		output += `\t\t'${ catId }': [],\n`;
		continue;
	}

	output += `\t\t'${ catId }': [\n`;
	for ( const emoji of categories[ catId ] ) {
		// Store filename, char, name, and keywords (as space-separated string for compact size)
		const keywordsStr = emoji.keywords.length > 0 ? emoji.keywords.join( ' ' ) : '';
		if ( emoji.name ) {
			withNames++;
			// Include name (n) and keywords (k) for searchability
			output += `\t\t\t{ f: '${ emoji.filename }', c: '${ emoji.char }', n: '${ emoji.name.replace( /'/g, '\\u0027' ) }', k: '${ keywordsStr.replace( /'/g, '\\u0027' ) }' },\n`;
		} else {
			withoutNames++;
			// Fallback: just filename and char
			output += `\t\t\t{ f: '${ emoji.filename }', c: '${ emoji.char }' },\n`;
		}
	}
	output += `\t\t],\n`;
}

console.log( `Emoji with names: ${ withNames }, without names: ${ withoutNames }` );

output += `\t};

	// SVG cache
	const svgCache = {};

	/**
	 * Emoji Library API (lightweight, on-demand loading)
	 */
	window.Layers = window.Layers || {};
	window.Layers.EmojiLibrary = {
		/**
		 * Base path for emoji SVG files
		 */
		basePath: mw.config.get( 'wgExtensionAssetsPath' ) + '/Layers/resources/ext.layers.editor/shapeLibrary/assets/noto_emoji/',

		/**
		 * Get all categories
		 *
		 * @return {Object[]}
		 */
		getCategories() {
			return CATEGORIES;
		},

		/**
		 * Get emoji list for a category (metadata only, no SVG)
		 *
		 * @param {string} categoryId
		 * @return {Object[]} Array of { f: filename, c: char }
		 */
		getByCategory( categoryId ) {
			return EMOJI_INDEX[ categoryId ] || [];
		},

		/**
		 * Load SVG for an emoji (async)
		 *
		 * @param {string} filename - e.g., "emoji_u1f600.svg"
		 * @return {Promise<string>} SVG content
		 */
		loadSVG( filename ) {
			if ( svgCache[ filename ] ) {
				return Promise.resolve( svgCache[ filename ] );
			}

			return fetch( this.basePath + filename )
				.then( ( response ) => {
					if ( !response.ok ) {
						throw new Error( 'Failed to load emoji: ' + filename );
					}
					return response.text();
				} )
				.then( ( svg ) => {
					svgCache[ filename ] = svg;
					return svg;
				} );
		},

		/**
		 * Get cached SVG (sync, returns null if not loaded)
		 *
		 * @param {string} filename
		 * @return {string|null}
		 */
		getCachedSVG( filename ) {
			return svgCache[ filename ] || null;
		},

		/**
		 * Preload SVGs for a category
		 *
		 * @param {string} categoryId
		 * @return {Promise}
		 */
		preloadCategory( categoryId ) {
			const emoji = EMOJI_INDEX[ categoryId ] || [];

			// Load in batches of 20
			const batchSize = 20;
			const batches = [];

			for ( let i = 0; i < emoji.length; i += batchSize ) {
				batches.push( emoji.slice( i, i + batchSize ) );
			}

			return batches.reduce( ( promise, batch ) => {
				return promise.then( () => {
					return Promise.all( batch.map( ( e ) => {
						return this.loadSVG( e.f ).catch( () => null );
					} ) );
				} );
			}, Promise.resolve() );
		},

		/**
		 * Get total emoji count
		 *
		 * @return {number}
		 */
		getTotalCount() {
			return ${ allEmoji.length };
		}
	};
}() );
`;

// Write output
fs.writeFileSync( OUTPUT_FILE, output );

const stats = fs.statSync( OUTPUT_FILE );
const sizeKB = ( stats.size / 1024 ).toFixed( 1 );

console.log( `Generated ${ OUTPUT_FILE }` );
console.log( `File size: ${ sizeKB } KB` );
console.log( '\nCategories:' );
for ( const [ catId, catInfo ] of sortedCats ) {
	const count = categories[ catId ] ? categories[ catId ].length : 0;
	console.log( `  ${ catInfo.name }: ${ count } emoji` );
}
console.log( `\nTotal: ${ allEmoji.length } emoji` );
