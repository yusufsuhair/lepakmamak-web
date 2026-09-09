// A private message is not a broadcast scope, so it does not belong in the composer's
// ALL / PARTY list. Conversations get their own strip above the log: one chip each,
// carrying the name, the unread count and the way out of the conversation.
export type DmThread = {key: string; name: string; unread: number};

export function createDmBar(actions: {select: (key: string) => void; close: (key: string) => void}) {
  const root = document.createElement('div');
  root.id = 'chat-dms'; root.hidden = true;
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Private messages');
  const heading = document.createElement('small'); heading.textContent = 'MESEJ';
  const list = document.createElement('div'); list.className = 'dm-chips';
  root.append(heading, list);

  return {
    root,
    render(threads: DmThread[], active: string) {
      // Nothing open means nothing to show; the strip must not eat log space for free.
      root.hidden = !threads.length;
      list.replaceChildren();
      for (const thread of threads) {
        const on = thread.key === active;
        const chip = document.createElement('div'); chip.className = `dm-chip${on ? ' on' : ''}`;
        const open = document.createElement('button');
        open.type = 'button'; open.className = 'dm-open'; open.setAttribute('aria-pressed', String(on));
        open.setAttribute('aria-label', `Private messages with ${thread.name}${thread.unread ? `, ${thread.unread} unread` : ''}`);
        const face = document.createElement('i'); face.setAttribute('aria-hidden', 'true');
        face.textContent = thread.name.slice(0, 1).toUpperCase();
        const name = document.createElement('b'); name.textContent = thread.name;
        open.append(face, name);
        if (thread.unread) {
          const count = document.createElement('span'); count.className = 'opt-unread';
          count.textContent = String(thread.unread); open.append(count);
        }
        open.onclick = () => actions.select(thread.key);
        const shut = document.createElement('button');
        shut.type = 'button'; shut.className = 'dm-close'; shut.textContent = '×';
        shut.setAttribute('aria-label', `Close chat with ${thread.name}`);
        shut.onclick = event => { event.stopPropagation(); actions.close(thread.key); };
        chip.append(open, shut);
        list.append(chip);
      }
    },
  };
}
