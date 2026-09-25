-- SQLite installation schema. Keep columns and indexes aligned with ../layer_sets.sql.
CREATE TABLE /*_*/layer_sets (
    ls_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    ls_img_name TEXT NOT NULL,
    ls_img_major_mime TEXT NOT NULL,
    ls_img_minor_mime TEXT NOT NULL,
    ls_img_sha1 TEXT NOT NULL,
    ls_json_blob BLOB NOT NULL,
    ls_user_id INTEGER DEFAULT NULL,
    ls_timestamp BLOB NOT NULL,
    ls_revision INTEGER NOT NULL DEFAULT 1,
    ls_name TEXT NOT NULL DEFAULT 'default',
    ls_page INTEGER NOT NULL DEFAULT 1,
    ls_size INTEGER NOT NULL DEFAULT 0,
    ls_layer_count INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX /*i*/ls_img_name_set_page_revision
    ON /*_*/layer_sets (ls_img_name, ls_img_sha1, ls_name, ls_page, ls_revision);
CREATE INDEX /*i*/ls_img_lookup ON /*_*/layer_sets (ls_img_name, ls_img_sha1);
CREATE INDEX /*i*/ls_user_timestamp ON /*_*/layer_sets (ls_user_id, ls_timestamp);
CREATE INDEX /*i*/ls_timestamp ON /*_*/layer_sets (ls_timestamp);
CREATE INDEX /*i*/ls_size_performance ON /*_*/layer_sets (ls_size, ls_layer_count);
