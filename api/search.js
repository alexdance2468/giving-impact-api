create or replace function run_query(query text)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  execute 'select json_agg(t) from (' || query || ') t' into result;
  return result;
end;
$$;
