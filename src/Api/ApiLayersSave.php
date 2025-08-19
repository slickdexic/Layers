<?php

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\MediaWikiServices;

class ApiLayersSave extends ApiBase
{
    /**
     * Main execution function
     *
     * @throws \ApiUsageException When user lacks permission or data is invalid
     * @throws \Exception When database operations fail
     */
    public function execute()
    {
        $user = $this->getUser();
        $params = $this->extractRequestParams();
        $this->checkUserRightsAny('editlayers');
        // Ensure DB schema is present (helpful error if extension tables are missing)
        if (!$this->isSchemaInstalled()) {
            $this->dieWithError([ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ], 'dbschema-missing');
        }

        $fileName = $params['filename'];
        $data = $params['data'];
        $setName = $params['setname'] ?? 'default';
        // Sanitize user-provided set name to prevent XSS or invalid content
        if (is_string($setName)) {
            $setName = $this->sanitizeTextInput($setName);
            if ($setName === '') {
                $setName = 'default';
            }
            // Enforce sane length
            if (strlen($setName) > 255) {
                $setName = substr($setName, 0, 255);
            }
        } else {
            $setName = 'default';
        }

        if (!$this->isValidFilename($fileName)) {
            $this->dieWithError('layers-invalid-filename', 'invalidfilename');
        }

        $maxBytes = $this->getConfig()->get('LayersMaxBytes') ?: 2097152;
        if (strlen($data) > $maxBytes) {
            $this->dieWithError('layers-data-too-large', 'datatoolarge');
        }

        $layersData = json_decode($data, true);
        if ($layersData === null) {
            $this->dieWithError('layers-json-parse-error', 'invalidjson');
        }

        $sanitizedData = $this->validateAndSanitizeLayersData($layersData);
        if ($sanitizedData === false) {
            $this->dieWithError('layers-invalid-data', 'invaliddata');
        }

        // Rate limiting
        $rateLimiter = new RateLimiter();
        if (!$rateLimiter->checkRateLimit($user, 'save')) {
            $this->dieWithError('layers-rate-limited', 'ratelimited');
        }

        // Resolve file and gather metadata
        $repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
        $file = $repoGroup->findFile($fileName);
        if (!$file || !$file->exists()) {
            $this->dieWithError('layers-file-not-found', 'filenotfound');
        }
        $mime = $file->getMimeType() ?: '';
        $parts = explode('/', $mime, 2);
        $majorMime = $parts[0] ?? '';
        $minorMime = $parts[1] ?? '';
        $sha1 = $file->getSha1();

        $db = new LayersDatabase();
        $result = $db->saveLayerSet(
            $file->getName(),
            $majorMime,
            $minorMime,
            $sha1,
            $sanitizedData,
            (int)$user->getId(),
            $setName
        );

        if ($result) {
            $this->getResult()->addValue(null, $this->getModuleName(), [
                'success' => 1,
                'layersetid' => (int)$result,
                'result' => 'Success'
            ]);
        } else {
            $this->dieWithError('layers-save-failed', 'savefailed');
        }
    }

