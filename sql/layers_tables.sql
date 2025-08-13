-- Database schema for Layers extension
-- Creates tables for storing layer sets and library assets
-- Updated to include foreign key constraints for referential integrity

CREATE TABLE /*_*/layer_sets (
    ls_id int unsigned NOT NULL AUTO_INCREMENT,
    ls_img_name varchar(255) binary NOT NULL,
    ls_img_major_mime varchar(16) NOT NULL,
    ls_img_minor_mime varchar(100) NOT NULL,
    ls_img_sha1 varchar(32) NOT NULL,
    ls_json_blob mediumblob NOT NULL,
    ls_user_id int unsigned NOT NULL,
    ls_timestamp binary(14) NOT NULL,
    ls_revision int unsigned NOT NULL DEFAULT 1,
    ls_name varchar(255) DEFAULT NULL,
    ls_size int unsigned NOT NULL DEFAULT 0,
    ls_layer_count tinyint unsigned NOT NULL DEFAULT 0,
    PRIMARY KEY (ls_id),
    UNIQUE KEY ls_img_name_revision (ls_img_name, ls_img_sha1, ls_revision),
    KEY ls_img_lookup (ls_img_name, ls_img_sha1),
    KEY ls_user_timestamp (ls_user_id, ls_timestamp),
    KEY ls_timestamp (ls_timestamp),
    KEY ls_size_performance (ls_size, ls_layer_count),
    -- Foreign key constraint to ensure user exists
    CONSTRAINT fk_layer_sets_user_id FOREIGN KEY (ls_user_id) REFERENCES /*_*/user (user_id) ON DELETE CASCADE
) /*$wgDBTableOptions*/;

CREATE TABLE /*_*/layer_assets (
    la_id int unsigned NOT NULL AUTO_INCREMENT,
    la_title varchar(255) binary NOT NULL,
    la_json_blob mediumblob NOT NULL,
    la_preview_sha1 varchar(32) DEFAULT NULL,
    la_user_id int unsigned NOT NULL,
    la_timestamp binary(14) NOT NULL,
    la_size int unsigned NOT NULL DEFAULT 0,
    PRIMARY KEY (la_id),
    UNIQUE KEY la_title (la_title),
    KEY la_user_timestamp (la_user_id, la_timestamp),
    KEY la_size (la_size),
    -- Foreign key constraint to ensure user exists
    CONSTRAINT fk_layer_assets_user_id FOREIGN KEY (la_user_id) REFERENCES /*_*/user (user_id) ON DELETE CASCADE
) /*$wgDBTableOptions*/;

CREATE TABLE /*_*/layer_set_usage (
    lsu_layer_set_id int unsigned NOT NULL,
    lsu_page_id int unsigned NOT NULL,
    lsu_timestamp binary(14) NOT NULL,
    lsu_usage_count int unsigned NOT NULL DEFAULT 1,
    PRIMARY KEY (lsu_layer_set_id, lsu_page_id),
    KEY lsu_page_id (lsu_page_id),
    KEY lsu_timestamp (lsu_timestamp),
    KEY lsu_usage_count (lsu_usage_count),
    -- Foreign key constraints to ensure referenced records exist
    CONSTRAINT fk_layer_set_usage_layer_set_id FOREIGN KEY (lsu_layer_set_id) REFERENCES /*_*/layer_sets (ls_id) ON DELETE CASCADE,
    CONSTRAINT fk_layer_set_usage_page_id FOREIGN KEY (lsu_page_id) REFERENCES /*_*/page (page_id) ON DELETE CASCADE
) /*$wgDBTableOptions*/;
