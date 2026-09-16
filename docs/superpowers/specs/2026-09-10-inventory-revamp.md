# Inventory revamp: one character screen, Shop on its own button

Surveyed 2026-09-10, not yet built. Everything below is decided, so the next session should
be able to start writing code from it.

## What was asked for

> Combine the inventory with the wardrobe, the way PUBG does. Drop the lower section with
> refresh / wardrobe / shop. Shop gets its own button next to the wardrobe button.

## What is there now

| Piece | File | Entry point |
| --- | --- | --- |
| Inventory dialog | `src/inventory.ts` | `setupInventory(api)` |
| Wardrobe dialog | `src/wardrobe.ts` | `setupWardrobe(onSave)` |
| Shop dialog | `src/shop.ts` | `setupShop(onEquip)` |

`#open-wardrobe` and `#open-shop` live in the **pause/settings panel**, not the HUD. The
inventory already has the right bones:

```
header
.inventory-summary        collection + Lepak Coin balance
.inventory-layout
  aside                   <h3>Equipped</h3> .equipment-slots
                          <p>Change your base clothes in Wardrobe.</p>   <- delete
  section                 nav filters + item grid
.inventory-status
footer                    #inventory-retry "Refresh inventory"           <- delete
```

## The change

1. **Delete the footer** and the "Change your base clothes in Wardrobe" line. The refresh
   already runs on open, so the button is a leftover: keep the call, drop the UI.
2. **Move the wardrobe's base-clothes controls into the `aside`**, under the equipped
   slots, so one screen shows body and items together. `setupWardrobe` keeps its
   `onSave(look)` contract, so only its container changes and the appearance plumbing and
   the saving assertions in `wardrobe.spec.ts` stay valid.
3. **Lift both buttons out of Settings** into the HUD beside the inventory button, so the
   row reads inventory - wardrobe - Shop. Keep the ids `#open-wardrobe` and `#open-shop`;
   three specs already target them.
4. **Shop stays its own dialog.** It is a store with its own balance, purchase flow and
   error states, and folding it into the character screen means a modal over a modal.

## Watch out for

- **`#open-shop` is hidden for guests** (`$('open-shop').hidden = !!guestName` in
  `main.ts`). Whatever replaces it must keep that, or guests get a shop they cannot buy in.
- **Tap targets**: the HUD row must stay above 44px on touch. The tablet range in
  `style.css` only covers `.hud-top button`, so add the new buttons to that selector.
- **`#chat-expand` sits absolutely at `top: 4px; right: 24px`** inside the chat panel; a new
  HUD row must not overlap it. The overlap test in `tests/ipad.spec.ts` will catch it.

## Tests to update

`inventory.spec.ts` (footer gone, wardrobe controls present), `wardrobe.spec.ts` (new
container), `shop.spec.ts` (button moved). Add one asserting a guest never sees the Shop.