    /**
     * Check whether required DB schema exists
     *
     * @return bool True if layer tables exist and are accessible
     */
    private function isSchemaInstalled(): bool
    {
        try {
            $services = MediaWikiServices::getInstance();
            $lb = $services->getDBLoadBalancer();
            if (!$lb) {
                return false;
            }
            // Use write connection to match the target of INSERTs and avoid schema drift on replicas
            if (defined('DB_PRIMARY')) {
                $dbr = $lb->getConnection(DB_PRIMARY);
            } elseif (defined('DB_MASTER')) {
                // Fallback for older MediaWiki versions
                $dbr = $lb->getConnection(DB_PRIMARY);
            } else {
                $dbr = $lb->getConnection(0);
            }
            if (!\is_object($dbr)) {
                return false;
            }
            // fieldInfo handles table prefixes; existence implies table is created
            return (bool)$dbr->fieldInfo('layer_sets', 'ls_id');
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Validates and sanitizes layer data.
     * Returns sanitized data array on success, false on failure.
     *
     * @param array $layersData The raw layer data array to validate
     * @return array|false Sanitized layer data array on success, false on validation failure
     */
    private function validateAndSanitizeLayersData(array $layersData)
    {
        if (!is_array($layersData)) {
            return false;
        }
        $maxLayers = $this->getConfig()->get('LayersMaxLayerCount') ?: 100;
        if (count($layersData) > $maxLayers) {
            return false;
        }
        $validTypes = [
            'text', 'arrow', 'rectangle', 'circle', 'ellipse',
            'polygon', 'star', 'line', 'highlight', 'path', 'blur'
        ];

        $sanitized = [];

        // Define strict value constraints for enhanced security
        $valueConstraints = [
            'type' => $validTypes,
            'blendMode' => [ 'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion' ],
            'arrowhead' => [ 'none', 'arrow', 'circle', 'diamond', 'triangle' ],
            'arrowStyle' => [ 'solid', 'dashed', 'dotted' ],
            'fontFamily' => [ 'Arial', 'Helvetica', 'Times', 'Times New Roman', 'Courier', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact' ]
        ];

        foreach ($layersData as $layer) {
            if (!is_array($layer) || !isset($layer['type']) || !in_array($layer['type'], $validTypes, true)) {
                return false; // Invalid layer structure
            }

            $cleanLayer = [];
            // Whitelist of allowed properties and their expected types
            $allowedProps = [
                'type' => 'string', 'x' => 'numeric', 'y' => 'numeric',
                'text' => 'string', 'fontSize' => 'numeric', 'color' => 'string',
                'width' => 'numeric', 'strokeWidth' => 'numeric', 'height' => 'numeric',
                'stroke' => 'string', 'fill' => 'string', 'radius' => 'numeric',
                'opacity' => 'numeric', 'fillOpacity' => 'numeric', 'strokeOpacity' => 'numeric',
                'blendMode' => 'string', 'id' => 'string',
                'name' => 'string', 'visible' => 'boolean', 'locked' => 'boolean',
                'textStrokeColor' => 'string', 'textStrokeWidth' => 'numeric', 'textShadowColor' => 'string',
                'shadowColor' => 'string', 'points' => 'array', 'sides' => 'numeric',
                'startAngle' => 'numeric', 'endAngle' => 'numeric', 'innerRadius' => 'numeric',
                'outerRadius' => 'numeric', 'arrowhead' => 'string',
                // Line coordinates for line and arrow layers
                'x1' => 'numeric', 'y1' => 'numeric', 'x2' => 'numeric', 'y2' => 'numeric',
                // Effects used by CanvasManager
                'shadow' => 'boolean', 'shadowBlur' => 'numeric',
                'shadowOffsetX' => 'numeric', 'shadowOffsetY' => 'numeric',
                'shadowSpread' => 'numeric',
                // Text-specific shadow toggle used by drawText
                'textShadow' => 'boolean',
                'glow' => 'boolean',
                // Blur layer property
                'blurRadius' => 'numeric',
                // Ellipse properties
                'radiusX' => 'numeric', 'radiusY' => 'numeric',
                // Arrow properties
                'arrowSize' => 'numeric', 'arrowStyle' => 'string',
                // Common editor props
                'rotation' => 'numeric', 'fontFamily' => 'string',
                // Accept editor alias for blend mode
                'blend' => 'string'
            ];

            foreach ($allowedProps as $prop => $type) {
                if (isset($layer[$prop])) {
                    $value = $layer[$prop];
                    $isValid = false;

                    // Type validation with enhanced security checks
                    if ($type === 'string' && is_string($value)) {
                        // Apply strict length limits
                        if (strlen($value) > 1000) {
                            continue; // Skip overly long values
                        }

                        // Sanitize string values based on field type
                        if (in_array($prop, [ 'text', 'name' ], true)) {
                            // User-generated text - strict sanitization
                            $value = $this->sanitizeTextInput($value);
                            if (empty(trim($value)) && $prop === 'text') {
                                continue; // Skip empty text layers
                            }
                        } elseif (in_array($prop, [ 'id', 'type', 'blendMode', 'blend', 'arrowhead', 'arrowStyle', 'fontFamily' ], true)) {
                            // Predefined values - use whitelist validation
                            if (isset($valueConstraints[$prop])) {
                                if (!in_array($value, $valueConstraints[$prop], true)) {
                                    continue; // Skip invalid predefined values
                                }
                            } else {
                                $value = $this->sanitizeIdentifier($value);
                            }
                        } else {
                            // Other string values (should be colors)
                            $value = $this->sanitizeColor($value);
                        }
                        $isValid = true;
                    } elseif ($type === 'numeric' && is_numeric($value)) {
                        // Apply reasonable numeric limits to prevent overflow
                        $numValue = (float)$value;
                        if ($numValue < -100000 || $numValue > 100000) {
                            continue; // Skip extreme values
                        }
                        if (in_array($prop, [ 'opacity', 'fillOpacity', 'strokeOpacity' ], true)) {
                            // Opacity values must be between 0 and 1
                            if ($numValue < 0 || $numValue > 1) {
                                continue;
                            }
                        }
                        $value = $numValue;
                        $isValid = true;
                    } elseif ($type === 'boolean') {
                        // Accept various boolean representations from JavaScript
                        if (is_bool($value) || $value === 1 || $value === 0 || $value === '1' || $value === '0' || $value === 'true' || $value === 'false') {
                            $isValid = true;
                            // Normalize to proper boolean
                            $value = (bool)$value;
                            if ($value === '0' || $value === 'false') {
                                $value = false;
                            }
                        }
                    } elseif ($type === 'array' && is_array($value)) {
                        // Validate array size to prevent DoS
                        if (count($value) > 1000) {
                            continue; // Skip arrays that are too large
                        }
                        $isValid = true;
                    }

                    if ($isValid) {
                        $cleanLayer[$prop] = $value;
                    }
                }
            }

            // Normalize alias: if 'blend' provided, map to 'blendMode' if not already set (keep original too for client)
            if (isset($cleanLayer['blend']) && !isset($cleanLayer['blendMode']) && is_string($cleanLayer['blend'])) {
                $cleanLayer['blendMode'] = $cleanLayer['blend'];
            }

            // Special handling for points array (path, polygon layers) with enhanced security
            if (
                isset($cleanLayer['type']) &&
                in_array($cleanLayer['type'], [ 'path', 'polygon' ]) &&
                isset($cleanLayer['points']) &&
                is_array($cleanLayer['points'])
            ) {
                $cleanPoints = [];
                $maxPoints = 1000; // Prevent DoS attacks with excessive points
                $pointCount = 0;

                foreach ($cleanLayer['points'] as $point) {
                    if ($pointCount >= $maxPoints) {
                        break; // Limit number of points
                    }

                    if (
                        is_array($point) && isset($point['x']) && isset($point['y']) &&
                        is_numeric($point['x']) && is_numeric($point['y'])
                    ) {
                        $x = (float)$point['x'];
                        $y = (float)$point['y'];

                        // Validate coordinate ranges to prevent extreme values
                        if ($x >= -100000 && $x <= 100000 && $y >= -100000 && $y <= 100000) {
                            $cleanPoints[] = [
                                'x' => $x,
                                'y' => $y
                            ];
                            $pointCount++;
                        }
                    }
                }
                $cleanLayer['points'] = $cleanPoints;
            }

            // Validate color values
            foreach ([ 'stroke', 'fill', 'color', 'textStrokeColor', 'textShadowColor', 'shadowColor' ] as $colorField) {
                if (isset($cleanLayer[$colorField])) {
                    $cleanLayer[$colorField] = $this->sanitizeColor($cleanLayer[$colorField]);
                }
            }
            $sanitized[] = $cleanLayer;
        }
        return $sanitized;
    }

    /**
     * Validate filename for security
     *
     * @param string $filename The filename to validate
     * @return bool True if filename is safe and valid
     */
    private function isValidFilename(string $filename): bool
    {
        // Basic filename validation
        if (strlen($filename) > 255 || strlen($filename) < 1) {
            return false;
        }

        // Check for path traversal attempts
        if (strpos($filename, '..') !== false || strpos($filename, '/') !== false) {
            return false;
        }

        // Allow alphanumerics, spaces, dots, dashes, underscores and parentheses
        if (!preg_match('/^[\w .()\-]+$/u', $filename)) {
            return false;
        }

        return true;
    }

    /**
     * Validate color values with enhanced security to prevent CSS injection
     *
     * @param mixed $color The color value to validate (string, array, or other)
     * @return bool True if color is valid and safe
     */
    private function isValidColor($color): bool
    {
        if (!is_string($color)) {
            return false;
        }

        // Prevent extremely long color strings (potential DoS)
        if (strlen($color) > 50) {
            return false;
        }

        // Remove any whitespace and convert to lowercase for consistent validation
        $color = trim(strtolower($color));

        // Reject empty strings
        if (empty($color)) {
            return false;
        }

        // Check for dangerous characters that could be used for CSS injection
        if (preg_match('/[<>"\'\\\\\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $color)) {
            return false;
        }

        // Check for CSS escape sequences or expressions
        if (preg_match('/\\\\|expression|javascript|@import|url\(|\/\*|\*\//', $color)) {
            return false;
        }

        // Allow hex colors with strict validation (3, 4, 6, 8 digits only)
        if (preg_match('/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/', $color)) {
            return true;
        }

        // Allow rgb/rgba with very strict validation
        if (preg_match('/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/', $color, $matches)) {
            // Validate RGB values are in 0-255 range
            for ($i = 1; $i <= 3; $i++) {
                $value = (int)$matches[$i];
                if ($value < 0 || $value > 255) {
                    return false;
                }
            }
            return true;
        }

        // Allow rgba with alpha validation
        if (preg_match('/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)\s*\)$/', $color, $matches)) {
            // Validate RGB values are in 0-255 range
            for ($i = 1; $i <= 3; $i++) {
                $value = (int)$matches[$i];
                if ($value < 0 || $value > 255) {
                    return false;
                }
            }
            // Validate alpha is between 0 and 1
            $alpha = (float)$matches[4];
            if ($alpha < 0 || $alpha > 1) {
                return false;
            }
            return true;
        }

        // Allow HSL with strict validation
        if (preg_match('/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/', $color, $matches)) {
            $hue = (int)$matches[1];
            $saturation = (int)$matches[2];
            $lightness = (int)$matches[3];

            if ($hue < 0 || $hue > 360 || $saturation < 0 || $saturation > 100 || $lightness < 0 || $lightness > 100) {
                return false;
            }
            return true;
        }

        // Allow HSLA with strict validation
        if (preg_match('/^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)\s*\)$/', $color, $matches)) {
            $hue = (int)$matches[1];
            $saturation = (int)$matches[2];
            $lightness = (int)$matches[3];
            $alpha = (float)$matches[4];

            if (
                $hue < 0 || $hue > 360 || $saturation < 0 || $saturation > 100 ||
                 $lightness < 0 || $lightness > 100 || $alpha < 0 || $alpha > 1
            ) {
                return false;
            }
            return true;
        }

        // Very strict whitelist of named colors (prevent CSS injection via unknown color names)
        $safeColors = [
            'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
            'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime',
            'navy', 'maroon', 'olive', 'teal', 'silver', 'aqua', 'fuchsia',
            'darkred', 'darkgreen', 'darkblue', 'lightgray', 'lightgrey', 'darkgray', 'darkgrey'
        ];

        return in_array($color, $safeColors, true);
    }

    /**
     * Sanitize color values to prevent injection attacks
     *
     * @param mixed $color The color value to sanitize
     * @return string Safe, sanitized color value
     */
    private function sanitizeColor($color): string
    {
        if (!is_string($color)) {
            return '#000000';
        }

        // If it passes strict validator, return as-is
        if ($this->isValidColor($color)) {
            return $color;
        }

        // Try to coerce common slightly-off formats (e.g., spaces/no spaces in rgba/hsl)
        $normalized = trim($color);
        // Collapse multiple spaces
        $normalized = preg_replace('/\s+/', ' ', $normalized);

        if ($this->isValidColor($normalized)) {
            return $normalized;
        }

        // Default to black if invalid
        return '#000000';
    }

    /**
     * Get allowed parameters for this API module
     *
     * @return array Array of parameter definitions for filename, data, setname, and token
     */
    public function getAllowedParams()
    {
        return [
            'filename' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
            'data' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
            'setname' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => false,
            ],
            'token' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
        ];
    }

    /**
     * Check if this API module needs a token
     *
     * @return string Type of token required ('csrf' for write operations)
     */
    public function needsToken()
    {
        return 'csrf';
    }

    /**
     * Check if this API module is in write mode
     *
     * @return bool True since this module modifies data
     */
    public function isWriteMode()
    {
        return true;
    }

    /**
     * Sanitize text input to prevent XSS attacks
     * Uses secure whitelist-based approach instead of complex multi-step sanitization
     *
     * @param string $text The text input to sanitize
     * @return string Safe, sanitized text
     */
    private function sanitizeTextInput(string $text): string
    {
        // Limit text length to prevent DoS attacks
        if (strlen($text) > 1000) {
            $text = substr($text, 0, 1000);
        }

        // Simple but secure approach: strip all HTML tags first
        $text = strip_tags($text);

        // Remove any protocol handlers that could be dangerous
        $text = preg_replace('/(?:javascript|data|vbscript|file|about):/i', '', $text);

        // Remove event handlers that might slip through
        $text = preg_replace('/on\w+\s*=/i', '', $text);

        // Remove any remaining angle brackets to prevent HTML injection
        $text = str_replace([ '<', '>' ], '', $text);

        // Final safety: encode any remaining special characters
        $text = htmlspecialchars($text, ENT_QUOTES | ENT_HTML5, 'UTF-8', false);

        return trim($text);
    }

    /**
     * Sanitize identifier fields (id, type, etc.) to ensure they contain only safe values
     *
     * @param string $identifier The identifier to sanitize
     * @return string Safe, sanitized identifier
     */
    private function sanitizeIdentifier(string $identifier): string
    {
        // Limit length
        if (strlen($identifier) > 100) {
            $identifier = substr($identifier, 0, 100);
        }

        // Allow only alphanumeric characters, hyphens, underscores
        $identifier = preg_replace('/[^a-zA-Z0-9_-]/', '', $identifier);

        return trim($identifier);
    }

    /**
     * Get example messages for this API module
     *
     * @return array Array of example API calls with descriptions
     */
    public function getExamplesMessages()
    {
        return [
            // Example: action=layerssave&filename=Example.jpg&data=[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC
            'action=layerssave&filename=Example.jpg&data=' .
                '[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC' =>
                'apihelp-layerssave-example-1',
        ];
    }
}
