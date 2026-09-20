// This grants server privileges, not just a badge. Only verified Auth IDs count.
export function isGameMaster(user, ids = process.env.GM_USER_IDS || '') {
 return !!user?.email_confirmed_at && !user.is_anonymous && typeof user.id === 'string'
  && ids.split(',').map(id => id.trim()).filter(Boolean).includes(user.id);
}
