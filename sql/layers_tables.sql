-- Database schema for Layers extension
-- Creates tables for storing layer sets and library assets
-- Note: MediaWiki convention is to not use FOREIGN KEY constraints;
-- referential integrity is enforced at the application level.

CREATE TABLE /*_*/layer_sets (
    ls_id int unsigned NOT NULL AUTO_INCREMENT,
    ls_img_name varchar(255) binary NOT NULL,
    ls_img_major_mime varchar(16) NOT NULL,
    ls_img_minor_mime varchar(100) NOT NULL,
    ls_img_sha1 varchar(32) NOT NULL,
    ls_json_blob mediumblob NOT NULL,
    ls_user_id int unsigned DEFAULT NULL,
    ls_timestamp binary(14) NOT NULL,
    ls_revision int unsigned NOT NULL DEFAULT 1,
    ls_name varchar(255) NOT NULL DEFAULT 'default',
    ls_size int unsigned NOT NULL DEFAULT 0,
    ls_layer_count tinyint unsigned NOT NULL DEFAULT 0,
    PRIMARY KEY (ls_id),
    UNIQUE KEY ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision),
    KEY ls_img_lookup (ls_img_name, ls_img_sha1),
    KEY ls_user_timestamp (ls_user_id, ls_timestamp),
    KEY ls_timestamp (ls_timestamp),
    KEY ls_size_performance (ls_size, ls_layer_count)
) /*$wgDBTableOptions*/;

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

CREATE TABLE /*_*/layer_set_usage (
    lsu_layer_set_id int unsigned NOT NULL,
    lsu_page_id int unsigned NOT NULL,
    lsu_timestamp binary(14) NOT NULL,
    lsu_usage_count int unsigned NOT NULL DEFAULT 1,
    PRIMARY KEY (lsu_layer_set_id, lsu_page_id),
    KEY lsu_page_id (lsu_page_id),
    KEY lsu_timestamp (lsu_timestamp),
    KEY lsu_usage_count (lsu_usage_count)
) /*$wgDBTableOptions*/;
