-- cron·service_role 실행도 호출자별 search_path를 상속하지 않게 고정한다.
alter function public.lf_cancel_actor_check_reminders()
  set search_path = public, pg_temp;
alter function public.lf_cancel_terminal_check_reminders()
  set search_path = public, pg_temp;
alter function public.lf_fulfillment_reopen(uuid, uuid, uuid, public.surface)
  set search_path = public, pg_temp;
alter function public.lf_fulfillment_submit(
  uuid, uuid, uuid, public.fulfillment_answer, text, boolean, public.surface
)
  set search_path = public, pg_temp;
alter function public.lf_participant_promise_list(uuid)
  set search_path = public, pg_temp;
alter function public.lf_policy_config_int(text)
  set search_path = public, pg_temp;
alter function public.lf_promise_fulfillment_detail(uuid, uuid)
  set search_path = public, pg_temp;
alter function public.lf_promises_close_due_checks(timestamptz)
  set search_path = public, pg_temp;
alter function public.lf_promises_enter_checking(timestamptz)
  set search_path = public, pg_temp;
alter function public.lf_recompute_promise_trust_profiles(uuid)
  set search_path = public, pg_temp;
alter function public.lf_recompute_trust_profile(uuid)
  set search_path = public, pg_temp;
alter function public.lf_reminder_send_hour_kst()
  set search_path = public, pg_temp;
alter function public.lf_trust_min_sample()
  set search_path = public, pg_temp;
