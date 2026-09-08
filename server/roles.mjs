// Only trusted Supabase identity fields can grant this cosmetic badge.
export function isGameMaster(user) {
 return !!user.email_confirmed_at && user.email?.trim().toLowerCase() === 'yusufmohdsuhair@gmail.com';
}
