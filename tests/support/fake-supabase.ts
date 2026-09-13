import crypto from 'node:crypto';

type Row = Record<string, any>;
type Spec = {unique: string[][]; defaults: (row: Row) => Row};

// Just enough PostgREST for the social store: filters, ordering, limits, unique violations
// with Postgres' own code, and the generated conversation pair.
export function fakeSupabase() {
  const users: {id: string; token: string; name: string; anonymous: boolean}[] = [];
  const tables: Record<string, Row[]> = {player_handles: [], game_messages: [], player_blocks: [], game_friendships: []};
  let clock = Date.parse('2026-09-13T00:00:00.000Z');
  const stamp = () => new Date(++clock).toISOString();
  const specs: Record<string, Spec> = {
    player_handles: {unique: [['user_id'], ['handle']], defaults: row => ({created_at: stamp(), ...row})},
    game_messages: {unique: [['id'], ['sender_user_id', 'client_id']], defaults: row => ({
      id: crypto.randomUUID(), sent_at: stamp(), read_at: null, ...row,
      pair: [row.sender_user_id, row.recipient_user_id].sort().join(':'),
    })},
    player_blocks: {unique: [['blocker_user_id', 'blocked_user_id']], defaults: row => ({created_at: stamp(), ...row})},
    game_friendships: {unique: [['user_id', 'friend_id']], defaults: row => row},
  };
  const special = /[.*+?^${}()|[\]\\]/g;
  const likeToRegExp = (pattern: string) => {
    let source = '';
    for (let index = 0; index < pattern.length; index++) {
      const character = pattern[index];
      if (character === '\\' && index + 1 < pattern.length) source += pattern[++index].replace(special, '\\$&');
      else if (character === '%') source += '.*';
      else if (character === '_') source += '.';
      else source += character.replace(special, '\\$&');
    }
    return new RegExp(`^${source}$`);
  };

  function from(name: string) {
    const rows = tables[name];
    if (!rows) throw Error(`Unexpected table ${name}`);
    const filters: ((row: Row) => boolean)[] = [];
    const orders: [string, boolean][] = [];
    let limit = Infinity, mode = 'select', payload: Row = {}, options: Row = {}, single = false, returning = false;
    const run = () => {
      if (mode === 'insert' || mode === 'upsert') {
        const spec = specs[name];
        const row = spec.defaults({...payload});
        const clash = rows.some(existing => spec.unique.some(keys => keys.every(key => String(existing[key]).toLowerCase() === String(row[key]).toLowerCase())));
        if (clash) return mode === 'upsert' && options.ignoreDuplicates ? {data: null, error: null} : {data: null, error: {code: '23505', message: 'duplicate key value violates unique constraint'}};
        rows.push(row);
        return {data: single ? {...row} : returning ? [{...row}] : null, error: null};
      }
      let found = rows.filter(row => filters.every(filter => filter(row)));
      if (mode === 'update') { for (const row of found) Object.assign(row, payload); return {data: null, error: null}; }
      if (mode === 'delete') { for (const row of found) rows.splice(rows.indexOf(row), 1); return {data: null, error: null}; }
      for (const [key, ascending] of [...orders].reverse()) found = [...found].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
      found = found.slice(0, limit).map(row => ({...row}));
      if (single) return found.length === 1 ? {data: found[0], error: null} : {data: null, error: {code: 'PGRST116', message: 'not one row'}};
      return {data: found, error: null};
    };
    const chain: any = {
      select: () => { returning = true; return chain; },
      insert: (row: Row) => { mode = 'insert'; payload = row; return chain; },
      upsert: (row: Row, opts: Row = {}) => { mode = 'upsert'; payload = row; options = opts; return chain; },
      update: (values: Row) => { mode = 'update'; payload = values; return chain; },
      delete: () => { mode = 'delete'; return chain; },
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain; },
      is: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return chain; },
      lt: (key: string, value: string) => { filters.push(row => row[key] < value); return chain; },
      like: (key: string, pattern: string) => { const re = likeToRegExp(pattern); filters.push(row => re.test(String(row[key]))); return chain; },
      order: (key: string, opts?: {ascending?: boolean}) => { orders.push([key, opts?.ascending !== false]); return chain; },
      limit: (count: number) => { limit = count; return chain; },
      single: () => { single = true; return chain; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
    };
    return chain;
  }

  const friendRows = tables.game_friendships;
  async function rpc(name: string, args: Row) {
    const find = (user: string, friend: string) => friendRows.find(row => row.user_id === user && row.friend_id === friend);
    if (name === 'game_friend_request') {
      if (args.p_user_id === args.p_friend_id) return {data: {requested: false, reason: 'self'}, error: null};
      const same = find(args.p_user_id, args.p_friend_id), reverse = find(args.p_friend_id, args.p_user_id);
      if (same?.status === 'accepted') return {data: {requested: false, reason: 'already_friend'}, error: null};
      if (same?.status === 'pending') return {data: {requested: false, reason: 'pending'}, error: null};
      if (reverse?.status === 'accepted') return {data: {requested: false, reason: 'already_friend'}, error: null};
      if (reverse?.status === 'pending') return {data: {requested: false, reason: 'incoming'}, error: null};
      friendRows.push({user_id: args.p_user_id, friend_id: args.p_friend_id, requested_by: args.p_user_id, user_name: args.p_user_name, friend_name: args.p_friend_name, status: 'pending', requested_at: stamp(), accepted_at: null});
      return {data: {requested: true}, error: null};
    }
    if (name === 'game_friend_respond') {
      const request = find(args.p_friend_id, args.p_user_id);
      if (request?.status !== 'pending') return {data: {responded: false, reason: 'not_pending'}, error: null};
      if (!args.p_approved) { friendRows.splice(friendRows.indexOf(request), 1); return {data: {responded: false, declined: true}, error: null}; }
      const at = stamp();
      Object.assign(request, {status: 'accepted', accepted_at: at, friend_name: args.p_user_name});
      friendRows.push({user_id: args.p_user_id, friend_id: args.p_friend_id, requested_by: args.p_friend_id, user_name: args.p_user_name, friend_name: request.user_name, status: 'accepted', requested_at: at, accepted_at: at});
      return {data: {responded: true, accepted: true}, error: null};
    }
    if (name === 'game_friend_cancel') {
      const request = find(args.p_user_id, args.p_friend_id);
      if (request?.status !== 'pending') return {data: {cancelled: false, reason: 'not_pending'}, error: null};
      friendRows.splice(friendRows.indexOf(request), 1);
      return {data: {cancelled: true}, error: null};
    }
    if (name === 'game_friend_remove') {
      const before = friendRows.length;
      for (let index = friendRows.length - 1; index >= 0; index--) {
        const row = friendRows[index];
        if (row.status === 'accepted' && ((row.user_id === args.p_user_id && row.friend_id === args.p_friend_id) || (row.user_id === args.p_friend_id && row.friend_id === args.p_user_id))) friendRows.splice(index, 1);
      }
      return {data: friendRows.length === before ? {removed: false, reason: 'not_friend'} : {removed: true}, error: null};
    }
    throw Error(`Unexpected RPC ${name}`);
  }

  const authUser = (user: typeof users[number]) => ({id: user.id, is_anonymous: user.anonymous, user_metadata: {display_name: user.name}});
  const db = {
    from,
    rpc,
    auth: {
      getUser: async (token: string) => { const user = users.find(item => item.token === token); return user ? {data: {user: authUser(user)}, error: null} : {data: {user: null}, error: {message: 'invalid token'}}; },
      admin: {getUserById: async (id: string) => { const user = users.find(item => item.id === id); return user ? {data: {user: authUser(user)}, error: null} : {data: {user: null}, error: {message: 'not found'}}; }},
    },
  };
  function addUser({id = crypto.randomUUID(), token = crypto.randomBytes(12).toString('hex'), name, anonymous = false}: {id?: string; token?: string; name: string; anonymous?: boolean}) {
    users.push({id, token, name, anonymous});
    return {id, token};
  }
  return {db, tables, addUser};
}
