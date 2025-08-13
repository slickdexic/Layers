-- Create layer_set_usage table
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
