# Party, scoped voice, chat channels and map dots

Approved 2026-09-09. Builds on the existing room model: parties are session state, the
same way seats and rooms already are. Nothing here needs a database.

## Party

`server/party.mjs`, one party registry per room, held beside the room's player map the
way every other server module here holds its state.

```
party = { id, leader, members: Set<playerId>, invites: Map<inviteeId, {from, at}> }
```

The player object gains a single `partyId` field. `snapshot()` in `server/index.mjs`
spreads the player object, so `partyId` reaches every client with no extra plumbing —
that is what feeds the map dots.

| in | out |
| --- | --- |
| `party-invite {id}` | `party-state {party \| null}` → members |
| `party-accept` / `party-decline` | `party-invited {partyId, from:{id,name}}` → invitee |
| `party-leave` | |

Rules:

- Leader invites; a player with no party becomes leader of a new one on their first invite.
- Six members maximum.
- An invite expires after 60 seconds, and cannot target someone already in a party.
- Invites stay inside one room; there is no cross-room party.
- Leader leaving hands the party to the next member. The last member leaving deletes it.
- Disconnecting removes you, through the same path as leaving.

## Voice

Two independent scopes, one per existing button, both carried on `voice-state`.

- **Mic scope** — `all` broadcasts by proximity as today. `party` reaches only party
  members, at full volume, at any distance.
- **Speaker scope** — `all` hears everything you are eligible for. `party` hears only
  party members.

A listener receives a packet when both sides agree:

```
(speaker.scope === 'party' ? sameParty : distance < hearingRadius)
&& (listener.scope === 'party' ? sameParty : true)
```

Proximity audio keeps its existing distance curve. Party audio is flat at volume 1.
This is one branch inside the existing fanout loop; no second code path.

## Chat

`chat` gains `{channel: 'all' | 'party' | 'dm', to?: playerId}`.

- `all` — unchanged, including saving to chat history.
- `party` — delivered to party members only.
- `dm` — delivered to the target and echoed to the sender.

**Party and DM messages are never written to chat history.** That table is the public
room log; private talk does not belong in it. `filterChat` applies to all three.

The chat panel gains a tab strip above the log: `ALL · PARTY · @Name`. The composer,
which already opens on Enter and closes on send, sends to the active tab. Each tab keeps
its own unread count. DM tabs appear on first message in either direction and can be
closed.

## Map

`draw()` on the 2D minimap and expanded map, and the 3D overview, take a peer list of
`{x, z, party}`. Light blue `#49cfff` for anyone online — the colour the "YOU" marker
already uses — red for party members, and the local player keeps the white ring and YOU
label so they stay findable among peers.

## Deliberately not built

No persistence, no kick, no offline invites, no DM history, and no leader-transfer UI —
handoff is automatic. Add them when someone asks for them.

## Known limitation

`partyId` is broadcast to every client rather than masked per recipient, because
`snapshot()` spreads the whole player object. A modified client could therefore see which
party any player belongs to. Accepted: party membership is not sensitive here, and the
alternative is a per-recipient snapshot on every position update.
