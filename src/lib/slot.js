import moment from 'moment';

// A scheduled slot is stored as a local calendar date plus a local time in the
// business's own timezone, so it is shown exactly as chosen - never converted.
export function slotLabel(post) {
  if (!post?.scheduled_date) return 'Not scheduled';
  const m = moment(`${post.scheduled_date} ${post.scheduled_time || '09:00'}`, 'YYYY-MM-DD HH:mm');
  return m.isValid() ? m.format('ddd, MMM D · h:mm A') : post.scheduled_date;
}

export function dayLabel(post) {
  if (!post?.scheduled_date) return '-';
  const m = moment(post.scheduled_date, 'YYYY-MM-DD');
  return m.isValid() ? m.format('MMM D') : post.scheduled_date;
}