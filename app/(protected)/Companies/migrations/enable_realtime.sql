-- Enable realtime for the companies table
alter publication supabase_realtime add table companies;

-- Enable replication on the companies table
alter table companies replica identity full; 