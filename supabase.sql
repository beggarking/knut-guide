-- 교통대 생활 가이드: 추천·비추천 투표 테이블
-- Supabase 대시보드 → SQL Editor에 그대로 붙여 넣고 Run

create table if not exists votes (
  place text primary key,
  up integer not null default 0,
  down integer not null default 0
);

-- 누구나 읽기만 가능. 쓰기는 아래 vote 함수로만
alter table votes enable row level security;
drop policy if exists "anyone can read votes" on votes;
create policy "anyone can read votes" on votes for select using (true);

-- 한 번에 +1/-1만 바꿀 수 있는 투표 함수
create or replace function vote(p_place text, p_up integer, p_down integer)
returns votes
language plpgsql
security definer
set search_path = public
as $$
declare
  r votes;
begin
  if abs(p_up) > 1 or abs(p_down) > 1 or length(p_place) not between 1 and 200 then
    raise exception 'invalid vote';
  end if;
  insert into votes (place, up, down)
  values (p_place, greatest(p_up, 0), greatest(p_down, 0))
  on conflict (place) do update
    set up = greatest(votes.up + p_up, 0),
        down = greatest(votes.down + p_down, 0)
  returning * into r;
  return r;
end;
$$;

revoke all on function vote(text, integer, integer) from public;
grant execute on function vote(text, integer, integer) to anon, authenticated;
