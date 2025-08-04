-- Database schema for Layers extension
-- Creates tables for storing layer sets and library assets

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
    PRIMARY KEY (ls_id),
    KEY ls_img_lookup (ls_img_name, ls_img_sha1),
    KEY ls_user_timestamp (ls_user_id, ls_timestamp),
    KEY ls_img_name_revision (ls_img_name, ls_revision)
) /*$wgDBTableOptions*/;

CREATE TABLE /*_*/layer_assets (
    la_id int unsigned NOT NULL AUTO_INCREMENT,
    la_title varchar(255) binary NOT NULL,
    la_json_blob mediumblob NOT NULL,
    la_preview_sha1 varchar(32) DEFAULT NULL,
    la_user_id int unsigned NOT NULL,
    la_timestamp binary(14) NOT NULL,
    PRIMARY KEY (la_id),
    UNIQUE KEY la_title (la_title),
    KEY la_user_timestamp (la_user_id, la_timestamp)
) /*$wgDBTableOptions*/;

CREATE TABLE /*_*/layer_set_usage (
    lsu_layer_set_id int unsigned NOT NULL,
    lsu_page_id int unsigned NOT NULL,
    lsu_timestamp binary(14) NOT NULL,
    PRIMARY KEY (lsu_layer_set_id, lsu_page_id),
    KEY lsu_page_id (lsu_page_id),
    KEY lsu_timestamp (lsu_timestamp)
) /*$wgDBTableOptions*/;
