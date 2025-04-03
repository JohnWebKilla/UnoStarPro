-- Enable realtime for the drivers table
alter publication supabase_realtime add table drivers;

-- Enable replication on the drivers table
alter table drivers replica identity full; 