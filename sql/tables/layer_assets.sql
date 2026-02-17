-- Create layer_assets table
CREATE TABLE /*_*/layer_assets (
    la_id int unsigned NOT NULL AUTO_INCREMENT,
    la_title varchar(255) binary NOT NULL,
    la_json_blob mediumblob NOT NULL,
    la_preview_sha1 varchar(32) DEFAULT NULL,
    la_user_id int unsigned DEFAULT NULL,
    la_timestamp binary(14) NOT NULL,
    la_size int unsigned NOT NULL DEFAULT 0,
    PRIMARY KEY (la_id),
    UNIQUE KEY la_title (la_title),
    KEY la_user_timestamp (la_user_id, la_timestamp),
    KEY la_size (la_size)
) /*$wgDBTableOptions*/;
