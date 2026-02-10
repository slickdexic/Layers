-- Create layer_set_usage table
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
