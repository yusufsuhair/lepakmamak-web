// UNO's voices, on the shared engine. The primitives used to live here; game-audio.ts owns
// them now so Poker and Werewolf could have a voice without inventing an audio stack.
// The storage key is unchanged, so anyone who muted UNO stays muted.
import {createGameAudio} from './game-audio';

export function createUnoAudio() {
  return createGameAudio('uno', {
    // Seven cards each, dealt round the table, then the flick of the first face-up.
    deal: ({swish, now}) => { for (let i = 0; i < 7; i++) swish(now + i * .09); for (let i = 0; i < 7; i++) swish(now + .8 + i * .24, .04); },
    win: ({note, now}) => [523, 659, 784, 1046].forEach((f, i) => note(f, now + i * .12, .3)),
    uno: ({note, now}) => [660, 880, 1100].forEach((f, i) => note(f, now + i * .075)),
    turn: ({note, now}) => { note(740, now, .1); note(930, now + .1, .12); },
    catch: ({swish, note, now}) => { swish(now); swish(now + .14); note(260, now, .2); },
    // Anything else is a card leaving a hand. The old implementation ended in a bare
    // `else swish(at)`, and UNO picks its sound from the server's event type — so this
    // has to stay a catch-all, not a list of the kinds I happened to think of.
    default: ({swish, now}) => swish(now),
  });
}
