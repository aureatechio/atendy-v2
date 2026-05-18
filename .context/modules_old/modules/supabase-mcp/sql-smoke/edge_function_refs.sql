select
  n.nspname as schema_name,
  p.proname as function_name,
  case
    when p.prosrc ilike '%cfgeilnppnlyhwnabkox%' then 'atendy_ref'
    when p.prosrc ilike '%https://cfgeilnppnlyhwnabkox.supabase.co%' then 'atendy_url'
    when p.prosrc ilike '%awqtzoefutnfmnbomujt%' then 'non_atendy_ref'
    else 'no_known_ref'
  end as reference_match
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema')
  and (
    p.prosrc ilike '%cfgeilnppnlyhwnabkox%'
    or p.prosrc ilike '%https://cfgeilnppnlyhwnabkox.supabase.co%'
    or p.prosrc ilike '%awqtzoefutnfmnbomujt%'
  )
order by n.nspname, p.proname;
