-- Create layer_sets table
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
    ls_layer_count smallint unsigned NOT NULL DEFAULT 0,
    PRIMARY KEY (ls_id),
    UNIQUE KEY ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision),
    KEY ls_img_lookup (ls_img_name, ls_img_sha1),
    KEY ls_user_timestamp (ls_user_id, ls_timestamp),
    KEY ls_timestamp (ls_timestamp),
    KEY ls_size_performance (ls_size, ls_layer_count)
) /*$wgDBTableOptions*/;
